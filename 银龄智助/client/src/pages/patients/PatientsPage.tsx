import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { patientsApi } from '@client/src/api';
import { analyticsApi } from '@client/src/api';
import { Badge } from '@client/src/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@client/src/components/ui/dialog';

interface Patient {
  id: string;
  name: string;
  idCard: string;
  medicalCardNo?: string;
  phone?: string;
  relation?: string;
  isDefault?: boolean;
}

const PatientsPage: React.FC = () => {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [editDialogOpen, setEditDialogOpen] = useState<boolean>(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  useEffect(() => {
    loadPatients();
    analyticsApi.trackEvent('patients_page_view');
  }, []);

  const loadPatients = async (): Promise<void> => {
    setLoading(true);
    try {
      const data = await patientsApi.getPatients();
      setPatients(data);
      logger.info('就诊人列表加载成功', { count: data.length });
    } catch (error) {
      logger.error('就诊人列表加载失败', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string): Promise<void> => {
    try {
      await patientsApi.deletePatient(id);
      analyticsApi.trackEvent('patients_delete', { patientId: id });
      logger.info('删除就诊人成功', { id });
      loadPatients();
      setEditDialogOpen(false);
    } catch (error) {
      logger.error('删除就诊人失败', error);
    }
  };

  const handleEdit = (patient: Patient): void => {
    setSelectedPatient(patient);
    setEditDialogOpen(true);
    analyticsApi.trackEvent('patients_edit_click', { patientId: patient.id });
  };

  const handleAddPatient = (): void => {
    analyticsApi.trackEvent('patients_add_click');
    // 演示环境暂不实现完整表单
    logger.info('添加就诊人按钮点击');
  };

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
          <h1 className="text-[36px] font-bold text-black">常用就诊人</h1>
        </div>

        {/* 就诊人列表 */}
        {patients.length > 0 ? (
          <div className="flex flex-col gap-4 mb-8">
            {patients.map((patient: Patient) => (
              <div
                key={patient.id}
                className="w-full p-6 border-3 border-black rounded-2xl bg-white hover:border-[#1A73E8] active:bg-gray-50 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-5">
                    <div className="w-[72px] h-[72px] bg-[#1A73E8] text-white rounded-full flex items-center justify-center text-[32px] font-bold">
                      {patient.name.charAt(0)}
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-3">
                        <h3 className="text-[28px] font-bold text-black">{patient.name}</h3>
                        {patient.relation && (
                          <span className="text-[20px] text-gray-600 font-medium">
                            {patient.relation}
                          </span>
                        )}
                        {patient.isDefault && (
                          <Badge className="bg-[#137333] text-white text-[18px] px-3 py-1 rounded-full font-bold">
                            默认
                          </Badge>
                        )}
                      </div>
                      {patient.phone && (
                        <p className="text-[22px] text-gray-700">
                          📞 {patient.phone}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleEdit(patient)}
                    className="h-14 px-6 bg-gray-100 text-black text-[22px] font-bold rounded-xl border-2 border-black hover:bg-gray-200 active:bg-gray-300 transition-colors"
                    aria-label={`编辑${patient.name}的信息`}
                  >
                    编辑
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="w-full p-12 border-3 border-dashed border-gray-400 rounded-3xl bg-gray-50 text-center mb-8">
            <p className="text-[80px] mb-6" aria-hidden="true">👴</p>
            <p className="text-[28px] font-bold text-gray-600">还没有添加就诊人</p>
            <p className="text-[22px] text-gray-500 mt-3">
              请让子女帮您添加就诊人信息
            </p>
          </div>
        )}

        {/* 添加就诊人按钮 */}
        <button
          onClick={handleAddPatient}
          className="w-full h-24 border-4 border-dashed border-black rounded-2xl text-[28px] font-bold text-black hover:border-[#1A73E8] hover:text-[#1A73E8] hover:bg-blue-50 active:bg-blue-100 transition-all flex items-center justify-center gap-3"
          aria-label="添加就诊人"
        >
          <span className="text-[40px]">+</span>
          添加就诊人
        </button>
      </div>

      {/* 编辑弹窗 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-[560px] w-[90%] p-8 rounded-2xl border-3 border-black">
          <DialogHeader>
            <DialogTitle className="text-[32px] font-bold text-black">就诊人信息</DialogTitle>
          </DialogHeader>
          <DialogDescription asChild>
            <div className="flex flex-col gap-4 mt-4">
              {selectedPatient && (
                <>
                  <div className="flex justify-between text-[24px]">
                    <span className="text-gray-600">姓名：</span>
                    <span className="font-bold text-black">{selectedPatient.name}</span>
                  </div>
                  {selectedPatient.relation && (
                    <div className="flex justify-between text-[24px]">
                      <span className="text-gray-600">关系：</span>
                      <span className="font-bold text-black">{selectedPatient.relation}</span>
                    </div>
                  )}
                  {selectedPatient.phone && (
                    <div className="flex justify-between text-[24px]">
                      <span className="text-gray-600">电话：</span>
                      <span className="font-bold text-black">{selectedPatient.phone}</span>
                    </div>
                  )}
                  <div className="flex gap-4 mt-6 pt-6 border-t-2 border-gray-200">
                    <button
                      onClick={() => setEditDialogOpen(false)}
                      className="flex-1 h-16 bg-gray-200 text-black text-[24px] font-bold rounded-xl border-2 border-black hover:bg-gray-300 active:bg-gray-400 transition-colors"
                    >
                      关闭
                    </button>
                    <button
                      onClick={() => handleDelete(selectedPatient.id)}
                      className="flex-1 h-16 bg-[#D93025] text-white text-[24px] font-bold rounded-xl hover:bg-red-700 active:bg-red-800 transition-colors"
                    >
                      删除
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

export default PatientsPage;
