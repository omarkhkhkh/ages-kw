import { useState } from "react";
import { Link } from "wouter";
import {
  Menu,
  X,
  FileText,
  ShieldCheck,
  Users,
  Truck,
  TrendingUp,
  Wallet,
  Mail,
  Phone,
  MapPin,
  ArrowLeft,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import logoImg from "@/assets/logo.png";

const GOLD = "#D4A534";
const GOLD_LIGHT = "#E8BE55";
const GOLD_DARK = "#A87C20";
const GREEN_DARK = "#0b1a10";
const GREEN_MID = "#132a18";
const GREEN_LIGHT = "#1e4028";

const NAV_LINKS = [
  { href: "#hero", label: "الرئيسية" },
  { href: "#about", label: "من نحن" },
  { href: "#faq", label: "الأسئلة الشائعة" },
  { href: "#contact", label: "تواصل معنا" },
];

const FEATURES = [
  { icon: FileText, title: "إدارة المناقصات", desc: "تتبّع دورة حياة كل مناقصة من الإعلان حتى الترسية والتنفيذ." },
  { icon: ShieldCheck, title: "الضمانات والعقود", desc: "متابعة الضمانات البنكية والعقود وتواريخ انتهائها أولاً بأول." },
  { icon: Users, title: "الموردون والجهات", desc: "قاعدة بيانات موحّدة للموردين والجهات الحكومية المتعامل معها." },
  { icon: Truck, title: "النقل والمواصلات", desc: "جدولة وتتبع أوامر النقل وفرق العمل الميدانية." },
  { icon: TrendingUp, title: "ذكاء المنافسين", desc: "تحليلات وتنبؤات تنافسية تدعم قرار التسعير." },
  { icon: Wallet, title: "الشؤون المالية", desc: "إيرادات ومصروفات وأرباح الموظفين في مكان واحد." },
];

const FAQ = [
  {
    q: "من يستطيع استخدام النظام؟",
    a: "النظام مخصص لموظفي الشركة المصرَّح لهم فقط، ويتم إنشاء الحسابات وتحديد الصلاحيات من قِبل مدير النظام.",
  },
  {
    q: "هل يمكن التحكم بصلاحيات كل موظف على حِدة؟",
    a: "نعم، يمكن للمدير تفعيل أو إخفاء كل وحدة (مناقصات، عقود، موردين، مالية...) لكل موظف، وكذلك التحكم في صلاحيات العرض والتعديل والرفع والتحميل.",
  },
  {
    q: "هل بياناتي وملفاتي محفوظة بأمان؟",
    a: "نعم، الدخول يتم عبر جلسة مصادَق عليها (Session) وكل الاتصالات مشفّرة، مع سجل نشاط كامل يوثّق كل عملية إنشاء أو تعديل أو حذف.",
  },
  {
    q: "هل النظام يدعم الأجهزة المختلفة؟",
    a: "نعم، الواجهة متجاوبة بالكامل وتعمل على الحاسوب والتابلت والهاتف المحمول بنفس الكفاءة.",
  },
  {
    q: "كيف أحصل على حساب دخول؟",
    a: "تواصل مع مدير النظام في شركتك لإنشاء حساب جديد وتحديد الوحدات والصلاحيات المناسبة لدورك.",
  },
];

function NavBar() {
  const [open, setOpen] = useState(false);

  return (
    <header
      className="sticky top-0 z-50 border-b backdrop-blur bg-white/90"
      style={{ borderColor: "rgba(212,165,52,0.18)" }}
      dir="rtl"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <a href="#hero" className="flex items-center gap-2 shrink-0">
          <img src={logoImg} alt="Arabian Group" className="h-9 w-auto object-contain sm:h-10" />
          <span className="hidden text-sm font-bold sm:block" style={{ color: GREEN_MID }}>
            سجل المناقصات
          </span>
        </a>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-gray-600 transition-colors hover:text-[#A87C20]"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:block">
          <Link href="/login">
            <Button
              className="font-bold text-white shadow-md"
              style={{
                background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD}, ${GOLD_DARK})`,
              }}
            >
              تسجيل الدخول
            </Button>
          </Link>
        </div>

        <button
          className="flex h-9 w-9 items-center justify-center rounded-md md:hidden"
          style={{ color: GREEN_MID }}
          onClick={() => setOpen((v) => !v)}
          aria-label="فتح القائمة"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <div className="border-t bg-white px-4 pb-4 pt-2 md:hidden" style={{ borderColor: "rgba(212,165,52,0.18)" }}>
          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {l.label}
              </a>
            ))}
            <Link href="/login">
              <Button
                className="mt-2 w-full font-bold text-white"
                style={{ background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD}, ${GOLD_DARK})` }}
              >
                تسجيل الدخول
              </Button>
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

function Hero() {
  return (
    <section
      id="hero"
      dir="rtl"
      className="relative overflow-hidden"
      style={{ background: `linear-gradient(160deg, ${GREEN_DARK} 0%, ${GREEN_MID} 55%, ${GREEN_LIGHT} 100%)` }}
    >
      {/* decorative glows */}
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full sm:h-96 sm:w-96"
        style={{ background: `radial-gradient(circle, rgba(212,165,52,0.22), transparent 70%)`, filter: "blur(60px)" }}
      />
      <div
        className="pointer-events-none absolute -left-24 -bottom-24 h-72 w-72 rounded-full sm:h-96 sm:w-96"
        style={{ background: `radial-gradient(circle, rgba(30,64,40,0.9), transparent 70%)`, filter: "blur(60px)" }}
      />

      <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 sm:py-24 md:grid-cols-2 md:items-center md:py-28 lg:px-8">
        <div className="text-center md:text-right">
          <span
            className="inline-block rounded-full px-4 py-1.5 text-xs font-bold sm:text-sm"
            style={{ background: "rgba(212,165,52,0.15)", color: GOLD_LIGHT, border: `1px solid rgba(212,165,52,0.35)` }}
          >
            المجموعة العربية للخدمات التعليمية
          </span>

          <h1 className="mt-6 text-3xl font-extrabold leading-tight text-white sm:text-4xl md:text-5xl">
            نظام متكامل لإدارة
            <br />
            <span style={{ color: GOLD_LIGHT }}>المناقصات والعقود</span> الحكومية
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/70 sm:text-lg md:mx-0">
            تتبّع كل مناقصة من الإعلان وحتى الترسية والتنفيذ، وأدر العقود والضمانات
            والموردين والشؤون المالية في مكان واحد — بواجهة عربية سهلة على كل الأجهزة.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row md:justify-start">
            <Link href="/login" className="w-full sm:w-auto">
              <Button
                size="lg"
                className="w-full gap-2 font-bold text-white shadow-lg sm:w-auto"
                style={{ background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD}, ${GOLD_DARK})` }}
              >
                تسجيل الدخول للنظام
                <ArrowLeft size={18} />
              </Button>
            </Link>
            <a href="#about" className="w-full sm:w-auto">
              <Button
                size="lg"
                variant="outline"
                className="w-full border-white/25 bg-white/5 font-bold text-white hover:bg-white/10 sm:w-auto"
              >
                تعرّف على النظام
              </Button>
            </a>
          </div>
        </div>

        {/* visual card */}
        <div className="relative mx-auto w-full max-w-md md:max-w-none">
          <div
            className="relative rounded-3xl p-6 shadow-2xl sm:p-8"
            style={{ background: "rgba(255,255,255,0.97)", boxShadow: "0 24px 64px rgba(0,0,0,0.45)" }}
          >
            <div className="mb-5 flex items-center justify-between">
              <span className="text-sm font-bold" style={{ color: GREEN_MID }}>
                لوحة التحكم
              </span>
              <span
                className="rounded-full px-3 py-1 text-xs font-bold text-white"
                style={{ background: GOLD }}
              >
                مباشر
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {FEATURES.slice(0, 4).map((f) => (
                <div
                  key={f.title}
                  className="rounded-xl border p-3 sm:p-4"
                  style={{ borderColor: "rgba(212,165,52,0.2)", background: "#fdfbf6" }}
                >
                  <f.icon size={20} style={{ color: GOLD_DARK }} />
                  <p className="mt-2 text-xs font-bold sm:text-sm" style={{ color: GREEN_MID }}>
                    {f.title}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function About() {
  return (
    <section id="about" dir="rtl" className="bg-[#f7f5ef] py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <div
            className="mx-auto mb-4 h-1 w-9 rounded-full"
            style={{ background: `linear-gradient(90deg, ${GOLD}, ${GOLD_LIGHT})` }}
          />
          <h2 className="text-2xl font-extrabold sm:text-3xl md:text-4xl" style={{ color: GREEN_MID }}>
            من نحن
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-gray-600 sm:text-base">
            "سجل المناقصات" منصة داخلية طوّرتها المجموعة العربية للخدمات التعليمية
            لإدارة دورة حياة المناقصات الحكومية بالكامل — من الإعلان والتحضير، مروراً
            بالتسعير والتقديم، وحتى الترسية والتنفيذ ومتابعة الضمانات والعقود، في نظام
            واحد يجمع كل الفرق المعنية.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-5 sm:mt-16 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
              style={{ borderColor: "rgba(212,165,52,0.18)" }}
            >
              <div
                className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl"
                style={{ background: "rgba(212,165,52,0.12)" }}
              >
                <f.icon size={22} style={{ color: GOLD_DARK }} />
              </div>
              <h3 className="text-base font-bold sm:text-lg" style={{ color: GREEN_MID }}>
                {f.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqSection() {
  return (
    <section id="faq" dir="rtl" className="bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <div
            className="mx-auto mb-4 h-1 w-9 rounded-full"
            style={{ background: `linear-gradient(90deg, ${GOLD}, ${GOLD_LIGHT})` }}
          />
          <h2 className="text-2xl font-extrabold sm:text-3xl md:text-4xl" style={{ color: GREEN_MID }}>
            الأسئلة الشائعة
          </h2>
          <p className="mt-4 text-sm text-gray-600 sm:text-base">
            إجابات سريعة عن أكثر الأسئلة تكراراً حول استخدام النظام.
          </p>
        </div>

        <Accordion type="single" collapsible className="mt-10 w-full">
          {FAQ.map((item, i) => (
            <AccordionItem key={i} value={`faq-${i}`} style={{ borderColor: "rgba(212,165,52,0.2)" }}>
              <AccordionTrigger className="text-right text-sm font-bold sm:text-base" style={{ color: GREEN_MID }}>
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-gray-600">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

function ContactSection() {
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [sending, setSending] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setTimeout(() => {
      toast({ title: "✅ تم إرسال رسالتك", description: "سنتواصل معك قريباً." });
      setForm({ name: "", email: "", message: "" });
      setSending(false);
    }, 500);
  };

  return (
    <section id="contact" dir="rtl" className="bg-[#f7f5ef] py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <div
            className="mx-auto mb-4 h-1 w-9 rounded-full"
            style={{ background: `linear-gradient(90deg, ${GOLD}, ${GOLD_LIGHT})` }}
          />
          <h2 className="text-2xl font-extrabold sm:text-3xl md:text-4xl" style={{ color: GREEN_MID }}>
            تواصل معنا
          </h2>
          <p className="mt-4 text-sm text-gray-600 sm:text-base">
            لديك استفسار عن النظام أو تحتاج إنشاء حساب؟ راسلنا وسنرد عليك في أقرب وقت.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-8 sm:mt-16 lg:grid-cols-5 lg:gap-10">
          <div className="space-y-4 lg:col-span-2">
            {[
              { icon: Phone, label: "الهاتف", value: "+966 11 000 0000" },
              { icon: Mail, label: "البريد الإلكتروني", value: "info@arabiangroup.example" },
              { icon: MapPin, label: "العنوان", value: "الرياض، المملكة العربية السعودية" },
            ].map((c) => (
              <div
                key={c.label}
                className="flex items-center gap-4 rounded-2xl border bg-white p-4 sm:p-5"
                style={{ borderColor: "rgba(212,165,52,0.18)" }}
              >
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: "rgba(212,165,52,0.12)" }}
                >
                  <c.icon size={20} style={{ color: GOLD_DARK }} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{c.label}</p>
                  <p className="text-sm font-bold" style={{ color: GREEN_MID }}>
                    {c.value}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-4 rounded-2xl border bg-white p-6 shadow-sm sm:p-8 lg:col-span-3"
            style={{ borderColor: "rgba(212,165,52,0.18)" }}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-bold" style={{ color: GREEN_MID }}>
                  الاسم
                </label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="اكتب اسمك"
                  className="w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-[#D4A534]"
                  style={{ borderColor: "#e8e0cc", background: "#fdfbf6" }}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold" style={{ color: GREEN_MID }}>
                  البريد الإلكتروني
                </label>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="example@email.com"
                  className="w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-[#D4A534]"
                  style={{ borderColor: "#e8e0cc", background: "#fdfbf6" }}
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold" style={{ color: GREEN_MID }}>
                الرسالة
              </label>
              <textarea
                required
                rows={4}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="اكتب رسالتك هنا..."
                className="w-full resize-none rounded-lg border px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-[#D4A534]"
                style={{ borderColor: "#e8e0cc", background: "#fdfbf6" }}
              />
            </div>
            <Button
              type="submit"
              disabled={sending}
              className="w-full gap-2 font-bold text-white sm:w-auto"
              style={{ background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD}, ${GOLD_DARK})` }}
            >
              <Send size={16} />
              {sending ? "جارِ الإرسال..." : "إرسال الرسالة"}
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer dir="rtl" style={{ background: GREEN_DARK }} className="py-10">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 text-center sm:px-6 lg:px-8">
        <img src={logoImg} alt="Arabian Group" className="h-10 w-auto object-contain opacity-90" />
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="text-xs text-white/60 hover:text-white sm:text-sm">
              {l.label}
            </a>
          ))}
        </nav>
        <p className="text-xs text-white/40">
          © {new Date().getFullYear()} المجموعة العربية للخدمات التعليمية — جميع الحقوق محفوظة
        </p>
      </div>
    </footer>
  );
}

export default function Landing() {
  return (
    <div style={{ fontFamily: "'Cairo', 'IBM Plex Sans Arabic', sans-serif" }}>
      <NavBar />
      <Hero />
      <About />
      <FaqSection />
      <ContactSection />
      <Footer />
    </div>
  );
}
