import { logger } from '@lark-apaas/client-toolkit/logger';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';

// GET 请求防浏览器缓存：避免修改保存后列表/预填读到旧数据
const noCacheHeaders = { 'Cache-Control': 'no-cache', Pragma: 'no-cache' };

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

export function getDemoFamilyUserId(): string {
  try {
    let id = localStorage.getItem('demoFamilyUserId');
    if (!id) {
      id = 'fam_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      localStorage.setItem('demoFamilyUserId', id);
    }
    return id;
  } catch {
    return 'fam_unknown';
  }
}

export async function getFamilyMembers(): Promise<FamilyMember[]> {
  try {
    const response = await axiosForBackend({
      url: '/api/family/members',
      method: 'GET',
      params: { familyUserId: getDemoFamilyUserId(), _t: Date.now() },
      headers: noCacheHeaders,
    });
    // 服务端返回 { items: [...] }，兼容直接返回数组的情况
    const data = response.data;
    return Array.isArray(data) ? data : (data?.items ?? []);
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
      data: {
        familyUserId: getDemoFamilyUserId(),
        elderName: data.name,
        elderPhone: data.phone,
        relationship: data.relation,
      },
    });
    const binding = response.data;
    return {
      id: binding.id,
      name: binding.elderName,
      relation: binding.relationship,
      phone: data.phone,
      idCard: data.idCard,
    };
  } catch (error) {
    logger.error('绑定家人失败', error);
    throw error;
  }
}

export async function updateFamilyMember(
  id: string,
  data: {
    name?: string;
    phone?: string;
    relation?: string;
  },
): Promise<FamilyMember> {
  try {
    const response = await axiosForBackend({
      url: `/api/family/bind/${id}`,
      method: 'PATCH',
      data: {
        elderName: data.name,
        elderPhone: data.phone,
        relationship: data.relation,
      },
    });
    const binding = response.data;
    return {
      id: binding.id,
      name: binding.elderName,
      relation: binding.relationship,
      phone: data.phone ?? '',
      idCard: '',
    };
  } catch (error) {
    logger.error('修改家人信息失败', error);
    throw error;
  }
}

export async function getFamilyNotifications(): Promise<FamilyNotification[]> {
  try {
    const response = await axiosForBackend({
      url: '/api/family/notifications',
      method: 'GET',
      params: { familyUserId: getDemoFamilyUserId(), _t: Date.now() },
      headers: noCacheHeaders,
    });
    const data = response.data;
    const items = Array.isArray(data) ? data : (data?.items ?? []);
    // 服务端结构 { notificationType, content, isRead, createdAt } → 页面结构 { type, title, description, time, read }
    return items.map((n: Record<string, unknown>) => {
      const type = String(n.notificationType ?? 'info');
      const titleMap: Record<string, string> = {
        registration_success: '挂号成功',
        fraud_warning: '防诈预警',
        help_request: '求助请求',
        info: '系统通知',
      };
      const typeMap: Record<string, FamilyNotification['type']> = {
        registration_success: 'success',
        fraud_warning: 'danger',
        help_request: 'info',
        info: 'info',
      };
      const created = n.createdAt ? new Date(String(n.createdAt)) : null;
      const time = created
        ? created.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '';
      return {
        id: String(n.id),
        type: typeMap[type] ?? 'info',
        title: titleMap[type] ?? '系统通知',
        description: String(n.content ?? ''),
        time,
        read: Boolean(n.isRead),
      };
    });
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
