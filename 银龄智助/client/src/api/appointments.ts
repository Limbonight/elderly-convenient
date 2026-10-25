import { logger } from '@lark-apaas/client-toolkit/logger';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';

/** 演示模式固定的老年端用户 ID，与数据库种子数据保持一致 */
export function getDemoElderUserId(): string {
  return 'demo_elder_001';
}

/** 服务端挂号记录结构 */
export interface ServerAppointment {
  id: string;
  userId: string;
  patientId: string;
  patientName: string;
  departmentId: string;
  departmentName: string;
  doctorId?: string | null;
  doctorName?: string | null;
  timeSlotId?: string | null;
  appointmentDate: string;
  appointmentTime?: string | null;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  fee: string;
  isVoiceRegistration?: boolean;
  totalDurationSeconds?: number | null;
  source?: string;
  createdAt: string;
}

/** 客户端展示用挂号记录结构 */
export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  department: string;
  doctor: string;
  date: string;
  timeSlot: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  hospital: string;
  fee?: string;
}

/** 创建挂号请求（与服务端 CreateAppointmentDto 对齐） */
export interface CreateAppointmentPayload {
  userId: string;
  patientId: string;
  departmentId: string;
  doctorId?: string;
  timeSlotId: string;
  isVoiceRegistration?: boolean;
  totalDurationSeconds?: number;
  source?: string;
}

function mapAppointment(raw: ServerAppointment): Appointment {
  return {
    id: raw.id,
    patientId: raw.patientId,
    patientName: raw.patientName,
    department: raw.departmentName,
    doctor: raw.doctorName ?? '',
    date: raw.appointmentDate,
    timeSlot: raw.appointmentTime ?? '',
    status: raw.status,
    hospital: '市第一人民医院',
    fee: raw.fee,
  };
}

export async function getAppointments(params?: { status?: string }): Promise<Appointment[]> {
  try {
    const response = await axiosForBackend({
      url: '/api/appointments',
      method: 'GET',
      params: { userId: getDemoElderUserId(), ...params },
    });
    const data = response.data;
    const items = Array.isArray(data) ? data : (data?.items ?? []);
    return items.map(mapAppointment);
  } catch (error) {
    logger.error('获取挂号记录失败', error);
    throw error;
  }
}

export async function createAppointment(data: CreateAppointmentPayload): Promise<Appointment> {
  try {
    const response = await axiosForBackend({
      url: '/api/appointments',
      method: 'POST',
      data,
    });
    return mapAppointment(response.data);
  } catch (error) {
    logger.error('创建挂号失败', error);
    throw error;
  }
}

export async function cancelAppointment(id: string): Promise<void> {
  try {
    await axiosForBackend({
      url: `/api/appointments/${id}/cancel`,
      method: 'PATCH',
    });
  } catch (error) {
    logger.error('取消挂号失败', error);
    throw error;
  }
}
