import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListProductsQueryDto extends PaginationQueryDto {
  // Busca por nome (RF-19, listProducts).
  @IsOptional()
  @IsString()
  q?: string;
}
