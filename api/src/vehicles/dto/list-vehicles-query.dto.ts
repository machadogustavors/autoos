import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListVehiclesQueryDto extends PaginationQueryDto {
  // Busca por placa (RF-04, listVehicles).
  @IsOptional()
  @IsString()
  plate?: string;
}
