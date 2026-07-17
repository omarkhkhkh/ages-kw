import React, { createContext, useContext, useEffect, useState } from "react";

/*
 * i18n — واجهة ثنائية اللغة (عربي/إنجليزي)
 * تغطي حاليًا: الصفحة التعريفية، تسجيل الدخول، الهيكل العام (القائمة/الرأس)، ولوحة التحكم.
 * الصفحات الداخلية تبقى عربية (تحمل dir="rtl" خاصًا بها) إلى أن تُترجم تدريجيًا.
 */

export type Lang = "ar" | "en";

const DICT: Record<string, { ar: string; en: string }> = {
  // ── مشترك ──
  "app.name":            { ar: "سجل المناقصات",                          en: "Tender Registry" },
  "app.company":         { ar: "المجموعة العربية للخدمات التعليمية",     en: "Arabian Group for Educational Services" },
  "app.companyShort":    { ar: "المجموعة العربية",                       en: "Arabian Group" },
  "app.companySub":      { ar: "للخدمات التعليمية",                      en: "Educational Services" },
  "app.systemSub":       { ar: "نظام إدارة المناقصات والأعمال التجارية", en: "Tenders & Business Management System" },
  "common.viewAll":      { ar: "عرض الكل ←",                             en: "View all →" },
  "common.loading":      { ar: "جارٍ التحميل...",                        en: "Loading..." },
  "common.today":        { ar: "اليوم",                                   en: "Today" },

  // ── القائمة الجانبية ──
  "nav.home":            { ar: "الرئيسية",               en: "Home" },
  "nav.tendersGroup":    { ar: "المناقصات والمشاريع",    en: "Tenders & Projects" },
  "nav.tenders":         { ar: "المناقصات",              en: "Tenders" },
  "nav.practices":       { ar: "الممارسات",              en: "Practices" },
  "nav.projects":        { ar: "المشاريع",               en: "Projects" },
  "nav.contractsGroup":  { ar: "أوامر الشراء والعقود",   en: "POs & Contracts" },
  "nav.contracts":       { ar: "العقود",                 en: "Contracts" },
  "nav.purchaseOrders":  { ar: "أوامر الشراء",           en: "Purchase Orders" },
  "nav.rfq":             { ar: "عروض الأسعار",           en: "RFQs" },
  "nav.suppliers":       { ar: "الموردون",               en: "Suppliers" },
  "nav.entitiesGroup":   { ar: "الجهات الحكومية",        en: "Government Entities" },
  "nav.entities":        { ar: "الجهات الحكومية",        en: "Entities" },
  "nav.govRegistrations":{ ar: "تسجيلات الجهات",         en: "Registrations" },
  "nav.guarantees":      { ar: "خطابات الضمان",          en: "Bank Guarantees" },
  "nav.finance":         { ar: "الشؤون المالية",         en: "Finance" },
  "nav.docs":            { ar: "المستندات والأرشيف",     en: "Documents & Archive" },
  "nav.correspondence":  { ar: "المراسلات",              en: "Correspondence" },
  "nav.residency":       { ar: "إدارة الإقامات",         en: "Residency" },
  "nav.maintenanceGroup":{ ar: "إدارة الصيانة",          en: "Maintenance" },
  "nav.maintenance":     { ar: "لوحة الصيانة",           en: "Maintenance Board" },
  "nav.maintenanceReports": { ar: "تقارير الصيانة",      en: "Maintenance Reports" },
  "nav.research":        { ar: "البحث والتطوير",         en: "R&D" },
  "nav.pricing":         { ar: "التسعير",                en: "Pricing" },
  "nav.transport":       { ar: "المركبات والنقل",        en: "Fleet & Transport" },
  "nav.tasksGroup":      { ar: "المهام والمتابعة",       en: "Tasks & Follow-up" },
  "nav.operations":      { ar: "مركز إدارة العمليات",    en: "Operations Center" },
  "nav.calendar":        { ar: "جدول الأعمال",           en: "Calendar" },
  "nav.competitorGroup": { ar: "ذكاء المنافسين",         en: "Competitor Intelligence" },
  "nav.competitorBoard": { ar: "لوحة المنافسين",         en: "Competitors Board" },
  "nav.competitorPredict": { ar: "تنبؤ المنافسين",       en: "Price Prediction" },
  "nav.analytics":       { ar: "التقارير والتحليلات",    en: "Reports & Analytics" },
  "nav.settings":        { ar: "الإعدادات",              en: "Settings" },
  "nav.adminUsers":      { ar: "إدارة المستخدمين",       en: "User Management" },
  "nav.activityLog":     { ar: "سجل الحركات",            en: "Activity Log" },
  "nav.serviceTypes":    { ar: "أنواع التعامل",          en: "Service Types" },
  "nav.taskTypes":       { ar: "أنواع المهام",           en: "Task Types" },
  "nav.support":         { ar: "الدعم الفني",            en: "Support" },
  "nav.logout":          { ar: "تسجيل الخروج",           en: "Sign out" },
  "nav.roleAdmin":       { ar: "مدير النظام",            en: "System Admin" },
  "nav.roleEmployee":    { ar: "موظف",                   en: "Employee" },

  // ── الشريط العلوي ──
  "header.kuwait":       { ar: "الكويت",                 en: "Kuwait" },
  "header.newTender":    { ar: "مناقصة جديدة",           en: "New Tender" },
  "header.notifications":{ ar: "الإشعارات",              en: "Notifications" },
  "header.noNotifications": { ar: "لا توجد إشعارات",     en: "No notifications" },

  // ── أسماء الصفحات (الشارة العلوية) ──
  "page./":                    { ar: "الرئيسية",                     en: "Home" },
  "page./tenders":             { ar: "سجل المناقصات",                en: "Tender Registry" },
  "page./practices":           { ar: "الممارسات",                    en: "Practices" },
  "page./company-docs":        { ar: "وثائق الشركة الرسمية",         en: "Company Documents" },
  "page./gov-registrations":   { ar: "تسجيلات الجهات الحكومية",      en: "Government Registrations" },
  "page./entities":            { ar: "الجهات الحكومية",              en: "Government Entities" },
  "page./suppliers":           { ar: "الموردون",                     en: "Suppliers" },
  "page./projects":            { ar: "المشاريع",                     en: "Projects" },
  "page./guarantees":          { ar: "الكفالات البنكية",             en: "Bank Guarantees" },
  "page./contracts":           { ar: "العقود",                       en: "Contracts" },
  "page./rfq":                 { ar: "طلبات عروض الأسعار",           en: "RFQ Requests" },
  "page./purchase-orders":     { ar: "أوامر الشراء المباشر",         en: "Direct Purchase Orders" },
  "page./transportation":      { ar: "المركبات والنقل",              en: "Fleet & Transport" },
  "page./finance":             { ar: "الشؤون المالية",               en: "Finance" },
  "page./tasks":               { ar: "المهام",                       en: "Tasks" },
  "page./calendar":            { ar: "جدول الأعمال",                 en: "Calendar" },
  "page./correspondence":      { ar: "المراسلات",                    en: "Correspondence" },
  "page./residency":           { ar: "إدارة الإقامات",               en: "Residency" },
  "page./maintenance":         { ar: "إدارة الصيانة",                en: "Maintenance" },
  "page./maintenance/report-templates": { ar: "تقارير الصيانة",      en: "Maintenance Reports" },
  "page./research":            { ar: "البحث والتطوير",               en: "R&D" },
  "page./pricing":             { ar: "التسعير",                      en: "Pricing" },
  "page./competitor-intelligence": { ar: "ذكاء المنافسين",           en: "Competitor Intelligence" },
  "page./admin/users":         { ar: "إدارة المستخدمين",             en: "User Management" },
  "page./admin/activity-log":  { ar: "سجل الحركات",                  en: "Activity Log" },
  "page./admin/service-types": { ar: "أنواع التعامل",                en: "Service Types" },
  "page./admin/task-types":    { ar: "أنواع المهام",                 en: "Task Types" },
  "page./guide":               { ar: "الدعم الفني",                  en: "Support" },

  // ── لوحة التحكم ──
  "dash.morning":        { ar: "صباح الخير",             en: "Good morning" },
  "dash.afternoon":      { ar: "مساء الخير",             en: "Good afternoon" },
  "dash.evening":        { ar: "مساء النور",             en: "Good evening" },
  "dash.welcome":        { ar: "مرحباً",                 en: "Welcome" },
  "dash.overview":       { ar: "نظرة عامة على حالة المناقصات والأعمال الجارية", en: "Overview of tenders and ongoing business" },
  "dash.controlPanel":   { ar: "لوحة التحكم",            en: "Dashboard" },
  "dash.totalTenders":   { ar: "إجمالي المناقصات",       en: "Total Tenders" },
  "dash.totalTendersSub":{ ar: "مناقصة مسجّلة",          en: "registered tenders" },
  "dash.urgent":         { ar: "مناقصات عاجلة",          en: "Urgent Tenders" },
  "dash.urgentSub":      { ar: "تستحق المتابعة",         en: "need follow-up" },
  "dash.won":            { ar: "رست علينا",              en: "Won" },
  "dash.wonSub":         { ar: "مناقصة ناجحة",           en: "successful tenders" },
  "dash.offerValue":     { ar: "قيمة العروض",            en: "Offers Value" },
  "dash.offerValueSub":  { ar: "د.ك إجمالي",             en: "KWD total" },
  "dash.winRate":        { ar: "نسبة النجاح",            en: "Win Rate" },
  "dash.winRateSub":     { ar: "معدل الفوز",             en: "success ratio" },
  "dash.mainModules":    { ar: "الوحدات الرئيسية",       en: "Main Modules" },
  "dash.companyDocs":    { ar: "وثائق الشركة",           en: "Company Documents" },
  "dash.govRegs":        { ar: "تسجيلات الجهات",         en: "Registrations" },
  "dash.expired":        { ar: "منتهية",                 en: "expired" },
  "dash.expiring30":     { ar: "تنتهي خلال 30 يوم",      en: "expiring within 30 days" },
  "dash.activeTasks":    { ar: "المهام النشطة",          en: "Active Tasks" },
  "dash.myTasks":        { ar: "مهامي",                  en: "My Tasks" },
  "dash.urgentBadge":    { ar: "عاجلة",                  en: "urgent" },
  "dash.newNote":        { ar: "ملاحظة جديدة",           en: "new note" },
  "dash.manageTasks":    { ar: "إدارة المهام ←",         en: "Manage tasks →" },
  "dash.viewMyTasks":    { ar: "عرض كل مهامي ←",         en: "View all my tasks →" },
  "dash.recentTenders":  { ar: "أحدث المناقصات",         en: "Recent Tenders" },
  "dash.noTenders":      { ar: "لا توجد مناقصات حالياً", en: "No tenders yet" },
  "dash.newComments":    { ar: "تعليق جديد",             en: "new comments" },
  "dash.overdue":        { ar: "متأخرة",                 en: "Overdue" },
  "dash.new":            { ar: "جديد",                   en: "New" },
  "dash.col.tenderNo":   { ar: "رقم المناقصة",           en: "Tender No." },
  "dash.col.project":    { ar: "المشروع",                en: "Project" },
  "dash.col.entity":     { ar: "الجهة",                  en: "Entity" },
  "dash.col.deadline":   { ar: "آخر موعد",               en: "Deadline" },
  "dash.col.status":     { ar: "الحالة",                 en: "Status" },
  "dash.pri.urgent":     { ar: "عاجلة",                  en: "Urgent" },
  "dash.pri.high":       { ar: "عالية",                  en: "High" },
  "dash.pri.medium":     { ar: "متوسطة",                 en: "Medium" },
  "dash.pri.low":        { ar: "منخفضة",                 en: "Low" },
  "dash.st.pending":     { ar: "قيد الانتظار",           en: "Pending" },
  "dash.st.in_progress": { ar: "جارٍ التنفيذ",           en: "In Progress" },
  "dash.st.completed":   { ar: "مكتملة",                 en: "Completed" },
  "dash.st.cancelled":   { ar: "ملغاة",                  en: "Cancelled" },
  "dash.mod.tenders":    { ar: "سجل المناقصات",          en: "Tenders" },
  "dash.mod.entities":   { ar: "الجهات الحكومية",        en: "Gov. Entities" },
  "dash.mod.suppliers":  { ar: "الموردون",               en: "Suppliers" },
  "dash.mod.projects":   { ar: "المشاريع",               en: "Projects" },
  "dash.mod.guarantees": { ar: "الكفالات البنكية",       en: "Bank Guarantees" },
  "dash.mod.contracts":  { ar: "العقود",                 en: "Contracts" },
  "dash.mod.rfq":        { ar: "طلبات عروض الأسعار",     en: "RFQ Requests" },
  "dash.mod.po":         { ar: "أوامر الشراء المباشر",   en: "Purchase Orders" },
  "dash.mod.docs":       { ar: "وثائق الشركة",           en: "Company Docs" },
  "dash.mod.regs":       { ar: "تسجيلات الجهات",         en: "Registrations" },
  "dash.mod.calendar":   { ar: "جدول الأعمال",           en: "Calendar" },
  "dash.mod.correspondence": { ar: "المراسلات",          en: "Correspondence" },

  // ── الصفحة التعريفية ──
  "land.home":           { ar: "الرئيسية",               en: "Home" },
  "land.about":          { ar: "من نحن",                 en: "About" },
  "land.faq":            { ar: "الأسئلة الشائعة",        en: "FAQ" },
  "land.contact":        { ar: "تواصل معنا",             en: "Contact" },
  "land.login":          { ar: "تسجيل الدخول",           en: "Sign in" },
  "land.loginSystem":    { ar: "تسجيل الدخول للنظام",    en: "Sign in to the system" },
  "land.explore":        { ar: "تعرّف على النظام",       en: "Explore the system" },
  "land.heroTitle1":     { ar: "نظام متكامل لإدارة",     en: "An integrated system for" },
  "land.heroTitle2":     { ar: "المناقصات والعقود",      en: "government tenders" },
  "land.heroTitle3":     { ar: "الحكومية",               en: "& contracts" },
  "land.heroDesc":       { ar: "تتبّع كل مناقصة من الإعلان وحتى الترسية والتنفيذ، وأدر العقود والضمانات والموردين والشؤون المالية في مكان واحد — بواجهة عربية سهلة على كل الأجهزة.", en: "Track every tender from announcement to award and execution, and manage contracts, guarantees, suppliers and finance in one place — on any device." },
  "land.live":           { ar: "مباشر",                  en: "Live" },
  "land.aboutDesc":      { ar: "\"سجل المناقصات\" منصة داخلية طوّرتها المجموعة العربية للخدمات التعليمية لإدارة دورة حياة المناقصات الحكومية بالكامل — من الإعلان والتحضير، مروراً بالتسعير والتقديم، وحتى الترسية والتنفيذ ومتابعة الضمانات والعقود، في نظام واحد يجمع كل الفرق المعنية.", en: "Tender Registry is an internal platform built by Arabian Group for Educational Services to manage the full lifecycle of government tenders — from announcement and preparation, through pricing and submission, to award, execution and follow-up of guarantees and contracts, in one system that unites all teams." },
  "land.faqDesc":        { ar: "إجابات سريعة عن أكثر الأسئلة تكراراً حول استخدام النظام.", en: "Quick answers to the most common questions about the system." },
  "land.contactDesc":    { ar: "لديك استفسار عن النظام أو تحتاج إنشاء حساب؟ راسلنا وسنرد عليك في أقرب وقت.", en: "Have a question or need an account? Send us a message and we'll get back to you." },
  "land.phone":          { ar: "الهاتف",                 en: "Phone" },
  "land.email":          { ar: "البريد الإلكتروني",      en: "Email" },
  "land.address":        { ar: "العنوان",                en: "Address" },
  "land.addressValue":   { ar: "الرياض، المملكة العربية السعودية", en: "Riyadh, Saudi Arabia" },
  "land.name":           { ar: "الاسم",                  en: "Name" },
  "land.namePh":         { ar: "اكتب اسمك",              en: "Your name" },
  "land.message":        { ar: "الرسالة",                en: "Message" },
  "land.messagePh":      { ar: "اكتب رسالتك هنا...",     en: "Write your message here..." },
  "land.send":           { ar: "إرسال الرسالة",          en: "Send message" },
  "land.sending":        { ar: "جارِ الإرسال...",        en: "Sending..." },
  "land.sent":           { ar: "✅ تم إرسال رسالتك",     en: "✅ Message sent" },
  "land.sentDesc":       { ar: "سنتواصل معك قريباً.",    en: "We'll get back to you soon." },
  "land.rights":         { ar: "جميع الحقوق محفوظة",     en: "All rights reserved" },
  "land.f1t":            { ar: "إدارة المناقصات",        en: "Tender Management" },
  "land.f1d":            { ar: "تتبّع دورة حياة كل مناقصة من الإعلان حتى الترسية والتنفيذ.", en: "Track each tender's lifecycle from announcement to award and delivery." },
  "land.f2t":            { ar: "الضمانات والعقود",       en: "Guarantees & Contracts" },
  "land.f2d":            { ar: "متابعة الضمانات البنكية والعقود وتواريخ انتهائها أولاً بأول.", en: "Stay on top of bank guarantees, contracts and their expiry dates." },
  "land.f3t":            { ar: "الموردون والجهات",       en: "Suppliers & Entities" },
  "land.f3d":            { ar: "قاعدة بيانات موحّدة للموردين والجهات الحكومية المتعامل معها.", en: "A unified database of suppliers and government entities." },
  "land.f4t":            { ar: "النقل والمواصلات",       en: "Fleet & Transport" },
  "land.f4d":            { ar: "جدولة وتتبع أوامر النقل وفرق العمل الميدانية.", en: "Schedule and track transport orders and field teams." },
  "land.f5t":            { ar: "ذكاء المنافسين",         en: "Competitor Intelligence" },
  "land.f5d":            { ar: "تحليلات وتنبؤات تنافسية تدعم قرار التسعير.", en: "Competitive analytics and predictions that inform pricing." },
  "land.f6t":            { ar: "الشؤون المالية",         en: "Finance" },
  "land.f6d":            { ar: "إيرادات ومصروفات وأرباح الموظفين في مكان واحد.", en: "Income, expenses and employee earnings in one place." },
  "land.q1":             { ar: "من يستطيع استخدام النظام؟", en: "Who can use the system?" },
  "land.a1":             { ar: "النظام مخصص لموظفي الشركة المصرَّح لهم فقط، ويتم إنشاء الحسابات وتحديد الصلاحيات من قِبل مدير النظام.", en: "The system is for authorized company staff only; accounts and permissions are created by the system admin." },
  "land.q2":             { ar: "هل يمكن التحكم بصلاحيات كل موظف على حِدة؟", en: "Can permissions be controlled per employee?" },
  "land.a2":             { ar: "نعم، يمكن للمدير تفعيل أو إخفاء كل وحدة (مناقصات، عقود، موردين، مالية...) لكل موظف، وكذلك التحكم في صلاحيات العرض والتعديل والرفع والتحميل.", en: "Yes — the admin can enable or hide each module (tenders, contracts, suppliers, finance...) per employee, and control view/edit/upload/download rights." },
  "land.q3":             { ar: "هل بياناتي وملفاتي محفوظة بأمان؟", en: "Is my data stored securely?" },
  "land.a3":             { ar: "نعم، الدخول يتم عبر جلسة مصادَق عليها (Session) وكل الاتصالات مشفّرة، مع سجل نشاط كامل يوثّق كل عملية إنشاء أو تعديل أو حذف.", en: "Yes — access uses authenticated sessions over encrypted connections, with a full activity log of every create, edit and delete." },
  "land.q4":             { ar: "هل النظام يدعم الأجهزة المختلفة؟", en: "Does it work on all devices?" },
  "land.a4":             { ar: "نعم، الواجهة متجاوبة بالكامل وتعمل على الحاسوب والتابلت والهاتف المحمول بنفس الكفاءة.", en: "Yes — the interface is fully responsive and works equally well on desktop, tablet and mobile." },
  "land.q5":             { ar: "كيف أحصل على حساب دخول؟", en: "How do I get an account?" },
  "land.a5":             { ar: "تواصل مع مدير النظام في شركتك لإنشاء حساب جديد وتحديد الوحدات والصلاحيات المناسبة لدورك.", en: "Contact your company's system admin to create an account with the modules and permissions for your role." },

  // ── تسجيل الدخول ──
  "login.systemName":    { ar: "نظام إدارة المناقصات والعقود", en: "Tenders & Contracts Management System" },
  "login.title":         { ar: "تسجيل الدخول",           en: "Sign in" },
  "login.subtitle":      { ar: "أدخل بياناتك للوصول إلى النظام", en: "Enter your credentials to access the system" },
  "login.username":      { ar: "اسم المستخدم",           en: "Username" },
  "login.usernamePh":    { ar: "أدخل اسم المستخدم",      en: "Enter your username" },
  "login.password":      { ar: "كلمة المرور",            en: "Password" },
  "login.passwordPh":    { ar: "أدخل كلمة المرور",       en: "Enter your password" },
  "login.submit":        { ar: "دخول",                   en: "Sign in" },
  "login.error":         { ar: "حدث خطأ. حاول مجدداً.",  en: "Something went wrong. Try again." },
  "login.showPass":      { ar: "إظهار كلمة المرور",      en: "Show password" },
  "login.hidePass":      { ar: "إخفاء كلمة المرور",      en: "Hide password" },
  "login.rights":        { ar: "جميع الحقوق محفوظة",     en: "All rights reserved" },
};

