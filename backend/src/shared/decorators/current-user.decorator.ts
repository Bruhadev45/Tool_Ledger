import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserPayload } from '../types/common.types';

/**
 * Decorator to extract the current authenticated user from the request
 *
 * Usage: @CurrentUser() user: UserPayload
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): UserPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as UserPayload;
  },
);
