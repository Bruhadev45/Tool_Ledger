import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { JwtAuthGuard } from '../shared/guards/jwt-auth.guard';
import { CurrentUser } from '../shared/decorators/current-user.decorator';
import { CreateCommentDto } from './dto';
import { UserPayload } from '../shared/types/common.types';

@Controller('comments')
@UseGuards(JwtAuthGuard)
export class CommentsController {
  constructor(private commentsService: CommentsService) {}

  @Post()
  create(@CurrentUser() user: UserPayload, @Body() createDto: CreateCommentDto) {
    return this.commentsService.create(user.id, user.organizationId, createDto);
  }

  @Get()
  findAll(
    @CurrentUser() user: UserPayload,
    @Query('credentialId') credentialId?: string,
    @Query('invoiceId') invoiceId?: string,
  ) {
    return this.commentsService.findAll(user.organizationId, credentialId, invoiceId);
  }
}
