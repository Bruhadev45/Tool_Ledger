#!/bin/bash

# Development startup script for ToolLedger
# Starts both backend and frontend servers

echo "🚀 Starting ToolLedger Development Servers..."
echo ""

# Kill any existing processes
echo "🧹 Cleaning up existing processes..."
pkill -f "nest start" 2>/dev/null
pkill -f "next dev" 2>/dev/null
pkill -f "node.*main.js" 2>/dev/null
sleep 2

# Check if ports are available
if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "⚠️  Port 3001 is already in use. Please free it first."
    exit 1
fi

if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "⚠️  Port 3000 is already in use. Please free it first."
    exit 1
fi

# Start backend
echo "📦 Starting backend server..."
cd backend
if [ ! -f .env ]; then
    echo "❌ Error: backend/.env file not found!"
    echo "   Please copy backend/.env.example to backend/.env and configure it."
    exit 1
fi

# Generate Prisma Client
echo "🔧 Generating Prisma Client..."
npx prisma generate > /dev/null 2>&1

# Start backend in background
npm run start:dev > ../backend.log 2>&1 &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"
echo "   Backend logs: tail -f backend.log"

# Wait for backend to start
echo "⏳ Waiting for backend to start..."
for i in {1..30}; do
    if curl -s http://localhost:3001/api > /dev/null 2>&1; then
        echo "✅ Backend is running on http://localhost:3001"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Backend failed to start after 30 seconds"
        echo "   Check backend.log for errors: tail -f backend.log"
        kill $BACKEND_PID 2>/dev/null
        exit 1
    fi
    sleep 1
done

# Start frontend
echo ""
echo "🎨 Starting frontend server..."
cd ../frontend
if [ ! -f .env.local ]; then
    echo "⚠️  Warning: frontend/.env.local not found!"
    echo "   Please copy frontend/.env.example to frontend/.env.local and configure it."
fi

# Start frontend in background
npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
echo "   Frontend PID: $FRONTEND_PID"
echo "   Frontend logs: tail -f frontend.log"

# Wait for frontend to start
echo "⏳ Waiting for frontend to start..."
for i in {1..30}; do
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo "✅ Frontend is running on http://localhost:3000"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Frontend failed to start after 30 seconds"
        echo "   Check frontend.log for errors: tail -f frontend.log"
        kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
        exit 1
    fi
    sleep 1
done

echo ""
echo "🎉 Both servers are running!"
echo ""
echo "📍 URLs:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:3001/api"
echo ""
echo "📋 To stop servers:"
echo "   kill $BACKEND_PID $FRONTEND_PID"
echo "   or: pkill -f 'nest start' && pkill -f 'next dev'"
echo ""
echo "📝 To view logs:"
echo "   Backend:  tail -f backend.log"
echo "   Frontend: tail -f frontend.log"
echo ""

# Keep script running
wait
