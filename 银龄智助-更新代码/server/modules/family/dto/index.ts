import { IsString, IsOptional } from 'class-validator';
import type { CreateFamilyBindingRequest } from '@shared/api.interface';

export class CreateFamilyBindingDto implements CreateFamilyBindingRequest {
  // 本地/演示模式下 userId 为前端生成的非 UUID 字符串，放宽为 IsString
  @IsString()
  familyUserId!: string;

  @IsString()
  elderName!: string;

  @IsString()
  elderPhone!: string;

  @IsString()
  relationship!: string;
}

export class UpdateFamilyBindingDto {
  @IsOptional()
  @IsString()
  elderName?: string;

  @IsOptional()
  @IsString()
  elderPhone?: string;

  @IsOptional()
  @IsString()
  relationship?: string;
}

export class CreateNotificationDto {
  // 本地/演示模式下 userId 为前端生成的非 UUID 字符串，放宽为 IsString
  @IsString()
  familyUserId!: string;

  @IsOptional()
  @IsString()
  elderUserId?: string;

  @IsOptional()
  @IsString()
  elderName?: string;

  @IsString()
  notificationType!: string;

  @IsString()
  content!: string;

  @IsOptional()
  @IsString()
  appointmentId?: string;
}
