/**
 * /competitor-intelligence/predict — تنبؤ أسعار المنافسين
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, Loader2, ArrowRight, Target } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

const G  = "#D4A534";
const GD = "#A87C20";
const GR = "#132a18";

async function apiFetch(url: string) {
  const r = await fetch(url, { credentials: "include" });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

function winProbability(sliderValue: number, predictions: any[], refValue: number): number {
  if (!predictions.length) return 0;
  // Simple heuristic: based on how slider compares to predicted competitor ranges
  let beatAll = 0;
  const total = predictions.length;
  for (const p of predictions) {
    if (sliderValue < p.range_low) beatAll++;
    else if (sliderValue < p.mean) beatAll += 0.5;
  }
  return Math.min(95, Math.max(5, Math.round((beatAll / total) * 100)));
}

export default function PredictPage() {
  const [sourceType, setSourceType] = useState<"tender"|"practice">("tender");
  const [sourceId, setSourceId] = useState<string>("");
  const [searching, setSearching] = useState(false);
  const [sliderPct, setSliderPct] = useState(0); // % relative to our ref_value

  // Load tenders list for selector
  const { data: tenders = [] } = useQuery<any[]>({
    queryKey: ["tenders-for-predict"],
    queryFn: () => apiFetch("/api/tenders"),
    staleTime: 5 * 60_000,
  });
  const { data: practices = [] } = useQuery<any[]>({
    queryKey: ["practices-for-predict"],
    queryFn: () => apiFetch("/api/practices"),
    staleTime: 5 * 60_000,
  });

  const { data: prediction, isLoading: predLoading } = useQuery<any>({
    queryKey: ["predict", sourceType, sourceId],
    queryFn: () => apiFetch(`/api/analytics/competitors/predict?source_type=${sourceType}&source_id=${sourceId}`),
    enabled: !!sourceId,
    staleTime: 2 * 60_000,
  });

  const refValue = prediction?.ref_value ?? 0;
  const sliderValue = refValue ? refValue * (1 + sliderPct / 100) : 0;
  const prob = prediction ? winProbability(sliderValue, prediction.predictions ?? [], refValue) : 0;

  const S = {
    card: { background: "white", borderRadius: 14, padding: "20px 22px", boxShadow: "0 1px 6px rgba(0,0,0,0.06)", border: "1.5px solid #f3f4f6" } as any,
    inp: { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" } as any,
    label: { fontSize: 11, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4 } as any,
  };

  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo','IBM Plex Sans Arabic',sans-serif", display: "flex", flexDirection: "column", gap: 22, maxWidth: 800, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => window.history.back()}
          style={{ background: "white", border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center" }}>
          <ArrowRight size={16} color="#374151" />
        </button>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: GR, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <Sparkles size={20} color={G} /> تنبؤ أسعار المنافسين
          </h1>
          <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>مبني على بيانات الفضوض المسجَّلة</p>
        </div>
      </div>

      {/* Step 1: Select */}
      <div style={S.card}>
        <p style={{ fontSize: 13, fontWeight: 800, color: GR, margin: "0 0 14px" }}>اختر المناقصة أو الممارسة</p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 140 }}>
            <label style={S.label}>نوع المصدر</label>
            <select style={S.inp} value={sourceType} onChange={e => { setSourceType(e.target.value as any); setSourceId(""); }}>
              <option value="tender">مناقصة</option>
              <option value="practice">ممارسة</option>
            </select>
          </div>
          <div style={{ flex: 3, minWidth: 240 }}>
            <label style={S.label}>{sourceType === "tender" ? "المناقصة" : "الممارسة"}</label>
            <select style={S.inp} value={sourceId} onChange={e => { setSourceId(e.target.value); setSliderPct(0); }}>
              <option value="">— اختر —</option>
              {(sourceType === "tender" ? tenders : practices).map((item: any) => (
                <option key={item.id} value={item.id}>
                  {sourceType === "tender" ? `${item.tenderNumber} — ${item.projectName}` : `${item.practiceNumber} — ${item.projectName}`}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Loading */}
      {predLoading && (
        <div style={{ padding: 32, textAlign: "center", color: "#9ca3af" }}>
          <Loader2 size={24} style={{ animation: "spin 1s linear infinite", display: "inline-block" }} />
          <p>جاري البحث عن جلسات مشابهة...</p>
        </div>
      )}

      {/* Results */}
      {prediction && !predLoading && (
        <>
          <div style={{ ...S.card, background: "#fffbeb", border: `1.5px solid ${G}` }}>
            <p style={{ margin: "0 0 4px", fontSize: 13, color: "#92400e" }}>
              مبني على <strong>{prediction.similar_sessions}</strong> جلسة مشابهة
            </p>
            {refValue > 0 && (
              <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>
                سعرنا المرجعي: <strong style={{ fontFamily: "monospace", color: GD }}>{formatCurrency(refValue)}</strong>
              </p>
            )}
          </div>

          {prediction.predictions?.length === 0 && (
            <div style={{ ...S.card, textAlign: "center", color: "#9ca3af" }}>
              <Target size={32} style={{ margin: "0 auto 8px", display: "block", opacity: 0.3 }} />
              <p>لا توجد بيانات كافية لحساب التنبؤ لهذه المناقصة بعد</p>
            </div>
          )}

          {prediction.predictions?.length > 0 && (
            <>
              {/* Competitor predictions table */}
              <div style={{ ...S.card, padding: 0, overflow: "hidden", border: "1px solid #e2e8f0", boxShadow: "0 2px 10px rgba(0,0,0,0.06)" }}>
                <div style={{ padding: "14px 20px", borderBottom: "1.5px solid #f1f5f9", display: "flex", alignItems: "center", gap: 9 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: `linear-gradient(135deg,${G},${GD})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Target size={14} color="white" />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 800, color: GR }}>توقعات أسعار المنافسين</span>
                  <span style={{ marginRight: "auto", fontSize: 11, color: "#94a3b8", background: "#f1f5f9", padding: "2px 10px", borderRadius: 20, fontWeight: 700 }}>{prediction.predictions.length} شركة</span>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 580 }}>
                    <thead>
                      <tr style={{ background: "linear-gradient(to bottom,#f8fafc,#f1f5f9)" }}>
                        {["#","الشركة","النطاق المتوقع","متوسط السعر","جلسات","الثقة"].map(h => (
                          <th key={h} style={{ padding: "11px 14px", fontWeight: 800, fontSize: 11, color: "#64748b", textAlign: "right", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {prediction.predictions.map((p: any, i: number) => {
                        const rowBg = i % 2 === 0 ? "white" : "#fafbfc";
                        const confColor = p.confidence >= 70 ? "#15803d" : p.confidence >= 40 ? "#92400e" : "#dc2626";
                        const confBg   = p.confidence >= 70 ? "#dcfce7"  : p.confidence >= 40 ? "#fef9c3"  : "#fee2e2";
                        return (
                          <tr key={i} style={{ background: rowBg, transition: "background 0.12s" }}
                            onMouseEnter={ev => (ev.currentTarget.style.background = "#f0f9ff")}
                            onMouseLeave={ev => (ev.currentTarget.style.background = rowBg)}>
                            <td style={{ padding: "12px 14px", width: 40, textAlign: "center", borderBottom: "1px solid #f1f5f9" }}>
                              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: "50%", background: "#f1f5f9", color: "#64748b", fontSize: 11, fontWeight: 800 }}>{i + 1}</span>
                            </td>
                            <td style={{ padding: "12px 14px", fontWeight: 700, color: GR, borderBottom: "1px solid #f1f5f9" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{ width: 30, height: 30, borderRadius: 8, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900, color: "#475569", flexShrink: 0 }}>
                                  {p.company_name?.[0] ?? "?"}
                                </div>
                                {p.company_name}
                              </div>
                            </td>
                            <td style={{ padding: "12px 14px", fontFamily: "monospace", fontSize: 12, color: "#475569", borderBottom: "1px solid #f1f5f9" }}>
                              <span style={{ background: "#f8fafc", padding: "3px 8px", borderRadius: 6, border: "1px solid #e2e8f0" }}>
                                {formatCurrency(p.range_low)}
                              </span>
                              <span style={{ margin: "0 6px", color: "#94a3b8" }}>—</span>
                              <span style={{ background: "#f8fafc", padding: "3px 8px", borderRadius: 6, border: "1px solid #e2e8f0" }}>
                                {formatCurrency(p.range_high)}
                              </span>
                            </td>
                            <td style={{ padding: "12px 14px", fontFamily: "monospace", fontWeight: 800, color: GD, fontSize: 14, borderBottom: "1px solid #f1f5f9" }}>
                              {formatCurrency(p.mean)}
                            </td>
                            <td style={{ padding: "12px 14px", textAlign: "center", borderBottom: "1px solid #f1f5f9" }}>
                              <span style={{ background: "#f1f5f9", color: "#475569", padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{p.appearances}</span>
                            </td>
                            <td style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9", minWidth: 140 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{ flex: 1, height: 8, background: "#e2e8f0", borderRadius: 4, overflow: "hidden" }}>
                                  <div style={{ height: "100%", width: `${p.confidence}%`, background: confColor, borderRadius: 4, transition: "width 0.4s ease" }} />
                                </div>
                                <span style={{ fontSize: 11, fontWeight: 800, color: confColor, background: confBg, padding: "2px 8px", borderRadius: 10, whiteSpace: "nowrap" }}>{p.confidence}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Slider + Win probability */}
              {refValue > 0 && (
                <div style={{ ...S.card }}>
                  <p style={{ fontSize: 13, fontWeight: 800, color: GR, margin: "0 0 16px" }}>محاكاة السعر — احتمال الفوز</p>

                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 12, color: "#6b7280" }}>سعرك المقترح:</span>
                      <span style={{ fontFamily: "monospace", fontWeight: 800, color: GD, fontSize: 15 }}>{formatCurrency(sliderValue)}</span>
                    </div>
                    <input type="range" min="-20" max="20" step="0.5" value={sliderPct}
                      onChange={e => setSliderPct(Number(e.target.value))}
                      style={{ width: "100%", accentColor: G, cursor: "pointer" }} />
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#9ca3af", marginTop: 2 }}>
                      <span>−20% ({formatCurrency(refValue * 0.8)})</span>
                      <span>مرجع ({formatCurrency(refValue)})</span>
                      <span>+20% ({formatCurrency(refValue * 1.2)})</span>
                    </div>
                  </div>

                  <div style={{ background: prob >= 60 ? "#f0fdf4" : prob >= 40 ? "#fffbeb" : "#fef2f2", borderRadius: 10, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#374151" }}>احتمال الفوز</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 120, height: 8, background: "#e5e7eb", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${prob}%`, background: prob >= 60 ? "#16a34a" : prob >= 40 ? G : "#dc2626", borderRadius: 4, transition: "width 0.2s" }} />
                      </div>
                      <span style={{ fontSize: 24, fontWeight: 900, color: prob >= 60 ? "#16a34a" : prob >= 40 ? GD : "#dc2626" }}>{prob}%</span>
                    </div>
                  </div>
                </div>
              )}

              {/* AI hint */}
              {prediction.can_use_ai && (
                <div style={{ ...S.card, background: "#f5f3ff", border: "1.5px solid #ddd6fe" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Sparkles size={18} color="#7c3aed" />
                    <div>
                      <p style={{ margin: 0, fontWeight: 700, color: "#5b21b6", fontSize: 13 }}>تحليل الذكاء الاصطناعي متاح</p>
                      <p style={{ margin: 0, fontSize: 12, color: "#7c3aed" }}>يوجد {prediction.similar_sessions} جلسة مشابهة — يمكن طلب تحليل أعمق بالذكاء الاصطناعي (قريباً)</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
