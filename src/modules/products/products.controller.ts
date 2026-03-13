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
import { AddToCartDto } from './dto/add-to-cart.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { FilterProductsDto } from './dto/filter-products.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
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

  @Get('search')
  @ApiOperation({ summary: 'Tìm kiếm sản phẩm theo từ khoá' })
  searchProducts(
    @Query('q') q = '',
    @Query('limit') limit?: number,
  ) {
    return this.productsService.searchProducts(q, Number(limit) || 20);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Lấy danh sách category hiện có' })
  getCategories() {
    return this.productsService.getCategories();
  }

  @Get('me/cart')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Buyer lấy giỏ hàng của tôi' })
  getMyCart(@CurrentUser() user: any) {
    return this.productsService.getMyCart(user.userId);
  }

  @Post(':id/cart')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Buyer thêm sản phẩm vào giỏ hàng' })
  addToCart(
    @CurrentUser() user: any,
    @Param('id') productId: string,
    @Body() dto: AddToCartDto,
  ) {
    return this.productsService.addToCart(user.userId, productId, dto);
  }

  @Patch('cart/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Buyer cập nhật số lượng sản phẩm trong giỏ hàng' })
  updateCartItem(
    @CurrentUser() user: any,
    @Param('id') productId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.productsService.updateCartItem(user.userId, productId, dto);
  }

  @Delete('cart/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Buyer xoá sản phẩm khỏi giỏ hàng' })
  removeFromCart(
    @CurrentUser() user: any,
    @Param('id') productId: string,
  ) {
    return this.productsService.removeFromCart(user.userId, productId);
  }

  @Get('me/favorites')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Buyer lấy danh sách sản phẩm yêu thích' })
  getMyFavorites(@CurrentUser() user: any) {
    return this.productsService.getMyFavorites(user.userId);
  }

  @Post(':id/favorite')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Buyer thêm sản phẩm vào yêu thích' })
  addToFavorites(
    @CurrentUser() user: any,
    @Param('id') productId: string,
  ) {
    return this.productsService.addToFavorites(user.userId, productId);
  }

  @Delete(':id/favorite')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Buyer xoá sản phẩm khỏi yêu thích' })
  removeFromFavorites(
    @CurrentUser() user: any,
    @Param('id') productId: string,
  ) {
    return this.productsService.removeFromFavorites(user.userId, productId);
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
