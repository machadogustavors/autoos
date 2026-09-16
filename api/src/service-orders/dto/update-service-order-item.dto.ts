import {
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';

// RF-11. Não repõe/redecrementa estoque automaticamente (ver RF-11a).
export class UpdateServiceOrderItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;
}
