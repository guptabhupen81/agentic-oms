import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ProductService } from './product.service';

@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get('hierarchy')
  getHierarchy() {
    return this.productService.getHierarchyTree();
  }

  /** activeOnly=false shows inactive products too — used by the Product master
   * management screen; the default (active-only) is what mobile/order-entry use. */
  @Get()
  list(@Query('activeOnly') activeOnly?: string, @Query('search') search?: string) {
    return this.productService.listProducts(activeOnly !== 'false', search);
  }

  @Get('sync')
  sync(@Query('since') since?: string) {
    const sinceDate = since ? new Date(since) : new Date(0);
    return this.productService.listProductsUpdatedSince(sinceDate);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productService.findById(id);
  }

  @Post()
  create(
    @Body()
    body: {
      sku: string;
      name: string;
      hierarchyNodeId: string;
      manufacturerId: string;
      uom: string;
      hsnCode?: string;
      gstRatePercent?: number;
      defaultUnitPrice?: number;
      minOrderQty?: number;
      maxOrderQty?: number;
      primaryMoq?: number;
      caseQty?: number;
      unitWeightKg?: number;
      unitVolumeCbm?: number;
    },
  ) {
    return this.productService.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.productService.update(id, body);
  }

  @Post(':id/toggle-active')
  toggleActive(@Param('id') id: string, @Body() body: { isActive: boolean }) {
    return this.productService.setActive(id, body.isActive);
  }
}
