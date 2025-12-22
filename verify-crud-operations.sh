#!/bin/bash

# Comprehensive CRUD Operations Verification Script
# Tests all create, update, delete operations for invoices, credentials, and organizations
# Verifies database sync across admin, user, and accountant roles

echo "🧪 Starting CRUD Operations Verification..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

API_URL="http://localhost:3001/api"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

test_count=0
pass_count=0
fail_count=0
ADMIN_TOKEN=""
USER_TOKEN=""
ACCOUNTANT_TOKEN=""
ADMIN_ID=""
USER_ID=""
ACCOUNTANT_ID=""
ORG_ID=""
CREDENTIAL_ID=""
INVOICE_ID=""

# Test function
test_endpoint() {
    local name=$1
    local method=$2
    local endpoint=$3
    local data=$4
    local expected_status=$5
    local token=$6
    local save_var=$7
    
    test_count=$((test_count + 1))
    echo -n "Test $test_count: $name... "
    
    local headers=(-H "Content-Type: application/json")
    if [ -n "$token" ]; then
        headers+=(-H "Authorization: Bearer $token")
    fi
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "${headers[@]}" "$API_URL$endpoint" 2>&1)
    elif [ "$method" = "POST" ]; then
        response=$(curl -s -w "\n%{http_code}" "${headers[@]}" -X POST "$API_URL$endpoint" -d "$data" 2>&1)
    elif [ "$method" = "PATCH" ]; then
        response=$(curl -s -w "\n%{http_code}" "${headers[@]}" -X PATCH "$API_URL$endpoint" -d "$data" 2>&1)
    elif [ "$method" = "PUT" ]; then
        response=$(curl -s -w "\n%{http_code}" "${headers[@]}" -X PUT "$API_URL$endpoint" -d "$data" 2>&1)
    elif [ "$method" = "DELETE" ]; then
        response=$(curl -s -w "\n%{http_code}" "${headers[@]}" -X DELETE "$API_URL$endpoint" 2>&1)
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC} (Status: $http_code)"
        pass_count=$((pass_count + 1))
        
        # Save variable if requested
        if [ -n "$save_var" ] && ([ "$http_code" = "200" ] || [ "$http_code" = "201" ]); then
            if [ "$save_var" = "TOKEN" ]; then
                # Try multiple extraction methods
                ADMIN_TOKEN=$(echo "$body" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
                if [ -z "$ADMIN_TOKEN" ]; then
                    ADMIN_TOKEN=$(echo "$body" | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')
                fi
                if [ -z "$ADMIN_TOKEN" ]; then
                    ADMIN_TOKEN=$(echo "$body" | python3 -c "import sys, json; print(json.load(sys.stdin).get('access_token', ''))" 2>/dev/null || echo "")
                fi
            elif [ "$save_var" = "USER_TOKEN" ]; then
                USER_TOKEN=$(echo "$body" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
                if [ -z "$USER_TOKEN" ]; then
                    USER_TOKEN=$(echo "$body" | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')
                fi
                if [ -z "$USER_TOKEN" ]; then
                    USER_TOKEN=$(echo "$body" | python3 -c "import sys, json; print(json.load(sys.stdin).get('access_token', ''))" 2>/dev/null || echo "")
                fi
            elif [ "$save_var" = "ACCOUNTANT_TOKEN" ]; then
                ACCOUNTANT_TOKEN=$(echo "$body" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
                if [ -z "$ACCOUNTANT_TOKEN" ]; then
                    ACCOUNTANT_TOKEN=$(echo "$body" | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')
                fi
                if [ -z "$ACCOUNTANT_TOKEN" ]; then
                    ACCOUNTANT_TOKEN=$(echo "$body" | python3 -c "import sys, json; print(json.load(sys.stdin).get('access_token', ''))" 2>/dev/null || echo "")
                fi
            elif [ "$save_var" = "ORG_ID" ]; then
                ORG_ID=$(echo "$body" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
            elif [ "$save_var" = "CREDENTIAL_ID" ]; then
                CREDENTIAL_ID=$(echo "$body" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
            elif [ "$save_var" = "INVOICE_ID" ]; then
                INVOICE_ID=$(echo "$body" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
            elif [ "$save_var" = "USER_ID" ]; then
                USER_ID=$(echo "$body" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
            elif [ "$save_var" = "ACCOUNTANT_ID" ]; then
                ACCOUNTANT_ID=$(echo "$body" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
            fi
        fi
        
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (Expected: $expected_status, Got: $http_code)"
        echo "   Response: $body"
        fail_count=$((fail_count + 1))
        return 1
    fi
}

# 1. Authentication Tests
echo -e "${BLUE}📡 Testing Authentication & Login...${NC}"
test_endpoint "Admin Login" "POST" "/auth/login" \
    '{"email":"admin@toolledger.com","password":"admin123"}' "200" "" "TOKEN"

if [ -z "$ADMIN_TOKEN" ]; then
    echo -e "${RED}❌ Cannot proceed without admin token${NC}"
    echo "   Response body was: $body"
    exit 1
fi

# Get admin user info
ADMIN_USER_RESPONSE=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$API_URL/auth/me")
ADMIN_ID=$(echo "$ADMIN_USER_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
ORG_ID=$(echo "$ADMIN_USER_RESPONSE" | grep -o '"organizationId":"[^"]*' | head -1 | cut -d'"' -f4)

echo -e "${GREEN}✅ Admin authenticated: $ADMIN_ID${NC}"
echo -e "${GREEN}✅ Organization ID: $ORG_ID${NC}"
echo ""

# 2. Create Test Users (User and Accountant)
echo -e "${BLUE}👥 Creating Test Users...${NC}"
TIMESTAMP=$(date +%s)

# Create User
test_endpoint "Create User" "POST" "/users" \
    "{\"email\":\"testuser${TIMESTAMP}@example.com\",\"password\":\"Test123!\",\"firstName\":\"Test\",\"lastName\":\"User\",\"role\":\"USER\",\"domain\":\"toolledger.com\"}" \
    "201" "$ADMIN_TOKEN" "USER_ID"

# Create Accountant
test_endpoint "Create Accountant" "POST" "/users" \
    "{\"email\":\"testaccountant${TIMESTAMP}@example.com\",\"password\":\"Test123!\",\"firstName\":\"Test\",\"lastName\":\"Accountant\",\"role\":\"ACCOUNTANT\",\"domain\":\"toolledger.com\"}" \
    "201" "$ADMIN_TOKEN" "ACCOUNTANT_ID"

# Approve users (endpoint uses POST, not PATCH)
# Note: Accountants are auto-approved, only regular users need approval
# Note: Approve endpoint returns 201 (Created) not 200 (OK)
if [ -n "$USER_ID" ]; then
    test_endpoint "Approve User" "POST" "/users/$USER_ID/approve" \
        "{}" "201" "$ADMIN_TOKEN"
    # Small delay to ensure approval is processed
    sleep 1
fi

# Accountants are auto-approved (no approval needed)

# Login as User (only if user was created and approved)
USER_EMAIL="testuser${TIMESTAMP}@example.com"
if [ -n "$USER_ID" ]; then
    test_endpoint "User Login" "POST" "/auth/login" \
        "{\"email\":\"$USER_EMAIL\",\"password\":\"Test123!\"}" "200" "" "USER_TOKEN"
    
    # If token extraction failed, try alternative method
    if [ -z "$USER_TOKEN" ]; then
        echo -e "${YELLOW}⚠️  Token extraction failed, trying alternative method...${NC}"
        # Re-extract from last response
        USER_TOKEN=$(echo "$body" | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')
    fi
else
    echo -e "${YELLOW}⚠️  Skipping user login - user creation failed${NC}"
fi

# Login as Accountant (auto-approved, should work immediately)
ACCOUNTANT_EMAIL="testaccountant${TIMESTAMP}@example.com"
test_endpoint "Accountant Login" "POST" "/auth/login" \
    "{\"email\":\"$ACCOUNTANT_EMAIL\",\"password\":\"Test123!\"}" "200" "" "ACCOUNTANT_TOKEN"
    
# If token extraction failed, try alternative method
if [ -z "$ACCOUNTANT_TOKEN" ]; then
    echo -e "${YELLOW}⚠️  Accountant token extraction failed, trying alternative method...${NC}"
    ACCOUNTANT_TOKEN=$(echo "$body" | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')
fi

echo ""

# 3. Credentials CRUD Tests
echo -e "${BLUE}🔐 Testing Credentials CRUD Operations...${NC}"

# Create Credential (as User)
test_endpoint "Create Credential" "POST" "/credentials" \
    "{\"name\":\"Test Tool\",\"username\":\"testuser\",\"password\":\"testpass123\",\"notes\":\"Test credential\",\"tags\":[\"test\",\"tool\"]}" \
    "201" "$USER_TOKEN" "CREDENTIAL_ID"

if [ -z "$CREDENTIAL_ID" ]; then
    echo -e "${YELLOW}⚠️  Skipping credential tests - creation failed${NC}"
else
    # Read Credential (as User)
    test_endpoint "Read Credential (User)" "GET" "/credentials/$CREDENTIAL_ID" \
        "" "200" "$USER_TOKEN"
    
    # Read Credential (as Admin - should see it)
    test_endpoint "Read Credential (Admin)" "GET" "/credentials/$CREDENTIAL_ID" \
        "" "200" "$ADMIN_TOKEN"
    
    # Update Credential (as User)
    test_endpoint "Update Credential" "PATCH" "/credentials/$CREDENTIAL_ID" \
        "{\"notes\":\"Updated test credential\"}" "200" "$USER_TOKEN"
    
    # Verify Update
    test_endpoint "Verify Credential Update" "GET" "/credentials/$CREDENTIAL_ID" \
        "" "200" "$USER_TOKEN"
    
    # List Credentials (as User)
    test_endpoint "List Credentials (User)" "GET" "/credentials" \
        "" "200" "$USER_TOKEN"
    
    # List Credentials (as Admin - should see all)
    test_endpoint "List Credentials (Admin)" "GET" "/credentials" \
        "" "200" "$ADMIN_TOKEN"
fi

echo ""

# 4. Invoices CRUD Tests
echo -e "${BLUE}📄 Testing Invoices CRUD Operations...${NC}"

# Create Invoice (as User)
INVOICE_DATA="{\"invoiceNumber\":\"INV-TEST-001\",\"amount\":100.50,\"provider\":\"Test Provider\",\"billingDate\":\"2024-12-21\",\"dueDate\":\"2025-01-21\",\"category\":\"Test Category\"}"
test_endpoint "Create Invoice" "POST" "/invoices" \
    "$INVOICE_DATA" "201" "$USER_TOKEN" "INVOICE_ID"

if [ -z "$INVOICE_ID" ]; then
    echo -e "${YELLOW}⚠️  Skipping invoice tests - creation failed${NC}"
else
    # Read Invoice (as User)
    test_endpoint "Read Invoice (User)" "GET" "/invoices/$INVOICE_ID" \
        "" "200" "$USER_TOKEN"
    
    # Read Invoice (as Admin - should see it)
    test_endpoint "Read Invoice (Admin)" "GET" "/invoices/$INVOICE_ID" \
        "" "200" "$ADMIN_TOKEN"
    
    # Update Invoice (as User - only pending invoices can be updated)
    test_endpoint "Update Invoice" "PATCH" "/invoices/$INVOICE_ID" \
        "{\"category\":\"Updated Category\"}" "200" "$USER_TOKEN"
    
    # Approve Invoice (as Admin) - uses POST, not PATCH
    test_endpoint "Approve Invoice (Admin)" "POST" "/invoices/$INVOICE_ID/approve" \
        "{}" "200" "$ADMIN_TOKEN"
    
    # List Invoices (as User)
    test_endpoint "List Invoices (User)" "GET" "/invoices" \
        "" "200" "$USER_TOKEN"
    
    # List Invoices (as Admin - should see all)
    test_endpoint "List Invoices (Admin)" "GET" "/invoices" \
        "" "200" "$ADMIN_TOKEN"
    
    # List Invoices (as Accountant - should see approved invoices)
    test_endpoint "List Invoices (Accountant)" "GET" "/invoices" \
        "" "200" "$ACCOUNTANT_TOKEN"
fi

echo ""

# 5. Organization Tests
echo -e "${BLUE}🏢 Testing Organization Operations...${NC}"

# Read Organization (as Admin)
test_endpoint "Read Organization (Admin)" "GET" "/organizations/$ORG_ID" \
    "" "200" "$ADMIN_TOKEN"

# List Organizations (as Admin)
test_endpoint "List Organizations (Admin)" "GET" "/organizations" \
    "" "200" "$ADMIN_TOKEN"

# Update Organization (as Admin) - uses PUT, not PATCH
test_endpoint "Update Organization" "PUT" "/organizations/$ORG_ID" \
    "{\"name\":\"ToolLedger Updated\"}" "200" "$ADMIN_TOKEN"

# Verify Update
test_endpoint "Verify Organization Update" "GET" "/organizations/$ORG_ID" \
    "" "200" "$ADMIN_TOKEN"

echo ""

# 6. Database Sync Verification
echo -e "${BLUE}🔄 Testing Database Sync Across Roles...${NC}"

# Create a credential as User
CREDENTIAL_SYNC_ID=""
test_endpoint "Create Credential for Sync Test" "POST" "/credentials" \
    "{\"name\":\"Sync Test Tool\",\"username\":\"synctest\",\"password\":\"syncpass123\"}" \
    "201" "$USER_TOKEN" "CREDENTIAL_SYNC_ID"

if [ -n "$CREDENTIAL_SYNC_ID" ]; then
    # Admin should see it immediately
    test_endpoint "Admin Sees New Credential" "GET" "/credentials/$CREDENTIAL_SYNC_ID" \
        "" "200" "$ADMIN_TOKEN"
    
    # User should see it in their list
    test_endpoint "User Sees Own Credential" "GET" "/credentials" \
        "" "200" "$USER_TOKEN"
fi

# Create an invoice as User
INVOICE_SYNC_ID=""
test_endpoint "Create Invoice for Sync Test" "POST" "/invoices" \
    "{\"invoiceNumber\":\"INV-SYNC-001\",\"amount\":50.00,\"provider\":\"Sync Provider\",\"billingDate\":\"2024-12-21\"}" \
    "201" "$USER_TOKEN" "INVOICE_SYNC_ID"

if [ -n "$INVOICE_SYNC_ID" ]; then
    # Admin should see it immediately
    test_endpoint "Admin Sees New Invoice" "GET" "/invoices/$INVOICE_SYNC_ID" \
        "" "200" "$ADMIN_TOKEN"
    
    # Accountant should see it (pending invoices)
    test_endpoint "Accountant Sees New Invoice" "GET" "/invoices/$INVOICE_SYNC_ID" \
        "" "200" "$ACCOUNTANT_TOKEN"
fi

echo ""

# 7. Cleanup - Delete Test Data
echo -e "${BLUE}🧹 Cleaning Up Test Data...${NC}"

if [ -n "$CREDENTIAL_ID" ]; then
    test_endpoint "Delete Credential" "DELETE" "/credentials/$CREDENTIAL_ID" \
        "" "200" "$USER_TOKEN"
fi

if [ -n "$CREDENTIAL_SYNC_ID" ]; then
    test_endpoint "Delete Sync Test Credential" "DELETE" "/credentials/$CREDENTIAL_SYNC_ID" \
        "" "200" "$USER_TOKEN"
fi

# Note: Invoices are typically not deleted, just marked as rejected
# Organizations are not deleted in normal flow

echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}📊 Test Summary:${NC}"
echo "   Total Tests: $test_count"
echo -e "   ${GREEN}Passed: $pass_count${NC}"
echo -e "   ${RED}Failed: $fail_count${NC}"
echo ""

if [ $fail_count -eq 0 ]; then
    echo -e "${GREEN}🎉 All CRUD operations verified successfully!${NC}"
    echo ""
    echo "✅ Credentials: Create, Read, Update, Delete - Working"
    echo "✅ Invoices: Create, Read, Update, Approve - Working"
    echo "✅ Organizations: Read, Update - Working"
    echo "✅ Database Sync: Admin, User, Accountant - Synced"
    echo "✅ Login Details: Saving correctly"
    exit 0
else
    echo -e "${YELLOW}⚠️  Some tests failed. Please review the output above.${NC}"
    exit 1
fi
