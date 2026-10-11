/* eslint-disable */
/** auto generated, do not edit */
import { sql } from 'drizzle-orm';
import { boolean, date, foreignKey, index, integer, jsonb, numeric, pgTable, text, uniqueIndex, uuid, varchar, customType } from "drizzle-orm/pg-core"

export const customTimestamptz = customType<{
  data: Date;
  driverData: string;
  config: { precision?: number };
}>({
  dataType(config) {
    const precision = typeof config?.precision !== 'undefined'
      ? ` (${config.precision})`
      : '';
    return `timestamptz${precision}`;
  },
  toDriver(value: Date | string | number) {
    if (value == null) return value as any;
    if (typeof value === 'number') return new Date(value).toISOString();
    if (typeof value === 'string') return value;
    if (value instanceof Date) return value.toISOString();
    throw new Error('Invalid timestamp value');
  },
  fromDriver(value: string | Date): Date {
    if (value instanceof Date) return value;
    return new Date(value);
  },
});

export const userProfile = customType<{
  data: string;
  driverData: string;
}>({
  dataType() {
    return 'user_profile';
  },
  toDriver(value: string) {
    return sql`ROW(${value})::user_profile`;
  },
  fromDriver(value: string) {
    const [userId] = value.slice(1, -1).split(',');
    return userId.trim();
  },
});

export type FileAttachment = {
  bucket_id: string;
  file_path: string;
};

export const fileAttachment = customType<{
  data: FileAttachment;
  driverData: string;
}>({
  dataType() {
    return 'file_attachment';
  },
  toDriver(value: FileAttachment) {
    return sql`ROW(${value.bucket_id},${value.file_path})::file_attachment`;
  },
  fromDriver(value: string): FileAttachment {
    const [bucketId, filePath] = value.slice(1, -1).split(',');
    return { bucket_id: bucketId.trim(), file_path: filePath.trim() };
  },
});

export function escapeLiteral(str: string): string {
  return "'" + str.replace(/'/g, "''") + "'";
}

export const userProfileArray = customType<{
  data: string[];
  driverData: string;
}>({
  dataType() {
    return 'user_profile[]';
  },
  toDriver(value: string[]) {
    if (!value || value.length === 0) {
      return sql`'{}'::user_profile[]`;
    }
    const elements = value.map(id => `ROW(${escapeLiteral(id)})::user_profile`).join(',');
    return sql.raw(`ARRAY[${elements}]::user_profile[]`);
  },
  fromDriver(value: string): string[] {
    if (!value || value === '{}') return [];
    const inner = value.slice(1, -1);
    const matches = inner.match(/\([^)]*\)/g) || [];
    return matches.map(m => m.slice(1, -1).split(',')[0].trim());
  },
});

export const fileAttachmentArray = customType<{
  data: FileAttachment[];
  driverData: string;
}>({
  dataType() {
    return 'file_attachment[]';
  },
  toDriver(value: FileAttachment[]) {
    if (!value || value.length === 0) {
      return sql`'{}'::file_attachment[]`;
    }
    const elements = value.map(f =>
      `ROW(${escapeLiteral(f.bucket_id)},${escapeLiteral(f.file_path)})::file_attachment`
    ).join(',');
    return sql.raw(`ARRAY[${elements}]::file_attachment[]`);
  },
  fromDriver(value: string): FileAttachment[] {
    if (!value || value === '{}') return [];
    const inner = value.slice(1, -1);
    const matches = inner.match(/\([^)]*\)/g) || [];
    return matches.map(m => {
      const [bucketId, filePath] = m.slice(1, -1).split(',');
      return { bucket_id: bucketId.trim(), file_path: filePath.trim() };
    });
  },
});

export const familyNotifications = pgTable("family_notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  familyUserId: uuid("family_user_id").notNull(),
  elderUserId: uuid("elder_user_id"),
  elderName: varchar("elder_name", { length: 100 }),
  notificationType: varchar("notification_type", { length: 50 }).notNull(),
  content: text("content").notNull(),
  isRead: boolean("is_read").default(false),
  appointmentId: uuid("appointment_id"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  foreignKey({
    columns: [table.familyUserId],
    foreignColumns: [users.id],
    name: "family_notifications_family_user_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.elderUserId],
    foreignColumns: [users.id],
    name: "family_notifications_elder_user_id_fkey",
  }),
  foreignKey({
    columns: [table.appointmentId],
    foreignColumns: [appointments.id],
    name: "family_notifications_appointment_id_fkey",
  }),
]);

export const familyBindings = pgTable("family_bindings", {
  id: uuid("id").primaryKey().defaultRandom(),
  familyUserId: uuid("family_user_id").notNull(),
  elderUserId: uuid("elder_user_id").notNull(),
  relationship: varchar("relationship", { length: 20 }),
  isActive: boolean("is_active").default(true),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("family_bindings_family_user_id_elder_user_id_key").on(table.familyUserId, table.elderUserId),
  foreignKey({
    columns: [table.familyUserId],
    foreignColumns: [users.id],
    name: "family_bindings_family_user_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.elderUserId],
    foreignColumns: [users.id],
    name: "family_bindings_elder_user_id_fkey",
  }).onDelete("cascade"),
]);

export const analyticsEvents = pgTable("analytics_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventName: varchar("event_name", { length: 100 }).notNull(),
  userId: uuid("user_id"),
  sessionId: varchar("session_id", { length: 100 }),
  /**
   * @type { Record<string, unknown> }
   */
  properties: jsonb("properties"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
    name: "analytics_events_user_id_fkey",
  }).onDelete("set null"),
]);

