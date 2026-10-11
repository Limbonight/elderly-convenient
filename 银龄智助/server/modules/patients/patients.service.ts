import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { patients } from '@server/database/schema';
import { eq, and, desc } from 'drizzle-orm';
import type { Patient } from '@shared/api.interface';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';

@Injectable()
export class PatientsService {
  private readonly logger = new Logger(PatientsService.name);

  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase) {}

  async listByUser(userId: string): Promise<{ items: Patient[] }> {
    try {
      const results = await this.db
        .select({
          id: patients.id,
          userId: patients.userId,
          fullName: patients.fullName,
          idCard: patients.idCard,
          medicalCardNo: patients.medicalCardNo,
          phone: patients.phone,
          gender: patients.gender,
          age: patients.age,
          relationship: patients.relationship,
          isDefault: patients.isDefault,
        })
        .from(patients)
        .where(eq(patients.userId, userId))
        .orderBy(desc(patients.isDefault), desc(patients.createdAt));

      const items: Patient[] = results.map((row) => ({
        ...row,
        age: row.age ?? null,
      }));
      return { items };
    } catch (error) {
      this.logger.error('获取就诊人列表失败', error);
      throw error;
    }
  }

  async create(dto: CreatePatientDto): Promise<Patient> {
    try {
      const values: typeof patients.$inferInsert = {
        userId: dto.userId,
        fullName: dto.fullName,
        idCard: dto.idCard ?? null,
        medicalCardNo: dto.medicalCardNo ?? null,
        phone: dto.phone ?? null,
        gender: dto.gender ?? null,
        age: dto.age ?? null,
        relationship: dto.relationship ?? null,
        isDefault: dto.isDefault ?? false,
      };

      // 如果设为默认，先把该用户其他就诊人的默认取消
      if (values.isDefault) {
        await this.db
          .update(patients)
          .set({ isDefault: false })
          .where(eq(patients.userId, dto.userId));
      }

      // 如果是第一个就诊人，自动设为默认
      if (!values.isDefault) {
        const existing = await this.db
          .select({ id: patients.id })
          .from(patients)
          .where(eq(patients.userId, dto.userId));
        if (existing.length === 0) {
          values.isDefault = true;
        }
      }

      const inserted = await this.db
        .insert(patients)
        .values(values)
        .returning({
          id: patients.id,
          userId: patients.userId,
          fullName: patients.fullName,
          idCard: patients.idCard,
          medicalCardNo: patients.medicalCardNo,
          phone: patients.phone,
          gender: patients.gender,
          age: patients.age,
          relationship: patients.relationship,
          isDefault: patients.isDefault,
        });

      const row = inserted[0];
      return {
        ...row,
        age: row.age ?? null,
      };
    } catch (error) {
      this.logger.error('创建就诊人失败', error);
      throw error;
    }
  }

  async update(id: string, dto: UpdatePatientDto, userId: string): Promise<Patient> {
    try {
      const existing = await this.db
        .select({ id: patients.id, userId: patients.userId })
        .from(patients)
        .where(eq(patients.id, id));
      if (existing.length === 0) {
        throw new NotFoundException('就诊人不存在');
      }
      if (existing[0].userId !== userId) {
        throw new ForbiddenException('无权修改该就诊人');
      }

      const patch: Partial<typeof patients.$inferInsert> = {};
      if (dto.fullName !== undefined) patch.fullName = dto.fullName;
      if (dto.idCard !== undefined) patch.idCard = dto.idCard;
      if (dto.medicalCardNo !== undefined) patch.medicalCardNo = dto.medicalCardNo;
      if (dto.phone !== undefined) patch.phone = dto.phone;
      if (dto.gender !== undefined) patch.gender = dto.gender;
      if (dto.age !== undefined) patch.age = dto.age;
      if (dto.relationship !== undefined) patch.relationship = dto.relationship;
      if (dto.isDefault !== undefined) patch.isDefault = dto.isDefault;

      if (Object.keys(patch).length === 0) {
        throw new BadRequestException('未提供可更新字段');
      }

      // 如果要设为默认，先取消其他默认
      if (patch.isDefault) {
        await this.db
          .update(patients)
          .set({ isDefault: false })
          .where(eq(patients.userId, userId));
      }

      const updated = await this.db
        .update(patients)
        .set(patch)
        .where(eq(patients.id, id))
        .returning({
          id: patients.id,
          userId: patients.userId,
          fullName: patients.fullName,
          idCard: patients.idCard,
          medicalCardNo: patients.medicalCardNo,
          phone: patients.phone,
          gender: patients.gender,
          age: patients.age,
          relationship: patients.relationship,
          isDefault: patients.isDefault,
        });

      if (updated.length === 0) {
        throw new NotFoundException('就诊人不存在');
      }

      const row = updated[0];
      return {
        ...row,
        age: row.age ?? null,
      };
    } catch (error) {
      this.logger.error(`更新就诊人失败: ${id}`, error);
      throw error;
    }
  }

  async remove(id: string, userId: string): Promise<void> {
    try {
      const existing = await this.db
        .select({ id: patients.id, userId: patients.userId })
        .from(patients)
        .where(eq(patients.id, id));
      if (existing.length === 0) {
        throw new NotFoundException('就诊人不存在');
      }
      if (existing[0].userId !== userId) {
        throw new ForbiddenException('无权删除该就诊人');
      }

      const deleted = await this.db
        .delete(patients)
        .where(eq(patients.id, id))
        .returning({ id: patients.id });

      if (deleted.length === 0) {
        throw new NotFoundException('就诊人不存在');
      }
    } catch (error) {
      this.logger.error(`删除就诊人失败: ${id}`, error);
      throw error;
    }
  }

  async setDefault(id: string, userId: string): Promise<Patient> {
    try {
      return await this.db.transaction(async (tx) => {
        const existing = await tx
          .select({ id: patients.id, userId: patients.userId })
          .from(patients)
          .where(eq(patients.id, id));
        if (existing.length === 0) {
          throw new NotFoundException('就诊人不存在');
        }
        if (existing[0].userId !== userId) {
          throw new ForbiddenException('无权修改该就诊人');
        }

        // 先把该用户所有就诊人设为 false
        await tx
          .update(patients)
          .set({ isDefault: false })
          .where(eq(patients.userId, userId));

        // 再把指定的设为 true
        const updated = await tx
          .update(patients)
          .set({ isDefault: true })
          .where(eq(patients.id, id))
          .returning({
            id: patients.id,
            userId: patients.userId,
            fullName: patients.fullName,
            idCard: patients.idCard,
            medicalCardNo: patients.medicalCardNo,
            phone: patients.phone,
            gender: patients.gender,
            age: patients.age,
            relationship: patients.relationship,
            isDefault: patients.isDefault,
          });

        if (updated.length === 0) {
          throw new NotFoundException('就诊人不存在');
        }

        const row = updated[0];
        return {
          ...row,
          age: row.age ?? null,
        };
      });
    } catch (error) {
      this.logger.error(`设置默认就诊人失败: ${id}`, error);
      throw error;
    }
  }
}
