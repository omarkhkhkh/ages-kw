import type { CorrespondenceSourceType } from "@/components/correspondence/correspondence-list-panel";

export type LinkType = "none" | CorrespondenceSourceType;

export const LINK_OPTIONS: { key: LinkType; label: string }[] = [
  { key: "none", label: "بدون" },
  { key: "tender", label: "مناقصة" },
  { key: "practice", label: "ممارسة" },
  { key: "contract", label: "عقد" },
  { key: "purchase_order", label: "أمر شراء" },
  { key: "project", label: "مشروع" },
  { key: "government_entity", label: "جهة حكومية" },
];

export const SOURCE_ID_FIELD: Partial<Record<LinkType, string>> = {
  tender: "tenderId",
  practice: "practiceId",
  contract: "contractId",
  purchase_order: "purchaseOrderId",
  project: "projectId",
};
