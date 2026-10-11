import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import type { Appointment } from '@shared/api.interface';

@Controller('api/appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get()
  async list(
    @Req() req: Request,
    @Query('userId') userIdQuery?: string,
    @Query('status') status?: string,
  ): Promise<{ items: Appointment[] }> {
    const userId = userIdQuery ?? req.userContext?.userId;
    return this.appointmentsService.list(userId, status);
  }

  @Post()
  async create(@Body() dto: CreateAppointmentDto): Promise<Appointment> {
    return this.appointmentsService.create(dto);
  }

  @Get(':id')
  async getById(@Param('id') id: string): Promise<Appointment> {
    return this.appointmentsService.getById(id);
  }

  @Patch(':id/cancel')
  async cancel(@Param('id') id: string): Promise<Appointment> {
    return this.appointmentsService.cancel(id);
  }
}
