# CLAUDE.md — 彰濱秀傳癌症醫院專案追蹤系統 開發者手冊

> 任何新 Claude 讀完這份文件，不需要問任何問題，就能直接接手開發。

---

## 一、專案說明

癌症醫院會議任務追蹤系統。將每次會議決議轉化為可追蹤任務，管理各單位與個人負荷，支援任務相依性、進度回報、逾期 Email 提醒、PDF 週報產出。

- **目前版本：V2.0.0**
- **部署平台：** Railway（單一 Service，FastAPI + React 合一）
- **資料庫：** Railway PostgreSQL plugin

---

## 二、技術棧

| 層級 | 技術 |
|------|------|
| 前端 | React 18 + Vite |
| 後端 | FastAPI（Python 3.11） |
| 資料庫 | PostgreSQL（SQLAlchemy ORM） |
| Email | SendGrid |
| PDF | ReportLab + STSong-Light CID 字體 |
| 排程 | APScheduler（每日 08:00 臺北時區） |
| 部署 | Railway，Procfile 控制啟動 |

---

## 三、目錄結構

```
cancer-dashboard/
├── main.py           ← 所有 API 路由 + Demo 資料 + PDF 產生
├── models.py         ← Meeting / Unit / Member / Task / Comment
├── database.py       ← PostgreSQL 連線
├── scheduler.py      ← 每日逾期 Email 提醒
├── requirements.txt  ← 含 reportlab, python-multipart
├── nixpacks.toml     ← Railway build 設定
├── Procfile          ← 啟動 uvicorn
├── static/           ← npm run build 產生，進 git
└── frontend/
    ├── src/
    │   ├── App.jsx          ← 主框架 + 深色模式 + 設定 modal
    │   ├── api.js           ← 所有 API 呼叫
    │   ├── theme.js         ← 奶茶色系 + 深色模式切換（reload 方式）
    │   ├── lib/version.js   ← 版本號（每次發版必改）
    │   └── components/
    │       ├── Dashboard.jsx ← 日期、週報按鈕、環形圖、趨勢、負荷
    │       ├── Tasks.jsx     ← 任務列表 + 留言串 + 相依性 + 院別篩選
    │       ├── Members.jsx   ← 單位展開卡（含人員、院別）
    │       ├── Calendar.jsx  ← 月曆 + 會議管理 Tab
    │       ├── Stats.jsx     ← 三維度統計 + 時間/院別篩選
    │       └── UI.jsx        ← 共用元件
```

---

## 四、已知的坑（必讀）

### 1. SessionLocal 必須明確 import
```python
from database import engine, get_db, Base, SessionLocal
```

### 2. static/ 必須進 git
Railway runtime 沒有 npm，static/ 被 gitignore 就找不到前端。

### 3. logo.jpg 需要獨立路由
在 catch-all `/{full_path:path}` 之前加 `@app.get("/logo.jpg")`。

### 4. monthly 端點用 created_at 不用 updated_at
`updated_at` 是 onupdate 欄位，新建任務為 NULL，`int(None)` 拋錯。

### 5. Demo 資料 index 必須在 list 長度內
`DEMO_TASKS` 的 meeting/unit/owner 是 list index，超出範圍就 IndexError。

### 6. Railway URL 格式
Database URL `postgres://` 開頭，database.py 自動換為 `postgresql://`。

### 7. python-multipart 必須在 requirements.txt
File upload 端點 (`/api/backup/import`) 在路由註冊時就需要，缺少會導致整個 app 啟動失敗。

### 8. 新增欄位必須在 lifespan migration 加 ALTER TABLE
SQLAlchemy `create_all` 不修改現有表，新欄位必須手動 ALTER。**注意：tasks 欄位和 units 欄位要分開兩個 loop，不要混在一起。**

### 9. 深色模式用 reload 實現
`theme.js` 的 C 變數在元件 import 時已固定，切換主題直接 `window.location.reload()`，不用 React Context。

### 10. PDF story = [] 縮排
`story = []` 必須在所有 helper function 之外，縮排錯誤（多8格）會讓它跑進 `unit_bar_drawing()` 的 return 之後，永遠不執行，導致 `UnboundLocalError`。

---

## 五、資料模型

### Task 欄位
| 欄位 | 說明 |
|------|------|
| title / description | 任務名稱 / 說明 |
| meeting_id / unit_id / owner_id / assistant_id | FK |
| due_date / priority / status | 截止/優先/狀態 |
| blocked_reason | 卡關原因 |
| manpower_needed / manpower_current | 人力需求/現況 |
| progress_pct / progress_note | 進度百分比 / 說明（0-100） |
| depends_on_id | 前置任務 FK（self-ref） |

