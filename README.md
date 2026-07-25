# Malaria Surveillance System - PWA

A Progressive Web Application (PWA) for Malaria Line List Data Collection, Surveillance, Analytics, and Reporting. Built for health facilities to electronically collect, submit, and analyze malaria case data with offline capability.

## Features

### Core Functionality
- **Malaria Line List Data Entry** — Complete digital form with all 30 fields from the standard Excel template
- **Case Management** — Create, edit, view, and delete malaria case records
- **Excel Import/Export** — Import cases from Excel files; export filtered data and reports
- **Multi-Facility Support** — Each health facility has its own authorized user accounts

### Surveillance & Analytics
- **Real-time Dashboard** — 8 interactive charts (cases by week, region, age, sex, species, admission type, top facilities, top woredas)
- **Reports** — Generate daily, weekly, monthly, quarterly, and annual reports with Excel export
- **Data Quality Monitoring** — Automated checks for missing fields, duplicates, completeness scoring

### User Management & Security
- **6-Level Role-Based Access Control** — System Admin > Region Admin > Zone Admin > District Admin > Facility Admin > Facility User
- **JWT Authentication** — Secure token-based authentication with 24-hour expiry
- **Audit Logging** — All actions (login, create, update, delete, import) are logged with timestamps
- **Geographic Data Scoping** — Users only see data within their geographic jurisdiction

### Offline & PWA
- **Offline Data Entry** — Cases saved locally via IndexedDB when offline
- **Automatic Sync** — Pending cases sync to server when connection is restored
- **Service Worker** — Caches app shell and API responses for offline access
- **Installable** — Can be installed as a PWA on mobile phones, tablets, and desktops

### Notifications & Alerts
- **In-App Notifications** — Bell icon with unread count badge
- **Automatic Alerts** — Death cases trigger alerts to all admin users
- **Manual Alerts** — Admins can send targeted notifications to users in their scope

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite 5, Tailwind CSS, shadcn/ui |
| Charts | Recharts |
| State | Zustand |
| Offline DB | Dexie (IndexedDB) |
| Backend | Node.js, Express 4 |
| Database | SQLite (better-sqlite3) |
| Auth | JWT (jsonwebtoken), bcryptjs |
| PWA | Service Worker, Web App Manifest |

## Default Credentials

| Role | Username | Password |
|------|----------|----------|
| System Admin | `admin` | `admin123` |
| Facility User | `facility1` | `admin123` |
| District Admin | `district1` | `admin123` |
| Zone Admin | `zone1` | `admin123` |
| Region Admin | `region1` | `admin123` |

> **Change these credentials in production!**

## Getting Started

### Option 1: Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/yourusername/malaria-pwa.git
cd malaria-pwa

# Start with Docker Compose
docker-compose up -d

# Access the app
open http://localhost:3001
```

### Option 2: Local Development

```bash
# Clone the repository
git clone https://github.com/yourusername/malaria-pwa.git
cd malaria-pwa

# Install dependencies
npm install

# Create .env file (optional, defaults work)
cp .env.example .env

# Start development server (frontend + backend)
npm run dev

# Access the app
open http://localhost:5173
```

### Option 3: Production Build

```bash
# Install dependencies
npm install

# Build frontend
npm run build

# Start production server
npm start

# Access the app
open http://localhost:3001
```

## Project Structure

```
malaria-pwa/
├── public/
│   ├── icons/              # PWA icons
│   ├── manifest.json       # Web App Manifest
│   ├── sw.js               # Service Worker
│   └── offline.html        # Offline fallback page
├── src/
│   ├── components/
│   │   ├── auth/           # Login, ProtectedRoute
│   │   ├── cases/          # CaseForm, CaseList, CaseDetail
│   │   ├── dashboard/      # Dashboard with charts
│   │   ├── dataquality/    # Data Quality Monitor
│   │   ├── facilities/     # Facility Management
│   │   ├── layout/         # Layout, Header, Sidebar
│   │   ├── notifications/  # AuditLog, UserManagement, SendAlert
│   │   ├── reports/        # Reports with export
│   │   └── ui/             # shadcn/ui components
│   ├── hooks/              # useAuth
│   ├── services/           # API client, IndexedDB (Dexie)
│   ├── store/              # Zustand auth store
│   ├── types/              # TypeScript interfaces
│   ├── App.tsx             # Route definitions
│   └── main.tsx            # Entry point + SW registration
├── server/
│   ├── middleware/          # Auth middleware (JWT, RBAC)
│   ├── routes/             # API routes (auth, cases, facilities, reports, notifications)
│   ├── db.js               # SQLite schema + seed data
│   └── index.js            # Express server setup
├── docker-compose.yml
├── Dockerfile
└── package.json
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |
| `JWT_SECRET` | (hardcoded fallback) | Secret key for JWT tokens |
| `NODE_ENV` | `development` | Environment mode |

## Data Fields (Excel Template)

The data entry form captures all 30 fields from the standard malaria line list Excel:

| # | Field | Type |
|---|-------|------|
| 1 | Reporting Region | Text |
| 2 | Zone | Text |
| 3 | Woreda | Text |
| 4 | Reporting HF | Text (auto-filled) |
| 5 | Kebele | Text |
| 6 | House No | Text |
| 7 | Mobile Phone | Text |
| 8 | Admission Type | Out-Patient / In-Patient |
| 9 | Patient Name | Text (required) |
| 10 | Sex | M / F (required) |
| 11 | Age | Number (required) |
| 12 | Epi-Week | Number (auto-calculated) |
| 13 | Age Category | Auto-calculated from age |
| 14 | Date of Onset | Date |
| 15 | Date Seen at Facility | Date |
| 16 | Fever | Yes / No |
| 17 | Headache | Yes / No |
| 18 | Joint Pain | Yes / No |
| 19 | Chills & Rigor | Yes / No |
| 20 | Vomiting | Yes / No |
| 21 | Back Pain | Yes / No |
| 22 | Other Symptoms | Text |
| 23 | Specimen Taken | Yes / No |
| 24 | Haemoparasite Species | PF / PV / Vivax / Mixed |
| 25 | Travel History | Text |
| 26 | Travel to Malaria Area | Indigenous / Imported / No |
| 27 | Outcome | Alive / Death |
| 28 | FTAT Done | Yes / No |
| 29 | Referred Facility | Text |
| 30 | Source of Infection | Text |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/register` | Create user (admin only) |
| GET | `/api/auth/me` | Get current user |
| GET | `/api/cases` | List cases (filtered) |
| POST | `/api/cases` | Create case |
| PUT | `/api/cases/:id` | Update case |
| DELETE | `/api/cases/:id` | Delete case |
| POST | `/api/cases/import` | Import cases from Excel |
| GET | `/api/cases/stats` | Dashboard statistics |
| GET | `/api/cases/export` | Export cases as JSON |
| GET | `/api/facilities` | List facilities |
| POST | `/api/facilities` | Create facility |
| PUT | `/api/facilities/:id` | Update facility |
| DELETE | `/api/facilities/:id` | Deactivate facility |
| GET | `/api/reports/generate` | Generate report |
| GET | `/api/reports/audit` | Get audit logs |
| GET | `/api/notifications` | Get notifications |
| POST | `/api/notifications/send` | Send notification |

## License

MIT
