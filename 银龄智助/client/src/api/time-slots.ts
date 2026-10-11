import { logger } from '@lark-apaas/client-toolkit/logger';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';

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
}

export async function getTimeSlots(params: {
  departmentId: string;
  doctorId?: string;
}): Promise<TimeSlot[]> {
  try {
    const response = await axiosForBackend({
      url: '/api/time-slots',
      method: 'GET',
      params,
    });
    return response.data;
  } catch (error) {
    logger.error('获取号源列表失败', error);
    throw error;
  }
}
