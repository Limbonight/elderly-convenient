import { IsString, IsOptional, IsInt, IsBoolean, MaxLength } from 'class-validator';
import type { CreateAppointmentRequest } from '@shared/api.interface';

export class CreateAppointmentDto implements CreateAppointmentRequest {
  // 本地/演示模式下 userId 为前端固定字符串（demo_elder_001），放宽为可选字符串
  @IsOptional()
  @IsString()
  userId?: string;

  @IsString()
  patientId!: string;

  @IsString()
  departmentId!: string;

  @IsOptional()
  @IsString()
  doctorId?: string;

  @IsString()
  timeSlotId!: string;

  @IsOptional()
  @IsBoolean()
  isVoiceRegistration?: boolean;

  @IsOptional()
  @IsInt()
  totalDurationSeconds?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  source?: string;
}
