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
import {
  CreateFamilyBindingDto,
  CreateNotificationDto,
  UpdateFamilyBindingDto,
} from './dto';
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

  @Get('members')
  async listMembers(
    @Query('familyUserId') familyUserId: string,
  ): Promise<{
    items: Array<{
      id: string;
      name: string;
      relation: string;
      phone: string;
      idCard: string;
    }>;
  }> {
    if (!familyUserId) {
      throw new BadRequestException('familyUserId 不能为空');
    }
    return this.familyService.listMembers(familyUserId);
  }

  @Post('bind')
  async createBinding(
    @Body() dto: CreateFamilyBindingDto,
  ): Promise<FamilyBinding> {
    return this.familyService.createBinding(dto);
  }

  @Patch('bind/:id')
  async updateBinding(
    @Param('id') id: string,
    @Body() dto: UpdateFamilyBindingDto,
  ): Promise<FamilyBinding> {
    return this.familyService.updateBinding(id, dto);
  }

  @Delete('bind/:id')
  async removeBinding(@Param('id') id: string): Promise<{ success: boolean }> {
    await this.familyService.removeBinding(id);
    return { success: true };
  }

  @Get('notifications')
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
