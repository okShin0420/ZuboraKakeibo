# ズボラ会計簿 プログラム機能構成図

## 1. 目的

本書は、現行の画面モックを実データへ接続するときの機能構成を、画面操作からデータベースまで一続きで追跡できるように定義します。

- 今回の開発は、ReactクライアントからSpring Boot REST APIを呼び出し、SQLiteへ保存します。
- Spring BootはController、Service、Spring Data JPA DAOのレイヤーで構成します。
- PostgreSQL、クラウド同期、課金は今回の開発対象に含めません。
- クラス名、メソッド名、DTO名は英語、画面名と説明は日本語で表記します。

> 現行モックはReactのコンポーネント状態だけで動作しており、SQLiteおよびREST APIにはまだ接続していません。本書のController／Service／DAOは、今回実装するSpring Bootバックエンドの設計上のインターフェースです。

## 2. 対象画面

| ID | 画面 | 役割 |
| --- | --- | --- |
| SCR-01 | ホーム | 今月の残り予算、今日の支出、残り日数を確認する起点画面 |
| SCR-02 | 支出入力ボトムシート | 金額必須、メモ任意で支出を登録・編集する操作画面 |
| SCR-03 | カレンダー | 日別支出合計と選択日の明細を確認する画面 |
| SCR-04 | グラフ | 年内の月別残額を確認する画面 |
| SCR-05 | 設定ボトムシート | 通知、月度の開始日、土日祝による終了日の自動調整を設定する画面 |
| SCR-06 | 今月使える金額ボトムシート | 進行中期間の予算額を変更する画面 |

カレンダーの日別明細は `SCR-03` 内の表示領域として扱い、独立画面にはしません。支出入力、設定、今月使える金額は画面上に重なるボトムシートですが、入出力と遷移を持つため独立した操作画面として扱います。

## 3. システム全体構成

```mermaid
flowchart LR
    UI[React UI\n6画面]
    CLIENT[REST API Client]
    CTRL[Spring REST Controller]
    SVC[Spring Service]
    DAO[Spring Data JPA DAO]
    SQLITE[(SQLite)]

    UI -->|HTTP / JSON| CLIENT --> CTRL --> SVC --> DAO --> SQLITE

    classDef app fill:#e8f7f5,stroke:#079da7,color:#0d393d,stroke-width:2px;
    classDef server fill:#edf5ff,stroke:#1e90ff,color:#163a5f,stroke-width:1.5px;
    class UI,CLIENT app;
    class CTRL,SVC,DAO,SQLITE server;
```

### 3.1 今回の技術境界

| 層 | 技術 | 責務 |
| --- | --- | --- |
| UI | React・TypeScript | 画面状態、入力、APIレスポンスの表示 |
| API Client | TypeScript | HTTPリクエスト、レスポンスDTOの受け取り |
| Controller | Spring Boot | HTTP、Bean Validation、DTO変換 |
| Service | Spring Boot | 期間計算、入力検証、トランザクション |
| DAO | Spring Data JPA | SQLiteに対する永続化と検索 |
| Database | SQLite | アプリデータの保存 |
| アカウント | なし | 認証導入時に別途追加 |

## 4. 画面遷移図

```mermaid
flowchart TD
    HOME[SCR-01 ホーム]
    EXPENSE[SCR-02 支出入力]
    CALENDAR[SCR-03 カレンダー]
    GRAPH[SCR-04 グラフ]
    SETTINGS[SCR-05 設定]
    MONEY[SCR-06 今月使える金額]

    HOME -->|入力する| EXPENSE
    EXPENSE -->|保存する: 登録後| HOME
    EXPENSE -->|閉じる・背景タップ・Esc| HOME

    HOME -->|カレンダータブ| CALENDAR
    CALENDAR -->|ホームタブ| HOME
    CALENDAR -->|グラフタブ| GRAPH
    CALENDAR -->|明細行・鉛筆: 編集| EXPENSE
    CALENDAR -->|＋: 新規登録| EXPENSE
    EXPENSE -->|保存する・閉じる| CALENDAR

    HOME -->|グラフタブ| GRAPH
    GRAPH -->|ホームタブ| HOME
    GRAPH -->|カレンダータブ| CALENDAR

    HOME -->|設定アイコン| SETTINGS
    SETTINGS -->|今月使える金額| MONEY
    MONEY -->|保存する| SETTINGS
    MONEY -->|閉じる・背景タップ・Esc| SETTINGS
    SETTINGS -->|閉じる・背景タップ・Esc| HOME
```

