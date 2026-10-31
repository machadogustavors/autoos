import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { AdjustProductDto } from './dto/adjust-product.dto';
import { ListProductsQueryDto } from './dto/list-products-query.dto';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // listProducts (RF-19)
  @Get()
  findMany(@Query() query: ListProductsQueryDto) {
    return this.productsService.findMany(query.q, query.after, query.limit);
  }

  // postProduct (RF-20)
  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  // deleteProduct (RF-21)
  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }

  // patchProduct (RF-20)
  @Patch(':id')
  adjust(@Param('id') id: string, @Body() dto: AdjustProductDto) {
    return this.productsService.adjustQuantity(id, dto);
  }
}
