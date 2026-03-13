import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ArrayMaxSize,
} from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ example: 'Áo thun basic' })
  @IsString()
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({ example: 'Áo cotton thoáng mát, phù hợp mặc hằng ngày.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ example: 'fashion' })
  @IsString()
  @MaxLength(80)
  category: string;

  @ApiProperty({ example: 199000 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  stock?: number;

  @ApiPropertyOptional({
    type: [String],
    example: ['https://cdn.shop.com/product-1.jpg'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  imageUrls?: string[];
}
