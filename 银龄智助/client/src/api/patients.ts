import { logger } from '@lark-apaas/client-toolkit/logger';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';

export interface Patient {
  id: string;
  name: string;
  idCard: string;
  medicalCardNo?: string;
  phone?: string;
  relation?: string;
  isDefault?: boolean;
}

export async function getPatients(): Promise<Patient[]> {
  try {
    const response = await axiosForBackend({
      url: '/api/patients',
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取就诊人列表失败', error);
    throw error;
  }
}

export async function createPatient(data: Omit<Patient, 'id'>): Promise<Patient> {
  try {
    const response = await axiosForBackend({
      url: '/api/patients',
      method: 'POST',
      data,
    });
    return response.data;
  } catch (error) {
    logger.error('添加就诊人失败', error);
    throw error;
  }
}

export async function updatePatient(id: string, data: Partial<Patient>): Promise<Patient> {
  try {
    const response = await axiosForBackend({
      url: `/api/patients/${id}`,
      method: 'PATCH',
      data,
    });
    return response.data;
  } catch (error) {
    logger.error('更新就诊人失败', error);
    throw error;
  }
}

export async function deletePatient(id: string): Promise<void> {
  try {
    await axiosForBackend({
      url: `/api/patients/${id}`,
      method: 'DELETE',
    });
  } catch (error) {
    logger.error('删除就诊人失败', error);
    throw error;
  }
}
