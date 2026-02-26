#!/bin/bash

# Task Manager Deployment Script
# This script automates the deployment to Cloudflare

set -e

echo "🚀 Starting Task Manager Deployment..."

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found. Install it with: npm install -g wrangler"
    exit 1
fi

# Step 1: Deploy Backend (Worker)
echo ""
echo "📦 Deploying Backend API..."
cd backend

# Create D1 database if not exists
echo "Creating D1 database..."
DB_OUTPUT=$(wrangler d1 create task-manager-db 2>&1 || echo "exists")

if [[ $DB_OUTPUT == *"exists"* ]] || [[ $DB_OUTPUT == *"already exists"* ]]; then
    echo "✅ Database already exists"
else
    echo "✅ Database created"
    echo "$DB_OUTPUT"
    echo ""
    echo "⚠️  Please update wrangler.toml with the database_id from above output"
    echo "Press Enter when ready..."
    read
fi

# Set JWT secret if not set
echo ""
echo "Setting JWT secret..."
echo "Please enter a secure JWT secret (or press Enter to skip if already set):"
read -s JWT_SECRET
if [ -n "$JWT_SECRET" ]; then
    echo "$JWT_SECRET" | wrangler secret put JWT_SECRET
    echo "✅ JWT secret set"
fi

# Deploy worker
echo ""
echo "Deploying Worker..."
wrangler deploy

WORKER_URL=$(wrangler deployments list --name task-manager-api 2>/dev/null | grep -oP 'https://[^ ]+' | head -1)
if [ -z "$WORKER_URL" ]; then
    WORKER_URL="https://task-manager-api.YOUR_SUBDOMAIN.workers.dev"
fi

echo "✅ Backend deployed at: $WORKER_URL"

# Step 2: Deploy Frontend
echo ""
echo "🎨 Deploying Frontend..."
cd ../frontend

# Install dependencies
echo "Installing frontend dependencies..."
npm install

# Update API URL
echo "VITE_API_URL=${WORKER_URL}/api" > .env.production
echo "✅ API URL configured: ${WORKER_URL}/api"

# Build
echo "Building frontend..."
npm run build

# Deploy to Pages
echo "Deploying to Cloudflare Pages..."
npx wrangler pages deploy dist --project-name=task-manager

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📱 Your app is live!"
echo "   Frontend: https://task-manager.pages.dev"
echo "   Backend API: $WORKER_URL"
echo ""
echo "🎉 Happy task managing!"
