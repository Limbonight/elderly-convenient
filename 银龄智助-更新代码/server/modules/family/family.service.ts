import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import {
  DRIZZLE_DATABASE,
  type PostgresJsDatabase,
} from '@lark-apaas/fullstack-nestjs-core';
import {
  familyBindings,
  familyNotifications,
  users,
  appointments,
  departments,
  doctors,
  patients,
} from '@server/database/schema';
import { eq, desc, and } from 'drizzle-orm';
import type {
  FamilyBinding,
  FamilyNotification,
  Appointment,
} from '@shared/api.interface';
import type {
  CreateFamilyBindingDto,
  CreateNotificationDto,
  UpdateFamilyBindingDto,
} from './dto';

@Injectable()
export class FamilyService {
  private readonly logger = new Logger(FamilyService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async listBindings(familyUserId: string): Promise<{ items: FamilyBinding[] }> {
    const results = await this.db
      .select({
        id: familyBindings.id,
        familyUserId: familyBindings.familyUserId,
        elderUserId: familyBindings.elderUserId,
        elderName: users.fullName,
        relationship: familyBindings.relationship,
        isActive: familyBindings.isActive,
      })
      .from(familyBindings)
      .innerJoin(users, eq(familyBindings.elderUserId, users.id))
      .where(
        and(
          eq(familyBindings.familyUserId, familyUserId),
          eq(familyBindings.isActive, true),
        ),
      )
      .orderBy(desc(familyBindings.createdAt));

    return {
      items: results.map((r) => ({
        id: r.id,
        familyUserId: r.familyUserId,
        elderUserId: r.elderUserId,
        elderName: r.elderName,
        relationship: r.relationship,
        isActive: r.isActive ?? true,
      })),
    };
  }

  async createBinding(dto: CreateFamilyBindingDto): Promise<FamilyBinding> {
    return this.db.transaction(async (tx) => {
      // 1. 按手机号查找 elder 用户
      const userResults = await tx
        .select()
        .from(users)
        .where(
          and(
            eq(users.phone, dto.elderPhone),
            eq(users.userRole, 'elder'),
          ),
        )
        .limit(1);
      let elderUser = userResults[0] ?? null;

      // 2. 找不到则创建新的 elder 用户
      if (!elderUser) {
        const [newUser] = await tx
          .insert(users)
          .values({
            fullName: dto.elderName,
            phone: dto.elderPhone,
            userRole: 'elder',
          })
          .returning();
        elderUser = newUser;
      }

      // 3. 检查是否已绑定
      const existingResults = await tx
        .select()
        .from(familyBindings)
        .where(
          and(
            eq(familyBindings.familyUserId, dto.familyUserId),
            eq(familyBindings.elderUserId, elderUser.id),
          ),
        )
        .limit(1);
      const existing = existingResults[0] ?? null;

      if (existing) {
        // 如果已存在但非活跃，重新激活
        if (!existing.isActive) {
          const [updated] = await tx
            .update(familyBindings)
            .set({ isActive: true, relationship: dto.relationship })
            .where(eq(familyBindings.id, existing.id))
            .returning();
          return {
            id: updated.id,
            familyUserId: updated.familyUserId,
            elderUserId: updated.elderUserId,
            elderName: elderUser.fullName,
            relationship: updated.relationship,
            isActive: updated.isActive ?? true,
          };
        }
        throw new ConflictException('该老人已与您绑定');
      }

      // 4. 创建绑定记录
      const [binding] = await tx
        .insert(familyBindings)
        .values({
          familyUserId: dto.familyUserId,
          elderUserId: elderUser.id,
          relationship: dto.relationship,
          isActive: true,
        })
        .returning();

      return {
        id: binding.id,
        familyUserId: binding.familyUserId,
        elderUserId: binding.elderUserId,
        elderName: elderUser.fullName,
        relationship: binding.relationship,
        isActive: binding.isActive ?? true,
      };
    });
  }

  async removeBinding(id: string): Promise<void> {
    const result = await this.db
      .update(familyBindings)
      .set({ isActive: false })
      .where(eq(familyBindings.id, id))
      .returning({ id: familyBindings.id });

    if (result.length === 0) {
      throw new NotFoundException('绑定记录不存在');
    }
  }

  /**
   * 子女端"我的父母"列表：返回绑定的老人摘要信息
   */
  async listMembers(
    familyUserId: string,
  ): Promise<{
    items: Array<{
      id: string;
      name: string;
      relation: string;
      phone: string;
      idCard: string;
    }>;
  }> {
    const results = await this.db
      .select({
        id: familyBindings.id,
        elderName: users.fullName,
        elderPhone: users.phone,
        relationship: familyBindings.relationship,
      })
      .from(familyBindings)
      .innerJoin(users, eq(familyBindings.elderUserId, users.id))
      .where(
        and(
          eq(familyBindings.familyUserId, familyUserId),
          eq(familyBindings.isActive, true),
        ),
      )
      .orderBy(desc(familyBindings.createdAt));

    return {
      items: results.map((r) => ({
        id: r.id,
        name: r.elderName,
        relation: r.relationship ?? 'other',
        phone: r.elderPhone ?? '',
        idCard: '',
      })),
    };
  }

  /**
   * 修改绑定的老人信息：同步更新 users 表中的姓名/手机号，以及绑定关系
   */
  async updateBinding(
    id: string,
    dto: UpdateFamilyBindingDto,
  ): Promise<FamilyBinding> {
    return this.db.transaction(async (tx) => {
      const bindingResults = await tx
        .select()
        .from(familyBindings)
        .where(eq(familyBindings.id, id))
        .limit(1);
      const binding = bindingResults[0];
      if (!binding) {
        throw new NotFoundException('绑定记录不存在');
      }

      // 更新老人用户信息
      const userUpdate: { fullName?: string; phone?: string } = {};
      if (dto.elderName !== undefined && dto.elderName !== '') {
        userUpdate.fullName = dto.elderName;
      }
      if (dto.elderPhone !== undefined && dto.elderPhone !== '') {
        userUpdate.phone = dto.elderPhone;
      }
      if (Object.keys(userUpdate).length > 0) {
        await tx
          .update(users)
          .set(userUpdate)
          .where(eq(users.id, binding.elderUserId));

        // 同步更新老年端就诊人信息，保证子女端修改后老年端挂号时看到的是新信息
        const patientUpdate: { fullName?: string; phone?: string } = {};
        if (userUpdate.fullName) patientUpdate.fullName = userUpdate.fullName;
        if (userUpdate.phone) patientUpdate.phone = userUpdate.phone;
        await tx
          .update(patients)
          .set(patientUpdate)
          .where(eq(patients.userId, binding.elderUserId));
      }

      // 更新绑定关系
      if (dto.relationship !== undefined && dto.relationship !== '') {
        await tx
          .update(familyBindings)
          .set({ relationship: dto.relationship })
          .where(eq(familyBindings.id, id));
      }

      const [updatedUser] = await tx
        .select({ fullName: users.fullName })
        .from(users)
        .where(eq(users.id, binding.elderUserId))
        .limit(1);

      return {
        id: binding.id,
        familyUserId: binding.familyUserId,
        elderUserId: binding.elderUserId,
        elderName: updatedUser?.fullName ?? binding.elderUserId,
        relationship: dto.relationship ?? binding.relationship,
        isActive: binding.isActive ?? true,
      };
    });
  }

  async listNotifications(
    familyUserId: string,
  ): Promise<{ items: FamilyNotification[] }> {
    const results = await this.db
      .select()
      .from(familyNotifications)
      .where(eq(familyNotifications.familyUserId, familyUserId))
      .orderBy(desc(familyNotifications.createdAt))
      .limit(50);

    return {
      items: results.map((r) => this.toFamilyNotification(r)),
    };
  }

  async createNotification(
    dto: CreateNotificationDto,
  ): Promise<FamilyNotification> {
    const [record] = await this.db
      .insert(familyNotifications)
      .values({
        familyUserId: dto.familyUserId,
        elderUserId: dto.elderUserId,
        elderName: dto.elderName,
        notificationType: dto.notificationType,
        content: dto.content,
        isRead: false,
        appointmentId: dto.appointmentId,
      })
      .returning();

    return this.toFamilyNotification(record);
  }

  async markNotificationRead(id: string): Promise<FamilyNotification> {
    const [updated] = await this.db
      .update(familyNotifications)
      .set({ isRead: true })
      .where(eq(familyNotifications.id, id))
      .returning();

    if (!updated) {
      throw new NotFoundException('通知不存在');
    }

    return this.toFamilyNotification(updated);
  }

  async getElderAppointments(
    elderUserId: string,
  ): Promise<{ items: Appointment[] }> {
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
      .where(eq(appointments.userId, elderUserId))
      .orderBy(desc(appointments.appointmentDate), desc(appointments.createdAt))
      .limit(20);

    return {
      items: results.map((r) => ({
        id: r.id,
        userId: r.userId,
        patientId: r.patientId,
        patientName: r.patientName,
        departmentId: r.departmentId,
        departmentName: r.departmentName,
        doctorId: r.doctorId,
        doctorName: r.doctorName,
        timeSlotId: r.timeSlotId,
        appointmentDate: String(r.appointmentDate),
        appointmentTime: r.appointmentTime,
        status: r.status as Appointment['status'],
        fee: String(r.fee),
        isVoiceRegistration: r.isVoiceRegistration ?? false,
        totalDurationSeconds: r.totalDurationSeconds,
        source: r.source ?? 'elder',
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  private toFamilyNotification(
    row: typeof familyNotifications.$inferSelect,
  ): FamilyNotification {
    return {
      id: row.id,
      familyUserId: row.familyUserId,
      elderUserId: row.elderUserId,
      elderName: row.elderName,
      notificationType: row.notificationType,
      content: row.content,
      isRead: row.isRead ?? false,
      appointmentId: row.appointmentId,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
