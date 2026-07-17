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

/**
 * Export a full single-competitor report as one workbook with 3 sheets
 * (history / by government entity / by item). Can't call exportToExcel per
 * section — each call downloads a separate file.
 */
export function exportCompetitorReportToExcel(
  competitorName: string,
  history: any[],
  entityBreakdown: any[],
  itemBreakdown: any[]
): void {
  const wb = XLSX.utils.book_new();

  const addSheet = (rows: Record<string, any>[], colCount: number, sheetName: string) => {
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = Array.from({ length: colCount }, () => ({ wch: 20 }));
    ws["!dir"] = "RTL" as any;
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  };

  addSheet(
    history.map((h) => ({
      "التاريخ": h.opening_date ?? "",
      "المناقصة/الممارسة": h.tender_name || h.practice_name || "",
      "الجهة": h.tender_entity || h.practice_entity || "",
      "سعرهم": h.total_price ?? "",
      "سعرنا": h.our_price ?? "",
      "الفرق %": h.diff_pct ?? "",
      "الترتيب": h.rank ?? "",
      "النتيجة": h.is_winner ? "فائز" : "لم يفز",
    })),
    8,
    "سجل المواجهات"
  );

  addSheet(
    entityBreakdown.map((e) => ({
      "الجهة الحكومية": e.entity ?? "",
      "عدد الجلسات": e.total ?? "",
      "مرات الفوز": e.their_wins ?? "",
      "متوسط الفرق %": e.avg_diff_pct ?? "",
    })),
    4,
    "حسب الجهة"
  );

  addSheet(
    itemBreakdown.map((it) => ({
      "البند": it.item_name ?? "",
      "عدد مرات التسعير": it.appearances ?? "",
      "متوسط سعرهم": it.avg_their_price ?? "",
      "متوسط سعرنا": it.avg_our_price ?? "",
      "الفرق %": it.avg_diff_pct ?? "",
    })),
    5,
    "حسب البند"
  );

  XLSX.writeFile(wb, `تقرير المنافس - ${competitorName}.xlsx`);
}

export function exportWorkersToExcel(workers: any[]): void {
  exportToExcel(
    workers,
    [
      { header: "الاسم", key: "fullName" },
      { header: "الجنسية", key: "nationality" },
      { header: "المسمى الوظيفي", key: "jobTitle" },
      { header: "القسم", key: "department" },
      { header: "رقم المدني", key: "civilId" },
      { header: "رقم الإقامة", key: "residencyNumber" },
      { header: "تاريخ انتهاء الإقامة", key: "residencyExpiry" },
      { header: "رقم الجواز", key: "passportNumber" },
      { header: "تاريخ انتهاء الجواز", key: "passportExpiry" },
      { header: "انتهاء التأمين الصحي", key: "healthInsuranceExpiry" },
      { header: "انتهاء إذن العمل", key: "workPermitExpiry" },
      { header: "الحالة", key: "status" },
    ],
    "العمال"
  );
}