## 5. 画面機能一覧

API欄は今回のSpring Boot開発環境で使用するエンドポイントです。画面はREST API Clientを通じて呼び出します。

| 遷移前画面 | ボタン／リンク | 遷移後画面 | 画面への入力 | 画面の出力 | 将来API |
| --- | --- | --- | --- | --- | --- |
| アプリ起動 | 初期表示 | ホーム | 基準日 | 対象月、予算額、残り予算、今日の支出、残り日数、コメント | `GET /api/v1/home?asOf=YYYY-MM-DD` |
| ホーム | 入力する | 支出入力 | 初期金額0、当日、空メモ、登録モード | 金額、メモ、保存可否 | 画面表示時はAPIなし |
| 支出入力 | 保存する | ホーム | 利用日、金額、任意メモ | 登録した支出、再取得したホーム情報 | `POST /api/v1/expenses`、`GET /api/v1/home` |
| ホーム／カレンダー／グラフ | ホームタブ | ホーム | 基準日 | ホーム情報 | `GET /api/v1/home` |
| ホーム／カレンダー／グラフ | カレンダータブ | カレンダー | 表示年月 | 対象期間、日別支出合計 | `GET /api/v1/calendar?month=YYYY-MM` |
| カレンダー | 前月／翌月 | カレンダー | 表示年月 | 切替後の対象期間、日別支出合計 | `GET /api/v1/calendar?month=YYYY-MM` |
| カレンダー | 対象期間内の日付 | カレンダー内の日別明細 | 選択日 | 当日の支出合計、支出明細 | `GET /api/v1/calendar/days/{date}` |
| カレンダー | ＋ | 支出入力 | 選択日、初期金額0、空メモ、登録モード | 金額、メモ、保存可否 | 画面表示時はAPIなし |
| カレンダー | 明細行／鉛筆 | 支出入力 | 支出ID、既存金額、既存メモ、利用日、編集モード | 編集対象の金額とメモ | 既に取得した明細を使用 |
| 支出入力 | 保存する（編集） | カレンダー | 支出ID、利用日、金額、任意メモ | 更新した支出、更新後の日別合計 | `PUT /api/v1/expenses/{expenseId}` |
| ホーム／カレンダー／グラフ | グラフタブ | グラフ | 表示年 | 月別予算、支出合計、残り金額 | `GET /api/v1/graphs/yearly?year=YYYY` |
| グラフ | 前年／翌年 | グラフ | 表示年 | 切替後の月別集計 | `GET /api/v1/graphs/yearly?year=YYYY` |
| グラフ | 月の棒 | グラフ | 対象月 | 選択線と対象月表示 | 追加APIなし |
| ホーム | 設定アイコン | 設定 | なし | 通知、月度の開始日、土日祝調整、今月度・次月度の範囲、現在予算 | `GET /api/v1/settings` |
| 設定 | 通知／期間の各入力 | 設定 | 通知ON/OFF、月度の開始日、土日祝調整 | 更新後設定、今月度・次月度の実際の範囲 | `PUT /api/v1/settings` |
| 設定 | 今月使える金額 | 今月使える金額 | 現在の予算額 | 編集中の予算額 | 既に取得した設定を使用 |
| 今月使える金額 | 保存する | 設定 | 基準日、予算額 | 更新後の予算期間 | `PUT /api/v1/budgets/current` |
| 各ボトムシート | 閉じる／背景タップ／Esc | 遷移元画面 | 編集途中の値 | 保存せず破棄 | APIなし |

## 6. Spring Boot REST API機能構成

### 6.1 API一覧

