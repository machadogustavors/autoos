import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListCustomersQueryDto extends PaginationQueryDto {
  // Busca por nome ou telefone (RF-03, listCustomers).
  @IsOptional()
  @IsString()
  q?: string;
}
