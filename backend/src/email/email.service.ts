import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

/**
 * Email Service
 * 
 * Handles sending email notifications via Gmail SMTP.
 * Used primarily for notifying users when credentials are shared with them.
 * 
 * Configuration:
 * - SMTP_USER: Gmail address
 * - SMTP_PASSWORD: Gmail App Password (not regular password)
 * - SMTP_FROM: Sender email address
 * - FRONTEND_URL: Base URL for email links
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    // Get SMTP credentials from environment variables
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPassword = this.configService.get<string>('SMTP_PASSWORD');

    // If SMTP is not configured, create a dummy transporter that fails gracefully
    // This allows the app to work without email functionality
    if (!smtpUser || !smtpPassword) {
      this.logger.warn(
        'SMTP credentials not configured. Email notifications will be disabled. Set SMTP_USER and SMTP_PASSWORD environment variables to enable.',
      );
      this.transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: 'dummy',
          pass: 'dummy',
        },
      });
    } else {
      // Initialize Gmail SMTP transporter with provided credentials
      // Port 587 uses TLS, port 465 uses SSL
      this.transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: smtpUser,
          pass: smtpPassword, // Must be Gmail App Password, not regular password
        },
      });
    }
  }

  /**
   * Send email notification when credentials are shared with a user
   * 
   * @param recipientEmail - Email address of the user receiving the credential
   * @param recipientName - Full name of the recipient
   * @param credentialName - Name of the credential being shared
   * @param sharedBy - Name of the user who shared the credential
   * @param permission - Permission level (View Only or Edit)
   * 
   * @returns Promise that resolves when email is sent (or skipped if SMTP not configured)
   * 
   * Note: This method does not throw errors. If email sending fails, it's logged but
   * doesn't break the credential sharing flow.
   */
  async sendCredentialSharedNotification(
    recipientEmail: string,
    recipientName: string,
    credentialName: string,
    sharedBy: string,
    permission: string,
  ): Promise<void> {
    // Verify SMTP is configured before attempting to send
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPassword = this.configService.get<string>('SMTP_PASSWORD');

    if (!smtpUser || !smtpPassword) {
      this.logger.warn(
        'Email notification skipped: SMTP not configured. Set SMTP_USER and SMTP_PASSWORD to enable email notifications.',
      );
      return;
    }
    const subject = `Tool Ledger: Credentials Shared`;
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              margin: 0;
              padding: 0;
              background-color: #f5f5f5;
            }
            .container {
              max-width: 600px;
              margin: 20px auto;
              padding: 0;
              background-color: #ffffff;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .header {
              background-color: #2563eb;
              color: white;
              padding: 30px 20px;
              border-radius: 8px 8px 0 0;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
              font-weight: 600;
            }
            .content {
              padding: 30px 20px;
            }
            .message {
              font-size: 16px;
              color: #333;
              margin-bottom: 20px;
            }
            .credential-name {
              font-size: 18px;
              font-weight: 600;
              color: #2563eb;
              margin: 15px 0;
            }
            .button-container {
              text-align: center;
              margin: 30px 0;
            }
            .button {
              display: inline-block;
              padding: 14px 32px;
              background-color: #2563eb;
              color: white;
              text-decoration: none;
              border-radius: 6px;
              font-weight: 600;
              font-size: 16px;
            }
            .button:hover {
              background-color: #1d4ed8;
            }
            .footer {
              padding: 20px;
              background-color: #f9fafb;
              border-top: 1px solid #e5e7eb;
              border-radius: 0 0 8px 8px;
              font-size: 12px;
              color: #6b7280;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Tool Ledger</h1>
            </div>
            <div class="content">
              <div class="message">
                <p>Hello ${recipientName},</p>
                <p><strong>Tool Ledger</strong> shared credentials in your dashboard.</p>
              </div>
              <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
                <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280; font-weight: 600;">TOOL NAME:</p>
                <div class="credential-name">
                  ${credentialName}
                </div>
              </div>
              <p style="color: #6b7280; font-size: 14px;">
                Shared by: <strong>${sharedBy}</strong> | Permission: <strong>${permission}</strong>
              </p>
              <div class="button-container">
                <a href="${this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000')}/credentials" class="button">Check Credentials</a>
              </div>
            </div>
            <div class="footer">
              <p>This is an automated notification from Tool Ledger.</p>
              <p>If you did not expect this notification, please contact your administrator.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
Tool Ledger: Credentials Shared

Hello ${recipientName},

Tool Ledger shared credentials in your dashboard.

TOOL NAME: ${credentialName}

Shared by: ${sharedBy}
Permission: ${permission}

Check credentials: ${this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000')}/credentials

This is an automated notification from Tool Ledger.
If you did not expect this notification, please contact your administrator.
    `;

    // Send email with both HTML and plain text versions for better compatibility
    try {
      await this.transporter.sendMail({
        from: this.configService.get<string>('SMTP_FROM', this.configService.get<string>('SMTP_USER')),
        to: recipientEmail,
        subject,
        text, // Plain text version for email clients that don't support HTML
        html, // HTML version with styling
      });
      this.logger.log(`Credential shared notification sent to ${recipientEmail}`);
    } catch (error) {
      // Log error but don't throw - credential sharing should succeed even if email fails
      this.logger.error(`Failed to send email to ${recipientEmail}:`, error);
    }
  }

  /**
   * Test SMTP connection configuration
   * 
   * Verifies that SMTP credentials are correct and can connect to Gmail servers.
   * Used by the test endpoint to verify email service setup.
   * 
   * @returns Promise<boolean> - true if connection successful, false otherwise
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      this.logger.log('SMTP connection verified');
      return true;
    } catch (error) {
      this.logger.error('SMTP connection failed:', error);
      return false;
    }
  }
}
