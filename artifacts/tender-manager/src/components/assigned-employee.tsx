import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";
import { useAuth } from "../contexts/auth";

type MiniUser = { id: number; fullName: string; role: string };

/**
 * خلية "الموظف المسؤول": يعرض اسم الموظف المُسنَد إليه السجل.
 * المدير فقط يرى قائمة منسدلة لإعادة التعيين — عند التغيير يستدعي onReassign
 * الذي يجب أن يُرسل PATCH بـ assignedUserId (أو claimedByUserId للفرص).
 */
export function AssignedEmployee({
  value,
  displayName,
  onReassign,
  compact,
}: {
  value: number | null | undefined;
  displayName?: string | null;
  onReassign: (userId: number | null) => void;
  compact?: boolean;
}) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const { data: users } = useQuery<MiniUser[]>({
    queryKey: ["assignable-users"],
    queryFn: () => apiFetch<MiniUser[]>("/api/admin/users"),
    enabled: isAdmin,
    staleTime: 5 * 60 * 1000,
  });

  if (!isAdmin) {
    return (
      <span style={{ fontSize: compact ? 12 : 13, color: displayName ? "#334155" : "#94a3b8", fontWeight: 600 }}>
        {displayName || "—"}
      </span>
    );
  }

  return (
    <select
      value={value ?? ""}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        e.stopPropagation();
        const v = e.target.value ? Number(e.target.value) : null;
        onReassign(v);
      }}
      style={{
        fontSize: compact ? 12 : 13,
        padding: compact ? "3px 6px" : "6px 8px",
        borderRadius: 6,
        border: "1px solid #cbd5e1",
        background: "#fff",
        color: "#334155",
        fontWeight: 600,
        maxWidth: 180,
      }}
    >
      <option value="">— غير مُسنَد —</option>
      {users?.map((u) => (
        <option key={u.id} value={u.id}>
          {u.fullName}
        </option>
      ))}
    </select>
  );
}
