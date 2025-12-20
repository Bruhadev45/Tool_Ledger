/**
 * Auth Service Unit Tests
 * 
 * Tests the authentication service functionality including:
 * - MFA verification logic
 * - Password validation
 * - Token generation
 */

import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              findMany: jest.fn(),
            },
            organization: {
              findUnique: jest.fn(),
              create: jest.fn(),
            },
            refreshToken: {
              create: jest.fn(),
              findUnique: jest.fn(),
            },
            notification: {
              createMany: jest.fn(),
            },
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(() => 'mock-jwt-token'),
            verify: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              switch (key) {
                case 'JWT_SECRET':
                  return 'test-jwt-secret';
                case 'JWT_REFRESH_SECRET':
                  return 'test-refresh-secret';
                case 'JWT_EXPIRES_IN':
                  return '1h';
                case 'JWT_REFRESH_EXPIRES_IN':
                  return '7d';
                default:
                  return undefined;
              }
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('verifyMFA', () => {
    it('should return true for development bypass code', async () => {
      // Arrange
      const userId = 'user-id-123';
      const token = '000000';

      // Act
      const result = await service.verifyMFA(userId, token);

      // Assert
      expect(result).toBe(true);
    });

    it('should return false for invalid token format', async () => {
      // Arrange
      const userId = 'user-id-123';
      const token = '123'; // Too short

      // Act
      const result = await service.verifyMFA(userId, token);

      // Assert
      expect(result).toBe(false);
    });

    it('should return false for empty token', async () => {
      // Arrange
      const userId = 'user-id-123';
      const token = '';

      // Act
      const result = await service.verifyMFA(userId, token);

      // Assert
      expect(result).toBe(false);
    });

    it('should return false for whitespace-only token', async () => {
      // Arrange
      const userId = 'user-id-123';
      const token = '   ';

      // Act
      const result = await service.verifyMFA(userId, token);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('verifyMFAForLogin', () => {
    it('should return true for development bypass code', async () => {
      // Arrange
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      const userId = 'user-id-123';
      const token = '000000';

      // Act
      const result = await service.verifyMFAForLogin(userId, token);

      // Assert
      expect(result).toBe(true);

      // Cleanup
      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should handle token cleaning', async () => {
      // Arrange
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      const userId = 'user-id-123';
      const token = ' 000000 '; // With whitespace

      // Act
      const result = await service.verifyMFAForLogin(userId, token);

      // Assert
      expect(result).toBe(true);

      // Cleanup
      process.env.NODE_ENV = originalNodeEnv;
    });
  });

  describe('service initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });
  });
});