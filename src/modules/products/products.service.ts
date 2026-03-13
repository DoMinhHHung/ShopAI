import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { FilterProductsDto } from './dto/filter-products.dto';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@Injectable()
export class ProductsService {
  private db: admin.firestore.Firestore;

  constructor(@Inject('FIREBASE_ADMIN') private firebaseApp: admin.app.App) {
    this.db = firebaseApp.firestore();
  }

  private async ensureSeller(userId: string) {
    const userDoc = await this.db.collection('users').doc(userId).get();
    if (!userDoc.exists) throw new NotFoundException('Tài khoản không tồn tại');

    const user = userDoc.data();
    if (!user || user.role !== 'seller') {
      throw new ForbiddenException('Bạn cần đăng ký seller để thao tác sản phẩm');
    }

    return {
      sellerId: userId,
      sellerName: user.name ?? 'Seller',
    };
  }

  async createProduct(userId: string, dto: CreateProductDto) {
    const seller = await this.ensureSeller(userId);

    const productRef = this.db.collection('products').doc();
    await productRef.set({
      id: productRef.id,
      sellerId: seller.sellerId,
      sellerName: seller.sellerName,
      name: dto.name,
      description: dto.description ?? '',
      category: dto.category.toLowerCase(),
      price: dto.price,
      stock: dto.stock ?? 0,
      imageUrls: dto.imageUrls ?? [],
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      message: 'Tạo sản phẩm thành công',
      productId: productRef.id,
    };
  }

  async updateProduct(userId: string, productId: string, dto: UpdateProductDto) {
    await this.ensureSeller(userId);

    const productRef = this.db.collection('products').doc(productId);
    const productDoc = await productRef.get();

    if (!productDoc.exists) {
      throw new NotFoundException('Sản phẩm không tồn tại');
    }

    const product = productDoc.data();
    if (!product || product.sellerId !== userId) {
      throw new ForbiddenException('Bạn không có quyền sửa sản phẩm này');
    }

    const updateData: Record<string, any> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.category !== undefined) updateData.category = dto.category.toLowerCase();
    if (dto.price !== undefined) updateData.price = dto.price;
    if (dto.stock !== undefined) updateData.stock = dto.stock;
    if (dto.imageUrls !== undefined) updateData.imageUrls = dto.imageUrls;

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('Không có dữ liệu để cập nhật');
    }

    updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    await productRef.update(updateData);

