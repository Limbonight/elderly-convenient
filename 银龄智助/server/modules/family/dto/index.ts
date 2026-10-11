import { IsString, IsOptional, IsUUID } from 'class-validator';
import type { CreateFamilyBindingRequest } from '@shared/api.interface';

export class CreateFamilyBindingDto implements CreateFamilyBindingRequest {
  @IsUUID()
  familyUserId!: string;

  @IsString()
  elderName!: string;

  @IsString()
  elderPhone!: string;

  @IsString()
  relationship!: string;
}

export class CreateNotificationDto {
  @IsUUID()
  familyUserId!: string;

  @IsOptional()
  @IsUUID()
  elderUserId?: string;

  @IsOptional()
  @IsString()
  elderName?: string;

  @IsString()
  notificationType!: string;

  @IsString()
  content!: string;

  @IsOptional()
  @IsUUID()
  appointmentId?: string;
}