### Agenda 欄位
| 欄位 | 說明 |
|------|------|
| meeting_id / title / order_no / note | 基本 |

### Unit 欄位
| 欄位 | 說明 |
|------|------|
| name / headcount / available / note | 基本 |
| campus | 彰秀 / 彰濱 / 兩院 |

---

## 六、API 路由

| Method | 路徑 | 說明 |
|--------|------|------|
| GET | /api/dashboard/stats | 總覽統計 |
| GET | /api/dashboard/monthly | 每月完成數 |
| GET | /api/dashboard/unit-loads | 各單位負荷（含 campus） |
| GET | /api/report/weekly | 週報 PDF |
| POST | /api/notify/run | 手動觸發 Email 提醒 |
| GET/POST | /api/meetings | 會議列表/新增 |
| GET | /api/meetings/{id}/detail | 會議詳情（議程+任務+統計） |
| GET/POST | /api/agendas | 議程列表/新增 |
| PATCH/DELETE | /api/agendas/{id} | 編輯/刪除議程 |
| PATCH | /api/tasks/batch | 批次修改任務（status/priority/owner/due_date） |
| PATCH/DELETE | /api/meetings/{id} | 編輯/刪除會議 |
| GET/POST | /api/units | 單位列表/新增 |
| PATCH | /api/units/{id} | 更新單位（含 campus） |
| GET/POST | /api/members | 人員列表/新增 |
| PATCH/DELETE | /api/members/{id} | 人員操作 |
| GET/POST | /api/tasks | 任務列表/新增 |
| PATCH/DELETE | /api/tasks/{id} | 任務操作（含 progress/depends_on） |
| GET/POST | /api/tasks/{id}/comments | 留言 |
| GET | /api/backup/export | 匯出備份 JSON |
| POST | /api/backup/import | 匯入備份（需 python-multipart） |
| POST | /api/demo/load | 載入 Demo 資料 |
| DELETE | /api/demo/clear | 清除所有資料 |

---

## 七、環境變數

| 變數 | 說明 | 必填 |
|------|------|------|
| `DATABASE_URL` | Railway 自動注入 | 是 |
| `SENDGRID_API_KEY` | Email 提醒 | 否 |
| `ALERT_FROM_EMAIL` | 寄件人 | 否 |
| `NOTIFY_TO_EMAIL` | 進度回報通知收件人（預設杜祐儀） | 否 |

---

## 八、發版 Checklist

1. 更新 `frontend/src/lib/version.js`
2. 更新 `README.md` + `CLAUDE.md` 版本號
3. `cd frontend && npm run build`
4. `rm -rf static && cp -r frontend/dist static`
5. 打包 zip（deploy / source）
6. push GitHub → Railway 自動部署

---

## 九、版本歷程

| 版本 | 關鍵變更 |
|------|---------|
| V2.0.0 | 議程管理、歷次會議決議查詢、任務批次操作、備份含 Agenda |
| V1.9.2 | 深色模式修正、院別補完（Members/Stats）、CLAUDE.md 更新 |
| V1.9.1 | PDF story 縮排 bug、depends_on migration 簡化 |
| V1.9.0 | 任務相依性（depends_on）、深色模式、院別篩選擴充 |
| V1.8.0 | 院別篩選（任務頁）、PDF 進度欄、深色模式按鈕 |
| V1.7.0 | 留言串 UI、協助人欄位、會議管理介面、手動通知按鈕 |
| V1.6.3 | 卡片全圓角修正（absolute stripe 代替 borderLeft） |
| V1.6.2 | 進度回報欄位（progress_pct/note）、負荷計算改人力需求比 |
| V1.6.1 | 資料備份匯出/匯入、python-multipart 修復 |
| V1.6.0 | 14個單位、測試人員 A-O、統計時間區間篩選 |
| V1.5.x | 統計頁三維度、PDF 圖形報表、行事曆手機版 |
| V1.4.x | 週報 PDF、今天日期、通知升級 |
| V1.3.x | 癌症防治中心、真實會議資料、圓形 SVG 修正 |
| V1.2.x | SELA logo、設定 modal、Demo 載入、monthly NULL fix |
| V1.0.0 | 初始版本 |

---

## 十、如果你是新的 Claude

| 需求 | 改的檔案 |
|------|---------|
| 新增任務欄位 | `models.py` + `main.py`（lifespan migration + schema + task_dict）+ `Tasks.jsx` |
| 改儀表板 | `Dashboard.jsx` |
| 改 PDF 格式 | `main.py` → `weekly_report()` |
| 改 Email 通知 | `scheduler.py` |
| 改顏色 | `theme.js` |
| 改 Demo 資料 | `main.py` → `DEMO_*` + `_seed_demo()` |
| 新增 API | `main.py` |
