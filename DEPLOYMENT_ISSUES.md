# Deployment Issues & Solutions

## Issues Identified and Fixed

### 1. ✅ Node Version Mismatch (FIXED)
**Problem:** Build was using Node v18.20.5, but project requires Node >=20
**Error:** `EBADENGINE Unsupported engine` or `undefined variable 'nodejs-20_x'`
**Solution:** Updated `nixpacks.toml` to use `nodejs_20` package name.

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

### 4. ✅ Redundant Config Files Removed (FIXED)
**Problem:** Root `railway.json` and `package-lock.json` were redundant and potentially incorrect for the monorepo-style structure.
**Solution:** Removed root configs and optimized service-specific `railway.json` files with healthchecks.

### 5. ✅ Build Output Verified (FIXED)
**Problem:** Uncertainty about `dist/main.js` location.
**Solution:** Verified that `npm run build` produces `dist/main.js` at the expected location for `start.sh`.
