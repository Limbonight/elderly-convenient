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
  // 固定演示家庭账号：与数据库种子数据保持一致，避免浏览器随机 id 导致子女端与老年端数据对不上
  const DEMO_FAMILY_ID = 'demo_family_001';
  try {
    if (localStorage.getItem('demoFamilyUserId') !== DEMO_FAMILY_ID) {
      localStorage.setItem('demoFamilyUserId', DEMO_FAMILY_ID);
    }
  } catch {
    // 忽略隐私模式下的存储错误
  }
  return DEMO_FAMILY_ID;
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

export interface RegistrationPatient {
  id: string;
  name: string;
  phone: string;
}

/** 老年端挂号可选的就诊人：直接来自子女端维护的老人信息 */
export async function getRegistrationPatients(elderUserId: string): Promise<RegistrationPatient[]> {
  try {
    const response = await axiosForBackend({
      url: '/api/family/registration-patients',
      method: 'GET',
      params: { elderUserId, _t: Date.now() },
      headers: noCacheHeaders,
    });
    const data = response.data;
    return Array.isArray(data) ? data : (data?.items ?? []);
  } catch (error) {
    logger.error('获取挂号就诊人失败', error);
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
