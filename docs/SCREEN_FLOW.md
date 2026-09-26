# ズボラ会計簿アプリ 画面遷移図

```mermaid
flowchart TD
    home[ホーム]
    numberInput[支出入力ボトムシート]
    calendar[カレンダー]
    dailyDetail[日別明細]
    graph[グラフ]
    monthlyReport[月次レポート]
    settings[設定]
    settingMoney[今月使える金額設定]

    home -->|入力する| numberInput
    numberInput -->|保存・閉じる| home

    home -->|カレンダータブ| calendar
    calendar -->|日付を選択| dailyDetail
    dailyDetail -->|明細を選択| numberInput

    home -->|グラフタブ| graph
    graph -->|月を選択| monthlyReport

    home -->|設定アイコンでボトムシートを開く| settings
    settings -->|今月使える金額| settingMoney
    settingMoney -->|保存・閉じる| settings
    settings -->|閉じる・背景タップ| home
    settings -->|通知・期間を変更| settings
```

## 画面一覧

| 画面 | 説明 |
| --- | --- |
| ホーム | 残り予算、今日の支出、残り日数を確認し、各機能へ移動する起点画面。 |
| 支出入力ボトムシート | 専用キーパッドで金額と任意メモを入力し、支出を記録・編集する画面。 |
| カレンダー | 日ごとの支出合計を確認する画面。 |
| 日別明細 | 選択した日に記録した支出を確認する画面。 |
| グラフ | 月ごとのやりくり状況を確認する画面。 |
| 月次レポート | 選択した月のやりくりを振り返る将来画面。 |
| 設定 | 今月使える金額、通知、月初めの日、締め日、休日調整を設定する画面。 |
| 今月使える金額設定 | 今月自由に使える金額を入力し、ホームの残り予算へ反映する画面。 |
