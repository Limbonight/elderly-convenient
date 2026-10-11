import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  DRIZZLE_DATABASE,
  type PostgresJsDatabase,
} from '@lark-apaas/fullstack-nestjs-core';
import {
  voiceLogs,
  fraudWarnings,
  departments,
  doctors,
} from '@server/database/schema';
import { eq, desc, ilike } from 'drizzle-orm';
import type {
  VoiceDetectResponse,
  VoiceLog,
} from '@shared/api.interface';
import type { VoiceDetectDto, CreateVoiceLogDto } from './dto';

const FRAUD_KEYWORDS: string[] = [
  '缴费',
  '转账',
  '验证码',
  '汇款',
  '银行卡',
  '密码',
  '中奖',
  '刷单',
  '贷款',
  '投资',
  '公检法',
  '安全账户',
];

@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async detectFraudAndIntent(dto: VoiceDetectDto): Promise<VoiceDetectResponse> {
    const text = dto.text || '';
    const normalizedText = text.trim();

    // 1. 敏感词检测 - 命中第一个即返回
    let triggerWord: string | null = null;
    for (const keyword of FRAUD_KEYWORDS) {
      if (normalizedText.includes(keyword)) {
        triggerWord = keyword;
        break;
      }
    }

    const isFraud = triggerWord !== null;

    // 命中敏感词时，在 fraud_warnings 表插入一条记录
    if (isFraud && dto.userId) {
      try {
        await this.db.insert(fraudWarnings).values({
          userId: dto.userId,
          triggerWord: triggerWord!,
          triggerSource: 'voice',
          pageLocation: `step_${dto.stepNumber}`,
          notifiedFamily: false,
        });
      } catch (error) {
        this.logger.error('插入防诈警告记录失败', error);
      }
    }

    // 2. 科室/医生关键词匹配
    let matchedDepartment: string | null = null;
    let matchedDoctor: string | null = null;
    let recognizedKeyword: string | null = null;

    try {
      const [deptList, doctorList] = await Promise.all([
        this.db.select({ name: departments.name }).from(departments),
        this.db.select({ name: doctors.name }).from(doctors),
      ]);

      for (const dept of deptList) {
        if (normalizedText.includes(dept.name)) {
          matchedDepartment = dept.name;
          recognizedKeyword = dept.name;
          break;
        }
      }

      if (!matchedDoctor) {
        for (const doc of doctorList) {
          if (normalizedText.includes(doc.name)) {
            matchedDoctor = doc.name;
            if (!recognizedKeyword) {
              recognizedKeyword = doc.name;
            }
            break;
          }
        }
      }
    } catch (error) {
      this.logger.error('科室/医生匹配查询失败', error);
    }

    return {
      isFraud,
      triggerWord,
      recognizedKeyword,
      matchedDepartment,
      matchedDoctor,
      normalizedText,
    };
  }

  async createLog(dto: CreateVoiceLogDto): Promise<VoiceLog> {
    const [record] = await this.db
      .insert(voiceLogs)
      .values({
        userId: dto.userId,
        sessionId: dto.sessionId,
        stepNumber: dto.stepNumber,
        recognizedText: dto.recognizedText,
        finalText: dto.finalText,
        dialect: dto.dialect,
        retryCount: dto.retryCount,
        isSuccess: dto.isSuccess,
        durationMs: dto.durationMs,
      })
      .returning();

    return this.toVoiceLog(record);
  }

  async listLogs(userId: string): Promise<{ items: VoiceLog[] }> {
    const results = await this.db
      .select()
      .from(voiceLogs)
      .where(eq(voiceLogs.userId, userId))
      .orderBy(desc(voiceLogs.createdAt))
      .limit(50);

    return { items: results.map((r) => this.toVoiceLog(r)) };
  }

  private toVoiceLog(row: typeof voiceLogs.$inferSelect): VoiceLog {
    return {
      id: row.id,
      userId: row.userId,
      sessionId: row.sessionId ?? '',
      stepNumber: row.stepNumber ?? 0,
      recognizedText: row.recognizedText,
      finalText: row.finalText,
      dialect: row.dialect,
      retryCount: row.retryCount ?? 0,
      isSuccess: row.isSuccess ?? false,
      durationMs: row.durationMs,
    };
  }
}
