# App Store申請用の公開ページ

プライバシーポリシーとサポートの静的Webページです。ログイン、広告、アクセス解析、外部フォント、JavaScriptは使用しません。ポリシーはアプリ内本文から生成し、`docs/PRIVACY_POLICY.md`との一致も確認します。

## 生成

リポジトリのルートで実行します（Node.js 24）。

```powershell
node --experimental-strip-types public-site/scripts/build.mjs
```

出力先は`public-site/dist/`です。

## GitHub Pagesで公開

1. 既存の`okShin0420/ZuboraKakeibo`リポジトリで、この変更を`main`へpushします。専用の別リポジトリは不要です。
2. GitHubのリポジトリでSettings → Pages → Build and deploymentを開き、SourceをGitHub Actionsに設定します。
3. Actions → Publish app privacy and support pages → Run workflowを実行します。`public-site`の変更が`main`へpushされたときも自動で更新します。公開先にはビルド後のポリシー、サポート、スタイルだけを送り、アプリのソースやほかの`docs`ファイルは配信しません。
4. Pagesに表示された公開URLを、未ログインのブラウザーとiPhoneで開き、本文・問い合わせリンク・ページ間の移動を確認します。

既存リポジトリで公開した場合、URLは次の形になります。GitHub Actionsの初回Deploy成功後に実際のURLを確認します。**公開完了と閲覧確認が済むまではApp Store Connectに登録しないでください。**

- プライバシーポリシー：`https://okShin0420.github.io/ZuboraKakeibo/privacy.html`
- サポート：`https://okShin0420.github.io/ZuboraKakeibo/support.html`

App Store ConnectのApp Privacy → Privacy Policyに前者、バージョン情報のSupport URLに後者を登録します。PagesはリポジトリがPublicの場合GitHub Freeで利用できます。Privateリポジトリでは利用プランが対応しているか確認してください。公開URL確定後、アプリ内のポリシー画面にもWebで開く導線を追加します。現在のオフライン本文はそのまま利用できます。

## 更新

`mobile/src/legal/privacyPolicy.ts`と`docs/PRIVACY_POLICY.md`の本文を揃えて変更し、上記コマンドで再生成して公開先のファイルを更新します。制定日・改定日も本文と公開ページで揃えます。

参考：

- [GitHub Pagesのサイト作成](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)
- [Appleのプライバシー情報の登録](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/)
