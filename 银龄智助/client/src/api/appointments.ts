import { logger } from '@lark-apaas/client-toolkit/logger';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';

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
  room?: string;
}

export async function getAppointments(params?: { status?: string; patientId?: string }): Promise<Appointment[]> {
  try {
    const response = await axiosForBackend({
      url: '/api/appointments',
      method: 'GET',
      params,
    });
    return response.data;
  } catch (error) {
    logger.error('获取挂号记录失败', error);
    throw error;
  }
}

export async function createAppointment(data: Partial<Appointment>): Promise<Appointment> {
  try {
    const response = await axiosForBackend({
      url: '/api/appointments',
      method: 'POST',
      data,
    });
    return response.data;
  } catch (error) {
    logger.error('创建挂号失败', error);
    throw error;
  }
}

export async function cancelAppointment(id: string): Promise<void> {
  try {
    await axiosForBackend({
      url: `/api/appointments/${id}/cancel`,
      method: 'POST',
    });
  } catch (error) {
    logger.error('取消挂号失败', error);
    throw error;
  }
}
