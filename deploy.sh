#!/bin/bash

# Mom Masale Order Management - Quick Deploy Script
# Run this on your VPS server

echo "🚀 Deploying Mom Masale Order Management..."

# Update system
apt update && apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install Bun
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# Install PM2 for process management
npm install -g pm2

# Install Nginx
apt install -y nginx

# Create app directory
mkdir -p /var/www/mom-masale
cd /var/www/mom-masale

echo "✅ Server setup complete!"
echo ""
echo "Next steps:"
echo "1. Upload your project files to /var/www/mom-masale"
echo "2. Run: cd /var/www/mom-masale && bun install"
echo "3. Run: bun run db:generate && bun run db:push"
echo "4. Run: bun run build"
echo "5. Create .env file with your settings"
echo "6. Run: pm2 start \"bun run start\" --name mom-masale"
echo "7. Configure Nginx (see deploy-nginx.conf)"
echo ""
echo "Your app will be live on port 3000"
