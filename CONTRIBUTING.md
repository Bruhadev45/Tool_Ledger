# Contributing to ToolLedger

Thank you for your interest in contributing to ToolLedger! This document provides guidelines and instructions for contributing.

## Getting Started

1. **Fork the repository** and clone your fork
2. **Create a branch** for your feature or bugfix: `git checkout -b feature/your-feature-name`
3. **Make your changes** following our coding standards
4. **Test your changes** thoroughly
5. **Commit your changes** with clear, descriptive commit messages
6. **Push to your fork** and create a Pull Request

## Development Setup

See the [README.md](README.md) for detailed setup instructions.

### Quick Start

```bash
# Clone the repository
git clone <repository-url>
cd Tool_Ledger

# Set up backend
cd backend
cp .env.example .env
# Edit .env with your configuration
npm install
npx prisma generate
npx prisma migrate dev

# Set up frontend
cd ../frontend
cp .env.example .env.local
# Edit .env.local with your configuration
npm install

# Start development servers
# Terminal 1: Backend
cd backend && npm run start:dev

# Terminal 2: Frontend
cd frontend && npm run dev
```

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Follow existing code style and patterns
- Use meaningful variable and function names
- Add JSDoc comments for public functions and classes
- Use interfaces/types for data structures

### Code Style

- **Backend**: Follow NestJS conventions and use ESLint/Prettier
- **Frontend**: Follow Next.js conventions and use ESLint/Prettier
- Run `npm run lint` before committing
- Use 2 spaces for indentation
- Use single quotes for strings (TypeScript/JavaScript)

### Commit Messages

Use clear, descriptive commit messages:

```
feat: Add user profile editing functionality
fix: Resolve issue with invoice PDF upload
docs: Update API documentation
refactor: Simplify credential encryption logic
test: Add unit tests for auth service
```

## Pull Request Process

1. **Update documentation** if you've changed functionality
2. **Add tests** for new features or bug fixes
3. **Ensure all tests pass** and linting is clean
4. **Update CHANGELOG.md** if applicable
5. **Request review** from maintainers

## Testing

- Write tests for new features
- Ensure existing tests still pass
- Test edge cases and error scenarios
- Test both frontend and backend changes

## Security

- Never commit sensitive data (API keys, passwords, etc.)
- Use environment variables for configuration
- Follow security best practices
- Report security vulnerabilities privately

## Questions?

Feel free to open an issue for questions or clarifications.

Thank you for contributing! 🎉
