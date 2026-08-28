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

// ── Cost Centers (مراكز التكلفة/الربح — النواة المالية الموحّدة) ──────────────
export type CostCenter = { id: number; name: string; type: "profit" | "cost" | "allocatable"; evaluationMetric: string | null; isActive: boolean };
export type AllocationRule = { id: number; costCenterId: number; costCenterName: string; costType: string | null; driver: string | null; shareRatio: string; notes: string | null };
export type ProfitabilityRow = { costCenterId: number; name: string; directIncome: number; directExpense: number; directMargin: number; shareRatio: number; allocatedShare: number; afterAllocation: number };
export type Profitability = { year: number; allocatablePool: number; totalShareRatio: number; centers: ProfitabilityRow[] };
export type CompanyDashboard = {
  year: number;
  totals: { income: number; expense: number; net: number; profitExpense: number; costExpense: number; allocatableExpense: number; capex: number };
  byCenter: { id: number; name: string; type: "profit" | "cost" | "allocatable"; income: number; expense: number; margin: number }[];
  monthly: { month: number; income: number; expense: number; net: number }[];
  waterfall: { label: string; value: number; kind: "start" | "down" | "total" }[];
  forecast: { monthsElapsed: number; isComplete: boolean; projectedIncome: number; projectedExpense: number; projectedNet: number };
};
export type BudgetSummary = {
  costCenterId: number; year: number;
  annualBudget: number; annualSpent: number; annualRemaining: number; annualIncome: number; annualCapex: number; annualNet: number;
  monthly: { month: number; budget: number; spent: number; income: number; capex: number; net: number }[];
};
export const costCentersApi = {
  list: () => apiFetch<CostCenter[]>("/api/cost-centers"),
  create: (data: Partial<CostCenter>) => apiFetch<CostCenter>("/api/cost-centers", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: Partial<CostCenter>) => apiFetch<CostCenter>(`/api/cost-centers/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: number) => apiFetch<void>(`/api/cost-centers/${id}`, { method: "DELETE" }),
  allocationRules: {
    list: () => apiFetch<AllocationRule[]>("/api/cost-centers/allocation-rules"),
    create: (data: { costCenterId: number; costType?: string | null; driver?: string | null; shareRatio: number; notes?: string | null }) =>
      apiFetch<AllocationRule>("/api/cost-centers/allocation-rules", { method: "POST", body: JSON.stringify(data) }),
    delete: (id: number) => apiFetch<void>(`/api/cost-centers/allocation-rules/${id}`, { method: "DELETE" }),
  },
  profitability: (year: number) => apiFetch<Profitability>(`/api/cost-centers/profitability?year=${year}`),
  companyDashboard: (year: number) => apiFetch<CompanyDashboard>(`/api/cost-centers/company-dashboard?year=${year}`),
  budgetSummary: (id: number, year: number) => apiFetch<BudgetSummary>(`/api/cost-centers/${id}/budget-summary?year=${year}`),
  setBudget: (id: number, d: { year: number; month: number; targetAmount: number }) => apiFetch<{ ok: boolean }>(`/api/cost-centers/${id}/budget`, { method: "POST", body: JSON.stringify(d) }),
  financialEvents: (year: number, type?: string) => apiFetch<FinancialEvent[]>(`/api/cost-centers/financial-events?year=${year}${type ? `&type=${type}` : ""}`),
  reverseEvent: (id: number, reason?: string) => apiFetch<FinancialEvent>(`/api/cost-centers/financial-events/${id}/reverse`, { method: "POST", body: JSON.stringify({ reason }) }),
  ledgerIntegrity: () => apiFetch<LedgerIntegrity>(`/api/cost-centers/ledger-integrity`),
};

// ── Financial events (المرحلة ٦/٩/١٠) + Pricing book (المرحلة ٧) ──
export type FinancialEvent = { id: number; eventType: "income" | "expense" | "reversal"; sourceLedger: string | null; sourceId: number | null; amount: string; costCenterId: number | null; costCenterName: string | null; transactionDate: string | null; description: string | null; reversesEventId: number | null; createdAt: string; isReversed: boolean };
export type LedgerIntegrity = { eventsExpense: string; ledgerExpense: string; eventsIncome: string; ledgerIncome: string; reversalTotal: string; eventsCount: number; reversalsCount: number; expenseMatch: boolean; incomeMatch: boolean; inSync: boolean };
export type PricingBookItem = { id: number; itemCode: string; itemName: string; category: string | null; unit: string | null; standardCost: string; standardPrice: string; currency: string; notes: string | null; isActive: boolean; createdAt: string; updatedAt: string };
export const pricingBookApi = {
  list: (search?: string) => apiFetch<PricingBookItem[]>(`/api/pricing-book${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  create: (d: Partial<PricingBookItem>) => apiFetch<PricingBookItem>("/api/pricing-book", { method: "POST", body: JSON.stringify(d) }),
  update: (id: number, d: Partial<PricingBookItem>) => apiFetch<PricingBookItem>(`/api/pricing-book/${id}`, { method: "PATCH", body: JSON.stringify(d) }),
  delete: (id: number) => apiFetch<void>(`/api/pricing-book/${id}`, { method: "DELETE" }),
};

// ── Contract Maintenance (صيانة العقود) ──────────────────────────────────────
/** سلسلة استعلام من قيم اختيارية — يتجاهل الفارغ (يُستخدم لمعاملات التقارير). */
const qsFrom = (o: Record<string, any>) => { const p = Object.entries(o).filter(([, v]) => v != null && v !== "").map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&"); return p ? `?${p}` : ""; };
const MS = "/api/maintenance-service";
const msq = (o: Record<string, any>) => { const p = Object.entries(o).filter(([, v]) => v != null && v !== "").map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&"); return p ? `?${p}` : ""; };
function msCrud<T = any>(base: string) {
  return {
    list: (filter?: Record<string, any>) => apiFetch<T[]>(`${MS}/${base}${filter ? msq(filter) : ""}`),
    create: (d: any) => apiFetch<T>(`${MS}/${base}`, { method: "POST", body: JSON.stringify(d) }),
    update: (id: number, d: any) => apiFetch<T>(`${MS}/${base}/${id}`, { method: "PATCH", body: JSON.stringify(d) }),
    delete: (id: number) => apiFetch<void>(`${MS}/${base}/${id}`, { method: "DELETE" }),
  };
}
export const maintenanceServiceApi = {
  equipmentTypes: msCrud("equipment-types"),
  districts: msCrud("districts"),
  schools: msCrud("schools"),
  workshops: msCrud("workshops"),
  serviceContracts: msCrud("service-contracts"),
  coverage: msCrud("coverage"),
  priceList: msCrud("price-list"),
  sla: msCrud("sla"),
  assignments: msCrud("assignments"),
  standardPhrases: msCrud("standard-phrases"),
  incomingRegister: msCrud("incoming-register"),
  warrantyClaims: msCrud("warranty-claims"),
  presentationProfiles: msCrud("presentation-profiles"),
  fieldLabels: msCrud("field-labels"),
  coverageResolve: (equipmentId: number, date?: string) => apiFetch<any>(`${MS}/coverage-resolve${msq({ equipmentId, date })}`),
  visits: {
    list: (filter?: Record<string, any>) => apiFetch<any[]>(`${MS}/visits${filter ? msq(filter) : ""}`),
    get: (id: number) => apiFetch<any>(`${MS}/visits/${id}`),
    create: (d: any) => apiFetch<any>(`${MS}/visits`, { method: "POST", body: JSON.stringify(d) }),
    update: (id: number, d: any) => apiFetch<any>(`${MS}/visits/${id}`, { method: "PATCH", body: JSON.stringify(d) }),
    delete: (id: number) => apiFetch<void>(`${MS}/visits/${id}`, { method: "DELETE" }),
    addLine: (visitId: number, d: any) => apiFetch<any>(`${MS}/visits/${visitId}/lines`, { method: "POST", body: JSON.stringify(d) }),
    updateLine: (lineId: number, d: any) => apiFetch<any>(`${MS}/lines/${lineId}`, { method: "PATCH", body: JSON.stringify(d) }),
    deleteLine: (lineId: number) => apiFetch<void>(`${MS}/lines/${lineId}`, { method: "DELETE" }),
    generateWorkOrder: (lineId: number) => apiFetch<any>(`${MS}/lines/${lineId}/generate-work-order`, { method: "POST", body: "{}" }),
  },
  outgoingRegister: {
    list: (filter?: Record<string, any>) => apiFetch<any[]>(`${MS}/outgoing-register${filter ? msq(filter) : ""}`),
    create: (d: any) => apiFetch<any>(`${MS}/outgoing-register`, { method: "POST", body: JSON.stringify(d) }),
    update: (id: number, d: any) => apiFetch<any>(`${MS}/outgoing-register/${id}`, { method: "PATCH", body: JSON.stringify(d) }),
    delete: (id: number) => apiFetch<void>(`${MS}/outgoing-register/${id}`, { method: "DELETE" }),
  },
  // فوترة العمل غير المشمول/المتجاوز للسقف — عرض سعر ثم تأكيد بمبلغ قابل للتعديل
  billing: {
    pending: () => apiFetch<any[]>(`${MS}/billing/pending`),
    billed: () => apiFetch<any[]>(`${MS}/billing/billed`),
    quote: (lineId: number) => apiFetch<any>(`${MS}/billing/quote${msq({ lineId })}`),
    bill: (lineId: number, d: { amount?: number | string; date?: string; description?: string; note?: string }) =>
      apiFetch<any>(`${MS}/lines/${lineId}/bill`, { method: "POST", body: JSON.stringify(d) }),
    unbill: (lineId: number) => apiFetch<{ reversalIncomeId: number; reversedIncomeId: number; amount: number }>(`${MS}/lines/${lineId}/bill`, { method: "DELETE" }),
  },
  preventivePlans: {
    autoLink: () => apiFetch<{ linked: number }>(`${MS}/preventive-plans/auto-link`, { method: "POST", body: "{}" }),
  },
  analytics: {
    equipmentHistory: (equipmentId: number) => apiFetch<any[]>(`${MS}/analytics/equipment-history${msq({ equipmentId })}`),
    contractVisitBalance: () => apiFetch<any[]>(`${MS}/analytics/contract-visit-balance`),
    pendingReschedule: () => apiFetch<any[]>(`${MS}/analytics/pending-reschedule`),
    contractPmCoverage: () => apiFetch<any[]>(`${MS}/analytics/contract-pm-coverage`),
  },
};

// ── المناصب (القبعات) ────────────────────────────────────────────────────────
export const positionsApi = {
  list: () => apiFetch<any[]>("/api/positions"),
  ofUser: (userId: number) => apiFetch<{ positions: string[] }>(`/api/positions/user/${userId}`),
  audit: () => apiFetch<any[]>("/api/positions/audit"),
  grant: (userId: number, positionKey: string) => apiFetch<any>("/api/positions/grant", { method: "POST", body: JSON.stringify({ userId, positionKey }) }),
  revoke: (userId: number, positionKey: string) => apiFetch<any>("/api/positions/revoke", { method: "POST", body: JSON.stringify({ userId, positionKey }) }),
};

// ── النقل الموحّد ولوحة الأحمال ──────────────────────────────────────────────
export const workTransfersApi = {
  entityTypes: () => apiFetch<any[]>("/api/work-transfers/entity-types"),
  workload: () => apiFetch<any[]>("/api/work-transfers/workload"),
  userItems: (userId: number) => apiFetch<any[]>(`/api/work-transfers/user/${userId}/items`),
  history: (entityType: string, entityId: number) => apiFetch<any[]>(`/api/work-transfers/history?entityType=${entityType}&entityId=${entityId}`),
  recent: () => apiFetch<any[]>("/api/work-transfers/recent"),
  transfer: (d: { entityType: string; entityId: number; toUserId: number; reason: string }) =>
    apiFetch<any>("/api/work-transfers", { method: "POST", body: JSON.stringify(d) }),
  requestTransfer: (d: { entityType: string; entityId: number; reason: string; suggestedToUserId?: number }) =>
    apiFetch<any>("/api/work-transfers/requests", { method: "POST", body: JSON.stringify(d) }),
  requests: (status?: string) => apiFetch<any[]>(`/api/work-transfers/requests${status ? `?status=${encodeURIComponent(status)}` : ""}`),
  approveRequest: (id: number, toUserId?: number) => apiFetch<any>(`/api/work-transfers/requests/${id}/approve`, { method: "POST", body: JSON.stringify(toUserId ? { toUserId } : {}) }),
  rejectRequest: (id: number) => apiFetch<any>(`/api/work-transfers/requests/${id}/reject`, { method: "POST", body: "{}" }),
};

// ── ملفات الحالة (رحلة المناقصة/الممارسة) ────────────────────────────────────
export const caseFilesApi = {
  byEntity: (entityType: string, entityId: number) => apiFetch<any>(`/api/case-files/by-entity?entityType=${entityType}&entityId=${entityId}`),
  list: (status?: string) => apiFetch<any[]>(`/api/case-files${status ? `?status=${encodeURIComponent(status)}` : ""}`),
  declareSourcing: (d: { entityType: string; entityId: number; sourcingPath: string; researcherUserId?: number; supplierId?: number }) =>
    apiFetch<any>("/api/case-files/declare-sourcing", { method: "POST", body: JSON.stringify(d) }),
  submit: (id: number) => apiFetch<any>(`/api/case-files/${id}/submit`, { method: "POST", body: "{}" }),
  hold: (id: number, reason: string) => apiFetch<any>(`/api/case-files/${id}/hold`, { method: "POST", body: JSON.stringify({ reason }) }),
  releaseHold: (id: number) => apiFetch<any>(`/api/case-files/${id}/release-hold`, { method: "POST", body: "{}" }),
  approve: (id: number, note?: string) => apiFetch<any>(`/api/case-files/${id}/approve`, { method: "POST", body: JSON.stringify(note ? { note } : {}) }),
  reject: (id: number, note: string) => apiFetch<any>(`/api/case-files/${id}/reject`, { method: "POST", body: JSON.stringify({ note }) }),
  closureReadiness: (id: number) => apiFetch<any>(`/api/case-files/${id}/closure-readiness`),
  close: (id: number, d: { outcome: string; reasons: string; lessons?: string }) => apiFetch<any>(`/api/case-files/${id}/close`, { method: "POST", body: JSON.stringify(d) }),
  memoryCard: (entityType: string, entityId: number) => apiFetch<any>(`/api/case-files/memory-card?entityType=${entityType}&entityId=${entityId}`),
  exchanges: (caseId: number) => apiFetch<any[]>(`/api/case-files/${caseId}/exchanges`),
  addExchange: (caseId: number, d: { kind: string; note?: string; fileUrl?: string; supplierId?: number; price?: string | number }) =>
    apiFetch<any>(`/api/case-files/${caseId}/exchanges`, { method: "POST", body: JSON.stringify(d) }),
  convertToContract: (id: number, d: { contractNumber: string; opsProfile: string; contractValue?: string; startDate?: string; endDate?: string }) =>
    apiFetch<any>(`/api/case-files/${id}/convert-to-contract`, { method: "POST", body: JSON.stringify(d) }),
  contractMonitor: (contractId: number) => apiFetch<any>(`/api/case-files/contract-monitor/${contractId}`),
  addVariance: (d: { contractId: number; itemName: string; actualCost: string; estimatedCost?: string; supplierId?: number; reason: string }) =>
    apiFetch<any>("/api/case-files/contract-variances", { method: "POST", body: JSON.stringify(d) }),
};

// ── الالتزامات المتجددة + مسيّر الرواتب ─────────────────────────────────────
export const obligationsApi = {
  board: (windowDays?: number) => apiFetch<any[]>(`/api/obligations/board${windowDays ? `?windowDays=${windowDays}` : ""}`),
  dispatch: (d: { kind: string; id: number; docType?: string; assigneeUserId: number }) => apiFetch<any>("/api/obligations/dispatch", { method: "POST", body: JSON.stringify(d) }),
  complete: (d: { taskId: number; newExpiryDate: string; amount: string | number; notes?: string }) => apiFetch<any>("/api/obligations/complete", { method: "POST", body: JSON.stringify(d) }),
  payroll: (runId?: number) => apiFetch<any>(`/api/obligations/payroll${runId ? `?runId=${runId}` : ""}`),
  payrollGenerate: (year: number, month: number) => apiFetch<any>("/api/obligations/payroll/generate", { method: "POST", body: JSON.stringify({ year, month }) }),
  payrollPost: (id: number) => apiFetch<any>(`/api/obligations/payroll/${id}/post`, { method: "POST", body: "{}" }),
  payrollUpdateItem: (id: number, salary: number) => apiFetch<any>(`/api/obligations/payroll/items/${id}`, { method: "PATCH", body: JSON.stringify({ salary }) }),
  payrollDeleteItem: (id: number) => apiFetch<void>(`/api/obligations/payroll/items/${id}`, { method: "DELETE" }),
};

// ── المركز المالي — الأبواب الخمسة ──────────────────────────────────────────
export const financialCenterApi = {
  liquidity: (months?: number, safety?: number) => apiFetch<any>(`/api/financial-center/liquidity?months=${months ?? 6}${safety != null ? `&safety=${safety}` : ""}`),
  readiness: (year?: number) => apiFetch<any>(`/api/financial-center/readiness${year ? `?year=${year}` : ""}`),
  alerts: () => apiFetch<any>("/api/financial-center/alerts"),
  categoryBudgets: (year?: number) => apiFetch<any[]>(`/api/financial-center/category-budgets${year ? `?year=${year}` : ""}`),
  saveCategoryBudget: (d: { costCenterId: number; category: string; amount: number; year?: number }) => apiFetch<any>("/api/financial-center/category-budgets", { method: "POST", body: JSON.stringify(d) }),
  deleteCategoryBudget: (id: number) => apiFetch<void>(`/api/financial-center/category-budgets/${id}`, { method: "DELETE" }),
  createOverrun: (d: { costCenterId: number; category: string; amount: number; reason: string; year?: number }) => apiFetch<any>("/api/financial-center/overrun-requests", { method: "POST", body: JSON.stringify(d) }),
  overruns: (status?: string) => apiFetch<any[]>(`/api/financial-center/overrun-requests${status ? `?status=${encodeURIComponent(status)}` : ""}`),
  approveOverrun: (id: number) => apiFetch<any>(`/api/financial-center/overrun-requests/${id}/approve`, { method: "POST", body: "{}" }),
  rejectOverrun: (id: number) => apiFetch<any>(`/api/financial-center/overrun-requests/${id}/reject`, { method: "POST", body: "{}" }),
  cfoDesk: () => apiFetch<any>("/api/financial-center/cfo-desk"),
};

// ── حزمة المناقصات: الإسنادات + الكفالة + قناة التبادل ─────────────────────
export const practicesExtraApi = {
  assignments: (id: number) => apiFetch<any[]>(`/api/practices/${id}/assignments`),
  assign: (id: number, role: string, userId: number) => apiFetch<any>(`/api/practices/${id}/assignments`, { method: "POST", body: JSON.stringify({ role, userId }) }),
  unassign: (id: number, role: string) => apiFetch<void>(`/api/practices/${id}/assignments/${encodeURIComponent(role)}`, { method: "DELETE" }),
  issueBond: (id: number, d: { guaranteeNumber: string; bankName: string; issueDate?: string; expiryDate?: string }) =>
    apiFetch<any>(`/api/practices/${id}/issue-bond`, { method: "POST", body: JSON.stringify(d) }),
};
export const tendersExtraApi = {
  assignments: (tenderId: number) => apiFetch<any[]>(`/api/tenders/${tenderId}/assignments`),
  assign: (tenderId: number, role: string, userId: number) => apiFetch<any>(`/api/tenders/${tenderId}/assignments`, { method: "POST", body: JSON.stringify({ role, userId }) }),
  unassign: (tenderId: number, role: string) => apiFetch<void>(`/api/tenders/${tenderId}/assignments/${encodeURIComponent(role)}`, { method: "DELETE" }),
  issueBond: (tenderId: number, d: { guaranteeNumber: string; bankName: string; issueDate?: string; expiryDate?: string }) =>
    apiFetch<any>(`/api/tenders/${tenderId}/issue-bond`, { method: "POST", body: JSON.stringify(d) }),
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
  // تقرير زيارة عقد — نفس محرّك القوالب، برقم رسمي وقيد تلقائي في سجل الصادر
  generateContractVisitReport: async (visitId: number, opts?: { templateId?: number; profileId?: number; visitNumber?: string }) => {
    const url = `/api/maintenance/visits/${visitId}/report${qsFrom({ templateId: opts?.templateId, profileId: opts?.profileId })}`;
    const res = await fetch(url, { method: "POST", credentials: "include" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error ?? res.statusText);
    }
    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = `${opts?.visitNumber ?? `visit-${visitId}`}.docx`;
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
