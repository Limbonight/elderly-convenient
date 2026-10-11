import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { analyticsApi } from '@client/src/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@client/src/components/ui/dialog';
import { UniversalLink } from '@lark-apaas/client-toolkit/components/UniversalLink';

const HelpPage: React.FC = () => {
  const navigate = useNavigate();
  const [reportDialogOpen, setReportDialogOpen] = useState<boolean>(false);

  useEffect(() => {
    analyticsApi.trackEvent('help_page_view');
  }, []);

  const handleCall = (): void => {
    analyticsApi.trackEvent('help_call_click');
    logger.info('一键呼叫客服');
  };

  const handleReportFraud = (): void => {
    analyticsApi.trackEvent('help_fraud_report_click');
    setReportDialogOpen(true);
    logger.info('防诈骗举报点击');
  };

  const confirmReport = (): void => {
    analyticsApi.trackEvent('help_fraud_report_confirmed');
    logger.info('防诈骗举报已提交');
    setReportDialogOpen(false);
  };

  return (
    <div className="min-h-screen w-full bg-white overflow-hidden">
      <div className="max-w-[600px] mx-auto px-6 py-6">
        {/* 返回按钮 + 标题 */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate('/elder')}
            className="h-14 w-14 flex items-center justify-center text-[32px] font-bold border-3 border-black rounded-xl bg-white hover:bg-gray-100 active:bg-gray-200 transition-colors"
            aria-label="返回首页"
          >
            ←
          </button>
          <h1 className="text-[36px] font-bold text-black">求助中心</h1>
        </div>

        {/* 超大电话按钮 */}
        <UniversalLink
          to="tel:12320"
          onClick={handleCall}
          className="w-full h-[160px] bg-[#D93025] text-white text-[36px] font-bold rounded-[20px] hover:bg-red-700 active:bg-red-800 transition-all flex flex-col items-center justify-center gap-2 shadow-lg active:scale-[0.98] mb-8"
          aria-label="一键呼叫客服电话12320"
        >
          <span className="text-[64px]" aria-hidden="true">📞</span>
          一键呼叫客服
        </UniversalLink>

        {/* 说明文字 */}
        <div className="text-center mb-8">
          <p className="text-[24px] text-black leading-relaxed">
            如有任何问题，点击按钮即可<br />联系我们的工作人员
          </p>
        </div>

        {/* 防诈骗举报按钮 */}
        <button
          onClick={handleReportFraud}
          className="w-full h-24 bg-white text-[#D93025] text-[28px] font-bold rounded-[20px] border-4 border-[#D93025] hover:bg-red-50 active:bg-red-100 transition-all flex items-center justify-center gap-3 mb-8"
          aria-label="防诈骗举报"
        >
          <span className="text-[36px]" aria-hidden="true">🚨</span>
          防诈骗举报
        </button>

        {/* 防诈骗提醒 */}
        <div className="w-full p-6 bg-[#D93025] rounded-[20px]">
          <h3 className="text-[28px] font-bold text-white mb-4 flex items-center gap-3">
            <span aria-hidden="true">⚠️</span>
            防诈骗重要提醒
          </h3>
          <ul className="text-[22px] text-white space-y-3 font-medium">
            <li>• 官方人员不会要求您转账</li>
            <li>• 官方人员不会索要密码或验证码</li>
            <li>• 官方电话：12320</li>
            <li>• 遇到可疑情况请立即拨打 110</li>
          </ul>
        </div>
      </div>

      {/* 举报确认弹窗 */}
      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent className="max-w-[560px] w-[90%] p-8 rounded-2xl border-4 border-[#D93025]">
          <DialogHeader>
            <DialogTitle className="text-[32px] font-bold text-[#D93025] flex items-center gap-3">
              <span aria-hidden="true">🚨</span>
              举报诈骗
            </DialogTitle>
          </DialogHeader>
          <DialogDescription asChild>
            <div className="mt-4">
              <p className="text-[24px] text-black font-medium leading-relaxed mb-6">
                感谢您的举报！我们将立即处理并通知相关部门。您的安全是我们最重要的责任。
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setReportDialogOpen(false)}
                  className="flex-1 h-16 bg-gray-200 text-black text-[24px] font-bold rounded-xl border-2 border-black hover:bg-gray-300 active:bg-gray-400 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={confirmReport}
                  className="flex-1 h-16 bg-[#D93025] text-white text-[24px] font-bold rounded-xl hover:bg-red-700 active:bg-red-800 transition-colors"
                >
                  确认举报
                </button>
              </div>
            </div>
          </DialogDescription>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HelpPage;
