import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsUUID,
  MaxLength,
} from 'class-validator';
import type { CreateAppointmentRequest } from '@shared/api.interface';

export class CreateAppointmentDto implements CreateAppointmentRequest {
  @IsString()
  @IsUUID()
  userId: string;

  @IsString()
  @IsUUID()
  patientId: string;

  @IsString()
  @IsUUID()
  departmentId: string;

  @IsOptional()
  @IsString()
  @IsUUID()
  doctorId?: string;

  @IsString()
  @IsUUID()
  timeSlotId: string;

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
