#!/bin/bash

# Toolledger 2 - Setup Script
# This script sets up the development environment for Toolledger 2

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored messages
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

print_header() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
check_prerequisites() {
    print_header "Checking Prerequisites"
    
    local missing_deps=()
    
    # Check Node.js
    if command_exists node; then
        NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$NODE_VERSION" -ge 18 ]; then
            print_success "Node.js $(node -v) found"
        else
            print_error "Node.js 18+ required. Found: $(node -v)"
            missing_deps+=("Node.js 18+")
        fi
    else
        print_error "Node.js not found"
        missing_deps+=("Node.js 18+")
    fi
    
    # Check npm
    if command_exists npm; then
        print_success "npm $(npm -v) found"
    else
        print_error "npm not found"
        missing_deps+=("npm")
    fi
    
    # Check PostgreSQL
    if command_exists psql; then
        print_success "PostgreSQL client found"
    else
        print_warning "PostgreSQL client not found (optional if using Docker)"
    fi
    
    # Check Redis
    if command_exists redis-cli; then
        print_success "Redis client found"
    else
        print_warning "Redis client not found (optional if using Docker)"
    fi
    
    if [ ${#missing_deps[@]} -gt 0 ]; then
        print_error "Missing required dependencies: ${missing_deps[*]}"
        echo "Please install the missing dependencies and run this script again."
        exit 1
    fi
}

# Install backend dependencies
install_backend() {
    print_header "Installing Backend Dependencies"
    
    if [ ! -d "backend" ]; then
        print_error "Backend directory not found!"
        exit 1
    fi
    
    cd backend
    
    if [ ! -f "package.json" ]; then
        print_error "package.json not found in backend directory!"
        exit 1
    fi
    
    print_info "Installing npm packages..."
    npm install
    
    if [ $? -eq 0 ]; then
        print_success "Backend dependencies installed successfully"
    else
        print_error "Failed to install backend dependencies"
        exit 1
    fi
    
    cd ..
}

# Install frontend dependencies
install_frontend() {
    print_header "Installing Frontend Dependencies"
    
    if [ ! -d "frontend" ]; then
        print_error "Frontend directory not found!"
        exit 1
    fi
    
    cd frontend
    
    if [ ! -f "package.json" ]; then
        print_error "package.json not found in frontend directory!"
        exit 1
    fi
    
    print_info "Installing npm packages..."
    npm install
    
    if [ $? -eq 0 ]; then
        print_success "Frontend dependencies installed successfully"
    else
        print_error "Failed to install frontend dependencies"
        exit 1
    fi
    
    cd ..
}

# Setup environment variables
setup_env() {
    print_header "Setting Up Environment Variables"
    
    # Backend .env
    if [ ! -f "backend/.env" ]; then
        print_info "Creating backend/.env file..."
        
        if [ -f "backend/.env.example" ]; then
            cp backend/.env.example backend/.env
            print_success "Created backend/.env from .env.example"
            print_warning "Please update backend/.env with your configuration"
        else
            cat > backend/.env << EOF
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/toolledger?schema=public"

# JWT
JWT_SECRET="your-jwt-secret-change-this"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_SECRET="your-refresh-secret-change-this"
JWT_REFRESH_EXPIRES_IN="7d"

# Encryption
ENCRYPTION_KEY="your-32-byte-encryption-key-here"

# Server
PORT=3001
FRONTEND_URL="http://localhost:3000"

# AWS S3 (Optional)
AWS_ACCESS_KEY_ID=""
AWS_SECRET_ACCESS_KEY=""
AWS_REGION="us-east-1"
S3_BUCKET_NAME=""

# Redis (Optional)
REDIS_HOST="localhost"
REDIS_PORT=6379
EOF
            print_success "Created backend/.env template"
            print_warning "Please update backend/.env with your configuration"
        fi
    else
        print_info "backend/.env already exists, skipping..."
    fi
    
    # Frontend .env.local
    if [ ! -f "frontend/.env.local" ]; then
        print_info "Creating frontend/.env.local file..."
        
        if [ -f "frontend/.env.example" ]; then
            cp frontend/.env.example frontend/.env.local
            print_success "Created frontend/.env.local from .env.example"
        else
            cat > frontend/.env.local << EOF
# API URL
NEXT_PUBLIC_API_URL="http://localhost:3001/api"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-nextauth-secret-change-this"
EOF
            print_success "Created frontend/.env.local template"
        fi
        print_warning "Please update frontend/.env.local with your configuration"
    else
        print_info "frontend/.env.local already exists, skipping..."
    fi
}

# Generate Prisma Client
generate_prisma() {
    print_header "Generating Prisma Client"
    
    cd backend
    
    if [ ! -f "prisma/schema.prisma" ]; then
        print_error "Prisma schema not found!"
        exit 1
    fi
    
    print_info "Generating Prisma Client..."
    npx prisma generate
    
    if [ $? -eq 0 ]; then
        print_success "Prisma Client generated successfully"
    else
        print_error "Failed to generate Prisma Client"
        exit 1
    fi
    
    cd ..
}

# Run database migrations
run_migrations() {
    print_header "Running Database Migrations"
    
    cd backend
    
    print_info "Running Prisma migrations..."
    print_warning "Make sure your database is running and DATABASE_URL is correct in backend/.env"
    
    read -p "Do you want to run database migrations now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        npx prisma migrate dev
        
        if [ $? -eq 0 ]; then
            print_success "Database migrations completed successfully"
        else
            print_error "Failed to run database migrations"
            print_warning "You can run migrations manually later with: cd backend && npx prisma migrate dev"
        fi
    else
        print_info "Skipping migrations. Run manually with: cd backend && npx prisma migrate dev"
    fi
    
    cd ..
}

# Main execution
main() {
    print_header "Toolledger 2 Setup"
    echo "This script will set up your development environment."
    echo ""
    
    # Get script directory
    SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
    cd "$SCRIPT_DIR"
    
    # Run setup steps
    check_prerequisites
    install_backend
    install_frontend
    setup_env
    generate_prisma
    run_migrations
    
    print_header "Setup Complete!"
    echo ""
    print_success "All dependencies have been installed."
    echo ""
    print_info "Next steps:"
    echo "  1. Update backend/.env with your database and configuration"
    echo "  2. Update frontend/.env.local with your API URL"
    echo "  3. Make sure PostgreSQL and Redis are running"
    echo "  4. Run database migrations: cd backend && npx prisma migrate dev"
    echo ""
    echo "To start development servers:"
    echo "  Backend:  cd backend && npm run start:dev"
    echo "  Frontend: cd frontend && npm run dev"
    echo ""
    print_info "For Docker setup, run: docker-compose up -d"
    echo ""
}

# Run main function
main
