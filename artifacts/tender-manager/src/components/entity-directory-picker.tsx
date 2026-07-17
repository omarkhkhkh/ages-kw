import { useQuery } from "@tanstack/react-query";
import { entitiesApi, entityDirectoryApi } from "@/lib/api";

const G  = "#D4A534";
const GD = "#A87C20";

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb",
  fontSize: 13, fontFamily: "inherit", outline: "none", background: "white",
  boxSizing: "border-box", cursor: "pointer", height: 38,
};
const labelStyle: React.CSSProperties = { display: "block", fontSize: 11.5, fontWeight: 700, color: "#6b7280", marginBottom: 4 };

export interface EntityDirectoryValue {
  governmentEntityId: number | string | null;
  departmentId: number | string | null;
  contactId: number | string | null;
}

export default function EntityDirectoryPicker({ value, onChange, disabled }: {
  value: EntityDirectoryValue;
  onChange: (next: EntityDirectoryValue) => void;
  disabled?: boolean;
}) {
  const entityId = value.governmentEntityId ? Number(value.governmentEntityId) : null;
  const departmentId = value.departmentId ? Number(value.departmentId) : null;

  const { data: entities = [] } = useQuery<any[]>({ queryKey: ["entities-directory-picker-entities"], queryFn: () => entitiesApi.list() });
  const { data: directory } = useQuery({
    queryKey: ["entity-directory", entityId],
    queryFn: () => entityDirectoryApi.getDirectory(entityId!),
    enabled: !!entityId,
  });

  const departments = directory?.departments ?? [];
  const selectedDept = departments.find((d: any) => d.id === departmentId);
  const contacts = selectedDept?.contacts ?? [];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
      <div>
        <label style={labelStyle}>الجهة الحكومية</label>
        <select
          style={inputStyle}
          disabled={disabled}
          value={value.governmentEntityId ?? ""}
          onChange={e => onChange({ governmentEntityId: e.target.value || null, departmentId: null, contactId: null })}
        >
          <option value="">— اختر الجهة —</option>
          {entities.map((ent: any) => <option key={ent.id} value={ent.id}>{ent.name}</option>)}
        </select>
      </div>
      <div>
        <label style={labelStyle}>الاختصاص</label>
        <select
          style={{ ...inputStyle, opacity: entityId ? 1 : 0.6 }}
          disabled={disabled || !entityId}
          value={value.departmentId ?? ""}
          onChange={e => onChange({ ...value, departmentId: e.target.value || null, contactId: null })}
        >
          <option value="">— اختر الاختصاص —</option>
          {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
      <div>
        <label style={labelStyle}>المسؤول</label>
        <select
          style={{ ...inputStyle, opacity: departmentId ? 1 : 0.6 }}
          disabled={disabled || !departmentId}
          value={value.contactId ?? ""}
          onChange={e => onChange({ ...value, contactId: e.target.value || null })}
        >
          <option value="">— اختر المسؤول —</option>
          {contacts.map((c: any) => <option key={c.id} value={c.id}>{c.name}{c.role ? ` — ${c.role}` : ""}</option>)}
        </select>
      </div>
    </div>
  );
}
