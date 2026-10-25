import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { useSpeech } from '@client/src/hooks/useSpeech';

const PAGE_HINTS: Array<{ test: RegExp; text: string }> = [
  {
    test: /^\/elder$/,
    text: '这里是首页。您可以说"我要挂号"、"我的挂号"、"就诊人"或"帮助"。',
  },
  {
    test: /^\/elder\/records/,
    text: '这里是挂号记录页，可以查看您的预约。您可以说"我要挂号"或"返回首页"。',
  },
  {
    test: /^\/elder\/patients/,
    text: '这里是就诊人页。您可以说"我要挂号"或"返回首页"。',
  },
  {
    test: /^\/elder\/help/,
    text: '这里是帮助页，可以查看电话求助和常见问题。您可以说"我要挂号"或"返回首页"。',
  },
];

/**
 * 老年端全程语音助手：除挂号页（有分步骤专用助手）外，所有老年端页面右下角常驻。
 */
const ElderVoiceAssistant = (): React.ReactNode => {
  const location = useLocation();
  const navigate = useNavigate();
  const { speak, stopSpeaking, startRecognition, stopRecognition, isListening } = useSpeech();
  const route = location.pathname;

  const pageHint = (): string =>
    PAGE_HINTS.find((p) => p.test.test(route))?.text ??
    '您可以说"我要挂号"、"我的挂号"、"就诊人"、"帮助"或"返回首页"。';

  const handleCommand = (raw: string): void => {
    const text = (raw ?? '').trim();
    logger.info('全局语音助手指令', { route, text });
    if (!text) {
      speak('没有听清，请再按一次语音助手按钮。');
      return;
    }
    if (/(挂号|看病|预约|就诊)/.test(text)) {
      stopSpeaking();
      navigate('/elder/register');
      return;
    }
    if (/(记录|我的挂号|预约记录|查挂号)/.test(text)) {
      stopSpeaking();
      navigate('/elder/records');
      return;
    }
    if (/(就诊人|家人|父母|信息)/.test(text)) {
      stopSpeaking();
      navigate('/elder/patients');
      return;
    }
    if (/(帮助|怎么用|怎么操作|指引|不会用)/.test(text)) {
      speak(pageHint());
      return;
    }
    if (/(首页|回首页|返回|回去)/.test(text)) {
      stopSpeaking();
      navigate('/elder');
      return;
    }
    speak('没听懂。您可以说"我要挂号"、"我的挂号"、"就诊人"、"帮助"或"返回首页"。');
  };

  const start = (): void => {
    stopSpeaking();
    startRecognition(
      (text: string) => handleCommand(text),
      (error: string) => {
        if (error === 'not-supported') {
          speak('当前浏览器不支持语音识别，请用 Chrome 或 Edge 打开。');
          return;
        }
        if (error !== 'aborted' && error !== 'no-speech') {
          speak('没有听清，请再按一次语音助手按钮。');
        }
      },
    );
    speak('语音助手在听，请说指令。');
  };

  const toggle = (): void => {
    if (isListening) {
      stopRecognition();
      stopSpeaking();
      return;
    }
    start();
  };

  // 仅老年端页面显示；挂号页有分步骤专用助手，避免出现两个按钮
  if (!route.startsWith('/elder') || route.startsWith('/elder/register')) return null;

  return (
    <button
      onClick={toggle}
      aria-label="语音助手"
      className={`fixed bottom-6 right-6 z-50 h-20 w-20 rounded-full text-white shadow-2xl flex flex-col items-center justify-center border-4 border-white transition-all ${
        isListening
          ? 'bg-[#D93025] animate-pulse scale-110'
          : 'bg-[#E8710A] hover:bg-[#D95F02] active:scale-95'
      }`}
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
        <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z" />
      </svg>
      <span className="text-[13px] font-bold leading-none mt-1">
        {isListening ? '听中...' : '语音助手'}
      </span>
    </button>
  );
};

export default ElderVoiceAssistant;
