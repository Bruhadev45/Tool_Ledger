#!/bin/bash

# Toolledger 2 - Development Start Script
# Starts both backend and frontend development servers

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Check if .env files exist
if [ ! -f "backend/.env" ]; then
    print_warning "backend/.env not found. Run ./setup.sh first"
    exit 1
fi

if [ ! -f "frontend/.env.local" ]; then
    print_warning "frontend/.env.local not found. Run ./setup.sh first"
    exit 1
fi

# Check if port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Find available port starting from base port
find_available_port() {
    local base_port=$1
    local port=$base_port
    local max_port=$((base_port + 10))
    
    while [ $port -le $max_port ]; do
        if ! check_port $port; then
            echo $port
            return 0
        fi
        port=$((port + 1))
    done
    
    echo $base_port  # Return base port if none found (will show error later)
    return 1
}

# Read backend port from .env if available, otherwise default to 3001
BACKEND_PORT=3001
if [ -f "backend/.env" ]; then
    ENV_PORT=$(grep -E "^PORT=" backend/.env | cut -d'=' -f2 | tr -d '"' | tr -d "'" | tr -d ' ')
    if [ ! -z "$ENV_PORT" ] && [ "$ENV_PORT" != "" ]; then
        BACKEND_PORT=$ENV_PORT
        print_info "Using backend port from .env: $BACKEND_PORT"
    fi
fi

FRONTEND_PORT=3000

# Check backend port
if check_port $BACKEND_PORT; then
    print_warning "Port $BACKEND_PORT is already in use."
    NEW_BACKEND_PORT=$(find_available_port $BACKEND_PORT)
    if [ "$NEW_BACKEND_PORT" != "$BACKEND_PORT" ]; then
        print_info "Using alternative port $NEW_BACKEND_PORT for backend"
        BACKEND_PORT=$NEW_BACKEND_PORT
        # Update backend .env with new port
        if [ -f "backend/.env" ]; then
            if grep -q "^PORT=" backend/.env; then
                sed -i '' "s|^PORT=.*|PORT=$BACKEND_PORT|" backend/.env
            else
                echo "PORT=$BACKEND_PORT" >> backend/.env
            fi
            print_info "Updated backend/.env with port $BACKEND_PORT"
        fi
    else
        print_error "Could not find available port for backend (tried $BACKEND_PORT-$((BACKEND_PORT + 10)))"
        exit 1
    fi
fi

# Check frontend port (make sure it's not the same as backend)
if check_port $FRONTEND_PORT || [ "$FRONTEND_PORT" = "$BACKEND_PORT" ]; then
    if [ "$FRONTEND_PORT" = "$BACKEND_PORT" ]; then
        print_warning "Frontend port $FRONTEND_PORT conflicts with backend port."
    else
        print_warning "Port $FRONTEND_PORT is already in use."
    fi
    
    # Find available port, ensuring it's different from backend
    NEW_FRONTEND_PORT=$FRONTEND_PORT
    while [ "$NEW_FRONTEND_PORT" = "$BACKEND_PORT" ] || check_port $NEW_FRONTEND_PORT; do
        NEW_FRONTEND_PORT=$((NEW_FRONTEND_PORT + 1))
        if [ $NEW_FRONTEND_PORT -gt 3010 ]; then
            print_error "Could not find available port for frontend (tried up to 3010)"
            exit 1
        fi
    done
    
    print_info "Using alternative port $NEW_FRONTEND_PORT for frontend"
    FRONTEND_PORT=$NEW_FRONTEND_PORT
fi

# Final safety check: ensure ports are different
if [ "$BACKEND_PORT" = "$FRONTEND_PORT" ]; then
    print_error "CRITICAL: Backend and frontend would use the same port!"
    print_info "Backend: $BACKEND_PORT, Frontend: $FRONTEND_PORT"
    # Force assign different port
    FRONTEND_PORT=$((BACKEND_PORT + 1))
    while check_port $FRONTEND_PORT; do
        FRONTEND_PORT=$((FRONTEND_PORT + 1))
        if [ $FRONTEND_PORT -gt 3010 ]; then
            print_error "Could not find available port for frontend"
            exit 1
        fi
    done
    print_info "Emergency: Auto-assigned frontend to port: $FRONTEND_PORT"