| 機能ID | HTTP | パス | Request | Response | Controller |
| --- | --- | --- | --- | --- | --- |
| FN-01 | GET | `/api/v1/home?asOf={date}` | `LocalDate asOf` | `HomeResponse` | `HomeController` |
| FN-02 | POST | `/api/v1/expenses` | `CreateExpenseRequest` | `ExpenseResponse` | `ExpenseController` |
| FN-03 | PUT | `/api/v1/expenses/{expenseId}` | `UUID expenseId`, `UpdateExpenseRequest` | `ExpenseResponse` | `ExpenseController` |
| FN-04 | GET | `/api/v1/calendar?month={yearMonth}` | `YearMonth month` | `CalendarMonthResponse` | `CalendarController` |
| FN-05 | GET | `/api/v1/calendar/days/{date}` | `LocalDate date` | `DailyExpensesResponse` | `CalendarController` |
| FN-06 | GET | `/api/v1/graphs/yearly?year={year}` | `int year` | `YearlyBudgetSummaryResponse` | `GraphController` |
| FN-07 | GET | `/api/v1/settings` | なし | `SettingsResponse` | `SettingsController` |
| FN-08 | PUT | `/api/v1/settings` | `UpdateSettingsRequest` | `SettingsResponse` | `SettingsController` |
| FN-09 | PUT | `/api/v1/budgets/current` | `UpdateBudgetRequest` | `BudgetResponse` | `BudgetController` |

### 6.2 Controller／Service／DAO／テーブル対応

| 機能ID | Controllerメソッド（引数）／出力 | Serviceメソッド（引数）／出力 | DAOメソッド（引数）／出力 | テーブル／ビュー |
| --- | --- | --- | --- | --- |
| FN-01 | `HomeController.getHome(LocalDate asOf): HomeResponse` | `HomeService.getHome(LocalDate asOf): HomeResult` | `BudgetPeriodDao.findSummaryContaining(LocalDate date): Optional<BudgetPeriodSummaryProjection>`<br>`ExpenseDao.sumAmountBySpentOn(LocalDate date): long` | `budget_periods`、`expenses`、`budget_period_summary` |
| FN-02 | `ExpenseController.createExpense(CreateExpenseRequest request): ExpenseResponse` | `ExpenseService.createExpense(CreateExpenseCommand command): ExpenseResult` | `BudgetPeriodDao.findContainingDate(LocalDate date): Optional<BudgetPeriodEntity>`<br>`ExpenseDao.save(ExpenseEntity entity): ExpenseEntity` | `budget_periods`、`expenses` |
| FN-03 | `ExpenseController.updateExpense(UUID expenseId, UpdateExpenseRequest request): ExpenseResponse` | `ExpenseService.updateExpense(UUID expenseId, UpdateExpenseCommand command): ExpenseResult` | `ExpenseDao.findById(UUID id): Optional<ExpenseEntity>`<br>`BudgetPeriodDao.findContainingDate(LocalDate date): Optional<BudgetPeriodEntity>`<br>`ExpenseDao.save(ExpenseEntity entity): ExpenseEntity` | `expenses`、`budget_periods` |
| FN-04 | `CalendarController.getMonthlyCalendar(YearMonth month): CalendarMonthResponse` | `CalendarService.getMonthlyCalendar(YearMonth month): CalendarMonthResult` | `BudgetPeriodDao.findByLabelMonth(LocalDate labelMonth): Optional<BudgetPeriodEntity>`<br>`ExpenseDao.sumAmountByDateRange(LocalDate from, LocalDate to): List<DailyExpenseTotalProjection>` | `budget_periods`、`expenses` |
| FN-05 | `CalendarController.getDailyExpenses(LocalDate date): DailyExpensesResponse` | `CalendarService.getDailyExpenses(LocalDate date): DailyExpensesResult` | `ExpenseDao.findAllBySpentOnOrderByCreatedAtAsc(LocalDate date): List<ExpenseEntity>` | `expenses` |
| FN-06 | `GraphController.getYearlySummary(int year): YearlyBudgetSummaryResponse` | `GraphService.getYearlySummary(int year): YearlyBudgetSummaryResult` | `BudgetPeriodDao.findSummariesByLabelMonthBetween(LocalDate from, LocalDate to): List<BudgetPeriodSummaryProjection>` | `budget_periods`、`expenses`、`budget_period_summary` |
| FN-07 | `SettingsController.getSettings(): SettingsResponse` | `SettingsService.getSettings(LocalDate asOf): SettingsResult` | `AppSettingsDao.findById(short id): Optional<AppSettingsEntity>`<br>`BudgetCycleRuleDao.findEffectiveAt(LocalDate date): Optional<BudgetCycleRuleEntity>`<br>`BudgetPeriodDao.findContainingDate(LocalDate date): Optional<BudgetPeriodEntity>` | `app_settings`、`budget_cycle_rules`、`budget_periods` |
| FN-08 | `SettingsController.updateSettings(UpdateSettingsRequest request): SettingsResponse` | `SettingsService.updateSettings(UpdateSettingsCommand command): SettingsResult` | `AppSettingsDao.save(AppSettingsEntity entity): AppSettingsEntity`<br>`BudgetCycleRuleDao.findEffectiveAt(LocalDate date): Optional<BudgetCycleRuleEntity>`<br>`BudgetCycleRuleDao.findOverlapping(LocalDate from, LocalDate to): List<BudgetCycleRuleEntity>`<br>`BudgetCycleRuleDao.save(BudgetCycleRuleEntity entity): BudgetCycleRuleEntity`<br>`HolidayCoverageDao.existsById(short year): boolean`<br>`HolidayDao.findAllByCalendarYear(short year): List<HolidayEntity>` | `app_settings`、`budget_cycle_rules`、`holiday_calendar_coverage`、`holidays` |
| FN-09 | `BudgetController.updateCurrentBudget(UpdateBudgetRequest request): BudgetResponse` | `BudgetService.updateCurrentBudget(LocalDate asOf, long amount): BudgetResult` | `BudgetPeriodDao.findContainingDate(LocalDate date): Optional<BudgetPeriodEntity>`<br>`BudgetPeriodDao.save(BudgetPeriodEntity entity): BudgetPeriodEntity` | `budget_periods` |

