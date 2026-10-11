import { Controller, Get, Param, Query } from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import type { Department, Doctor, TimeSlot } from '@shared/api.interface';

@Controller('api/departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  async list(): Promise<{ items: Department[] }> {
    return this.departmentsService.list();
  }

  @Get(':id/doctors')
  async getDoctors(@Param('id') id: string): Promise<{ items: Doctor[] }> {
    return this.departmentsService.getDoctors(id);
  }

  @Get(':id/time-slots')
  async getTimeSlots(
    @Param('id') id: string,
    @Query('date') date?: string,
  ): Promise<{ items: TimeSlot[] }> {
    return this.departmentsService.getTimeSlotsByDepartment(id, date);
  }
}

@Controller('api/doctors')
export class DoctorsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get(':id/time-slots')
  async getTimeSlots(@Param('id') id: string): Promise<{ items: TimeSlot[] }> {
    return this.departmentsService.getTimeSlotsByDoctor(id);
  }
}
