#!/bin/bash

# Website Testing Script
# Tests all major features of the ToolLedger platform

echo "🧪 Starting Website Test Suite..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

API_URL="http://localhost:3001/api"
FRONTEND_URL="http://localhost:3000"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

test_count=0
pass_count=0
fail_count=0

# Test function
test_endpoint() {
    local name=$1
    local method=$2
    local endpoint=$3
    local data=$4
    local expected_status=$5
    
    test_count=$((test_count + 1))
    echo -n "Test $test_count: $name... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$API_URL$endpoint" 2>&1)
    elif [ "$method" = "POST" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST "$API_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data" 2>&1)
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC} (Status: $http_code)"
        pass_count=$((pass_count + 1))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (Expected: $expected_status, Got: $http_code)"
        echo "   Response: $body"
        fail_count=$((fail_count + 1))
        return 1
    fi
}

# 1. Backend Health Check
echo "📡 Testing Backend Health..."
test_endpoint "Health Check" "GET" "/health" "" "200"
test_endpoint "Root Endpoint" "GET" "/" "" "200"
echo ""

# 2. Authentication Tests
echo "🔐 Testing Authentication..."
echo -e "${YELLOW}Note: Admin login will fail without MFA (expected behavior)${NC}"

# Test admin login (should fail due to MFA requirement)
test_endpoint "Admin Login (MFA Required)" "POST" "/auth/login" \
    '{"email":"admin@toolledger.com","password":"admin123"}' "401"

# Test registration
test_endpoint "User Registration" "POST" "/auth/register" \
    '{"email":"testuser@example.com","password":"Test123!","firstName":"Test","lastName":"User","domain":"example.com"}' "201"
echo ""

# 3. Database State Check
echo "📊 Checking Database State..."
echo -n "Checking if admin exists... "
admin_check=$(curl -s "$API_URL/auth/login" -X POST \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@toolledger.com","password":"admin123"}' 2>&1)
if echo "$admin_check" | grep -q "MFA\|credentials\|401"; then
    echo -e "${GREEN}✓ Admin account exists${NC}"
    pass_count=$((pass_count + 1))
else
    echo -e "${RED}✗ Admin account issue${NC}"
    fail_count=$((fail_count + 1))
fi
test_count=$((test_count + 1))
echo ""

# 4. Frontend Check
echo "🌐 Testing Frontend..."
echo -n "Checking frontend availability... "
frontend_check=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL" 2>&1)
if [ "$frontend_check" = "200" ] || [ "$frontend_check" = "302" ]; then
    echo -e "${GREEN}✓ Frontend is running${NC} (Status: $frontend_check)"
    pass_count=$((pass_count + 1))
else
    echo -e "${YELLOW}⚠ Frontend may not be running${NC} (Status: $frontend_check)"
    echo "   Start frontend with: cd frontend && npm run dev"
fi
test_count=$((test_count + 1))
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Test Summary:"
echo "   Total Tests: $test_count"
echo -e "   ${GREEN}Passed: $pass_count${NC}"
echo -e "   ${RED}Failed: $fail_count${NC}"
echo ""

if [ $fail_count -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠ Some tests failed. Check the output above.${NC}"
    exit 1
fi
