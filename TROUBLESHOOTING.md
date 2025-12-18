# Troubleshooting Localhost Issues

## Common Issues and Solutions

### 1. Backend Not Responding

**Symptoms:**
- Frontend loads but shows errors
- API calls fail with connection errors
- Backend process is running but not responding

**Solutions:**

1. **Check if backend is running:**
   ```bash
   cd backend
   npm run start:dev
   ```
   Should see: `🚀 Server running on port 3001`

2. **Check backend port:**
   - Backend should run on port 3001 (local dev) or 8080 (Railway)
   - Check `backend/.env` has `PORT=3001`
   - Check `backend/src/main.ts` port configuration

3. **Check CORS configuration:**
   - `backend/.env` should have `FRONTEND_URL="http://localhost:3000"`
   - Backend must allow requests from frontend origin

4. **Check database connection:**
   ```bash
   cd backend
   npx prisma db push
   ```
   Ensure `DATABASE_URL` is set in `backend/.env`

5. **Rebuild backend:**
   ```bash
   cd backend
   npm run build
   npm run start:dev
   ```

### 2. Frontend Not Loading

**Symptoms:**
- Browser shows 404 or blank page
- Next.js errors in console

**Solutions:**

1. **Check if frontend is running:**
   ```bash
   cd frontend
   npm run dev
   ```
   Should see: `Ready on http://localhost:3000`

2. **Check frontend environment:**
   - `frontend/.env.local` should have:
     ```
     NEXT_PUBLIC_API_URL="http://localhost:3001/api"
     NEXTAUTH_URL="http://localhost:3000"
     ```

3. **Clear Next.js cache:**
   ```bash
   cd frontend
   rm -rf .next
   npm run dev
   ```

4. **Check for build errors:**
   ```bash
   cd frontend
   npm run build
   ```

### 3. API Connection Issues

**Symptoms:**
- Frontend can't connect to backend
- CORS errors in browser console
- 401/403 errors

**Solutions:**

1. **Verify API URL:**
   - Frontend: `NEXT_PUBLIC_API_URL="http://localhost:3001/api"`
   - Backend: Running on port 3001
   - Backend CORS: Allows `http://localhost:3000`

2. **Check backend is accessible:**
   ```bash
   curl http://localhost:3001/api
   ```
   Should return JSON with API info

3. **Check authentication:**
   - Ensure `NEXTAUTH_SECRET` is set in `frontend/.env.local`
   - Ensure JWT secrets are set in `backend/.env`

### 4. Port Conflicts

**Symptoms:**
- "Port already in use" errors
- Can't start server

**Solutions:**

1. **Find what's using the port:**
   ```bash
   lsof -i :3000
   lsof -i :3001
   ```

2. **Kill process using port:**
   ```bash
   kill -9 <PID>
   ```

3. **Or use different ports:**
   - Change `PORT` in `backend/.env`
   - Update `NEXT_PUBLIC_API_URL` in `frontend/.env.local`

### 5. Database Issues

**Symptoms:**
- Backend crashes on startup
- Prisma errors
- "Cannot connect to database"

**Solutions:**

1. **Check DATABASE_URL:**
   ```bash
   cd backend
   cat .env | grep DATABASE_URL
   ```

2. **Test database connection:**
   ```bash
   cd backend
   npx prisma db push
   ```

3. **Generate Prisma Client:**
   ```bash
   cd backend
   npx prisma generate
   ```

### 6. Quick Fix Commands

**Restart everything:**
```bash
# Kill existing processes
pkill -f "next dev"
pkill -f "nest start"

# Start backend
cd backend
npm run start:dev

# In another terminal, start frontend
cd frontend
npm run dev
```

**Full reset:**
```bash
# Backend
cd backend
rm -rf dist node_modules/.cache
npm install
npm run build
npm run start:dev

# Frontend
cd frontend
rm -rf .next node_modules/.cache
npm install
npm run dev
```

## Environment Variables Checklist

### Backend (.env)
- [ ] `DATABASE_URL` - PostgreSQL connection string
- [ ] `PORT=3001` - Backend port (3001 for local, 8080 for Railway)
- [ ] `FRONTEND_URL="http://localhost:3000"` - Frontend URL for CORS
- [ ] `JWT_SECRET` - JWT signing secret
- [ ] `JWT_REFRESH_SECRET` - JWT refresh token secret
- [ ] `ENCRYPTION_KEY` - AES-256 encryption key (32 bytes base64)
- [ ] `OPENAI_API_KEY` - (Optional) For AI invoice parsing
- [ ] `NODE_ENV=development` - Environment mode

### Frontend (.env.local)
- [ ] `NEXT_PUBLIC_API_URL="http://localhost:3001/api"` - Backend API URL
- [ ] `NEXTAUTH_URL="http://localhost:3000"` - Frontend URL
- [ ] `NEXTAUTH_SECRET` - NextAuth secret
- [ ] `NODE_ENV=development` - Environment mode

## Testing Connectivity

1. **Test backend:**
   ```bash
   curl http://localhost:3001/api
   ```

2. **Test frontend:**
   ```bash
   curl http://localhost:3000
   ```

3. **Test API endpoint:**
   ```bash
   curl http://localhost:3001/api/health
   ```

## Still Not Working?

1. Check browser console for errors
2. Check terminal logs for backend/frontend errors
3. Verify all environment variables are set
4. Ensure database is running and accessible
5. Try restarting both servers
6. Clear all caches and rebuild
