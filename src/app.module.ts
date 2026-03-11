import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProductsModule } from './modules/products/products.module';
import { OrdersModule } from './modules/orders/orders.module';
import { ChatModule } from './modules/chat/chat.module';
import { AiModule } from './modules/ai/ai.module';

@Module({
  imports: [AuthModule, UsersModule, ProductsModule, OrdersModule, ChatModule, AiModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
