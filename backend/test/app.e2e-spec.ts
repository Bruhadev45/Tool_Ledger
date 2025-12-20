/**
 * End-to-End Tests for ToolLedger API
 * 
 * Tests the complete application flow including:
 * - Health endpoints
 * - Authentication flow
 * - Database integration
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, BadRequestException } from '@nestjs/common';
import * as request from 'supertest';
import helmet from 'helmet';
import { AppModule } from './../src/app.module';

const compression = require('compression');

describe('ToolLedger API (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply the same configuration as main.ts
    app.use(helmet());
    app.use(compression());

    app.enableCors({
      origin: 'http://localhost:3000',
      credentials: true,
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    });

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
        exceptionFactory: (errors) => {
          const messages = errors.map((error) => {
            const constraints = error.constraints || {};
            return Object.values(constraints).join(', ');
          });
          return new BadRequestException({
            message: 'Validation failed',
            errors: messages,
          });
        },
      }),
    );

    // Add root healthcheck route BEFORE setting global prefix
    app.getHttpAdapter().get('/', (req, res) => {
      res.status(200).json({
        status: 'ok',
        message: 'ToolLedger API',
        timestamp: new Date().toISOString(),
      });
    });

    // Set global API prefix
    app.setGlobalPrefix('api');

    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Health Endpoints', () => {
    it('/api (GET) - should return API info', () => {
      return request(app.getHttpServer())
        .get('/api')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('message');
          expect(res.body).toHaveProperty('version');
        });
    });

    it('/api/health (GET) - should return health status', () => {
      return request(app.getHttpServer())
        .get('/api/health')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status', 'ok');
          expect(res.body).toHaveProperty('timestamp');
        });
    });

    it('/ (GET) - should return root health check', () => {
      return request(app.getHttpServer())
        .get('/')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status', 'ok');
          expect(res.body).toHaveProperty('message', 'ToolLedger API');
        });
    });
  });

  describe('Authentication Endpoints', () => {
    it('/api/auth/login (POST) - should reject invalid credentials', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'invalid@example.com',
          password: 'wrongpassword',
        })
        .expect(401);
    });

    it('/api/auth/login (POST) - should reject missing credentials', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({})
        .expect(401); // Missing credentials should return 401 Unauthorized
    });

    it('/api/auth/register (POST) - should create new user', () => {
      const testUser = {
        email: `test-${Date.now()}@example.com`,
        password: 'Test123!@#',
        firstName: 'Test',
        lastName: 'User',
        domain: 'example.com',
      };

      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send(testUser)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('email', testUser.email);
          expect(res.body).toHaveProperty('firstName', testUser.firstName);
          expect(res.body).toHaveProperty('lastName', testUser.lastName);
          expect(res.body).not.toHaveProperty('passwordHash');
        });
    });

    it('/api/auth/register (POST) - should reject duplicate email', async () => {
      const testUser = {
        email: `duplicate-${Date.now()}@example.com`,
        password: 'Test123!@#',
        firstName: 'Test',
        lastName: 'User',
        domain: 'example.com',
      };

      // Create user first time
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(testUser)
        .expect(201);

      // Try to create same user again
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send(testUser)
        .expect(400);
    });

    it('/api/auth/me (GET) - should require authentication', () => {
      return request(app.getHttpServer())
        .get('/api/auth/me')
        .expect(401);
    });

    it('/api/auth/me (GET) - should return user profile with valid token', async () => {
      // First register a user
      const testUser = {
        email: `profile-test-${Date.now()}@example.com`,
        password: 'Test123!@#',
        firstName: 'Profile',
        lastName: 'Test',
        domain: 'example.com',
        role: 'ADMIN', // Make admin to avoid approval requirement
      };

      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(testUser)
        .expect(201);

      // Login to get token
      const loginResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      const { access_token } = loginResponse.body;

      // Use token to access profile
      return request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${access_token}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('email', testUser.email);
          expect(res.body).toHaveProperty('role');
        });
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent endpoints', () => {
      return request(app.getHttpServer())
        .get('/api/non-existent-endpoint')
        .expect(404);
    });

    it('should handle malformed JSON', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send('invalid json')
        .set('Content-Type', 'application/json')
        .expect(400);
    });
  });
});