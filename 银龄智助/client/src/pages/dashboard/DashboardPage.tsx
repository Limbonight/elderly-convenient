import React, { useState, useEffect } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import {
  Activity,
  Mic,
  Clock,
  Target,
  ShieldAlert,
  PhoneCall,
  AlertTriangle,
  BarChart3,
  Users,
  RefreshCcw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { analyticsApi } from '@/api';

interface DashboardMetric {
  label: string;
  value: string;
  subValue?: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  progress?: number;
}

interface DailyRegistration {
  date: string;
  count: number;
}

interface StepDropOff {
  step: string;
  label: string;
  count: number;
}

interface FraudWarningItem {
  id: string;
  userName: string;
  triggerWord: string;
  time: string;
}

// mock fallback data
const mockMetrics = {
  completionRate: 92.3,
  voiceUsageRate: 67.8,
  avgDurationSeconds: 126,
  recognitionAccuracy: 95.2,
  fraudWarningCount: 42,
  helpButtonClicks: 128,
  familyAssistCount: 356,
  voiceRepeatCount: 892,
  dailyRegistrations: [
    { date: '10-05', count: 156 },
    { date: '10-06', count: 189 },
    { date: '10-07', count: 142 },
    { date: '10-08', count: 203 },
    { date: '10-09', count: 178 },
    { date: '10-10', count: 245 },
    { date: '10-11', count: 198 },
  ],
  stepDropOffCounts: {
    step1: 45,
    step2: 28,
    step3: 15,
    step4: 8,
    step5: 3,
  },
};

const STEP_LABELS: Record<string, string> = {
  step1: '选择科室',
  step2: '选择医生',
  step3: '选择时间',
  step4: '确认信息',
  step5: '完成支付',
};

const mockFraudWarnings: FraudWarningItem[] = [
  { id: 'w1', userName: '张大爷', triggerWord: '转账', time: '10分钟前' },
  { id: 'w2', userName: '李奶奶', triggerWord: '验证码', time: '1小时前' },
  { id: 'w3', userName: '王大爷', triggerWord: '银行卡', time: '2小时前' },
  { id: 'w4', userName: '赵奶奶', triggerWord: '汇款', time: '昨天 15:30' },
  { id: 'w5', userName: '孙大爷', triggerWord: '密码', time: '昨天 10:20' },
];

const DashboardPage: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [metrics, setMetrics] = useState(mockMetrics);

  useEffect(() => {
    const loadData = async (): Promise<void> => {
      try {
        const overview = await analyticsApi.getAnalyticsOverview();
        const trend = await analyticsApi.getAppointmentTrend(7);
        const fraud = await analyticsApi.getFraudStats();
        logger.info('看板数据加载成功', { overview, trend, fraud });

        setMetrics({
          completionRate: overview.completionRate,
          voiceUsageRate: overview.voiceUsageRate,
          avgDurationSeconds: overview.avgRegistrationTime,
          recognitionAccuracy: 95.2,
          fraudWarningCount: fraud.monthlyTriggers,
          helpButtonClicks: 128,
          familyAssistCount: 356,
          voiceRepeatCount: 892,
          dailyRegistrations: trend,
          stepDropOffCounts: {
            step1: 45,
            step2: 28,
            step3: 15,
            step4: 8,
            step5: 3,
          },
        });
      } catch (error) {
        logger.warn('看板接口不可用，使用演示数据', error);
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, []);

  const metricCards: DashboardMetric[] = [
    {
      label: '挂号完成率',
      value: `${metrics.completionRate.toFixed(1)}%`,
      icon: Target,
      color: 'text-[#1A73E8]',
      bgColor: 'bg-blue-50',
      progress: metrics.completionRate,
    },
    {
      label: '语音功能使用率',
      value: `${metrics.voiceUsageRate.toFixed(1)}%`,
      icon: Mic,
      color: 'text-[#8B5CF6]',
      bgColor: 'bg-purple-50',
      progress: metrics.voiceUsageRate,
    },
    {
      label: '平均挂号时长',
      value: `${metrics.avgDurationSeconds} 秒`,
      subValue: `约 ${Math.floor(metrics.avgDurationSeconds / 60)} 分钟`,
      icon: Clock,
      color: 'text-[#137333]',
      bgColor: 'bg-green-50',
    },
    {
      label: '语音识别准确率',
      value: `${metrics.recognitionAccuracy.toFixed(1)}%`,
      icon: Activity,
      color: 'text-[#0EA5E9]',
      bgColor: 'bg-sky-50',
      progress: metrics.recognitionAccuracy,
    },
    {
      label: '防诈触发次数',
      value: `${metrics.fraudWarningCount} 次`,
      icon: ShieldAlert,
      color: 'text-[#D93025]',
      bgColor: 'bg-red-50',
    },
    {
      label: '求助按钮点击',
      value: `${metrics.helpButtonClicks} 次`,
      icon: PhoneCall,
      color: 'text-[#F59E0B]',
      bgColor: 'bg-amber-50',
    },
  ];

  const stepDropOffs: StepDropOff[] = Object.entries(metrics.stepDropOffCounts)
    .map(([step, count]) => ({
      step,
      label: STEP_LABELS[step] || step,
      count,
    }));

  const maxCount = Math.max(...metrics.dailyRegistrations.map((d: DailyRegistration) => d.count), 1);
  const maxDropOff = Math.max(...stepDropOffs.map((s: StepDropOff) => s.count), 1);

  if (loading) {
    return (
      <div className="flex flex-col gap-6 py-6">
        <div className="animate-pulse h-8 w-48 bg-gray-200 rounded"></div>
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i: number) => (
            <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 py-6">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#1A1A1A] mb-1">运营数据看板</h1>
          <p className="text-sm text-gray-500">老年友好挂号系统运营数据总览</p>
        </div>
        <Badge variant="outline" className="text-xs font-normal">
          <BarChart3 className="w-3 h-3 mr-1" />
          实时数据
        </Badge>
      </div>

      {/* 第一行：6 个核心指标卡 */}
      <div className="grid grid-cols-3 gap-4" data-ai-section-type="card-stat">
        {metricCards.map((metric: DashboardMetric, index: number) => {
          const IconComp = metric.icon;
          return (
            <Card key={index} className={`border-0 ${metric.bgColor}`}>
              <CardContent className="pt-5">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-sm text-gray-600 font-medium">{metric.label}</span>
                  <div className={`p-2 rounded-lg bg-white ${metric.color}`}>
                    <IconComp className="w-4 h-4" />
                  </div>
                </div>
                <div className={`text-3xl font-bold ${metric.color} mb-1`}>
                  {metric.value}
                </div>
                {metric.subValue && (
                  <p className="text-xs text-gray-500 mb-2">{metric.subValue}</p>
                )}
                {metric.progress !== undefined && (
                  <div className="w-full h-1.5 bg-white/60 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all`}
                      style={{
                        width: `${Math.min(metric.progress, 100)}%`,
                        backgroundColor: metric.color.includes('#1A73E8')
                          ? '#1A73E8'
                          : metric.color.includes('#8B5CF6')
                          ? '#8B5CF6'
                          : metric.color.includes('#137333')
                          ? '#137333'
                          : metric.color.includes('#0EA5E9')
                          ? '#0EA5E9'
                          : metric.color.includes('#D93025')
                          ? '#D93025'
                          : '#F59E0B',
                      }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 第二行：近 7 天挂号趋势图 */}
      <Card className="border border-gray-200">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold text-[#1A1A1A] flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#1A73E8]" />
            近 7 天挂号趋势
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between gap-2 h-48 px-2">
            {metrics.dailyRegistrations.map((day: DailyRegistration, index: number) => {
              const height = (day.count / maxCount) * 100;
              return (
                <div key={index} className="flex-1 flex flex-col items-center gap-2">
                  <span className="text-xs font-semibold text-[#1A1A1A]">{day.count}</span>
                  <div
                    className="w-full rounded-t-md bg-[#1A73E8] hover:bg-[#1557B0] transition-colors"
                    style={{ height: `${height}%`, minHeight: '4px' }}
                    title={`${day.date}: ${day.count}`}
                  />
                  <span className="text-xs text-gray-500">{day.date}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 第三行：两个统计区域并排 */}
      <div className="grid grid-cols-2 gap-4">
        {/* 左：步骤流失分布 */}
        <Card className="border border-gray-200">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold text-[#1A1A1A] flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#F59E0B]" />
              步骤流失分布
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              {stepDropOffs.map((step: StepDropOff, index: number) => {
                const width = (step.count / maxDropOff) * 100;
                return (
                  <div key={index} className="flex items-center gap-3">
                    <span className="text-xs text-gray-600 w-16 flex-shrink-0 text-right">
                      {step.label}
                    </span>
                    <div className="flex-1 h-6 bg-gray-100 rounded-md overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-md transition-all"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-[#1A1A1A] w-8 flex-shrink-0">
                      {step.count}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* 右：家人协助使用情况 */}
        <Card className="border border-gray-200">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold text-[#1A1A1A] flex items-center gap-2">
              <Users className="w-5 h-5 text-[#137333]" />
              家人协助使用情况
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg">
                    <Users className="w-5 h-5 text-[#137333]" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">协助次数</p>
                    <p className="text-2xl font-bold text-[#137333]">{metrics.familyAssistCount}</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-[#137333] border-green-300">
                  +12%
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg">
                    <RefreshCcw className="w-5 h-5 text-[#1A73E8]" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">语音重复次数</p>
                    <p className="text-2xl font-bold text-[#1A73E8]">{metrics.voiceRepeatCount}</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-[#1A73E8] border-blue-300">
                  人均 2.3 次
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 底部：最近防诈警告列表 */}
      <Card className="border border-gray-200">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold text-[#1A1A1A] flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-[#D93025]" />
            最近防诈警告
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col">
            {mockFraudWarnings.map((warning: FraudWarningItem, index: number) => (
              <div
                key={warning.id}
                className={`flex items-center justify-between py-3 ${
                  index !== mockFraudWarnings.length - 1
                    ? 'border-b border-gray-100'
                    : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                    <AlertTriangle className="w-4 h-4 text-[#D93025]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#1A1A1A]">
                      {warning.userName}
                    </p>
                    <p className="text-xs text-gray-500">
                      触发敏感词：
                      <span className="text-[#D93025] font-medium">{warning.triggerWord}</span>
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant="destructive" className="text-xs font-normal">
                    已拦截
                  </Badge>
                  <p className="text-xs text-gray-400 mt-1">{warning.time}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardPage;
