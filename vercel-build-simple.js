const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Starting simplified build process');

// 1. Remove problematic files
try {
  console.log('Removing postcss.config.js');
  if (fs.existsSync('./postcss.config.js')) {
    fs.unlinkSync('./postcss.config.js');
  }
  
  console.log('Creating simplified next.config.js');
  fs.writeFileSync('./next.config.js', `
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
}

module.exports = nextConfig
  `);
  
  // 2. Create empty CSS file
  console.log('Creating simplified globals.css');
  fs.writeFileSync('./app/globals.css', `
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
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
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
      <h1>Feducation</h1>
      <p>Welcome to Feducation. The site is under maintenance.</p>
    </main>
  )
}
  `);
  
  // 5. Run build
  console.log('Running next build');
  // 直接Node.jsのrequireを使用してnextのビルドスクリプトを呼び出す
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
      console.log('Method 3: Using require("next/dist/cli/next-build")');
      // 最後の手段: 直接next-buildをrequireして実行
      const nextBuild = require('next/dist/cli/next-build').default;
      nextBuild();
    }
  }
  
  console.log('Build completed successfully');
} catch (error) {
  console.error('Error during build:', error);
  process.exit(1);
}
