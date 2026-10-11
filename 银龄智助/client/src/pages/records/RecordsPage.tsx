import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { appointmentsApi } from '@client/src/api';
import { analyticsApi } from '@client/src/api';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@client/src/components/ui/tabs';
import { Badge } from '@client/src/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@client/src/components/ui/dialog';
import { useAccessibility } from '@client/src/contexts/AccessibilityContext';

interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  department: string;
  doctor: string;
  date: string;
  timeSlot: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  hospital: string;
  room?: string;
}

const RecordsPage: React.FC = () => {
  const navigate = useNavigate();
  const { highContrast } = useAccessibility();
  const [activeTab, setActiveTab] = useState<string>('pending');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [detailOpen, setDetailOpen] = useState<boolean>(false);

  useEffect(() => {
    loadAppointments();
    analyticsApi.trackEvent('records_page_view');
  }, []);

  const loadAppointments = async (): Promise<void> => {
    setLoading(true);
    try {
      const data = await appointmentsApi.getAppointments();
      setAppointments(data);
      logger.info('挂号记录加载成功', { count: data.length });
    } catch (error) {
      logger.error('挂号记录加载失败', error);
    } finally {
      setLoading(false);
    }
  };

  const pendingAppointments: Appointment[] = appointments.filter(
    (a: Appointment) => a.status === 'pending' || a.status === 'confirmed'
  );

  const historyAppointments: Appointment[] = appointments.filter(
    (a: Appointment) => a.status === 'completed' || a.status === 'cancelled'
  );

  const handleCancel = async (id: string): Promise<void> => {
    try {
      await appointmentsApi.cancelAppointment(id);
      analyticsApi.trackEvent('records_cancel_appointment', { appointmentId: id });
      logger.info('取消挂号成功', { id });
      loadAppointments();
    } catch (error) {
      logger.error('取消挂号失败', error);
    }
  };

  const handleViewDetail = (appointment: Appointment): void => {
    setSelectedAppointment(appointment);
    setDetailOpen(true);
    analyticsApi.trackEvent('records_view_detail', { appointmentId: appointment.id });
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'pending':
        return '待确认';
      case 'confirmed':
        return '已预约';
      case 'completed':
        return '已完成';
      case 'cancelled':
        return '已取消';
      default:
        return status;
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'pending':
      case 'confirmed':
        return 'bg-[#1A73E8] text-white';
      case 'completed':
        return 'bg-[#137333] text-white';
      case 'cancelled':
        return 'bg-gray-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  const renderAppointmentCard = (appointment: Appointment): React.ReactElement => (
    <div
      key={appointment.id}
      onClick={() => handleViewDetail(appointment)}
      className="w-full p-6 border-3 border-black rounded-2xl bg-white hover:border-[#1A73E8] active:bg-gray-50 transition-all cursor-pointer"
      role="button"
      tabIndex={0}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleViewDetail(appointment);
        }
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-3 flex-1">
          <h3 className="text-[28px] font-bold text-black">
            {appointment.department} · {appointment.doctor}
          </h3>
          <p className="text-[24px] text-black">
            📅 {appointment.date} {appointment.timeSlot}
          </p>
          <p className="text-[22px] text-gray-700">
            👤 {appointment.patientName}
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <Badge className={`text-[20px] px-4 py-2 rounded-full font-bold ${getStatusColor(appointment.status)}`}>
            {getStatusLabel(appointment.status)}
          </Badge>
          {(appointment.status === 'pending' || appointment.status === 'confirmed') && (
            <button
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                handleCancel(appointment.id);
              }}
              className="h-14 px-6 bg-[#D93025] text-white text-[20px] font-bold rounded-xl hover:bg-red-700 active:bg-red-800 transition-colors"
              aria-label={`取消${appointment.department}的挂号`}
            >
              取消挂号
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const renderEmptyState = (message: string): React.ReactElement => (
    <div className="w-full p-12 border-3 border-dashed border-gray-400 rounded-3xl bg-gray-50 text-center">
      <p className="text-[80px] mb-6" aria-hidden="true">📋</p>
      <p className="text-[28px] font-bold text-gray-600">{message}</p>
      <button
        onClick={() => navigate('/elder/register')}
        className="mt-8 h-20 px-10 bg-[#1A73E8] text-white text-[24px] font-bold rounded-xl hover:bg-[#1557b0] active:bg-[#0d47a1] transition-colors"
      >
        去挂号
      </button>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-[28px] text-black font-bold">加载中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-white overflow-hidden">
      <div className="max-w-[600px] mx-auto px-6 py-6">
        {/* 返回按钮 + 标题 */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate('/elder')}
            className="h-14 w-14 flex items-center justify-center text-[32px] font-bold border-3 border-black rounded-xl bg-white hover:bg-gray-100 active:bg-gray-200 transition-colors"
            aria-label="返回首页"
          >
            ←
          </button>
          <h1 className="text-[36px] font-bold text-black">我的挂号</h1>
        </div>

        {/* Tab 切换 */}
        <Tabs defaultValue="pending" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full h-16 bg-gray-100 rounded-xl p-1 mb-6">
            <TabsTrigger
              value="pending"
              className={`flex-1 h-full text-[24px] font-bold rounded-lg data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-md ${
                highContrast ? 'data-[state=active]:border-2 data-[state=active]:border-black' : ''
              }`}
            >
              待就诊 ({pendingAppointments.length})
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className={`flex-1 h-full text-[24px] font-bold rounded-lg data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-md ${
                highContrast ? 'data-[state=active]:border-2 data-[state=active]:border-black' : ''
              }`}
            >
              历史记录
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            <div className="flex flex-col gap-4">
              {pendingAppointments.length > 0
                ? pendingAppointments.map((a: Appointment) => renderAppointmentCard(a))
                : renderEmptyState('暂无待就诊记录')}
            </div>
          </TabsContent>

          <TabsContent value="history">
            <div className="flex flex-col gap-4">
              {historyAppointments.length > 0
                ? historyAppointments.map((a: Appointment) => renderAppointmentCard(a))
                : renderEmptyState('暂无历史记录')}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* 详情弹窗 */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-[560px] w-[90%] p-8 rounded-2xl border-3 border-black">
          <DialogHeader>
            <DialogTitle className="text-[32px] font-bold text-black">挂号详情</DialogTitle>
          </DialogHeader>
          <DialogDescription asChild>
            <div className="flex flex-col gap-4 mt-4">
              {selectedAppointment && (
                <>
                  <div className="flex justify-between text-[24px]">
                    <span className="text-gray-600">科室：</span>
                    <span className="font-bold text-black">{selectedAppointment.department}</span>
                  </div>
                  <div className="flex justify-between text-[24px]">
                    <span className="text-gray-600">医生：</span>
                    <span className="font-bold text-black">{selectedAppointment.doctor}</span>
                  </div>
                  <div className="flex justify-between text-[24px]">
                    <span className="text-gray-600">日期：</span>
                    <span className="font-bold text-black">{selectedAppointment.date}</span>
                  </div>
                  <div className="flex justify-between text-[24px]">
                    <span className="text-gray-600">时间：</span>
                    <span className="font-bold text-black">{selectedAppointment.timeSlot}</span>
                  </div>
                  <div className="flex justify-between text-[24px]">
                    <span className="text-gray-600">就诊人：</span>
                    <span className="font-bold text-black">{selectedAppointment.patientName}</span>
                  </div>
                  <div className="flex justify-between text-[24px]">
                    <span className="text-gray-600">状态：</span>
                    <Badge className={`text-[20px] px-3 py-1 rounded-full font-bold ${getStatusColor(selectedAppointment.status)}`}>
                      {getStatusLabel(selectedAppointment.status)}
                    </Badge>
                  </div>
                  <div className="mt-6 pt-6 border-t-2 border-gray-200">
                    <button
                      onClick={() => setDetailOpen(false)}
                      className="w-full h-16 bg-[#1A73E8] text-white text-[24px] font-bold rounded-xl hover:bg-[#1557b0] active:bg-[#0d47a1] transition-colors"
                    >
                      我知道了
                    </button>
                  </div>
                </>
              )}
            </div>
          </DialogDescription>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RecordsPage;
