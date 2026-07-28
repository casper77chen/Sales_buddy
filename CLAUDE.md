# Sales Buddy - dentall 業務神隊友

## Build & Run
```bash
npm install    # 安裝依賴
npm run dev    # 開發模式（auto-reload）
npm start      # 正式啟動
```

## Tech Stack
- Express.js + EJS + MongoDB (Mongoose)
- Passport.js (local strategy) + bcryptjs
- Bootstrap 5 + Vanilla JS

## Environment Variables (.env)
```
MONGODB_URI=
SESSION_SECRET=
ADMIN_EMAIL=cccasper77@gmail.com
BASE_URL=
ZSEND_API_KEY=
ZSEND_FROM=noreply@casper77chen.com
GOOGLE_MAPS_API_KEY=
FINANCE_EMAIL=
COMPANY_ADDRESS=
PORT=3000
```

## User Roles
- **admin**: Full access, user management
- **manager**: Dashboard, approve mileage claims, view all reps
- **sales**: Weekly calendar, visit logs, mileage claims

## Zeabur Deployment
- Project ID: 6a07db626edbb9ee6c70b997
- Service ID: 6a07db7bd64413c4c61e5869
- Environment ID: 6a07db62e5ed304c1d8511ca
- Server: MedTech (Linode Tokyo)
- Dashboard: https://zeabur.com/projects/6a07db626edbb9ee6c70b997

## Project Structure
```
config/     - DB, Passport, Mailer, Maps API configs
middleware/ - Auth middleware (ensureAuth, ensureAdmin, ensureManager)
models/     - User, Client, Visit, MileageClaim
routes/     - auth, dashboard, visits, clients, mileage, manager, admin, api
views/      - EJS templates (layouts, partials, feature pages)
public/     - CSS, JS, uploads
```

## 戰情室整合（2026-07-28）
- 新增唯讀匯出 API（app.js 底部）：GET /api/export/clients、GET /api/export/visits?since=ISO，認證 `Authorization: Bearer $EXPORT_API_KEY`
- 供「台灣牙科戰情室」（dentcrm-tw.zeabur.app）每日同步拉取；改 Client/Visit schema 時注意這兩支的欄位映射
- 本日已把 git trigger 綁回（push main 自動部署，GraphQL updateGitTrigger）
