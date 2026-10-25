import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { UserPlus, UserPen, ArrowLeft, CheckCircle, InfoIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { familyApi } from '@/api';
import type { FamilyMember } from '@/api/family';

const RELATION_OPTIONS = [
  { value: 'father', label: '父亲' },
  { value: 'mother', label: '母亲' },
  { value: 'spouse', label: '配偶' },
  { value: 'other', label: '其他' },
];

const FamilyBindPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit') ?? '';
  const isEditMode = editId !== '';

  const [name, setName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [relationship, setRelationship] = useState<string>('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string>('');
  const [success, setSuccess] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(isEditMode);
  const [loadFailed, setLoadFailed] = useState<boolean>(false);

  // 编辑模式：加载已有信息预填
  useEffect(() => {
    if (!isEditMode) return;
    const loadMember = async (): Promise<void> => {
      try {
        const members = await familyApi.getFamilyMembers();
        const member = members.find((m: FamilyMember) => m.id === editId);
        if (member) {
          setName(member.name);
          setPhone(member.phone);
          setRelationship(member.relation);
        } else {
          setLoadFailed(true);
        }
      } catch (error) {
        logger.warn('加载待修改信息失败', error);
        setLoadFailed(true);
      } finally {
        setLoading(false);
      }
    };
    void loadMember();
  }, [isEditMode, editId]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = '请输入老人姓名';
    if (!phone.trim()) {
      newErrors.phone = '请输入手机号';
    } else if (!/^1[3-9]\d{9}$/.test(phone.trim())) {
      newErrors.phone = '请输入正确的11位手机号';
    }
    if (!relationship) newErrors.relationship = '请选择与您的关系';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setSubmitError('');
    logger.info(isEditMode ? '提交修改父母信息' : '提交绑定父母信息', {
      editId,
      name,
      relationship,
    });

    try {
      if (isEditMode) {
        await familyApi.updateFamilyMember(editId, {
          name: name.trim(),
          phone: phone.trim(),
          relation: relationship,
        });
      } else {
        await familyApi.bindFamilyMember({
          name: name.trim(),
          phone: phone.trim(),
          relation: relationship,
          idCard: '',
        });
      }
      setSubmitting(false);
      setSuccess(true);
    } catch (error) {
      logger.error(isEditMode ? '修改父母信息失败' : '绑定父母信息失败', error);
      setSubmitting(false);
      setSubmitError('保存失败，请检查网络后重试。若多次失败，请稍后再试。');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6 py-6">
        <div className="animate-pulse flex flex-col gap-4">
          <div className="h-8 w-56 bg-gray-200 rounded"></div>
          <div className="h-64 w-full bg-gray-100 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (success) {
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

        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6">
            <CheckCircle className="w-10 h-10 text-[#137333]" />
          </div>
          <h2 className="text-2xl font-bold text-[#1A1A1A] mb-2">
            {isEditMode ? '修改成功' : '绑定成功'}
          </h2>
          <p className="text-base text-gray-600 max-w-sm">
            {isEditMode ? (
              <>
                已更新 <span className="font-semibold text-[#1A1A1A]">{name}</span> 的信息
              </>
            ) : (
              <>
                已成功添加 <span className="font-semibold text-[#1A1A1A]">{name}</span>，
                老人挂号时会自动通知您
              </>
            )}
          </p>

          <div className="flex gap-3 mt-8 w-full max-w-sm">
            {!isEditMode && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setSuccess(false);
                  setName('');
                  setPhone('');
                  setRelationship('');
                }}
              >
                继续添加
              </Button>
            )}
            <Button
              className="flex-1 bg-[#1A73E8] hover:bg-[#1557B0]"
              onClick={() => navigate('/family')}
            >
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
        <h1 className="text-3xl font-bold text-[#1A1A1A] mb-2">
          {isEditMode ? '修改父母信息' : '添加父母信息'}
        </h1>
        <p className="text-base text-gray-600">
          {isEditMode ? '修改后老人挂号通知将使用新信息' : '绑定后可接收挂号通知和防诈提醒'}
        </p>
      </div>

      {loadFailed && (
        <Alert variant="destructive">
          <AlertTitle>加载信息失败</AlertTitle>
          <AlertDescription>
            未找到该老人的信息，可能已被删除。请返回首页后重试。
          </AlertDescription>
        </Alert>
      )}

      <Card className="border border-gray-200">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-[#1A1A1A]">
            {isEditMode ? (
              <UserPen className="w-5 h-5 inline-block mr-2 text-[#1A73E8]" />
            ) : (
              <UserPlus className="w-5 h-5 inline-block mr-2 text-[#1A73E8]" />
            )}
            {isEditMode ? '修改老人信息' : '填写老人信息'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* 老人姓名 */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="elder-name" className="text-sm font-medium text-[#1A1A1A]">
                老人姓名 <span className="text-[#D93025]">*</span>
              </Label>
              <Input
                id="elder-name"
                type="text"
                placeholder="请输入老人姓名"
                value={name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                className={`h-10 text-base ${errors.name ? 'border-[#D93025] focus-visible:ring-[#D93025]/20' : ''}`}
              />
              {errors.name && (
                <p className="text-xs text-[#D93025]">{errors.name}</p>
              )}
            </div>

            {/* 手机号 */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="elder-phone" className="text-sm font-medium text-[#1A1A1A]">
                手机号 <span className="text-[#D93025]">*</span>
              </Label>
              <Input
                id="elder-phone"
                type="tel"
                placeholder="请输入11位手机号"
                value={phone}
                maxLength={11}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPhone(e.target.value.replace(/\D/g, ''))}
                className={`h-10 text-base ${errors.phone ? 'border-[#D93025] focus-visible:ring-[#D93025]/20' : ''}`}
              />
              {errors.phone && (
                <p className="text-xs text-[#D93025]">{errors.phone}</p>
              )}
            </div>

            {/* 关系 */}
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium text-[#1A1A1A]">
                与您的关系 <span className="text-[#D93025]">*</span>
              </Label>
              <Select value={relationship} onValueChange={setRelationship}>
                <SelectTrigger className={`h-10 text-base ${errors.relationship ? 'border-[#D93025]' : ''}`}>
                  <SelectValue placeholder="请选择关系" />
                </SelectTrigger>
                <SelectContent>
                  {RELATION_OPTIONS.map((opt: { value: string; label: string }) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.relationship && (
                <p className="text-xs text-[#D93025]">{errors.relationship}</p>
              )}
            </div>

            {submitError && (
              <p className="text-sm font-medium text-[#D93025] bg-red-50 border border-[#D93025]/40 rounded-lg px-4 py-3">
                ⚠️ {submitError}
              </p>
            )}

            <Button
              type="submit"
              className="h-12 text-base font-medium bg-[#1A73E8] hover:bg-[#1557B0] mt-2"
              disabled={submitting}
            >
              {submitting ? '提交中...' : isEditMode ? '保存修改' : '提交绑定'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Alert variant="default" className="bg-blue-50 border-blue-200">
        <InfoIcon className="w-4 h-4 text-[#1A73E8]" />
        <AlertTitle className="text-[#1A1A1A] text-sm font-medium">温馨提示</AlertTitle>
        <AlertDescription className="text-gray-600 text-sm">
          {isEditMode
            ? '修改保存后，老人挂号成功、触发防诈警告时您都会收到使用新信息的通知。'
            : '添加后，老人挂号成功、触发防诈警告时您都会收到通知。信息严格加密，仅用于医疗服务提醒。'}
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default FamilyBindPage;
