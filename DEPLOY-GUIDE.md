# Mom Masale Order Management - Deployment Guide

## 📦 Downloaded Files

Your project ZIP file: `mom-masale-orders-deploy.zip` (14 MB)

---

## 🚀 Quick Start - Deploy on Render.com (FREE)

### Step 1: Unzip the downloaded file
```bash
unzip mom-masale-orders-deploy.zip
cd mom-masale-orders-deploy
```

### Step 2: Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR-USERNAME/mom-masale-orders.git
git push -u origin main
```

### Step 3: Deploy on Render.com
1. Go to **render.com** → Sign up with GitHub
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repo
4. Fill in settings:

| Setting | Value |
|---------|-------|
| Name | `mom-masale-orders` |
| Runtime | `Node` |
| Build Command | `npm install && npx prisma generate && npx prisma db push && npm run build` |
| Start Command | `npm run start` |

### Step 4: Add Environment Variables

| Key | Value |
|-----|-------|
| `DATABASE_URL` | `file:./prod.db` |
| `NEXTAUTH_SECRET` | Generate: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://your-app-name.onrender.com` |
| `NODE_ENV` | `production` |

### Step 5: Deploy
Click **"Create Web Service"** and wait 5-10 minutes.

---

## 🖥️ Deploy on Hostinger VPS

### Step 1: Upload to VPS
```bash
# Via SCP from your local machine
scp mom-masale-orders-deploy.zip root@YOUR-VPS-IP:/var/www/
```

### Step 2: On your VPS
```bash
# Install dependencies
apt update && apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs nginx
npm install -g pm2

# Install Bun
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# Unzip project
cd /var/www
unzip mom-masale-orders-deploy.zip -d mom-masale
cd mom-masale

# Install & Build
bun install
bun run db:generate
bun run db:push
bun run build

# Create .env file
nano .env
```

### Step 3: Add .env content
```env
DATABASE_URL="file:./prod.db"
NEXTAUTH_SECRET="your-random-32-char-string"
NEXTAUTH_URL="https://yourdomain.com"
NODE_ENV="production"
```

### Step 4: Start with PM2
```bash
pm2 start "bun run start" --name mom-masale
pm2 save
pm2 startup
```

### Step 5: Configure Nginx
```bash
nano /etc/nginx/sites-available/mom-masale
```

Add:
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/mom-masale /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

### Step 6: Install SSL (Free)
```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d yourdomain.com
```

---

## 🏠 Deploy on Localhost

### Step 1: Unzip
```bash
unzip mom-masale-orders-deploy.zip
cd mom-masale-orders-deploy
```

### Step 2: Install & Setup
```bash
# Install Bun (if not installed)
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# Install dependencies
bun install

# Setup database
bun run db:generate
bun run db:push

# Create .env
cp .env.production.example .env
# Edit .env with your settings
```

### Step 3: Run
```bash
# Development
bun run dev

# Production
bun run build
bun run start
```

Access at: **http://localhost:3000**

---

## 🔐 Default Login Credentials

After deployment, seed the database:

```bash
# Run seed API once
curl http://localhost:3000/api/seed
```

Or visit: `http://localhost:3000/api/seed` in browser

### Default Users:

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@mommasale.com` | `admin123` |
| Sales | `sales@mommasale.com` | `sales123` |

⚠️ **Important**: Change these passwords after first login!

---

## 📁 Project Structure

```
mom-masale-orders/
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── seed.ts            # Seed data
├── src/
│   ├── app/
│   │   ├── api/           # API routes
│   │   ├── page.tsx       # Main page
│   │   └── layout.tsx     # Layout
│   └── components/
│       ├── orders/        # Order management
│       ├── products/      # Product management
│       ├── shopkeepers/   # Shopkeeper management
│       ├── payments/      # Payment management
│       └── ui/            # UI components
├── package.json
├── .env                   # Environment variables
└── deploy.sh              # Deployment script
```

---

## ❓ Need Help?

1. **Render.com**: Free tier may sleep after 15 min inactivity
2. **SQLite**: Works on VPS, may not work on Vercel (use PostgreSQL)
3. **SSL**: Always use HTTPS in production
4. **Secrets**: Generate unique NEXTAUTH_SECRET for production

---

## 📞 Support

For issues, check:
1. Environment variables are set correctly
2. Database is created (`bun run db:push`)
3. Port 3000 is not blocked
4. NextAuth URL matches your domain

Good luck with your deployment! 🎉
