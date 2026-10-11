import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsUUID,
} from 'class-validator';
import type {
  VoiceDetectRequest,
  VoiceDetectResponse,
} from '@shared/api.interface';

export class VoiceDetectDto implements VoiceDetectRequest {
  @IsString()
  text!: string;

  @IsString()
  sessionId!: string;

  @IsInt()
  stepNumber!: number;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsString()
  dialect?: string;
}

export class CreateVoiceLogDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsInt()
  stepNumber?: number;

  @IsOptional()
  @IsString()
  recognizedText?: string;

  @IsOptional()
  @IsString()
  finalText?: string;

  @IsOptional()
  @IsString()
  dialect?: string;

  @IsOptional()
  @IsInt()
  retryCount?: number;

  @IsOptional()
  @IsBoolean()
  isSuccess?: boolean;

  @IsOptional()
  @IsInt()
  durationMs?: number;
}

export type VoiceDetectResult = VoiceDetectResponse;
