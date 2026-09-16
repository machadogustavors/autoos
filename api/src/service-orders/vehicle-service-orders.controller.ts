import { Controller, Get, Param, Query } from '@nestjs/common';
import { ServiceOrdersService } from './service-orders.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

// listVehicleServiceOrders (RF-18). Vive aqui, não em VehiclesModule, pra
// não criar dependência circular (este módulo já importa VehiclesModule
// por causa de VehiclesService.findOneOrThrow em ServiceOrdersService).
@Controller('vehicles/:vehicleId/service-orders')
export class VehicleServiceOrdersController {
  constructor(private readonly serviceOrdersService: ServiceOrdersService) {}

  @Get()
  findByVehicle(
    @Param('vehicleId') vehicleId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.serviceOrdersService.findByVehicle(
      vehicleId,
      query.after,
      query.limit,
    );
  }
}
