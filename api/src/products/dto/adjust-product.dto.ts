import { IsInt, Min } from 'class-validator';

// RF-20 — ajuste manual (correção de contagem, reposição, ou compensar uma
// baixa da RF-11a que não devia ter acontecido). Valor absoluto, não delta.
export class AdjustProductDto {
  @IsInt()
  @Min(0)
  stockQuantity: number;
}
