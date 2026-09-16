import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { ListCustomersQueryDto } from './dto/list-customers-query.dto';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  // listCustomers (RF-03)
  @Get()
  findMany(@Query() query: ListCustomersQueryDto) {
    return this.customersService.findMany(query.q, query.after, query.limit);
  }

  // postCustomer (RF-03)
  @Post()
  create(@Body() dto: CreateCustomerDto) {
    return this.customersService.create(dto);
  }
}
