import { Controller, Post, Get, Body } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { TrackEventRequestDto } from './dto';
import type {
  DashboardStats,
  AnalyticsEvent,
} from '@shared/api.interface';

@Controller('api/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post('track')
  async track(@Body() dto: TrackEventRequestDto): Promise<AnalyticsEvent> {
    return this.analyticsService.trackEvent(dto);
  }

  @Get('dashboard')
  async dashboard(): Promise<DashboardStats> {
    return this.analyticsService.getDashboardStats();
  }
}
