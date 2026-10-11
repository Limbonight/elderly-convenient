import { logger } from '@lark-apaas/client-toolkit/logger';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';

export async function trackEvent(eventName: string, properties?: Record<string, unknown>): Promise<void> {
  try {
    const userId = getDemoUserId();
    await axiosForBackend({
      url: '/api/analytics/track',
      method: 'POST',
      data: { eventName, userId, properties },
    });
  } catch (error) {
    logger.warn('埋点上报失败', eventName, error);
  }
}

function getDemoUserId(): string {
  try {
    let id = localStorage.getItem('demoUserId');
    if (!id) {
      id = 'demo_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      localStorage.setItem('demoUserId', id);
    }
    return id;
  } catch {
    return 'demo_unknown';
  }
}

export interface AnalyticsOverview {
  todayAppointments: number;
  completionRate: number;
  voiceUsageRate: number;
  fraudTriggerCount: number;
  avgRegistrationTime: number;
  elderUserCount: number;
}

export interface TrendDataPoint {
  date: string;
  count: number;
}

export async function getAnalyticsOverview(): Promise<AnalyticsOverview> {
  try {
    const response = await axiosForBackend({
      url: '/api/analytics/overview',
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取数据概览失败', error);
    throw error;
  }
}

export async function getAppointmentTrend(days: number = 7): Promise<TrendDataPoint[]> {
  try {
    const response = await axiosForBackend({
      url: '/api/analytics/trend',
      method: 'GET',
      params: { days },
    });
    return response.data;
  } catch (error) {
    logger.error('获取挂号趋势失败', error);
    throw error;
  }
}

export async function getFraudStats(): Promise<{
  monthlyTriggers: number;
  interceptionRate: number;
  successFrauds: number;
  totalProtected: number;
}> {
  try {
    const response = await axiosForBackend({
      url: '/api/analytics/fraud-stats',
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取防诈统计失败', error);
    throw error;
  }
}
