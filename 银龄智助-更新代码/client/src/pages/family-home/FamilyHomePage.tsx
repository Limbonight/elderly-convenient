import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { logger } from '@lark-apaas/client-toolkit/logger';
import {
  UserPlus,
  UserPen,
  Bell,
  ClipboardList,
  Send,
  UserCircle,
  Phone,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from '@/components/ui/empty';
import { familyApi } from '@/api';
import type { FamilyMember, FamilyNotification } from '@/api/family';

const RELATION_LABEL: Record<string, string> = {
  father: '父亲',
  mother: '母亲',
  spouse: '配偶',
  other: '其他',
};

const TYPE_CONFIG: Record<string, { icon: React.ElementType; label: string; color: string; bgColor: string }> = {
  registration_success: { icon: CheckCircle, label: '挂号成功', color: 'text-[#137333]', bgColor: 'bg-green-50' },
  fraud_warning: { icon: AlertTriangle, label: '防诈警告', color: 'text-[#D93025]', bgColor: 'bg-red-50' },
  help_request: { icon: HelpCircle, label: '求助', color: 'text-[#1A73E8]', bgColor: 'bg-blue-50' },
  info: { icon: Info, label: '系统通知', color: 'text-[#1A73E8]', bgColor: 'bg-blue-50' },
};

function getDemoFamilyUserId(): string {
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

// mock fallback data for demo
const mockMembers: FamilyMember[] = [
  { id: 'm1', name: '王建国', relation: 'father', phone: '138****1234', idCard: '' },
  { id: 'm2', name: '李秀兰', relation: 'mother', phone: '139****5678', idCard: '' },
];

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
    description: '检测到敏感词"转账"，已触发安全提醒',
    time: '昨天',
    read: false,
  },
  {
    id: 'n3',
    type: 'info',
    title: '就诊提醒',
    description: '李秀兰 · 明天上午 眼科复查，请提前15分钟到达',
    time: '昨天',
    read: false,
  },
];

