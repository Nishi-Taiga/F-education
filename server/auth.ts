import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

export async function hashPassword(password: string) {
  const scryptPromise = promisify(scrypt);
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptPromise(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  try {
    const scryptPromise = promisify(scrypt);
    const [hashed, salt] = stored.split(".");
    
    if (!hashed || !salt) {
      console.error("Invalid stored password format:", stored);
      return false;
    }
    
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptPromise(supplied, salt, 64)) as Buffer;
    
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (error) {
    console.error("Error comparing passwords:", error);
    return false;
  }
}

export function setupAuth(app: Express) {
  // MemoryStoreの場合はclearメソッドがないため、直接アクセスはしない
  console.log("新しいセッションで開始します");
  
  // セッション設定
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "tutorial-service-secret",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 // 24時間
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // メールアドレスでのログインに対応するために、usernameFieldを指定
  passport.use(
    new LocalStrategy({
      usernameField: 'email', // メールアドレスをユーザー名として使用
      passwordField: 'password'
    }, async (email, password, done) => {
      try {
        // ユーザー名（メールアドレス）でユーザーを検索
        const user = await storage.getUserByEmail(email);
        
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false, { message: "メールアドレスまたはパスワードが正しくありません" });
        }
        
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      console.log("デシリアライズ試行 ID:", id);
      const user = await storage.getUser(id);
      if (!user) {
        console.log("ユーザーが見つかりません:", id);
        return done(null, false);
      }
      console.log("ユーザーをデシリアライズしました:", id);
      done(null, user);
    } catch (error) {
      console.error("デシリアライズエラー:", error);
      done(error, null);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const { email, password, username, displayName } = req.body;
      
      // メールアドレスが既に存在するか確認
      const existingUserByEmail = await storage.getUserByEmail(email);
      if (existingUserByEmail) {
        return res.status(400).json({ message: "このメールアドレスは既に使用されています" });
      }
      
      // ユーザー名が指定されていない場合はメールアドレスを使用
      const finalUsername = username || email;
      
      // ユーザー名が既に存在するか確認
      const existingUserByUsername = await storage.getUserByUsername(finalUsername);
      if (existingUserByUsername) {
        return res.status(400).json({ message: "このユーザー名は既に使用されています" });
      }

      // 新規ユーザーを作成
      const user = await storage.createUser({
        username: finalUsername,
        email,
        password: await hashPassword(password),
        displayName: displayName || email.split('@')[0], // 表示名がない場合はメールアドレスの最初の部分を使用
        role: "user" // デフォルトはユーザーロール
      });

      // 自動的にログイン
      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json(user);
      });
    } catch (error) {
      console.error("Registration error:", error);
      return res.status(500).json({ message: "アカウント作成中にエラーが発生しました" });
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: Error | null, user: Express.User | false, info: { message: string } | undefined) => {
      if (err) {
        console.error("Login error:", err);
        return next(err);
      }
      
      if (!user) {
        if (process.env.NODE_ENV === 'development') {
          console.log("Login failed for email:", req.body.email);
        }
        return res.status(401).json({ message: info?.message || "メールアドレスまたはパスワードが正しくありません" });
      }
      
      req.login(user, (loginErr) => {
        if (loginErr) {
          console.error("Session save error:", loginErr);
          return next(loginErr);
        }
        
        if (process.env.NODE_ENV === 'development') {
          console.log("Login successful for:", user.email);
        }
        return res.status(200).json(user);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user);
  });
}