### 6.3 Controllerクラス

| クラス | 責務 | メソッド |
| --- | --- | --- |
| `HomeController` | ホーム表示用の集約結果をHTTPレスポンスへ変換 | `getHome(LocalDate asOf): HomeResponse` |
| `ExpenseController` | 支出登録・編集リクエストの検証とDTO変換 | `createExpense(CreateExpenseRequest request): ExpenseResponse`<br>`updateExpense(UUID expenseId, UpdateExpenseRequest request): ExpenseResponse` |
| `CalendarController` | 月別カレンダーと日別明細の取得 | `getMonthlyCalendar(YearMonth month): CalendarMonthResponse`<br>`getDailyExpenses(LocalDate date): DailyExpensesResponse` |
| `GraphController` | 年別の月次集計取得 | `getYearlySummary(int year): YearlyBudgetSummaryResponse` |
| `SettingsController` | 設定の取得と次期間向け設定更新 | `getSettings(): SettingsResponse`<br>`updateSettings(UpdateSettingsRequest request): SettingsResponse` |
| `BudgetController` | 進行中期間の予算額更新 | `updateCurrentBudget(UpdateBudgetRequest request): BudgetResponse` |

ControllerはHTTP、Bean Validation、DTO変換だけを担当し、DBアクセスや期間計算を行いません。基準日をリクエストに持たない設定取得では、Controllerが `Clock` から `Asia/Tokyo` の当日を求めてServiceへ渡します。

### 6.4 Serviceクラス

| クラス | メソッド（引数）／出力 | 主な処理 | トランザクション |
| --- | --- | --- | --- |
| `HomeService` | `getHome(LocalDate asOf): HomeResult` | 対象期間、残額、当日支出、残り日数を集約 | 読み取り専用 |
| `ExpenseService` | `createExpense(CreateExpenseCommand command): ExpenseResult`<br>`updateExpense(UUID expenseId, UpdateExpenseCommand command): ExpenseResult` | 金額・メモ・期間内日付を検証し、支出を登録・更新 | 必須 |
| `CalendarService` | `getMonthlyCalendar(YearMonth month): CalendarMonthResult`<br>`getDailyExpenses(LocalDate date): DailyExpensesResult` | 対象期間と日別合計、当日明細を取得 | 読み取り専用 |
| `GraphService` | `getYearlySummary(int year): YearlyBudgetSummaryResult` | 1月から12月までの予算・支出・残額を整列 | 読み取り専用 |
| `SettingsService` | `getSettings(LocalDate asOf): SettingsResult`<br>`updateSettings(UpdateSettingsCommand command): SettingsResult` | 通知更新、現ルール終了、次期間ルール作成、期間重複・祝日カバレッジ確認 | 更新時必須 |
| `BudgetService` | `updateCurrentBudget(LocalDate asOf, long amount): BudgetResult` | 進行中期間の予算額を即時更新 | 必須 |

### 6.5 DAOクラス

DAOはSpring Data JPAのRepositoryインターフェースとして定義します。`save` と `findById` は `JpaRepository` の標準メソッドを使用し、日付範囲・集計検索はSQLite向けのJPQLまたはnative queryで定義します。

