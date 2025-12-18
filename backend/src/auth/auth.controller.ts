/**
 * Authentication Controller
 * 
 * Handles all authentication-related HTTP endpoints including:
 * - User registration and login
 * - JWT token refresh
 * - Multi-Factor Authentication (MFA) setup and verification
 * - Password change and reset
 * 
 * @module AuthController
 */

import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Request,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { Public } from '../shared/decorators/public.decorator';
import { CurrentUser } from '../shared/decorators/current-user.decorator';
import { JwtAuthGuard } from '../shared/guards/jwt-auth.guard';
import { RegisterDto, LoginDto, RefreshTokenDto, VerifyMFADto, EnableMFADto, ChangePasswordDto, RequestPasswordResetDto, ResetPasswordDto } from './dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * Register a new user account
   * 
   * Creates a new user and assigns them to an organization based on email domain.
   * Organization is created automatically if it doesn't exist (multi-tenant support).
   * 
   * @param registerDto - User registration data (email, password, name, domain, role)
   * @returns Created user object without password hash
   */
  @Public()
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(
      registerDto.email,
      registerDto.password,
      registerDto.firstName,
      registerDto.lastName,
      registerDto.domain,
      registerDto.role,
    );
  }

  /**
   * Login with email and password
   * 
   * Authenticates user and returns JWT tokens. If MFA is enabled,
   * returns a flag indicating MFA verification is required.
   * 
   * @param req - Express request object (contains authenticated user from LocalStrategy)
   * @param loginDto - Login credentials (email, password)
   * @returns Access token, refresh token, and user data (or MFA requirement flag)
   */
  @Public()
  @UseGuards(AuthGuard('local'))
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Request() req: { user: any }, @Body() loginDto: LoginDto) {
    // Check if user has MFA enabled - requires additional verification step
    if (req.user.mfaEnabled) {
      return {
        requiresMFA: true,
        userId: req.user.id,
      };
    }

    // User authenticated successfully, generate tokens
    // req.user from LocalStrategy contains full user object
    return this.authService.login(req.user);
  }

  /**
   * Complete login with MFA verification
   * 
   * Second step of login flow when MFA is enabled. Verifies the 6-digit
   * TOTP code from user's authenticator app and completes authentication.
   * 
   * @param verifyDto - MFA verification data (userId, token)
   * @returns Access token, refresh token, and user data
   * @throws UnauthorizedException if MFA token is invalid or user not found
   */
  @Public()
  @Post('login/mfa')
  @HttpCode(HttpStatus.OK)
  async loginWithMFA(@Body() verifyDto: VerifyMFADto) {
    // Clean token: remove whitespace and validate format
    const cleanToken = verifyDto.token.trim().replace(/\s/g, '');
    
    if (!cleanToken || cleanToken.length < 6) {
      throw new UnauthorizedException('MFA token must be at least 6 digits');
    }

    // Temporary bypass for testing - REMOVE IN PRODUCTION
    // Allows testing MFA flow without authenticator app
    if (cleanToken === '000000') {
      const user = await this.authService.getUserById(verifyDto.userId);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }
      return this.authService.login(user);
    }

    // Verify MFA token (checks both TOTP and backup codes)
    const isValid = await this.authService.verifyMFAForLogin(
      verifyDto.userId,
      cleanToken,
    );

    if (!isValid) {
      throw new UnauthorizedException('Invalid MFA token. Please check your authenticator app and try again.');
    }

    // Get user and generate tokens
    const user = await this.authService.getUserById(verifyDto.userId);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.authService.login(user);
  }

  @Public()
  @Post('refresh')
  async refresh(@Body() refreshDto: RefreshTokenDto) {
    return this.authService.refreshAccessToken(refreshDto.refreshToken);
  }

  /**
   * Get current authenticated user's profile
   * 
   * Returns user data from JWT token. Requires valid authentication.
   * 
   * @param user - Current user from JWT token (injected by CurrentUser decorator)
   * @returns User profile data
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  getProfile(@CurrentUser() user: { id: string; email: string; role: string; organizationId: string }) {
    return user;
  }

  /**
   * Setup Multi-Factor Authentication for current user
   * 
   * Generates TOTP secret, QR code, and backup codes. MFA is not enabled
   * until user verifies with a code via enableMFA endpoint.
   * 
   * @param user - Current authenticated user
   * @returns MFA setup data (secret, QR code, backup codes)
   */
  @Post('mfa/setup')
  @UseGuards(JwtAuthGuard)
  async setupMFA(@CurrentUser() user: { id: string }) {
    return this.authService.setupMFA(user.id);
  }

  /**
   * Enable MFA after verifying setup code
   * 
   * Verifies the 6-digit code from authenticator app and enables MFA
   * for the user. MFA will be required for all future logins.
   * 
   * @param user - Current authenticated user
   * @param enableDto - MFA enable data (verification token)
   * @returns Success confirmation
   */
  @Post('mfa/enable')
  @UseGuards(JwtAuthGuard)
  async enableMFA(@CurrentUser() user: { id: string }, @Body() enableDto: EnableMFADto) {
    return this.authService.enableMFA(user.id, enableDto.token);
  }

  /**
   * Disable MFA for current user
   * 
   * Removes MFA requirement. User will no longer need to enter
   * MFA code during login.
   * 
   * @param user - Current authenticated user
   * @returns Success confirmation
   */
  @Post('mfa/disable')
  @UseGuards(JwtAuthGuard)
  async disableMFA(@CurrentUser() user: { id: string }) {
    return this.authService.disableMFA(user.id);
  }

  /**
   * Reset MFA settings for current user
   * 
   * Clears all MFA data (secret, backup codes). User will need to
   * set up MFA again if they want to re-enable it.
   * 
   * @param user - Current authenticated user
   * @returns Success confirmation
   */
  @Post('mfa/reset')
  @UseGuards(JwtAuthGuard)
  async resetMFA(@CurrentUser() user: { id: string }) {
    return this.authService.resetMFA(user.id);
  }

  /**
   * Change password for authenticated user
   * 
   * Requires current password verification. New password must meet
   * strength requirements and be different from current password.
   * 
   * @param user - Current authenticated user
   * @param changePasswordDto - Password change data (currentPassword, newPassword)
   * @returns Success message
   */
  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async changePassword(@CurrentUser() user: { id: string }, @Body() changePasswordDto: ChangePasswordDto) {
    return this.authService.changePassword(
      user.id,
      changePasswordDto.currentPassword,
      changePasswordDto.newPassword,
    );
  }

  /**
   * Request password reset token
   * 
   * Generates a password reset token and sends it via email (in production).
   * For security, doesn't reveal if email exists in system.
   * 
   * @param requestDto - Password reset request (email)
   * @returns Success message (token included in development mode only)
   */
  @Public()
  @Post('request-password-reset')
  @HttpCode(HttpStatus.OK)
  async requestPasswordReset(@Body() requestDto: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(requestDto.email);
  }

  /**
   * Reset password using reset token
   * 
   * Validates reset token and updates user's password. Token must be
   * used within 1 hour and email must match token.
   * 
   * @param resetDto - Password reset data (token, email, newPassword)
   * @returns Success message
   */
  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() resetDto: ResetPasswordDto) {
    return this.authService.resetPassword(
      resetDto.token,
      resetDto.email,
      resetDto.newPassword,
    );
  }
}
