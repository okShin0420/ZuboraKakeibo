# Frontend

ズボラ家計簿のWebクライアントです。React・TypeScript・Viteで構成されています。現在はホーム、支出入力ボトムシート、日別カレンダー、月別グラフ、設定、今月使える金額設定の操作モックを収録しています。

## 開発

```sh
npm ci
npm run dev
```

開発URLは <http://127.0.0.1:5173> です。

## コマンド

- `npm run typecheck`：TypeScriptの型確認
- `npm run build`：型確認と本番ビルド
- `npm test`：Microsoft Edgeを使ったPlaywrightテスト
- `npm run preview`：本番ビルドのローカルプレビュー

API接続を追加するときは、画面コンポーネントから直接通信処理を呼ばず、`src/` 配下にAPIクライアント層を追加してください。
