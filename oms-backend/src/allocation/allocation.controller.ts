import { Roles } from '../auth/roles.decorator';
import { DISTRIBUTOR_SIDE_ROLES } from '../auth/roles.constants';
import { Body, Controller, Post } from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import { AllocationService } from './allocation.service';

class AllocateOrderDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsString()
  @IsNotEmpty()
  warehouseId: string;
}

@Roles(...DISTRIBUTOR_SIDE_ROLES)
@Controller('allocation')
export class AllocationController {
  constructor(private readonly allocationService: AllocationService) {}

  /**
   * Triggers the Order Allocation Agent for a given order at a given warehouse.
   * Both Web and Mobile (when online) call this same endpoint — this is the
   * "same logic" guarantee: the FEFO decision is made in exactly one place.
   */
  @Post('run')
  async run(@Body() dto: AllocateOrderDto) {
    return this.allocationService.allocateOrder(dto.orderId, dto.warehouseId);
  }
}
