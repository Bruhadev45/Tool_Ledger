# Deployment Issues & Solutions

## Issues Identified and Fixed

### 1. ✅ Node Version Mismatch (FIXED)
**Problem:** Build was using Node v18.20.5, but project requires Node >=20
**Error:** `EBADENGINE Unsupported engine` for multiple packages
**Solution:** Updated `backend/nixpacks.toml` from `nodejs-18_x` to `nodejs-20_x`

### 2. ⚠️ Package Lock File Sync Issue
**Problem:** `chokidar@3.6.0` missing from lock file
**Error:** `npm ci` failed with "Missing: chokidar@3.6.0 from lock file"
**Status:** Package-lock.json appears to be in sync locally (chokidar@4.0.3 present)
**Solution:** 
- Run `npm install` locally to regenerate lock file
- Commit updated `package-lock.json` if changes exist

### 3. 🔍 Potential Issues to Check

#### A. Build Output Location
- **Current:** NestJS builds to `dist/` directory
- **Start script:** Checks for `dist/main.js` or `dist/src/main.js`
- **Action:** Verify build output matches start script expectations

#### B. Environment Variables
Ensure these are set in Railway/deployment platform:
- `DATABASE_URL` - PostgreSQL connection string
- `PORT` - Server port (Railway sets this automatically)
- `FRONTEND_URL` - Frontend origin for CORS
- `JWT_SECRET` - Minimum 32 characters
- `JWT_REFRESH_SECRET` - Minimum 32 characters
- `ENCRYPTION_KEY` - 32 characters for AES-256
- `SMTP_USER` - Gmail SMTP user (optional)
- `SMTP_PASSWORD` - Gmail SMTP password (optional)
- `OPENAI_API_KEY` - For invoice parsing (optional)

#### C. Prisma Migrations
- Migrations run automatically via `start.sh`
- Ensure `DATABASE_URL` is set before migrations run
- Check migration logs if deployment fails

#### D. Build Process
The build runs these commands:
1. `npm ci` - Clean install
2. `npx prisma generate` - Generate Prisma Client
3. `npm run build` - Build NestJS app

## Recommended Actions

1. **Verify package-lock.json is committed:**
   ```bash
   git status backend/package-lock.json
   git add backend/package-lock.json
   git commit -m "chore: Update package-lock.json"
   ```

2. **Test build locally:**
   ```bash
   cd backend
   npm ci
   npm run build
   ```

3. **Check Railway deployment logs** for:
   - Node version (should be 20.x)
   - Build success
   - Migration success
   - Application startup

4. **Verify environment variables** are set in Railway dashboard

## Current Configuration

- **Node Version:** 20.x (via nixpacks.toml)
- **Build Tool:** Nixpacks
- **Start Command:** `sh start.sh`
- **Port:** Uses `PORT` env var (Railway provides)

## Next Steps

1. ✅ Node version fixed - pushed to repo
2. ⏳ Verify package-lock.json is up to date
3. ⏳ Check Railway deployment logs after next deploy
4. ⏳ Verify all environment variables are set
