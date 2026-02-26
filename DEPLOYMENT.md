# Deployment Guide

## Prerequisites
- Cloudflare account
- Wrangler CLI installed: `npm install -g wrangler`

## Backend Deployment (Cloudflare Workers + D1)

### 1. Login to Cloudflare
```bash
wrangler login
```

### 2. Create D1 Database
```bash
cd backend
wrangler d1 create task-manager-db
```

Copy the database ID from the output and update `wrangler.toml`:
```toml
[[d1_databases]]
binding = "DB"
database_name = "task-manager-db"
database_id = "YOUR_DATABASE_ID_HERE"
```

### 3. Set JWT Secret
```bash
wrangler secret put JWT_SECRET
# Enter a secure random string when prompted
```

### 4. Deploy Worker
```bash
cd backend
npm install
wrangler deploy
```

Your API will be live at: `https://task-manager-api.YOUR_SUBDOMAIN.workers.dev`

## Frontend Deployment (Cloudflare Pages)

### Option 1: Connect GitHub Repository

1. Go to Cloudflare Dashboard > Pages
2. Click "Create a project" > "Connect to Git"
3. Select your `task-manager` repository
4. Configure build settings:
   - **Build command**: `cd frontend && npm install && npm run build`
   - **Build output directory**: `frontend/dist`
   - **Root directory**: `/`
5. Add environment variable:
   - `VITE_API_URL`: `https://task-manager-api.YOUR_SUBDOMAIN.workers.dev/api`
6. Click "Save and Deploy"

### Option 2: Direct Upload

```bash
cd frontend

# Install dependencies
npm install

# Update API URL in .env.production
echo "VITE_API_URL=https://task-manager-api.YOUR_SUBDOMAIN.workers.dev/api" > .env.production

# Build
npm run build

# Deploy
npx wrangler pages deploy dist --project-name=task-manager
```

Your app will be live at: `https://task-manager.pages.dev`

## Post-Deployment

1. Test the authentication flow
2. Create a test user
3. Add some tasks
4. Verify all CRUD operations work

## Troubleshooting

### CORS Errors
- Ensure the Worker is returning proper CORS headers
- Check that VITE_API_URL in frontend matches your Worker URL

### Database Errors
- Verify D1 database is created and bound correctly in wrangler.toml
- Check Worker logs: `wrangler tail`

### Authentication Issues
- Verify JWT_SECRET is set in Worker secrets
- Check browser console for token storage issues
