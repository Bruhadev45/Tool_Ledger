import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../shared/guards/roles.guard';
import { CurrentUser } from '../shared/decorators/current-user.decorator';
import { AiAssistantService } from './ai-assistant.service';

@Controller('ai-assistant')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AiAssistantController {
  constructor(private aiAssistantService: AiAssistantService) {}

  @Get('insights')
  async getInsights(@CurrentUser() user: any) {
    return this.aiAssistantService.getInsights(
      user.id,
      user.organizationId,
      user.role,
    );
  }

  @Post('ask')
  async askQuestion(
    @CurrentUser() user: any,
    @Body() body: { question: string },
  ) {
    if (!body.question || !body.question.trim()) {
      return { error: 'Question is required' };
    }

    const answer = await this.aiAssistantService.answerQuestion(
      user.id,
      user.organizationId,
      user.role,
      body.question.trim(),
    );

    return { answer };
  }
}
