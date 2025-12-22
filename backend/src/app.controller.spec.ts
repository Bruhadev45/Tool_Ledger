import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { PrismaService } from './prisma/prisma.service';

describe('AppController', () => {
  let appController: AppController;
  let prismaService: PrismaService;

  const mockPrismaService = {
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
    prismaService = app.get<PrismaService>(PrismaService);
  });

  describe('root', () => {
    it('should return API information', () => {
      const result = appController.getRoot();
      expect(result).toHaveProperty('message', 'ToolLedger API');
      expect(result).toHaveProperty('version', '2.0.0');
      expect(result).toHaveProperty('endpoints');
    });
  });

  describe('health', () => {
    it('should return health status with connected database', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const result = await appController.getHealth();
      expect(result).toHaveProperty('status', 'ok');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('database', 'connected');
      expect(result.databaseError).toBeNull();
    });

    it('should return health status with disconnected database', async () => {
      mockPrismaService.$queryRaw.mockRejectedValue(new Error('Connection failed'));

      const result = await appController.getHealth();
      expect(result).toHaveProperty('status', 'ok');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('database', 'disconnected');
      expect(result.databaseError).toBeTruthy();
    });
  });
});