interface I18nContextValue {
  lang: Lang;
  dir: "rtl" | "ltr";
  locale: string;
  setLang: (l: Lang) => void;
  toggleLang: () => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue>({
  lang: "ar", dir: "rtl", locale: "ar-KW",
  setLang: () => {}, toggleLang: () => {},
  t: (k) => DICT[k]?.ar ?? k,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem("app-lang");
    return saved === "en" ? "en" : "ar";
  });

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem("app-lang", l);
  };

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  const value: I18nContextValue = {
    lang,
    dir: lang === "ar" ? "rtl" : "ltr",
    locale: lang === "ar" ? "ar-KW" : "en-US",
    setLang,
    toggleLang: () => setLang(lang === "ar" ? "en" : "ar"),
    t: (key: string) => DICT[key]?.[lang] ?? DICT[key]?.ar ?? key,
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);

/* زر تبديل اللغة — يُستخدم في الرأس وصفحتي الدخول والتعريف */
export function LangToggle({ style }: { style?: React.CSSProperties }) {
  const { lang, toggleLang } = useI18n();
  return (
    <button
      onClick={toggleLang}
      title={lang === "ar" ? "Switch to English" : "التبديل إلى العربية"}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "5px 12px", borderRadius: 9,
        border: "1.5px solid rgba(212,165,52,0.4)",
        background: "rgba(212,165,52,0.08)",
        color: "#A87C20", fontSize: 12, fontWeight: 800,
        cursor: "pointer", fontFamily: "inherit",
        transition: "background 0.12s",
        ...style,
      }}
      onMouseEnter={e => (e.currentTarget.style.background = "rgba(212,165,52,0.18)")}
      onMouseLeave={e => (e.currentTarget.style.background = "rgba(212,165,52,0.08)")}
    >
      <span style={{ fontSize: 13 }}>🌐</span>
      {lang === "ar" ? "EN" : "عربي"}
    </button>
  );
}
