import { Module } from '@nestjs/common';
import { ServiceOrdersController } from './service-orders.controller';
import { VehicleServiceOrdersController } from './vehicle-service-orders.controller';
import { ServiceOrdersService } from './service-orders.service';
import { VehiclesModule } from '../vehicles/vehicles.module';

@Module({
  imports: [VehiclesModule],
  controllers: [ServiceOrdersController, VehicleServiceOrdersController],
  providers: [ServiceOrdersService],
  exports: [ServiceOrdersService],
})
export class ServiceOrdersModule {}
