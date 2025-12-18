#!/bin/bash
# Railway Setup Script
# This script helps set up environment variables for Railway deployment

echo "🚂 Railway Deployment Setup"
echo "============================"
echo ""
echo "This script will help you generate secure secrets for Railway deployment."
echo ""

# Generate JWT Secret
echo "Generating JWT_SECRET..."
JWT_SECRET=$(openssl rand -base64 32 | tr -d '\n')
echo "JWT_SECRET=$JWT_SECRET"
echo ""

# Generate JWT Refresh Secret
echo "Generating JWT_REFRESH_SECRET..."
JWT_REFRESH_SECRET=$(openssl rand -base64 32 | tr -d '\n')
echo "JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET"
echo ""

# Generate Encryption Key
echo "Generating ENCRYPTION_KEY..."
ENCRYPTION_KEY=$(openssl rand -base64 32 | tr -d '\n')
echo "ENCRYPTION_KEY=$ENCRYPTION_KEY"
echo ""

# Generate NextAuth Secret
echo "Generating NEXTAUTH_SECRET..."
NEXTAUTH_SECRET=$(openssl rand -base64 32 | tr -d '\n')
echo "NEXTAUTH_SECRET=$NEXTAUTH_SECRET"
echo ""

echo "✅ Secrets generated!"
echo ""
echo "Copy these values and add them as environment variables in Railway:"
echo "1. Go to your Railway project dashboard"
echo "2. Select your service (backend or frontend)"
echo "3. Go to Variables tab"
echo "4. Add each variable with its value"
echo ""
echo "For more details, see RAILWAY_DEPLOYMENT.md"
