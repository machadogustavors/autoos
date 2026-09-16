import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ServiceOrdersService } from './service-orders.service';
import { CreateServiceOrderDto } from './dto/create-service-order.dto';
import { UpdateServiceOrderStatusDto } from './dto/update-service-order-status.dto';
import { CreateServiceOrderItemDto } from './dto/create-service-order-item.dto';
import { UpdateServiceOrderItemDto } from './dto/update-service-order-item.dto';
import { ListServiceOrdersQueryDto } from './dto/list-service-orders-query.dto';
import { CreateTelemetrySnapshotDto } from './dto/create-telemetry-snapshot.dto';
import { CurrentUser } from '../common/decorators';
import type { CurrentUserPayload } from '../common/decorators';

function requireIdempotencyKey(key: string | undefined): string {
  if (!key) {
    throw new BadRequestException('Header Idempotency-Key é obrigatório.');
  }
  return key;
}

@Controller('service-orders')
export class ServiceOrdersController {
  constructor(private readonly serviceOrdersService: ServiceOrdersService) {}

  // listServiceOrders (RF-05, pátio)
  @Get()
  findMany(@Query() query: ListServiceOrdersQueryDto) {
    return this.serviceOrdersService.findMany(
      query.status,
      query.after,
      query.limit,
    );
  }

  // postServiceOrder (RF-07, RF-08)
  @Post()
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: CreateServiceOrderDto,
  ) {
    return this.serviceOrdersService.create(
      user.userId,
      requireIdempotencyKey(idempotencyKey),
      dto,
    );
  }

  // getServiceOrder (RF-09)
  @Get(':id')
  getDetail(@Param('id') id: string) {
    return this.serviceOrdersService.getDetail(id);
  }

  // patchServiceOrder (RF-10)
  @Patch(':id')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateServiceOrderStatusDto,
  ) {
    return this.serviceOrdersService.updateStatus(id, dto.status);
  }

  // postServiceOrderItem (RF-11, RF-11a)
  @Post(':id/items')
  addItem(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') orderId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: CreateServiceOrderItemDto,
  ) {
    return this.serviceOrdersService.addItem(
      user.userId,
      orderId,
      requireIdempotencyKey(idempotencyKey),
      dto,
    );
  }

  // patchServiceOrderItem (RF-11)
  @Patch(':id/items/:itemId')
  updateItem(
    @Param('id') orderId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateServiceOrderItemDto,
  ) {
    return this.serviceOrdersService.updateItem(orderId, itemId, dto);
  }

  // deleteServiceOrderItem (RF-11)
  @Delete(':id/items/:itemId')
  @HttpCode(204)
  async removeItem(
    @Param('id') orderId: string,
    @Param('itemId') itemId: string,
  ) {
    await this.serviceOrdersService.removeItem(orderId, itemId);
  }

  // postServiceOrderTelemetry (RF-13) — snapshot pontual. O fluxo contínuo
  // (RF-14) não passa pela API, vai direto do app pro LARCC via MQTT.
  @Post(':id/telemetry')
  addTelemetry(
    @Param('id') orderId: string,
    @Body() dto: CreateTelemetrySnapshotDto,
  ) {
    return this.serviceOrdersService.addTelemetrySnapshot(orderId, dto);
  }
}
