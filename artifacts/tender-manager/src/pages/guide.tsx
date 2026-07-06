import { BookOpen, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface Section {
  id: string;
  phase: string;
  title: string;
  icon: string;
  color: string;
  steps: { title: string; details: string[] }[];
}

const sections: Section[] = [
  {
    id: "lists",
    phase: "المرحلة الأولى",
    title: "Microsoft Lists — قاعدة البيانات",
    icon: "📋",
    color: "border-blue-200 bg-blue-50/50",
    steps: [
      {
        title: "إنشاء موقع SharePoint للشركة",
        details: [
          "افتح office.com → SharePoint → إنشاء موقع → موقع فريق",
          "الاسم: \"نظام إدارة المناقصات\" | اللغة: العربية",
          "أضف جميع الموظفين كأعضاء بصلاحيات مناسبة",
        ],
      },
      {
        title: "إنشاء قائمة الجهات الحكومية",
        details: [
          "من الموقع ← Lists ← قائمة جديدة",
          "أضف الأعمدة: اسم الجهة (نص)، النوع (اختيار: وزارة/هيئة/شركة/جامعة)، المسؤول (نص)، الهاتف (نص)، البريد (نص)، العنوان (نص متعدد)",
          "أدخل بيانات الجهات الحكومية التي تتعامل معها",
        ],
      },
      {
        title: "إنشاء سجل المناقصات (القائمة الرئيسية)",
        details: [
          "أنشئ قائمة جديدة باسم 'سجل المناقصات'",
          "أعمدة القسم الأول: رقم المناقصة، اسم المشروع، الجهة الحكومية (Lookup)، رقم المرجع، نوع المنافسة، تاريخ الإعلان، تاريخ الإقفال، مدة التنفيذ، قيمة الكراسة، قيمة الكفالة",
          "أعمدة القسم الثاني: مدير المناقصة (شخص)، مسؤول المشتريات (شخص)، المسؤول المالي (شخص)، مسؤول النقليات (شخص)",
          "أعمدة القسم الثالث - الحالة (اختيار): جديدة | شراء المستندات | طلب عروض أسعار | دراسة فنية | دراسة مالية | مراجعة الإدارة | جاهزة للتسليم | تم التسليم | تحت التقييم | رست علينا | رست على منافس | ملغاة",
          "أعمدة مالية: التكلفة التقديرية، قيمة العرض، الربح المتوقع، نسبة الربح، قيمة العقد",
          "أعمدة الترسية: تاريخ الترسية، تاريخ بدء التنفيذ، تاريخ انتهاء التنفيذ",
        ],
      },
      {
        title: "إنشاء قوائم الموردين وعروض الأسعار",
        details: [
          "قائمة الموردين: الاسم، النوع، التخصص، السجل التجاري، المسؤول، الهاتف، البريد",
          "قائمة طلبات عروض الأسعار: رقم الطلب، المناقصة (Lookup)، المورد (Lookup)، البند، تاريخ الطلب، آخر موعد للرد، السعر المقدم، الحالة",
          "قائمة أوامر الشراء المباشر: رقم الأمر، المورد، الجهة، الوصف، المبلغ، التواريخ، الحالة",
        ],
      },
      {
        title: "إنشاء قوائم المشاريع والكفالات والعقود",
        details: [
          "قائمة المشاريع: مرتبطة بالمناقصة (Lookup)، رقم المشروع، مدير المشروع، القيمة، التواريخ، نسبة الإنجاز",
          "قائمة الكفالات البنكية: نوع الكفالة، البنك، المبلغ، تاريخ الإصدار، تاريخ الانتهاء، الحالة",
          "قائمة العقود: رقم العقد، الجهة، المناقصة، القيمة، تاريخ التوقيع، مدة العقد",
        ],
      },
    ],
  },
  {
    id: "teams",
    phase: "المرحلة الثانية",
    title: "Microsoft Teams — بيئة العمل",
    icon: "👥",
    color: "border-purple-200 bg-purple-50/50",
    steps: [
      {
        title: "إنشاء فريق الشركة",
        details: [
          "افتح Teams ← إنشاء فريق ← من الصفر ← خاص",
          "الاسم: اسم شركتك + 'للمقاولات'",
          "أضف جميع الموظفين الـ 11",
        ],
      },
      {
        title: "إنشاء القنوات",
        details: [
          "قناة: المناقصات الجارية — للنقاش اليومي حول المناقصات",
          "قناة: المشاريع النشطة — متابعة المشاريع تحت التنفيذ",
          "قناة: المشتريات — طلبات عروض الأسعار والموردين",
          "قناة: المالية — التقارير والكفالات والعقود",
          "قناة: الإدارة — للإدارة العليا فقط (صلاحيات محدودة)",
        ],
      },
      {
        title: "تثبيت التطبيقات في Teams",
        details: [
          "ثبّت Microsoft Lists في قناة المناقصات الجارية",
          "ثبّت Microsoft Planner في كل قناة مشروع",
          "أضف تبويب لموقع SharePoint الخاص بالشركة",
        ],
      },
    ],
  },
  {
    id: "planner",
    phase: "المرحلة الثالثة",
    title: "Microsoft Planner — خطة المهام",
    icon: "✅",
    color: "border-green-200 bg-green-50/50",
    steps: [
      {
        title: "إنشاء قالب المهام القياسي لكل مناقصة",
        details: [
          "أنشئ خطة Planner باسم 'نموذج مناقصة'",
          "أضف المجموعات: دراسة المستندات | إعداد العرض الفني | إعداد العرض المالي | مراجعة الإدارة | التسليم",
          "أضف المهام النمطية لكل مجموعة مع المسؤول والموعد النهائي",
        ],
      },
      {
        title: "نسخ الخطة لكل مناقصة جديدة",
        details: [
          "عند إضافة مناقصة جديدة: انسخ الخطة النموذجية",
          "غيّر اسم الخطة لرقم المناقصة",
          "حدّث التواريخ بناءً على موعد إقفال المناقصة",
          "وزّع المهام على أعضاء الفريق",
        ],
      },
    ],
  },
  {
    id: "automate",
    phase: "المرحلة الرابعة",
    title: "Power Automate — الأتمتة",
    icon: "⚙️",
    color: "border-orange-200 bg-orange-50/50",
    steps: [
      {
        title: "أتمتة: إشعار مناقصة جديدة",
        details: [
          "المشغّل: عند إضافة عنصر في قائمة المناقصات",
          "الإجراء 1: إرسال رسالة في قناة Teams — 'مناقصة جديدة: [اسم المشروع]'",
          "الإجراء 2: إرسال بريد إلكتروني لمدير المناقصة",
          "الإجراء 3: إنشاء مجلد في SharePoint باسم رقم المناقصة",
        ],
      },
      {
        title: "أتمتة: تذكير قبل موعد الإقفال",
        details: [
          "المشغّل: جدول يومي يفحص تاريخ الإقفال",
          "الشرط: إذا كان موعد الإقفال خلال 7 أيام وحالة المناقصة ليست 'تم التسليم'",
          "الإجراء: إرسال تنبيه في Teams وبريد إلكتروني لمدير المناقصة",
        ],
      },
      {
        title: "أتمتة: تذكير انتهاء الكفالة البنكية",
        details: [
          "المشغّل: جدول أسبوعي",
          "الشرط: إذا كان تاريخ انتهاء الكفالة خلال 30 يوماً وحالتها 'فعّالة'",
          "الإجراء: إرسال تنبيه عاجل للمسؤول المالي",
        ],
      },
      {
        title: "أتمتة: تحويل المناقصة الرابحة لمشروع",
        details: [
          "المشغّل: عند تغيير حالة المناقصة إلى 'رست علينا'",
          "الإجراء 1: إنشاء عنصر جديد في قائمة المشاريع تلقائياً",
          "الإجراء 2: إنشاء قناة Teams جديدة للمشروع",
          "الإجراء 3: إشعار جميع الفريق بالخبر الجيد!",
        ],
      },
    ],
  },
  {
    id: "dashboard",
    phase: "المرحلة الخامسة",
    title: "لوحة المؤشرات — تقارير الإدارة",
    icon: "📊",
    color: "border-red-200 bg-red-50/50",
    steps: [
      {
        title: "لوحة المؤشرات في هذا النظام",
        details: [
          "هذا النظام يوفر لوحة تحكم جاهزة بإحصاءات المناقصات",
          "مؤشرات: إجمالي المناقصات، المستعجلة، نسبة الفوز، إجمالي قيمة العروض",
          "يمكن الوصول إليها من أي جهاز عبر المتصفح",
        ],
      },
      {
        title: "Power BI — تقارير الإدارة (اختياري)",
        details: [
          "وصّل Power BI بـ SharePoint Lists لسحب بيانات المناقصات",
          "أنشئ تقريراً بمؤشرات: نسبة الفوز الشهرية، قيمة العقود، أداء كل موظف",
          "ضع التقرير في تبويب Teams للإدارة",
          "اضبط تحديث تلقائي يومي للبيانات",
        ],
      },
    ],
  },
  {
    id: "permissions",
    phase: "المرحلة السادسة",
    title: "الصلاحيات وأمن البيانات",
    icon: "🔐",
    color: "border-slate-200 bg-slate-50/50",
    steps: [
      {
        title: "تحديد صلاحيات كل موظف",
        details: [
          "مدير الاعتماد: قراءة فقط للجميع + إضافة وتعديل لقسمه",
          "مهندس المناقصات: إضافة وتعديل المناقصات والعروض الفنية",
          "مسؤول المشتريات: إدارة الموردين وطلبات الأسعار",
          "المسؤول المالي: اطلاع على القيم المالية والكفالات والعقود",
          "الإدارة العليا: قراءة كاملة + التقارير",
        ],
      },
      {
        title: "نصائح أمان البيانات",
        details: [
          "احتفظ بنسخة احتياطية شهرية من البيانات (تصدير إلى Excel)",
          "لا تحذف أي مناقصة — غيّر حالتها إلى 'ملغاة' بدلاً من الحذف",
          "استخدم تنبيهات SharePoint لمراقبة التغييرات المهمة",
        ],
      },
    ],
  },
];

function Accordion({ section }: { section: Section }) {
  const [open, setOpen] = useState(true);
  return (
    <div className={cn("border rounded-xl overflow-hidden", section.color)}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-5 text-right hover:bg-black/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{section.icon}</span>
          <div>
            <div className="text-xs font-medium text-muted-foreground">{section.phase}</div>
            <div className="font-semibold text-foreground">{section.title}</div>
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-5">
          {section.steps.map((step, si) => (
            <div key={si}>
              <div className="flex items-start gap-2 mb-2">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">{si + 1}</span>
                <h3 className="font-semibold text-foreground">{step.title}</h3>
              </div>
              <ul className="space-y-1.5 pr-8">
                {step.details.map((d, di) => (
                  <li key={di} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Guide() {
  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <div className="flex items-start gap-4">
        <div className="p-2 rounded-lg bg-primary/10 shrink-0 mt-1">
          <BookOpen className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">دليل Microsoft 365</h1>
          <p className="text-muted-foreground text-sm mt-1">
            خطة تفصيلية لبناء نظام إدارة المناقصات داخل Microsoft 365 — Lists + Teams + Planner + Power Automate.
          </p>
        </div>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { icon: "📋", label: "8 قوائم مترابطة", sub: "Microsoft Lists" },
          { icon: "👥", label: "بيئة تعاون", sub: "Microsoft Teams" },
          { icon: "✅", label: "مهام منظمة", sub: "Microsoft Planner" },
          { icon: "⚙️", label: "4 أتمتات", sub: "Power Automate" },
          { icon: "📊", label: "لوحة مؤشرات", sub: "Power BI" },
          { icon: "🔐", label: "صلاحيات دقيقة", sub: "SharePoint" },
        ].map((c) => (
          <div key={c.label} className="bg-card border rounded-lg p-4 text-center shadow-sm">
            <div className="text-2xl mb-1">{c.icon}</div>
            <div className="font-semibold text-sm text-foreground">{c.label}</div>
            <div className="text-xs text-muted-foreground">{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Flow diagram */}
      <div className="bg-card border rounded-xl p-5 shadow-sm">
        <h2 className="font-semibold text-foreground mb-4">سير العمل التلقائي</h2>
        <div className="flex flex-col gap-0">
          {[
            "إعلان المناقصة",
            "إدخالها في النظام (Lists)",
            "إنشاء مجلد المشروع تلقائياً (SharePoint)",
            "إرسال إشعار إلى Teams",
            "إنشاء مهام Planner",
            "طلب أسعار الموردين",
            "إعداد العرض الفني والمالي",
            "اعتماد الإدارة",
            "تسليم المناقصة",
            "الترسية ← تحويل تلقائي إلى مشروع",
          ].map((step, i, arr) => (
            <div key={i} className="flex items-center gap-3">
              <div className="flex flex-col items-center">
                <div className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</div>
                {i < arr.length - 1 && <div className="w-px h-5 bg-border" />}
              </div>
              <div className={cn("text-sm py-1", i === arr.length - 1 ? "font-semibold text-emerald-700" : "text-foreground")}>{step}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {sections.map(s => <Accordion key={s.id} section={s} />)}
      </div>

      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center">
        <p className="font-semibold text-emerald-800 mb-1">🎯 القاعدة الذهبية</p>
        <p className="text-sm text-emerald-700">أدخل بيانات المناقصة مرة واحدة فقط — والنظام يوزعها تلقائياً على جميع القوائم والتطبيقات.</p>
      </div>
    </div>
  );
}
