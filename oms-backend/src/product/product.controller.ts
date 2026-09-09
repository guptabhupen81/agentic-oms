import { Controller, Get, Query } from '@nestjs/common';
import { ProductService } from './product.service';

@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get('hierarchy')
  getHierarchy() {
    return this.productService.getHierarchyTree();
  }

  @Get()
  list() {
    return this.productService.listProducts();
  }

  @Get('sync')
  sync(@Query('since') since?: string) {
    const sinceDate = since ? new Date(since) : new Date(0);
    return this.productService.listProductsUpdatedSince(sinceDate);
  }
}
