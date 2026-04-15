# CLAUDE.md — 彰濱秀傳癌症醫院專案追蹤系統 開發者手冊

> 任何新 Claude 讀完這份文件，不需要問任何問題，就能直接接手開發。

---

## 一、專案一句話說明

癌症醫院會議任務追蹤系統。將每次會議決議轉化為可追蹤任務，管理各單位與個人負荷，支援逾期 Email 提醒與 PDF 週報產出。

- 目前版本：V1.4.0
- 部署平台：Railway（單一 Service，FastAPI + React 合一）
- 資料庫：Railway PostgreSQL plugin

---

## 二、技術棧

| 層級 | 技術 |
|------|------|
| 前端 | React 18 + Vite |
| 後端 | FastAPI（Python 3.11） |
| 資料庫 | PostgreSQL（SQLAlchemy ORM） |
| Email | SendGrid |
| PDF | ReportLab + STSong-Light 中文 CID 字體 |
| 排程 | APScheduler（每日 08:00 臺北時區） |
| 部署 | Railway，Procfile 控制啟動 |

---

## 三、目錄結構

```
cancer-dashboard/
├── main.py           ← 所有 API 路由（單一檔案）+ Demo 資料 + PDF 產生
├── models.py         ← Meeting / Unit / Member / Task / Comment
├── database.py       ← PostgreSQL 連線（自動修正 Railway URL 格式）
├── scheduler.py      ← 每日逾期 Email 提醒（7/3/1/0天，逾期每週一）
├── requirements.txt  ← 含 reportlab
├── nixpacks.toml     ← Railway build 設定
├── Procfile          ← 直接啟動 uvicorn（不跑 build.sh）
├── static/           ← npm run build 產生，進 git，Railway 直接 serve
└── frontend/
    ├── public/logo.jpg      ← SELA 真實 logo
    ├── src/
    │   ├── App.jsx          ← 主框架 + SELA logo + 設定 modal
    │   ├── api.js           ← 所有 API 呼叫
    │   ├── theme.js         ← 奶茶色系色票
    │   ├── lib/version.js   ← 版本號（每次發版必改）
    │   └── components/
    │       ├── Dashboard.jsx ← 日期、週報按鈕、環形圖、趨勢、負荷
    │       ├── Tasks.jsx     ← 任務列表 + Modal
    │       ├── Members.jsx   ← 單位卡片 + 個人卡片
    │       ├── Calendar.jsx  ← 月曆視圖
    │       └── UI.jsx        ← 共用元件
    └── package.json
```

---

## 四、核心邏輯說明

### 自動預載 Demo
啟動時若 Task 和 Unit 都是空的，自動呼叫 `_seed_demo(db)` 寫入示範資料。

### PDF 週報
`GET /api/report/weekly` 用 ReportLab 的 `STSong-Light` CID 字體產生中文 PDF，回傳 StreamingResponse。

### 逾期判斷
```python
def is_overdue(task):
    return task.due_date and task.due_date < date.today() and task.status != StatusEnum.done
```

### 月份趨勢用 created_at 不用 updated_at
`updated_at` 是 onupdate 欄位，新建任務為 NULL，會導致 int(None) 崩潰。

---

## 五、已知的坑（必讀）

### 1. SessionLocal 必須明確 import
**問題**：`lifespan` 在 import 之前定義，用到 `SessionLocal` 但忘記 import 就會 NameError。
**正確做法**：`from database import engine, get_db, Base, SessionLocal`

### 2. static/ 必須進 git
**問題**：Railway runtime 沒有 npm，若 static/ 被 gitignore 就找不到前端。
**正確做法**：`.gitignore` 排除 `frontend/dist/` 但不排除 `static/`。

### 3. logo.jpg 需要獨立路由
**問題**：FastAPI 的 `/{full_path:path}` 會攔截 `/logo.jpg` 回傳 index.html。
**正確做法**：在 catch-all 之前加 `@app.get("/logo.jpg")` 路由。

### 4. monthly 端點用 created_at
**問題**：`updated_at` 是 onupdate，新建任務為 NULL，`int(None)` 拋錯導致整個 Promise.all 失敗，儀表板全部顯示 0。
**正確做法**：用 `Task.created_at` 做月份統計。

