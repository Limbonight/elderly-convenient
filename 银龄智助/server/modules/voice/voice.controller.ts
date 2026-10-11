import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { VoiceService } from './voice.service';
import { VoiceDetectDto, CreateVoiceLogDto } from './dto';
import type {
  VoiceDetectResponse,
  VoiceLog,
} from '@shared/api.interface';

@Controller('api/voice')
export class VoiceController {
  constructor(private readonly voiceService: VoiceService) {}

  @Post('detect')
  async detect(@Body() dto: VoiceDetectDto): Promise<VoiceDetectResponse> {
    return this.voiceService.detectFraudAndIntent(dto);
  }

  @Post('log')
  async createLog(@Body() dto: CreateVoiceLogDto): Promise<VoiceLog> {
    return this.voiceService.createLog(dto);
  }

  @Get('logs')
  async logs(
    @Query('userId') userId: string,
  ): Promise<{ items: VoiceLog[] }> {
    if (!userId) {
      throw new BadRequestException('userId 不能为空');
    }
    return this.voiceService.listLogs(userId);
  }
}
