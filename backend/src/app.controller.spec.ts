/**
 * App Controller Unit Tests
 * 
 * Tests the main application controller endpoints including:
 * - Health check endpoint
 * - Root endpoint
 */

import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return API information', () => {
      const result = appController.getRoot();
      
      expect(result).toHaveProperty('message', 'ToolLedger API');
      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('endpoints');
    });
  });

  describe('health', () => {
    it('should return health status', () => {
      const result = appController.getHealth();
      
      expect(result).toHaveProperty('status', 'ok');
      expect(result).toHaveProperty('timestamp');
    });
  });
});