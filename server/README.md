# ABANCOOL Command Center API

Traditional **Node.js + Express + MySQL** backend. Designed for **cPanel Node.js App** and any standard VPS.

## Stack
- Node 18+
- Express 4
- MySQL 8 (works with MariaDB / cPanel MySQL)
- JWT auth · bcrypt · helmet · CORS · rate limiting · Zod validation

## Quick start (local)

```bash
cd server
cp .env.example .env       # fill in DB credentials + JWT_SECRET
npm install
npm run migrate            # creates tables
npm run dev                # nodemon on :4000
```

Health check: `GET http://localhost:4000/api/health`

## API endpoints (v1)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET    | /api/health           | —    | Liveness probe |
| POST   | /api/auth/signup      | —    | Create admin |
| POST   | /api/auth/login       | —    | Returns `{ user, token }` |
| GET    | /api/auth/me          | JWT  | Current user |
| GET    | /api/analytics/summary| JWT  | Dashboard counters |
| GET    | /api/clients          | JWT  | List clients |
| POST   | /api/clients          | JWT  | Create client |
| GET    | /api/clients/:id      | JWT  | Get client |
| PUT    | /api/clients/:id      | JWT  | Update |
| DELETE | /api/clients/:id      | JWT  | Delete |

Send `Authorization: Bearer <token>` on protected routes.

## Deploying to cPanel Node.js App

1. **Create MySQL DB** in cPanel → MySQL Databases.
   Note the prefixed names (e.g. `cpaneluser_abancool`).
2. **Upload `server/`** via File Manager / Git Version Control.
3. **cPanel → Setup Node.js App**:
   - Application root: `server`
   - Application URL: `api.yourdomain.com` (subdomain recommended)
   - Application startup file: `src/index.js`
   - Node version: 18 or 20
4. Click **Run NPM Install**.
5. Add environment variables in the cPanel UI (matches `.env.example`):
   `PORT` (cPanel sets it), `DB_HOST=localhost`, `DB_USER`, `DB_PASSWORD`,
   `DB_NAME`, `JWT_SECRET`, `CORS_ORIGINS=https://your-frontend.lovable.app`.
6. Open the terminal in the app's virtualenv and run:
   ```bash
   node src/scripts/migrate.js
   ```
7. **Restart app** in cPanel.

cPanel proxies the app via Passenger. No nginx config required.

## Deploying to a VPS

```bash
git clone <repo> && cd server
npm ci --omit=dev
cp .env.example .env  # edit
npm run migrate
npm install -g pm2
pm2 start src/index.js --name abancool-api
pm2 save && pm2 startup
```

Front a reverse proxy (nginx/Caddy) with TLS in front of port 4000.

## Connecting the frontend

In the Lovable project root create `.env`:
```
VITE_API_URL=https://api.yourdomain.com/api
```
Then the React app uses `fetch(${import.meta.env.VITE_API_URL}/auth/login, …)`.

## File structure

```
server/
├── src/
│   ├── config/        # env + db pool
│   ├── controllers/   # request handlers
│   ├── middleware/    # auth, error
│   ├── routes.js      # REST routes
│   ├── scripts/       # migrate, seed
│   └── index.js       # express bootstrap
├── .env.example
├── package.json
└── README.md
```

Extend by adding a controller in `controllers/`, mounting it in `routes.js`, and adding a table in `scripts/migrate.js`.
