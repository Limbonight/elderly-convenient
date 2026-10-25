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
    if (params.doctorId) {
      const byDoctor = await axiosForBackend({
        url: `/api/doctors/${params.doctorId}/time-slots`,
        method: 'GET',
      });
      const doctorData = byDoctor.data;
      return Array.isArray(doctorData) ? doctorData : (doctorData?.items ?? []);
    }
    const response = await axiosForBackend({
      url: `/api/departments/${params.departmentId}/time-slots`,
      method: 'GET',
    });
    // 服务端返回 { items: [...] }，兼容直接返回数组的情况
    const data = response.data;
    return Array.isArray(data) ? data : (data?.items ?? []);
  } catch (error) {
    logger.error('获取号源列表失败', error);
    throw error;
  }
}