    return { message: 'Cập nhật sản phẩm thành công' };
  }

  async deactivateProduct(userId: string, productId: string) {
    await this.ensureSeller(userId);

    const productRef = this.db.collection('products').doc(productId);
    const productDoc = await productRef.get();
    if (!productDoc.exists) throw new NotFoundException('Sản phẩm không tồn tại');

    const product = productDoc.data();
    if (!product || product.sellerId !== userId) {
      throw new ForbiddenException('Bạn không có quyền ẩn sản phẩm này');
    }

    await productRef.update({
      isActive: false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { message: 'Đã ẩn sản phẩm' };
  }

  async getProductById(productId: string) {
    const productDoc = await this.db.collection('products').doc(productId).get();
    if (!productDoc.exists) throw new NotFoundException('Sản phẩm không tồn tại');

    return {
      id: productDoc.id,
      ...productDoc.data(),
    };
  }

  async listProducts(filters: FilterProductsDto) {
    const limit = Math.min(filters.limit ?? 20, 50);

    let query: admin.firestore.Query = this.db.collection('products');

    if (filters.onlyActive !== false) {
      query = query.where('isActive', '==', true);
    }
    if (filters.category) {
      query = query.where('category', '==', filters.category.toLowerCase());
    }
    if (filters.sellerId) {
      query = query.where('sellerId', '==', filters.sellerId);
    }

    query = query.orderBy('createdAt', 'desc').limit(limit);

    const snapshot = await query.get();
    let products = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    if (filters.minPrice !== undefined) {
      products = products.filter((p: any) => p.price >= filters.minPrice!);
    }
    if (filters.maxPrice !== undefined) {
      products = products.filter((p: any) => p.price <= filters.maxPrice!);
    }
    if (filters.keyword) {
      const keyword = filters.keyword.toLowerCase().trim();
      products = products.filter((p: any) => {
        const name = (p.name ?? '').toLowerCase();
        const description = (p.description ?? '').toLowerCase();
        return name.includes(keyword) || description.includes(keyword);
      });
    }

    return {
      total: products.length,
      items: products,
    };
  }


  async searchProducts(keyword: string, limit = 20) {
    const filters: FilterProductsDto = {
      keyword,
      limit,
      onlyActive: true,
    };

    return this.listProducts(filters);
  }

  async addToCart(userId: string, productId: string, dto: AddToCartDto) {
    const product = await this.getProductById(productId);
    if (!product.isActive) {
      throw new BadRequestException('Sản phẩm đang tạm ẩn');
    }

    const quantity = dto.quantity ?? 1;
    const cartRef = this.db
      .collection('users')
      .doc(userId)
      .collection('cart')
      .doc(productId);

    const cartDoc = await cartRef.get();
    if (cartDoc.exists) {
      const current = cartDoc.data();
      const nextQuantity = (current?.quantity ?? 0) + quantity;

      await cartRef.update({
        quantity: nextQuantity,
        priceSnapshot: product.price,
        productNameSnapshot: product.name,
        imageSnapshot: product.imageUrls?.[0] ?? null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { message: 'Đã cập nhật số lượng trong giỏ hàng' };
    }

    await cartRef.set({
      productId,
      quantity,
      priceSnapshot: product.price,
      productNameSnapshot: product.name,
      imageSnapshot: product.imageUrls?.[0] ?? null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { message: 'Đã thêm sản phẩm vào giỏ hàng' };
  }

  async updateCartItem(userId: string, productId: string, dto: UpdateCartItemDto) {
    const cartRef = this.db
      .collection('users')
      .doc(userId)
      .collection('cart')
      .doc(productId);

    const cartDoc = await cartRef.get();
    if (!cartDoc.exists) throw new NotFoundException('Sản phẩm chưa có trong giỏ hàng');

    await cartRef.update({
      quantity: dto.quantity,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { message: 'Cập nhật giỏ hàng thành công' };
  }

  async removeFromCart(userId: string, productId: string) {
    const cartRef = this.db
      .collection('users')
      .doc(userId)
      .collection('cart')
      .doc(productId);

    const cartDoc = await cartRef.get();
    if (!cartDoc.exists) throw new NotFoundException('Sản phẩm chưa có trong giỏ hàng');

    await cartRef.delete();

    return { message: 'Đã xoá sản phẩm khỏi giỏ hàng' };
  }

  async getMyCart(userId: string) {
    const snapshot = await this.db
      .collection('users')
      .doc(userId)
      .collection('cart')
      .orderBy('updatedAt', 'desc')
      .get();

    const items = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    const totalAmount = items.reduce((sum: number, item: any) => {
      return sum + (item.priceSnapshot ?? 0) * (item.quantity ?? 0);
    }, 0);

    return {
      totalItems: items.length,
      totalAmount,
      items,
    };
  }

  async addToFavorites(userId: string, productId: string) {
    const product = await this.getProductById(productId);

    const favoriteRef = this.db
      .collection('users')
      .doc(userId)
      .collection('favorites')
      .doc(productId);

    await favoriteRef.set({
      productId,
      productNameSnapshot: product.name,
      priceSnapshot: product.price,
      imageSnapshot: product.imageUrls?.[0] ?? null,
      categorySnapshot: product.category ?? null,
      isActiveSnapshot: product.isActive ?? true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { message: 'Đã thêm vào yêu thích' };
  }

  async removeFromFavorites(userId: string, productId: string) {
    const favoriteRef = this.db
      .collection('users')
      .doc(userId)
      .collection('favorites')
      .doc(productId);

    const favoriteDoc = await favoriteRef.get();
    if (!favoriteDoc.exists) throw new NotFoundException('Sản phẩm chưa có trong yêu thích');

    await favoriteRef.delete();

    return { message: 'Đã xoá khỏi yêu thích' };
  }

  async getMyFavorites(userId: string) {
    const snapshot = await this.db
      .collection('users')
      .doc(userId)
      .collection('favorites')
      .orderBy('updatedAt', 'desc')
      .get();

    const items = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return {
      total: items.length,
      items,
    };
  }

  async getCategories() {
    const snapshot = await this.db.collection('products').get();
    const categories = new Set<string>();

    snapshot.docs.forEach((doc) => {
      const category = doc.data()?.category;
      if (category) categories.add(String(category));
    });

    return {
      total: categories.size,
      items: Array.from(categories).sort(),
    };
  }
}
