import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { useListTenders } from "@workspace/api-client-react";
import { apiFetch } from "@/lib/api";
import { formatKuwaitDate, nowKuwait } from "@/lib/timezone";
import { ChevronRight, ChevronLeft, Calendar, AlertCircle, FileText, FolderOpen, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type EventKind = "deadline" | "project_start" | "project_end" | "guarantee_expiry" | "announcement";

interface CalEvent {
  date: string; // YYYY-MM-DD
  label: string;
  kind: EventKind;
  urgent?: boolean;
}

const KIND_COLORS: Record<EventKind, string> = {
  deadline: "bg-red-500",
  announcement: "bg-blue-500",
  project_start: "bg-emerald-500",
  project_end: "bg-orange-500",
  guarantee_expiry: "bg-amber-500",
};

const KIND_LABELS: Record<EventKind, string> = {
  deadline: "إغلاق مناقصة",
  announcement: "إعلان مناقصة",
  project_start: "بدء مشروع",
  project_end: "انتهاء مشروع",
  guarantee_expiry: "انتهاء كفالة",
};

function getMonthDays(year: number, month: number) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startDow = first.getDay(); // 0=Sun
  const days: (number | null)[] = Array(startDow).fill(null);
  for (let d = 1; d <= last.getDate(); d++) days.push(d);
  return days;
}

const DOW_AR = ["أح", "إث", "ثل", "أر", "خم", "جم", "سب"];
const MONTHS_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

