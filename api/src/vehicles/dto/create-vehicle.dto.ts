import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

// Padrão antigo (ABC1234) ou Mercosul (ABC1D23) — RF-04.
const PLATE_PATTERN = /^[A-Z]{3}(\d{4}|\d[A-Z]\d{2})$/;

export class CreateVehicleDto {
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @Transform(({ value }: { value: string }) => value?.toUpperCase())
  @IsString()
  @MaxLength(8)
  @Matches(PLATE_PATTERN, { message: 'Placa em formato inválido.' })
  plate: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsInt()
  year?: number;

  @IsOptional()
  @IsString()
  color?: string;

  // Só usado até a primeira leitura de telemetria (RF-04/RF-13).
  @IsOptional()
  @IsInt()
  referenceMileage?: number;
}
