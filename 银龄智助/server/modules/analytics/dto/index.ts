import { IsString, IsOptional, IsObject, IsUUID } from 'class-validator';
import type { TrackEventRequest } from '@shared/api.interface';

export class TrackEventRequestDto implements TrackEventRequest {
  @IsString()
  eventName!: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsObject()
  properties?: Record<string, unknown>;
}
