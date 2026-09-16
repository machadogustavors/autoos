import { IsArray, IsEnum, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { ServiceOrderStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

// RF-05 (pátio). Sem filtro = aberta/em andamento por padrão (ver service).
export class ListServiceOrdersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: string | string[] }) =>
    Array.isArray(value) ? value : [value],
  )
  @IsArray()
  @IsEnum(ServiceOrderStatus, { each: true })
  status?: ServiceOrderStatus[];
}
