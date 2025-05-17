# デプロイエラー修正について

## 修正内容

今回実施した修正点は以下の2点です：

1. **ReactQueryDevtools のインポート削除**
   - エラー: `Module not found: Can't resolve '@tanstack/react-query-devtools'`
   - 原因: `@tanstack/react-query-devtools` パッケージが `dependencies` に追加されていなかった
   - 修正方法: `app/providers.tsx` ファイルから ReactQueryDevtools のインポートと使用部分を削除
   - 理由: このモジュールは開発環境でのみ必要であり、本番環境では不要なため

2. **Node.js バージョン指定の修正**
   - 警告: `Detected "engines": { "node": "18.17.0" } in your package.json with major.minor.patch, but only major Node.js Version can be selected.`
   - 原因: Vercel ではメジャーバージョンのみの指定（例：18.x）を推奨している
   - 修正方法: `package.json` 内の engines.node の値を `18.17.0` から `18.x` に変更
   - 理由: Vercel の推奨に従い、デプロイ時の警告を解消するため

以上の修正により、Vercel へのデプロイが正常に完了するようになります。