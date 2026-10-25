// 老年友好型线上挂号系统 - 前后端共享类型

export type UserRole = 'elder' | 'family';

export interface User {
  id: string;
  userRole: UserRole;
  phone: string | null;
  fullName: string;
  dialect: string;
  speechRate: number;
  highContrastMode: boolean;
  fontSizeLevel: number;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
}

export interface Patient {
  id: string;
  userId: string;
  fullName: string;
  idCard: string | null;
  medicalCardNo: string | null;
  phone: string | null;
  gender: string | null;
  age: number | null;
  relationship: string | null;
  isDefault: boolean;
}

export interface Department {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
}

export interface Doctor {
  id: string;
  departmentId: string;
  name: string;
  title: string | null;
}

export interface TimeSlot {
  id: string;
  doctorId: string;
  departmentId: string;
  slotDate: string;
  slotPeriod: string;
  slotTime: string;
  totalQuota: number;
  remainingQuota: number;
  fee: string;
  doctorName?: string;
  doctorTitle?: string;
  departmentName?: string;
}

export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

export interface Appointment {
  id: string;
  userId: string;
  patientId: string;
  patientName: string;
  departmentId: string;
  departmentName: string;
  doctorId: string | null;
  doctorName: string | null;
  timeSlotId: string | null;
  appointmentDate: string;
  appointmentTime: string | null;
  status: AppointmentStatus;
  fee: string;
  isVoiceRegistration: boolean;
  totalDurationSeconds: number | null;
  source: string;
  createdAt: string;
}

export interface VoiceLog {
  id: string;
  userId: string | null;
  sessionId: string;
  stepNumber: number;
  recognizedText: string | null;
  finalText: string | null;
  dialect: string | null;
  retryCount: number;
  isSuccess: boolean;
  durationMs: number | null;
}

export interface FraudWarning {
  id: string;
  userId: string | null;
  triggerWord: string;
  triggerSource: string | null;
  pageLocation: string | null;
  notifiedFamily: boolean;
  createdAt: string;
}

export interface FamilyBinding {
  id: string;
  familyUserId: string;
  elderUserId: string;
  elderName: string;
  relationship: string | null;
  isActive: boolean;
}

export interface FamilyNotification {
  id: string;
  familyUserId: string;
  elderUserId: string | null;
  elderName: string | null;
  notificationType: string;
  content: string;
  isRead: boolean;
  appointmentId: string | null;
  createdAt: string;
}

export interface AnalyticsEvent {
  id: string;
  eventName: string;
  userId: string | null;
  sessionId: string | null;
  properties: Record<string, unknown> | null;
  createdAt: string;
}

// 语音识别结果（后端敏感词检测）
export interface VoiceDetectRequest {
  text: string;
  sessionId: string;
  stepNumber: number;
  userId?: string;
  dialect?: string;
}

export interface VoiceDetectResponse {
  isFraud: boolean;
  triggerWord: string | null;
  recognizedKeyword: string | null;
  matchedDepartment: string | null;
  matchedDoctor: string | null;
  normalizedText: string;
}

// 挂号创建请求
export interface CreateAppointmentRequest {
  userId?: string;
  patientId: string;
  departmentId: string;
  doctorId?: string;
  timeSlotId: string;
  isVoiceRegistration?: boolean;
  totalDurationSeconds?: number;
  source?: string;
}

// 埋点上报
export interface TrackEventRequest {
  eventName: string;
  userId?: string;
  sessionId?: string;
  properties?: Record<string, unknown>;
}

// 家人绑定请求
export interface CreateFamilyBindingRequest {
  familyUserId: string;
  elderName: string;
  elderPhone: string;
  relationship: string;
}

// 仪表盘统计
export interface DashboardStats {
  totalRegistrations: number;
  completionRate: number;
  voiceUsageRate: number;
  avgDurationSeconds: number;
  fraudWarningCount: number;
  helpButtonClicks: number;
  familyAssistCount: number;
  voiceRepeatCount: number;
  recognitionAccuracy: number;
  stepDropOffCounts: Record<string, number>;
  dailyRegistrations: { date: string; count: number }[];
}
