# Railway Deployment Guide

This guide will help you deploy ToolLedger to Railway, a modern cloud platform for deploying applications.

## Prerequisites

- A Railway account (sign up at [railway.app](https://railway.app))
- GitHub account (for connecting your repository)

## Deployment Steps

### 1. Connect Your Repository

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose your `Tool_Ledger` repository
5. Railway will automatically detect your project structure

### 2. Set Up Database (PostgreSQL)

1. In your Railway project, click **"New"** → **"Database"** → **"Add PostgreSQL"**
2. Railway will automatically create a PostgreSQL database
3. Note the `DATABASE_URL` connection string (it will be automatically set as an environment variable)

### 3. Deploy Backend Service

1. Click **"New"** → **"GitHub Repo"** → Select your repository
2. Railway will detect the backend service
3. Configure the service:
   - **Root Directory**: `backend`
   - **Build Command**: (Auto-detected via nixpacks.toml - runs `prisma generate`, `npm run build`, and `prisma migrate deploy`)
   - **Start Command**: `npm run start:prod`

#### Backend Environment Variables

Add these environment variables in Railway dashboard:

```bash
# Database (automatically provided by Railway PostgreSQL service)
DATABASE_URL=${{Postgres.DATABASE_URL}}  # Railway will auto-inject this

# Server Configuration
PORT=3001  # Railway provides PORT automatically, but you can override
FRONTEND_URL=https://your-frontend-domain.railway.app
NODE_ENV=production

# JWT Configuration (Generate secure random strings)
JWT_SECRET=your-super-secret-jwt-key-min-32-characters
JWT_EXPIRES_IN=1h
JWT_REFRESH_SECRET=your-super-secret-refresh-token-key-min-32-characters
JWT_REFRESH_EXPIRES_IN=7d

# Encryption Key (AES-256) - Generate with: openssl rand -base64 32
ENCRYPTION_KEY=your-32-byte-encryption-key-base64-encoded-or-utf8-string-exactly-32-bytes

# OpenAI API Key (Optional - for AI features)
OPENAI_API_KEY=sk-your-openai-api-key-here

# AWS S3 Configuration (Optional - for file storage)
# If not provided, files will be stored locally (ephemeral storage)
AWS_ACCESS_KEY_ID=your-aws-access-key-id
AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-s3-bucket-name
```

**Important**: 
- Railway automatically provides `PORT` and `DATABASE_URL` environment variables
- Use Railway's variable reference syntax: `${{Postgres.DATABASE_URL}}` to reference the database connection

### 4. Deploy Frontend Service

1. Click **"New"** → **"GitHub Repo"** → Select your repository again
2. Configure the service:
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`

#### Frontend Environment Variables

```bash
# API Configuration (Use your backend Railway URL)
NEXT_PUBLIC_API_URL=https://your-backend-service.railway.app/api

# NextAuth Configuration
NEXTAUTH_URL=https://your-frontend-domain.railway.app
NEXTAUTH_SECRET=your-nextauth-secret-key-min-32-characters

# Node Environment
NODE_ENV=production
```

**Important**: 
- Replace `your-backend-service.railway.app` with your actual backend Railway domain
- Replace `your-frontend-domain.railway.app` with your actual frontend Railway domain
- Railway provides these domains automatically after deployment

### 5. Configure Custom Domains (Optional)

1. Go to your service settings
2. Click **"Settings"** → **"Networking"**
3. Add your custom domain
4. Railway will provide SSL certificates automatically

### 6. Run Database Migrations

After the backend service is deployed, run migrations:

1. Go to your backend service in Railway
2. Click **"Deployments"** → **"View Logs"**
3. The build process should automatically run `prisma migrate deploy`
4. If migrations don't run automatically, you can run them manually:
   - Click **"Variables"** → **"Add Template"** → Add a one-time command
   - Or use Railway CLI: `railway run npx prisma migrate deploy`

### 7. Seed Database (Optional)

To seed the database with sample data:

```bash
# Using Railway CLI
railway run --service backend npx prisma db seed
```

Or add a one-time deployment script in Railway.

## Railway-Specific Configuration

### Automatic Detection

Railway will automatically detect:
- Node.js projects (via `package.json`)
- Build commands from `package.json` scripts
- Start commands from `package.json` scripts

### Custom Build Configuration

We've included `nixpacks.toml` files for custom build configuration:
- `backend/nixpacks.toml` - Backend build configuration
- `frontend/nixpacks.toml` - Frontend build configuration

### Port Configuration

Railway automatically provides a `PORT` environment variable. Your application should use this:

- **Backend**: Already configured to use `PORT` env var (defaults to 3001)
- **Frontend**: Next.js automatically uses `PORT` env var (defaults to 3000)

## Environment Variables Reference

### Backend Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Auto-provided by Railway |
| `JWT_SECRET` | JWT signing secret | Generate random 32+ char string |
| `JWT_REFRESH_SECRET` | JWT refresh token secret | Generate random 32+ char string |
| `ENCRYPTION_KEY` | AES-256 encryption key | 32 bytes (base64 or UTF-8) |
| `FRONTEND_URL` | Frontend application URL | `https://your-frontend.railway.app` |

### Backend Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | Auto-provided by Railway |
| `JWT_EXPIRES_IN` | JWT expiration time | `1h` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token expiration | `7d` |
| `OPENAI_API_KEY` | OpenAI API key for AI features | None (AI disabled) |
| `AWS_ACCESS_KEY_ID` | AWS access key for S3 | None (local storage) |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | None |
| `AWS_REGION` | AWS region | `us-east-1` |
| `S3_BUCKET_NAME` | S3 bucket name | None |

### Frontend Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | `https://your-backend.railway.app/api` |
| `NEXTAUTH_URL` | Frontend application URL | `https://your-frontend.railway.app` |
| `NEXTAUTH_SECRET` | NextAuth secret | Generate random 32+ char string |

## Troubleshooting

### Build Failures

1. **Prisma Client Generation**: Ensure `prisma generate` runs during build
   - Check `backend/package.json` - `build` script includes `prisma generate`

2. **Database Connection**: Verify `DATABASE_URL` is correctly set
   - Use Railway's variable reference: `${{Postgres.DATABASE_URL}}`

3. **Port Issues**: Railway provides `PORT` automatically
   - Ensure your app uses `process.env.PORT` or the default

### Runtime Issues

1. **Database Migrations**: If tables don't exist, run migrations:
   ```bash
   railway run --service backend npx prisma migrate deploy
   ```

2. **CORS Errors**: Ensure `FRONTEND_URL` matches your frontend domain exactly

3. **Environment Variables**: Double-check all required variables are set

### Logs

View logs in Railway dashboard:
- Go to your service → **"Deployments"** → **"View Logs"**
- Or use Railway CLI: `railway logs`

## Railway CLI (Optional)

Install Railway CLI for easier management:

```bash
npm i -g @railway/cli
railway login
railway link  # Link to your project
railway up    # Deploy
railway logs  # View logs
```

## Cost Optimization

- **Free Tier**: Railway offers a free tier with limited resources
- **Database**: PostgreSQL is included in Railway's database service
- **Storage**: Use S3 for persistent file storage (local storage is ephemeral)

## Security Best Practices

1. **Never commit `.env` files** - Already excluded in `.gitignore`
2. **Use Railway's secrets management** - Store sensitive data as environment variables
3. **Generate strong secrets**:
   ```bash
   # Generate JWT secret
   openssl rand -base64 32
   
   # Generate encryption key
   openssl rand -base64 32
   
   # Generate NextAuth secret
   openssl rand -base64 32
   ```
4. **Enable HTTPS** - Railway provides SSL automatically
5. **Use Railway's private networking** - Services can communicate internally

## Next Steps

After deployment:

1. ✅ Verify backend API is accessible
2. ✅ Verify frontend is accessible
3. ✅ Test authentication flow
4. ✅ Run database migrations
5. ✅ Seed database (optional)
6. ✅ Configure custom domains
7. ✅ Set up monitoring and alerts

## Support

- Railway Documentation: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Project Issues: Create an issue in your GitHub repository
