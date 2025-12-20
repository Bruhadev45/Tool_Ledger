# ToolLedger

<div align="center">

**A production-ready, multi-tenant SaaS platform for secure credential management and subscription analytics**

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat&logo=next.js&logoColor=white)](https://nextjs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=flat&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=flat&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=flat&logo=prisma&logoColor=white)](https://www.prisma.io/)

</div>

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Usage](#usage)
- [API Documentation](#api-documentation)
- [Deployment](#deployment)
- [Security](#security)
- [Contributing](#contributing)
- [License](#license)

## 🎯 Overview

ToolLedger is a comprehensive enterprise-grade platform designed to help organizations securely manage credentials, track subscription expenses, and analyze spending patterns. Built with security and scalability in mind, it provides multi-tenant isolation, role-based access control, and end-to-end encryption for sensitive data.

### Key Highlights

- 🔐 **Enterprise Security**: AES-256 encryption, TOTP-based MFA, comprehensive audit trails
- 🏢 **Multi-Tenant Architecture**: Complete data isolation per organization
- 👥 **Role-Based Access Control**: Three distinct roles with granular permissions
- 📊 **Advanced Analytics**: Real-time spending insights and forecasting
- 🤖 **AI-Powered**: Intelligent invoice parsing and expense categorization
- 🔗 **Team Collaboration**: Share credentials and invoices within teams

## ✨ Features

### Credential Management
- ✅ Secure credential storage with AES-256 encryption
- ✅ Credential sharing with granular permissions (VIEW_ONLY, EDIT, NO_ACCESS)
- ✅ Email notifications when credentials are shared
- ✅ Team-based credential sharing
- ✅ Credential-invoice linking for expense tracking
- ✅ Tag-based organization and search
- ✅ Organization selection for credential creation (Admin only)

### Invoice Management
- ✅ PDF invoice upload and storage
- ✅ AI-powered invoice parsing (OCR + OpenAI)
- ✅ Approval workflow (Admin approval required)
- ✅ Invoice-credential bidirectional linking
- ✅ Organization selection for invoice creation (Admin only)
- ✅ Category-based organization
- ✅ Multi-currency support (USD)

### Analytics & Reporting
- ✅ Role-based dashboards (User, Admin, Accountant)
- ✅ Real-time spending analytics
- ✅ Vendor-wise expense breakdown
- ✅ Team-wise spending analysis
- ✅ Time-series spending trends
- ✅ Budget forecasting

### Team Management
- ✅ Create and manage teams within organizations
- ✅ Assign users to teams
- ✅ Team-based credential sharing
- ✅ Team spending analytics

### Security & Compliance
- ✅ TOTP-based Multi-Factor Authentication (MFA) for Admins
- ✅ Password reset and change functionality
- ✅ Comprehensive audit logging
- ✅ Rate limiting on all endpoints
- ✅ Signed URLs for file downloads
- ✅ Multi-tenant query isolation

### User Experience
- ✅ Responsive design (mobile, tablet, desktop)
- ✅ Sorting and filtering on all list pages
- ✅ Real-time notifications
- ✅ Comments on invoices and credentials
- ✅ Dark mode support (via shadcn/ui)

## 🛠️ Tech Stack

### Frontend
- **Framework**: [Next.js 14](https://nextjs.org/) (App Router)
- **Language**: TypeScript
- **UI Library**: [shadcn/ui](https://ui.shadcn.com/) + Tailwind CSS
- **Charts**: [Recharts](https://recharts.org/)
- **Authentication**: [NextAuth.js](https://next-auth.js.org/)
- **HTTP Client**: Axios with interceptors

### Backend
- **Framework**: [NestJS](https://nestjs.com/)
- **Language**: TypeScript
- **ORM**: [Prisma](https://www.prisma.io/)
- **Database**: PostgreSQL 14+
- **Cache**: Redis 7+
- **Authentication**: JWT + Refresh Tokens
- **File Storage**: AWS S3 / Local Storage
- **AI**: OpenAI API (for invoice parsing)

### DevOps
- **Containerization**: Docker & Docker Compose
- **CI/CD**: Ready for GitHub Actions / GitLab CI
- **Monitoring**: Built-in audit logging

## 🏗️ Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Layer (Next.js)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   App Router │  │  Components  │  │   NextAuth   │     │
│  │   (Routes)   │  │  (React)     │  │  (Session)    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            ↕ HTTPS
┌─────────────────────────────────────────────────────────────┐
│                  API Layer (NestJS)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Controllers  │  │   Services   │  │   Guards     │     │
│  │  (Endpoints) │  │  (Business)  │  │  (RBAC/MFA)  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Encryption  │  │ Audit Logger │  │ Rate Limiter │     │
│  │   Service    │  │  (Middleware)│  │  (Throttler) │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                    Data Layer                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  PostgreSQL  │  │    Redis     │  │  AWS S3 /    │     │
│  │  (Prisma)    │  │  (Cache)     │  │  Local FS    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### Multi-Tenancy Model

- **Organization-based isolation**: All data scoped by `organizationId`
- **Domain-based signup**: Users automatically assigned to organizations based on email domain
- **Query-level isolation**: All database queries filtered by organization
- **Role-based access**: Three roles (USER, ADMIN, ACCOUNTANT) with strict permissions

## 🚀 Getting Started

> **🚂 Railway Deployment**: For quick deployment to Railway, see [RAILWAY_DEPLOYMENT.md](./RAILWAY_DEPLOYMENT.md)

### Prerequisites

- **Node.js**: 18.x or higher
- **PostgreSQL**: 14.x or higher
- **Redis**: 6.x or higher (optional, for caching)
- **Docker**: 20.x or higher (optional, for containerized deployment)
- **npm** or **yarn**: Package manager

### Installation

#### Option 1: Manual Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Tool_Ledger
   ```

2. **Install dependencies**
   ```bash
   # Backend
   cd backend
   npm install
   
   # Frontend
   cd ../frontend
   npm install
   ```

3. **Set up environment variables**
   ```bash
   # Backend
   cd backend
   cp .env.example .env
   # Edit .env with your configuration
   
   # Frontend
   cd ../frontend
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

4. **Set up the database**
   ```bash
   cd backend
   npx prisma generate
   npx prisma migrate dev
   npx prisma db seed  # Optional: Seed with sample data
   ```

5. **Start development servers**
   ```bash
   # Terminal 1: Backend (port 3001)
   cd backend
   npm run start:dev
   
   # Terminal 2: Frontend (port 3000)
   cd frontend
   npm run dev
   ```

6. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001/api
   - API Health Check: http://localhost:3001/api/health

#### Option 2: Docker Compose (Recommended)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

#### Option 3: Development Script

```bash
# Make script executable (Linux/Mac)
chmod +x start-dev.sh

# Run development servers
./start-dev.sh
```

## ⚙️ Configuration

### Backend Environment Variables

Create `backend/.env`:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/toolledger?schema=public"

# Redis (optional)
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT Authentication
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_REFRESH_SECRET="your-super-secret-refresh-key-change-in-production"
JWT_EXPIRES_IN="1h"
JWT_REFRESH_EXPIRES_IN="7d"

# Encryption (32 bytes)
ENCRYPTION_KEY="your-32-byte-encryption-key-here!!"

# Server
PORT=3001
FRONTEND_URL="http://localhost:3000"

# AWS S3 (optional, falls back to local storage)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
S3_BUCKET_NAME=your-bucket-name

# OpenAI (optional, for AI invoice parsing)
OPENAI_API_KEY=your-openai-api-key

# Gmail SMTP (for email notifications)
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-gmail-app-password
SMTP_FROM=your-email@gmail.com

# Environment
NODE_ENV=development
```

### Frontend Environment Variables

Create `frontend/.env.local`:

```env
# API Configuration
NEXT_PUBLIC_API_URL="http://localhost:3001/api"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-nextauth-secret-change-this"
```

### Production Configuration

For production deployment:

1. **Generate secure secrets**
   ```bash
   # JWT Secret (32+ characters)
   openssl rand -base64 32
   
   # Encryption Key (exactly 32 bytes)
   openssl rand -base64 32 | head -c 32
   
   # NextAuth Secret
   openssl rand -base64 32
   ```

2. **Update environment variables** with production values
3. **Set `NODE_ENV=production`**
4. **Configure AWS S3** for file storage (recommended)
5. **Set up SSL/TLS** certificates
6. **Configure CORS** properly for your domain

## 📖 Usage

### Default Accounts

After seeding the database, you can login with:

**Admin Account**
- Email: `admin@toolledger.com`
- Password: `password123`
- MFA: Enabled (use code `000000` for testing)

**User Account**
- Email: `user1@toolledger.com`
- Password: `password123`

**Accountant Account**
- Email: `accountant1@toolledger.com`
- Password: `password123`

### Key Workflows

#### 1. Credential Management
1. Navigate to **Credentials** → **New Credential**
2. Enter credential details (name, username, password, optional API key)
3. Add tags for organization
4. Save (credentials are automatically encrypted)

#### 2. Sharing Credentials
1. Open a credential
2. Click **Share** button
3. Select users or teams
4. Set permission level (VIEW_ONLY, EDIT)
5. Share

#### 3. Invoice Upload
1. Navigate to **Invoices** → **New Invoice**
2. Fill in invoice details
3. Upload PDF file
4. Link to credentials (optional)
5. Submit for approval (Admin approval required)

#### 4. Team Management (Admin Only)
1. Navigate to **Teams** → **New Team**
2. Enter team name and description
3. Add members
4. Use teams for credential sharing

## 📚 API Documentation

### Base URL
```
http://localhost:3001/api
```

### Authentication

All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <access_token>
```

### Key Endpoints

#### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login (returns JWT tokens)
- `POST /auth/login/mfa` - Complete MFA login
- `POST /auth/refresh` - Refresh access token
- `POST /auth/change-password` - Change password (authenticated)
- `POST /auth/request-password-reset` - Request password reset
- `POST /auth/reset-password` - Reset password with token

#### Credentials
- `GET /credentials` - List credentials (filtered by role)
- `POST /credentials` - Create credential
- `GET /credentials/:id` - Get credential details
- `PATCH /credentials/:id` - Update credential
- `DELETE /credentials/:id` - Delete credential
- `POST /credentials/:id/share` - Share credential
- `DELETE /credentials/:id/share/:shareId` - Revoke share

#### Invoices
- `GET /invoices` - List invoices
- `POST /invoices` - Create invoice (with file upload)
- `GET /invoices/:id` - Get invoice details
- `PATCH /invoices/:id` - Update invoice
- `POST /invoices/:id/approve` - Approve invoice (Admin only)
- `POST /invoices/:id/reject` - Reject invoice (Admin only)

#### Teams
- `GET /teams` - List teams
- `POST /teams` - Create team (Admin/Accountant only)
- `GET /teams/:id` - Get team details
- `PATCH /teams/:id` - Update team
- `DELETE /teams/:id` - Delete team

#### Analytics
- `GET /analytics` - Get analytics data (role-based)

### Response Format

All API responses follow this structure:

```json
{
  "data": { ... },
  "message": "Success message",
  "statusCode": 200
}
```

Error responses:

```json
{
  "message": "Error message",
  "statusCode": 400,
  "errors": ["Validation error details"]
}
```

## 🚢 Deployment

### Docker Deployment

1. **Build and start services**
   ```bash
   docker-compose up -d --build
   ```

2. **Run database migrations**
   ```bash
   docker-compose exec backend npx prisma migrate deploy
   ```

3. **Seed database (optional)**
   ```bash
   docker-compose exec backend npx prisma db seed
   ```

### Production Build

#### Backend
```bash
cd backend
npm run build
npm run start:prod
```

#### Frontend
```bash
cd frontend
npm run build
npm run start
```

### Environment-Specific Deployment

#### Vercel (Frontend)
1. Connect your GitHub repository
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push

#### Railway / Render (Backend)
1. Connect repository
2. Set environment variables
3. Configure build command: `npm run build`
4. Configure start command: `npm run start:prod`

### Health Checks

- Backend: `GET /api/health`
- Frontend: Root URL should return 200

## 🔒 Security

### Security Features

1. **Encryption**
   - AES-256 encryption for all credential data
   - Encryption at rest and in transit
   - Secure key management

2. **Authentication**
   - JWT-based authentication
   - Refresh token rotation
   - TOTP-based MFA for Admins
   - Password hashing with bcrypt (10 rounds)

3. **Authorization**
   - Role-Based Access Control (RBAC)
   - Multi-tenant data isolation
   - Query-level security

4. **API Security**
   - Rate limiting (100 requests/minute per IP)
   - CORS protection
   - Helmet.js security headers
   - Input validation and sanitization

5. **Audit & Compliance**
   - Comprehensive audit logging
   - User activity tracking
   - IP address and user agent logging

### Security Best Practices

- ✅ Never commit `.env` files
- ✅ Use strong, unique secrets in production
- ✅ Enable MFA for all admin accounts
- ✅ Regularly rotate encryption keys
- ✅ Monitor audit logs
- ✅ Keep dependencies updated
- ✅ Use HTTPS in production
- ✅ Configure proper CORS origins

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes**
4. **Follow coding standards**
   - Use TypeScript
   - Follow existing code style
   - Add comments for complex logic
   - Write tests for new features
5. **Commit your changes**
   ```bash
   git commit -m "feat: add your feature description"
   ```
6. **Push to your branch**
   ```bash
   git push origin feature/your-feature-name
   ```
7. **Create a Pull Request**

### Code Style

- **Backend**: Follow NestJS conventions, use ESLint and Prettier
- **Frontend**: Follow Next.js conventions, use TypeScript strict mode
- **Commits**: Use conventional commits (feat, fix, docs, etc.)

## 📝 License

This project is proprietary software. All rights reserved.

---

## 📞 Support

For issues, questions, or contributions:

- **Issues**: Open an issue on GitHub
- **Documentation**: Check the inline code comments
- **Security**: Report security issues privately

---

<div align="center">

**Built with ❤️ using Next.js, NestJS, and TypeScript**

[⬆ Back to Top](#table-of-contents)

</div>
