# 彰濱秀傳癌症醫院專案追蹤系統 V1.4.0

癌症醫院會議任務追蹤系統，將每次會議決議轉化為可追蹤任務，管理各單位與個人負荷，支援逾期 Email 提醒與 PDF 週報產出。

**部署平台：** Railway（單一 Service）

---

## 技術棧

- Frontend: React 18 + Vite
- Backend: FastAPI（Python 3.11）
- Database: PostgreSQL
- Email: SendGrid
- PDF: ReportLab（STSong-Light 中文字體）
- 部署: Railway

---

## 版本歷程

### V1.4.0（2026-04-14）
- 新增：儀表板顯示今天日期
- 新增：一鍵下載週報 PDF（含逾期、卡關、即將到期、各單位統計）
- 新增：截止提醒升級為 7/3/1/0 天，逾期後每週一固定催通知
- 新增：手動觸發通知 API `/api/notify/run`

### V1.3.1（2026-04-14）
- 修正：Demo 會議名稱改為「癌症醫院會議」
- 更新：Demo 資料對應真實會議通知內容（人員、任務、議題）
- 修正：單位負荷圓形 SVG 被截為半圓

### V1.3.0（2026-04-14）
- 新增：癌症防治中心單位
- 修正：會議排程改為兩個月一次

### V1.2.6（2026-04-14）
- 新增：首次啟動自動預載 Demo 資料

### V1.2.5（2026-04-14）
- 修正：monthly 端點 NULL updated_at 導致所有資料顯示為 0

### V1.2.4（2026-04-14）
- 修正：載入 Demo 後頁面自動刷新

### V1.2.3（2026-04-14）
- 修正：logo.jpg 被 catch-all 路由攔截無法顯示

### V1.2.2（2026-04-14）
- 新增：使用真實 SELA gecko logo（JPG）

### V1.2.1（2026-04-14）
- 修正：Demo 資料 IndexError + 版本號未同步

### V1.2.0（2026-04-14）
- 新增：SELA logo、設定按鈕、Demo 載入/清除

### V1.1.0（2026-04-14）
- 改版：奶茶色系 UI、系統更名為彰濱秀傳癌症醫院專案追蹤系統

### V1.0.0（2026-04-14）
- 初始版本

---

## Railway 部署步驟

1. GitHub 建新 repo，push 此資料夾
2. Railway → New Project → Deploy from GitHub
3. 加 **PostgreSQL** plugin（DATABASE_URL 自動注入）
4. 選填 Variables：`SENDGRID_API_KEY`、`ALERT_FROM_EMAIL`
5. Deploy

---

## 本地開發

```bash
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload

cd frontend && npm install && npm run dev
```

---

## 發版 Checklist

1. 更新 `frontend/src/lib/version.js`
2. 更新 `README.md` + `CLAUDE.md` 版本號與歷程
3. `cd frontend && npm run build`
4. `rm -rf static && cp -r frontend/dist static`
5. 打包兩個 zip（deploy / source）
6. push GitHub → Railway 自動部署

---

## 環境變數

| 變數 | 說明 | 必填 |
|------|------|------|
| `DATABASE_URL` | PostgreSQL（Railway 自動注入） | 是 |
| `SENDGRID_API_KEY` | Email 提醒 | 否 |
| `ALERT_FROM_EMAIL` | 寄件人 | 否 |
