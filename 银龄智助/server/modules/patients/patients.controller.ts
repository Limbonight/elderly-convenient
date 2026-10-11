import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  Query,
} from '@nestjs/common';
import type { Request } from 'express';
import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import type { Patient } from '@shared/api.interface';

@Controller('api/patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Get()
  async list(
    @Req() req: Request,
    @Query('userId') userIdQuery?: string,
  ): Promise<{ items: Patient[] }> {
    const userId = userIdQuery ?? req.userContext?.userId;
    return this.patientsService.listByUser(userId);
  }

  @Post()
  async create(@Body() dto: CreatePatientDto): Promise<Patient> {
    return this.patientsService.create(dto);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePatientDto,
    @Req() req: Request,
  ): Promise<Patient> {
    const userId = req.userContext?.userId;
    return this.patientsService.update(id, dto, userId);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: Request): Promise<void> {
    const userId = req.userContext?.userId;
    return this.patientsService.remove(id, userId);
  }

  @Post(':id/set-default')
  async setDefault(
    @Param('id') id: string,
    @Body('userId') bodyUserId: string | undefined,
    @Req() req: Request,
  ): Promise<Patient> {
    const userId = req.userContext?.userId ?? bodyUserId;
    return this.patientsService.setDefault(id, userId);
  }
}
