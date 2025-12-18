import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class CreateOrganizationDto {
  @IsString()
  @IsNotEmpty({ message: 'Organization name is required' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'Domain is required' })
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.[a-zA-Z]{2,}$/, {
    message: 'Domain must be a valid domain name (e.g., example.com)',
  })
  domain: string;
}