| DAO | メソッド（引数）／出力 | 対象 |
| --- | --- | --- |
| `AppSettingsDao` | `findById(Short id): Optional<AppSettingsEntity>`<br>`save(AppSettingsEntity entity): AppSettingsEntity` | `app_settings` |
| `BudgetCycleRuleDao` | `findEffectiveAt(LocalDate date): Optional<BudgetCycleRuleEntity>`<br>`findOverlapping(LocalDate from, LocalDate to): List<BudgetCycleRuleEntity>`<br>`save(BudgetCycleRuleEntity entity): BudgetCycleRuleEntity` | `budget_cycle_rules` |
| `BudgetPeriodDao` | `findContainingDate(LocalDate date): Optional<BudgetPeriodEntity>`<br>`findByLabelMonth(LocalDate labelMonth): Optional<BudgetPeriodEntity>`<br>`findSummaryContaining(LocalDate date): Optional<BudgetPeriodSummaryProjection>`<br>`findSummariesByLabelMonthBetween(LocalDate from, LocalDate to): List<BudgetPeriodSummaryProjection>`<br>`save(BudgetPeriodEntity entity): BudgetPeriodEntity` | `budget_periods`、`budget_period_summary` |
| `ExpenseDao` | `findById(UUID id): Optional<ExpenseEntity>`<br>`findAllBySpentOnOrderByCreatedAtAsc(LocalDate date): List<ExpenseEntity>`<br>`sumAmountBySpentOn(LocalDate date): long`<br>`sumAmountByDateRange(LocalDate from, LocalDate to): List<DailyExpenseTotalProjection>`<br>`save(ExpenseEntity entity): ExpenseEntity` | `expenses` |
| `HolidayCoverageDao` | `existsById(Short calendarYear): boolean` | `holiday_calendar_coverage` |
| `HolidayDao` | `findAllByCalendarYear(Short calendarYear): List<HolidayEntity>` | `holidays` |

## 7. 入出力DTO

### 7.1 Request

| DTO | フィールド | 制約 |
| --- | --- | --- |
| `CreateExpenseRequest` | `LocalDate spentOn`、`long amount`、`String memo` | 日付必須、金額1〜999,999,999、メモNULLまたは120文字以内 |
| `UpdateExpenseRequest` | `LocalDate spentOn`、`long amount`、`String memo` | 登録時と同じ。空文字メモはNULLへ正規化 |
| `UpdateSettingsRequest` | `boolean monthlyNotificationEnabled`、`int startDay`、`boolean adjustForWeekendsAndHolidays` | 開始日は1〜31。存在しない日付は月末へ丸め、土日祝調整ONなら開始日を直前の平日へ調整。終了日は次月度の調整済み開始日の前日 |
| `UpdateBudgetRequest` | `LocalDate asOf`、`long amount` | 基準日必須、金額1〜999,999,999 |

### 7.2 Response／Service Result

| DTO | 主なフィールド |
| --- | --- |
| `HomeResponse`／`HomeResult` | `labelMonth`、`budgetAmount`、`spentAmount`、`remainingAmount`、`todayExpense`、`remainingDays`、`message` |
| `ExpenseResponse`／`ExpenseResult` | `id`、`budgetPeriodId`、`spentOn`、`amount`、`memo`、`createdAt`、`updatedAt` |
| `CalendarMonthResponse`／`CalendarMonthResult` | `month`、`periodStart`、`periodEnd`、`List<DailyExpenseTotal>` |
| `DailyExpensesResponse`／`DailyExpensesResult` | `date`、`totalAmount`、`List<ExpenseResponse>` |
| `YearlyBudgetSummaryResponse`／`YearlyBudgetSummaryResult` | `year`、`List<MonthlyBudgetSummary>` |
| `SettingsResponse`／`SettingsResult` | `monthlyNotificationEnabled`、`timezone`、`startDay`、`adjustForWeekendsAndHolidays`、`currentBudgetAmount`、`currentPeriodRange`、`nextPeriodRange` |
| `BudgetResponse`／`BudgetResult` | `budgetPeriodId`、`labelMonth`、`budgetAmount`、`remainingAmount`、`updatedAt` |

`MonthlyBudgetSummary` は `month`、`budgetAmount`、`spentAmount`、`remainingAmount`、`expenseCount` を持ちます。データがない月はServiceが0件の月として補完し、1月から12月の順で返します。

## 8. 代表データフロー

