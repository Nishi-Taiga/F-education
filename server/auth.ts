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
    
    // パフォーマンス最適化：不要なデバッグログを削除
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (error) {
    console.error("Error comparing passwords:", error);
    return false;
  }
}

export function setupAuth(app: Express) {
  // セッション設定の最適化（SameSite警告対応）
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "tutorial-service-secret",
    resave: false, // 不要な保存を減らす
    saveUninitialized: false, // 未初期化セッションを保存しない
    store: storage.sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === 'production', // 本番環境ではTLS/SSLを使用
      httpOnly: true, // JavaScriptからのアクセスを防止
      sameSite: 'lax', // クロスサイトリクエスト制限を緩和
      maxAge: 1000 * 60 * 60 * 24 // 24時間
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      const user = await storage.getUserByUsername(username);
      if (!user || !(await comparePasswords(password, user.password))) {
        return done(null, false);
      } else {
        return done(null, user);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    const user = await storage.getUser(id);
    done(null, user);
  });

  app.post("/api/register", async (req, res, next) => {
    const existingUser = await storage.getUserByUsername(req.body.username);
    if (existingUser) {
      return res.status(400).json({ message: "このユーザー名は既に使用されています" });
    }

    const user = await storage.createUser({
      ...req.body,
      password: await hashPassword(req.body.password),
    });

    req.login(user, (err) => {
      if (err) return next(err);
      res.status(201).json(user);
    });
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: Error | null, user: Express.User | false, info: { message: string } | undefined) => {
      // エラー処理を最適化
      if (err) {
        // 重大なエラーのみログ出力
        console.error("Login error:", err);
        return next(err);
      }
      
      // 認証失敗
      if (!user) {
        // 本番環境ではログ出力しない
        if (process.env.NODE_ENV === 'development') {
          console.log("Login failed for username:", req.body.username);
        }
        return res.status(401).json({ message: "ユーザー名またはパスワードが正しくありません" });
      }
      
      // セッション作成処理
      req.login(user, (loginErr) => {
        if (loginErr) {
          console.error("Session save error:", loginErr);
          return next(loginErr);
        }
        
        // 本番環境ではログ出力しない
        if (process.env.NODE_ENV === 'development') {
          console.log("Login successful for:", user.username);
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
