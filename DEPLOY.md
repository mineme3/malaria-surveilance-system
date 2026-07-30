# Deployment Guide

## Prerequisites

- Node.js 20+
- PostgreSQL database (the app uses Neon, but any PostgreSQL works)
- Docker (optional, for containerized deployment)

## Quick Start (Local)

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env with your DATABASE_URL and JWT_SECRET

# 3. Build frontend
npm run build

# 4. Start server
node server/index.js

# The app runs on http://localhost:3001
```

## Docker Deployment

The project includes a production-ready Docker setup.

### 1. Prepare Environment

Create a `.env` file in the project root:

```env
PORT=3001
JWT_SECRET=your-secret-key-change-this
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require
```

### 2. Build and Run

```bash
# Build the image
docker build -t malaria-pwa:latest .

# Or use docker-compose (passes DATABASE_URL from your shell)
export DATABASE_URL="postgresql://..."  # Must be set in your shell
docker compose up -d
```

### 3. Verify

```bash
# Health check
curl http://localhost:3001/api/health

# Should return: {"status":"ok","timestamp":"..."}

# Login (replace with your admin credentials)
curl -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"password123"}'
```

### 4. Stop

```bash
docker compose down
```

## Deployment Architecture

```
                         ┌─────────────────┐
                         │   Client Browser │
                         │   (React PWA)    │
                         └────────┬─────────┘
                                  │
                                  ▼
                         ┌─────────────────┐
                         │   Express Server │
                         │   (Port 3001)    │
                         └────────┬─────────┘
                                  │
                                  ▼
                         ┌─────────────────┐
                         │   PostgreSQL DB  │
                         │   (Neon/RDS)     │
                         └─────────────────┘
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Server port (default: 3001) |
| `DATABASE_URL` | **Yes** | PostgreSQL connection string |
| `JWT_SECRET` | **Yes** | Secret key for JWT token signing |
| `NODE_ENV` | No | Set to `production` for production |

## Production Checklist

- [ ] Change `JWT_SECRET` to a strong random value
- [ ] Set up a managed PostgreSQL database (Neon, RDS, etc.)
- [ ] Enable HTTPS (reverse proxy with Nginx/Caddy)
- [ ] Configure rate limiting (already built-in)
- [ ] Set up monitoring and log aggregation
- [ ] Regular database backups
- [ ] Keep `DATABASE_URL` and `JWT_SECRET` out of version control

## CI/CD Pipeline

```yaml
# Example GitHub Actions workflow
name: Deploy
on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
      - run: npm test

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Build and push Docker image
        run: |
          docker build -t registry.example.com/malaria-pwa:latest .
          docker push registry.example.com/malaria-pwa:latest
      - name: Deploy to server
        run: ssh deploy@server "docker compose pull && docker compose up -d"
```
