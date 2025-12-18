import { IsString, Length } from 'class-validator';

export class VerifyMFADto {
  @IsString()
  userId: string;

  @IsString()
  @Length(6, 8)
  token: string;
}

export class EnableMFADto {
  @IsString()
  @Length(6, 8)
  token: string;
}
