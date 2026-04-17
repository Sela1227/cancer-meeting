# 彰濱秀傳癌症醫院專案追蹤系統 V1.9.1

癌症醫院會議任務追蹤系統，將每次會議決議轉化為可追蹤任務，支援任務相依性、進度回報、逾期 Email 提醒、PDF 週報圖表產出。

**部署：** Railway · **後端：** FastAPI · **前端：** React 18 + Vite · **DB：** PostgreSQL

---

## 功能總覽

- 任務管理（優先級、狀態、截止日、前置任務、進度回報）
- 院別篩選（彰秀 / 彰濱 / 兩院共用）
- 任務留言串
- 深色 / 淺色模式
- 儀表板即時統計 + 深度統計（會議效能 / 個人貢獻 / 單位效率）
- 月曆視圖 + 會議管理
- PDF 週報（含圓餅圖、橫條圖、進度欄）
- Email 逾期提醒（7/3/1/0天、逾期每週一）
- 資料備份匯出 / 匯入
- 首次啟動自動預載 Demo 資料

---

## Railway 部署

1. GitHub 建 repo → Railway New Project → Deploy from GitHub
2. 加 **PostgreSQL** plugin
3. 選填環境變數：`SENDGRID_API_KEY`、`ALERT_FROM_EMAIL`、`NOTIFY_TO_EMAIL`

## 本地開發

```bash
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
cd frontend && npm install && npm run dev
```

---

## 版本歷程

| 版本 | 說明 |
|------|------|
| V1.9.1 | PDF story bug 修正、migration 修正 |
| V1.9.0 | 任務相依性、深色模式、院別擴充 |
| V1.8.0 | 院別篩選、PDF 進度欄 |
| V1.7.0 | 留言串、協助人、會議管理、手動通知 |
| V1.6.x | 資料備份、進度回報、卡片圓角修正 |
| V1.5.x | 統計頁、PDF 圖形、行事曆手機版 |
| V1.4.x | 週報 PDF、今天日期 |
| V1.0.0 | 初始版本 |
