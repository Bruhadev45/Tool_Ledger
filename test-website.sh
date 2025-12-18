#!/bin/bash

# Comprehensive Website Test Script
# Tests all major features and endpoints

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

PASSED=0
FAILED=0
WARNINGS=0

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED++))
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

print_error() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED++))
}

# Get ports from environment or defaults
BACKEND_PORT=${BACKEND_PORT:-3001}
FRONTEND_PORT=${FRONTEND_PORT:-3000}
BACKEND_URL="http://localhost:${BACKEND_PORT}"
FRONTEND_URL="http://localhost:${FRONTEND_PORT}"
API_URL="${BACKEND_URL}/api"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 ToolLedger Website Test Suite"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Backend:  ${BACKEND_URL}"
echo "Frontend: ${FRONTEND_URL}"
echo "API:      ${API_URL}"
echo ""

# Test function
test_endpoint() {
    local name=$1
    local method=$2
    local url=$3
    local data=$4
    local expected_code=${5:-200}
    local auth_token=$6
    
    local headers=()
    if [ ! -z "$auth_token" ]; then
        headers+=("-H" "Authorization: Bearer $auth_token")
    fi
    
    if [ "$method" = "POST" ] || [ "$method" = "PATCH" ]; then
        headers+=("-H" "Content-Type: application/json")
    fi
    
    local response
    if [ -z "$data" ]; then
        response=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X "$method" "$url" "${headers[@]}" 2>&1)
    else
        response=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X "$method" "$url" "${headers[@]}" -d "$data" 2>&1)
    fi
    
    local http_code=$(echo "$response" | grep "HTTP_CODE" | cut -d: -f2)
    local body=$(echo "$response" | grep -v "HTTP_CODE")
    
    if [ "$http_code" = "$expected_code" ]; then
        print_success "$name (HTTP $http_code)"
        echo "$body" | head -c 200
        echo ""
        return 0
    else
        print_error "$name (Expected HTTP $expected_code, got $http_code)"
        echo "$body" | head -c 200
        echo ""
        return 1
    fi
}

# 1. Check if servers are running
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. Server Status Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if curl -s "${BACKEND_URL}" > /dev/null 2>&1; then
    print_success "Backend server is running"
else
    print_error "Backend server is NOT running"
    echo "   Start with: cd backend && npm run start:dev"
    exit 1
fi

if curl -s "${FRONTEND_URL}" > /dev/null 2>&1; then
    print_success "Frontend server is running"
else
    print_warning "Frontend server is NOT running"
    echo "   Start with: cd frontend && npm run dev"
fi

echo ""

# 2. Test Authentication
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2. Authentication Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Login
print_info "Testing login..."
LOGIN_RESPONSE=$(curl -s -X POST "${API_URL}/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@toolledger.com","password":"password123"}')

ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -z "$ACCESS_TOKEN" ]; then
    print_error "Login failed - could not get access token"
    echo "Response: $LOGIN_RESPONSE"
    ACCESS_TOKEN=""
else
    print_success "Login successful"
fi

echo ""

# 3. Test API Endpoints
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3. API Endpoint Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -z "$ACCESS_TOKEN" ]; then
    print_warning "Skipping authenticated endpoints (no token)"
else
    # Test endpoints that require auth
    test_endpoint "Get Users" "GET" "${API_URL}/users" "" 200 "$ACCESS_TOKEN"
    test_endpoint "Get Credentials" "GET" "${API_URL}/credentials" "" 200 "$ACCESS_TOKEN"
    test_endpoint "Get Invoices" "GET" "${API_URL}/invoices" "" 200 "$ACCESS_TOKEN"
    test_endpoint "Get Teams" "GET" "${API_URL}/teams" "" 200 "$ACCESS_TOKEN"
    test_endpoint "Get Audit Logs" "GET" "${API_URL}/audit-logs" "" 200 "$ACCESS_TOKEN"
    test_endpoint "Get Analytics" "GET" "${API_URL}/analytics" "" 200 "$ACCESS_TOKEN"
fi

echo ""