### 5. Demo 資料 index 必須對應 list 長度
**問題**：`DEMO_TASKS` 裡 `"meeting": N` 是 meetings list 的 index，超出範圍就 IndexError。
**正確做法**：meetings 有 N 筆，index 只能用 0 到 N-1。

### 6. Railway URL 格式
**問題**：Railway 給的 DATABASE_URL 是 `postgres://` 開頭，SQLAlchemy 需要 `postgresql://`。
**正確做法**：database.py 自動替換，已處理。

---

## 六、API 路由一覽

| Method | 路徑 | 說明 |
|--------|------|------|
| GET | /api/dashboard/stats | 總覽統計 |
| GET | /api/dashboard/monthly | 每月完成數（用 created_at） |
| GET | /api/dashboard/unit-loads | 各單位負荷 |
| GET | /api/report/weekly | 下載週報 PDF |
| POST | /api/notify/run | 手動觸發 Email 提醒 |
| GET/POST | /api/meetings | 會議列表/新增 |
| GET/POST | /api/units | 單位列表/新增 |
| PATCH | /api/units/{id} | 更新單位 |
| GET/POST | /api/members | 人員列表/新增 |
| PATCH/DELETE | /api/members/{id} | 更新/刪除人員 |
| GET/POST | /api/tasks | 任務列表/新增 |
| PATCH/DELETE | /api/tasks/{id} | 任務操作 |
| GET/POST | /api/tasks/{id}/comments | 留言 |
| POST | /api/demo/load | 載入 Demo 資料 |
| DELETE | /api/demo/clear | 清除所有資料 |

---

## 七、發版 Checklist

1. 更新 `frontend/src/lib/version.js`
2. 更新 `README.md` + `CLAUDE.md` 版本號與歷程
3. `cd frontend && npm run build`
4. `rm -rf static && cp -r frontend/dist static`
5. 打包：`zip -r cancer-meeting_VX.X.X.zip cancer-dashboard/ --exclude "*/node_modules/*" --exclude "*/.git/*" --exclude "*/frontend/dist/*" --exclude "*/.env"`
6. source zip：同上再加 `--exclude "*/static/*"`

---

## 八、環境變數

| 變數 | 說明 | 必填 |
|------|------|------|
| `DATABASE_URL` | PostgreSQL（Railway 自動注入） | 是 |
| `SENDGRID_API_KEY` | Email 提醒 | 否 |
| `ALERT_FROM_EMAIL` | 寄件人 | 否 |

---

## 九、版本歷程

| 版本 | 日期 | 關鍵變更 |
|------|------|---------|
| V1.4.0 | 2026-04-14 | 週報 PDF、今天日期、通知升級、手動觸發 API |
| V1.3.1 | 2026-04-14 | Demo 資料對應真實會議內容 |
| V1.3.0 | 2026-04-14 | 癌症防治中心、SVG 半圓修正 |
| V1.2.6 | 2026-04-14 | 首次啟動自動預載 Demo |
| V1.2.5 | 2026-04-14 | monthly NULL crash 修正 |
| V1.2.4 | 2026-04-14 | Demo 載入後自動 reload |
| V1.2.3 | 2026-04-14 | logo.jpg 路由修正 |
| V1.2.2 | 2026-04-14 | 真實 SELA logo |
| V1.2.0 | 2026-04-14 | SELA logo、設定 modal、Demo |
| V1.1.0 | 2026-04-14 | 奶茶色系 UI |
| V1.0.0 | 2026-04-14 | 初始版本 |

---

## 十、如果你是新的 Claude

常見需求對應的檔案：

| 需求 | 主要改的檔案 |
|------|------------|
| 新增任務欄位 | `models.py` + `main.py`（TaskIn/TaskPatch + task_dict）+ `Tasks.jsx` |
| 改儀表板圖表 | `Dashboard.jsx` |
| 改 PDF 週報格式 | `main.py` → `weekly_report()` 函式 |
| 新增 API 端點 | `main.py` |
| 改 Email 內容/時機 | `scheduler.py` |
| 改顏色字型 | `frontend/src/theme.js` |
| 改 Demo 資料 | `main.py` → `DEMO_*` 常數 |
| 接 Google 登入 | `main.py`（OAuth）+ `App.jsx`（登入頁） |