### 8.1 ホーム表示

```mermaid
sequenceDiagram
    participant UI as ホーム
    participant C as HomeController
    participant S as HomeService
    participant BP as BudgetPeriodDao
    participant E as ExpenseDao

    UI->>C: GET /api/v1/home?asOf=2026-09-21
    C->>S: getHome(asOf)
    S->>BP: findSummaryContaining(asOf)
    BP-->>S: BudgetPeriodSummaryProjection
    S->>E: sumAmountBySpentOn(asOf)
    E-->>S: todayExpense
    S-->>C: HomeResult
    C-->>UI: HomeResponse 200
```

### 8.2 支出登録・編集

```mermaid
sequenceDiagram
    participant UI as 支出入力
    participant C as ExpenseController
    participant S as ExpenseService
    participant BP as BudgetPeriodDao
    participant E as ExpenseDao

    UI->>C: POST /expenses または PUT /expenses/{id}
    C->>S: createExpense(command) / updateExpense(id, command)
    S->>BP: findContainingDate(spentOn)
    BP-->>S: BudgetPeriodEntity
    S->>S: 金額・メモ・期間内日付を検証
    S->>E: save(expense)
    E-->>S: ExpenseEntity
    S-->>C: ExpenseResult
    C-->>UI: ExpenseResponse 200/201
```

### 8.3 予算更新

```mermaid
sequenceDiagram
    participant UI as 今月使える金額
    participant C as BudgetController
    participant S as BudgetService
    participant BP as BudgetPeriodDao

    UI->>C: PUT /api/v1/budgets/current
    C->>S: updateCurrentBudget(asOf, amount)
    S->>BP: findContainingDate(asOf)
    BP-->>S: BudgetPeriodEntity
    S->>BP: save(updatedPeriod)
    BP-->>S: BudgetPeriodEntity
    S-->>C: BudgetResult
    C-->>UI: BudgetResponse 200
```

### 8.4 設定更新

```mermaid
sequenceDiagram
    participant UI as 設定
    participant C as SettingsController
    participant S as SettingsService
    participant A as AppSettingsDao
    participant R as BudgetCycleRuleDao
    participant H as HolidayCoverageDao / HolidayDao

    UI->>C: PUT /api/v1/settings
    C->>S: updateSettings(command)
    S->>A: save(appSettings)
    S->>R: findEffectiveAt(asOf)
    S->>H: 対象年coverage・祝日取得
    S->>S: 次期間と適用開始日を計算
    S->>R: 現ルール終了・新ルールsave
    S-->>C: SettingsResult
    C-->>UI: SettingsResponse 200
```

### 8.5 カレンダー表示

```mermaid
sequenceDiagram
    participant UI as カレンダー
    participant C as CalendarController
    participant S as CalendarService
    participant BP as BudgetPeriodDao
    participant E as ExpenseDao

    UI->>C: GET /api/v1/calendar?month=2026-09
    C->>S: getMonthlyCalendar(month)
    S->>BP: findByLabelMonth(2026-09-01)
    BP-->>S: BudgetPeriodEntity
    S->>E: sumAmountByDateRange(startDate, endDate)
    E-->>S: List of DailyExpenseTotalProjection
    S-->>C: CalendarMonthResult
    C-->>UI: CalendarMonthResponse 200
```

### 8.6 グラフ表示

```mermaid
sequenceDiagram
    participant UI as グラフ
    participant C as GraphController
    participant S as GraphService
    participant BP as BudgetPeriodDao

    UI->>C: GET /api/v1/graphs/yearly?year=2026
    C->>S: getYearlySummary(2026)
    S->>BP: findSummariesByLabelMonthBetween(2026-01-01, 2026-12-01)
    BP-->>S: List of BudgetPeriodSummaryProjection
    S->>S: 未作成月を補完し月順に整列
    S-->>C: YearlyBudgetSummaryResult
    C-->>UI: YearlyBudgetSummaryResponse 200
```

## 9. テーブル対応

