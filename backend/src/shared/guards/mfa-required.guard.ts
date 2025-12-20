import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole } from '@prisma/client';

/**
 * MFA Required Guard
 * 
 * Ensures that ADMIN users have MFA enabled before accessing protected routes.
 * This guard should be applied to admin-only routes to enforce MFA requirement.
 */
@Injectable()
export class MfaRequiredGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    // Only check MFA for ADMIN users
    if (user.role === UserRole.ADMIN) {
      // Fetch the latest user data to check MFA status
      const userData = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: { mfaEnabled: true, role: true },
      });

      if (!userData) {
        throw new ForbiddenException('User not found');
      }

      if (!userData.mfaEnabled) {
        throw new ForbiddenException(
          'Multi-factor authentication (MFA) is required for admin accounts. Please enable MFA in your account settings.',
        );
      }
    }

    return true;
  }
}
