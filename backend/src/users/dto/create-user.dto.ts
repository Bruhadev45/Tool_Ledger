/**
 * Create User DTO
 * 
 * Data transfer object for creating a new user.
 * Includes validation for email, password strength, and role assignment.
 */

import { IsString, IsEmail, IsEnum, IsOptional, MinLength, Matches } from 'class-validator';
import { UserRole } from '@prisma/client';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  password: string;

  @IsString()
  @MinLength(1)
  @Matches(/^[a-zA-Z\s]+$/, {
    message: 'First name must contain only letters and spaces',
  })
  firstName: string;

  @IsString()
  @MinLength(1)
  @Matches(/^[a-zA-Z\s]+$/, {
    message: 'Last name must contain only letters and spaces',
  })
  lastName: string;

  @IsEnum(UserRole)
  role: UserRole;

  @IsString()
  @IsOptional()
  teamId?: string;
}
