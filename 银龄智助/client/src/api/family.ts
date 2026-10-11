import { logger } from '@lark-apaas/client-toolkit/logger';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';

export interface FamilyMember {
  id: string;
  name: string;
  relation: string;
  phone: string;
  idCard: string;
  lastAppointment?: string;
}

export interface FamilyNotification {
  id: string;
  type: 'success' | 'warning' | 'danger' | 'info';
  title: string;
  description: string;
  time: string;
  read: boolean;
}

export async function getFamilyMembers(): Promise<FamilyMember[]> {
  try {
    const response = await axiosForBackend({
      url: '/api/family/members',
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取家人列表失败', error);
    throw error;
  }
}

export async function bindFamilyMember(data: {
  name: string;
  idCard: string;
  phone: string;
  relation: string;
}): Promise<FamilyMember> {
  try {
    const response = await axiosForBackend({
      url: '/api/family/bind',
      method: 'POST',
      data,
    });
    return response.data;
  } catch (error) {
    logger.error('绑定家人失败', error);
    throw error;
  }
}

export async function getFamilyNotifications(): Promise<FamilyNotification[]> {
  try {
    const response = await axiosForBackend({
      url: '/api/family/notifications',
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取家人通知失败', error);
    throw error;
  }
}

export async function requestAssist(memberId: string): Promise<{ sessionId: string }> {
  try {
    const response = await axiosForBackend({
      url: '/api/family/assist/request',
      method: 'POST',
      data: { memberId },
    });
    return response.data;
  } catch (error) {
    logger.error('发起远程协助失败', error);
    throw error;
  }
}
