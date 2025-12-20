#!/bin/bash

# Run All Tests Script
# Runs unit tests, e2e tests, and integration tests

echo "🧪 Running All Tests for ToolLedger"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

total_suites=0
passed_suites=0
failed_suites=0

run_test_suite() {
    local name=$1
    local command=$2
    local directory=$3
    
    total_suites=$((total_suites + 1))
    echo -e "${BLUE}📋 Running $name...${NC}"
    
    if [ -n "$directory" ]; then
        cd "$directory" || exit 1
    fi
    
    if eval "$command"; then
        echo -e "${GREEN}✅ $name PASSED${NC}"
        passed_suites=$((passed_suites + 1))
        echo ""
        return 0
    else
        echo -e "${RED}❌ $name FAILED${NC}"
        failed_suites=$((failed_suites + 1))
        echo ""
        return 1
    fi
}

# 1. Backend Unit Tests
run_test_suite "Backend Unit Tests" "npm test" "backend"

# 2. Backend E2E Tests
run_test_suite "Backend E2E Tests" "npm run test:e2e" "backend"

# 3. Backend Linting
run_test_suite "Backend Linting" "npm run lint" "backend"

# 4. Frontend Linting
run_test_suite "Frontend Linting" "npm run lint" "frontend"

# 5. Integration Tests
cd ..
run_test_suite "Integration Tests" "./test-website.sh" ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Test Suite Summary:"
echo "   Total Suites: $total_suites"
echo -e "   ${GREEN}Passed: $passed_suites${NC}"
echo -e "   ${RED}Failed: $failed_suites${NC}"
echo ""

if [ $failed_suites -eq 0 ]; then
    echo -e "${GREEN}🎉 All test suites passed!${NC}"
    echo ""
    echo "✅ Ready for deployment!"
    exit 0
else
    echo -e "${YELLOW}⚠ Some test suites failed. Check the output above.${NC}"
    echo ""
    echo "❌ Fix issues before deployment."
    exit 1
fi