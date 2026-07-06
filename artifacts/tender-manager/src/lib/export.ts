import * as XLSX from "xlsx";

interface ExportColumn {
  header: string;
  key: string;
}

/**
 * Export data array to Excel (.xlsx) and trigger download.
 */
export function exportToExcel(data: any[], columns: ExportColumn[], filename: string): void {
  const rows = data.map((item) =>
    Object.fromEntries(columns.map((col) => [col.header, item[col.key] ?? ""]))
  );
  const ws = XLSX.utils.json_to_sheet(rows);

  // Set column widths
  ws["!cols"] = columns.map(() => ({ wch: 20 }));

  // RTL support
  ws["!dir"] = "RTL" as any;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "البيانات");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/**
 * Export tenders to Excel.
 */
export function exportTendersToExcel(tenders: any[]): void {
  exportToExcel(
    tenders,
    [
      { header: "رقم المناقصة", key: "tenderNumber" },
      { header: "المشروع", key: "projectName" },
      { header: "الجهة الحكومية", key: "governmentEntity" },
      { header: "الحالة", key: "status" },
      { header: "تاريخ الإعلان", key: "announcementDate" },
      { header: "آخر موعد", key: "deadline" },
      { header: "قيمة الضمان", key: "bondValue" },
      { header: "مسؤول المناقصة", key: "tenderManager" },
    ],
    "المناقصات"
  );
}

export function exportEntitiesToExcel(entities: any[]): void {
  exportToExcel(
    entities,
    [
      { header: "اسم الجهة", key: "name" },
      { header: "النوع", key: "type" },
      { header: "الشخص المسؤول", key: "contactPerson" },
      { header: "الهاتف", key: "phone" },
      { header: "البريد", key: "email" },
      { header: "العنوان", key: "address" },
    ],
    "الجهات_الحكومية"
  );
}

export function exportSuppliersToExcel(suppliers: any[]): void {
  exportToExcel(
    suppliers,
    [
      { header: "اسم المورد", key: "name" },
      { header: "النوع", key: "type" },
      { header: "التخصص", key: "specialization" },
      { header: "السجل التجاري", key: "commercialRegNo" },
      { header: "الهاتف", key: "phone" },
      { header: "البريد", key: "email" },
    ],
    "الموردون"
  );
}

export function exportProjectsToExcel(projects: any[]): void {
  exportToExcel(
    projects,
    [
      { header: "اسم المشروع", key: "name" },
      { header: "مدير المشروع", key: "projectManager" },
      { header: "الحالة", key: "status" },
      { header: "قيمة العقد", key: "contractValue" },
      { header: "نسبة الإنجاز", key: "completionPercentage" },
      { header: "تاريخ البدء", key: "startDate" },
      { header: "تاريخ الانتهاء", key: "endDate" },
    ],
    "المشاريع"
  );
}

export function exportGuaranteesToExcel(guarantees: any[]): void {
  exportToExcel(
    guarantees,
    [
      { header: "نوع الكفالة", key: "type" },
      { header: "البنك", key: "bankName" },
      { header: "المبلغ", key: "amount" },
      { header: "تاريخ الإصدار", key: "issueDate" },
      { header: "تاريخ الانتهاء", key: "expiryDate" },
      { header: "الحالة", key: "status" },
    ],
    "الكفالات_البنكية"
  );
}

export function exportContractsToExcel(contracts: any[]): void {
  exportToExcel(
    contracts,
    [
      { header: "رقم العقد", key: "contractNumber" },
      { header: "قيمة العقد", key: "contractValue" },
      { header: "الحالة", key: "status" },
      { header: "تاريخ التوقيع", key: "signDate" },
      { header: "تاريخ البدء", key: "startDate" },
      { header: "تاريخ الانتهاء", key: "endDate" },
    ],
    "العقود"
  );
}
