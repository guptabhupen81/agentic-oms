import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
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

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderLineDto)
  lines: CreateOrderLineDto[];
}
