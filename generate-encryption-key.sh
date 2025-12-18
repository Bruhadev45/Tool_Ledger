#!/bin/bash
# Generate ENCRYPTION_KEY for AES-256 encryption
# The key must be exactly 32 bytes (256 bits)

echo "🔐 Generating ENCRYPTION_KEY..."
echo ""

# Method 1: Base64 encoded (recommended - 44 characters)
echo "Method 1: Base64 encoded (recommended for .env files):"
ENCRYPTION_KEY_BASE64=$(openssl rand -base64 32 | tr -d '\n')
echo "ENCRYPTION_KEY=$ENCRYPTION_KEY_BASE64"
echo ""

# Method 2: Hex encoded (64 characters)
echo "Method 2: Hex encoded:"
ENCRYPTION_KEY_HEX=$(openssl rand -hex 32 | tr -d '\n')
echo "ENCRYPTION_KEY=$ENCRYPTION_KEY_HEX"
echo ""

# Method 3: Using Node.js (if openssl is not available)
echo "Method 3: Using Node.js:"
ENCRYPTION_KEY_NODE=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
echo "ENCRYPTION_KEY=$ENCRYPTION_KEY_NODE"
echo ""

echo "✅ Copy one of the ENCRYPTION_KEY values above and add it to your .env file"
echo ""
echo "Example .env entry:"
echo "ENCRYPTION_KEY=$ENCRYPTION_KEY_BASE64"
echo ""
echo "⚠️  Important:"
echo "   - Keep this key secret and secure"
echo "   - Never commit it to version control"
echo "   - Use the same key for all environments (dev, staging, prod)"
echo "   - If you change the key, all encrypted data will become unreadable"
