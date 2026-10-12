import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { privacyPolicyMarkdown } from './privacyPolicy.ts';

test('公開用Markdownとアプリ内のプライバシーポリシー本文が一致する', () => {
  const document = readFileSync(new URL('../../../docs/PRIVACY_POLICY.md', import.meta.url), 'utf8');
  assert.equal(document, privacyPolicyMarkdown());
});

test('端末内保存とバックアップの重要事項を明記する', () => {
  const policy = privacyPolicyMarkdown();
  for (const statement of [
    '岡田眞一郎',
    'amenochihareruya432@gmail.com',
    '端末内',
    '暗号化されておらず',
    '新しい5件',
    '外部に保存・共有したバックアップ',
  ]) {
    assert.ok(policy.includes(statement), `${statement} がありません`);
  }
});
