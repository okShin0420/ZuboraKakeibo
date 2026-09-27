# Backend / Database

ズボラ会計簿のデータベース設計、SQLiteマイグレーション、Spring Boot API実装を置く領域です。

- 今回の開発：Spring Boot + SQLite
- PostgreSQL、クラウド同期、課金：今回の対象外
- 設計書：[DATABASE_DESIGN.md](../docs/database/DATABASE_DESIGN.md)
- 機能構成図：[PROGRAM_FUNCTION_STRUCTURE.md](../docs/architecture/PROGRAM_FUNCTION_STRUCTURE.md)

> 現在のNode.jsスクリプトは、既存SQLiteマイグレーションと期間計算の検証用です。Spring Bootプロジェクトを追加後は、アプリケーションのDB接続とマイグレーションをSpring Boot／Flywayへ移行します。

## 必要環境

- Node.js 22.12以上
- npm

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

`db:migrate:sqlite` は `PRAGMA user_version` より新しいSQLを番号順に適用し、`db:rollback:sqlite` は直近の1バージョンだけ戻します。開始日に29〜31日を保存している場合は、v2からv1へのロールバックを安全のため拒否します。

保存先を変更する場合：

```powershell
$env:SQLITE_PATH = "C:\temp\zubora.sqlite"
npm.cmd run db:migrate:sqlite
```

接続時は必ず `PRAGMA foreign_keys = ON` を実行してください。

## テスト

今回の開発ではSQLiteテストだけを実行します。

```powershell
npm.cmd test
```

## ディレクトリ

- `migrations/sqlite/`：端末SQLite向けup/down SQL
- `migrations/postgresql/`：過去の互換性検証資産。今回の開発では使用しない
- `scripts/`：マイグレーション実行スクリプト
- `src/domain/`：既存の期間計算と検証。Spring Serviceへの移植対象
- `tests/`：SQLiteスキーマと期間計算の検証

Spring Boot API、Reactとの接続、認証、課金、クラウド同期は段階的に追加します。
