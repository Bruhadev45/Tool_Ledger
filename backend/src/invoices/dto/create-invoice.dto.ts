import {
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  IsArray,
  IsUUID,
  Min,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ParseArrayPipe } from '@nestjs/common';

export class CreateInvoiceDto {
  @IsString()
  invoiceNumber: string;

  @Transform(({ value }) => {
    if (typeof value === 'string') {
      // Remove currency symbols and commas, then parse
      const cleaned = value.replace(/[₹$€£¥,\s]/g, '');
      const num = parseFloat(cleaned);
      return isNaN(num) ? value : num;
    }
    return typeof value === 'number' ? value : parseFloat(value);
  })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Amount must be a valid number with up to 2 decimal places' },
  )
  @Type(() => Number)
  @Min(0.01, { message: 'Amount must be greater than 0' })
  amount: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsString()
  provider: string;

  @IsDateString({}, { message: 'Billing date must be a valid date string in YYYY-MM-DD format' })
  billingDate: string;

  @IsOptional()
  @IsDateString({}, { message: 'Due date must be a valid date string in YYYY-MM-DD format' })
  dueDate?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    // Handle FormData array: can be string, string[], or undefined
    if (Array.isArray(value)) {
      return value.filter((v) => v && typeof v === 'string');
    }
    if (typeof value === 'string' && value.trim()) {
      return [value];
    }
    return undefined;
  })
  @IsArray()
  @IsUUID(undefined, { each: true })
  credentialIds?: string[];
}
