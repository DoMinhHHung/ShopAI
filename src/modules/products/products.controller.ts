import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateProductDto } from './dto/create-product.dto';
import { FilterProductsDto } from './dto/filter-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách sản phẩm (lọc theo category, giá, keyword, seller)' })
  listProducts(@Query() filters: FilterProductsDto) {
    return this.productsService.listProducts(filters);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Lấy danh sách category hiện có' })
  getCategories() {
    return this.productsService.getCategories();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết sản phẩm' })
  getProductById(@Param('id') id: string) {
    return this.productsService.getProductById(id);
  }

  @Post('seller')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Seller thêm sản phẩm mới' })
  createProduct(@CurrentUser() user: any, @Body() dto: CreateProductDto) {
    return this.productsService.createProduct(user.userId, dto);
  }

  @Patch('seller/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Seller cập nhật sản phẩm của mình' })
  updateProduct(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.updateProduct(user.userId, id, dto);
  }

  @Delete('seller/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Seller ẩn sản phẩm của mình' })
  deactivateProduct(@CurrentUser() user: any, @Param('id') id: string) {
    return this.productsService.deactivateProduct(user.userId, id);
  }
}
