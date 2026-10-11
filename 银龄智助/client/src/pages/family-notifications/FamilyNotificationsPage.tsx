import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { logger } from '@lark-apaas/client-toolkit/logger';
import {
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  HelpCircle,
  Bell,
  CheckCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty';
import { familyApi } from '@/api';
import type { FamilyNotification } from '@/api/family';

type FilterType = 'all' | 'registration_success' | 'fraud_warning' | 'help_request';

const TYPE_CONFIG: Record<string, {
  icon: React.ElementType;
  label: string;
  iconColor: string;
  bgColor: string;
  borderColor: string;
}> = {
  registration_success: {
    icon: CheckCircle,
    label: '挂号成功',
    iconColor: 'text-[#137333]',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
  },
  fraud_warning: {
    icon: AlertTriangle,
    label: '防诈警告',
    iconColor: 'text-[#D93025]',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
  },
  help_request: {
    icon: HelpCircle,
    label: '求助',
    iconColor: 'text-[#1A73E8]',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  info: {
    icon: Bell,
    label: '系统通知',
    iconColor: 'text-[#1A73E8]',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
};

const FILTER_TABS: { value: FilterType; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'registration_success', label: '挂号成功' },
  { value: 'fraud_warning', label: '防诈警告' },
  { value: 'help_request', label: '求助' },
];

// mock fallback data
const mockNotifications: FamilyNotification[] = [
  {
    id: 'n1',
    type: 'success',
    title: '挂号成功',
    description: '王建国 · 内科 · 张医生 · 10月13日 上午9:00',
    time: '2小时前',
    read: false,
  },
  {
    id: 'n2',
    type: 'danger',
    title: '防诈预警',
    description: '检测到敏感词"转账"，已触发安全提醒，建议联系老人确认情况',
    time: '昨天 14:30',
    read: false,
  },
  {
    id: 'n3',
    type: 'info',
    title: '就诊提醒',
    description: '李秀兰 · 明天上午 眼科复查，请提前15分钟到达医院',
    time: '昨天 09:00',
    read: false,
  },
  {
    id: 'n4',
    type: 'success',
    title: '挂号成功',
    description: '李秀兰 · 眼科 · 李医生 · 10月10日 上午10:30',
    time: '3天前',
    read: true,
  },
  {
    id: 'n5',
    type: 'info',
    title: '就诊完成',
    description: '王建国 · 10月8日 牙科治疗已完成',
    time: '5天前',
    read: true,
  },
];

const FamilyNotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<FamilyNotification[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadNotifications = async (): Promise<void> => {
      try {
        const data = await familyApi.getFamilyNotifications();
        setNotifications(data);
        logger.info('加载通知列表', { count: data.length });
      } catch (error) {
        logger.warn('通知接口不可用，使用演示数据', error);
        setNotifications(mockNotifications);
      } finally {
        setLoading(false);
      }
    };

    void loadNotifications();
  }, []);

  const handleMarkRead = (id: string): void => {
    logger.info('标记通知已读', { id });
    setNotifications((prev: FamilyNotification[]) =>
      prev.map((n: FamilyNotification) =>
        n.id === id ? { ...n, read: true } : n
      )
    );
  };

  const handleMarkAllRead = (): void => {
    logger.info('全部标记已读');
    setNotifications((prev: FamilyNotification[]) =>
      prev.map((n: FamilyNotification) => ({ ...n, read: true }))
    );
  };

  // Normalize type for display
  const getTypeKey = (type: string): string => {
    if (type === 'success') return 'registration_success';
    if (type === 'danger') return 'fraud_warning';
    if (type === 'warning') return 'help_request';
    return type;
  };

  const filteredNotifications = notifications.filter((n: FamilyNotification) => {
    if (filter === 'all') return true;
    return getTypeKey(n.type) === filter;
  });

  const unreadCount = notifications.filter((n: FamilyNotification) => !n.read).length;

  if (loading) {
    return (
      <div className="flex flex-col gap-6 py-6">
        <div className="animate-pulse h-8 w-40 bg-gray-200 rounded"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 py-6">
      {/* 顶部返回 */}
      <Button
        variant="ghost"
        size="sm"
        className="w-fit text-gray-600 hover:text-[#1A1A1A] hover:bg-gray-100 -ml-2"
        onClick={() => navigate('/family')}
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        返回首页
      </Button>

      {/* 标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#1A1A1A] mb-1">通知中心</h1>
          <p className="text-sm text-gray-500">
            共 {notifications.length} 条通知，
            <span className="text-[#D93025] font-medium">{unreadCount} 条未读</span>
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
            className="text-sm"
          >
            <CheckCheck className="w-4 h-4 mr-1.5" />
            全部已读
          </Button>
        )}
      </div>

      {/* 类型筛选标签 */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-0">
        {FILTER_TABS.map((tab: { value: FilterType; label: string }) => {
          const isActive = filter === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'text-[#1A73E8]'
                  : 'text-gray-600 hover:text-[#1A1A1A]'
              }`}
            >
              {tab.label}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1A73E8] rounded-full"></span>
              )}
            </button>
          );
        })}
      </div>

      {/* 通知列表 */}
      {filteredNotifications.length === 0 ? (
        <div className="pt-12">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Bell className="size-8 text-gray-400" />
              </EmptyMedia>
              <EmptyTitle>暂无通知</EmptyTitle>
              <EmptyDescription>
                {filter === 'all' ? '您还没有任何通知' : '当前分类下暂无通知'}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredNotifications.map((notif: FamilyNotification) => {
            const typeKey = getTypeKey(notif.type);
            const config = TYPE_CONFIG[typeKey] || TYPE_CONFIG.info;
            const IconComp = config.icon;
            return (
              <div
                key={notif.id}
                onClick={() => handleMarkRead(notif.id)}
                className={`p-4 rounded-xl border cursor-pointer transition-all hover:shadow-sm ${
                  config.bgColor
                } ${config.borderColor} ${!notif.read ? 'ring-1 ring-[#1A73E8]/20' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg bg-white ${config.iconColor}`}>
                    <IconComp className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs font-normal border-gray-300 text-gray-600">
                        {config.label}
                      </Badge>
                      {notif.read ? (
                        <span className="text-xs text-gray-400">已读</span>
                      ) : (
                        <span className="text-xs text-[#D93025] font-medium">未读</span>
                      )}
                    </div>
                    <h4 className="text-base font-semibold text-[#1A1A1A] mt-2">
                      {notif.title}
                    </h4>
                    <p className="text-sm text-gray-600 mt-1">{notif.description}</p>
                    <p className="text-xs text-gray-400 mt-2">{notif.time}</p>
                  </div>
                  {!notif.read && (
                    <span className="w-2.5 h-2.5 rounded-full bg-[#D93025] flex-shrink-0 mt-2"></span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FamilyNotificationsPage;
