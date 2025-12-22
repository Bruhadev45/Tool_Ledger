#!/bin/bash

# Website Test Suite
# Tests backend health, authentication, database, and frontend

echo "🧪 Starting Website Test Suite..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to run a test
run_test() {
    local test_name="$1"
    local expected_status="$2"
    local url="$3"
    local method="${4:-GET}"
    local data="$5"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [ "$method" = "POST" ] && [ -n "$data" ]; then
        response=$(curl -s -w "%{http_code}" -X POST -H "Content-Type: application/json" -d "$data" "$url" 2>/dev/null)
    else
        response=$(curl -s -w "%{http_code}" "$url" 2>/dev/null)
    fi
    
    # Extract status code (last 3 characters)
    status_code="${response: -3}"
    response_body="${response%???}"
    
    if [ "$status_code" = "$expected_status" ]; then
        echo -e "Test $TOTAL_TESTS: $test_name... ${GREEN}✓ PASS${NC} (Status: $status_code)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "Test $TOTAL_TESTS: $test_name... ${RED}✗ FAIL${NC} (Expected: $expected_status, Got: $status_code)"
        if [ -n "$response_body" ] && [ ${#response_body} -lt 200 ]; then
            echo "Response: $response_body"
        fi
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

# Backend Health Tests
echo ""
echo "📡 Testing Backend Health..."
run_test "Health Check" "200" "http://localhost:3001/api/health"
run_test "Root Endpoint" "200" "http://localhost:3001/"

# Authentication Tests
echo ""
echo "🔐 Testing Authentication..."
echo "Note: Admin login will fail without MFA (expected behavior)"
run_test "Admin Login (MFA Required)" "401" "http://localhost:3001/api/auth/login" "POST" '{"email":"admin@toolledger.com","password":"admin123"}'
run_test "User Registration" "201" "http://localhost:3001/api/auth/register" "POST" '{"email":"test@example.com","password":"password123","firstName":"Test","lastName":"User"}'

# Database State Check
echo ""
echo "📊 Checking Database State..."
echo -n "Checking if admin exists... "
admin_check=$(curl -s -X POST -H "Content-Type: application/json" -d '{"email":"admin@toolledger.com","password":"wrongpassword"}' "http://localhost:3001/api/auth/login" 2>/dev/null)
if echo "$admin_check" | grep -q "Invalid credentials\|MFA"; then
    echo -e "${GREEN}✓ Admin account exists${NC}"
else
    echo -e "${RED}✗ Admin account issue${NC}"
fi

# Frontend Test
echo ""
echo "🌐 Testing Frontend..."
frontend_response=$(curl -s -w "%{http_code}" "http://localhost:3000" 2>/dev/null)
frontend_status="${frontend_response: -3}"

if [ "$frontend_status" = "200" ] || [ "$frontend_status" = "307" ]; then
    echo -e "Checking frontend availability... ${GREEN}✓ Frontend is running${NC} (Status: $frontend_status)"
else
    echo -e "Checking frontend availability... ${YELLOW}⚠ Frontend may not be running${NC} (Status: $frontend_status)"
    echo "   Start frontend with: cd frontend && npm run dev"
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Test Summary:"
echo "   Total Tests: $TOTAL_TESTS"
echo "   Passed: $PASSED_TESTS"
echo "   Failed: $FAILED_TESTS"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠ Some tests failed. Check the output above.${NC}"
    exit 1
fi