import { Module } from '@nestjs/common';
import { FirebaseModule } from '../../firebase/firebase.module';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [FirebaseModule],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
