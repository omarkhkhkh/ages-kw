// Simple typed fetch utilities for entities not yet covered by generated hooks.
// All paths are root-relative so the Replit proxy routes them to the API server at /api.

// Auth-related paths that should NOT trigger session-expired events
const AUTH_PATHS = ["/api/auth/login", "/api/auth/me", "/api/auth/logout"];

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });

  if (!res.ok) {
    // If 401 on a non-auth route → session has expired; broadcast event so the
    // app can show a notification and redirect to login automatically.
    if (res.status === 401 && !AUTH_PATHS.some(p => path.startsWith(p))) {
      window.dispatchEvent(new CustomEvent("session-expired"));
    }
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? res.statusText);
  }
  if (res.status === 204) return null as T;
  return res.json();
}

// ── Government Entities ────────────────────────────────────────────────────
export const entitiesApi = {
  list: () => apiFetch<any[]>("/api/government-entities"),
  get: (id: number) => apiFetch<any>(`/api/government-entities/${id}`),
  create: (data: any) => apiFetch<any>("/api/government-entities", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: any) => apiFetch<any>(`/api/government-entities/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: number) => apiFetch<void>(`/api/government-entities/${id}`, { method: "DELETE" }),
};

// ── Suppliers ──────────────────────────────────────────────────────────────
export const suppliersApi = {
  list: () => apiFetch<any[]>("/api/suppliers"),
  get: (id: number) => apiFetch<any>(`/api/suppliers/${id}`),
  create: (data: any) => apiFetch<any>("/api/suppliers", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: any) => apiFetch<any>(`/api/suppliers/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: number) => apiFetch<void>(`/api/suppliers/${id}`, { method: "DELETE" }),
};

// ── RFQ Requests ───────────────────────────────────────────────────────────
export const rfqApi = {
  list: (tenderId?: number) => apiFetch<any[]>(tenderId ? `/api/rfq-requests?tenderId=${tenderId}` : "/api/rfq-requests"),
  create: (data: any) => apiFetch<any>("/api/rfq-requests", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: any) => apiFetch<any>(`/api/rfq-requests/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: number) => apiFetch<void>(`/api/rfq-requests/${id}`, { method: "DELETE" }),
};

// ── Direct Purchase Orders ─────────────────────────────────────────────────
export const purchaseOrdersApi = {
  list: (status?: string) => apiFetch<any[]>(status ? `/api/direct-purchase-orders?status=${status}` : "/api/direct-purchase-orders"),
  create: (data: any) => apiFetch<any>("/api/direct-purchase-orders", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: any) => apiFetch<any>(`/api/direct-purchase-orders/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: number) => apiFetch<void>(`/api/direct-purchase-orders/${id}`, { method: "DELETE" }),
};

// ── Projects ───────────────────────────────────────────────────────────────
export const projectsApi = {
  list: (status?: string) => apiFetch<any[]>(status ? `/api/projects?status=${status}` : "/api/projects"),
  create: (data: any) => apiFetch<any>("/api/projects", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: any) => apiFetch<any>(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: number) => apiFetch<void>(`/api/projects/${id}`, { method: "DELETE" }),
};

// ── Bank Guarantees ────────────────────────────────────────────────────────
export const guaranteesApi = {
  list: (status?: string) => apiFetch<any[]>(status ? `/api/bank-guarantees?status=${status}` : "/api/bank-guarantees"),
  create: (data: any) => apiFetch<any>("/api/bank-guarantees", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: any) => apiFetch<any>(`/api/bank-guarantees/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: number) => apiFetch<void>(`/api/bank-guarantees/${id}`, { method: "DELETE" }),
};

// ── Contracts ──────────────────────────────────────────────────────────────
export const contractsApi = {
  list: (status?: string) => apiFetch<any[]>(status ? `/api/contracts?status=${status}` : "/api/contracts"),
  create: (data: any) => apiFetch<any>("/api/contracts", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: any) => apiFetch<any>(`/api/contracts/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: number) => apiFetch<void>(`/api/contracts/${id}`, { method: "DELETE" }),

  // Documents
  listDocuments: (contractId: number) => apiFetch<any[]>(`/api/contracts/${contractId}/documents`),
  uploadDocument: (contractId: number, data: { fileName: string; fileSize?: number; mimeType?: string; fileData: string }) =>
    apiFetch<any>(`/api/contracts/${contractId}/documents`, { method: "POST", body: JSON.stringify(data) }),
  deleteDocument: (contractId: number, docId: number) =>
    apiFetch<void>(`/api/contracts/${contractId}/documents/${docId}`, { method: "DELETE" }),
  downloadUrl: (contractId: number, docId: number) => `/api/contracts/${contractId}/documents/${docId}/download`,

  // Permissions (admin)
  getPermissions: (contractId: number) => apiFetch<any[]>(`/api/contracts/${contractId}/permissions`),
  setPermission: (contractId: number, userId: number, canView: boolean) =>
    apiFetch<any>(`/api/contracts/${contractId}/permissions/${userId}`, { method: "PUT", body: JSON.stringify({ canView }) }),

  // Comments
  listComments: (contractId: number) => apiFetch<any[]>(`/api/contracts/${contractId}/comments`),
  addComment: (contractId: number, toUserId: number, content: string) =>
    apiFetch<any>(`/api/contracts/${contractId}/comments`, { method: "POST", body: JSON.stringify({ toUserId, content }) }),
  markCommentsRead: (contractId: number) =>
    apiFetch<any>(`/api/contracts/${contractId}/comments/read`, { method: "PATCH" }),
  deleteComment: (contractId: number, commentId: number) =>
    apiFetch<void>(`/api/contracts/${contractId}/comments/${commentId}`, { method: "DELETE" }),

  // Dashboard badge
  unreadCommentsCount: () => apiFetch<{ count: number }>("/api/contracts/meta/unread-comments"),
};

// ── Record-level permissions (admin) ──────────────────────────────────────
export const permissionsApi = {
  /** Get all tenders + contracts with can_view flag for a specific employee */
  getRecord: (userId: number) =>
    apiFetch<{ tenders: any[]; contracts: any[] }>(`/api/admin/users/${userId}/record-permissions`),

  /** Set can_view for a single tender or contract */
  setRecord: (userId: number, type: "tender" | "contract", recordId: number, canView: boolean) =>
    apiFetch<{ ok: boolean }>(`/api/admin/users/${userId}/record-permissions`, {
      method: "PUT",
      body: JSON.stringify({ type, recordId, canView }),
    }),
};
