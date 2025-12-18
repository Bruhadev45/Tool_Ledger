#!/bin/bash

# Test Backend Connection Script

echo "🔍 Testing Backend Connection..."
echo ""

# Check if backend is running
echo "1. Checking if backend is running on port 3001..."
if curl -s http://localhost:3001 > /dev/null 2>&1; then
    echo "   ✅ Backend is running"
else
    echo "   ❌ Backend is NOT running"
    echo "   💡 Start it with: cd backend && npm run start:dev"
    exit 1
fi

# Test login endpoint
echo ""
echo "2. Testing login endpoint..."
RESPONSE=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@toolledger.com","password":"password123"}' \
  -w "\nHTTP_CODE:%{http_code}")

HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | grep -v "HTTP_CODE")

if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ Login endpoint working"
    echo "   Response: $BODY"
else
    echo "   ❌ Login failed (HTTP $HTTP_CODE)"
    echo "   Response: $BODY"
fi

echo ""
echo "3. Checking database users..."
cd backend
npx prisma db execute --stdin <<< "SELECT email, role FROM users LIMIT 5;" 2>&1 | grep -v "Script executed" || echo "   Could not query database"

echo ""
echo "✅ Test completed!"
