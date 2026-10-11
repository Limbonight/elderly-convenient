import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { useAccessibility } from '@client/src/contexts/AccessibilityContext';
import { analyticsApi } from '@client/src/api';

const ElderHomePage: React.FC = () => {
  const navigate = useNavigate();
  const { highContrast, toggleHighContrast } = useAccessibility();

  useEffect(() => {
    analyticsApi.trackEvent('elder_home_view');
    logger.info('老年端首页加载');
  }, []);

  const handleVoiceRegister = (): void => {
    analyticsApi.trackEvent('elder_home_voice_register_click');
    navigate('/elder/register');
  };

  const handleRecords = (): void => {
    analyticsApi.trackEvent('elder_home_records_click');
    navigate('/elder/records');
  };

  const handleHelp = (): void => {
    analyticsApi.trackEvent('elder_home_help_click');
    navigate('/elder/help');
  };

  const handleToggleHighContrast = (): void => {
    analyticsApi.trackEvent('elder_home_high_contrast_toggle', { highContrast: !highContrast });
    toggleHighContrast();
  };

  return (
    <div className="min-h-screen w-full bg-white flex flex-col items-center overflow-hidden">
      {/* 高对比度切换按钮 */}
      <button
        onClick={handleToggleHighContrast}
        className="absolute top-4 right-4 px-4 py-2 text-lg font-bold border-2 border-black rounded-xl bg-white text-black hover:bg-gray-100 active:bg-gray-200 transition-colors z-10"
        aria-label={highContrast ? '关闭高对比度模式' : '开启高对比度模式'}
      >
        {highContrast ? '✓ 高对比度' : '高对比度'}
      </button>

      <div className="w-full max-w-[600px] mx-auto px-6 py-8 flex flex-col items-center flex-1 justify-center">
        {/* 顶部大标题 */}
        <div className="text-center mb-12">
          <h1 className="text-[48px] font-black text-black leading-tight mb-4">
            一键挂号
          </h1>
          <p className="text-[28px] text-black font-medium">
            专为老年人设计的挂号系统
          </p>
        </div>

        {/* 三个超大按钮 */}
        <div className="w-full flex flex-col gap-8 mb-12" data-ai-section-type="button">
          <button
            onClick={handleVoiceRegister}
            className="w-full h-[140px] bg-[#1A73E8] text-white text-[32px] font-bold rounded-[20px] hover:bg-[#1557b0] active:bg-[#0d47a1] transition-all flex items-center justify-center gap-4 shadow-lg active:scale-[0.98]"
            aria-label="语音挂号"
          >
            <span className="text-[48px]" aria-hidden="true">🎤</span>
            语音挂号
          </button>

          <button
            onClick={handleRecords}
            className="w-full h-[140px] bg-[#0d47a1] text-white text-[32px] font-bold rounded-[20px] hover:bg-[#0a3880] active:bg-[#07295e] transition-all flex items-center justify-center gap-4 shadow-lg active:scale-[0.98]"
            aria-label="我的挂号"
          >
            <span className="text-[48px]" aria-hidden="true">📋</span>
            我的挂号
          </button>

          <button
            onClick={handleHelp}
            className="w-full h-[140px] bg-[#137333] text-white text-[32px] font-bold rounded-[20px] hover:bg-[#0e5a28] active:bg-[#0a421d] transition-all flex items-center justify-center gap-4 shadow-lg active:scale-[0.98]"
            aria-label="电话求助"
          >
            <span className="text-[48px]" aria-hidden="true">📞</span>
            电话求助
          </button>
        </div>

        {/* 底部官方认证标识 */}
        <div className="text-center">
          <p className="text-[20px] text-gray-500 font-medium">
            工信部备案 · 官方认证 · 安全可靠
          </p>
        </div>
      </div>
    </div>
  );
};

export default ElderHomePage;
