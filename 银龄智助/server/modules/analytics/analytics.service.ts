import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  DRIZZLE_DATABASE,
  type PostgresJsDatabase,
} from '@lark-apaas/fullstack-nestjs-core';
import {
  analyticsEvents,
  appointments,
  fraudWarnings,
  voiceLogs,
} from '@server/database/schema';
import {
  count,
  eq,
  sql,
  desc,
  gte,
  and,
  avg,
} from 'drizzle-orm';
import type {
  DashboardStats,
  AnalyticsEvent,
} from '@shared/api.interface';
import type { TrackEventRequestDto } from './dto';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async trackEvent(dto: TrackEventRequestDto): Promise<AnalyticsEvent> {
    const [record] = await this.db
      .insert(analyticsEvents)
      .values({
        eventName: dto.eventName,
        userId: dto.userId,
        sessionId: dto.sessionId,
        properties: dto.properties,
      })
      .returning();

    return this.toAnalyticsEvent(record);
  }

  async getDashboardStats(): Promise<DashboardStats> {
    const [
      totalResult,
      confirmedResult,
      voiceRegResult,
      avgDurationResult,
      fraudCountResult,
      helpClickResult,
      familyAssistResult,
      voiceRepeatResult,
      voiceTotalResult,
      voiceSuccessResult,
      stepDropOffRows,
      dailyRows,
    ] = await Promise.all([
      // totalRegistrations: appointments 总数
      this.db
        .select({ count: count() })
        .from(appointments),
      // confirmed 数量
      this.db
        .select({ count: count() })
        .from(appointments)
        .where(eq(appointments.status, 'confirmed')),
      // 语音挂号数量
      this.db
        .select({ count: count() })
        .from(appointments)
        .where(eq(appointments.isVoiceRegistration, true)),
      // 平均时长（只算 confirmed）
      this.db
        .select({ avg: avg(appointments.totalDurationSeconds) })
        .from(appointments)
        .where(
          and(
            eq(appointments.status, 'confirmed'),
            sql`${appointments.totalDurationSeconds} IS NOT NULL`,
          ),
        ),
      // 防诈警告总数
      this.db
        .select({ count: count() })
        .from(fraudWarnings),
      // help_button_click 数量
      this.db
        .select({ count: count() })
        .from(analyticsEvents)
        .where(eq(analyticsEvents.eventName, 'help_button_click')),
      // family_assist_used 数量
      this.db
        .select({ count: count() })
        .from(analyticsEvents)
        .where(eq(analyticsEvents.eventName, 'family_assist_used')),
      // voice_repeat_request 数量
      this.db
        .select({ count: count() })
        .from(analyticsEvents)
        .where(eq(analyticsEvents.eventName, 'voice_repeat_request')),
      // voice_logs 总数
      this.db
        .select({ count: count() })
        .from(voiceLogs),
      // voice_logs 成功数
      this.db
        .select({ count: count() })
        .from(voiceLogs)
        .where(eq(voiceLogs.isSuccess, true)),
      // step_drop_off 按 step_number 分组
      this.db
        .select({
          stepNumber: sql<string>`(${analyticsEvents.properties}->>'step_number')`,
          count: count(),
        })
        .from(analyticsEvents)
        .where(eq(analyticsEvents.eventName, 'step_drop_off'))
        .groupBy(sql`(${analyticsEvents.properties}->>'step_number')`),
      // 最近 7 天每天挂号数
      this.db
        .select({
          date: sql<string>`${appointments.appointmentDate}::text`,
          count: count(),
        })
        .from(appointments)
        .where(
          gte(
            appointments.appointmentDate,
            sql`CURRENT_DATE - INTERVAL '6 days'`,
          ),
        )
        .groupBy(appointments.appointmentDate)
        .orderBy(appointments.appointmentDate),
    ]);

    const total = Number(totalResult[0]?.count ?? 0);
    const confirmed = Number(confirmedResult[0]?.count ?? 0);
    const voiceReg = Number(voiceRegResult[0]?.count ?? 0);
    const avgDurationRaw = avgDurationResult[0]?.avg;
    const avgDurationSeconds =
      avgDurationRaw !== null && avgDurationRaw !== undefined
        ? Math.round(Number(avgDurationRaw) * 100) / 100
        : 0;
    const fraudWarningCount = Number(fraudCountResult[0]?.count ?? 0);
    const helpButtonClicks = Number(helpClickResult[0]?.count ?? 0);
    const familyAssistCount = Number(familyAssistResult[0]?.count ?? 0);
    const voiceRepeatCount = Number(voiceRepeatResult[0]?.count ?? 0);

    const voiceTotal = Number(voiceTotalResult[0]?.count ?? 0);
    const voiceSuccess = Number(voiceSuccessResult[0]?.count ?? 0);
    const recognitionAccuracy =
      voiceTotal > 0 ? Math.round((voiceSuccess / voiceTotal) * 10000) / 100 : 0;

    const completionRate =
      total > 0 ? Math.round((confirmed / total) * 10000) / 100 : 0;
    const voiceUsageRate =
      total > 0 ? Math.round((voiceReg / total) * 10000) / 100 : 0;

    const stepDropOffCounts: Record<string, number> = {};
    for (const row of stepDropOffRows) {
      if (row.stepNumber !== null && row.stepNumber !== undefined) {
        stepDropOffCounts[String(row.stepNumber)] = Number(row.count);
      }
    }

    const dailyRegistrations: { date: string; count: number }[] = dailyRows.map(
      (row) => ({
        date: row.date,
        count: Number(row.count),
      }),
    );

    return {
      totalRegistrations: confirmed,
      completionRate,
      voiceUsageRate,
      avgDurationSeconds,
      fraudWarningCount,
      helpButtonClicks,
      familyAssistCount,
      voiceRepeatCount,
      recognitionAccuracy,
      stepDropOffCounts,
      dailyRegistrations,
    };
  }

  private toAnalyticsEvent(
    row: typeof analyticsEvents.$inferSelect,
  ): AnalyticsEvent {
    return {
      id: row.id,
      eventName: row.eventName,
      userId: row.userId,
      sessionId: row.sessionId,
      properties:
        (row.properties as Record<string, unknown> | null) ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
