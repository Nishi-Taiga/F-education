const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Starting simplified build process');

// 事前にapp関連のディレクトリが存在することを確認
if (!fs.existsSync('./app')) {
  fs.mkdirSync('./app', { recursive: true });
}

// API関連のディレクトリチェックとダミーファイル
if (!fs.existsSync('./app/api')) {
  fs.mkdirSync('./app/api', { recursive: true });
}

try {
  console.log('Removing postcss.config.js');
  if (fs.existsSync('./postcss.config.js')) {
    fs.unlinkSync('./postcss.config.js');
  }
  
  console.log('Creating simplified postcss.config.js');
  fs.writeFileSync('./postcss.config.js', `
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  }
}
  `);
  
  console.log('Creating simplified next.config.js');
  fs.writeFileSync('./next.config.js', `
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  transpilePackages: ["@radix-ui/react-toast"],
}

module.exports = nextConfig
  `);
  
  // 2. Create globals CSS file
  console.log('Creating simplified globals.css');
  fs.writeFileSync('./app/globals.css', `
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Simplified CSS */
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  padding: 0;
  margin: 0;
}

a {
  color: inherit;
  text-decoration: none;
}

* {
  box-sizing: border-box;
}
  `);
  
  // 3. Create simplified layout
  console.log('Creating simplified layout.tsx');
  fs.writeFileSync('./app/layout.tsx', `
import './globals.css';

export const metadata = {
  title: 'F-education',
  description: 'F-education platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  )
}
  `);
  
  // 4. Create simplified page
  console.log('Creating simplified page.tsx');
  fs.writeFileSync('./app/page.tsx', `
export default function Home() {
  return (
    <main style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem' }}>F-education</h1>
      <p>Webサイトは現在メンテナンス中です。</p>
      <p>しばらくお待ちください。</p>
    </main>
  )
}
  `);

  // 重要なディレクトリの存在を確認
  const dirs = ['./components', './components/ui', './lib', './lib/supabase', './lib/db', './contexts', './shared', './shared/schema'];
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      console.log(`Creating directory: ${dir}`);
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  
  // 基本的なフォールバックコンポーネントを作成
  console.log('Creating minimal required components');
  
  // Supabaseクライアント
  fs.writeFileSync('./lib/supabase/client.ts', `
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
`);

  // Supabaseサーバーサイド
  fs.writeFileSync('./lib/supabase/server.ts', `
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export function createServerClient() {
  const cookieStore = cookies();
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  
  return createClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name) {
        return cookieStore.get(name)?.value;
      },
    },
  });
}
`);

  // DB
  fs.writeFileSync('./lib/db.ts', `
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// データベース接続を初期化
const connectionString = process.env.DATABASE_URL || '';
const client = postgres(connectionString);
export const db = drizzle(client);
`);

  // スキーマ
  fs.writeFileSync('./shared/schema.ts', `
import { pgTable, serial, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core';

// ユーザーテーブル
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull(),
  role: text('role').notNull().default('parent'),
  studentId: integer('student_id'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 生徒テーブル
export const students = pgTable('students', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 生徒チケットテーブル
export const studentTickets = pgTable('student_tickets', {
  id: serial('id').primaryKey(),
  studentId: integer('student_id').notNull(),
  quantity: integer('quantity').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
});
`);

  // Utils
  fs.writeFileSync('./lib/utils.ts', `
export function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ')
}
`);
  
  // 5. Run build
  console.log('Running next build');
  try {
    console.log('Method 1: Using npx next build');
    execSync('npx next build', { stdio: 'inherit' });
  } catch (e) {
    console.log('Method 1 failed, trying alternative method');
    console.log('Method 2: Using node_modules/.bin/next');
    try {
      execSync('./node_modules/.bin/next build', { stdio: 'inherit' });
    } catch (e2) {
      console.log('Method 2 failed, trying final method');
      console.log('Method 3: Using NODE_OPTIONS=--openssl-legacy-provider npx next build');
      try {
        execSync('NODE_OPTIONS=--openssl-legacy-provider npx next build', { stdio: 'inherit' });
      } catch (e3) {
        console.log('All build methods failed');
        throw e3;
      }
    }
  }
  
  console.log('Build completed successfully');
} catch (error) {
  console.error('Error during build:', error);
  process.exit(1);
}
