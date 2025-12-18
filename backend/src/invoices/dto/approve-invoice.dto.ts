import { IsOptional, IsString } from 'class-validator';

export class ApproveInvoiceDto {
  @IsOptional()
  @IsString()
  notes?: string;
}
