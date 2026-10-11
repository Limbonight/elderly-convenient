import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { departments, doctors, timeSlots } from '@server/database/schema';
import { eq, and, asc, gt } from 'drizzle-orm';
import type { Department, Doctor, TimeSlot } from '@shared/api.interface';

@Injectable()
export class DepartmentsService {
  private readonly logger = new Logger(DepartmentsService.name);

  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase) {}

  async list(): Promise<{ items: Department[] }> {
    try {
      const results: Department[] = await this.db
        .select({
          id: departments.id,
          name: departments.name,
          description: departments.description,
          sortOrder: departments.sortOrder,
        })
        .from(departments)
        .orderBy(asc(departments.sortOrder), asc(departments.name));
      return { items: results };
    } catch (error) {
      this.logger.error('获取科室列表失败', error);
      throw error;
    }
  }

  async getDoctors(departmentId: string): Promise<{ items: Doctor[] }> {
    try {
      const dept = await this.db
        .select({ id: departments.id })
        .from(departments)
        .where(eq(departments.id, departmentId));
      if (dept.length === 0) {
        throw new NotFoundException('科室不存在');
      }

      const results: Doctor[] = await this.db
        .select({
          id: doctors.id,
          departmentId: doctors.departmentId,
          name: doctors.name,
          title: doctors.title,
        })
        .from(doctors)
        .where(eq(doctors.departmentId, departmentId))
        .orderBy(asc(doctors.name));
      return { items: results };
    } catch (error) {
      this.logger.error(`获取科室医生列表失败: ${departmentId}`, error);
      throw error;
    }
  }

  async getTimeSlotsByDepartment(
    departmentId: string,
    date?: string,
  ): Promise<{ items: TimeSlot[] }> {
    try {
      const dept = await this.db
        .select({ id: departments.id })
        .from(departments)
        .where(eq(departments.id, departmentId));
      if (dept.length === 0) {
        throw new NotFoundException('科室不存在');
      }

      const conditions = [eq(timeSlots.departmentId, departmentId)];
      if (date) {
        conditions.push(eq(timeSlots.slotDate, date));
      } else {
        const today = new Date().toISOString().split('T')[0];
        conditions.push(gt(timeSlots.slotDate, today));
      }

      const results = await this.db
        .select({
          id: timeSlots.id,
          doctorId: timeSlots.doctorId,
          departmentId: timeSlots.departmentId,
          slotDate: timeSlots.slotDate,
          slotPeriod: timeSlots.slotPeriod,
          slotTime: timeSlots.slotTime,
          totalQuota: timeSlots.totalQuota,
          remainingQuota: timeSlots.remainingQuota,
          fee: timeSlots.fee,
          doctorName: doctors.name,
          departmentName: departments.name,
        })
        .from(timeSlots)
        .innerJoin(doctors, eq(timeSlots.doctorId, doctors.id))
        .innerJoin(departments, eq(timeSlots.departmentId, departments.id))
        .where(and(...conditions))
        .orderBy(asc(timeSlots.slotDate), asc(timeSlots.slotTime));

      const items: TimeSlot[] = results.map((row) => ({
        id: row.id,
        doctorId: row.doctorId,
        departmentId: row.departmentId,
        slotDate: String(row.slotDate),
        slotPeriod: row.slotPeriod,
        slotTime: row.slotTime,
        totalQuota: row.totalQuota,
        remainingQuota: row.remainingQuota,
        fee: String(row.fee),
      }));
      return { items };
    } catch (error) {
      this.logger.error(`获取科室号源失败: ${departmentId}`, error);
      throw error;
    }
  }

  async getTimeSlotsByDoctor(doctorId: string): Promise<{ items: TimeSlot[] }> {
    try {
      const doc = await this.db
        .select({ id: doctors.id })
        .from(doctors)
        .where(eq(doctors.id, doctorId));
      if (doc.length === 0) {
        throw new NotFoundException('医生不存在');
      }

      const today = new Date().toISOString().split('T')[0];
      const results = await this.db
        .select({
          id: timeSlots.id,
          doctorId: timeSlots.doctorId,
          departmentId: timeSlots.departmentId,
          slotDate: timeSlots.slotDate,
          slotPeriod: timeSlots.slotPeriod,
          slotTime: timeSlots.slotTime,
          totalQuota: timeSlots.totalQuota,
          remainingQuota: timeSlots.remainingQuota,
          fee: timeSlots.fee,
          doctorName: doctors.name,
          departmentName: departments.name,
        })
        .from(timeSlots)
        .innerJoin(doctors, eq(timeSlots.doctorId, doctors.id))
        .innerJoin(departments, eq(timeSlots.departmentId, departments.id))
        .where(and(eq(timeSlots.doctorId, doctorId), gt(timeSlots.slotDate, today)))
        .orderBy(asc(timeSlots.slotDate), asc(timeSlots.slotTime));

      const items: TimeSlot[] = results.map((row) => ({
        id: row.id,
        doctorId: row.doctorId,
        departmentId: row.departmentId,
        slotDate: String(row.slotDate),
        slotPeriod: row.slotPeriod,
        slotTime: row.slotTime,
        totalQuota: row.totalQuota,
        remainingQuota: row.remainingQuota,
        fee: String(row.fee),
      }));
      return { items };
    } catch (error) {
      this.logger.error(`获取医生号源失败: ${doctorId}`, error);
      throw error;
    }
  }
}
