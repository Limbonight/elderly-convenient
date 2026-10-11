import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Query,
  Param,
  BadRequestException,
} from '@nestjs/common';
import { FamilyService } from './family.service';
import { CreateFamilyBindingDto, CreateNotificationDto } from './dto';
import type {
  FamilyBinding,
  FamilyNotification,
  Appointment,
} from '@shared/api.interface';

@Controller('api/family')
export class FamilyController {
  constructor(private readonly familyService: FamilyService) {}

  @Get('bind')
  async listBindings(
    @Query('familyUserId') familyUserId: string,
  ): Promise<{ items: FamilyBinding[] }> {
    if (!familyUserId) {
      throw new BadRequestException('familyUserId 不能为空');
    }
    return this.familyService.listBindings(familyUserId);
  }

  @Post('bind')
  async createBinding(
    @Body() dto: CreateFamilyBindingDto,
  ): Promise<FamilyBinding> {
    return this.familyService.createBinding(dto);
  }

  @Delete('bind/:id')
  async removeBinding(@Param('id') id: string): Promise<{ success: boolean }> {
    await this.familyService.removeBinding(id);
    return { success: true };
  }

  @Get('not')
  async listNotifications(
    @Query('familyUserId') familyUserId: string,
  ): Promise<{ items: FamilyNotification[] }> {
    if (!familyUserId) {
      throw new BadRequestException('familyUserId 不能为空');
    }
    return this.familyService.listNotifications(familyUserId);
  }

  @Post('notifications')
  async createNotification(
    @Body() dto: CreateNotificationDto,
  ): Promise<FamilyNotification> {
    return this.familyService.createNotification(dto);
  }

  @Patch('notifications/:id/read')
  async markRead(
    @Param('id') id: string,
  ): Promise<FamilyNotification> {
    return this.familyService.markNotificationRead(id);
  }

  @Get('elders/:elderUserId/appointments')
  async getElderAppointments(
    @Param('elderUserId') elderUserId: string,
  ): Promise<{ items: Appointment[] }> {
    return this.familyService.getElderAppointments(elderUserId);
  }
}
