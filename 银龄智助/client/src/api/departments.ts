import { logger } from '@lark-apaas/client-toolkit/logger';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';

export interface Department {
  id: string;
  name: string;
  description: string;
  icon?: string;
}

export async function getDepartments(): Promise<Department[]> {
  try {
    const response = await axiosForBackend({
      url: '/api/departments',
      method: 'GET',
    });
    // 服务端返回 { items: [...] }，兼容直接返回数组的情况
    const data = response.data;
    return Array.isArray(data) ? data : (data?.items ?? []);
  } catch (error) {
    logger.error('获取科室列表失败', error);
    throw error;
  }
}

export async function getDepartmentDetail(id: string): Promise<Department> {
  try {
    const response = await axiosForBackend({
      url: `/api/departments/${id}`,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取科室详情失败', error);
    throw error;
  }
}
