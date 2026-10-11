import { logger } from '@lark-apaas/client-toolkit/logger';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';

export interface VoiceDetectResponse {
  isFraud: boolean;
  triggerWord: string | null;
  recognizedKeyword: string | null;
  matchedDepartment: string | null;
  matchedDoctor: string | null;
  normalizedText: string;
}

export async function detectFraud(data: {
  text: string;
  sessionId: string;
  stepNumber: number;
  userId?: string;
  dialect?: string;
}): Promise<VoiceDetectResponse> {
  try {
    const response = await axiosForBackend({
      url: '/api/voice/detect',
      method: 'POST',
      data,
    });
    return response.data;
  } catch (error) {
    logger.error('语音敏感词检测失败', error);
    throw error;
  }
}

export interface VoiceRecognitionResult {
  transcript: string;
  confidence: number;
  intent?: string;
  entities?: Record<string, string>;
}

export interface FraudCheckResult {
  isFraud: boolean;
  matchedWords: string[];
  severity: 'low' | 'medium' | 'high';
}

export async function checkFraud(text: string): Promise<FraudCheckResult> {
  try {
    const response = await axiosForBackend({
      url: '/api/voice/fraud-check',
      method: 'POST',
      data: { text },
    });
    return response.data;
  } catch (error) {
    logger.error('防诈检测失败', error);
    throw error;
  }
}

export async function parseVoiceIntent(text: string): Promise<VoiceRecognitionResult> {
  try {
    const response = await axiosForBackend({
      url: '/api/voice/parse',
      method: 'POST',
      data: { text },
    });
    return response.data;
  } catch (error) {
    logger.error('语音意图解析失败', error);
    throw error;
  }
}

export async function logVoiceSession(data: {
  transcript: string;
  success: boolean;
  duration: number;
  step: number;
}): Promise<void> {
  try {
    await axiosForBackend({
      url: '/api/voice/log',
      method: 'POST',
      data,
    });
  } catch (error) {
    logger.error('语音日志上报失败', error);
    throw error;
  }
}
