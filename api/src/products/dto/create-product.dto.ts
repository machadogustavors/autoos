import { IsInt, IsNotEmpty, IsString, Min, MaxLength } from 'class-validator';

// RF-20 — cadastra peça nova no estoque.
export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsInt()
  @Min(0)
  stockQuantity: number;
}
