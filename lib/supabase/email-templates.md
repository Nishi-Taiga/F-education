# Supabase認証メールテンプレート（日本語）

Supabase認証用の日本語メールテンプレートを以下に示します。Supabaseダッシュボードの「Authentication」→「Email Templates」から設定できます。

## 1. メールアドレス確認メール（Confirm signup）

### 件名
```
【Feducation】メールアドレスの確認をお願いします
```

### 本文
```html
<h2>Feducationへようこそ</h2>

<p>こんにちは、</p>

<p>Feducationへのご登録ありがとうございます。メールアドレスの確認をお願いします。以下のボタンをクリックして、アカウント登録を完了させてください。</p>

<p>
  <a href="{{ .ConfirmationURL }}" style="display: inline-block; color: white; background-color: #6366f1; border-radius: 4px; padding: 10px 20px; text-decoration: none; margin: 20px 0px;">
    メールアドレスを確認する
  </a>
</p>

<p>または、以下のリンクをクリックしてください：<br>
<a href="{{ .ConfirmationURL }}">{{ .ConfirmationURL }}</a></p>

<p>このメールに心当たりがない場合は、無視していただいて問題ありません。</p>

<p>
よろしくお願いいたします。<br>
Feducationチーム
</p>
```

## 2. マジックリンク（Magic link）

### 件名
```
【Feducation】ログインリンク
```

### 本文
```html
<h2>Feducationへのログイン</h2>

<p>こんにちは、</p>

<p>Feducationへのログインリクエストがありました。以下のボタンをクリックして、ログインしてください。</p>

<p>
  <a href="{{ .ConfirmationURL }}" style="display: inline-block; color: white; background-color: #6366f1; border-radius: 4px; padding: 10px 20px; text-decoration: none; margin: 20px 0px;">
    ログインする
  </a>
</p>

<p>または、以下のリンクをクリックしてください：<br>
<a href="{{ .ConfirmationURL }}">{{ .ConfirmationURL }}</a></p>

<p>このリンクは60分間のみ有効です。ログインリクエストをしていない場合は、このメールを無視してください。</p>

<p>
よろしくお願いいたします。<br>
Feducationチーム
</p>
```

## 3. パスワードリセット（Reset password）

### 件名
```
【Feducation】パスワードリセットのご案内
```

### 本文
```html
<h2>パスワードリセットのご案内</h2>

<p>こんにちは、</p>

<p>Feducationアカウントのパスワードリセットのリクエストを受け付けました。以下のボタンをクリックして、新しいパスワードを設定してください。</p>

<p>
  <a href="{{ .ConfirmationURL }}" style="display: inline-block; color: white; background-color: #6366f1; border-radius: 4px; padding: 10px 20px; text-decoration: none; margin: 20px 0px;">
    パスワードをリセットする
  </a>
</p>

<p>または、以下のリンクをクリックしてください：<br>
<a href="{{ .ConfirmationURL }}">{{ .ConfirmationURL }}</a></p>

<p>このリンクは60分間のみ有効です。パスワードリセットをリクエストしていない場合は、このメールを無視してください。</p>

<p>
よろしくお願いいたします。<br>
Feducationチーム
</p>
```

## 4. SMS認証コード（SMS OTP）

※SMSを使用する場合のテンプレートです。

```
【Feducation】認証コード: {{ .Token }}

このコードは10分間有効です。心当たりがない場合は無視してください。
```

## 5. Supabaseダッシュボードでの設定方法

1. Supabaseプロジェクトのダッシュボードにログイン
2. 左サイドバーから「Authentication」を選択
3. 「Email Templates」タブをクリック
4. 各テンプレート（Confirm signup、Magic link、Reset password）を選択
5. 上記の日本語文面を「Subject」と「Message body」にコピー
6. 「Save」をクリック

これにより、認証メールが日本語で送信されるようになります。