import { TenderStatus } from '@workspace/api-client-react';

export const STATUS_ARABIC: Record<string, string> = {
  [TenderStatus.new]: 'جديدة',
  [TenderStatus.studying]: 'جاري الدراسة',
  [TenderStatus.requesting_quotes]: 'طلب تسعير الموردين',
  [TenderStatus.preparing_technical]: 'إعداد العرض الفني',
  [TenderStatus.preparing_financial]: 'إعداد العرض المالي',
  [TenderStatus.management_review]: 'مراجعة الإدارة',
  [TenderStatus.ready_to_submit]: 'جاهزة للتسليم',
  [TenderStatus.submitted]: 'تم التسليم',
  [TenderStatus.under_evaluation]: 'تحت التقييم',
  [TenderStatus.won]: 'رست علينا',
  [TenderStatus.lost]: 'رست على منافس',
  [TenderStatus.cancelled]: 'ملغاة',
};

export const STATUS_COLORS: Record<string, string> = {
  [TenderStatus.new]: 'bg-slate-100 text-slate-700 border-slate-200',
  [TenderStatus.studying]: 'bg-blue-50 text-blue-700 border-blue-200',
  [TenderStatus.requesting_quotes]: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  [TenderStatus.preparing_technical]: 'bg-violet-50 text-violet-700 border-violet-200',
  [TenderStatus.preparing_financial]: 'bg-purple-50 text-purple-700 border-purple-200',
  [TenderStatus.management_review]: 'bg-orange-50 text-orange-700 border-orange-200',
  [TenderStatus.ready_to_submit]: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  [TenderStatus.submitted]: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  [TenderStatus.under_evaluation]: 'bg-amber-50 text-amber-700 border-amber-200',
  [TenderStatus.won]: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  [TenderStatus.lost]: 'bg-red-50 text-red-700 border-red-200',
  [TenderStatus.cancelled]: 'bg-neutral-100 text-neutral-600 border-neutral-200',
};
