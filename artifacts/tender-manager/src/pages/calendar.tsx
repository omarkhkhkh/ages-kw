import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { useListTenders } from "@workspace/api-client-react";
import { apiFetch } from "@/lib/api";
import { formatKuwaitDate, nowKuwait } from "@/lib/timezone";
import { ChevronRight, ChevronLeft, CalendarDays, AlertCircle, FileText, FolderOpen, ShieldCheck, X } from "lucide-react";

const G  = "#D4A534";
const GL = "#E8BE55";
const GD = "#A87C20";

type EventKind = "deadline" | "project_start" | "project_end" | "guarantee_expiry" | "announcement";

interface CalEvent {
  date: string;
  label: string;
  kind: EventKind;
  urgent?: boolean;
}

const KIND_CFG: Record<EventKind, { color: string; bg: string; label: string; icon: any }> = {
  deadline:         { color: "#dc2626", bg: "#fee2e2", label: "إغلاق مناقصة",  icon: FileText },
  announcement:     { color: "#2563eb", bg: "#dbeafe", label: "إعلان مناقصة",  icon: FileText },
  project_start:    { color: "#059669", bg: "#dcfce7", label: "بدء مشروع",     icon: FolderOpen },
  project_end:      { color: "#d97706", bg: "#fef3c7", label: "انتهاء مشروع", icon: FolderOpen },
  guarantee_expiry: { color: "#9333ea", bg: "#f3e8ff", label: "انتهاء كفالة",  icon: ShieldCheck },
};

