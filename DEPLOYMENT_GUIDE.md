# QR Money Transfer - Deployment Guide

This guide covers deploying the QR Money Transfer application to production environments.

## Prerequisites

- Production Firebase project
- Stripe live account (when ready for production)
- Cloud hosting platform (Heroku, AWS, etc.)
- Domain name (optional)
- SSL certificate

## 1. Backend Deployment

### Option A: Heroku Deployment

#### Step 1: Prepare for Heroku
1. Install Heroku CLI
2. Login to Heroku: `heroku login`
3. Create Heroku app: `heroku create qr-money-transfer-api`

#### Step 2: Configure Environment Variables
```bash
heroku config:set NODE_ENV=production
heroku config:set FIREBASE_PROJECT_ID=your-production-project-id
heroku config:set FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n"
heroku config:set FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
heroku config:set STRIPE_SECRET_KEY=sk_live_your_live_stripe_secret_key
heroku config:set STRIPE_PUBLISHABLE_KEY=pk_live_your_live_stripe_publishable_key
heroku config:set JWT_SECRET=your-super-secure-jwt-secret
heroku config:set PORT=3000
```

#### Step 3: Deploy
```bash
git add .
git commit -m "Deploy to production"
git push heroku main
```

### Option B: AWS EC2 Deployment

#### Step 1: Launch EC2 Instance
1. Launch Ubuntu 20.04 LTS instance
2. Configure security groups (ports 22, 80, 443, 3000)
3. Connect via SSH

#### Step 2: Install Dependencies
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Install Nginx
sudo apt install nginx -y
```

#### Step 3: Deploy Application
```bash
# Clone repository
git clone https://github.com/yourusername/qr-money-transfer.git
cd qr-money-transfer/backend

# Install dependencies
npm install --production

# Create environment file
sudo nano .env
# Add all production environment variables

# Start with PM2
pm2 start server.js --name "qr-money-transfer-api"
pm2 save
pm2 startup
```

#### Step 4: Configure Nginx
```bash
sudo nano /etc/nginx/sites-available/qr-money-transfer
```

Add configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
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

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/qr-money-transfer /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Option C: Docker Deployment

#### Step 1: Create Dockerfile
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
```

#### Step 2: Create docker-compose.yml
```yaml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - FIREBASE_PROJECT_ID=${FIREBASE_PROJECT_ID}
      - FIREBASE_PRIVATE_KEY=${FIREBASE_PRIVATE_KEY}
      - FIREBASE_CLIENT_EMAIL=${FIREBASE_CLIENT_EMAIL}
      - STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
      - STRIPE_PUBLISHABLE_KEY=${STRIPE_PUBLISHABLE_KEY}
      - JWT_SECRET=${JWT_SECRET}
    restart: unless-stopped
```

#### Step 3: Deploy with Docker
```bash
docker-compose up -d
```

## 2. Frontend Deployment

### Option A: Expo Application Services (EAS)

#### Step 1: Install EAS CLI
```bash
npm install -g @expo/eas-cli
```

#### Step 2: Configure EAS
```bash
cd frontend
eas build:configure
```

#### Step 3: Build for Production
```bash
# Android
eas build --platform android --profile production

# iOS
eas build --platform ios --profile production
```

#### Step 4: Submit to App Stores
```bash
# Android
eas submit --platform android

# iOS
eas submit --platform ios
```

### Option B: Web Deployment

#### Step 1: Build Web Version
```bash
cd frontend
expo build:web
```

#### Step 2: Deploy to Netlify/Vercel
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod --dir=web-build
```

## 3. Database Configuration

### Firebase Production Setup

#### Step 1: Create Production Project
1. Create new Firebase project for production
2. Enable Authentication with Email/Password
3. Set up Realtime Database with production rules

#### Step 2: Security Rules
```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    },
    "transactions": {
      "$transactionId": {
        ".read": "auth != null && (data.child('userId').val() === auth.uid || data.child('receiverId').val() === auth.uid)",
        ".write": "auth != null && (data.child('userId').val() === auth.uid || data.child('receiverId').val() === auth.uid)"
      }
    },
    "paymentRequests": {
      "$requestId": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    }
  }
}
```

#### Step 3: Update Configuration
Update Firebase configuration in both frontend and backend with production credentials.

## 4. SSL/HTTPS Setup

### Let's Encrypt (Free SSL)
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

## 5. Monitoring and Logging

### Application Monitoring
```bash
# Install monitoring tools
npm install --save express-winston winston

# Configure logging
const winston = require('winston');
const expressWinston = require('express-winston');

app.use(expressWinston.logger({
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ],
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.json()
  )
}));
```

### Health Checks
```javascript
// Add to server.js
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});
```

## 6. Security Considerations

### Environment Variables
- Never commit production secrets to version control
- Use environment variable management tools
- Rotate secrets regularly

### API Security
- Implement rate limiting
- Use HTTPS everywhere
- Validate all inputs
- Implement proper CORS policies

### Database Security
- Use Firebase security rules
- Implement proper authentication
- Monitor for suspicious activity

## 7. Performance Optimization

### Backend Optimization
- Enable gzip compression
- Implement caching
- Use connection pooling
- Monitor performance metrics

### Frontend Optimization
- Optimize bundle size
- Implement lazy loading
- Use CDN for static assets
- Enable service workers

## 8. Backup and Recovery

### Database Backups
```bash
# Firebase backup (if using Firestore)
gcloud firestore export gs://your-backup-bucket

# Regular backups
0 2 * * * /path/to/backup-script.sh
```

### Application Backups
- Regular code backups
- Configuration backups
- Environment variable backups

## 9. Scaling Considerations

### Horizontal Scaling
- Use load balancers
- Implement microservices
- Use container orchestration (Kubernetes)

### Database Scaling
- Firebase auto-scales
- Consider read replicas
- Implement caching layers

## 10. Maintenance

### Regular Updates
- Keep dependencies updated
- Monitor security advisories
- Regular security audits

### Monitoring
- Set up alerts for errors
- Monitor performance metrics
- Track user analytics

---

**Important**: This is a prototype application. Before deploying to production with real financial transactions, ensure:

1. Complete security audit
2. Compliance with financial regulations
3. Proper testing with real payment systems
4. Legal review and approval
5. Insurance and liability coverage

The application should only be used for demonstration purposes until all production requirements are met.