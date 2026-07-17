import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { pricingApi } from "@/lib/api";
import { Calculator, Plus, ExternalLink } from "lucide-react";

const G  = "#D4A534";
const GD = "#A87C20";

type EntityType = "tender" | "practice" | "purchaseOrder" | "supplier" | "contract";

const FIELD_MAP: Record<EntityType, string> = {
  tender: "tenderId",
  practice: "practiceId",
  purchaseOrder: "purchaseOrderId",
  supplier: "supplierId",
  contract: "contractId",
};

const STATUS_MAP: Record<string, { label: string; bg: string; text: string }> = {
  draft:    { label: "مسودة",  bg: "#f1f5f9", text: "#475569" },
  approved: { label: "معتمد", bg: "#dcfce7", text: "#166534" },
};

export default function LinkedPricingSheets({ entityType, entityId }: { entityType: EntityType; entityId: number | null | undefined }) {
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const field = FIELD_MAP[entityType];

  const { data: sheets = [], isLoading } = useQuery<any[]>({
    queryKey: ["pricing-sheets", field, entityId],
    queryFn: () => pricingApi.sheets.list({ [field]: entityId! }),
    enabled: !!entityId,
  });

  const createM = useMutation({
    mutationFn: () => pricingApi.sheets.create({ sheetNumber: `TSA-${Date.now().toString().slice(-6)}`, [field]: entityId }),
    onSuccess: (sheet: any) => { qc.invalidateQueries({ queryKey: ["pricing-sheets"] }); navigate(`/pricing/${sheet.id}`); },
  });

  if (!entityId) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: "#9ca3af" }}>أوراق التسعير المرتبطة ({sheets.length})</span>
        <button
          onClick={() => createM.mutate()}
          disabled={createM.isPending}
          style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: `${G}15`, color: GD, border: "none", cursor: "pointer" }}
        >
          <Plus size={12} /> تسعير جديد مرتبط
        </button>
      </div>

      {isLoading ? (
        <div style={{ fontSize: 12, color: "#9ca3af", padding: "12px 0" }}>جارٍ التحميل...</div>
      ) : sheets.length === 0 ? (
        <div style={{ textAlign: "center", padding: "24px 0", color: "#9ca3af" }}>
          <Calculator size={26} style={{ margin: "0 auto 6px", opacity: 0.3, display: "block" }} />
          <div style={{ fontSize: 12 }}>لا توجد أوراق تسعير مرتبطة</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {sheets.map((s: any) => {
            const st = STATUS_MAP[s.status] || STATUS_MAP.draft;
            return (
              <button
                key={s.id}
                onClick={() => navigate(`/pricing/${s.id}`)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
                  padding: "9px 12px", borderRadius: 10, border: "1.5px solid #f0ead8", background: "#fdfaf5",
                  cursor: "pointer", fontFamily: "inherit", textAlign: "right",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 12, color: GD }}>{s.sheetNumber}</span>
                  {s.title && <span style={{ fontSize: 11, color: "#6b7280" }}>{s.title}</span>}
                  <span style={{ fontSize: 10, color: "#9ca3af" }}>({s.itemCount} صنف)</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ padding: "2px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: st.bg, color: st.text }}>{st.label}</span>
                  <ExternalLink size={12} color="#9ca3af" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
