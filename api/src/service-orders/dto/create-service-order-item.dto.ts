import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';
import { ServiceOrderItemType } from '@prisma/client';

// RF-11. `productId` só faz sentido para type=part vindo do estoque
// (RF-19) — regra de negócio, não de shape, então validada no service.
export class CreateServiceOrderItemDto {
  @IsEnum(ServiceOrderItemType)
  type: ServiceOrderItemType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  description: string;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;
}
