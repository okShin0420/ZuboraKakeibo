# Backend / Database

ズボラ会計簿のデータベース設計、マイグレーション、将来のAPI実装を置く領域です。

- スマホ本番：端末内SQLite
- 開発・クラウド移行確認：ローカルPostgreSQL
- 設計書：[DATABASE_DESIGN.md](../docs/database/DATABASE_DESIGN.md)

## 必要環境

- Node.js 22.12以上
- npm
- Docker Desktop（PostgreSQLを使用する場合）

このリポジトリに同梱されたNode.jsをPowerShellで使用する場合：

```powershell
$env:Path = "C:\ZuboraKakeibo\.tools\node-v22.23.2-win-x64;$env:Path"
Set-Location C:\ZuboraKakeibo\backend
npm.cmd install
```

## SQLite

既定では `backend/data/zubora-kakeibo.sqlite` を作成します。

```powershell
npm.cmd run db:migrate:sqlite
npm.cmd run db:rollback:sqlite
```

保存先を変更する場合：

```powershell
$env:SQLITE_PATH = "C:\temp\zubora.sqlite"
npm.cmd run db:migrate:sqlite
```

接続時は必ず `PRAGMA foreign_keys = ON` を実行してください。

## PostgreSQL

```powershell
docker compose up -d postgres
$env:DATABASE_URL = "postgresql://zubora:zubora@127.0.0.1:5432/zubora_kakeibo"
npm.cmd run db:migrate:postgresql
```

ロールバック：

```powershell
npm.cmd run db:rollback:postgresql
```

## テスト

SQLiteテストは常に実行されます。`TEST_DATABASE_URL` が未設定の場合、PostgreSQLテストはスキップされます。

```powershell
$env:TEST_DATABASE_URL = "postgresql://zubora:zubora@127.0.0.1:5432/zubora_kakeibo"
npm.cmd test
```

PostgreSQLテストは専用スキーマを一時作成し、完了後に削除します。

## ディレクトリ

- `migrations/sqlite/`：端末SQLite向けup/down SQL
- `migrations/postgresql/`：開発PostgreSQL向けup/down SQL
- `scripts/`：マイグレーション実行スクリプト
- `src/domain/`：DB共通の期間計算と検証
- `tests/`：両DBのスキーマ契約テスト

Fastify API、Capacitor接続、認証、課金、クラウド同期は次の実装段階で追加します。
