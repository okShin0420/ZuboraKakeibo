# ズボラ会計簿アプリ 画面遷移図

```mermaid
flowchart TD
    settingMoney[今月使える金額設定]
    home[ホーム]
    numberInput[金額入力]（モーダル）
    （**追加機能**
    photoInput[写真入力]（モーダル）
    ）
    calendar[カレンダー]
    dailyDetail[日別明細]
    graph[グラフ]
    monthlyReport[月次レポート]
    monthlySetting[月次設定]
    ##
    *月初めになって初めてアプリを開いた場合 or 今月使える金額を編集する場合*
    settingMoney[今月使える金額設定]
    ##
    home -->|記録する| numberInput（モーダル）
    （**追加機能**
    home -->|写真で記録する| photoInput（モーダル）
    ）
    numberInput -->|保存| home
    photoInput -->|保存| home

    home -->|カレンダータブ| calendar
    calendar -->|日付をタップ| dailyDetail

    home -->|グラフタブ| graph
    graph -->|月を選択| monthlyReport

    home -->|設定| monthlySetting
    monthlySetting -->|月初通知を切り替える| monthlySetting
    monthlySetting -->|月度の開始日を設定する| monthlySetting
    monthlySetting -->|終了日の土日祝自動調整を切り替える| monthlySetting
    monthlySetting -->|各月の使える金額の編集| monthlySetting
```

## 画面一覧

| 画面 | 説明 |
| --- | --- |
| ホーム | 残り予算や今日の支出を確認し、各機能へ移動する起点画面。 |
| 金額入力 | 金額を入力して支出を記録する画面。 |
| 写真入力 | レシートや購入品の写真から支出を記録する将来拡張用の画面。 |
| カレンダー | 日ごとの支出合計を確認する画面。 |
| 日別明細 | 選択した日に記録した支出を確認する画面。 |
| グラフ | 月ごとの支出状況を確認する画面。 |
| 月次レポート | 選択した月のやりくりを振り返る画面。 |
| 月次設定 | 予算・通知・月度の開始日・土日祝による終了日の自動調整を設定する画面。 |
