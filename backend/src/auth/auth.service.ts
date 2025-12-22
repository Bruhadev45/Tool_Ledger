/**
 * Authentication Service
 *
 * Handles user authentication, registration, password management, and MFA operations.
 * Provides secure authentication using JWT tokens, bcrypt password hashing, and TOTP-based MFA.
 *
 * @module AuthService
 */

import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, UserApprovalStatus } from '@prisma/client';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  /**
   * Validates user credentials during login
   *
   * Checks if user exists, is active, and password matches.
   * Returns user data without password hash for security.
   *
   * @param email - User's email address
   * @param password - User's plain text password
   * @returns User object without password hash
   * @throws UnauthorizedException if credentials are invalid or user is inactive
   */
  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { organization: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user registration is approved
    if (user.approvalStatus !== UserApprovalStatus.APPROVED) {
      if (user.approvalStatus === UserApprovalStatus.PENDING_APPROVAL) {
        throw new UnauthorizedException('Your account is pending admin approval. Please contact your administrator.');
      } else if (user.approvalStatus === UserApprovalStatus.REJECTED) {
        throw new UnauthorizedException('Your registration has been rejected. Please contact your administrator.');
      }
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // For ADMIN users on first login: suggest MFA setup but don't require it
    // Check if this is a fresh admin (no MFA, no lastLoginAt) - allow login with suggestion
    if (user.role === UserRole.ADMIN && !user.mfaEnabled && !user.lastLoginAt) {
      // Mark that they've logged in once (so they can set up MFA if they want)
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
      // Return user with a flag indicating they can set up MFA (but it's optional)
      const { passwordHash, ...result } = user;
      return { ...result, requiresMfaSetup: true };
    }

    const { passwordHash, ...result } = user;
    return result;
  }

  /**
   * Generates JWT tokens and returns user data after successful authentication
   *
   * Creates access token (short-lived) and refresh token (long-lived) for the user.
   * Access token contains user identity and role information.
   * 
   * MFA is optional for all users including admins. If MFA is enabled by the user,
   * it will be required during login. Otherwise, users can login without MFA.
   *
   * @param user - Authenticated user object
   * @returns Object containing access_token, refresh_token, and user data
   */
  async login(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    organizationId: string;
    mfaEnabled: boolean;
    requiresMfaSetup?: boolean;
  }) {
    // Create JWT payload with user information
    const payload = {
      email: user.email,
      sub: user.id,
      role: user.role,
      organizationId: user.organizationId,
    };

    // For first-time admin login, suggest MFA setup but don't require it
    const loginResponse = {
      access_token: this.jwtService.sign(payload),
      refresh_token: await this.generateRefreshToken(user.id),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        organizationId: user.organizationId,
        mfaEnabled: user.mfaEnabled,
      },
    };

    // If this is first-time admin login, suggest MFA setup
    if (user.requiresMfaSetup) {
      return {
        ...loginResponse,
        requiresMfaSetup: true,
        message: 'For enhanced security, we recommend setting up MFA in your account settings.',
      };
    }

    return loginResponse;
  }

  /**
   * Registers a new user and creates/assigns to organization
   *
   * Multi-tenant registration: Users are automatically assigned to organizations
   * based on their email domain. If organization doesn't exist, it's created.
   *
   * @param email - User's email address (used for domain extraction)
   * @param password - Plain text password (will be hashed)
   * @param firstName - User's first name
   * @param lastName - User's last name
   * @param domain - Optional organization domain (defaults to email domain)
   * @param role - User role (defaults to USER)
   * @returns User object without password hash
   * @throws BadRequestException if user already exists
   */
  async register(
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    domain: string,
    role: UserRole = UserRole.USER,
  ) {
    // Extract domain from email or use provided domain for organization assignment
    const emailDomain = email.split('@')[1];
    const orgDomain = domain || emailDomain;

    // Find existing organization or create new one (multi-tenant support)
    let organization = await this.prisma.organization.findUnique({
      where: { domain: orgDomain },
    });

    if (!organization) {
      // Create new organization if it doesn't exist
      organization = await this.prisma.organization.create({
        data: {
          name: orgDomain.split('.')[0], // Use domain prefix as organization name
          domain: orgDomain,
        },
      });
    }

    // Check if user already exists to prevent duplicate accounts
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new BadRequestException('User already exists');
    }

    // Hash password using bcrypt with salt rounds of 10
    const passwordHash = await bcrypt.hash(password, 10);

    // Create new user account with PENDING_APPROVAL status
    // Admins and Accountants are auto-approved, regular users need approval
    const autoApprove = role === UserRole.ADMIN || role === UserRole.ACCOUNTANT;
    
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName,
        role,
        organizationId: organization.id,
        approvalStatus: autoApprove ? UserApprovalStatus.APPROVED : UserApprovalStatus.PENDING_APPROVAL,
      },
      include: { organization: true },
    });

    // If user needs approval, notify admins
    if (!autoApprove) {
      // Find all admins in the organization to notify them
      const admins = await this.prisma.user.findMany({
        where: {
          organizationId: organization.id,
          role: UserRole.ADMIN,
          isActive: true,
        },
      });

      // Create notifications for admins
      await this.prisma.notification.createMany({
        data: admins.map((admin) => ({
          userId: admin.id,
          type: 'user_registration',
          title: 'New User Registration',
          message: `${user.firstName} ${user.lastName} (${user.email}) has requested access. Please review and approve.`,
          read: false,
          metadata: JSON.stringify({ userId: user.id, email: user.email }),
        })),
      });
    }

    // Remove password hash from response for security
    const { passwordHash: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Generates a refresh token for long-term session management
   *
   * Refresh tokens are stored in database and used to obtain new access tokens
   * without requiring user to login again. Default expiry is 7 days.
   *
   * @param userId - ID of the user requesting refresh token
   * @returns JWT refresh token string
   */
  async generateRefreshToken(userId: string): Promise<string> {
    // Calculate expiration date (7 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Generate JWT refresh token with user ID and type identifier
    const token = this.jwtService.sign(
      { sub: userId, type: 'refresh' },
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d',
      },
    );

    // Store refresh token in database for validation and revocation
    await this.prisma.refreshToken.create({
      data: {
        token,
        userId,
        expiresAt,
      },
    });

    return token;
  }

  /**
   * Refreshes an expired access token using a valid refresh token
   *
   * Validates the refresh token, checks if it's not expired, and generates
   * a new access token. This allows users to stay logged in without re-entering credentials.
   *
   * @param refreshToken - JWT refresh token from previous login
   * @returns New access token
   * @throws UnauthorizedException if refresh token is invalid or expired
   */
  async refreshAccessToken(refreshToken: string) {
    try {
      // Verify refresh token signature and expiration
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      // Ensure token is actually a refresh token (not access token)
      if (payload.type !== 'refresh') {
        this.logger.warn('Refresh token validation failed: Invalid token type', { userId: payload.sub });
        throw new UnauthorizedException('Invalid token type');
      }

      // Verify token exists in database and hasn't been revoked
      const tokenRecord = await this.prisma.refreshToken.findUnique({
        where: { token: refreshToken },
        include: { user: true },
      });

      // Check if token exists
      if (!tokenRecord) {
        this.logger.warn('Refresh token validation failed: Token not found in database', { userId: payload.sub });
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Check if token hasn't expired
      if (tokenRecord.expiresAt < new Date()) {
        this.logger.warn('Refresh token validation failed: Token expired', { 
          userId: payload.sub,
          expiresAt: tokenRecord.expiresAt,
          now: new Date()
        });
        throw new UnauthorizedException('Token expired');
      }

      // Check if user is still active
      if (!tokenRecord.user.isActive) {
        this.logger.warn('Refresh token validation failed: User inactive', { userId: payload.sub });
        throw new UnauthorizedException('User account is inactive');
      }

      // Generate new access token with current user data
      const user = tokenRecord.user;
      const newPayload = {
        email: user.email,
        sub: user.id,
        role: user.role,
        organizationId: user.organizationId,
      };

      return {
        access_token: this.jwtService.sign(newPayload),
      };
    } catch (error) {
      // Log the actual error for debugging
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error('Refresh token validation error', error instanceof Error ? error.stack : String(error));
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Sets up Multi-Factor Authentication (MFA) for a user
   *
   * Generates a TOTP secret, backup codes, and QR code for authenticator apps.
   * MFA is not enabled until user verifies with a code (via enableMFA).
   *
   * @param userId - ID of the user setting up MFA
   * @returns Object containing secret, QR code URL, and backup codes
   * @throws BadRequestException if user not found
   */
  async setupMFA(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Generate TOTP secret for authenticator app
    const secret = speakeasy.generateSecret({
      name: `${user.email} (ToolLedger)`,
    });

    // Generate 10 backup codes for account recovery
    // These can be used if user loses access to authenticator device
    const backupCodes = Array.from({ length: 10 }, () =>
      Math.random().toString(36).substring(2, 10).toUpperCase(),
    );

    // Store secret and backup codes temporarily
    // MFA won't be enabled until user verifies with a code
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        mfaSecret: secret.base32, // Store in base32 format for TOTP verification
        mfaBackupCodes: JSON.stringify(backupCodes),
      },
    });

    // Generate QR code for easy setup in authenticator apps
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    return {
      secret: secret.base32,
      qrCodeUrl,
      backupCodes,
    };
  }

  /**
   * Verifies a TOTP MFA token for a user
   *
   * Validates the 6-digit code from user's authenticator app against stored secret.
   * Uses a time window of 3 steps (90 seconds) to account for clock drift.
   *
   * @param userId - ID of the user verifying MFA
   * @param token - 6-digit TOTP code from authenticator app
   * @returns True if token is valid, false otherwise
   */
  async verifyMFA(userId: string, token: string): Promise<boolean> {
    // Clean token: remove whitespace and validate length
    const cleanToken = token.trim().replace(/\s/g, '');
    if (!cleanToken || cleanToken.length < 6) {
      return false;
    }

    // Get user and verify MFA secret exists
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.mfaSecret) {
      return false;
    }

    try {
      // Verify TOTP code against stored secret
      // Window of 3 allows for clock drift (current time ± 90 seconds)
      const verified = speakeasy.totp.verify({
        secret: user.mfaSecret,
        encoding: 'base32',
        token: cleanToken,
        window: 3, // Allow 3 time steps tolerance (±90 seconds)
      });

      return !!verified;
    } catch (error) {
      // Log error but don't expose details to prevent timing attacks
      if (process.env.NODE_ENV === 'development') {
        this.logger.error(
          'MFA verification error',
          error instanceof Error ? error.stack : String(error),
        );
      }
      return false;
    }
  }

  async enableMFA(userId: string, token: string) {
    // Clean token
    const cleanToken = token.trim().replace(/\s/g, '');

    // Development bypass: Allow "000000" for testing MFA setup
    // NOTE: This should be disabled in production or controlled via environment variable
    if (process.env.NODE_ENV === 'development' && cleanToken === '000000') {
      this.logger.warn(
        '⚠️  Using development MFA bypass code. This should not be used in production.',
      );
      // Enable MFA without verification
      await this.prisma.user.update({
        where: { id: userId },
        data: { mfaEnabled: true },
      });
      return { success: true };
    }

    const isValid = await this.verifyMFA(userId, cleanToken);
    if (!isValid) {
      throw new BadRequestException('Invalid MFA token');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true },
    });

    return { success: true };
  }

  async disableMFA(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
        mfaBackupCodes: null,
      },
    });

    return { success: true, message: 'MFA disabled successfully' };
  }

  async resetMFA(userId: string) {
    // Clear all MFA data completely
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
        mfaBackupCodes: null,
      },
    });

    return { success: true, message: 'MFA reset successfully. You can set it up again.' };
  }

  async verifyMFAForLogin(userId: string, token: string): Promise<boolean> {
    // Clean token
    const cleanToken = token.trim().replace(/\s/g, '');

    // Development bypass: Allow "000000" for testing MFA verification
    // NOTE: This should be disabled in production or controlled via environment variable
    if (process.env.NODE_ENV === 'development' && cleanToken === '000000') {
      this.logger.warn(
        '⚠️  Using development MFA bypass code. This should not be used in production.',
      );
      return true;
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.mfaEnabled) {
      return false;
    }

    // Check backup codes first
    if (user.mfaBackupCodes) {
      try {
        const backupCodes = JSON.parse(user.mfaBackupCodes);
        const codeIndex = backupCodes.indexOf(cleanToken);
        if (codeIndex !== -1) {
          // Remove used backup code
          backupCodes.splice(codeIndex, 1);
          await this.prisma.user.update({
            where: { id: userId },
            data: { mfaBackupCodes: JSON.stringify(backupCodes) },
          });
          return true;
        }
      } catch (error) {
        this.logger.error(
          'Error parsing backup codes',
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    // Verify TOTP
    return this.verifyMFA(userId, cleanToken);
  }

  async getUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { organization: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Changes user's password after verifying current password
   *
   * Requires current password verification for security. Ensures new password
   * is different from current password. Password strength is validated by DTO.
   *
   * @param userId - ID of the user changing password
   * @param currentPassword - User's current password for verification
   * @param newPassword - New password to set (must meet strength requirements)
   * @returns Success message
   * @throws UnauthorizedException if current password is incorrect
   * @throws BadRequestException if new password is same as current
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    // Get user from database
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Verify current password matches stored hash
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Prevent reusing the same password
    const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash);
    if (isSamePassword) {
      throw new BadRequestException('New password must be different from current password');
    }

    // Hash new password with bcrypt (salt rounds: 10)
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update user's password in database
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    return { message: 'Password changed successfully' };
  }

  /**
   * Requests a password reset token for a user
   *
   * Generates a time-limited JWT token (1 hour expiry) for password reset.
   * For security, doesn't reveal if email exists in system.
   * In production, token should be sent via email (not returned in response).
   *
   * @param email - Email address of user requesting password reset
   * @returns Success message (and token in development mode only)
   */
  async requestPasswordReset(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    // Security best practice: Don't reveal if user exists to prevent email enumeration
    if (!user) {
      return {
        message: 'If an account with that email exists, a password reset link has been sent.',
      };
    }

    // Generate JWT reset token with 1-hour expiration
    // Contains user ID and email for verification
    const resetToken = this.jwtService.sign(
      { email, userId: user.id, type: 'password-reset' },
      { expiresIn: '1h' },
    );

    // NOTE: In production, implement email service to send reset link
    // Email should contain: /reset-password?token={resetToken}&email={email}
    // For now, token is returned in development mode for testing
    if (process.env.NODE_ENV === 'development') {
      this.logger.log(`Password reset token for ${email}: ${resetToken}`);
      this.logger.warn(
        '⚠️  Password reset token returned in response. In production, send via email.',
      );
    }

    return {
      message: 'If an account with that email exists, a password reset link has been sent.',
      // Only return token in development - remove in production
      resetToken: process.env.NODE_ENV === 'development' ? resetToken : undefined,
    };
  }

  /**
   * Resets user password using a valid reset token
   *
   * Verifies the reset token (JWT), checks expiration and email match,
   * then updates the user's password. Token must be used within 1 hour.
   *
   * @param token - JWT reset token from requestPasswordReset
   * @param email - Email address of user (must match token)
   * @param newPassword - New password to set (validated by DTO)
   * @returns Success message
   * @throws UnauthorizedException if token is invalid, expired, or email doesn't match
   */
  async resetPassword(token: string, email: string, newPassword: string) {
    try {
      // Verify JWT token signature and expiration
      const payload = this.jwtService.verify(token);

      // Ensure token is a password-reset token and email matches
      if (payload.type !== 'password-reset' || payload.email !== email) {
        throw new UnauthorizedException('Invalid reset token');
      }

      // Get user and verify email matches token
      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId },
      });

      if (!user || user.email !== email) {
        throw new UnauthorizedException('Invalid reset token');
      }

      // Hash new password with bcrypt
      const newPasswordHash = await bcrypt.hash(newPassword, 10);

      // Update user's password in database
      await this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newPasswordHash },
      });

      return { message: 'Password reset successfully' };
    } catch (error) {
      // Handle JWT-specific errors with user-friendly messages
      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Invalid or expired reset token');
      }
      throw error;
    }
  }
}