function getMonthDays(year: number, month: number): (number | null)[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startDow = first.getDay();
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
        evs.push({ date: g.expiryDate.slice(0, 10), label: `${g.bankName || "بنك"} — ${g.type}`, kind: "guarantee_expiry", urgent: diff <= 30 && diff > 0 });
      }
    }
    return evs;
  }, [tenders, projects, guarantees]);

  const byDate = useMemo(() => {
    const map: Record<string, CalEvent[]> = {};
    for (const ev of events) { if (!map[ev.date]) map[ev.date] = []; map[ev.date].push(ev); }
    return map;
  }, [events]);

  const prev = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const next = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };
  const goToday = () => { setYear(now.getFullYear()); setMonth(now.getMonth()); };

  const days = getMonthDays(year, month);
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const selectedEvents = selectedDay ? (byDate[selectedDay] ?? []) : [];

  const upcoming = useMemo(() => {
    const from = Date.now();
    const to = from + 30 * 86400000;
    return events
      .filter(ev => { const t = new Date(ev.date).getTime(); return t >= from && t <= to; })
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 12);
  }, [events]);

  const monthEventCount = days.reduce<number>((total, d) => {
    if (!d) return total;
    const ds = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    return total + (byDate[ds]?.length || 0);
  }, 0);

  return (
    <div style={{ fontFamily: "'Segoe UI', Tahoma, sans-serif", direction: "rtl" as const }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 4, height: 28, borderRadius: 2, background: `linear-gradient(180deg, ${GL}, ${GD})`, flexShrink: 0 }} />
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#132a18", margin: 0 }}>جدول الأعمال</h1>
          </div>
          <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>مواعيد المناقصات والمشاريع والكفالات — توقيت الكويت</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ background: "white", border: "1.5px solid #f0ead8", borderRadius: 12, padding: "10px 16px", display: "flex", alignItems: "center", gap: 8 }}>
            <CalendarDays size={16} color={G} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "#132a18" }}>{monthEventCount} حدث هذا الشهر</span>
          </div>
          <button onClick={goToday} style={{ background: `linear-gradient(135deg, ${GL}, ${GD})`, color: "white", border: "none", borderRadius: 10, padding: "9px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            اليوم
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}>
        {/* Calendar */}
        <div style={{ background: "white", borderRadius: 18, border: "1.5px solid #f0ead8", boxShadow: "0 2px 16px rgba(0,0,0,0.05)", overflow: "hidden" }}>
          {/* Month nav */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1.5px solid #f0ead8", background: "#f9f6ee" }}>
            <button onClick={prev} style={{ background: "white", border: "1.5px solid #e5dfc8", borderRadius: 8, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center" }}>
              <ChevronRight size={16} color={GD} />
            </button>
            <span style={{ fontSize: 17, fontWeight: 800, color: "#132a18" }}>{MONTHS_AR[month]} {year}</span>
            <button onClick={next} style={{ background: "white", border: "1.5px solid #e5dfc8", borderRadius: 8, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center" }}>
              <ChevronLeft size={16} color={GD} />
            </button>
          </div>

          {/* Day-of-week headers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "1px solid #f0ead8", background: "#faf8f2" }}>
            {DOW_AR.map(d => (
              <div key={d} style={{ padding: "10px 4px", textAlign: "center" as const, fontSize: 11, fontWeight: 700, color: "#6b5a1a" }}>{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
            {days.map((d, i) => {
              if (!d) return <div key={i} style={{ minHeight: 88, borderBottom: "1px solid #f5f0e6", borderLeft: "1px solid #f5f0e6", background: "#fdfcf8" }} />;
              const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
              const dayEvs = byDate[dateStr] ?? [];
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selectedDay;
              return (
                <button
                  key={i}
                  onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                  style={{
                    minHeight: 88, borderBottom: "1px solid #f5f0e6", borderLeft: "1px solid #f5f0e6",
                    padding: "6px 6px 4px", textAlign: "right" as const,
                    display: "flex", flexDirection: "column" as const, gap: 3,
                    cursor: "pointer", background: isSelected ? `${G}12` : isToday ? "#fffbeb" : "white",
                    outline: isSelected ? `2px solid ${G}` : "none",
                    transition: "background 0.1s",
                    border: isSelected ? `1.5px solid ${G}88` : "1px solid #f5f0e6",
                  }}
                  onMouseEnter={ev => { if (!isSelected && !isToday) (ev.currentTarget as HTMLElement).style.background = "#fffdf5"; }}
                  onMouseLeave={ev => { (ev.currentTarget as HTMLElement).style.background = isSelected ? `${G}12` : isToday ? "#fffbeb" : "white"; }}
                >
                  <span style={{ fontSize: 12, fontWeight: 700, width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: isToday ? G : "transparent", color: isToday ? "white" : "#132a18", flexShrink: 0 }}>{d}</span>
                  {dayEvs.slice(0, 2).map((ev, j) => {
                    const cfg = KIND_CFG[ev.kind];
                    return (
                      <span key={j} style={{ fontSize: 9, padding: "2px 5px", borderRadius: 4, background: cfg.color, color: "white", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, maxWidth: "100%", display: "block" }}>
                        {ev.label}
                      </span>
                    );
                  })}
                  {dayEvs.length > 2 && (
                    <span style={{ fontSize: 9, color: GD, fontWeight: 700 }}>+{dayEvs.length - 2} أخرى</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Side panel */}
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 16 }}>
          {/* Legend */}
          <div style={{ background: "white", borderRadius: 16, border: "1.5px solid #f0ead8", padding: 18, boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#132a18", marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 3, height: 16, borderRadius: 2, background: `linear-gradient(180deg, ${GL}, ${GD})` }} />
              أنواع الأحداث
            </div>
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
              {(Object.entries(KIND_CFG) as [EventKind, typeof KIND_CFG[EventKind]][]).map(([k, cfg]) => (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                  <div style={{ width: 28, height: 20, borderRadius: 5, background: cfg.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <cfg.icon size={11} color="white" />
                  </div>
                  <span style={{ color: "#374151", fontWeight: 600 }}>{cfg.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Selected day */}
          {selectedDay && (
            <div style={{ background: "white", borderRadius: 16, border: `1.5px solid ${G}55`, padding: 18, boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#132a18" }}>{formatKuwaitDate(selectedDay)}</div>
                <button onClick={() => setSelectedDay(null)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><X size={14} color="#9ca3af" /></button>
              </div>
              {selectedEvents.length === 0 ? (
                <p style={{ fontSize: 12, color: "#9ca3af", margin: 0, textAlign: "center" as const, padding: "12px 0" }}>لا توجد أحداث في هذا اليوم</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
                  {selectedEvents.map((ev, i) => {
                    const cfg = KIND_CFG[ev.kind];
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", borderRadius: 10, background: cfg.bg, border: `1px solid ${cfg.color}33` }}>
                        <div style={{ width: 28, height: 28, borderRadius: 7, background: cfg.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                          <cfg.icon size={13} color="white" />
                        </div>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: cfg.color, marginBottom: 2 }}>{cfg.label}</div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "#132a18" }}>{ev.label}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Upcoming 30 days */}
          <div style={{ background: "white", borderRadius: 16, border: "1.5px solid #f0ead8", padding: 18, boxShadow: "0 2px 10px rgba(0,0,0,0.04)", flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#132a18", marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
              <AlertCircle size={14} color="#f59e0b" />
              الأحداث القادمة (30 يوماً)
            </div>
            {upcoming.length === 0 ? (
              <p style={{ fontSize: 12, color: "#9ca3af", margin: 0, textAlign: "center" as const, padding: "16px 0" }}>لا توجد أحداث قادمة</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 0, maxHeight: 320, overflowY: "auto" as const }}>
                {upcoming.map((ev, i) => {
                  const cfg = KIND_CFG[ev.kind];
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: i < upcoming.length - 1 ? "1px solid #f5f0e6" : "none" }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.color, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#132a18", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{ev.label}</div>
                        <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 1 }}>{cfg.label} — {formatKuwaitDate(ev.date)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
