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

// ── Companies (الشركات المشاركة — تُدار من صفحة وثائق الشركة الرسمية) ─────────
export const companiesApi = {
  list: () => apiFetch<any[]>("/api/company-documents/companies"),
};

// ── Government Entities ────────────────────────────────────────────────────
export const entitiesApi = {
  list: (companyId?: number | null) => apiFetch<any[]>("/api/government-entities" + (companyId ? `?companyId=${companyId}` : "")),
  get: (id: number) => apiFetch<any>(`/api/government-entities/${id}`),
  create: (data: any) => apiFetch<any>("/api/government-entities", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: any) => apiFetch<any>(`/api/government-entities/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: number) => apiFetch<void>(`/api/government-entities/${id}`, { method: "DELETE" }),
  search: (q: string) => apiFetch<any[]>(`/api/government-entities/search?q=${encodeURIComponent(q)}`),
};

// ── Entity Directory (اختصاصات ← مسؤولون ← وسائل تواصل) ──────────────────────
export const entityDirectoryApi = {
  getDirectory: (entityId: number) => apiFetch<{ departments: any[] }>(`/api/government-entities/${entityId}/directory`),
  createDepartment: (entityId: number, data: any) => apiFetch<any>(`/api/government-entities/${entityId}/departments`, { method: "POST", body: JSON.stringify(data) }),
  updateDepartment: (id: number, data: any) => apiFetch<any>(`/api/departments/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteDepartment: (id: number) => apiFetch<void>(`/api/departments/${id}`, { method: "DELETE" }),
  createContact: (departmentId: number, data: any) => apiFetch<any>(`/api/departments/${departmentId}/contacts`, { method: "POST", body: JSON.stringify(data) }),
  updateContact: (id: number, data: any) => apiFetch<any>(`/api/contacts/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteContact: (id: number) => apiFetch<void>(`/api/contacts/${id}`, { method: "DELETE" }),
  createMethod: (contactId: number, data: any) => apiFetch<any>(`/api/contacts/${contactId}/methods`, { method: "POST", body: JSON.stringify(data) }),
  updateMethod: (id: number, data: any) => apiFetch<any>(`/api/contact-methods/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteMethod: (id: number) => apiFetch<void>(`/api/contact-methods/${id}`, { method: "DELETE" }),

  serviceTypes: {
    list: () => apiFetch<any[]>("/api/service-types"),
    create: (name: string) => apiFetch<any>("/api/service-types", { method: "POST", body: JSON.stringify({ name }) }),
    delete: (id: number) => apiFetch<void>(`/api/service-types/${id}`, { method: "DELETE" }),
  },
  departmentServiceTypes: {
    list: (departmentId: number) => apiFetch<any[]>(`/api/departments/${departmentId}/service-types`),
    set: (departmentId: number, serviceTypeIds: number[]) => apiFetch<void>(`/api/departments/${departmentId}/service-types`, { method: "PUT", body: JSON.stringify({ serviceTypeIds }) }),
  },
  departmentDocuments: {
    list: (departmentId: number) => apiFetch<any[]>(`/api/departments/${departmentId}/documents`),
    upload: (departmentId: number, data: any) => apiFetch<any>(`/api/departments/${departmentId}/documents`, { method: "POST", body: JSON.stringify(data) }),
    delete: (id: number) => apiFetch<void>(`/api/documents/${id}`, { method: "DELETE" }),
  },
  departmentTimeline: (departmentId: number, filters?: { type?: string; from?: string; to?: string; search?: string }) => {
    const params = new URLSearchParams();
    if (filters?.type) params.set("type", filters.type);
    if (filters?.from) params.set("from", filters.from);
    if (filters?.to) params.set("to", filters.to);
    if (filters?.search) params.set("search", filters.search);
    const qs = params.toString();
    return apiFetch<any[]>(`/api/departments/${departmentId}/timeline${qs ? `?${qs}` : ""}`);
  },
  departmentStats: (departmentId: number) => apiFetch<any>(`/api/departments/${departmentId}/stats`),
};

// ── Suppliers ──────────────────────────────────────────────────────────────
export const suppliersApi = {
  list: (status?: string) => apiFetch<any[]>(status ? `/api/suppliers?status=${status}` : "/api/suppliers"),
  get: (id: number) => apiFetch<any>(`/api/suppliers/${id}`),
  create: (data: any) => apiFetch<any>("/api/suppliers", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: any) => apiFetch<any>(`/api/suppliers/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: number) => apiFetch<void>(`/api/suppliers/${id}`, { method: "DELETE" }),
  approve: (id: number) => apiFetch<any>(`/api/suppliers/${id}/approve`, { method: "PATCH" }),
  types: {
    list: () => apiFetch<{ id: number; name: string }[]>("/api/suppliers/types"),
    create: (name: string) => apiFetch<{ id: number; name: string }>("/api/suppliers/types", { method: "POST", body: JSON.stringify({ name }) }),
    delete: (id: number) => apiFetch<void>(`/api/suppliers/types/${id}`, { method: "DELETE" }),
  },
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
  get: (id: number) => apiFetch<any>(`/api/direct-purchase-orders/${id}`),
  create: (data: any) => apiFetch<any>("/api/direct-purchase-orders", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: any) => apiFetch<any>(`/api/direct-purchase-orders/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: number) => apiFetch<void>(`/api/direct-purchase-orders/${id}`, { method: "DELETE" }),
  stats: () => apiFetch<any>("/api/direct-purchase-orders/stats"),
  getProfitability: (id: number) => apiFetch<any>(`/api/direct-purchase-orders/${id}/profitability`),
  items: {
    list: (poId: number) => apiFetch<any[]>(`/api/direct-purchase-orders/${poId}/items`),
    create: (poId: number, data: any) => apiFetch<any>(`/api/direct-purchase-orders/${poId}/items`, { method: "POST", body: JSON.stringify(data) }),
    update: (poId: number, itemId: number, data: any) => apiFetch<any>(`/api/direct-purchase-orders/${poId}/items/${itemId}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (poId: number, itemId: number) => apiFetch<void>(`/api/direct-purchase-orders/${poId}/items/${itemId}`, { method: "DELETE" }),
  },
  team: {
    list: (poId: number) => apiFetch<any[]>(`/api/direct-purchase-orders/${poId}/team`),
    add: (poId: number, userId: number) => apiFetch<any>(`/api/direct-purchase-orders/${poId}/team`, { method: "POST", body: JSON.stringify({ userId }) }),
    remove: (poId: number, userId: number) => apiFetch<void>(`/api/direct-purchase-orders/${poId}/team/${userId}`, { method: "DELETE" }),
  },
  stageHistory: {
    list: (poId: number) => apiFetch<any[]>(`/api/direct-purchase-orders/${poId}/stage-history`),
  },
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
  get: (id: number) => apiFetch<any>(`/api/contracts/${id}`),
  create: (data: any) => apiFetch<any>("/api/contracts", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: any) => apiFetch<any>(`/api/contracts/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: number) => apiFetch<void>(`/api/contracts/${id}`, { method: "DELETE" }),
  getProfitability: (id: number) => apiFetch<any>(`/api/contracts/${id}/profitability`),

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

// ── Correspondence (المراسلات) ────────────────────────────────────────────
function qs(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  return sp.toString();
}

export const correspondenceApi = {
  list: (params: Record<string, string | number | undefined | null> = {}) =>
    apiFetch<{ rows: any[]; total: number }>(`/api/correspondence?${qs(params)}`),
  stats: () => apiFetch<any>("/api/correspondence/stats"),
  get: (id: number) => apiFetch<any>(`/api/correspondence/${id}`),
  create: (data: any) => apiFetch<any>("/api/correspondence", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: any) => apiFetch<any>(`/api/correspondence/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: number) => apiFetch<void>(`/api/correspondence/${id}`, { method: "DELETE" }),
  approve: (id: number, approved: boolean) =>
    apiFetch<any>(`/api/correspondence/${id}/approve`, { method: "PATCH", body: JSON.stringify({ approved }) }),
  markSent: (id: number) => apiFetch<any>(`/api/correspondence/${id}/send`, { method: "PATCH" }),
  cancel: (id: number) => apiFetch<any>(`/api/correspondence/${id}/cancel`, { method: "PATCH" }),
  markAnswered: (id: number, isAnswered: boolean) =>
    apiFetch<any>(`/api/correspondence/${id}/mark-answered`, { method: "PATCH", body: JSON.stringify({ isAnswered }) }),
  listAttachments: (id: number) => apiFetch<any[]>(`/api/correspondence/${id}/attachments`),
  addAttachment: (id: number, data: { fileName: string; fileUrl: string; mimeType?: string; fileSize?: number; attachmentType?: string }) =>
    apiFetch<any>(`/api/correspondence/${id}/attachments`, { method: "POST", body: JSON.stringify(data) }),
  deleteAttachment: (id: number, attachmentId: number) =>
    apiFetch<void>(`/api/correspondence/${id}/attachments/${attachmentId}`, { method: "DELETE" }),
  downloadUrl: (attachmentId: number) => `/api/correspondence/attachments/${attachmentId}/download`,
};

export const correspondenceTemplatesApi = {
  list: (category?: string) =>
    apiFetch<any[]>(category ? `/api/correspondence-templates?category=${category}` : "/api/correspondence-templates"),
  get: (id: number) => apiFetch<any>(`/api/correspondence-templates/${id}`),
  create: (data: any) => apiFetch<any>("/api/correspondence-templates", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: any) => apiFetch<any>(`/api/correspondence-templates/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: number) => apiFetch<void>(`/api/correspondence-templates/${id}`, { method: "DELETE" }),
};

// ── Fleet Vehicles ──────────────────────────────────────────────────────────
export const vehiclesApi = {
  list: (params?: { status?: string; search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.search) qs.set("search", params.search);
    const q = qs.toString();
    return apiFetch<any[]>(`/api/vehicles${q ? `?${q}` : ""}`);
  },
  stats: () => apiFetch<any>("/api/vehicles/stats"),
  get: (id: number) => apiFetch<any>(`/api/vehicles/${id}`),
  create: (data: any) => apiFetch<any>("/api/vehicles", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: any) => apiFetch<any>(`/api/vehicles/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: number) => apiFetch<void>(`/api/vehicles/${id}`, { method: "DELETE" }),
  fuelLogs: {
    list: (vehicleId: number) => apiFetch<any[]>(`/api/vehicles/${vehicleId}/fuel-logs`),
    create: (vehicleId: number, data: any) => apiFetch<any>(`/api/vehicles/${vehicleId}/fuel-logs`, { method: "POST", body: JSON.stringify(data) }),
    delete: (logId: number) => apiFetch<void>(`/api/vehicles/fuel-logs/${logId}`, { method: "DELETE" }),
  },
  serviceLogs: {
    list: (vehicleId: number) => apiFetch<any[]>(`/api/vehicles/${vehicleId}/service-logs`),
    create: (vehicleId: number, data: any) => apiFetch<any>(`/api/vehicles/${vehicleId}/service-logs`, { method: "POST", body: JSON.stringify(data) }),
    delete: (logId: number) => apiFetch<void>(`/api/vehicles/service-logs/${logId}`, { method: "DELETE" }),
  },
  serviceParts: {
    list: (serviceLogId: number) => apiFetch<any[]>(`/api/vehicles/service-logs/${serviceLogId}/parts`),
    create: (serviceLogId: number, data: any) => apiFetch<any>(`/api/vehicles/service-logs/${serviceLogId}/parts`, { method: "POST", body: JSON.stringify(data) }),
    delete: (partId: number) => apiFetch<void>(`/api/vehicles/service-parts/${partId}`, { method: "DELETE" }),
  },
};

// ── Residency Management ─────────────────────────────────────────────────────
export const residencyApi = {
  companies: {
    list: () => apiFetch<any[]>("/api/residency/companies"),
    create: (data: any) => apiFetch<any>("/api/residency/companies", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: any) => apiFetch<any>(`/api/residency/companies/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (id: number) => apiFetch<void>(`/api/residency/companies/${id}`, { method: "DELETE" }),
    stats: (id: number) => apiFetch<any>(`/api/residency/companies/${id}/stats`),
  },
  workers: {
    list: (params?: { companyId?: number; search?: string; nationality?: string; department?: string; status?: string }) => {
      const qs = new URLSearchParams();
      if (params?.companyId) qs.set("companyId", String(params.companyId));
      if (params?.search) qs.set("search", params.search);
      if (params?.nationality) qs.set("nationality", params.nationality);
      if (params?.department) qs.set("department", params.department);
      if (params?.status) qs.set("status", params.status);
      const q = qs.toString();
      return apiFetch<any[]>(`/api/residency/workers${q ? `?${q}` : ""}`);
    },
    get: (id: number) => apiFetch<any>(`/api/residency/workers/${id}`),
    create: (data: any) => apiFetch<any>("/api/residency/workers", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: any) => apiFetch<any>(`/api/residency/workers/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (id: number) => apiFetch<void>(`/api/residency/workers/${id}`, { method: "DELETE" }),
  },
  alerts: (params?: { companyId?: number; days?: number }) => {
    const qs = new URLSearchParams();
    if (params?.companyId) qs.set("companyId", String(params.companyId));
    if (params?.days) qs.set("days", String(params.days));
    const q = qs.toString();
    return apiFetch<any[]>(`/api/residency/alerts${q ? `?${q}` : ""}`);
  },
  documents: {
    list: (workerId: number) => apiFetch<any[]>(`/api/residency/workers/${workerId}/documents`),
    upsert: (workerId: number, type: string, data: { fileUrl: string; mimeType?: string; fileSize?: number }) =>
      apiFetch<any>(`/api/residency/workers/${workerId}/documents/${type}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (workerId: number, type: string) => apiFetch<void>(`/api/residency/workers/${workerId}/documents/${type}`, { method: "DELETE" }),
  },
  history: {
    list: (workerId: number) => apiFetch<any[]>(`/api/residency/workers/${workerId}/history`),
    add: (workerId: number, data: any) => apiFetch<any>(`/api/residency/workers/${workerId}/history`, { method: "POST", body: JSON.stringify(data) }),
  },
};

// ── Maintenance Management (إدارة الصيانة) ───────────────────────────────────
export const maintenanceApi = {
  equipment: {
    list: (params?: { status?: string; search?: string }) => {
      const qs = new URLSearchParams();
      if (params?.status) qs.set("status", params.status);
      if (params?.search) qs.set("search", params.search);
      const q = qs.toString();
      return apiFetch<any[]>(`/api/maintenance/equipment${q ? `?${q}` : ""}`);
    },
    get: (id: number) => apiFetch<any>(`/api/maintenance/equipment/${id}`),
    create: (data: any) => apiFetch<any>("/api/maintenance/equipment", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: any) => apiFetch<any>(`/api/maintenance/equipment/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (id: number) => apiFetch<void>(`/api/maintenance/equipment/${id}`, { method: "DELETE" }),
    history: (id: number) => apiFetch<any[]>(`/api/maintenance/equipment/${id}/history`),
  },
  workOrders: {
    list: (params?: { stage?: string; equipmentId?: number; assignedTechnicianId?: number; priority?: string }) => {
      const qs = new URLSearchParams();
      if (params?.stage) qs.set("stage", params.stage);
      if (params?.equipmentId) qs.set("equipmentId", String(params.equipmentId));
      if (params?.assignedTechnicianId) qs.set("assignedTechnicianId", String(params.assignedTechnicianId));
      if (params?.priority) qs.set("priority", params.priority);
      const q = qs.toString();
      return apiFetch<any[]>(`/api/maintenance/work-orders${q ? `?${q}` : ""}`);
    },
    get: (id: number) => apiFetch<any>(`/api/maintenance/work-orders/${id}`),
    create: (data: any) => apiFetch<any>("/api/maintenance/work-orders", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: any) => apiFetch<any>(`/api/maintenance/work-orders/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (id: number) => apiFetch<void>(`/api/maintenance/work-orders/${id}`, { method: "DELETE" }),
    stageHistory: (id: number) => apiFetch<any[]>(`/api/maintenance/work-orders/${id}/stage-history`),
    logIncome: (id: number) => apiFetch<any>(`/api/maintenance/work-orders/${id}/log-income`, { method: "POST" }),
  },
  parts: {
    list: (workOrderId: number) => apiFetch<any[]>(`/api/maintenance/work-orders/${workOrderId}/parts`),
    create: (workOrderId: number, data: any) => apiFetch<any>(`/api/maintenance/work-orders/${workOrderId}/parts`, { method: "POST", body: JSON.stringify(data) }),
    update: (workOrderId: number, partId: number, data: any) => apiFetch<any>(`/api/maintenance/work-orders/${workOrderId}/parts/${partId}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (workOrderId: number, partId: number) => apiFetch<void>(`/api/maintenance/work-orders/${workOrderId}/parts/${partId}`, { method: "DELETE" }),
  },
  inventory: {
    list: () => apiFetch<any[]>("/api/maintenance/inventory"),
    get: (id: number) => apiFetch<any>(`/api/maintenance/inventory/${id}`),
    create: (data: any) => apiFetch<any>("/api/maintenance/inventory", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: any) => apiFetch<any>(`/api/maintenance/inventory/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (id: number) => apiFetch<void>(`/api/maintenance/inventory/${id}`, { method: "DELETE" }),
    receive: (id: number, data: { quantity: number; unitCost?: number; recordExpense?: boolean }) =>
      apiFetch<any>(`/api/maintenance/inventory/${id}/receive`, { method: "POST", body: JSON.stringify(data) }),
  },
  preventivePlans: {
    list: (equipmentId?: number) => apiFetch<any[]>(equipmentId ? `/api/maintenance/preventive-plans?equipmentId=${equipmentId}` : "/api/maintenance/preventive-plans"),
    create: (data: any) => apiFetch<any>("/api/maintenance/preventive-plans", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: any) => apiFetch<any>(`/api/maintenance/preventive-plans/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (id: number) => apiFetch<void>(`/api/maintenance/preventive-plans/${id}`, { method: "DELETE" }),
    generateOrder: (id: number) => apiFetch<any>(`/api/maintenance/preventive-plans/${id}/generate-order`, { method: "POST" }),
  },
  budgets: {
    list: (year?: number) => apiFetch<any[]>(year ? `/api/maintenance/budgets?year=${year}` : "/api/maintenance/budgets"),
    upsert: (data: { year: number; month: number; amount: number; notes?: string }) =>
      apiFetch<any>("/api/maintenance/budgets", { method: "POST", body: JSON.stringify(data) }),
    summary: (year?: number) => apiFetch<any>(`/api/maintenance/budgets/summary${year ? `?year=${year}` : ""}`),
  },
  // ميزانية v2 — مصادر دخل مرنة ومصروفات مصنّفة
  incomeEntries: {
    list: (year: number) => apiFetch<any[]>(`/api/maintenance/income-entries?year=${year}`),
    create: (data: any) => apiFetch<any>("/api/maintenance/income-sources", { method: "POST", body: JSON.stringify(data) }),
    delete: (id: number) => apiFetch<void>(`/api/maintenance/income-entries/${id}`, { method: "DELETE" }),
  },
  expenseEntries: {
    list: (year: number) => apiFetch<any[]>(`/api/maintenance/expense-entries?year=${year}`),
    create: (data: any) => apiFetch<any>("/api/maintenance/expense-entries", { method: "POST", body: JSON.stringify(data) }),
    delete: (id: number) => apiFetch<void>(`/api/maintenance/expense-entries/${id}`, { method: "DELETE" }),
  },
  stats: () => apiFetch<any>("/api/maintenance/stats"),
  charts: () => apiFetch<any>("/api/maintenance/charts"),
  alerts: (days?: number) => apiFetch<any>(`/api/maintenance/alerts${days ? `?days=${days}` : ""}`),
  reportTemplates: {
    list: () => apiFetch<any[]>("/api/maintenance/report-templates"),
    create: (data: { name: string; reportType?: string; fileUrl?: string | null; bodyJson?: string | null; isDefault?: boolean }) =>
      apiFetch<any>("/api/maintenance/report-templates", { method: "POST", body: JSON.stringify(data) }),
    delete: (id: number) => apiFetch<void>(`/api/maintenance/report-templates/${id}`, { method: "DELETE" }),
  },
  generateVisitReport: async (workOrderId: number, templateId?: number, orderNumber?: string) => {
    const url = `/api/maintenance/work-orders/${workOrderId}/visit-report${templateId ? `?templateId=${templateId}` : ""}`;
    const res = await fetch(url, { method: "POST", credentials: "include" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error ?? res.statusText);
    }
    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = `visit-report-${orderNumber ?? workOrderId}.docx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(downloadUrl);
  },
  reports: {
    list: (filters?: { search?: string; contractId?: number; equipmentType?: string; dateFrom?: string; dateTo?: string }) => {
      const qs = new URLSearchParams();
      if (filters?.search) qs.set("search", filters.search);
      if (filters?.contractId) qs.set("contractId", String(filters.contractId));
      if (filters?.equipmentType) qs.set("equipmentType", filters.equipmentType);
      if (filters?.dateFrom) qs.set("dateFrom", filters.dateFrom);
      if (filters?.dateTo) qs.set("dateTo", filters.dateTo);
      const q = qs.toString();
      return apiFetch<any[]>(`/api/maintenance/reports${q ? `?${q}` : ""}`);
    },
    download: async (id: number, reportNumber: string) => {
      const res = await fetch(`/api/maintenance/reports/${id}/download`, { method: "GET", credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error ?? res.statusText);
      }
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `${reportNumber}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    },
  },
};

// ── Research & Development (البحث والتطوير) ─────────────────────────────────
export const researchApi = {
  stats: () => apiFetch<any>("/api/research/stats"),
  search: (q: string) => apiFetch<any[]>(`/api/research/search?q=${encodeURIComponent(q)}`),
  evaluations: {
    list: (supplierId: number) => apiFetch<any[]>(`/api/research/evaluations?supplierId=${supplierId}`),
    summary: (supplierId: number) => apiFetch<any>(`/api/research/evaluations/summary?supplierId=${supplierId}`),
    create: (data: any) => apiFetch<any>("/api/research/evaluations", { method: "POST", body: JSON.stringify(data) }),
  },
  knowledge: {
    list: (params: Record<string, string | undefined> = {}) => {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, v); });
      const q = qs.toString();
      return apiFetch<any[]>(`/api/research/knowledge${q ? `?${q}` : ""}`);
    },
    create: (data: any) => apiFetch<any>("/api/research/knowledge", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: any) => apiFetch<any>(`/api/research/knowledge/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (id: number) => apiFetch<void>(`/api/research/knowledge/${id}`, { method: "DELETE" }),
  },
  messages: {
    list: (after?: number) => apiFetch<any[]>(`/api/research/messages${after ? `?after=${after}` : ""}`),
    send: (content: string) => apiFetch<any>("/api/research/messages", { method: "POST", body: JSON.stringify({ content }) }),
  },
  performance: () => apiFetch<any>("/api/research/performance"),
  specs: {
    list: (params: Record<string, string | undefined> = {}) => {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, v); });
      const q = qs.toString();
      return apiFetch<any[]>(`/api/research/specs${q ? `?${q}` : ""}`);
    },
    create: (data: any) => apiFetch<any>("/api/research/specs", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: any) => apiFetch<any>(`/api/research/specs/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (id: number) => apiFetch<void>(`/api/research/specs/${id}`, { method: "DELETE" }),
  },
  assignments: {
    list: (params: Record<string, string | undefined> = {}) => {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, v); });
      const q = qs.toString();
      return apiFetch<any[]>(`/api/research/assignments${q ? `?${q}` : ""}`);
    },
    create: (data: any) => apiFetch<any>("/api/research/assignments", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: any) => apiFetch<any>(`/api/research/assignments/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  },
};

// ── Pricing (التسعير) ────────────────────────────────────────────────────────
export const pricingApi = {
  sheets: {
    list: (params: Record<string, string | number | undefined> = {}) => {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== "") qs.set(k, String(v)); });
      const q = qs.toString();
      return apiFetch<any[]>(`/api/pricing/sheets${q ? `?${q}` : ""}`);
    },
    get: (id: number) => apiFetch<any>(`/api/pricing/sheets/${id}`),
    create: (data: any) => apiFetch<any>("/api/pricing/sheets", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: any) => apiFetch<any>(`/api/pricing/sheets/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (id: number) => apiFetch<void>(`/api/pricing/sheets/${id}`, { method: "DELETE" }),
    duplicate: (id: number) => apiFetch<any>(`/api/pricing/sheets/${id}/duplicate`, { method: "POST" }),
  },
  items: {
    create: (sheetId: number, data: any) => apiFetch<any>(`/api/pricing/sheets/${sheetId}/items`, { method: "POST", body: JSON.stringify(data) }),
    update: (itemId: number, data: any) => apiFetch<any>(`/api/pricing/items/${itemId}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (itemId: number) => apiFetch<void>(`/api/pricing/items/${itemId}`, { method: "DELETE" }),
    duplicate: (itemId: number) => apiFetch<any>(`/api/pricing/items/${itemId}/duplicate`, { method: "POST" }),
    bulkCreate: (sheetId: number, items: any[]) => apiFetch<any[]>(`/api/pricing/sheets/${sheetId}/items/bulk`, { method: "POST", body: JSON.stringify({ items }) }),
  },
};

// ── قسم البحث والتسعير — فرص أوامر الشراء الحكومية ──────────────────────
export const opportunitiesApi = {
  list: (params: Record<string, string | number | undefined> = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== "") qs.set(k, String(v)); });
    const q = qs.toString();
    return apiFetch<any[]>(`/api/opportunities${q ? `?${q}` : ""}`);
  },
  get: (id: number) => apiFetch<any>(`/api/opportunities/${id}`),
  create: (data: any) => apiFetch<any>("/api/opportunities", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: any) => apiFetch<any>(`/api/opportunities/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: number) => apiFetch<void>(`/api/opportunities/${id}`, { method: "DELETE" }),
  claim: (id: number) => apiFetch<any>(`/api/opportunities/${id}/claim`, { method: "POST" }),
  stats: () => apiFetch<any>("/api/opportunities/stats"),
  createPricingSheet: (id: number) => apiFetch<any>(`/api/opportunities/${id}/create-pricing-sheet`, { method: "POST" }),
  buildQuotation: (id: number) => apiFetch<any>(`/api/opportunities/${id}/build-quotation`, { method: "POST" }),
  items: {
    create: (oppId: number, data: any) => apiFetch<any>(`/api/opportunities/${oppId}/items`, { method: "POST", body: JSON.stringify(data) }),
    update: (itemId: number, data: any) => apiFetch<any>(`/api/opportunities/items/${itemId}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (itemId: number) => apiFetch<void>(`/api/opportunities/items/${itemId}`, { method: "DELETE" }),
  },
  quotes: {
    create: (itemId: number, data: any) => apiFetch<any>(`/api/opportunities/items/${itemId}/quotes`, { method: "POST", body: JSON.stringify(data) }),
    update: (quoteId: number, data: any) => apiFetch<any>(`/api/opportunities/quotes/${quoteId}`, { method: "PATCH", body: JSON.stringify(data) }),
    choose: (quoteId: number) => apiFetch<any>(`/api/opportunities/quotes/${quoteId}/choose`, { method: "POST" }),
    delete: (quoteId: number) => apiFetch<void>(`/api/opportunities/quotes/${quoteId}`, { method: "DELETE" }),
  },
  files: {
    create: (oppId: number, data: { fileName: string; fileUrl: string }) => apiFetch<any>(`/api/opportunities/${oppId}/files`, { method: "POST", body: JSON.stringify(data) }),
    updateText: (fileId: number, extractedText: string) => apiFetch<any>(`/api/opportunities/files/${fileId}`, { method: "PATCH", body: JSON.stringify({ extractedText }) }),
    delete: (fileId: number) => apiFetch<void>(`/api/opportunities/files/${fileId}`, { method: "DELETE" }),
  },
};

// ── Tasks / مركز إدارة العمليات ──────────────────────────────────────────
export const tasksApi = {
  list: (params: Record<string, string | number | undefined> = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== "") qs.set(k, String(v)); });
    const q = qs.toString();
    return apiFetch<any[]>(`/api/tasks${q ? `?${q}` : ""}`);
  },
  get: (id: number) => apiFetch<any>(`/api/tasks/${id}`),
  create: (data: any) => apiFetch<any>("/api/tasks", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: any) => apiFetch<any>(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: number) => apiFetch<void>(`/api/tasks/${id}`, { method: "DELETE" }),
  unreadNotes: () => apiFetch<{ count: number; tasks: any[] }>("/api/tasks/unread-notes"),
  markNotesRead: (id: number) => apiFetch<any>(`/api/tasks/${id}/mark-notes-read`, { method: "PATCH" }),
  stats: () => apiFetch<any>("/api/tasks/stats"),
  dailyPerformance: () => apiFetch<{ employees: any[]; tasks: any[] }>("/api/tasks/daily-performance"),
  performance: (year?: number, month?: number) => {
    const qs = new URLSearchParams();
    if (year) qs.set("year", String(year));
    if (month) qs.set("month", String(month));
    const q = qs.toString();
    return apiFetch<any[]>(`/api/tasks/performance${q ? `?${q}` : ""}`);
  },
  activityFeed: (params: { linkedEntityType?: string; linkedEntityId?: number; taskId?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.taskId) qs.set("taskId", String(params.taskId));
    if (params.linkedEntityType) qs.set("linkedEntityType", params.linkedEntityType);
    if (params.linkedEntityId) qs.set("linkedEntityId", String(params.linkedEntityId));
    const q = qs.toString();
    return apiFetch<any[]>(`/api/tasks/activity-feed${q ? `?${q}` : ""}`);
  },
  stages: {
    list: (taskId: number) => apiFetch<any[]>(`/api/tasks/${taskId}/stages`),
    create: (taskId: number, data: any) => apiFetch<any>(`/api/tasks/${taskId}/stages`, { method: "POST", body: JSON.stringify(data) }),
    update: (taskId: number, stageId: number, data: any) => apiFetch<any>(`/api/tasks/${taskId}/stages/${stageId}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (taskId: number, stageId: number) => apiFetch<void>(`/api/tasks/${taskId}/stages/${stageId}`, { method: "DELETE" }),
  },
  comments: {
    list: (taskId: number) => apiFetch<any[]>(`/api/tasks/${taskId}/comments`),
    create: (taskId: number, content: string) => apiFetch<any>(`/api/tasks/${taskId}/comments`, { method: "POST", body: JSON.stringify({ content }) }),
  },
  attachments: {
    list: (taskId: number) => apiFetch<any[]>(`/api/tasks/${taskId}/attachments`),
    create: (taskId: number, data: { fileName: string; objectPath: string }) => apiFetch<any>(`/api/tasks/${taskId}/attachments`, { method: "POST", body: JSON.stringify(data) }),
    delete: (taskId: number, attId: number) => apiFetch<void>(`/api/tasks/${taskId}/attachments/${attId}`, { method: "DELETE" }),
  },
  collaborators: {
    list: (taskId: number) => apiFetch<any[]>(`/api/tasks/${taskId}/collaborators`),
    add: (taskId: number, userId: number) => apiFetch<any>(`/api/tasks/${taskId}/collaborators`, { method: "POST", body: JSON.stringify({ userId }) }),
    remove: (taskId: number, userId: number) => apiFetch<void>(`/api/tasks/${taskId}/collaborators/${userId}`, { method: "DELETE" }),
  },
  approvals: {
    list: (taskId: number) => apiFetch<any[]>(`/api/tasks/${taskId}/approvals`),
    decide: (taskId: number, gate: string, status: "approved" | "rejected", comment?: string) =>
      apiFetch<any>(`/api/tasks/${taskId}/approvals/${gate}`, { method: "PATCH", body: JSON.stringify({ status, comment }) }),
  },
  types: {
    list: () => apiFetch<any[]>("/api/task-types"),
    create: (data: any) => apiFetch<any>("/api/task-types", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: any) => apiFetch<any>(`/api/task-types/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (id: number) => apiFetch<void>(`/api/task-types/${id}`, { method: "DELETE" }),
  },
  recurringTemplates: {
    list: () => apiFetch<any[]>("/api/recurring-templates"),
    create: (data: any) => apiFetch<any>("/api/recurring-templates", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: any) => apiFetch<any>(`/api/recurring-templates/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (id: number) => apiFetch<void>(`/api/recurring-templates/${id}`, { method: "DELETE" }),
  },
};

export const notificationsApi = {
  list: () => apiFetch<any[]>("/api/notifications"),
  unreadCount: () => apiFetch<{ count: number }>("/api/notifications/unread-count"),
  markRead: (id: number) => apiFetch<any>(`/api/notifications/${id}/read`, { method: "PATCH" }),
  markAllRead: () => apiFetch<any>("/api/notifications/mark-all-read", { method: "PATCH" }),
};
