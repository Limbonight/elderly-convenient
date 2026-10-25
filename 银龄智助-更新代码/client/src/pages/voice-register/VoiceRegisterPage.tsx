import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { useSpeech } from '@client/src/hooks/useSpeech';
import { voiceApi, appointmentsApi, timeSlotsApi, analyticsApi, departmentsApi } from '@client/src/api';
import { getRegistrationPatients } from '@client/src/api/family';
import type { Department } from '@client/src/api/departments';
import { Badge } from '@client/src/components/ui/badge';

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: { 0: { 0: { transcript: string } } } }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

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

/** 按 日期 → 上午/下午 分组号源，保证医生与时段清晰不重复 */
function groupSlotsByDate(slots: TimeSlot[]): Array<{
  date: string;
  periods: Array<{ period: string; time: string; items: Array<{ slot: TimeSlot; index: number }> }>;
}> {
  const dates: string[] = [];
  const byDate = new Map<string, Map<string, Array<{ slot: TimeSlot; index: number }>>>();
  slots.forEach((slot, index) => {
    if (!byDate.has(slot.slotDate)) {
      byDate.set(slot.slotDate, new Map());
      dates.push(slot.slotDate);
    }
    const periods = byDate.get(slot.slotDate)!;
    if (!periods.has(slot.slotPeriod)) periods.set(slot.slotPeriod, []);
    periods.get(slot.slotPeriod)!.push({ slot, index });
  });
  const periodOrder = (p: string): number => (p === '上午' ? 0 : 1);
  return dates.map((date) => ({
    date,
    periods: [...byDate.get(date)!.entries()]
      .sort((a, b) => periodOrder(a[0]) - periodOrder(b[0]))
      .map(([period, items]) => ({ period, time: items[0]?.slot.slotTime ?? '', items })),
  }));
}

const stepNames = ['唤醒', '输入', '时间', '就诊人', '确认'];
const MAX_RETRIES = 3;

// 本地兜底科室（接口不可用时使用）
const FALLBACK_DEPARTMENTS: Department[] = [
  { id: 'dept_neike', name: '内科', description: '常见内科疾病诊疗' },
  { id: 'dept_waike', name: '外科', description: '普通外科疾病诊疗' },
  { id: 'dept_guke', name: '骨科', description: '骨关节疾病诊疗' },
  { id: 'dept_yanke', name: '眼科', description: '眼部疾病诊疗' },
  { id: 'dept_erbihou', name: '耳鼻喉科', description: '耳鼻喉疾病诊疗' },
  { id: 'dept_kouqiang', name: '口腔科', description: '口腔疾病诊疗' },
];

// 科室口语别名，提高语音识别匹配率
const DEPARTMENT_ALIASES: Record<string, string[]> = {
  '内科': ['心内科', '呼吸内科', '消化内科', '神经内科', '内分泌'],
  '外科': ['普外科', '心外科', '胸外科', '神经外科'],
  '骨科': ['骨头', '关节', '腰腿疼', '颈椎'],
  '眼科': ['眼睛', '看不清', '视力', '白内障'],
  '耳鼻喉科': ['耳朵', '鼻子', '喉咙', '嗓子', '耳鸣', '耳鼻喉'],
  '口腔科': ['牙', '牙齿', '嘴巴', '口腔'],
};

function generateSessionId(): string {
  return 'voice_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function getDemoUserId(): string {
  // 演示模式使用固定用户 ID，与数据库种子数据（就诊人等）保持一致
  try {
    localStorage.setItem('demoUserId', 'demo_elder_001');
  } catch {
    // 忽略隐私模式下的存储错误
  }
  return 'demo_elder_001';
}

