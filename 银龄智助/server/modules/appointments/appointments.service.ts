import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { appointments, patients, departments, doctors, timeSlots } from '@server/database/schema';
import { eq, and, desc, gte } from 'drizzle-orm';
import type { Appointment, AppointmentStatus } from '@shared/api.interface';
import { CreateAppointmentDto } from './dto/create-appointment.dto';

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase) {}

  async list(userId: string, status?: string): Promise<{ items: Appointment[] }> {
    try {
      const conditions = [eq(appointments.userId, userId)];
      if (status) {
        conditions.push(eq(appointments.status, status));
      }

      const results = await this.db
        .select({
          id: appointments.id,
          userId: appointments.userId,
          patientId: appointments.patientId,
          patientName: patients.fullName,
          departmentId: appointments.departmentId,
          departmentName: departments.name,
          doctorId: appointments.doctorId,
          doctorName: doctors.name,
          timeSlotId: appointments.timeSlotId,
          appointmentDate: appointments.appointmentDate,
          appointmentTime: appointments.appointmentTime,
          status: appointments.status,
          fee: appointments.fee,
          isVoiceRegistration: appointments.isVoiceRegistration,
          totalDurationSeconds: appointments.totalDurationSeconds,
          source: appointments.source,
          createdAt: appointments.createdAt,
        })
        .from(appointments)
        .innerJoin(patients, eq(appointments.patientId, patients.id))
        .innerJoin(departments, eq(appointments.departmentId, departments.id))
        .leftJoin(doctors, eq(appointments.doctorId, doctors.id))
        .where(and(...conditions))
        .orderBy(desc(appointments.createdAt));

      const items: Appointment[] = results.map((row) => ({
        id: row.id,
        userId: row.userId,
        patientId: row.patientId,
        patientName: row.patientName,
        departmentId: row.departmentId,
        departmentName: row.departmentName,
        doctorId: row.doctorId ?? null,
        doctorName: row.doctorName ?? null,
        timeSlotId: row.timeSlotId ?? null,
        appointmentDate: String(row.appointmentDate),
        appointmentTime: row.appointmentTime ?? null,
        status: row.status as AppointmentStatus,
        fee: String(row.fee),
        isVoiceRegistration: row.isVoiceRegistration ?? false,
        totalDurationSeconds: row.totalDurationSeconds ?? null,
        source: row.source ?? 'elder',
        createdAt: row.createdAt.toISOString(),
      }));
      return { items };
    } catch (error) {
      this.logger.error('获取挂号记录列表失败', error);
      throw error;
    }
  }

  async getById(id: string): Promise<Appointment> {
    try {
      const results = await this.db
        .select({
          id: appointments.id,
          userId: appointments.userId,
          patientId: appointments.patientId,
          patientName: patients.fullName,
          departmentId: appointments.departmentId,
          departmentName: departments.name,
          doctorId: appointments.doctorId,
          doctorName: doctors.name,
          timeSlotId: appointments.timeSlotId,
          appointmentDate: appointments.appointmentDate,
          appointmentTime: appointments.appointmentTime,
          status: appointments.status,
          fee: appointments.fee,
          isVoiceRegistration: appointments.isVoiceRegistration,
          totalDurationSeconds: appointments.totalDurationSeconds,
          source: appointments.source,
          createdAt: appointments.createdAt,
        })
        .from(appointments)
        .innerJoin(patients, eq(appointments.patientId, patients.id))
        .innerJoin(departments, eq(appointments.departmentId, departments.id))
        .leftJoin(doctors, eq(appointments.doctorId, doctors.id))
        .where(eq(appointments.id, id));

      if (results.length === 0) {
        throw new NotFoundException('挂号记录不存在');
      }

      const row = results[0];
      return {
        id: row.id,
        userId: row.userId,
        patientId: row.patientId,
        patientName: row.patientName,
        departmentId: row.departmentId,
        departmentName: row.departmentName,
        doctorId: row.doctorId ?? null,
        doctorName: row.doctorName ?? null,
        timeSlotId: row.timeSlotId ?? null,
        appointmentDate: String(row.appointmentDate),
        appointmentTime: row.appointmentTime ?? null,
        status: row.status as AppointmentStatus,
        fee: String(row.fee),
        isVoiceRegistration: row.isVoiceRegistration ?? false,
        totalDurationSeconds: row.totalDurationSeconds ?? null,
        source: row.source ?? 'elder',
        createdAt: row.createdAt.toISOString(),
      };
    } catch (error) {
      this.logger.error(`获取挂号详情失败: ${id}`, error);
      throw error;
    }
  }

  async create(dto: CreateAppointmentDto): Promise<Appointment> {
    try {
      return await this.db.transaction(async (tx) => {
        // 1. 查询号源
        const slotResults = await tx
          .select({
            id: timeSlots.id,
            doctorId: timeSlots.doctorId,
            departmentId: timeSlots.departmentId,
            slotDate: timeSlots.slotDate,
            slotTime: timeSlots.slotTime,
            remainingQuota: timeSlots.remainingQuota,
            fee: timeSlots.fee,
          })
          .from(timeSlots)
          .where(eq(timeSlots.id, dto.timeSlotId));

        if (slotResults.length === 0) {
          throw new NotFoundException('号源不存在');
        }

        const slot = slotResults[0];
        if (slot.remainingQuota <= 0) {
          throw new ConflictException('号源已约满');
        }

        // 2. 原子扣减号源剩余量
        const updatedSlots = await tx
          .update(timeSlots)
          .set({ remainingQuota: slot.remainingQuota - 1 })
          .where(
            and(
              eq(timeSlots.id, dto.timeSlotId),
              gte(timeSlots.remainingQuota, 1),
            ),
          )
          .returning({ id: timeSlots.id });

        if (updatedSlots.length === 0) {
          throw new ConflictException('号源不足，挂号失败');
        }

        // 3. 创建挂号记录
        const inserted = await tx
          .insert(appointments)
          .values({
            userId: dto.userId,
            patientId: dto.patientId,
            departmentId: dto.departmentId,
            doctorId: dto.doctorId ?? slot.doctorId,
            timeSlotId: dto.timeSlotId,
            appointmentDate: slot.slotDate,
            appointmentTime: slot.slotTime,
            status: 'confirmed',
            fee: slot.fee,
            isVoiceRegistration: dto.isVoiceRegistration ?? true,
            totalDurationSeconds: dto.totalDurationSeconds ?? null,
            source: dto.source ?? 'elder',
          })
          .returning({ id: appointments.id });

        const appointmentId = inserted[0].id;

        // 4. 查询完整记录（含 join）
        const detailResults = await tx
          .select({
            id: appointments.id,
            userId: appointments.userId,
            patientId: appointments.patientId,
            patientName: patients.fullName,
            departmentId: appointments.departmentId,
            departmentName: departments.name,
            doctorId: appointments.doctorId,
            doctorName: doctors.name,
            timeSlotId: appointments.timeSlotId,
            appointmentDate: appointments.appointmentDate,
            appointmentTime: appointments.appointmentTime,
            status: appointments.status,
            fee: appointments.fee,
            isVoiceRegistration: appointments.isVoiceRegistration,
            totalDurationSeconds: appointments.totalDurationSeconds,
            source: appointments.source,
            createdAt: appointments.createdAt,
          })
          .from(appointments)
          .innerJoin(patients, eq(appointments.patientId, patients.id))
          .innerJoin(departments, eq(appointments.departmentId, departments.id))
          .leftJoin(doctors, eq(appointments.doctorId, doctors.id))
          .where(eq(appointments.id, appointmentId));

        const row = detailResults[0];
        return {
          id: row.id,
          userId: row.userId,
          patientId: row.patientId,
          patientName: row.patientName,
          departmentId: row.departmentId,
          departmentName: row.departmentName,
          doctorId: row.doctorId ?? null,
          doctorName: row.doctorName ?? null,
          timeSlotId: row.timeSlotId ?? null,
          appointmentDate: String(row.appointmentDate),
          appointmentTime: row.appointmentTime ?? null,
          status: row.status as AppointmentStatus,
          fee: String(row.fee),
          isVoiceRegistration: row.isVoiceRegistration ?? false,
          totalDurationSeconds: row.totalDurationSeconds ?? null,
          source: row.source ?? 'elder',
          createdAt: row.createdAt.toISOString(),
        };
      });
    } catch (error) {
      this.logger.error('创建挂号失败', error);
      throw error;
    }
  }

  async cancel(id: string): Promise<Appointment> {
    try {
      return await this.db.transaction(async (tx) => {
        // 1. 查询挂号记录
        const existing = await tx
          .select({
            id: appointments.id,
            status: appointments.status,
            timeSlotId: appointments.timeSlotId,
          })
          .from(appointments)
          .where(eq(appointments.id, id));

        if (existing.length === 0) {
          throw new NotFoundException('挂号记录不存在');
        }

        const appointment = existing[0];
        if (appointment.status === 'cancelled') {
          throw new BadRequestException('该挂号已取消');
        }
        if (appointment.status === 'completed') {
          throw new BadRequestException('已完成的挂号不能取消');
        }

        // 2. 恢复号源剩余量
        if (appointment.timeSlotId) {
          const slotResults = await tx
            .select({ remainingQuota: timeSlots.remainingQuota, totalQuota: timeSlots.totalQuota })
            .from(timeSlots)
            .where(eq(timeSlots.id, appointment.timeSlotId));

          if (slotResults.length > 0) {
            const slot = slotResults[0];
            if (slot.remainingQuota < slot.totalQuota) {
              await tx
                .update(timeSlots)
                .set({ remainingQuota: slot.remainingQuota + 1 })
                .where(eq(timeSlots.id, appointment.timeSlotId));
            }
          }
        }

        // 3. 更新状态为 cancelled
        const updated = await tx
          .update(appointments)
          .set({ status: 'cancelled' })
          .where(eq(appointments.id, id))
          .returning({ id: appointments.id });

        if (updated.length === 0) {
          throw new NotFoundException('挂号记录不存在');
        }

        // 4. 查询完整记录
        const detailResults = await tx
          .select({
            id: appointments.id,
            userId: appointments.userId,
            patientId: appointments.patientId,
            patientName: patients.fullName,
            departmentId: appointments.departmentId,
            departmentName: departments.name,
            doctorId: appointments.doctorId,
            doctorName: doctors.name,
            timeSlotId: appointments.timeSlotId,
            appointmentDate: appointments.appointmentDate,
            appointmentTime: appointments.appointmentTime,
            status: appointments.status,
            fee: appointments.fee,
            isVoiceRegistration: appointments.isVoiceRegistration,
            totalDurationSeconds: appointments.totalDurationSeconds,
            source: appointments.source,
            createdAt: appointments.createdAt,
          })
          .from(appointments)
          .innerJoin(patients, eq(appointments.patientId, patients.id))
          .innerJoin(departments, eq(appointments.departmentId, departments.id))
          .leftJoin(doctors, eq(appointments.doctorId, doctors.id))
          .where(eq(appointments.id, id));

        const row = detailResults[0];
        return {
          id: row.id,
          userId: row.userId,
          patientId: row.patientId,
          patientName: row.patientName,
          departmentId: row.departmentId,
          departmentName: row.departmentName,
          doctorId: row.doctorId ?? null,
          doctorName: row.doctorName ?? null,
          timeSlotId: row.timeSlotId ?? null,
          appointmentDate: String(row.appointmentDate),
          appointmentTime: row.appointmentTime ?? null,
          status: row.status as AppointmentStatus,
          fee: String(row.fee),
          isVoiceRegistration: row.isVoiceRegistration ?? false,
          totalDurationSeconds: row.totalDurationSeconds ?? null,
          source: row.source ?? 'elder',
          createdAt: row.createdAt.toISOString(),
        };
      });
    } catch (error) {
      this.logger.error(`取消挂号失败: ${id}`, error);
      throw error;
    }
  }
}
