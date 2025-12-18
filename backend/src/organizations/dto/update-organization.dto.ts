import { IsString, IsOptional, Matches } from 'class-validator';

export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.[a-zA-Z]{2,}$/, {
    message: 'Domain must be a valid domain name (e.g., example.com)',
  })
  domain?: string;
}