fi

print_info "Backend will run on port: $BACKEND_PORT"
print_info "Frontend will run on port: $FRONTEND_PORT"

# Ensure frontend .env.local has correct backend API URL
if [ -f "frontend/.env.local" ]; then
    CURRENT_API_URL=$(grep -E "^NEXT_PUBLIC_API_URL=" frontend/.env.local | cut -d'=' -f2 | tr -d '"' | tr -d "'" | tr -d ' ')
    EXPECTED_API_URL="http://localhost:$BACKEND_PORT/api"
    
    if [ "$CURRENT_API_URL" != "$EXPECTED_API_URL" ]; then
        print_warning "Frontend API URL mismatch detected!"
        print_info "Current: $CURRENT_API_URL"
        print_info "Expected: $EXPECTED_API_URL"
        print_info "Updating frontend/.env.local..."
        
        # Backup original
        cp frontend/.env.local frontend/.env.local.backup 2>/dev/null || true
        
        # Update API URL
        if grep -q "^NEXT_PUBLIC_API_URL=" frontend/.env.local; then
            sed -i '' "s|^NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=\"$EXPECTED_API_URL\"|" frontend/.env.local
        else
            echo "NEXT_PUBLIC_API_URL=\"$EXPECTED_API_URL\"" >> frontend/.env.local
        fi
        
        print_success "Updated frontend/.env.local with correct backend URL"
    else
        print_success "Frontend API URL is correctly configured"
    fi
else
    print_warning "frontend/.env.local not found, creating it..."
    mkdir -p frontend
    cat > frontend/.env.local << EOF
# API URL
NEXT_PUBLIC_API_URL="http://localhost:$BACKEND_PORT/api"

# NextAuth
NEXTAUTH_URL="http://localhost:$FRONTEND_PORT"
NEXTAUTH_SECRET="your-nextauth-secret-change-this"
EOF
    print_success "Created frontend/.env.local"
fi

# Ensure backend .env has correct frontend URL
if [ -f "backend/.env" ]; then
    CURRENT_FRONTEND_URL=$(grep -E "^FRONTEND_URL=" backend/.env | cut -d'=' -f2 | tr -d '"' | tr -d "'" | tr -d ' ')
    EXPECTED_FRONTEND_URL="http://localhost:$FRONTEND_PORT"
    
    if [ "$CURRENT_FRONTEND_URL" != "$EXPECTED_FRONTEND_URL" ]; then
        print_info "Updating backend/.env FRONTEND_URL to $EXPECTED_FRONTEND_URL..."
        if grep -q "^FRONTEND_URL=" backend/.env; then
            sed -i '' "s|^FRONTEND_URL=.*|FRONTEND_URL=\"$EXPECTED_FRONTEND_URL\"|" backend/.env
        else
            echo "FRONTEND_URL=\"$EXPECTED_FRONTEND_URL\"" >> backend/.env
        fi
        print_success "Updated backend/.env with correct frontend URL"
    fi
fi