| テーブル／ビュー | 主な保持内容 | 更新する機能 | 参照する機能 |
| --- | --- | --- | --- |
| `app_settings` | 月初通知、タイムゾーン | FN-08 | FN-07 |
| `budget_cycle_rules` | 月度の開始日、土日祝調整、適用履歴 | FN-08 | FN-04、FN-07、FN-08 |
| `budget_periods` | 月度の開始日、予定終了日、実際の終了日、予算額 | FN-09。期間生成時はFN-08に関連 | FN-01〜FN-04、FN-06、FN-07、FN-09 |
| `expenses` | 利用日、金額、任意メモ | FN-02、FN-03 | FN-01、FN-04〜FN-06 |
| `holiday_calendar_coverage` | 年単位の祝日データ完全性 | 祝日取込処理（本書の画面外） | FN-08、期間生成処理 |
| `holidays` | 日本の祝日の日付、名称、出典 | 祝日取込処理（本書の画面外） | FN-08、期間生成処理 |
| `budget_period_summary` | 予算額、支出合計、残額、件数 | ビューのため直接更新しない | FN-01、FN-06 |

## 10. 入力検証・トランザクション・エラー

### 10.1 入力検証

- 金額は日本円の整数で、`1`〜`999,999,999` とします。
- メモは任意で120文字以内、空文字はServiceでNULLへ正規化します。
- 支出日は所属する予算期間の開始日以上、実際の終了日以下とします。
- 月度の開始日は1〜31とし、存在しない日付は月末へ丸めます。土日祝調整ONでは開始日を直前の平日へ調整し、終了日は次月度の調整済み開始日の前日として月度を連続させます。
- 土日祝調整がONの場合、予定終了日の対象年の `holiday_calendar_coverage` がなければ期間を生成しません。
- 新しい予算期間・ルールの有効期間が既存データと重複する場合は拒否します。
- 予算超過による負の残額は正常値として許可します。

### 10.2 トランザクション境界

- `ExpenseService.createExpense` と `updateExpense` は、期間確認と支出保存を同一トランザクションで行います。
- `SettingsService.updateSettings` は、設定更新、現ルール終了、新ルール作成を同一トランザクションで行います。
- `BudgetService.updateCurrentBudget` は、進行中期間の取得と予算更新を同一トランザクションで行います。
- 取得系Serviceは `readOnly = true` とします。

### 10.3 HTTPエラー

| HTTP | 用途 | 例 |
| --- | --- | --- |
| `400 Bad Request` | 形式・Bean Validation不正 | 金額0、メモ121文字、存在しない日付、開始日29 |
| `404 Not Found` | 対象データが存在しない | 支出ID不明、対象日に予算期間がない |
| `409 Conflict` | 既存状態との競合 | 予算期間またはルールの有効期間が重複 |
| `422 Unprocessable Entity` | 形式は正しいが業務条件を満たさない | 支出日が期間外、祝日カバレッジ不足、調整後の終了日が開始日前 |
| `500 Internal Server Error` | 想定外の処理失敗 | DB接続障害など |

エラーレスポンスは `ErrorResponse { code, message, fieldErrors, timestamp }` に統一します。ユーザー向けメッセージは責める表現を避け、画面で再入力できる内容にします。

## 11. SQLite実装方針

今回の開発で使用するDBはSQLiteのみです。Spring BootのDAOはSQLiteに接続し、画面はすべてSpring Boot REST APIを経由します。

| 項目 | 方針 |
| --- | --- |
| JDBC | SQLite JDBCドライバーを使用する |
| ORM | Spring Data JPA。SQLite対応Dialectを明示設定する |
| スキーマ変更 | FlywayのSQLite対応モジュールと、SQLite用バージョン付きSQLを使用する |
| 外部キー | 接続開始時に `PRAGMA foreign_keys = ON` を有効にする |
| UUID | Javaアプリケーション側で生成し、SQLiteの`TEXT`列へ保存する |
| 日付・日時 | 日付は`YYYY-MM-DD`、日時はUTC ISO 8601文字列としてSQLiteへ保存する |
| 金額 | SQLiteの64bit `INTEGER`。日本円の正の整数として扱う |
| マイグレーション管理 | `PRAGMA user_version` とFlywayの履歴を同期して管理する |

PostgreSQL接続、クラウド同期、端末SQLiteとの同期は今回の対象外です。将来それらを追加する場合も、Controller・Serviceの公開DTOと業務ルールは維持し、DAO実装と接続設定を追加または切り替えます。

## 12. 対象外

次の機能は現行画面とMVPに存在しないため、本書の実装対象には含めません。

- 支出削除
- カテゴリ分類
- アカウント、認証、複数利用者
- クラウド同期の競合解決
- プレミアム課金
- レシート・購入品写真による自動入力
- 月次レポート詳細画面
