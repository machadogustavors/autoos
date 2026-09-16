import { IsEnum } from 'class-validator';
import { ServiceOrderStatus } from '@prisma/client';

// RF-10.
export class UpdateServiceOrderStatusDto {
  @IsEnum(ServiceOrderStatus)
  status: ServiceOrderStatus;
}
