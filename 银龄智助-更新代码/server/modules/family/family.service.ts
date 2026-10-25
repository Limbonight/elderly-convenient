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
import { eq, desc, and, inArray } from 'drizzle-orm';
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
        // 记录修改前的姓名，用于精确同步就诊人记录（避免把其他就诊人一起改名）
        const [beforeUser] = await tx
          .select({ fullName: users.fullName })
          .from(users)
          .where(eq(users.id, binding.elderUserId))
          .limit(1);
        const oldName = beforeUser?.fullName ?? '';

        await tx
          .update(users)
          .set(userUpdate)
          .where(eq(users.id, binding.elderUserId));

        // 同步老年端就诊人信息：只更新与该老人同名的记录，保证子女端改完老年端立刻可见
        if (oldName) {
          const patientUpdate: { fullName?: string; phone?: string } = {};
          if (userUpdate.fullName) patientUpdate.fullName = userUpdate.fullName;
          if (userUpdate.phone) patientUpdate.phone = userUpdate.phone;
          if (Object.keys(patientUpdate).length > 0) {
            await tx
              .update(patients)
              .set(patientUpdate)
              .where(
                and(
                  eq(patients.userId, binding.elderUserId),
                  eq(patients.fullName, oldName),
                ),
              );
          }
        }
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

  /**
   * 老年端挂号的"就诊人"候选：直接取子女端维护的老人信息（同一家庭组内的老人）。
   * 不再返回"本人/配偶"这类关系标签，姓名/电话均为子女端最新修改后的内容。
   */
  async listRegistrationPatients(elderUserId: string): Promise<{
    items: Array<{ id: string; name: string; phone: string }>;
  }> {
    // 1. 找到与该老人关联的家庭账号
    const myBindings = await this.db
      .select({ familyUserId: familyBindings.familyUserId })
      .from(familyBindings)
      .where(
        and(
          eq(familyBindings.elderUserId, elderUserId),
          eq(familyBindings.isActive, true),
        ),
      );
    const familyIds = [...new Set(myBindings.map((b) => b.familyUserId))];

    // 2. 同一家庭账号下的全部老人
    const elderIdSet = new Set<string>([elderUserId]);
    if (familyIds.length > 0) {
      const siblings = await this.db
        .select({ elderUserId: familyBindings.elderUserId })
        .from(familyBindings)
        .where(
          and(
            inArray(familyBindings.familyUserId, familyIds),
            eq(familyBindings.isActive, true),
          ),
        );
      siblings.forEach((s) => elderIdSet.add(s.elderUserId));
    }

    const elderUsers = await this.db
      .select({ id: users.id, fullName: users.fullName, phone: users.phone })
      .from(users)
      .where(inArray(users.id, [...elderIdSet]));

    // 3. 每位老人各自维护一条就诊人记录，缺失的补建，保证挂号可写入 patientId。
    //    记录归属到老人本人（userId = 老人 id），这样子女端改名后能精确同步到对应就诊人。
    const existing = await this.db
      .select({ id: patients.id, userId: patients.userId, fullName: patients.fullName })
      .from(patients)
      .where(inArray(patients.userId, [...elderIdSet]));

    const items: Array<{ id: string; name: string; phone: string }> = [];
    const seen = new Set<string>();
    for (const u of elderUsers) {
      const name = (u.fullName ?? '').trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);

      let patientId = existing.find((p) => p.userId === u.id && p.fullName === name)?.id;
      if (!patientId) {
        const [created] = await this.db
          .insert(patients)
          .values({
            userId: u.id,
            fullName: name,
            phone: u.phone ?? '',
            isDefault: false,
          })
          .returning({ id: patients.id });
        patientId = created.id;
        existing.push({ id: created.id, userId: u.id, fullName: name });
      }
      items.push({ id: patientId, name, phone: u.phone ?? '' });
    }

    return { items };
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