export default function CalendarPage() {
  const now = nowKuwait();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const { data: tenders = [] } = useListTenders({});
  const { data: projects = [] } = useQuery<any[]>({ queryKey: ["projects"], queryFn: () => apiFetch("/api/projects") });
  const { data: guarantees = [] } = useQuery<any[]>({ queryKey: ["guarantees"], queryFn: () => apiFetch("/api/bank-guarantees") });

  const events = useMemo<CalEvent[]>(() => {
    const evs: CalEvent[] = [];
    for (const t of tenders as any[]) {
      if (t.deadline) evs.push({ date: t.deadline.slice(0, 10), label: t.projectName || t.tenderNumber, kind: "deadline" });
      if (t.announcementDate) evs.push({ date: t.announcementDate.slice(0, 10), label: t.projectName || t.tenderNumber, kind: "announcement" });
    }
    for (const p of projects) {
      if (p.startDate) evs.push({ date: p.startDate.slice(0, 10), label: p.name, kind: "project_start" });
      if (p.endDate) evs.push({ date: p.endDate.slice(0, 10), label: p.name, kind: "project_end" });
    }
    for (const g of guarantees) {
      if (g.expiryDate) {
        const diff = Math.round((new Date(g.expiryDate).getTime() - Date.now()) / 86400000);
        evs.push({ date: g.expiryDate.slice(0, 10), label: `${g.bankName} — ${g.type}`, kind: "guarantee_expiry", urgent: diff <= 30 });
      }
    }
    return evs;
  }, [tenders, projects, guarantees]);

  const byDate = useMemo(() => {
    const map: Record<string, CalEvent[]> = {};
    for (const ev of events) {
      if (!map[ev.date]) map[ev.date] = [];
      map[ev.date].push(ev);
    }
    return map;
  }, [events]);

  const prev = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const next = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const days = getMonthDays(year, month);
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const selectedEvents = selectedDay ? (byDate[selectedDay] ?? []) : [];

  // Upcoming events (next 30 days)
  const upcoming = useMemo(() => {
    const from = Date.now();
    const to = from + 30 * 86400000;
    return events
      .filter(ev => { const t = new Date(ev.date).getTime(); return t >= from && t <= to; })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [events]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Calendar className="h-6 w-6 text-primary" /> جدول الأعمال</h1>
        <p className="text-muted-foreground text-sm mt-1">مواعيد المناقصات والمشاريع والكفالات — توقيت الكويت</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar grid */}
        <div className="lg:col-span-2 border rounded-xl bg-card shadow-sm overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/20">
            <button onClick={prev} className="p-1 hover:bg-muted rounded-lg"><ChevronRight className="h-5 w-5" /></button>
            <span className="font-semibold text-lg">{MONTHS_AR[month]} {year}</span>
            <button onClick={next} className="p-1 hover:bg-muted rounded-lg"><ChevronLeft className="h-5 w-5" /></button>
          </div>

          {/* Days of week */}
          <div className="grid grid-cols-7 border-b">
            {DOW_AR.map(d => (
              <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {days.map((d, i) => {
              if (!d) return <div key={i} className="h-20 border-b border-l last:border-l-0 bg-muted/10" />;
              const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
              const dayEvs = byDate[dateStr] ?? [];
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selectedDay;
              return (
                <button
                  key={i}
                  onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                  className={cn(
                    "h-20 border-b border-l last:border-l-0 p-1 text-right flex flex-col gap-0.5 hover:bg-muted/30 transition",
                    isSelected && "bg-primary/10 border-primary/30",
                    isToday && "bg-amber-50"
                  )}
                >
                  <span className={cn("text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full",
                    isToday ? "bg-amber-500 text-white" : "text-foreground"
                  )}>{d}</span>
                  {dayEvs.slice(0, 2).map((ev, j) => (
                    <span key={j} className={cn("text-[10px] px-1 rounded text-white truncate w-full", KIND_COLORS[ev.kind])}>
                      {ev.label}
                    </span>
                  ))}
                  {dayEvs.length > 2 && (
                    <span className="text-[10px] text-muted-foreground">+{dayEvs.length - 2}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Side panel */}
        <div className="space-y-4">
          {/* Legend */}
          <div className="border rounded-xl bg-card shadow-sm p-4">
            <h3 className="font-semibold mb-3 text-sm">أنواع الأحداث</h3>
            <div className="space-y-2">
              {(Object.keys(KIND_COLORS) as EventKind[]).map(k => (
                <div key={k} className="flex items-center gap-2 text-sm">
                  <span className={cn("w-3 h-3 rounded-full flex-shrink-0", KIND_COLORS[k])} />
                  {KIND_LABELS[k]}
                </div>
              ))}
            </div>
          </div>

          {/* Selected day events */}
          {selectedDay && (
            <div className="border rounded-xl bg-card shadow-sm p-4">
              <h3 className="font-semibold mb-3 text-sm">{formatKuwaitDate(selectedDay)}</h3>
              {selectedEvents.length === 0 ? (
                <p className="text-muted-foreground text-sm">لا توجد أحداث.</p>
              ) : (
                <div className="space-y-2">
                  {selectedEvents.map((ev, i) => (
                    <div key={i} className={cn("flex items-start gap-2 p-2 rounded-lg text-sm", KIND_COLORS[ev.kind].replace("bg-", "bg-") + "/10")}>
                      <span className={cn("mt-0.5 w-2 h-2 rounded-full flex-shrink-0 mt-1.5", KIND_COLORS[ev.kind])} />
                      <div>
                        <div className="font-medium text-xs text-muted-foreground">{KIND_LABELS[ev.kind]}</div>
                        <div className="text-sm">{ev.label}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Upcoming 30 days */}
          <div className="border rounded-xl bg-card shadow-sm p-4">
            <h3 className="font-semibold mb-3 text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              الأحداث القادمة (30 يوم)
            </h3>
            {upcoming.length === 0 ? (
              <p className="text-muted-foreground text-sm">لا توجد أحداث قادمة.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {upcoming.map((ev, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm border-b pb-2 last:border-0">
                    <span className={cn("w-2 h-2 rounded-full flex-shrink-0 mt-1.5", KIND_COLORS[ev.kind])} />
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{ev.label}</div>
                      <div className="text-xs text-muted-foreground">{KIND_LABELS[ev.kind]} — {formatKuwaitDate(ev.date)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
