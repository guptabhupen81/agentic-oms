import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { OrderSourceType } from '@prisma/client';

export class CreateOrderLineDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsNumber()
  @IsPositive()
  orderedQty: number;

  /** Per-line discount, applied before tax. Ignored (treated as billed-zero)
   * when isFreeItem is true. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercent?: number;

  /** Billed at zero regardless of discountPercent — still allocated, picked,
   * and shipped normally, just not charged for. */
  @IsOptional()
  @IsBoolean()
  isFreeItem?: boolean;
}

export class CreateOrderDto {
  // Client (mobile/web) generates this so an order created offline keeps a
  // stable identity even before the server has seen it — required for
  // idempotent upload-on-sync (retry-safe: re-uploading the same clientOrderId
  // never creates a duplicate order).
  @IsString()
  @IsNotEmpty()
  clientOrderId: string;

  @IsString()
  @IsNotEmpty()
  retailerId: string;

  @IsString()
  @IsNotEmpty()
  createdById: string;

  @IsEnum(OrderSourceType)
  sourceType: OrderSourceType;

  /** Bill-level discount, applied after per-line discounts, before tax. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  overallDiscountPercent?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderLineDto)
  lines: CreateOrderLineDto[];
}
