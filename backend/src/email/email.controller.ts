import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { EmailService } from './email.service';
import { JwtAuthGuard } from '../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../shared/guards/roles.guard';
import { Roles } from '../shared/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('email')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmailController {
  constructor(private emailService: EmailService) {}

  /**
   * Test SMTP connection
   * Only accessible by admins
   */
  @Get('test-connection')
  @Roles(UserRole.ADMIN)
  async testConnection() {
    const isConnected = await this.emailService.testConnection();
    return {
      success: isConnected,
      message: isConnected
        ? 'SMTP connection successful! Email service is working.'
        : 'SMTP connection failed. Check your configuration.',
    };
  }

  /**
   * Send a test email
   * Only accessible by admins
   */
  @Post('test-send')
  @Roles(UserRole.ADMIN)
  async sendTestEmail(@Body() body: { email: string }) {
    if (!body.email) {
      return {
        success: false,
        message: 'Email address is required',
      };
    }

    try {
      await this.emailService.sendCredentialSharedNotification(
        body.email,
        'Test User',
        'Test Credential',
        'System Administrator',
        'View Only',
      );

      return {
        success: true,
        message: `Test email sent successfully to ${body.email}. Please check your inbox.`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to send test email: ${error.message}`,
      };
    }
  }
}