const FamilyHomePage: React.FC = () => {
  const navigate = useNavigate();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [notifications, setNotifications] = useState<FamilyNotification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [usingDemoData, setUsingDemoData] = useState<boolean>(false);

  useEffect(() => {
    const userId = getDemoFamilyUserId();
    logger.info('子女端首页加载', { userId });

    const loadData = async (): Promise<void> => {
      try {
        const [memberRes, notifRes] = await Promise.all([
          familyApi.getFamilyMembers(),
          familyApi.getFamilyNotifications(),
        ]);
        setMembers(memberRes);
        setNotifications(notifRes.filter((n: FamilyNotification) => !n.read).slice(0, 3));
        setUsingDemoData(false);
      } catch (error) {
        logger.warn('接口不可用，使用演示数据', error);
        setMembers(mockMembers);
        setNotifications(mockNotifications);
        setUsingDemoData(true);
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, []);

  const handleViewRecords = (member: FamilyMember): void => {
    logger.info('查看挂号记录', { memberId: member.id });
    navigate('/elder/records');
  };

  const handleEditMember = (member: FamilyMember): void => {
    logger.info('修改父母信息', { memberId: member.id });
    navigate(`/family/bind?edit=${encodeURIComponent(member.id)}`);
  };

  const handleSendNotify = (member: FamilyMember): void => {
    logger.info('发送通知', { memberId: member.id });
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-8 py-6">
        <div className="animate-pulse">
          <div className="h-8 w-64 bg-gray-200 rounded mb-2"></div>
          <div className="h-5 w-80 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const unreadCount = notifications.length;

  return (
    <div className="flex flex-col gap-8 py-6">
      {/* 标题区 */}
      <div>
        <h1 className="text-[#1A1A1A] text-3xl font-bold mb-2">家人健康管家</h1>
        <p className="text-base text-gray-600">远程守护父母健康，挂号、通知、协助一站式管理</p>
      </div>

      {/* 接口不可用时的演示数据提示 */}
      {usingDemoData && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 text-sm text-amber-800">
          ⚠️ 当前显示的是演示数据（服务暂不可用），此时的修改不会保存。请稍后刷新重试。
        </div>
      )}

      {/* 快速操作区 */}
      <div className="grid grid-cols-2 gap-4" data-ai-section-type="card-menu">
        <Button
          variant="default"
          className="h-20 bg-[#1A73E8] text-white text-lg font-medium rounded-xl hover:bg-[#1557B0] flex items-center justify-center gap-2"
          onClick={() => navigate('/family/bind')}
        >
          <UserPlus className="w-5 h-5" />
          添加父母
        </Button>
        <Button
          variant="outline"
          className="h-20 border-2 border-[#1A73E8] text-[#1A73E8] text-lg font-medium rounded-xl hover:bg-blue-50 flex items-center justify-center gap-2 relative"
          onClick={() => navigate('/family/notifications')}
        >
          <Bell className="w-5 h-5" />
          查看全部通知
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-2 -right-2 h-6 min-w-6 px-1.5 text-xs rounded-full bg-[#D93025]"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </div>

      {/* 我的父母列表 */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-[#1A1A1A]">我的父母</h2>
          <Button
            variant="ghost"
            size="sm"
            className="text-[#1A73E8] hover:text-[#1557B0] hover:bg-blue-50 text-sm"
            onClick={() => navigate('/family/bind')}
          >
            <UserPlus className="w-4 h-4 mr-1" />
            添加
          </Button>
        </div>

        {members.length === 0 ? (
          <Card className="border border-gray-200">
            <CardContent className="pt-6">
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <UserCircle className="size-8 text-gray-400" />
                  </EmptyMedia>
                  <EmptyTitle>还没有添加老人信息</EmptyTitle>
                  <EmptyDescription>添加后即可接收挂号通知和防诈提醒</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button
                    className="bg-[#1A73E8] hover:bg-[#1557B0]"
                    onClick={() => navigate('/family/bind')}
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    立即添加
                  </Button>
                </EmptyContent>
              </Empty>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-3" data-ai-section-type="card-list">
            {members.map((member: FamilyMember) => (
              <Card
                key={member.id}
                className="border border-gray-200 hover:border-[#1A73E8] transition-colors"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-[#1A73E8] text-white flex items-center justify-center text-lg font-medium">
                      {member.name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-base font-semibold text-[#1A1A1A]">
                        {member.name}
                      </CardTitle>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                        <Badge variant="secondary" className="text-xs font-normal">
                          {RELATION_LABEL[member.relation] || member.relation}
                        </Badge>
                        <span className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5" />
                          {member.phone}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardFooter className="pt-0 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-sm"
                    onClick={() => handleEditMember(member)}
                  >
                    <UserPen className="w-4 h-4 mr-1.5" />
                    修改信息
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-sm"
                    onClick={() => handleViewRecords(member)}
                  >
                    <ClipboardList className="w-4 h-4 mr-1.5" />
                    查看挂号记录
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-sm border-[#1A73E8] text-[#1A73E8] hover:bg-blue-50 hover:text-[#1A73E8]"
                    onClick={() => handleSendNotify(member)}
                  >
                    <Send className="w-4 h-4 mr-1.5" />
                    发送通知
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* 最近通知摘要 */}
      {notifications.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-[#1A1A1A]">最近通知</h2>
            <Button
              variant="ghost"
              size="sm"
              className="text-[#1A73E8] hover:text-[#1557B0] hover:bg-blue-50 text-sm"
              onClick={() => navigate('/family/notifications')}
            >
              查看全部
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            {notifications.map((notif: FamilyNotification) => {
              const IconComp = notif.type === 'success'
                ? CheckCircle
                : notif.type === 'danger'
                ? AlertTriangle
                : notif.type === 'warning'
                ? AlertTriangle
                : Info;
              const colorMap: Record<string, string> = {
                success: 'text-[#137333] border-green-200 bg-green-50',
                warning: 'text-amber-600 border-amber-200 bg-amber-50',
                danger: 'text-[#D93025] border-red-200 bg-red-50',
                info: 'text-[#1A73E8] border-blue-200 bg-blue-50',
              };
              const iconColorMap: Record<string, string> = {
                success: 'text-[#137333]',
                warning: 'text-amber-600',
                danger: 'text-[#D93025]',
                info: 'text-[#1A73E8]',
              };
              return (
                <div
                  key={notif.id}
                  className={`p-4 rounded-xl border ${colorMap[notif.type]} flex items-start gap-3`}
                >
                  <IconComp className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconColorMap[notif.type]}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold text-[#1A1A1A]">{notif.title}</h4>
                      {!notif.read && (
                        <span className="w-2 h-2 rounded-full bg-[#D93025] flex-shrink-0"></span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">{notif.description}</p>
                    <p className="text-xs text-gray-400 mt-1">{notif.time}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};

export default FamilyHomePage;
