#!/bin/bash

# ファイルの存在を確認
echo "Current working directory: $(pwd)"
ls -la

# PostCSSの設定を完全に削除
echo "Removing postcss.config.js"
rm -f postcss.config.js

# package.jsonを確認
echo "Package.json content:"
cat package.json

# 最小限のNext.jsビルドスクリプトを作成
echo "Creating minimal build script"
cat > minimal-next.config.js << 'EOF'
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
}

module.exports = nextConfig
EOF

# ビルドを試行
echo "Attempting build with minimal config"
cp minimal-next.config.js next.config.js
npm run dev &
DEV_PID=$!
sleep 10
kill $DEV_PID

# 状態を確認
ls -la
