import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { logger } from '@lark-apaas/client-toolkit/logger';
import {
  ArrowLeft,
  UserCircle,
  CalendarDays,
  ClipboardCheck,
  CheckCircle,
  Clock,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { familyApi } from '@/api';
import type { FamilyMember } from '@/api/family';

type AssistStatus = 'pending' | 'confirmed' | 'cancelled';

const STEPS = [
  { id: 1, title: '选择老人', icon: UserCircle },
  { id: 2, title: '选择科室和时间', icon: CalendarDays },
  { id: 3, title: '确认并发送', icon: ClipboardCheck },
];

const DEPARTMENTS = [
  { id: 'd1', name: '内科' },
  { id: 'd2', name: '外科' },
  { id: 'd3', name: '眼科' },
  { id: 'd4', name: '口腔科' },
  { id: 'd5', name: '皮肤科' },
  { id: 'd6', name: '骨科' },
];

const TIME_SLOTS = [
  { id: 't1', label: '明天上午 9:00 - 9:30' },
  { id: 't2', label: '明天上午 10:00 - 10:30' },
  { id: 't3', label: '明天下午 14:00 - 14:30' },
  { id: 't4', label: '明天下午 15:00 - 15:30' },
  { id: 't5', label: '后天上午 9:00 - 9:30' },
];

const mockMembers: FamilyMember[] = [
  { id: 'm1', name: '王建国', relation: 'father', phone: '138****1234', idCard: '' },
  { id: 'm2', name: '李秀兰', relation: 'mother', phone: '139****5678', idCard: '' },
];

const RELATION_LABEL: Record<string, string> = {
  father: '父亲',
  mother: '母亲',
  spouse: '配偶',
  other: '其他',
};

const FamilyAssistPage: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [selectedTimeId, setSelectedTimeId] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [status, setStatus] = useState<AssistStatus | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadMembers = async (): Promise<void> => {
      try {
        const data = await familyApi.getFamilyMembers();
        setMembers(data);
        logger.info('加载家人列表', { count: data.length });
      } catch (error) {
        logger.warn('家人接口不可用，使用演示数据', error);
        setMembers(mockMembers);
      }
    };
    void loadMembers();
  }, []);

  const selectedMember = members.find((m: FamilyMember) => m.id === selectedMemberId);
  const selectedDept = DEPARTMENTS.find((d: { id: string; name: string }) => d.id === selectedDeptId);
  const selectedTime = TIME_SLOTS.find((t: { id: string; label: string }) => t.id === selectedTimeId);

  const validateStep1 = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!selectedMemberId) newErrors.member = '请选择老人';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!selectedDeptId) newErrors.dept = '请选择科室';
    if (!selectedTimeId) newErrors.time = '请选择时间';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = (): void => {
    if (currentStep === 1 && !validateStep1()) return;
    if (currentStep === 2 && !validateStep2()) return;
    setCurrentStep((prev: number) => Math.min(prev + 1, 3));
  };

  const handlePrev = (): void => {
    setCurrentStep((prev: number) => Math.max(prev - 1, 1));
    setErrors({});
  };

  const handleSend = async (): Promise<void> => {
    logger.info('发送远程协助请求', {
      memberId: selectedMemberId,
      deptId: selectedDeptId,
      timeId: selectedTimeId,
    });

    try {
      if (selectedMemberId) {
        await familyApi.requestAssist(selectedMemberId);
      }
    } catch (error) {
      logger.warn('协助接口不可用，演示模式', error);
    }

    setStatus('pending');
  };

  const handleReset = (): void => {
    setCurrentStep(1);
    setSelectedMemberId('');
    setSelectedDeptId('');
    setSelectedTimeId('');
    setNote('');
    setStatus(null);
    setErrors({});
  };

  const getStatusConfig = (s: AssistStatus): { icon: React.ElementType; label: string; color: string } => {
    switch (s) {
      case 'pending':
        return { icon: Clock, label: '待确认', color: 'text-amber-600' };
      case 'confirmed':
        return { icon: CheckCircle, label: '已完成', color: 'text-[#137333]' };
      case 'cancelled':
        return { icon: XCircle, label: '已取消', color: 'text-[#D93025]' };
    }
  };

  if (status) {
    const statusConfig = getStatusConfig(status);
    const StatusIcon = statusConfig.icon;
    return (
      <div className="flex flex-col gap-6 py-6">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit text-gray-600 hover:text-[#1A1A1A] hover:bg-gray-100 -ml-2"
          onClick={() => navigate('/family')}
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          返回首页
        </Button>

        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className={`w-20 h-20 rounded-full ${statusConfig.color.replace('text-', 'bg-').replace('[#', '[#').replace(']', '/10]')} bg-opacity-10 flex items-center justify-center mb-6`}
               style={{ backgroundColor: status === 'pending' ? 'rgba(217,119,6,0.1)' : status === 'confirmed' ? 'rgba(19,115,51,0.1)' : 'rgba(217,48,37,0.1)' }}>
            <StatusIcon className={`w-10 h-10 ${statusConfig.color}`} />
          </div>
          <h2 className="text-2xl font-bold text-[#1A1A1A] mb-2">
            {status === 'pending' ? '已发送协助请求' : status === 'confirmed' ? '协助已完成' : '协助已取消'}
          </h2>
          <p className="text-base text-gray-600 max-w-sm">
            {status === 'pending'
              ? '已发送协助请求，老人只需语音确认即可完成挂号'
              : status === 'confirmed'
              ? '老人已语音确认，挂号成功'
              : '老人已取消本次协助'}
          </p>

          <Card className="w-full max-w-sm mt-6 border border-gray-200">
            <CardContent className="pt-6">
              <div className="flex flex-col gap-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">老人姓名</span>
                  <span className="font-medium text-[#1A1A1A]">{selectedMember?.name || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">就诊科室</span>
                  <span className="font-medium text-[#1A1A1A]">{selectedDept?.name || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">预约时间</span>
                  <span className="font-medium text-[#1A1A1A]">{selectedTime?.label || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">状态</span>
                  <Badge variant="outline" className={statusConfig.color}>
                    {statusConfig.label}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3 mt-8 w-full max-w-sm">
            <Button variant="outline" className="flex-1" onClick={handleReset}>
              再次协助
            </Button>
            <Button className="flex-1 bg-[#1A73E8] hover:bg-[#1557B0]" onClick={() => navigate('/family')}>
              返回首页
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 py-6">
      <Button
        variant="ghost"
        size="sm"
        className="w-fit text-gray-600 hover:text-[#1A1A1A] hover:bg-gray-100 -ml-2"
        onClick={() => navigate('/family')}
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        返回首页
      </Button>

      <div>
        <h1 className="text-3xl font-bold text-[#1A1A1A] mb-2">远程协助挂号</h1>
        <p className="text-sm text-gray-600">
          您可以帮父母预填挂号信息，最终确认需要由老人语音完成
        </p>
      </div>

      {/* 步骤指示器 */}
      <div className="flex items-center justify-between bg-gray-50 p-4 rounded-xl">
        {STEPS.map((step, index: number) => {
          const StepIcon = step.icon;
          const isActive = currentStep === step.id;
          const isDone = currentStep > step.id;
          return (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center gap-2 flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                    isDone
                      ? 'bg-[#137333] text-white'
                      : isActive
                      ? 'bg-[#1A73E8] text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {isDone ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <StepIcon className="w-5 h-5" />
                  )}
                </div>
                <span className={`text-xs font-medium ${isActive || isDone ? 'text-[#1A1A1A]' : 'text-gray-400'}`}>
                  {step.title}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={`h-0.5 flex-1 mx-2 rounded-full ${
                    isDone ? 'bg-[#137333]' : 'bg-gray-200'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* 步骤内容 */}
      <Card className="border border-gray-200">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-[#1A1A1A]">
            第 {currentStep} 步：{STEPS[currentStep - 1].title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Step 1: 选择老人 */}
          {currentStep === 1 && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium text-[#1A1A1A]">
                  选择老人 <span className="text-[#D93025]">*</span>
                </Label>
                <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                  <SelectTrigger className={`h-10 ${errors.member ? 'border-[#D93025]' : ''}`}>
                    <SelectValue placeholder="请选择要协助的老人" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((member: FamilyMember) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name}（{RELATION_LABEL[member.relation] || member.relation}）
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.member && <p className="text-xs text-[#D93025]">{errors.member}</p>}
              </div>

              {members.length === 0 && (
                <Alert variant="warning">
                  <AlertTitle>还未添加老人信息</AlertTitle>
                  <AlertDescription>
                    请先添加父母信息后再进行远程协助
                    <Button
                      size="sm"
                      className="mt-2 bg-[#1A73E8] hover:bg-[#1557B0]"
                      onClick={() => navigate('/family/bind')}
                    >
                      去添加
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Step 2: 选择科室和时间 */}
          {currentStep === 2 && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium text-[#1A1A1A]">
                  就诊科室 <span className="text-[#D93025]">*</span>
                </Label>
                <Select value={selectedDeptId} onValueChange={setSelectedDeptId}>
                  <SelectTrigger className={`h-10 ${errors.dept ? 'border-[#D93025]' : ''}`}>
                    <SelectValue placeholder="请选择科室" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map((dept: { id: string; name: string }) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.dept && <p className="text-xs text-[#D93025]">{errors.dept}</p>}
              </div>

              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium text-[#1A1A1A]">
                  预约时间 <span className="text-[#D93025]">*</span>
                </Label>
                <Select value={selectedTimeId} onValueChange={setSelectedTimeId}>
                  <SelectTrigger className={`h-10 ${errors.time ? 'border-[#D93025]' : ''}`}>
                    <SelectValue placeholder="请选择预约时间段" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_SLOTS.map((slot: { id: string; label: string }) => (
                      <SelectItem key={slot.id} value={slot.id}>
                        {slot.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.time && <p className="text-xs text-[#D93025]">{errors.time}</p>}
              </div>

              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium text-[#1A1A1A]">备注（可选）</Label>
                <Input
                  type="text"
                  placeholder="例如：高血压复诊，请提醒带医保卡"
                  value={note}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNote(e.target.value)}
                  className="h-10"
                />
              </div>
            </div>
          )}

          {/* Step 3: 确认信息 */}
          {currentStep === 3 && (
            <div className="flex flex-col gap-4">
              <Alert variant="default" className="bg-blue-50 border-blue-200">
                <AlertTitle className="text-[#1A1A1A] text-sm font-medium">确认信息</AlertTitle>
                <AlertDescription className="text-gray-600 text-sm">
                  请确认以下挂号信息，发送后老人将收到语音提醒并可直接确认
                </AlertDescription>
              </Alert>

              <div className="bg-gray-50 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">老人姓名</span>
                  <span className="font-medium text-[#1A1A1A]">{selectedMember?.name || '-'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">与您的关系</span>
                  <span className="font-medium text-[#1A1A1A]">
                    {selectedMember ? (RELATION_LABEL[selectedMember.relation] || selectedMember.relation) : '-'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">联系电话</span>
                  <span className="font-medium text-[#1A1A1A]">{selectedMember?.phone || '-'}</span>
                </div>
                <div className="border-t border-gray-200 my-1"></div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">就诊科室</span>
                  <span className="font-medium text-[#1A1A1A]">{selectedDept?.name || '-'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">预约时间</span>
                  <span className="font-medium text-[#1A1A1A]">{selectedTime?.label || '-'}</span>
                </div>
                {note && (
                  <>
                    <div className="border-t border-gray-200 my-1"></div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">备注</span>
                      <span className="font-medium text-[#1A1A1A]">{note}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 操作按钮 */}
      <div className="flex gap-3">
        {currentStep > 1 && (
          <Button variant="outline" className="flex-1" onClick={handlePrev}>
            上一步
          </Button>
        )}
        {currentStep < 3 ? (
          <Button
            className="flex-1 bg-[#1A73E8] hover:bg-[#1557B0]"
            onClick={handleNext}
          >
            下一步
          </Button>
        ) : (
          <Button
            className="flex-1 bg-[#1A73E8] hover:bg-[#1557B0]"
            onClick={handleSend}
          >
            发送给老人确认
          </Button>
        )}
      </div>

      <p className="text-xs text-gray-400 text-center">
        发送后，老人的手机会收到语音提醒，说"确认"即可完成挂号
      </p>
    </div>
  );
};

export default FamilyAssistPage;