# Function to cleanup on exit
cleanup() {
    echo ""
    print_info "Shutting down servers..."
    
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
        print_info "Backend stopped"
    fi
    
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
        print_info "Frontend stopped"
    fi
    
    # Clean up log files if they exist
    [ -f "backend.log" ] && rm -f backend.log
    [ -f "frontend.log" ] && rm -f frontend.log
    
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# Create log files
touch backend.log frontend.log

# Start backend
print_info "Starting backend server on port $BACKEND_PORT..."
cd backend
PORT=$BACKEND_PORT npm run start:dev >> ../backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# Wait for backend to start
print_info "Waiting for backend to start on port $BACKEND_PORT..."
BACKEND_READY=false
for i in {1..30}; do
    sleep 1
    # Check both root and /api/health endpoints
    if curl -s http://localhost:$BACKEND_PORT/api/health > /dev/null 2>&1 || curl -s http://localhost:$BACKEND_PORT > /dev/null 2>&1; then
        BACKEND_READY=true
        break
    fi
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        print_error "Backend process died. Check backend.log for errors:"
        tail -20 backend.log
        exit 1
    fi
done

if [ "$BACKEND_READY" = false ]; then
    print_error "Backend failed to start within 30 seconds. Check backend.log:"
    tail -20 backend.log
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi

print_success "Backend started (PID: $BACKEND_PID) - http://localhost:$BACKEND_PORT"
print_info "Backend API: http://localhost:$BACKEND_PORT/api"

# Start frontend
print_info "Starting frontend server on port $FRONTEND_PORT..."
cd frontend
# Next.js uses PORT environment variable, ensure it's set and exported
export PORT=$FRONTEND_PORT
npm run dev >> ../frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

# Wait for frontend to start
print_info "Waiting for frontend to start on port $FRONTEND_PORT..."
FRONTEND_READY=false
for i in {1..30}; do
    sleep 1
    if curl -s http://localhost:$FRONTEND_PORT > /dev/null 2>&1; then
        FRONTEND_READY=true
        break
    fi
    if ! kill -0 $FRONTEND_PID 2>/dev/null; then
        print_error "Frontend process died. Check frontend.log for errors:"
        tail -20 frontend.log
        kill $BACKEND_PID 2>/dev/null || true
        exit 1
    fi
done

if [ "$FRONTEND_READY" = false ]; then
    print_warning "Frontend may still be starting. Check frontend.log if issues persist."
fi

print_success "Frontend started (PID: $FRONTEND_PID) - http://localhost:$FRONTEND_PORT"

# Display status
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
print_success "Both servers are running!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📍 URLs:"
echo "   Backend API:  http://localhost:$BACKEND_PORT/api"
echo "   Backend Root: http://localhost:$BACKEND_PORT"
if [ "$BACKEND_PORT" != "3001" ]; then
    echo "   ⚠️  Note: Backend is using alternative port $BACKEND_PORT (3001 was in use)"
fi
echo "   Frontend:     http://localhost:$FRONTEND_PORT"
if [ "$FRONTEND_PORT" != "3000" ]; then
    echo "   ⚠️  Note: Frontend is using alternative port $FRONTEND_PORT (3000 was in use)"
fi
echo ""
echo "🔗 Connection Status:"
echo "   Frontend → Backend: http://localhost:$BACKEND_PORT/api"
echo "   Backend → Frontend: http://localhost:$FRONTEND_PORT"
echo ""
echo "📋 Process IDs:"
echo "   Backend:  $BACKEND_PID"
echo "   Frontend: $FRONTEND_PID"
echo ""
echo "📝 Logs:"
echo "   Backend:  tail -f backend.log"
echo "   Frontend: tail -f frontend.log"
echo ""
# Note: Port synchronization is already handled above

if [ "$FRONTEND_PORT" != "3000" ]; then
    print_warning "⚠️  Frontend is using port $FRONTEND_PORT instead of 3000"
    print_info "Access frontend at: http://localhost:$FRONTEND_PORT"
fi
print_info "Press Ctrl+C to stop both servers"
echo ""

# Monitor processes and keep script running
while true; do
    sleep 5
    
    # Check if backend is still running
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        print_error "Backend process died unexpectedly!"
        print_info "Last 10 lines of backend.log:"
        tail -10 backend.log
        kill $FRONTEND_PID 2>/dev/null || true
        exit 1
    fi
    
    # Check if frontend is still running
    if ! kill -0 $FRONTEND_PID 2>/dev/null; then
        print_error "Frontend process died unexpectedly!"
        print_info "Last 10 lines of frontend.log:"
        tail -10 frontend.log
        kill $BACKEND_PID 2>/dev/null || true
        exit 1
    fi
done