function cleanVoiceText(text: string): string {
  return text.replace(/[，。！？、,.!?~～\s]/g, '').trim();
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

  // 科室列表
  const [departments, setDepartments] = useState<Department[]>([]);

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
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string>('');

  const startTimeRef = useRef<number>(Date.now());

  // 加载科室列表（接口失败用兜底数据）
  useEffect(() => {
    const loadDepartments = async (): Promise<void> => {
      try {
        const list = await departmentsApi.getDepartments();
        if (list.length > 0) {
          setDepartments(list);
        } else {
          setDepartments(FALLBACK_DEPARTMENTS);
        }
      } catch (error) {
        logger.warn('科室接口不可用，使用内置科室', error);
        setDepartments(FALLBACK_DEPARTMENTS);
      }
    };
    void loadDepartments();
  }, []);

  /**
   * 将识别文本匹配到真实科室：
   * 1. 去掉标点后包含科室名即命中（如"我要挂骨科"命中"骨科"）
   * 2. 未命中时尝试口语别名（如"牙疼"命中"口腔科"）
   */
  const matchDepartment = useCallback(
    (text: string): Department | null => {
      const cleanText = cleanVoiceText(text);
      if (!cleanText || departments.length === 0) return null;

      // 精确 / 包含匹配（名称长的优先，避免"口腔科"被"内科"误匹配）
      const sorted = [...departments].sort(
        (a: Department, b: Department) => b.name.length - a.name.length
      );
      for (const dept of sorted) {
        if (cleanText.includes(dept.name)) return dept;
      }

      // 别名匹配
      for (const dept of sorted) {
        const aliases = DEPARTMENT_ALIASES[dept.name] ?? [];
        for (const alias of aliases) {
          if (cleanText.includes(alias)) return dept;
        }
      }
      return null;
    },
    [departments]
  );

  /**
   * 手动修改识别文本：同步更新匹配的科室
   */
  const handleEditText = (text: string): void => {
    setRecognizedText(text);
    const matched = matchDepartment(text);
    setRegData((prev) => ({
      ...prev,
      departmentName: matched ? matched.name : cleanVoiceText(text),
      departmentId: matched ? matched.id : '',
    }));
  };

  /**
   * 点击科室按钮直接选择
   */
  const handlePickDepartment = (dept: Department): void => {
    setRecognizedText(dept.name);
    setRegData((prev) => ({
      ...prev,
      departmentName: dept.name,
      departmentId: dept.id,
    }));
    analyticsApi.trackEvent('voice_department_manually_selected', {
      department: dept.name,
      sessionId,
    });
  };

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
          userId: getDemoUserId(),
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

  // 识别成功后统一处理：匹配科室 → 进入确认步骤
  const handleRecognizedDepartment = useCallback(
    async (text: string): Promise<void> => {
      const isCommand = checkVoiceCommands(text);
      if (isCommand) return;

      const isFraud = await checkFraud(text);
      if (isFraud) return;

      const matched = matchDepartment(text);
      setRecognizedText(text);
      setRegData((prev) => ({
        ...prev,
        departmentName: matched ? matched.name : cleanVoiceText(text),
        departmentId: matched ? matched.id : '',
      }));
      setRetryCount(0);
      setCurrentStep(2);
      if (matched) {
        speak(`您说的是${text}，已为您匹配${matched.name}。可以点击屏幕上的科室按钮更换，或直接确认。`);
      } else {
        speak('没有自动识别出科室，请在下方科室列表中点击选择。');
      }
    },
    [checkVoiceCommands, checkFraud, matchDepartment, speak]
  );

  // 步骤1：唤醒语音
  const startStep1Listening = useCallback((): void => {
    speak('请说出您要挂的科室', {
      onEnd: () => {
        startRecognition(
          async (text: string) => {
            await handleRecognizedDepartment(text);
          },
          (error: string) => {
            handleRecognitionError(error);
          }
        );
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speak, startRecognition, handleRecognizedDepartment]);

  // 识别错误处理
  const handleRecognitionError = (error: string): void => {
    logger.warn('语音识别错误', { error, step: currentStep, retryCount });
    const newRetryCount = retryCount + 1;
    setRetryCount(newRetryCount);

    if (newRetryCount >= MAX_RETRIES) {
      setRecognizeFailed(true);
      speak('识别失败，您可以直接在下方输入框手动输入，或按电话求助按钮联系工作人员。');
      analyticsApi.trackEvent('voice_recognition_failed_max_retries', {
        step: currentStep,
        sessionId,
      });
    } else {
      speak(`没听清，请再说一遍。还可以重试${MAX_RETRIES - newRetryCount}次`);
    }
  };

  // 步骤2：确认科室（进入步骤3加载真实号源）
  const handleConfirmText = (): void => {
    stopSpeaking();
    if (!regData.departmentId) {
      speak('还没有确定科室，请点击下方科室按钮选择一个科室。');
      return;
    }
    // 先跳转再播报：不依赖 TTS 回调，避免语音合成不可用时页面卡住
    speak(`好的，${regData.departmentName}，正在为您查询号源`);
    void loadTimeSlots();
    setCurrentStep(3);
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
      speak('识别失败，您可以直接在下方输入框手动输入，或按电话求助按钮联系工作人员。');
      return;
    }

    setRecognizedText('');
    setRegData((prev) => ({ ...prev, departmentName: '', departmentId: '' }));
    speak(`好的，请再说一遍您要挂的科室。还可以重试${MAX_RETRIES - newRetryCount}次`, {
      onEnd: () => {
        startRecognition(
          async (text: string) => {
            const isCommand = checkVoiceCommands(text);
            if (isCommand) return;

            const isFraud = await checkFraud(text);
            if (isFraud) return;

            const matched = matchDepartment(text);
            setRecognizedText(text);
            setRegData((prev) => ({
              ...prev,
              departmentName: matched ? matched.name : cleanVoiceText(text),
              departmentId: matched ? matched.id : '',
            }));
          },
          (error: string) => {
            handleRecognitionError(error);
          }
        );
      },
    });
  };

  // 步骤3：加载号源（真实接口，失败时提示重试，不再使用假号源）
  const loadTimeSlots = async (): Promise<void> => {
    setLoadingSlots(true);
    setSelectedSlotIndex(-1);
    try {
      const slots = await timeSlotsApi.getTimeSlots({
        departmentId: regData.departmentId,
      });
      setTimeSlots(slots);
      if (slots.length > 0) {
        const firstDate = slots[0].slotDate;
        const morning = slots
          .filter((s: TimeSlot) => s.slotDate === firstDate && s.slotPeriod === '上午')
          .map((s: TimeSlot) => s.doctorName)
          .filter(Boolean)
          .join('、');
        const afternoon = slots
          .filter((s: TimeSlot) => s.slotDate === firstDate && s.slotPeriod === '下午')
          .map((s: TimeSlot) => s.doctorName)
          .filter(Boolean)
          .join('、');
        speak(
          `共${slots.length}个号源。${firstDate}上午有${morning}医生，下午有${afternoon}医生。请选择就诊时间和医生。`
        );
      } else {
        speak('该科室暂无可用号源，请返回选择其他科室。');
      }
    } catch (error) {
      logger.error('加载号源失败', error);
      setTimeSlots([]);
      speak('号源加载失败，请点击重新查询，或返回选择其他科室。');
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

  // 步骤4：加载就诊人（直接使用子女端维护的老人信息，不再显示本人/伴侣）
  const loadPatients = async (): Promise<void> => {
    try {
      const items = await getRegistrationPatients(getDemoUserId());
      const list: Patient[] = items.map((p) => ({
        id: p.id,
        name: p.name,
        phone: p.phone,
        idCard: '',
      }));
      setPatients(list);
      if (list.length > 0) {
        setSelectedPatientIndex(0);
        setRegData((prev) => ({
          ...prev,
          patientId: list[0].id,
          patientName: list[0].name,
        }));
        speak(`请选择就诊人，共${list.length}位：${list.map((p) => p.name).join('、')}。`);
      } else {
        setSelectedPatientIndex(-1);
        speak('还没有子女端维护的老人信息，请让子女先在子女端添加。');
      }
    } catch (error) {
      logger.error('加载就诊人失败', error);
      setPatients([]);
      setSelectedPatientIndex(-1);
      speak('就诊人信息加载失败，请返回重试。');
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
    setSubmitting(true);
    setSubmitError('');
    try {
      const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const created = await appointmentsApi.createAppointment({
        userId: getDemoUserId(),
        patientId: regData.patientId,
        departmentId: regData.departmentId,
        doctorId: regData.doctorId || undefined,
        timeSlotId: regData.timeSlotId,
        isVoiceRegistration: true,
        totalDurationSeconds: duration,
        source: 'elder',
      });
      // 用服务端返回的完整数据刷新确认信息
      setRegData((prev) => ({
        ...prev,
        doctorName: created.doctor || prev.doctorName,
        appointmentDate: created.date || prev.appointmentDate,
        appointmentTime: created.timeSlot || prev.appointmentTime,
        patientName: created.patientName || prev.patientName,
        fee: created.fee || prev.fee,
      }));
      setRegistrationSuccess(true);
      speak('挂号成功！请按时就诊。安全提醒：谨防任何要求转账的电话。');
      analyticsApi.trackEvent('voice_registration_success', {
        department: regData.departmentName,
        duration,
        sessionId,
      });
    } catch (error) {
      logger.error('挂号失败', error);
      setSubmitError('挂号失败，请再试一次。若多次失败，请点击"电话求助"联系工作人员。');
      speak('挂号失败，请再试一次。');
    } finally {
      setSubmitting(false);
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
        speak(`您说的是${recognizedText}。可以点击下方文字修改，或点击科室按钮重新选择。确认无误请点绿色按钮。`);
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

  // ==================== 全程语音助手 ====================
  const [assistantListening, setAssistantListening] = useState<boolean>(false);
  const assistantRef = useRef<{ stop: () => void } | null>(null);

  // 各步骤操作指引
  const ASSISTANT_HINTS: Record<number, string> = {
    1: '您可以说"我要挂骨科"这样的指令，或点击屏幕上的科室按钮。',
    2: '您可以说其他科室名称来更换，说"确认"进入下一步，说"返回"回到上一步。',
    3: '您可以说"第一个""第二个"选择号源，也可以说医生名字或"上午""下午"。选好后说"确认"。',
    4: '您可以说"第一个"或就诊人姓名来选择，选好后说"确认"。',
    5: '您可以说"确认挂号"完成挂号，或说"返回"重新选择。',
  };

  /** 解析口语序号："第一个/第2个/2号" → 下标 */
  const parseAssistantIndex = (text: string): number => {
    const cnMap: Record<string, number> = { 一: 0, 二: 1, 两: 1, 三: 2, 四: 3, 五: 4, 六: 5, 七: 6, 八: 7, 九: 8, 十: 9 };
    const m1 = text.match(/第\s*([0-9１-９]+)\s*[个号条]/);
    if (m1) return parseInt(m1[1], 10) - 1;
    const m2 = text.match(/第\s*([一二两三四五六七八九十])\s*[个号条]/);
    if (m2) return cnMap[m2[1]] ?? -1;
    const m3 = text.match(/^([0-9１-９])\s*[号个]$/);
    if (m3) return parseInt(m3[1], 10) - 1;
    const m4 = text.match(/^([一二两三四五六七八九十])[号个]$/);
    if (m4) return cnMap[m4[1]] ?? -1;
    return -1;
  };

  /** 执行语音助手指令：按当前步骤分发 */
  const runAssistantCommand = (text: string): void => {
    const clean = cleanVoiceText(text);
    logger.info('语音助手收到指令', { step: currentStep, command: clean });
    analyticsApi.trackEvent('voice_assistant_command', {
      step: currentStep,
      command: clean.slice(0, 30),
      sessionId,
    });
    if (!clean) {
      speak('没有听清，请再按一次语音助手按钮。');
      return;
    }

    // 全局指令：帮助
    if (/(帮助|怎么办|怎么弄|怎么操作|如何操作|指引|提示|干什么)/.test(clean)) {
      speak(ASSISTANT_HINTS[currentStep] ?? '请按屏幕提示操作。');
      return;
    }
    // 全局指令：返回上一步
    if (/(返回|上一步|回去|退回|重新选)/.test(clean)) {
      if (currentStep > 1) {
        setCurrentStep(currentStep - 1);
        speak('好的，已返回上一步。');
      } else {
        speak('这已经是第一步了。您可以直接说"我要挂某科室"。');
      }
      return;
    }
    // 全局指令：取消挂号
    if (/(不挂了|取消挂号|退出挂号)/.test(clean)) {
      handleCancel();
      return;
    }

    switch (currentStep) {
      // 步骤1：说科室 → 复用识别处理（自动匹配科室并进入步骤2）
      case 1: {
        const matched = matchDepartment(clean);
        if (matched) {
          void handleRecognizedDepartment(clean);
        } else if (clean.length >= 2) {
          void handleRecognizedDepartment(clean);
        } else {
          speak('请说出您要挂的科室，例如"我要挂骨科"。');
        }
        return;
      }
      // 步骤2：换科室 / 确认
      case 2: {
        const confirmMatch = /(确认|确定|提交|就这样|可以了?|对的?|好的?|挂这个)/.test(clean);
        if (confirmMatch) {
          handleConfirmText();
          return;
        }
        const dept = matchDepartment(clean);
        if (dept) {
          handlePickDepartment(dept);
          speak(
            dept.id === regData.departmentId
              ? `${dept.name}已经是当前选择的科室，说"确认"进入下一步。`
              : `已为您选择${dept.name}，说"确认"进入下一步。`
          );
          return;
        }
        speak('没听懂。您可以说科室名称来更换，或说"确认"进入下一步。');
        return;
      }
      // 步骤3：选号源（序号/时段/医生名）→ 确认
      case 3: {
        if (/(确认|确定|提交|就这样|可以了?|对的?|好的?|就这个)/.test(clean)) {
          if (selectedSlotIndex >= 0) {
            handleConfirmSlot();
          } else {
            speak('请先选择一个号源，可以说"第一个"。');
          }
          return;
        }
        const idx = parseAssistantIndex(clean);
        if (idx >= 0) {
          if (idx < timeSlots.length) {
            handleSelectSlot(idx);
            speak(`已选择${timeSlots[idx].slotPeriod}${timeSlots[idx].slotTime}的号源，说"确认"进入下一步。`);
          } else {
            speak(`一共只有${timeSlots.length}个号源，请重新选择。`);
          }
          return;
        }
        if (/上午|早上|中午/.test(clean) || /下午|晚上/.test(clean)) {
          const wantPm = /下午|晚上/.test(clean);
          const found = timeSlots.findIndex((s) =>
            wantPm ? s.slotPeriod.includes('下午') : s.slotPeriod.includes('上午')
          );
          if (found >= 0) {
            handleSelectSlot(found);
            speak(`已选择${timeSlots[found].slotPeriod}${timeSlots[found].slotTime}的号源，说"确认"进入下一步。`);
            return;
          }
          speak(wantPm ? '这个科室没有下午的号源。' : '这个科室没有上午的号源。');
          return;
        }
        const byDoctor = timeSlots.findIndex((s) => {
          if (!s.doctorName) return false;
          const bare = s.doctorName.replace(/医生|大夫/g, '');
          return clean.includes(bare) || clean.includes(s.doctorName);
        });
        if (byDoctor >= 0) {
          handleSelectSlot(byDoctor);
          speak(
            `已选择${timeSlots[byDoctor].doctorName ?? ''}医生${timeSlots[byDoctor].slotPeriod}${timeSlots[byDoctor].slotTime}的号源，说"确认"进入下一步。`
          );
          return;
        }
        speak('没听懂。可以说"第一个"，或医生名字，或"上午""下午"。');
        return;
      }
      // 步骤4：选就诊人（序号/姓名）→ 确认
      case 4: {
        if (/(确认|确定|提交|就这样|可以了?|对的?|好的?|就这个)/.test(clean)) {
          if (selectedPatientIndex >= 0) {
            handleConfirmPatient();
          } else {
            speak('请先选择就诊人，可以说"第一个"。');
          }
          return;
        }
        const idx = parseAssistantIndex(clean);
        if (idx >= 0) {
          if (idx < patients.length) {
            handleSelectPatient(idx);
            speak(`已选择${patients[idx].name}，说"确认"进入下一步。`);
          } else {
            speak(`一共只有${patients.length}位就诊人，请重新选择。`);
          }
          return;
        }
        const byName = patients.findIndex((p) => {
          const bare = p.name.replace(/大爷|奶奶|阿姨|叔叔|爷爷/g, '');
          return clean.includes(p.name) || (bare.length >= 2 && clean.includes(bare));
        });
        if (byName >= 0) {
          handleSelectPatient(byName);
          speak(`已选择${patients[byName].name}，说"确认"进入下一步。`);
          return;
        }
        speak('没听懂。可以说"第一个"或就诊人姓名。');
        return;
      }
      // 步骤5：确认挂号
      case 5: {
        if (/(确认|确定|挂号|提交|可以了?|对的?|好的?|就这样|挂吧)/.test(clean)) {
          void handleConfirmRegistration();
          return;
        }
        speak('说"确认挂号"完成挂号，或说"返回"重新选择。');
        return;
      }
      default:
        speak('请按屏幕提示操作。');
    }
  };

  /** 呼出语音助手：单次监听一句指令 */
  const startAssistant = (): void => {
    stopSpeaking();
    stopRecognition();
    const SR =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike })
        .SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;
    if (!SR) {
      speak('当前浏览器不支持语音识别，请按屏幕按钮手动操作。');
      return;
    }
    try {
      const rec = new SR();
      rec.lang = 'zh-CN';
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onresult = (event: { results: { 0: { 0: { transcript: string } } } }) => {
        const text = event.results?.[0]?.[0]?.transcript ?? '';
        if (text) runAssistantCommand(text);
      };
      rec.onerror = (event: { error: string }) => {
        setAssistantListening(false);
        if (event.error !== 'aborted' && event.error !== 'no-speech') {
          speak('没有听清，请再按一次语音助手按钮。');
        }
      };
      rec.onend = () => setAssistantListening(false);
      assistantRef.current = rec;
      setAssistantListening(true);
      rec.start();
      speak('语音助手在听，请说指令。');
    } catch (error) {
      logger.warn('语音助手启动失败', error);
      setAssistantListening(false);
      speak('语音助手启动失败，请按屏幕按钮手动操作。');
    }
  };

  const stopAssistant = (): void => {
    try {
      assistantRef.current?.stop();
    } catch {
      // 忽略停止异常
    }
    setAssistantListening(false);
  };

  /** 全程悬浮的语音助手按钮 */
  const renderAssistantButton = (): React.ReactNode => (
    <button
      onClick={assistantListening ? stopAssistant : startAssistant}
      aria-label="语音助手"
      className={`fixed bottom-6 right-6 z-50 h-20 w-20 rounded-full text-white shadow-2xl flex flex-col items-center justify-center border-4 border-white transition-all ${
        assistantListening
          ? 'bg-[#D93025] animate-pulse scale-110'
          : 'bg-[#E8710A] hover:bg-[#D95F02] active:scale-95'
      }`}
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
        <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z" />
      </svg>
      <span className="text-[13px] font-bold leading-none mt-1">
        {assistantListening ? '听中...' : '语音助手'}
      </span>
    </button>
  );

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
      <div className="flex-1 flex items-start justify-center px-6 py-6">
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
                <>
                  <button
                    onClick={handleRepeatPrompt}
                    className="text-[24px] font-bold text-[#1A73E8] underline"
                  >
                    听不到？再说一遍
                  </button>
                  <button
                    onClick={() => {
                      stopSpeaking();
                      stopRecognition();
                      setRecognizedText('');
                      setRegData((prev) => ({
                        ...prev,
                        departmentName: '',
                        departmentId: '',
                      }));
                      setCurrentStep(2);
                    }}
                    className="w-full h-20 bg-[#E37400] text-white text-[26px] font-bold rounded-xl hover:bg-[#c26200] active:bg-[#a05100] transition-colors"
                  >
                    ⌨️ 语音不好用？直接手动输入科室
                  </button>
                  {recognizeFailed && (
                    <button
                      onClick={() => navigate('/elder/help')}
                      className="w-full h-20 bg-[#D93025] text-white text-[28px] font-bold rounded-xl hover:bg-red-700 active:bg-red-800 transition-colors"
                    >
                      📞 电话求助
                    </button>
                  )}
                </>
              )}
              {recognizeFailed && (
                <p className="text-[24px] font-bold text-[#D93025] text-center">
                  语音识别多次失败，请点击上方按钮手动输入，或电话求助
                </p>
              )}
            </div>
          )}

          {/* 步骤2：识别结果确认（可手动修改 + 科室选择） */}
          {currentStep === 2 && (
            <div className="flex flex-col gap-6">
              <h2 className="text-[32px] font-bold text-black text-center">
                确认您要挂的科室
              </h2>

              {/* 可编辑的识别文本 */}
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="recognized-text-input"
                  className="text-[24px] font-bold text-black"
                >
                  识别结果（可直接点击修改）：
                </label>
                <input
                  id="recognized-text-input"
                  type="text"
                  value={recognizedText}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    handleEditText(e.target.value)
                  }
                  placeholder="识别结果为空时，可在此手动输入科室"
                  className="w-full h-20 px-5 text-[32px] font-bold text-black bg-white border-3 border-[#1A73E8] rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-200"
                  aria-label="识别结果，可手动修改"
                />
                {regData.departmentId ? (
                  <p className="text-[22px] font-bold text-[#137333]">
                    ✓ 已匹配科室：{regData.departmentName}
                  </p>
                ) : (
                  <p className="text-[22px] text-[#E37400] font-bold">
                    未匹配到科室，请点击下方按钮选择
                  </p>
                )}
              </div>

              {/* 科室选择网格 */}
              <div className="flex flex-col gap-3">
                <p className="text-[24px] font-bold text-black">或直接点选科室：</p>
                <div className="grid grid-cols-2 gap-3">
                  {departments.map((dept: Department) => {
                    const isSelected = dept.id === regData.departmentId;
                    return (
                      <button
                        key={dept.id}
                        onClick={() => handlePickDepartment(dept)}
                        className={`h-20 rounded-xl border-3 text-[28px] font-bold transition-all active:scale-95 ${
                          isSelected
                            ? 'bg-[#1A73E8] text-white border-[#1A73E8] shadow-lg'
                            : 'bg-white text-black border-black hover:border-[#1A73E8] hover:bg-blue-50'
                        }`}
                        aria-label={`选择${dept.name}`}
                        aria-pressed={isSelected}
                      >
                        {isSelected ? '✓ ' : ''}
                        {dept.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {recognizeFailed && (
                <p className="text-[22px] text-[#D93025] font-bold text-center">
                  语音识别多次失败，请直接在上方输入框手动输入或点选科室
                </p>
              )}

              <div className="w-full flex flex-col gap-4">
                <button
                  onClick={handleConfirmText}
                  disabled={!regData.departmentId}
                  className="w-full h-24 bg-[#137333] text-white text-[32px] font-bold rounded-xl hover:bg-green-700 active:bg-green-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ✓ 对，就挂{regData.departmentName || '这个科'}
                </button>
                <button
                  onClick={handleRejectText}
                  className="w-full h-20 bg-[#E37400] text-white text-[28px] font-bold rounded-xl hover:bg-[#c26200] active:bg-[#a05100] transition-colors"
                >
                  🎤 不对，重新语音输入
                </button>
                {recognizeFailed && (
                  <button
                    onClick={() => navigate('/elder/help')}
                    className="w-full h-20 bg-[#D93025] text-white text-[28px] font-bold rounded-xl hover:bg-red-700 active:bg-red-800 transition-colors"
                  >
                    📞 电话求助
                  </button>
                )}
              </div>
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
              ) : timeSlots.length === 0 ? (
                <div className="flex flex-col gap-4">
                  <p className="text-[26px] text-center text-gray-700">
                    该科室当前暂无可挂号源
                  </p>
                  <button
                    onClick={() => void loadTimeSlots()}
                    className="w-full h-20 bg-[#1A73E8] text-white text-[28px] font-bold rounded-xl hover:bg-[#1557b0] transition-colors"
                  >
                    重新查询
                  </button>
                  <button
                    onClick={() => setCurrentStep(2)}
                    className="w-full h-20 bg-white text-black text-[28px] font-bold rounded-xl border-3 border-black hover:bg-gray-100 transition-colors"
                  >
                    返回选择科室
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-5 max-h-[560px] overflow-y-auto">
                    {groupSlotsByDate(timeSlots).map((group) => (
                      <div
                        key={group.date}
                        className="border-3 border-black rounded-xl p-4 flex flex-col gap-3"
                      >
                        <p className="text-[24px] font-bold text-black">📅 {group.date}</p>
                        {group.periods.map(({ period, time, items }) => (
                          <div key={period} className="flex flex-col gap-2">
                            <p className="text-[22px] font-bold text-[#1A73E8]">
                              {period}
                              <span className="text-[20px] text-gray-600 font-normal">
                                （{time} 出诊 · {items.length} 位医生）
                              </span>
                            </p>
                            {items.map(({ slot, index }) => (
                              <button
                                key={slot.id}
                                onClick={() => handleSelectSlot(index)}
                                className={`w-full p-4 rounded-xl border-3 text-left transition-all ${
                                  selectedSlotIndex === index
                                    ? 'border-[#1A73E8] bg-blue-50'
                                    : 'border-gray-300 bg-white hover:border-[#1A73E8] active:bg-gray-50'
                                }`}
                                aria-label={`选择${group.date}${period}${slot.doctorName}的号`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex flex-col gap-1">
                                    <p className="text-[24px] font-bold text-black">
                                      👨‍⚕️ {slot.doctorName}
                                    </p>
                                    <p className="text-[20px] text-gray-700">
                                      {slot.doctorTitle ?? '医师'} · 挂号费 ¥{slot.fee}
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
                        ))}
                      </div>
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
              <p className="text-[20px] text-center text-gray-600">
                以下为子女端维护的老人信息
              </p>
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
                              <p className="text-[26px] font-bold text-black">
                                {patient.name}
                              </p>
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
                  <p className="text-[22px] text-gray-500">请让子女在子女端维护老人信息</p>
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
                {submitError && (
                  <p className="text-[24px] font-bold text-[#D93025] text-center bg-red-50 border-2 border-[#D93025] rounded-xl p-4">
                    ⚠️ {submitError}
                  </p>
                )}
                <button
                  onClick={handleConfirmRegistration}
                  disabled={submitting}
                  className="w-full h-24 bg-[#137333] text-white text-[32px] font-bold rounded-xl hover:bg-green-700 active:bg-green-800 transition-colors shadow-lg disabled:opacity-60 disabled:cursor-wait"
                >
                  {submitting ? '正在提交挂号...' : '✓ 确认挂号'}
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

      {/* 全程悬浮语音助手 */}
      {renderAssistantButton()}
    </div>
  );
};

export default VoiceRegisterPage;
