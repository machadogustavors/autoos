import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { ListVehiclesQueryDto } from './dto/list-vehicles-query.dto';

// GET /vehicles/{id}/service-orders (RF-18) vive em
// service-orders/vehicle-service-orders.controller.ts, não aqui — evita
// dependência circular entre VehiclesModule e ServiceOrdersModule.
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  // listVehicles (RF-04)
  @Get()
  findMany(@Query() query: ListVehiclesQueryDto) {
    return this.vehiclesService.findMany(query.plate, query.after, query.limit);
  }

  // postVehicle (RF-04)
  @Post()
  create(@Body() dto: CreateVehicleDto) {
    return this.vehiclesService.create(dto);
  }
}
