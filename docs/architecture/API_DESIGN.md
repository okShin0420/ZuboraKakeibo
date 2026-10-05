# ズボラ会計簿 API設計書

## 目的と接続方式

React画面は`/api/v1`以下のSpring Boot REST APIを呼び、Spring Data JPA経由でSQLiteを参照・更新する。通信はJSON、金額は整数の円、日付は`YYYY-MM-DD`、年月は`YYYY-MM`とする。画面内の固定値は保存データとして扱わない。

開発時はViteが`/api`を`http://127.0.0.1:8080`へ転送する。フロントの接続先は`VITE_API_BASE_URL`で変更でき、未指定時は`/api/v1`を使う。SQLiteの所有者はSpring Bootであり、ReactからDBへ直接接続しない。

## エンドポイント

| 操作 | HTTP | URL | 入力 | 出力 | 成功 |
| --- | --- | --- | --- | --- | --- |
| 初期設定状態 | GET | `/api/v1/setup` | なし | `SetupStatusResponse` | 200 |
| 初期予算登録 | POST | `/api/v1/setup` | `SetupRequest` | `SettingsResponse` | 201 |
| ホーム表示 | GET | `/api/v1/home?asOf=YYYY-MM-DD` | 基準日 | `HomeResponse` | 200 |
| 支出登録 | POST | `/api/v1/expenses` | `CreateExpenseRequest` | `ExpenseResponse` | 201 |
| 支出編集 | PUT | `/api/v1/expenses/{expenseId}` | UUID、`UpdateExpenseRequest` | `ExpenseResponse` | 200 |
| 月別カレンダー | GET | `/api/v1/calendar?month=YYYY-MM` | 表示年月 | `CalendarMonthResponse` | 200 |
| 日別明細 | GET | `/api/v1/calendar/days/{date}` | 日付 | `DailyExpensesResponse` | 200 |
| 年別グラフ | GET | `/api/v1/graphs/yearly?year=YYYY` | 表示年 | `YearlyBudgetSummaryResponse` | 200 |
| 設定取得 | GET | `/api/v1/settings` | なし | `SettingsResponse` | 200 |
| 設定更新 | PUT | `/api/v1/settings` | `UpdateSettingsRequest` | `SettingsResponse` | 200 |
| 現在予算取得 | GET | `/api/v1/budgets/current?asOf=YYYY-MM-DD` | 基準日 | `BudgetResponse` | 200 |
| 現在予算更新 | PUT | `/api/v1/budgets/current` | `UpdateBudgetRequest` | `BudgetResponse` | 200 |

初期設定はDBが空の場合だけ実行できる。画面で決めた`budgetAmount`（1〜999,999,999円）を保存し、月度開始日1日、土日祝調整OFF、月初通知ON、タイムゾーン`Asia/Tokyo`で現在月度を作る。再実行は409。初期設定後の変更は既存の設定・予算APIを使う。土日祝調整は祝日データの年単位カバレッジが必要で、不足時は422を返す。

## 主要なJSON

`POST /api/v1/expenses`
```json
{"spentOn":"2026-09-21","amount":1200,"memo":"ランチ"}
```

`PUT /api/v1/settings`
```json
{"monthlyNotificationEnabled":true,"startDay":18,"adjustForWeekendsAndHolidays":false}
```

`PUT /api/v1/budgets/current`
```json
{"asOf":"2026-09-21","amount":50000}
```

`memo`は省略・`null`を許可し、空文字はServiceで`null`へ正規化する。`SettingsResponse`は進行中と次月度の実際の`startDate`・`endDate`を返し、React側では期間を再計算しない。グラフは1〜12月を返し、未作成月は0、選択した月の棒と金額は`remainingAmount`を使う。残額が負でも正常なデータとして扱う。

## エラー契約

すべての業務エラーは`ErrorResponse { code, message, fieldErrors, timestamp }`を返す。`fieldErrors`はフィールド名から検証メッセージへの対応で、対象がなければ空オブジェクトとする。

| HTTP | code | 用途 |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | 必須項目・型・金額範囲・日付形式の不正 |
| 404 | `NOT_FOUND` | 支出IDまたは対象月度が存在しない |
| 409 | `CONFLICT` | 初期設定の再実行、既存期間・支出との競合 |
| 422 | `BUSINESS_RULE` | 祝日データ不足など業務条件未成立 |
| 500 | `INTERNAL_ERROR` | 想定外のサーバー処理失敗 |

フロントは`ApiError`としてHTTPステータス、code、message、fieldErrorsを受け取る。保存成功後だけ入力シートを閉じ、ホーム・カレンダー・グラフなど関係する取得結果を再取得する。通信失敗時は入力値を保持し、再試行できる状態にする。

## 画面との対応と現段階の制約

ホーム入力は当日を`spentOn`として支出登録し、保存後にホームを再取得する。カレンダーの追加・編集は選択日と支出IDを使い、保存後に月別集計・日別明細を再取得する。設定更新はレスポンスに含まれる月度範囲を表示し、予算更新後はホームを再取得する。グラフの年候補は`availableYears`だけを表示する。

現在のバックエンドは初回月度を作るが、月度をまたいだ際の自動生成は未実装である。次月度が未作成のまま切り替わると対象日の取得は404になるため、継続運用前に月度繰り越し処理が必要。祝日データの取込も別工程とする。ViteプロキシはWeb開発環境向けであり、Capacitor実機から別オリジンのAPIを呼ぶ構成は接続先・CORS・HTTPS等を別途決める。