export const fraudWarnings = pgTable("fraud_warnings", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id"),
  triggerWord: varchar("trigger_word", { length: 100 }).notNull(),
  triggerSource: varchar("trigger_source", { length: 50 }),
  pageLocation: varchar("page_location", { length: 100 }),
  notifiedFamily: boolean("notified_family").default(false),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
    name: "fraud_warnings_user_id_fkey",
  }).onDelete("set null"),
]);

export const voiceLogs = pgTable("voice_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id"),
  sessionId: varchar("session_id", { length: 100 }),
  stepNumber: integer("step_number"),
  recognizedText: text("recognized_text"),
  finalText: text("final_text"),
  dialect: varchar("dialect", { length: 50 }),
  retryCount: integer("retry_count").default(0),
  isSuccess: boolean("is_success").default(true),
  durationMs: integer("duration_ms"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
    name: "voice_logs_user_id_fkey",
  }).onDelete("set null"),
]);

export const appointments = pgTable("appointments", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  patientId: uuid("patient_id").notNull(),
  departmentId: uuid("department_id").notNull(),
  doctorId: uuid("doctor_id"),
  timeSlotId: uuid("time_slot_id"),
  appointmentDate: date("appointment_date").notNull(),
  appointmentTime: varchar("appointment_time", { length: 20 }),
  status: varchar("status", { length: 20 }).notNull().default('pending'),
  fee: numeric("fee").default('0.00'),
  isVoiceRegistration: boolean("is_voice_registration").default(true),
  totalDurationSeconds: integer("total_duration_seconds"),
  source: varchar("source", { length: 20 }).default('elder'),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
    name: "appointments_user_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.patientId],
    foreignColumns: [patients.id],
    name: "appointments_patient_id_fkey",
  }),
  foreignKey({
    columns: [table.departmentId],
    foreignColumns: [departments.id],
    name: "appointments_department_id_fkey",
  }),
  foreignKey({
    columns: [table.doctorId],
    foreignColumns: [doctors.id],
    name: "appointments_doctor_id_fkey",
  }),
  foreignKey({
    columns: [table.timeSlotId],
    foreignColumns: [timeSlots.id],
    name: "appointments_time_slot_id_fkey",
  }),
]);

export const timeSlots = pgTable("time_slots", {
  id: uuid("id").primaryKey().defaultRandom(),
  doctorId: uuid("doctor_id").notNull(),
  departmentId: uuid("department_id").notNull(),
  slotDate: date("slot_date").notNull(),
  slotPeriod: varchar("slot_period", { length: 20 }).notNull(),
  slotTime: varchar("slot_time", { length: 20 }).notNull(),
  totalQuota: integer("total_quota").notNull().default(20),
  remainingQuota: integer("remaining_quota").notNull().default(20),
  fee: numeric("fee").default('0.00'),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  foreignKey({
    columns: [table.doctorId],
    foreignColumns: [doctors.id],
    name: "time_slots_doctor_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.departmentId],
    foreignColumns: [departments.id],
    name: "time_slots_department_id_fkey",
  }).onDelete("cascade"),
]);

export const doctors = pgTable("doctors", {
  id: uuid("id").primaryKey().defaultRandom(),
  departmentId: uuid("department_id").notNull(),
  name: varchar("name", { length: 50 }).notNull(),
  title: varchar("title", { length: 50 }),
  avatarUrl: text("avatar_url"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  foreignKey({
    columns: [table.departmentId],
    foreignColumns: [departments.id],
    name: "doctors_department_id_fkey",
  }).onDelete("cascade"),
]);

export const departments = pgTable("departments", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 50 }).notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").default(0),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const patients = pgTable("patients", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  fullName: varchar("full_name", { length: 100 }).notNull(),
  idCard: varchar("id_card", { length: 20 }),
  medicalCardNo: varchar("medical_card_no", { length: 50 }),
  phone: varchar("phone", { length: 20 }),
  gender: varchar("gender", { length: 10 }),
  age: integer("age"),
  relationship: varchar("relationship", { length: 20 }),
  isDefault: boolean("is_default").default(false),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
    name: "patients_user_id_fkey",
  }).onDelete("cascade"),
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  userRole: varchar("user_role", { length: 20 }).notNull().default('elder'),
  phone: varchar("phone", { length: 20 }),
  fullName: varchar("full_name", { length: 100 }).notNull(),
  dialect: varchar("dialect", { length: 50 }).default('mandarin'),
  speechRate: numeric("speech_rate").default('0.9'),
  highContrastMode: boolean("high_contrast_mode").default(false),
  fontSizeLevel: integer("font_size_level").default(1),
  emergencyContactName: varchar("emergency_contact_name", { length: 100 }),
  emergencyContactPhone: varchar("emergency_contact_phone", { length: 20 }),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
});

// table aliases
export const analyticsEventsTable = analyticsEvents;
export const appointmentsTable = appointments;
export const departmentsTable = departments;
export const doctorsTable = doctors;
export const familyBindingsTable = familyBindings;
export const familyNotificationsTable = familyNotifications;
export const fraudWarningsTable = fraudWarnings;
export const patientsTable = patients;
export const timeSlotsTable = timeSlots;
export const usersTable = users;
export const voiceLogsTable = voiceLogs;
