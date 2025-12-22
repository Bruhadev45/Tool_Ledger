import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';
import { ConfigService } from '@nestjs/config';

describe('PrismaService', () => {
  let service: PrismaService;

  const mockConfigService = {
    get: jest.fn().mockReturnValue('postgresql://test'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should extend PrismaClient', () => {
    expect(service).toBeInstanceOf(PrismaService);
  });
});
