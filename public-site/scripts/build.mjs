import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { privacyPolicyEffectiveDate, privacyPolicySections, privacyPolicyMarkdown } from '../../mobile/src/legal/privacyPolicy.ts';

const root = new URL('../', import.meta.url);
const output = new URL('dist/', root);
const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const email = 'amenochihareruya432@gmail.com';
const contact = `<a href="mailto:${email}">${email}</a>`;
const paragraph = text => `<p>${escape(text).replaceAll(email, contact)}</p>`;

function page(title, body, description) {
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escape(description)}">
  <title>${escape(title)} | ズボラ家計簿</title>
  <link rel="stylesheet" href="./styles.css">
</head>
<body>
  <a class="skip" href="#main">本文へ移動</a>
  <header><div class="header-inner">
    <a class="brand" href="./index.html">ズボラ家計簿</a>
    <nav aria-label="サイト内メニュー"><a href="./privacy.html">プライバシーポリシー</a><a href="./support.html">サポート</a></nav>
  </div></header>
  <main id="main">${body}</main>
  <footer>運営者：岡田眞一郎 · <a href="./support.html">お問い合わせ</a></footer>
</body>
</html>
`;
}

const markdown = await readFile(new URL('../../docs/PRIVACY_POLICY.md', import.meta.url), 'utf8');
if (markdown.replaceAll('\r\n', '\n') !== privacyPolicyMarkdown()) {
  throw new Error('公開用Markdownとアプリ内本文が一致しません。本文を揃えてから生成してください。');
}
await mkdir(output, { recursive: true });
const privacyBody = `<h1>プライバシーポリシー</h1><p class="date">制定日：${escape(privacyPolicyEffectiveDate)}</p>` +
  privacyPolicySections.map(section => `<section><h2>${escape(section.title)}</h2>${section.paragraphs.map(paragraph).join('')}</section>`).join('\n');
await writeFile(new URL('privacy.html', output), page('プライバシーポリシー', privacyBody, 'ズボラ家計簿のデータ保存、通知、バックアップ・復元、削除について説明します。'));
await writeFile(new URL('support.html', output), page('サポート', `
<h1>サポート</h1>
<p>ズボラ家計簿についてのご質問や、不具合のご連絡はこちらへお寄せください。</p>
<section><h2>お問い合わせ</h2><p>運営者：岡田眞一郎<br>メール：${contact}</p>
<p>不具合については、お使いの機種、iOSのバージョン、アプリのバージョン、問題が起きたときの操作をお知らせください。</p>
<p>予算・支出・メモは端末内に保存され、運営者からは確認できません。お問い合わせのために、家計の記録やバックアップファイルを送る必要はありません。</p></section>
<section><h2>データを残すには</h2><p>アプリの設定画面で「バックアップ」を選び、ファイルを保存してください。バックアップは暗号化されていないJSONファイルです。保存先と共有相手をご確認ください。</p></section>
<section><h2>データを削除するには</h2><p>設定画面の「全データを削除」から、端末内のアプリデータを削除できます。外部に保存したバックアップと、OSが管理する端末バックアップは別途保存先で削除してください。</p></section>
<p>データの取り扱いについては、<a href="./privacy.html">プライバシーポリシー</a>をご覧ください。</p>
`, 'ズボラ家計簿のお問い合わせ先と、バックアップ・データ削除の案内です。'));
await writeFile(new URL('index.html', output), page('ご案内', `
<h1>ズボラ家計簿</h1>
<p>今月あといくら使えるかを、負担なく把握するためのモバイルアプリです。</p>
<p><a href="./privacy.html">プライバシーポリシーを読む</a></p>
<p><a href="./support.html">サポート・お問い合わせ</a></p>
`, 'ズボラ家計簿のプライバシーポリシーとサポートのご案内です。'));
await copyFile(new URL('src/styles.css', root), new URL('styles.css', output));
await writeFile(new URL('.nojekyll', output), '');

// 公開用HTMLに本文の抜けや外部リソースがないことを確認する。
const html = await readFile(new URL('privacy.html', output), 'utf8');
for (const section of privacyPolicySections) {
  for (const text of [section.title, ...section.paragraphs]) {
    const rendered = escape(text).replaceAll(email, contact);
    if (!html.includes(rendered)) throw new Error(`本文が欠けています: ${section.title}`);
  }
}
if (/<script\b|(?:src|href)="https?:\/\//i.test(html)) throw new Error('不要な外部リソースがあります。');
console.log(`公開用ページを生成・検証しました: ${fileURLToPath(output)}`);
