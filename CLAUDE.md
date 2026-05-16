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

## Project Structure
```
config/     - DB, Passport, Mailer, Maps API configs
middleware/ - Auth middleware (ensureAuth, ensureAdmin, ensureManager)
models/     - User, Client, Visit, MileageClaim
routes/     - auth, dashboard, visits, clients, mileage, manager, admin, api
views/      - EJS templates (layouts, partials, feature pages)
public/     - CSS, JS, uploads
```
