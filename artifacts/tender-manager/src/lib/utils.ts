import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { differenceInDays, parseISO } from "date-fns";
import { TenderStatus } from '@workspace/api-client-react';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(value);
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    return new Intl.DateTimeFormat('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(dateStr));
  } catch (e) {
    return dateStr;
  }
}

export function isUrgent(deadline: string | null | undefined, status: TenderStatus): boolean {
  if (!deadline) return false;
  const nonUrgentStatuses: string[] = [TenderStatus.won, TenderStatus.lost, TenderStatus.cancelled, TenderStatus.submitted];
  if (nonUrgentStatuses.includes(status as string)) return false;
  
  try {
    const daysLeft = differenceInDays(parseISO(deadline), new Date());
    return daysLeft >= 0 && daysLeft <= 7;
  } catch (e) {
    return false;
  }
}