# 4. Test Frontend Pages
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4. Frontend Page Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if curl -s "${FRONTEND_URL}" > /dev/null 2>&1; then
    FRONTEND_PAGES=(
        "/"
        "/login"
        "/signup"
    )
    
    for page in "${FRONTEND_PAGES[@]}"; do
        if curl -s "${FRONTEND_URL}${page}" > /dev/null 2>&1; then
            print_success "Page accessible: ${page}"
        else
            print_error "Page not accessible: ${page}"
        fi
    done
else
    print_warning "Frontend not running - skipping page tests"
fi

echo ""

# 5. Database Check
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5. Database Status"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -d "backend/prisma" ]; then
    cd backend
    
    # Check if Prisma client is generated
    if [ -d "node_modules/.prisma/client" ]; then
        print_success "Prisma client is generated"
    else
        print_warning "Prisma client not found - run: npx prisma generate"
    fi
    
    # Check migrations
    if npx prisma migrate status > /dev/null 2>&1; then
        MIGRATION_STATUS=$(npx prisma migrate status 2>&1 | grep -i "migration" | head -1)
        if echo "$MIGRATION_STATUS" | grep -qi "applied\|up to date"; then
            print_success "Database migrations are applied"
        else
            print_warning "Database migrations may need attention"
            echo "   Status: $MIGRATION_STATUS"
        fi
    else
        print_warning "Could not check migration status"
    fi
    
    cd ..
else
    print_warning "Backend prisma directory not found"
fi

echo ""

# 6. Build Check
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "6. Build Status Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check backend build
if [ -d "backend/dist" ]; then
    print_success "Backend is built"
else
    print_info "Backend not built (development mode is fine)"
fi

# Check frontend build
if [ -d "frontend/.next" ]; then
    print_success "Frontend is built"
else
    print_info "Frontend not built (development mode is fine)"
fi

echo ""

# 7. TypeScript Check
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "7. TypeScript Compilation Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check backend TypeScript
if [ -f "backend/tsconfig.json" ]; then
    cd backend
    if npx tsc --noEmit > /dev/null 2>&1; then
        print_success "Backend TypeScript compiles without errors"
    else
        print_warning "Backend TypeScript has errors (run: npx tsc --noEmit)"
    fi
    cd ..
fi

# Check frontend TypeScript
if [ -f "frontend/tsconfig.json" ]; then
    cd frontend
    if npx tsc --noEmit > /dev/null 2>&1; then
        print_success "Frontend TypeScript compiles without errors"
    else
        print_warning "Frontend TypeScript has errors (run: npx tsc --noEmit)"
    fi
    cd ..
fi

echo ""

# 8. Environment Variables Check
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "8. Environment Variables Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

REQUIRED_BACKEND_VARS=("DATABASE_URL" "JWT_SECRET" "ENCRYPTION_KEY")
REQUIRED_FRONTEND_VARS=("NEXT_PUBLIC_API_URL" "NEXTAUTH_SECRET")

if [ -f "backend/.env" ]; then
    for var in "${REQUIRED_BACKEND_VARS[@]}"; do
        if grep -q "^${var}=" backend/.env; then
            print_success "Backend: $var is set"
        else
            print_warning "Backend: $var is missing"
        fi
    done
else
    print_warning "Backend .env file not found"
fi

if [ -f "frontend/.env.local" ]; then
    for var in "${REQUIRED_FRONTEND_VARS[@]}"; do
        if grep -q "^${var}=" frontend/.env.local; then
            print_success "Frontend: $var is set"
        else
            print_warning "Frontend: $var is missing"
        fi
    done
else
    print_warning "Frontend .env.local file not found"
fi

echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Test Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Passed:  $PASSED"
echo "⚠️  Warnings: $WARNINGS"
echo "❌ Failed:  $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}🎉 All tests passed!${NC}"
        exit 0
    else
        echo -e "${YELLOW}⚠️  Tests passed with warnings${NC}"
        exit 0
    fi
else
    echo -e "${RED}❌ Some tests failed${NC}"
    exit 1
fi
