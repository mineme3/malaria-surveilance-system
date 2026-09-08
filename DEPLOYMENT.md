# Deployment Documentation — Malaria Surveillance System

> **Version:** 1.0.0
> **Last Updated:** 2026-09-08

---

## 1. Deployment Overview

### What Is Being Deployed

A Progressive Web Application (PWA) for malaria line-list data collection, surveillance, analytics, and reporting. The system is designed for health facilities in Ethiopia's hierarchical administrative structure (Region → Zone → Woreda → Facility).

### Application Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Browser / PWA                     │
│  React 18 + TypeScript + Tailwind CSS + Dexie       │
│  (IndexedDB for offline storage)                     │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP (port 3001)
                       ▼
┌─────────────────────────────────────────────────────┐
│              Express.js Server (Node 20)             │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐    │
│  │ Auth API │ │ Cases API │ │ Facilities API   │    │
│  │ JWT/RBAC │ │ CRUD/Sync │ │ CRUD/Accounts    │    │
│  └──────────┘ └──────────┘ └──────────────────┘    │
│  ┌──────────────┐ ┌───────────────┐                 │
│  │ Reports API  │ │ Notifications │                 │
│  │              │ │ API           │                 │
│  └──────────────┘ └───────────────┘                 │
│                       │                             │
│            Static file serving (dist/)               │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│         SQLite Database (better-sqlite3)             │
│         server/malaria.db                            │
│         WAL mode + Foreign keys enabled              │
└─────────────────────────────────────────────────────┘
```

### Main Components

| Component | Technology | Location |
|-----------|-----------|----------|
| Frontend | React 18, TypeScript, Vite 5, Tailwind CSS | `src/` |
| UI Library | shadcn/ui (Radix UI primitives) | `src/components/ui/` |
| State Management | Zustand | `src/store/` |
| Offline Storage | Dexie (IndexedDB) | `src/services/db.ts` |
| PWA | Service Worker + Web App Manifest | `public/sw.js`, `public/manifest.json` |
| Backend API | Express.js 4, Node.js | `server/` |
| Database | SQLite via better-sqlite3 | `server/malaria.db` |
| Authentication | JWT (jsonwebtoken) + bcryptjs | `server/middleware/auth.js` |
| Testing | Vitest | `server/__tests__/` |

### Production Deployment Model

Single-server deployment: Express serves both the API (`/api/*`) and the pre-built React SPA (from `dist/`). The SQLite database file (`server/malaria.db`) persists on the local filesystem.

---

## 2. System Requirements

### Operating System

- Linux (Ubuntu 20.04+, Debian 11+, Alpine 3.18+)
- macOS 12+
- Windows Server 2019+ (WSL2 recommended)

### Runtime

| Dependency | Version | Purpose |
|-----------|---------|---------|
| Node.js | 20.x (Alpine recommended) | JavaScript runtime |
| npm | 9+ (bundled with Node 20) | Package manager |

### Hardware (Minimum)

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 1 vCPU | 2 vCPU |
| RAM | 512 MB | 1 GB |
| Disk | 1 GB | 5 GB (grows with case data) |
| Network | 10 Mbps | 100 Mbps |

### Network

- Port 3001 must be accessible (or mapped via reverse proxy)
- Outbound internet required only for initial `npm ci` install
- No outbound internet required at runtime (self-contained)

---

## 3. Project Architecture

### Directory Structure (Production-Relevant)

```
project/
├── server/
│   ├── index.js              # Express server entry point
│   ├── db.js                 # SQLite database abstraction layer
│   ├── schema.js             # Table creation (auto-runs on startup)
│   ├── seed.js               # Seed data (auto-runs on startup)
│   ├── malaria.db            # SQLite database (created at runtime)
│   ├── middleware/
│   │   └── auth.js           # JWT auth, RBAC, data scope builders
│   └── routes/
│       ├── auth.js           # Login, register, user CRUD
│       ├── cases.js          # Case CRUD, sync, import, stats
│       ├── facilities.js     # Facility CRUD, with-account
│       ├── reports.js        # Report generation, audit logs
│       └── notifications.js  # Notification CRUD
├── dist/                     # Built frontend (created by `npm run build`)
├── src/                      # Frontend source (not needed in production)
├── public/                   # Static assets (copied to dist/ by Vite)
├── package.json              # Dependencies and scripts
├── Dockerfile                # Multi-stage Docker build
├── docker-compose.yml        # Docker Compose config
└── .env                      # Environment variables (not in git)
```

### Data Flow

1. **Online mode:** Browser → Express API → SQLite → JSON response
2. **Offline mode:** Browser → Dexie (IndexedDB) → queued for sync
3. **Sync on reconnect:** Browser `syncPendingCases()` → `POST /api/cases/sync` → conflict resolution (last-write-wins by `client_side_id` + `updated_at`)
4. **Authentication:** Login → JWT token (24h expiry) → stored in localStorage → sent as `Authorization: Bearer <token>` header

---

## 4. Environment Configuration

### Environment Variables

| Variable | Required | Purpose | Example | Secret |
|----------|----------|---------|---------|--------|
| `PORT` | No | Server listen port | `3001` | No |
| `JWT_SECRET` | **Yes** | Signing key for JWT tokens | `<SECRET>` | **Yes** |
| `NODE_ENV` | No | Runtime mode (`production`/`development`) | `production` | No |
| `ALLOWED_ORIGINS` | No | Comma-separated CORS origins | `https://example.com` | No |
| `DATABASE_URL` | No | PostgreSQL connection string (unused — SQLite is active) | `postgresql://...` | **Yes** |

### `.env` File

Create a `.env` file in the project root:

```env
PORT=3001
JWT_SECRET=<GENERATE-A-STRONG-RANDOM-STRING>
NODE_ENV=production
ALLOWED_ORIGINS=https://your-domain.com
```

> **CRITICAL:** The `JWT_SECRET` must be a cryptographically random string of at least 32 characters. The default value in `.env.example` (`your-secret-key-change-this-in-production`) must NOT be used in production.

Generate a secure secret:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Rate Limiting Configuration

Hardcoded in `server/index.js` (not configurable via environment):

| Limiter | Window | Max Requests | Applies To |
|---------|--------|-------------|------------|
| General | 15 min | 200 | All `/api/*` |
| Auth | 15 min | 50 | `/api/auth/login` |
| Registration | 1 hour | 20 | `/api/auth/register` |

---

## 5. Installation & Dependencies

### Option A: Docker (Recommended for Production)

```bash
# Clone the repository
git clone https://github.com/mineme3/malaria-surveilance-system.git
cd malaria-surveilance-system

# Create environment file
cp .env.example .env
# Edit .env with secure JWT_SECRET

# Build and run
docker compose up -d --build
```

### Option B: Manual Installation

```bash
# Clone the repository
git clone https://github.com/mineme3/malaria-surveilance-system.git
cd malaria-surveilance-system

# Install Node.js 20 (if not installed)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install dependencies
npm ci

# Create environment file
cp .env.example .env
# Edit .env with secure JWT_SECRET

# Build frontend
npm run build

# Start production server
npm start
```

### Dependencies

**Production (installed by `npm ci --omit=dev`):**

| Package | Version | Purpose |
|---------|---------|---------|
| express | ^4.19.2 | HTTP server |
| better-sqlite3 | ^13.0.3 | SQLite database driver |
| jsonwebtoken | ^9.0.2 | JWT authentication |
| bcryptjs | ^2.4.3 | Password hashing (pure JS, no native deps) |
| cors | ^2.8.5 | Cross-origin resource sharing |
| express-rate-limit | ^7.5.1 | API rate limiting |
| dotenv | ^16.6.1 | Environment variable loading |
| multer | ^1.4.5-lts.1 | File upload handling |
| react | ^18.3.1 | Frontend UI (bundled into dist/) |
| dexie | ^4.0.4 | IndexedDB wrapper for offline storage |
| xlsx | ^0.18.5 | Excel import/export |
| recharts | ^2.12.7 | Dashboard charts |
| zustand | ^4.5.2 | Frontend state management |

**Dev (not needed in production):**

| Package | Version | Purpose |
|---------|---------|---------|
| vite | ^5.2.11 | Frontend build tool |
| vitest | ^2.1.9 | Test framework |
| typescript | ^5.4.5 | Type checking |
| concurrently | ^8.2.2 | Dev mode parallel execution |
| tailwindcss | ^3.4.3 | CSS framework |

---

## 6. Database Setup

### Database Engine

SQLite via `better-sqlite3` (v13.0.3)

- **File location:** `server/malaria.db`
- **WAL mode:** Enabled (concurrent reads, single writer)
- **Foreign keys:** Enabled
- **Schema management:** Auto-created on server startup (no migration system)

### Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `facilities` | Health facility registry | id, name, region, zone, woreda, facility_type, is_active |
| `users` | User accounts with RBAC | id, username, email, password_hash, role, region, zone, woreda, facility_id |
| `malaria_cases` | Malaria line-list data (30 fields) | id, client_side_id, facility_id, patient_name, sex, age, epi_week, outcome |
| `audit_logs` | All user actions | id, user_id, action, entity_type, details, ip_address |
| `notifications` | User notifications | id, user_id, title, message, type, is_read |

### Schema Initialization

Happens automatically on server startup (`server/schema.js` → `initDatabase()`). Uses `CREATE TABLE IF NOT EXISTS` — safe to run repeatedly.

### Seed Data

Also runs automatically on startup (`server/seed.js` → `seedDatabase()`). Idempotent — checks if data exists before inserting.

**Default seed data:**

| Role | Username | Password | Geographic Scope |
|------|----------|----------|-----------------|
| system_admin | `admin` | `admin123` | All |
| region_admin | `region1` | `admin123` | DD (Dire Dawa) |
| zone_admin | `zone1` | `admin123` | DD / DD |
| district_admin | `district1` | `admin123` | DD / DD / DDHC |
| facility_user | `facility1`–`facility5` | `admin123` | Individual facilities |

> **SECURITY:** Change all default passwords before production use.

### Manual Seed Command

```bash
npm run seed
```

### Backup

The database is a single file. To backup:

```bash
# While server is stopped or using SQLite backup command
cp server/malaria.db server/malaria.db.backup.$(date +%Y%m%d)
```

---

## 7. Application Build

### Frontend Build

```bash
npm run build
```

This runs `vite build` which:

1. Compiles TypeScript to JavaScript
2. Bundles React components
3. Processes Tailwind CSS
4. Outputs to `dist/` directory
5. Copies `public/` assets to `dist/`

**Output structure:**

```
dist/
├── index.html
├── assets/
│   ├── index-B8ZM0Neu.js    # Bundled JS
│   └── index-DnwegHJa.css   # Bundled CSS
├── icons/
│   ├── icon-192.svg
│   └── icon-512.svg
├── manifest.json
├── offline.html
├── sw.js
└── vite.svg
```

### Backend Build

No build step required — the backend is plain JavaScript (ESM). The `server/` directory is used directly.

---

## 8. Deployment Procedure

### Docker Deployment (Recommended)

```bash
# Step 1: Clone and enter project
git clone https://github.com/mineme3/malaria-surveilance-system.git
cd malaria-surveilance-system

# Step 2: Create production environment file
cp .env.example .env
# IMPORTANT: Edit .env and set a strong JWT_SECRET

# Step 3: Build and start container
docker compose up -d --build

# Step 4: Verify deployment
curl http://localhost:3001/api/health
# Expected: {"status":"ok","timestamp":"2026-09-08T..."}

# Step 5: Check container logs
docker compose logs -f
```

### Manual Deployment

```bash
# Step 1: Clone and enter project
git clone https://github.com/mineme3/malaria-surveilance-system.git
cd malaria-surveilance-system

# Step 2: Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Step 3: Install dependencies
npm ci

# Step 4: Create production environment file
cp .env.example .env
# IMPORTANT: Edit .env and set a strong JWT_SECRET

# Step 5: Build frontend
npm run build

# Step 6: Start production server
npm start
# Server starts on port 3001, initializes DB, seeds data
```

### Starting in Background (Manual)

```bash
# Using nohup
nohup npm start > /var/log/malaria-pwa.log 2>&1 &

# Using PM2 (recommended for production)
npm install -g pm2
pm2 start server/index.js --name malaria-pwa
pm2 save
pm2 startup
```

---

## 9. Production Configuration

### Must Change for Production

| Setting | Development Value | Required Production Value |
|---------|-------------------|--------------------------|
| `JWT_SECRET` | `malaria-pwa-secret-key-change-in-production-2024` | Random 64+ character string |
| `NODE_ENV` | (unset/development) | `production` |
| `ALLOWED_ORIGINS` | `*` | Your actual domain(s) |
| Default passwords | `admin123` | Strong unique passwords |
| Rate limits | 200/15min general | Adjust based on user count |

### Security Headers (Already Configured)

Set in `server/index.js`:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

### CORS Configuration

```javascript
// server/index.js line 45
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') || '*' }));
```

In production, set `ALLOWED_ORIGINS=https://your-domain.com` to restrict origins.

### Do NOT Use in Production

- Default `.env` values
- `npm run dev` (Vite dev server with hot reload)
- Default seed passwords (`admin123`)
- CORS `origin: '*'`

---

## 10. Services & Process Management

### Docker

```bash
# Start
docker compose up -d

# Stop
docker compose down

# Restart
docker compose restart

# View logs
docker compose logs -f

# Rebuild after code changes
docker compose up -d --build

# Check status
docker compose ps
```

### PM2 (Recommended for Non-Docker)

```bash
# Install PM2 globally
npm install -g pm2

# Start application
pm2 start server/index.js --name malaria-pwa

# Save process list
pm2 save

# Auto-start on system boot
pm2 startup

# View status
pm2 status

# View logs
pm2 logs malaria-pwa

# Restart
pm2 restart malaria-pwa

# Stop
pm2 stop malaria-pwa

# Delete
pm2 delete malaria-pwa
```

### nohup (Simple)

```bash
# Start
nohup node server/index.js > /var/log/malaria-pwa.log 2>&1 &

# Stop
kill $(lsof -ti:3001)

# View logs
tail -f /var/log/malaria-pwa.log
```

### systemd (Alternative)

Create `/etc/systemd/system/malaria-pwa.service`:

```ini
[Unit]
Description=Malaria Surveillance System
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/malaria-pwa
ExecStart=/usr/bin/node server/index.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production
EnvironmentFile=/opt/malaria-pwa/.env

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable malaria-pwa
sudo systemctl start malaria-pwa
sudo systemctl status malaria-pwa
```

---

## 11. Reverse Proxy & HTTPS

No reverse proxy is included in the project. For production, one is **strongly recommended**.

### Nginx Example

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Let's Encrypt (Free HTTPS)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## 12. Deployment Verification

### Health Check

```bash
curl http://localhost:3001/api/health
# Expected: {"status":"ok","timestamp":"2026-09-08T..."}
```

### API Check

```bash
# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
# Expected: {"token":"eyJ...","user":{...}}

# Get stats
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
curl http://localhost:3001/api/cases/stats -H "Authorization: Bearer $TOKEN"
# Expected: {"total_cases":50,"cases_this_week":...}
```

### Frontend Check

```bash
curl -s http://localhost:3001/ | head -5
# Expected: HTML with <title>Malaria Surveillance System</title>
```

### Docker Health Check

```bash
docker inspect --format='{{.State.Health.Status}}' malaria-pwa
# Expected: healthy
```

---

## 13. Smoke Testing

### Pre-Deployment Smoke Test

| # | Test | Expected Result |
|---|------|----------------|
| 1 | Navigate to `https://your-domain.com` | Login page loads |
| 2 | Login as `admin` / `admin123` | Dashboard loads with charts |
| 3 | Click "Cases" in sidebar | Case list displays |
| 4 | Click "New Case" | Case entry form loads with 30 fields |
| 5 | Submit a new case | Success message, case appears in list |
| 6 | Click "Facilities" | Facility list shows 7 facilities |
| 7 | Click "Reports" | Report generation page loads |
| 8 | Select report type and generate | Report data displays |
| 9 | Click "Users" (district_admin+) | User list shows users below caller's level |
| 10 | Test user activation toggle | User status changes |
| 11 | Click notification bell | Notification panel opens |
| 12 | Log out | Redirected to login page |
| 13 | Test offline: disconnect network, reload | App loads from cache, offline indicator shows |
| 14 | Test offline case entry: add case while offline | Case saved to IndexedDB, sync queue increments |
| 15 | Reconnect network, click sync | Pending cases synced to server |

### API Smoke Tests

```bash
# Health
curl http://localhost:3001/api/health

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Get facilities (requires token)
curl http://localhost:3001/api/facilities -H "Authorization: Bearer $TOKEN"

# Get cases (requires token)
curl http://localhost:3001/api/cases -H "Authorization: Bearer $TOKEN"

# Get stats (requires token)
curl http://localhost:3001/api/cases/stats -H "Authorization: Bearer $TOKEN"
```

---

## 14. Logging & Monitoring

### Logging

The application uses `console.log` and `console.error` — no structured logging framework is configured.

**What gets logged:**

| Event | Level | Location |
|-------|-------|----------|
| Server startup | `log` | `server/index.js:95` |
| Database initialization | `log` | `server/index.js:89` |
| Schema creation | `log` | `server/schema.js:119` |
| Unhandled errors | `error` | `server/index.js:79` |
| Unhandled rejections | `error` | `server/index.js:84` |

### Audit Logging (Application-Level)

All user actions are recorded in the `audit_logs` table:

- Login/logout
- User create/update/delete
- Case create/update/delete
- Facility create/update/delete
- Report generation
- Data import

View via API:

```bash
curl http://localhost:3001/api/reports/audit -H "Authorization: Bearer $TOKEN"
```

### Monitoring

**NOT IMPLEMENTED.** No application performance monitoring, error tracking, or uptime monitoring is configured.

Recommended additions for production:

- **Uptime monitoring:** UptimeRobot, Pingdom, or similar
- **Error tracking:** Sentry or similar
- **Log aggregation:** Forward `stdout`/`stderr` to a log service
- **Process monitoring:** PM2 monit or similar

---

## 15. Backup & Recovery

### What Needs Backup

| Data | Location | Criticality |
|------|----------|-------------|
| SQLite database | `server/malaria.db` | **CRITICAL** — all case data, users, audit logs |
| Environment config | `.env` | **CRITICAL** — JWT secret, configuration |
| Application code | Git repository | High — recoverable from Git |

### Backup Mechanism

**NOT IMPLEMENTED** as an automated process. Manual backup:

```bash
# Stop the server first to ensure consistency
# Or use SQLite backup command while running:

# Method 1: File copy (server stopped)
cp server/malaria.db /backups/malaria-$(date +%Y%m%d-%H%M%S).db

# Method 2: SQLite .backup command (server can be running)
sqlite3 server/malaria.db ".backup '/backups/malaria-$(date +%Y%m%d-%H%M%S).db'"

# Backup the .env file too
cp .env /backups/malaria-env-$(date +%Y%m%d)
```

### Automated Backup (Recommended)

Add to crontab:

```bash
# Daily backup at 2 AM
0 2 * * * sqlite3 /opt/malaria-pwa/server/malaria.db ".backup /backups/malaria-$(date +\%Y\%m\%d).db" && find /backups -name "malaria-*.db" -mtime +30 -delete
```

### Recovery

```bash
# Stop the server
pm2 stop malaria-pwa  # or docker compose stop

# Replace database
cp /backups/malaria-YYYYMMDD.db server/malaria.db

# Restart
pm2 start malaria-pwa  # or docker compose start
```

---

## 16. Rollback

### Code Rollback

```bash
# Using Git
git log --oneline  # Find the commit to rollback to
git checkout <commit-hash>  # Or revert the last commit
git push origin main

# Rebuild and restart
npm run build
pm2 restart malaria-pwa  # or docker compose up -d --build
```

### Database Rollback

The database has **no migration system** — schema is created with `CREATE TABLE IF NOT EXISTS`. If schema changes are added in the future, there is no built-in rollback mechanism.

**Current rollback options:**

1. Restore from backup (see section 15)
2. Delete `server/malaria.db` and restart (loses all data, re-seeds defaults)

### Docker Rollback

```bash
# Pull previous version
git checkout <previous-tag>
docker compose up -d --build

# Or use a specific image tag
docker compose up -d --build --no-cache
```

---

## 17. Security

### Authentication

- **Mechanism:** JWT tokens (24-hour expiry)
- **Password hashing:** bcryptjs with salt rounds of 10
- **Token storage:** localStorage (client-side)
- **Token transmission:** `Authorization: Bearer <token>` header

### Authorization (RBAC)

Six hierarchical roles with geographic data scoping:

| Level | Role | Can Manage |
|-------|------|-----------|
| 5 | system_admin | All users, all data, test data generation |
| 4 | region_admin | Users below their level in their region |
| 3 | zone_admin | Users below their level in their zone |
| 2 | district_admin | Users below their level in their woreda, facilities |
| 1 | facility_admin | Cases at their facility |
| 0 | facility_user | Cases they created at their facility |

### Security Risks Identified

| Risk | Severity | Detail |
|------|----------|--------|
| JWT in localStorage | Medium | Vulnerable to XSS attacks. Consider httpOnly cookies. |
| Default passwords | **High** | All seed users have password `admin123`. Must be changed. |
| No HTTPS enforcement | **High** | Application does not redirect HTTP to HTTPS. |
| No CSRF protection | Low | Stateless JWT API, low risk but worth noting. |
| No input sanitization | Low | Some fields accept arbitrary strings. XSS is mitigated by React's default escaping. |
| SQLite file permissions | Medium | Database file must be protected from unauthorized read/write. |
| `DATABASE_URL` in `.env.example` | Low | Contains a real Neon PostgreSQL connection string. |

### Production Security Checklist

- [ ] `JWT_SECRET` is a strong random string (64+ characters)
- [ ] All default passwords (`admin123`) have been changed
- [ ] `NODE_ENV=production` is set
- [ ] `ALLOWED_ORIGINS` restricts CORS to your domain
- [ ] HTTPS is configured via reverse proxy
- [ ] `.env` file permissions are `600` (owner read/write only)
- [ ] SQLite database file permissions are `600`
- [ ] Server runs as a non-root user
- [ ] No debug/logging of sensitive data in production

---

## 18. External Dependencies

| Service | Purpose | Required Configuration | Impact if Unavailable |
|---------|---------|----------------------|----------------------|
| None | — | — | Application is fully self-contained |

The application has **no external service dependencies** at runtime. It uses:
- Local SQLite database (no external database server)
- No email/SMS service
- No cloud storage
- No third-party APIs
- No push notification service (push handler exists in SW but no server-side push configured)

---

## 19. Troubleshooting

| Problem | Likely Cause | How to Diagnose | Solution |
|---------|-------------|-----------------|----------|
| Server won't start | Port 3001 already in use | `lsof -ti:3001` | Kill existing process or change `PORT` in `.env` |
| Server won't start | Missing `JWT_SECRET` | Check console output for FATAL warning | Set `JWT_SECRET` in `.env` |
| `better-sqlite3` install fails | Missing build tools | Check npm error output | Install build essentials: `apt install build-essential python3` |
| Login returns "Invalid credentials" | Wrong password or user inactive | Check `is_active` in users table | Activate user or reset password |
| "Access denied" on API calls | JWT expired or wrong role | Check token expiry, user role | Re-login to get fresh token |
| Frontend shows blank page | `dist/` not built | `ls dist/` | Run `npm run build` |
| API returns 500 | Database corruption | Check server logs | Restore from backup |
| Offline sync fails | `client_side_id` conflict | Check sync response status | Server uses last-write-wins |
| Docker build fails | `node_modules` cached | Check `.dockerignore` | `docker compose build --no-cache` |
| "Too many requests" | Rate limit exceeded | Check request frequency | Wait for window to expire (15 min) |
| Seed data not created | DB already has data | Seed is idempotent | Manual: delete `server/malaria.db` and restart |
| PWA not installing | Missing manifest/service worker | Check browser DevTools > Application | Ensure `dist/` contains `manifest.json` and `sw.js` |

---

## 20. Maintenance

### Update the Application

```bash
# Pull latest code
git pull origin main

# Reinstall dependencies (if package.json changed)
npm ci

# Rebuild frontend
npm run build

# Restart server
pm2 restart malaria-pwa  # or docker compose up -d --build
```

### Update Dependencies

```bash
# Check outdated packages
npm outdated

# Update (careful — test after updating)
npm update

# Or update specific package
npm install <package>@latest
```

### Apply Schema Changes

The schema auto-applies on startup via `CREATE TABLE IF NOT EXISTS`. If you add new columns:

1. Add `ALTER TABLE` statements to `server/schema.js`
2. Wrap in try/catch (idempotent)
3. Restart the server

### Check Logs

```bash
# PM2
pm2 logs malaria-pwa

# Docker
docker compose logs -f

# nohup
tail -f /var/log/malaria-pwa.log

# systemd
journalctl -u malaria-pwa -f
```

### Perform Backup

```bash
# See section 15 for backup commands
```

### Check Disk Usage

```bash
# SQLite database size
ls -lh server/malaria.db

# Docker volume
docker system df
```

---

## 21. Deployment Checklist

### Pre-Deployment

- [ ] Server provisioned (Linux, Node.js 20)
- [ ] Git repository cloned
- [ ] `.env` file created with strong `JWT_SECRET`
- [ ] `NODE_ENV=production` set
- [ ] `ALLOWED_ORIGINS` configured
- [ ] Default passwords changed

### Build & Deploy

- [ ] Dependencies installed (`npm ci`)
- [ ] Frontend built (`npm run build`)
- [ ] `dist/` directory exists and contains `index.html`
- [ ] Server started (`npm start` or Docker)
- [ ] Database initialized (check logs for "Database tables and indexes created successfully")

### Verification

- [ ] Health check passes: `curl http://localhost:3001/api/health`
- [ ] Login works: `POST /api/auth/login` returns token
- [ ] Frontend loads: `curl http://localhost:3001/` returns HTML
- [ ] API returns data: Cases/stats endpoints return JSON
- [ ] No errors in server logs

### Security

- [ ] HTTPS configured (via reverse proxy)
- [ ] Default passwords changed
- [ ] `.env` file permissions set to `600`
- [ ] Database file permissions set to `600`
- [ ] Server running as non-root user
- [ ] CORS restricted to allowed origins

### Post-Deployment

- [ ] Smoke tests passed (see section 13)
- [ ] Backup mechanism configured
- [ ] Monitoring configured (uptime, errors)
- [ ] Log rotation configured

---

## 22. Deployment Readiness Assessment

**Deployment Status: READY WITH WARNINGS**

### Verified

- Docker multi-stage build is configured and functional
- Database auto-initializes on startup (no manual migration needed)
- Seed data is created automatically (idempotent)
- Health check endpoint exists (`/api/health`)
- Security headers are configured
- Rate limiting is configured
- RBAC with geographic data scoping is implemented
- Offline PWA with sync capability is functional
- 61 unit tests pass

### Missing

- **No automated backup mechanism** — must be configured externally
- **No HTTPS** — requires reverse proxy (Nginx, Caddy, etc.)
- **No process manager** — PM2 or systemd must be configured for production
- **No CI/CD pipeline** — only documented as example in DEPLOY.md
- **No monitoring/alerting** — no uptime or error tracking
- **No log rotation** — console output must be managed externally
- **No database migration system** — schema changes require manual ALTER TABLE

### Risks

- **Default credentials in seed data** — all users have password `admin123`
- **JWT in localStorage** — vulnerable to XSS; consider httpOnly cookies
- **SQLite single-writer** — may bottleneck under high concurrent write load
- **No database replication** — single point of failure
- **`.env.example` contains real Neon PostgreSQL credentials** — should be sanitized

### REQUIRES CONFIRMATION

- Production domain name and SSL certificate provider
- Expected concurrent user count (affects rate limit tuning)
- Data retention policy (audit logs, case records will grow unbounded)
- Whether PostgreSQL migration (Neon) is planned (DATABASE_URL exists but is unused)
- Backup storage location and retention schedule
- Monitoring and alerting service to use

### Recommended Actions

1. **Before deployment:** Generate strong `JWT_SECRET`, change all default passwords, set up HTTPS via reverse proxy
2. **Before deployment:** Configure automated daily backups of `server/malaria.db`
3. **After deployment:** Set up PM2 or systemd for process management and auto-restart
4. **After deployment:** Configure uptime monitoring (UptimeRobot, etc.)
5. **After deployment:** Set up log forwarding/aggregation
6. **Future:** Consider migrating to PostgreSQL for concurrent write performance and replication
7. **Future:** Add httpOnly cookie-based JWT storage for improved XSS protection
