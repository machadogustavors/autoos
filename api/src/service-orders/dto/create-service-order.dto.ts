import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

// RF-07.
export class CreateServiceOrderDto {
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @IsString()
  @IsNotEmpty()
  vehicleId: string;

  @IsOptional()
  @IsString()
  description?: string;
}
