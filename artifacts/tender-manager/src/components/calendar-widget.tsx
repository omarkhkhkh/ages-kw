import { useState, useMemo } from "react";
import { ChevronRight, ChevronLeft, CalendarDays, Briefcase, FileText, FolderOpen, ListChecks, ShoppingCart, ShieldAlert, FileSignature, Mail } from "lucide-react";

/* ─────────────────── Types ─────────────────── */
export interface CalendarEvent {
  id: string;
  date: Date;
  type: "tender" | "contract" | "project" | "task" | "rfq" | "guarantee" | "purchase" | "correspondence";
  title: string;
  subLabel: string;
  priority?: string;
  status?: string;
  assigneeName?: string;   // admin: who owns the task
}

/* ─────────────────── Constants ─────────────────── */
const G  = "#D4A534";
const GR = "#0b1a10";

export const EVENT_META: Record<CalendarEvent["type"], {
  color: string; bg: string; border: string; label: string; icon: any;
}> = {
  tender:    { color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe", label: "مناقصة",    icon: FileText },
  contract:  { color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0", label: "عقد",       icon: FileSignature },
  project:   { color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe", label: "مشروع",    icon: FolderOpen },
  task:      { color: "#ea580c", bg: "#fff7ed", border: "#fed7aa", label: "مهمة",      icon: ListChecks },
  rfq:       { color: "#b45309", bg: "#fefce8", border: "#fde68a", label: "طلب عروض", icon: Briefcase },
  guarantee: { color: "#dc2626", bg: "#fff1f2", border: "#fecaca", label: "ضمان بنكي", icon: ShieldAlert },
  purchase:  { color: "#0891b2", bg: "#ecfeff", border: "#a5f3fc", label: "أمر شراء", icon: ShoppingCart },
  correspondence: { color: "#be185d", bg: "#fdf2f8", border: "#fbcfe8", label: "خطاب", icon: Mail },
};

const PRIORITY_AR: Record<string, string> = {
  low: "منخفضة", medium: "متوسطة", high: "عالية", urgent: "عاجلة",
};
const ARABIC_MONTHS = [
  "يناير","فبراير","مارس","أبريل","مايو","يونيو",
  "يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر",
];
const ARABIC_DAYS_SHORT = ["أحد","إثن","ثلا","أرب","خمي","جمع","سبت"];

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth()    === b.getMonth()    &&
    a.getDate()     === b.getDate()
  );
}

/* ─────────────────── Component ─────────────────── */
export function CalendarWidget({ events }: { events: CalendarEvent[] }) {
  const today   = useMemo(() => new Date(), []);
  const [viewDate, setViewDate] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selectedDay, setSelectedDay] = useState<Date>(today);

  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();

  /* build 42-cell grid */
  const cells = useMemo(() => {
    const firstDow     = new Date(year, month, 1).getDay();        // 0=Sun
    const daysInMonth  = new Date(year, month + 1, 0).getDate();
    const daysInPrev   = new Date(year, month, 0).getDate();
    const arr: { day: number; isCurrent: boolean; date: Date }[] = [];

    for (let i = firstDow - 1; i >= 0; i--)
      arr.push({ day: daysInPrev - i, isCurrent: false, date: new Date(year, month - 1, daysInPrev - i) });
    for (let d = 1; d <= daysInMonth; d++)
      arr.push({ day: d, isCurrent: true, date: new Date(year, month, d) });
    const rem = 42 - arr.length;
    for (let d = 1; d <= rem; d++)
      arr.push({ day: d, isCurrent: false, date: new Date(year, month + 1, d) });

    return arr;
  }, [year, month]);

  /* events indexed by "y-m-d" */
  const eventsByKey = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    events.forEach(e => {
      const k = `${e.date.getFullYear()}-${e.date.getMonth()}-${e.date.getDate()}`;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(e);
    });
    return map;
  }, [events]);

  function eventsFor(d: Date) {
    return eventsByKey.get(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`) ?? [];
  }

  const selectedEvents = eventsFor(selectedDay);

  /* month-level stats for legend */
  const monthEvents = useMemo(() => {
    return events.filter(e => e.date.getFullYear() === year && e.date.getMonth() === month);
  }, [events, year, month]);
  const monthTypeCount = useMemo(() => {
    const c: Partial<Record<CalendarEvent["type"], number>> = {};
    monthEvents.forEach(e => { c[e.type] = (c[e.type] ?? 0) + 1; });
    return c;
  }, [monthEvents]);

  /* ── render ── */
  return (
    <div style={{
      background: "white", borderRadius: 18,
      boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
      border: "1.5px solid #f0ead8", overflow: "hidden",
    }}>
      {/* ── Header ── */}
      <div style={{
        background: `linear-gradient(135deg,${GR} 0%,#1a3a22 100%)`,
        padding: "14px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        {/* Title */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <CalendarDays size={20} color={G} />
          <span style={{ color: "white", fontWeight: 800, fontSize: 16 }}>التقويم</span>
          <span style={{ color: "#D4A53488", fontSize: 12, fontWeight: 500 }}>
            — جدول المواعيد والمهام
          </span>
        </div>

        {/* Month nav */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            onClick={() => { setViewDate(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDay(today); }}
            style={{ padding: "3px 12px", borderRadius: 7, border: `1px solid ${G}55`, background: "transparent", color: G, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
            اليوم
          </button>
          <button onClick={() => setViewDate(new Date(year, month - 1, 1))}
            style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid #ffffff22", background: "#ffffff11", color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ChevronRight size={15} />
          </button>
          <span style={{ color: "white", fontWeight: 700, fontSize: 14, minWidth: 116, textAlign: "center", direction: "rtl" }}>
            {ARABIC_MONTHS[month]} {year}
          </span>
          <button onClick={() => setViewDate(new Date(year, month + 1, 1))}
            style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid #ffffff22", background: "#ffffff11", color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ChevronLeft size={15} />
          </button>
        </div>
      </div>

      {/* ── Body: Grid + Events panel ── */}
      <div style={{ display: "flex", direction: "ltr" /* internal layout is LTR, text RTL inside */ }}>

        {/* ── Calendar Grid ── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Day headers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", borderBottom: "1px solid #f0ead8", background: "#fafaf8" }}>
            {ARABIC_DAYS_SHORT.map(d => (
              <div key={d} style={{ padding: "9px 0", textAlign: "center", fontSize: 11, fontWeight: 700, color: "#9ca3af" }}>
                {d}
              </div>
            ))}
          </div>

          {/* Cells */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)" }}>
            {cells.map((cell, i) => {
              const evts       = eventsFor(cell.date);
              const isToday    = isSameDay(cell.date, today);
              const isSelected = isSameDay(cell.date, selectedDay);
              const types      = [...new Set(evts.map(e => e.type))];
              const dotsToShow = types.slice(0, 4);
              const extra      = evts.length - dotsToShow.length;

              /* is there an "urgent" or "high" task today? */
              const hasUrgent = evts.some(e => e.type === "task" && (e.priority === "urgent" || e.priority === "high"));

              return (
                <div key={i}
                  onClick={() => setSelectedDay(cell.date)}
                  style={{
                    padding: "5px 3px 6px",
                    minHeight: 62,
                    cursor: "pointer",
                    background: isSelected
                      ? "#f0fdf4"
                      : isToday ? "#fffbeb" : "white",
                    border: isSelected
                      ? "1.5px solid #86efac"
                      : isToday ? `1.5px solid ${G}55` : "1px solid transparent",
                    boxSizing: "border-box",
                    transition: "background 0.1s",
                    position: "relative",
                  }}
                  onMouseEnter={e => {
                    if (!isSelected && !isToday)
                      (e.currentTarget as HTMLElement).style.background = "#f9fafb";
                  }}
                  onMouseLeave={e => {
                    if (!isSelected && !isToday)
                      (e.currentTarget as HTMLElement).style.background = "white";
                  }}>

                  {/* urgent indicator stripe */}
                  {hasUrgent && (
                    <div style={{ position: "absolute", top: 0, right: 0, left: 0, height: 2, background: "#dc2626", borderRadius: "0 0 2px 2px" }} />
                  )}

                  {/* Day number */}
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: 3 }}>
                    <span style={{
                      width: 24, height: 24,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      borderRadius: "50%",
                      background: isToday ? G : "transparent",
                      color: isToday ? "white" : cell.isCurrent ? "#132a18" : "#d1d5db",
                      fontSize: 11, fontWeight: isToday ? 800 : cell.isCurrent ? 600 : 400,
                    }}>
                      {cell.day}
                    </span>
                  </div>

                  {/* Event dots */}
                  {evts.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 2, justifyContent: "center", padding: "0 2px" }}>
                      {dotsToShow.map(type => (
                        <span key={type} style={{
                          width: 6, height: 6, borderRadius: "50%",
                          background: EVENT_META[type].color, display: "block", flexShrink: 0,
                        }} />
                      ))}
                      {extra > 0 && (
                        <span style={{ fontSize: 8, color: "#9ca3af", fontWeight: 700, lineHeight: "6px" }}>
                          +{extra}
                        </span>
                      )}
                    </div>
                  )}

                  {/* show count badge if many events */}
                  {evts.length >= 3 && (
                    <div style={{ textAlign: "center", marginTop: 2 }}>
                      <span style={{ fontSize: 9, color: "#6b7280", fontWeight: 600 }}>{evts.length} مواعيد</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Month summary legend */}
          {monthEvents.length > 0 && (
            <div style={{
              borderTop: "1px solid #f0ead8", padding: "10px 16px",
              display: "flex", flexWrap: "wrap", gap: 10, background: "#fafaf8", direction: "rtl",
            }}>
              {(Object.entries(monthTypeCount) as [CalendarEvent["type"], number][]).map(([type, count]) => {
                const m = EVENT_META[type];
                const Icon = m.icon;
                return (
                  <div key={type} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Icon size={11} color={m.color} />
                    <span style={{ fontSize: 11, color: m.color, fontWeight: 700 }}>{m.label}</span>
                    <span style={{ fontSize: 10, color: "#9ca3af" }}>({count})</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Events Panel ── */}
        <div style={{
          width: 290, flexShrink: 0,
          borderLeft: "1.5px solid #f0ead8",
          display: "flex", flexDirection: "column",
          maxHeight: 500,
        }}>
          {/* Panel date header */}
          <div style={{ padding: "13px 14px", borderBottom: "1px solid #f0ead8", background: "#fafaf8", direction: "rtl" }}>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 12, color: "#132a18" }}>
              {selectedDay.toLocaleDateString("ar-KW", {
                weekday: "long", year: "numeric", month: "long", day: "numeric",
              })}
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "#9ca3af" }}>
              {selectedEvents.length === 0
                ? "لا توجد مواعيد"
                : `${selectedEvents.length} موعد`}
            </p>
          </div>

          {/* Events list */}
          <div style={{ flex: 1, overflowY: "auto", padding: "8px 6px", direction: "rtl" }}>
            {selectedEvents.length === 0 ? (
              <div style={{ padding: "40px 16px", textAlign: "center" }}>
                <CalendarDays size={32} color="#e5e7eb" style={{ margin: "0 auto 8px", display: "block" }} />
                <p style={{ margin: 0, fontSize: 12, color: "#d1d5db" }}>اختر يوماً للاطلاع على مواعيده</p>
              </div>
            ) : (
              selectedEvents.map((evt, i) => {
                const meta = EVENT_META[evt.type];
                const Icon = meta.icon;
                return (
                  <div key={i} style={{
                    marginBottom: 6, padding: "10px 12px", borderRadius: 10,
                    background: meta.bg, border: `1px solid ${meta.border}`,
                  }}>
                    {/* Type + sub-label */}
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
                      <Icon size={11} color={meta.color} />
                      <span style={{ fontSize: 10, fontWeight: 800, color: meta.color }}>
                        {meta.label}
                      </span>
                      <span style={{ fontSize: 10, color: "#9ca3af" }}>·</span>
                      <span style={{ fontSize: 10, color: meta.color, opacity: 0.85, fontWeight: 600 }}>
                        {evt.subLabel}
                      </span>
                    </div>

                    {/* Title */}
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#132a18", lineHeight: 1.45 }}>
                      {evt.title}
                    </p>

                    {/* Meta row */}
                    <div style={{ marginTop: 5, display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {evt.priority && (
                        <span style={{
                          padding: "1px 8px", borderRadius: 6, fontSize: 9, fontWeight: 700,
                          background: evt.priority === "urgent" ? "#fee2e2"
                            : evt.priority === "high" ? "#fff1f2"
                            : evt.priority === "medium" ? "#fffbeb" : "#f9fafb",
                          color: evt.priority === "urgent" ? "#dc2626"
                            : evt.priority === "high" ? "#dc2626"
                            : evt.priority === "medium" ? "#b45309" : "#6b7280",
                        }}>
                          {PRIORITY_AR[evt.priority] ?? evt.priority}
                        </span>
                      )}
                      {evt.status && (
                        <span style={{ padding: "1px 8px", borderRadius: 6, fontSize: 9, fontWeight: 600, background: "#f1f5f9", color: "#475569" }}>
                          {evt.status}
                        </span>
                      )}
                      {evt.assigneeName && (
                        <span style={{ padding: "1px 8px", borderRadius: 6, fontSize: 9, fontWeight: 600, background: "#f1f5f9", color: "#475569" }}>
                          👤 {evt.assigneeName}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* All-types legend (footer) */}
          <div style={{ padding: "10px 12px", borderTop: "1px solid #f0ead8", background: "#fafaf8", direction: "rtl" }}>
            <p style={{ margin: "0 0 5px", fontSize: 9, fontWeight: 700, color: "#d1d5db", textTransform: "uppercase", letterSpacing: 0.5 }}>
              دليل الألوان
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 10px" }}>
              {(Object.entries(EVENT_META) as [CalendarEvent["type"], typeof EVENT_META[CalendarEvent["type"]]][]).map(([key, val]) => (
                <span key={key} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: val.color, display: "block" }} />
                  <span style={{ fontSize: 9, color: val.color, fontWeight: 700 }}>{val.label}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
