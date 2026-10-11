import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { useSpeech } from '@client/src/hooks/useSpeech';
import { voiceApi, appointmentsApi, timeSlotsApi, patientsApi, analyticsApi } from '@client/src/api';
import { Badge } from '@client/src/components/ui/badge';

interface TimeSlot {
  id: string;
  doctorId: string;
  departmentId: string;
  slotDate: string;
  slotPeriod: string;
  slotTime: string;
  totalQuota: number;
  remainingQuota: number;
  fee: string;
  doctorName?: string;
  doctorTitle?: string;
}

interface Patient {
  id: string;
  name: string;
  idCard: string;
  medicalCardNo?: string;
  phone?: string;
  relation?: string;
  isDefault?: boolean;
}

interface RegistrationData {
  departmentName: string;
  departmentId: string;
  doctorName: string;
  doctorId: string;
  timeSlotId: string;
  appointmentDate: string;
  appointmentTime: string;
  patientId: string;
  patientName: string;
  fee: string;
}

const stepNames = ['唤醒', '输入', '时间', '就诊人', '确认'];
const MAX_RETRIES = 3;

function generateSessionId(): string {
  return 'voice_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
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

const VoiceRegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { speak, stopSpeaking, startRecognition, stopRecognition, isListening, isSpeaking } =
    useSpeech({ lang: 'zh-CN', rate: 0.9 });

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [recognizedText, setRecognizedText] = useState<string>('');
  const [retryCount, setRetryCount] = useState<number>(0);
  const [showFraudWarning, setShowFraudWarning] = useState<boolean>(false);
  const [fraudTriggerWord, setFraudTriggerWord] = useState<string>('');
  const [registrationSuccess, setRegistrationSuccess] = useState<boolean>(false);
  const [sessionId] = useState<string>(() => generateSessionId());
  const userIdRef = useRef<string>(getDemoUserId());

  // 挂号数据
  const [regData, setRegData] = useState<RegistrationData>({
    departmentName: '',
    departmentId: '',
    doctorName: '',
    doctorId: '',
    timeSlotId: '',
    appointmentDate: '',
    appointmentTime: '',
    patientId: '',
    patientName: '',
    fee: '',
  });

  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number>(-1);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientIndex, setSelectedPatientIndex] = useState<number>(-1);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);
  const [recognizeFailed, setRecognizeFailed] = useState<boolean>(false);

  const startTimeRef = useRef<number>(Date.now());

  // 语音指令检测
  const checkVoiceCommands = useCallback(
    (text: string): boolean => {
      const cleanText = text.replace(/[，。！？、]/g, '').trim();
      if (cleanText.includes('再说一遍') || cleanText.includes('重复一遍') || cleanText.includes('再来一次')) {
        handleRepeatPrompt();
        return true;
      }
      if (cleanText.includes('返回上一步') || cleanText.includes('上一步') || cleanText.includes('返回')) {
        handleGoBack();
        return true;
      }
      if (cleanText.includes('取消挂号') || cleanText.includes('取消')) {
        handleCancel();
        return true;
      }
      return false;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentStep]
  );

  // 防诈检测
  const checkFraud = useCallback(
    async (text: string): Promise<boolean> => {
      try {
        const result = await voiceApi.detectFraud({
          text,
          sessionId,
          stepNumber: currentStep,
          userId: userIdRef.current,
        });
        if (result.isFraud) {
          setFraudTriggerWord(result.triggerWord ?? '');
          setShowFraudWarning(true);
          stopSpeaking();
          speak('安全提醒！检测到可疑内容，请提高警惕。谨防任何要求转账、提供验证码的电话。已通知您的紧急联系人。');
          analyticsApi.trackEvent('voice_fraud_detected', {
            triggerWord: result.triggerWord,
            step: currentStep,
            sessionId,
          });
          return true;
        }
        return false;
      } catch (error) {
        logger.warn('防诈检测调用失败，跳过', error);
        return false;
      }
    },
    [sessionId, currentStep, speak, stopSpeaking]
  );

  // 步骤1：唤醒语音
  const startStep1Listening = useCallback((): void => {
    speak('请说出您要挂的科室', {
      onEnd: () => {
        startRecognition(
          async (text: string) => {
            setRecognizedText(text);
            const isCommand = checkVoiceCommands(text);
            if (isCommand) return;

            const isFraud = await checkFraud(text);
            if (isFraud) return;

            // 简单模拟：去掉标点作为科室名
            const cleanText = text.replace(/[，。！？、]/g, '').trim();
            if (cleanText.length > 0) {
              setRegData((prev) => ({
                ...prev,
                departmentName: cleanText,
                departmentId: 'dept_' + cleanText,
              }));
              setRetryCount(0);
              setCurrentStep(2);
            } else {
              handleRecognitionError('empty');
            }
          },
          (error: string) => {
            handleRecognitionError(error);
          }
        );
      },
    });
  }, [speak, startRecognition, checkVoiceCommands, checkFraud]);

  // 识别错误处理
  const handleRecognitionError = (error: string): void => {
    logger.warn('语音识别错误', { error, step: currentStep, retryCount });
    const newRetryCount = retryCount + 1;
    setRetryCount(newRetryCount);

    if (newRetryCount >= MAX_RETRIES) {
      setRecognizeFailed(true);
      speak('识别失败，请按电话求助按钮联系工作人员。');
      analyticsApi.trackEvent('voice_recognition_failed_max_retries', {
        step: currentStep,
        sessionId,
      });
    } else {
      speak(`没听清，请再说一遍。还可以重试${MAX_RETRIES - newRetryCount}次`);
    }
  };

  // 步骤2：语音输入确认
  const handleConfirmText = (): void => {
    stopSpeaking();
    speak(`好的，${regData.departmentName}，正在为您查询号源`, {
      onEnd: () => {
        loadTimeSlots();
        setCurrentStep(3);
      },
    });
    analyticsApi.trackEvent('voice_step2_confirmed', {
      department: regData.departmentName,
      sessionId,
    });
  };

  const handleRejectText = (): void => {
    stopSpeaking();
    const newRetryCount = retryCount + 1;
    setRetryCount(newRetryCount);

    if (newRetryCount >= MAX_RETRIES) {
      setRecognizeFailed(true);
      speak('识别失败，请按电话求助按钮联系工作人员。');
      return;
    }

    setRecognizedText('');
    speak(`好的，请再说一遍您要挂的科室。还可以重试${MAX_RETRIES - newRetryCount}次`, {
      onEnd: () => {
        startRecognition(
          async (text: string) => {
            setRecognizedText(text);
            const isCommand = checkVoiceCommands(text);
            if (isCommand) return;

            const isFraud = await checkFraud(text);
            if (isFraud) return;

            const cleanText = text.replace(/[，。！？、]/g, '').trim();
            if (cleanText.length > 0) {
              setRegData((prev) => ({
                ...prev,
                departmentName: cleanText,
                departmentId: 'dept_' + cleanText,
              }));
            }
          },
          (error: string) => {
            handleRecognitionError(error);
          }
        );
      },
    });
  };

  // 步骤3：加载号源
  const loadTimeSlots = async (): Promise<void> => {
    setLoadingSlots(true);
    try {
      const slots = await timeSlotsApi.getTimeSlots({
        departmentId: regData.departmentId,
      });
      setTimeSlots(slots);
      if (slots.length > 0) {
        const slotText = slots
          .slice(0, 3)
          .map(
            (s: TimeSlot, i: number) =>
              `第${i + 1}个，${s.slotDate}${s.slotPeriod}，${s.doctorName ?? ''}医生，剩余${s.remainingQuota}个号`
          )
          .join('。');
        speak(`为您找到${slots.length}个号源。${slotText}。请选择第几个。`);
      } else {
        speak('暂无可用号源，请选择其他科室。');
      }
    } catch (error) {
      logger.error('加载号源失败', error);
      // 演示数据兜底
      const demoSlots: TimeSlot[] = [
        {
          id: 'slot1',
          doctorId: 'doc1',
          departmentId: regData.departmentId,
          slotDate: '明天',
          slotPeriod: '上午',
          slotTime: '09:00',
          totalQuota: 20,
          remainingQuota: 5,
          fee: '50元',
          doctorName: '张医生',
          doctorTitle: '主任医师',
        },
        {
          id: 'slot2',
          doctorId: 'doc2',
          departmentId: regData.departmentId,
          slotDate: '明天',
          slotPeriod: '下午',
          slotTime: '14:00',
          totalQuota: 20,
          remainingQuota: 8,
          fee: '50元',
          doctorName: '李医生',
          doctorTitle: '副主任医师',
        },
        {
          id: 'slot3',
          doctorId: 'doc3',
          departmentId: regData.departmentId,
          slotDate: '后天',
          slotPeriod: '上午',
          slotTime: '10:00',
          totalQuota: 20,
          remainingQuota: 12,
          fee: '50元',
          doctorName: '王医生',
          doctorTitle: '主治医师',
        },
      ];
      setTimeSlots(demoSlots);
      speak(`为您找到${demoSlots.length}个号源。第一个，明天上午，张医生，剩余5个号。第二个，明天下午，李医生，剩余8个号。第三个，后天上午，王医生，剩余12个号。请选择第几个。`);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleSelectSlot = (index: number): void => {
    const slot = timeSlots[index];
    if (!slot) return;
    setSelectedSlotIndex(index);
    setRegData((prev) => ({
      ...prev,
      timeSlotId: slot.id,
      doctorId: slot.doctorId,
      doctorName: slot.doctorName ?? '',
      appointmentDate: slot.slotDate,
      appointmentTime: `${slot.slotPeriod} ${slot.slotTime}`,
      fee: slot.fee,
    }));
    analyticsApi.trackEvent('voice_step3_slot_selected', {
      slotId: slot.id,
      sessionId,
    });
  };

  const handleConfirmSlot = (): void => {
    if (selectedSlotIndex < 0) {
      speak('请先选择一个就诊时间');
      return;
    }
    stopSpeaking();
    loadPatients();
    setCurrentStep(4);
  };

  // 步骤4：加载就诊人
  const loadPatients = async (): Promise<void> => {
    try {
      const data = await patientsApi.getPatients();
      setPatients(data);
      if (data.length > 0) {
        const defaultIndex = data.findIndex((p: Patient) => p.isDefault);
        if (defaultIndex >= 0) {
          setSelectedPatientIndex(defaultIndex);
          setRegData((prev) => ({
            ...prev,
            patientId: data[defaultIndex].id,
            patientName: data[defaultIndex].name,
          }));
        }
        const names = data.map((p: Patient) => p.name).join('、');
        speak(`请选择就诊人。您的常用就诊人有：${names}`);
      } else {
        speak('还没有就诊人信息，请让子女帮您添加。');
      }
    } catch (error) {
      logger.error('加载就诊人失败', error);
      // 演示数据兜底
      const demoPatients: Patient[] = [
        {
          id: 'pat1',
          name: '王大爷',
          idCard: '110101195001011234',
          phone: '138****0001',
          relation: '本人',
          isDefault: true,
        },
        {
          id: 'pat2',
          name: '李奶奶',
          idCard: '110101195202025678',
          phone: '138****0002',
          relation: '老伴',
          isDefault: false,
        },
      ];
      setPatients(demoPatients);
      setSelectedPatientIndex(0);
      setRegData((prev) => ({
        ...prev,
        patientId: demoPatients[0].id,
        patientName: demoPatients[0].name,
      }));
      speak(`请选择就诊人。您的常用就诊人有：王大爷、李奶奶。已默认选择王大爷。`);
    }
  };

  const handleSelectPatient = (index: number): void => {
    const patient = patients[index];
    if (!patient) return;
    setSelectedPatientIndex(index);
    setRegData((prev) => ({
      ...prev,
      patientId: patient.id,
      patientName: patient.name,
    }));
  };

  const handleConfirmPatient = (): void => {
    if (selectedPatientIndex < 0) {
      speak('请先选择就诊人');
      return;
    }
    stopSpeaking();
    const confirmText = `请确认挂号信息。${regData.departmentName}，${regData.doctorName}医生，${regData.appointmentDate}${regData.appointmentTime}，就诊人${regData.patientName}，费用${regData.fee}。`;
    speak(confirmText);
    setCurrentStep(5);
    analyticsApi.trackEvent('voice_step4_patient_selected', {
      patientId: regData.patientId,
      sessionId,
    });
  };

  // 步骤5：确认挂号
  const handleConfirmRegistration = async (): Promise<void> => {
    stopSpeaking();
    try {
      const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
      await appointmentsApi.createAppointment({
        patientId: regData.patientId,
        patientName: regData.patientName,
        department: regData.departmentName,
        doctor: regData.doctorName,
        date: regData.appointmentDate,
        timeSlot: regData.appointmentTime,
        status: 'confirmed',
        hospital: '市第一人民医院',
      });
      setRegistrationSuccess(true);
      speak('挂号成功！请按时就诊。安全提醒：谨防任何要求转账的电话。');
      analyticsApi.trackEvent('voice_registration_success', {
        department: regData.departmentName,
        duration,
        sessionId,
      });
    } catch (error) {
      logger.error('挂号失败', error);
      speak('挂号失败，请稍后重试或联系客服。');
    }
  };

  const handleGoBack = (): void => {
    stopSpeaking();
    stopRecognition();
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
      analyticsApi.trackEvent('voice_step_back', { from: currentStep, to: currentStep - 1 });
    }
  };

  const handleCancel = (): void => {
    stopSpeaking();
    stopRecognition();
    analyticsApi.trackEvent('voice_registration_cancelled', { step: currentStep, sessionId });
    navigate('/elder');
  };

  const handleRepeatPrompt = (): void => {
    analyticsApi.trackEvent('voice_repeat_prompt', { step: currentStep });
    repeatCurrentStepPrompt();
  };

  const repeatCurrentStepPrompt = (): void => {
    switch (currentStep) {
      case 1:
        speak('请说出您要挂的科室');
        break;
      case 2:
        speak(`您说的是${recognizedText}，对吗？对的话请说对，不对请说重说`);
        break;
      case 3:
        if (timeSlots.length > 0) {
          const slotText = timeSlots
            .slice(0, 3)
            .map(
              (s: TimeSlot, i: number) =>
                `第${i + 1}个，${s.slotDate}${s.slotPeriod}，${s.doctorName ?? ''}医生`
            )
            .join('。');
          speak(`可选的号源有。${slotText}。请选择第几个`);
        }
        break;
      case 4:
        if (patients.length > 0) {
          const names = patients.map((p: Patient) => p.name).join('、');
          speak(`请选择就诊人。常用就诊人有：${names}`);
        }
        break;
      case 5:
        const confirmText = `请确认挂号信息。${regData.departmentName}，${regData.doctorName}医生，${regData.appointmentDate}${regData.appointmentTime}，就诊人${regData.patientName}，费用${regData.fee}。`;
        speak(confirmText);
        break;
      default:
        break;
    }
  };

  const handleFraudWarningClose = (): void => {
    setShowFraudWarning(false);
    stopSpeaking();
  };

  // 进入步骤时自动播报
  useEffect(() => {
    if (currentStep === 1) {
      // 不自动开始，等用户点麦克风
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  // 成功页面
  if (registrationSuccess) {
    return (
      <div className="min-h-screen w-full bg-white flex flex-col items-center justify-center overflow-hidden px-6">
        <div className="max-w-[600px] w-full text-center">
          <div className="text-[120px] mb-8" aria-hidden="true">
            ✅
          </div>
          <h1 className="text-[48px] font-black text-black mb-6">挂号成功！</h1>
          <div className="w-full p-6 border-3 border-black rounded-2xl bg-white mb-8 text-left">
            <div className="flex justify-between text-[24px] mb-3">
              <span className="text-gray-600">科室：</span>
              <span className="font-bold text-black">{regData.departmentName}</span>
            </div>
            <div className="flex justify-between text-[24px] mb-3">
              <span className="text-gray-600">医生：</span>
              <span className="font-bold text-black">{regData.doctorName}</span>
            </div>
            <div className="flex justify-between text-[24px] mb-3">
              <span className="text-gray-600">时间：</span>
              <span className="font-bold text-black">
                {regData.appointmentDate} {regData.appointmentTime}
              </span>
            </div>
            <div className="flex justify-between text-[24px] mb-3">
              <span className="text-gray-600">就诊人：</span>
              <span className="font-bold text-black">{regData.patientName}</span>
            </div>
            <div className="flex justify-between text-[24px]">
              <span className="text-gray-600">费用：</span>
              <span className="font-bold text-black">{regData.fee}</span>
            </div>
          </div>
          <div className="w-full p-6 bg-[#D93025] rounded-2xl mb-8 text-left">
            <p className="text-[24px] text-white font-bold">
              ⚠️ 防诈骗提示：谨防任何要求转账的电话
            </p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => navigate('/elder/records')}
              className="flex-1 h-20 bg-[#1A73E8] text-white text-[28px] font-bold rounded-xl hover:bg-[#1557b0] active:bg-[#0d47a1] transition-colors"
            >
              查看挂号
            </button>
            <button
              onClick={() => navigate('/elder')}
              className="flex-1 h-20 bg-gray-200 text-black text-[28px] font-bold rounded-xl border-2 border-black hover:bg-gray-300 active:bg-gray-400 transition-colors"
            >
              返回首页
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-white overflow-hidden flex flex-col">
      {/* 顶部步骤指示器 */}
      <div className="w-full bg-white border-b-2 border-gray-200 py-4 px-4">
        <div className="max-w-[600px] mx-auto flex items-center justify-between">
          <button
            onClick={handleGoBack}
            disabled={currentStep === 1}
            className="h-12 w-12 flex items-center justify-center text-[28px] font-bold border-2 border-black rounded-xl bg-white hover:bg-gray-100 active:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="返回上一步"
          >
            ←
          </button>
          <div className="flex items-center gap-2">
            {stepNames.map((name: string, index: number) => {
              const stepNum = index + 1;
              const isActive = stepNum === currentStep;
              const isDone = stepNum < currentStep;
              return (
                <React.Fragment key={name}>
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-[20px] font-bold border-3 ${
                        isActive
                          ? 'bg-[#1A73E8] text-white border-[#1A73E8]'
                          : isDone
                          ? 'bg-[#137333] text-white border-[#137333]'
                          : 'bg-gray-200 text-gray-500 border-gray-300'
                      }`}
                    >
                      {isDone ? '✓' : stepNum}
                    </div>
                    <span
                      className={`text-[16px] font-bold ${
                        stepNum <= currentStep ? 'text-black' : 'text-gray-400'
                      }`}
                    >
                      {name}
                    </span>
                  </div>
                  {index < stepNames.length - 1 && (
                    <div
                      className={`w-6 h-1 rounded-full ${
                        stepNum < currentStep ? 'bg-[#137333]' : 'bg-gray-200'
                      }`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
          <button
            onClick={handleCancel}
            className="h-12 px-4 flex items-center justify-center text-[18px] font-bold border-2 border-[#D93025] text-[#D93025] rounded-xl bg-white hover:bg-red-50 active:bg-red-100 transition-colors"
            aria-label="取消挂号"
          >
            取消
          </button>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 flex items-center justify-center px-6 py-6">
        <div className="max-w-[600px] w-full">
          {/* 步骤1：唤醒语音 */}
          {currentStep === 1 && (
            <div className="flex flex-col items-center gap-8">
              <h2 className="text-[36px] font-bold text-black text-center">
                点击麦克风，说出您要挂的科室
              </h2>
              <button
                onClick={startStep1Listening}
                disabled={isListening}
                className={`w-[180px] h-[180px] rounded-full flex items-center justify-center text-[80px] transition-all shadow-xl active:scale-95 ${
                  isListening
                    ? 'bg-[#D93025] animate-pulse'
                    : 'bg-[#1A73E8] hover:bg-[#1557b0] active:bg-[#0d47a1]'
                }`}
                aria-label={isListening ? '正在听您说话' : '点击开始语音识别'}
              >
                <span aria-hidden="true">🎤</span>
              </button>
              {isListening && (
                <p className="text-[28px] font-bold text-[#D93025]">正在聆听...</p>
              )}
              {!isListening && (
                <button
                  onClick={handleRepeatPrompt}
                  className="text-[24px] font-bold text-[#1A73E8] underline"
                >
                  听不到？再说一遍
                </button>
              )}
            </div>
          )}

          {/* 步骤2：语音输入确认 */}
          {currentStep === 2 && (
            <div className="flex flex-col items-center gap-8">
              <p className="text-[24px] text-gray-600">识别到您说的是：</p>
              <p className="text-[40px] font-bold text-black text-center leading-relaxed">
                {recognizedText || '...'}
              </p>
              <p className="text-[22px] text-gray-500">
                还可以重试 {MAX_RETRIES - retryCount} 次
              </p>
              <div className="w-full flex flex-col gap-4">
                <button
                  onClick={handleConfirmText}
                  className="w-full h-24 bg-[#137333] text-white text-[32px] font-bold rounded-xl hover:bg-green-700 active:bg-green-800 transition-colors"
                >
                  ✓ 对，就是这个
                </button>
                <button
                  onClick={handleRejectText}
                  className="w-full h-24 bg-[#E37400] text-white text-[32px] font-bold rounded-xl hover:bg-[#c26200] active:bg-[#a05100] transition-colors"
                >
                  ✗ 不对，重说
                </button>
              </div>
              {recognizeFailed && (
                <button
                  onClick={() => navigate('/elder/help')}
                  className="w-full h-20 bg-[#D93025] text-white text-[28px] font-bold rounded-xl hover:bg-red-700 active:bg-red-800 transition-colors"
                >
                  📞 识别失败，请电话求助
                </button>
              )}
            </div>
          )}

          {/* 步骤3：选择时间 */}
          {currentStep === 3 && (
            <div className="flex flex-col gap-6">
              <h2 className="text-[32px] font-bold text-black text-center">
                请选择就诊时间
              </h2>
              {loadingSlots ? (
                <p className="text-[24px] text-center text-gray-600">正在查询号源...</p>
              ) : (
                <>
                  <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto">
                    {timeSlots.map((slot: TimeSlot, index: number) => (
                      <button
                        key={slot.id}
                        onClick={() => handleSelectSlot(index)}
                        className={`w-full p-5 rounded-xl border-3 text-left transition-all ${
                          selectedSlotIndex === index
                            ? 'border-[#1A73E8] bg-blue-50'
                            : 'border-black bg-white hover:border-[#1A73E8] active:bg-gray-50'
                        }`}
                        aria-label={`选择${slot.slotDate}${slot.slotPeriod}${slot.doctorName}的号`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col gap-2">
                            <p className="text-[26px] font-bold text-black">
                              {slot.slotDate} {slot.slotPeriod}
                            </p>
                            <p className="text-[22px] text-gray-700">
                              👨‍⚕️ {slot.doctorName}
                              {slot.doctorTitle ? ` · ${slot.doctorTitle}` : ''}
                            </p>
                          </div>
                          <Badge
                            className={`text-[20px] px-3 py-1 rounded-full font-bold ${
                              slot.remainingQuota > 5
                                ? 'bg-[#137333] text-white'
                                : 'bg-[#E37400] text-white'
                            }`}
                          >
                            剩余 {slot.remainingQuota} 号
                          </Badge>
                        </div>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={handleConfirmSlot}
                    disabled={selectedSlotIndex < 0}
                    className="w-full h-20 bg-[#1A73E8] text-white text-[28px] font-bold rounded-xl hover:bg-[#1557b0] active:bg-[#0d47a1] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    确认选择
                  </button>
                </>
              )}
            </div>
          )}

          {/* 步骤4：选择就诊人 */}
          {currentStep === 4 && (
            <div className="flex flex-col gap-6">
              <h2 className="text-[32px] font-bold text-black text-center">
                请选择就诊人
              </h2>
              {patients.length > 0 ? (
                <>
                  <div className="flex flex-col gap-3">
                    {patients.map((patient: Patient, index: number) => (
                      <button
                        key={patient.id}
                        onClick={() => handleSelectPatient(index)}
                        className={`w-full p-5 rounded-xl border-3 text-left transition-all ${
                          selectedPatientIndex === index
                            ? 'border-[#1A73E8] bg-blue-50'
                            : 'border-black bg-white hover:border-[#1A73E8] active:bg-gray-50'
                        }`}
                        aria-label={`选择就诊人${patient.name}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-[#1A73E8] text-white rounded-full flex items-center justify-center text-[24px] font-bold">
                              {patient.name.charAt(0)}
                            </div>
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <p className="text-[26px] font-bold text-black">
                                  {patient.name}
                                </p>
                                {patient.relation && (
                                  <span className="text-[20px] text-gray-600">
                                    {patient.relation}
                                  </span>
                                )}
                              </div>
                              {patient.phone && (
                                <p className="text-[20px] text-gray-600">
                                  📞 {patient.phone}
                                </p>
                              )}
                            </div>
                          </div>
                          {patient.isDefault && (
                            <Badge className="bg-[#137333] text-white text-[18px] px-3 py-1 rounded-full font-bold">
                              默认
                            </Badge>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={handleConfirmPatient}
                    disabled={selectedPatientIndex < 0}
                    className="w-full h-20 bg-[#1A73E8] text-white text-[28px] font-bold rounded-xl hover:bg-[#1557b0] active:bg-[#0d47a1] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    确认选择
                  </button>
                </>
              ) : (
                <div className="text-center py-12">
                  <p className="text-[64px] mb-4" aria-hidden="true">👴</p>
                  <p className="text-[26px] font-bold text-gray-600 mb-2">
                    还没有就诊人信息
                  </p>
                  <p className="text-[22px] text-gray-500">请让子女帮您添加</p>
                </div>
              )}
            </div>
          )}

          {/* 步骤5：确认挂号 */}
          {currentStep === 5 && (
            <div className="flex flex-col gap-6">
              <h2 className="text-[32px] font-bold text-black text-center">
                请确认挂号信息
              </h2>
              <div className="w-full p-6 border-3 border-black rounded-2xl bg-white">
                <div className="flex justify-between text-[26px] mb-4">
                  <span className="text-gray-600">科室：</span>
                  <span className="font-bold text-black">{regData.departmentName}</span>
                </div>
                <div className="flex justify-between text-[26px] mb-4">
                  <span className="text-gray-600">医生：</span>
                  <span className="font-bold text-black">{regData.doctorName}</span>
                </div>
                <div className="flex justify-between text-[26px] mb-4">
                  <span className="text-gray-600">日期：</span>
                  <span className="font-bold text-black">{regData.appointmentDate}</span>
                </div>
                <div className="flex justify-between text-[26px] mb-4">
                  <span className="text-gray-600">时间：</span>
                  <span className="font-bold text-black">{regData.appointmentTime}</span>
                </div>
                <div className="flex justify-between text-[26px] mb-4">
                  <span className="text-gray-600">就诊人：</span>
                  <span className="font-bold text-black">{regData.patientName}</span>
                </div>
                <div className="flex justify-between text-[26px] pt-4 border-t-2 border-gray-200">
                  <span className="text-gray-600">费用：</span>
                  <span className="font-bold text-[#D93025]">{regData.fee}</span>
                </div>
              </div>
              <div className="flex flex-col gap-4">
                <button
                  onClick={handleConfirmRegistration}
                  className="w-full h-24 bg-[#137333] text-white text-[32px] font-bold rounded-xl hover:bg-green-700 active:bg-green-800 transition-colors shadow-lg"
                >
                  ✓ 确认挂号
                </button>
                <button
                  onClick={handleGoBack}
                  className="w-full h-20 bg-gray-200 text-black text-[26px] font-bold rounded-xl border-2 border-black hover:bg-gray-300 active:bg-gray-400 transition-colors"
                >
                  ← 返回修改
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 底部操作栏 */}
      {currentStep > 1 && currentStep < 5 && (
        <div className="w-full bg-white border-t-2 border-gray-200 p-4">
          <div className="max-w-[600px] mx-auto flex gap-4">
            <button
              onClick={handleGoBack}
              className="flex-1 h-16 bg-gray-200 text-black text-[24px] font-bold rounded-xl border-2 border-black hover:bg-gray-300 active:bg-gray-400 transition-colors"
            >
              ← 返回上一步
            </button>
            <button
              onClick={handleCancel}
              className="flex-1 h-16 bg-white text-[#D93025] text-[24px] font-bold rounded-xl border-3 border-[#D93025] hover:bg-red-50 active:bg-red-100 transition-colors"
            >
              ✗ 取消挂号
            </button>
          </div>
        </div>
      )}

      {/* 防诈警告全屏弹窗 */}
      {showFraudWarning && (
        <div className="fixed inset-0 z-50 bg-[#D93025] flex flex-col items-center justify-center p-8">
          <div className="max-w-[600px] w-full text-center">
            <div className="text-[120px] mb-6" aria-hidden="true">
              ⚠️
            </div>
            <h2 className="text-[48px] font-black text-white mb-6">安全提醒！</h2>
            <div className="flex flex-col gap-4 mb-10 text-left">
              <p className="text-[32px] font-bold text-white">检测到可疑内容，请提高警惕！</p>
              <p className="text-[28px] text-white">
                谨防任何要求转账、提供验证码的电话
              </p>
              <p className="text-[28px] text-white">已通知您的紧急联系人</p>
              {fraudTriggerWord && (
                <p className="text-[24px] text-yellow-200">
                  触发词：{fraudTriggerWord}
                </p>
              )}
            </div>
            <button
              onClick={handleFraudWarningClose}
              className="w-full h-24 bg-white text-[#D93025] text-[32px] font-bold rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors"
            >
              我知道了
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceRegisterPage;
