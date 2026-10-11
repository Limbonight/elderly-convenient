import { useState, useCallback, useRef, useEffect } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';

interface UseSpeechOptions {
  lang?: string;
  rate?: number;
}

interface UseSpeechReturn {
  isListening: boolean;
  isSpeaking: boolean;
  supported: boolean;
  speak: (text: string, options?: { rate?: number; onEnd?: () => void }) => void;
  stopSpeaking: () => void;
  startRecognition: (onResult: (text: string) => void, onError?: (error: string) => void) => void;
  stopRecognition: () => void;
  abortRecognition: () => void;
}

type SpeechRecognitionType = {
  new (): SpeechRecognitionInstance;
};

type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: { transcript: string }[][]; resultIndex: number }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function getSpeechRecognitionCtor(): SpeechRecognitionType | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionType;
    webkitSpeechRecognition?: SpeechRecognitionType;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function hasSpeechSynthesis(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function useSpeech(options: UseSpeechOptions = {}): UseSpeechReturn {
  const { lang = 'zh-CN', rate = 0.9 } = options;
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const onResultRef = useRef<((text: string) => void) | null>(null);
  const onErrorRef = useRef<((error: string) => void) | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const supportedRef = useRef<boolean>(
    getSpeechRecognitionCtor() !== null && hasSpeechSynthesis()
  );

  const ensureRecognition = useCallback((): SpeechRecognitionInstance | null => {
    if (recognitionRef.current) return recognitionRef.current;
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return null;
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = false;
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onresult = (event: { results: { transcript: string }[][]; resultIndex: number }) => {
      const transcript = event.results[event.resultIndex][0]?.transcript ?? '';
      logger.debug('语音识别结果', { transcript });
      onResultRef.current?.(transcript);
    };

    rec.onerror = (event: { error: string }) => {
      logger.warn('语音识别错误', { error: event.error });
      setIsListening(false);
      onErrorRef.current?.(event.error);
    };

    rec.onend = () => {
      setIsListening(false);
    };

    rec.onstart = () => {
      setIsListening(true);
    };

    recognitionRef.current = rec;
    return rec;
  }, [lang]);

  const speak = useCallback(
    (text: string, opts?: { rate?: number; onEnd?: () => void }) => {
      if (!hasSpeechSynthesis()) {
        logger.warn('浏览器不支持语音合成');
        opts?.onEnd?.();
        return;
      }
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.rate = opts?.rate ?? rate;
        utterance.pitch = 1;
        utterance.volume = 1;
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => {
          setIsSpeaking(false);
          opts?.onEnd?.();
        };
        utterance.onerror = () => {
          setIsSpeaking(false);
        };
        utteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
      } catch (error) {
        logger.error('语音播报失败', error);
        setIsSpeaking(false);
      }
    },
    [lang, rate]
  );

  const stopSpeaking = useCallback(() => {
    if (hasSpeechSynthesis()) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, []);

  const startRecognition = useCallback(
    (onResult: (text: string) => void, onError?: (error: string) => void) => {
      const rec = ensureRecognition();
      if (!rec) {
        logger.warn('浏览器不支持语音识别');
        onError?.('not-supported');
        return;
      }
      onResultRef.current = onResult;
      onErrorRef.current = onError ?? null;
      try {
        rec.start();
      } catch (error) {
        logger.warn('启动语音识别失败', error);
        // 可能已经在运行，先停止再启动
        try {
          rec.abort();
          setTimeout(() => {
            try {
              rec.start();
            } catch (e) {
              logger.error('重试启动语音识别失败', e);
            }
          }, 200);
        } catch (e) {
          logger.error('停止语音识别失败', e);
        }
      }
    },
    [ensureRecognition]
  );

  const stopRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        logger.warn('停止语音识别失败', error);
      }
    }
    setIsListening(false);
  }, []);

  const abortRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (error) {
        logger.warn('中止语音识别失败', error);
      }
    }
    setIsListening(false);
  }, []);

  useEffect(() => {
    return () => {
      stopSpeaking();
      abortRecognition();
    };
  }, [stopSpeaking, abortRecognition]);

  return {
    isListening,
    isSpeaking,
    supported: supportedRef.current,
    speak,
    stopSpeaking,
    startRecognition,
    stopRecognition,
    abortRecognition,
  };
}
