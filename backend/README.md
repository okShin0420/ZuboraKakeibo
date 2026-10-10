# Backend / Database

ズボラ家計簿のSpring Bootアプリケーション、SQLite接続、Flywayマイグレーション、Entity、DAOを置く領域です。

- 今回の開発：Spring Boot + SQLite
- PostgreSQL、クラウド同期、課金：今回の対象外
- 設計書：[DATABASE_DESIGN.md](../docs/database/DATABASE_DESIGN.md)
- 機能構成図：[PROGRAM_FUNCTION_STRUCTURE.md](../docs/architecture/PROGRAM_FUNCTION_STRUCTURE.md)
- API設計書：[API_DESIGN.md](../docs/architecture/API_DESIGN.md)

> アプリ起動にはJDK 21以上とMaven 3.6.3以上が必要です。Spring BootがSQLiteへ接続し、Flywayでスキーマを管理します。既存のNode.jsスクリプトは旧方式の移行・検証用途として残しており、Flyway管理済みDBには実行できません。

## 必要環境

- JDK 21以上
- Maven 3.6.3以上
- Node.js 22.12以上（旧SQLiteマイグレーション検証を使う場合のみ）
- npm（同上）

## Spring Bootアプリ

```powershell
Set-Location C:\ZuboraKakeibo\backend
$env:SQLITE_PATH = "C:\ZuboraKakeibo\backend\data\zubora-kakeibo.sqlite"
mvn spring-boot:run
```

`SQLITE_PATH`を省略すると `backend/data/zubora-kakeibo.sqlite` を使用します。初回起動ではFlywayが開始日1〜31日対応を含むV1を適用します。旧Node.jsマイグレーション済みのDBは、1〜31日対応のスキーマを確認してからFlywayのV1として履歴へ引き継ぎます。Flyway履歴ができたDBに対してNode.jsマイグレーションは実行できません。

開始日が1〜28日の旧v1 DBは自動引き継ぎの対象外です。バックアップを取り、別途1〜31日へのスキーマ移行を行ってから起動してください。

Spring Bootの起動、DB初期化、Entity、DAO、Service、REST Controller、およびReact画面からのAPI接続を用意しています。空のDBでは画面から初期予算を登録できます。月度の自動繰り越しと祝日データ取込は今後の工程です。

`mvn test` で月度計算、SQLite DAO・Service統合、REST ControllerのHTTP・入力検証テストを実行します。

このリポジトリに同梱されたNode.jsをPowerShellで使用する場合：

```powershell
$env:Path = "C:\ZuboraKakeibo\.tools\node-v22.23.2-win-x64;$env:Path"
Set-Location C:\ZuboraKakeibo\backend
npm.cmd install
```

## 旧Node.js SQLite移行（互換・検証用）

既定では `backend/data/zubora-kakeibo.sqlite` を作成します。

```powershell
npm.cmd run db:migrate:sqlite
npm.cmd run db:rollback:sqlite
```

`db:migrate:sqlite` は `PRAGMA user_version` より新しいSQLを番号順に適用し、`db:rollback:sqlite` はV1の全テーブルを削除します。データのあるDBではロールバックしないでください。Spring Bootで運用するDBはFlywayだけで移行します。

保存先を変更する場合：

```powershell
$env:SQLITE_PATH = "C:\temp\zubora.sqlite"
npm.cmd run db:migrate:sqlite
```

接続時は必ず `PRAGMA foreign_keys = ON` を実行してください。

## 旧方式のテスト

今回の開発ではSQLiteテストだけを実行します。

```powershell
npm.cmd test
```

## ディレクトリ

- `migrations/sqlite/`：旧Node.js SQLite移行向けup/down SQL
- `src/main/resources/db/migration/`：Spring Bootが実行するFlyway migration
- `src/main/java/jp/zubora/kakeibo/entity/`：JPA EntityとSQLite型変換
- `src/main/java/jp/zubora/kakeibo/dao/`：Spring Data JPA DAO
- `src/main/java/jp/zubora/kakeibo/service/`：期間計算と画面機能のService
- `src/main/java/jp/zubora/kakeibo/controller/`：REST APIと共通エラー応答
- `migrations/postgresql/`：過去の互換性検証資産。今回の開発では使用しない
- `scripts/`：マイグレーション実行スクリプト
- `src/domain/`：既存の期間計算と検証。Spring Serviceへの移植対象
- `tests/`：SQLiteスキーマと期間計算の検証

ReactとのAPI接続は実装済みです。認証、課金、クラウド同期はMVPの対象外です。
