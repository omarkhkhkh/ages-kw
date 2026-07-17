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
import { useI18n, LangToggle } from "@/contexts/i18n";
import logoImg from "@/assets/logo.png";

const GOLD = "#D4A534";
const GOLD_LIGHT = "#E8BE55";
const GOLD_DARK = "#A87C20";
const GREEN_DARK = "#0b1a10";
const GREEN_MID = "#132a18";
const GREEN_LIGHT = "#1e4028";

/* المفاتيح تُترجم عبر t() وقت العرض */
const NAV_LINKS = [
  { href: "#hero", label: "land.home" },
  { href: "#about", label: "land.about" },
  { href: "#faq", label: "land.faq" },
  { href: "#contact", label: "land.contact" },
];

const FEATURES = [
  { icon: FileText,    title: "land.f1t", desc: "land.f1d" },
  { icon: ShieldCheck, title: "land.f2t", desc: "land.f2d" },
  { icon: Users,       title: "land.f3t", desc: "land.f3d" },
  { icon: Truck,       title: "land.f4t", desc: "land.f4d" },
  { icon: TrendingUp,  title: "land.f5t", desc: "land.f5d" },
  { icon: Wallet,      title: "land.f6t", desc: "land.f6d" },
];

const FAQ = [
  { q: "land.q1", a: "land.a1" },
  { q: "land.q2", a: "land.a2" },
  { q: "land.q3", a: "land.a3" },
  { q: "land.q4", a: "land.a4" },
  { q: "land.q5", a: "land.a5" },
];

function NavBar() {
  const [open, setOpen] = useState(false);
  const { t, dir } = useI18n();

  return (
    <header
      className="sticky top-0 z-50 border-b backdrop-blur bg-white/90"
      style={{ borderColor: "rgba(212,165,52,0.18)" }}
      dir={dir}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <a href="#hero" className="flex items-center gap-2 shrink-0">
          <img src={logoImg} alt="Arabian Group" className="h-9 w-auto object-contain sm:h-10" />
          <span className="hidden text-sm font-bold sm:block" style={{ color: GREEN_MID }}>
            {t("app.name")}
          </span>
        </a>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-gray-600 transition-colors hover:text-[#A87C20]"
            >
              {t(l.label)}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <LangToggle />
          <Link href="/login">
            <Button
              className="font-bold text-white shadow-md"
              style={{
                background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD}, ${GOLD_DARK})`,
              }}
            >
              {t("land.login")}
            </Button>
          </Link>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <LangToggle />
          <button
            className="flex h-9 w-9 items-center justify-center rounded-md"
            style={{ color: GREEN_MID }}
            onClick={() => setOpen((v) => !v)}
            aria-label="menu"
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
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
                {t(l.label)}
              </a>
            ))}
            <Link href="/login">
              <Button
                className="mt-2 w-full font-bold text-white"
                style={{ background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD}, ${GOLD_DARK})` }}
              >
                {t("land.login")}
              </Button>
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

function Hero() {
  const { t, dir } = useI18n();
  return (
    <section
      id="hero"
      dir={dir}
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
        <div className={dir === "rtl" ? "text-center md:text-right" : "text-center md:text-left"}>
          <span
            className="inline-block rounded-full px-4 py-1.5 text-xs font-bold sm:text-sm"
            style={{ background: "rgba(212,165,52,0.15)", color: GOLD_LIGHT, border: `1px solid rgba(212,165,52,0.35)` }}
          >
            {t("app.company")}
          </span>

          <h1 className="mt-6 text-3xl font-extrabold leading-tight text-white sm:text-4xl md:text-5xl">
            {t("land.heroTitle1")}
            <br />
            <span style={{ color: GOLD_LIGHT }}>{t("land.heroTitle2")}</span> {t("land.heroTitle3")}
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/70 sm:text-lg md:mx-0">
            {t("land.heroDesc")}
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row md:justify-start">
            <Link href="/login" className="w-full sm:w-auto">
              <Button
                size="lg"
                className="w-full gap-2 font-bold text-white shadow-lg sm:w-auto"
                style={{ background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD}, ${GOLD_DARK})` }}
              >
                {t("land.loginSystem")}
                <ArrowLeft size={18} style={dir === "ltr" ? { transform: "rotate(180deg)" } : undefined} />
              </Button>
            </Link>
            <a href="#about" className="w-full sm:w-auto">
              <Button
                size="lg"
                variant="outline"
                className="w-full border-white/25 bg-white/5 font-bold text-white hover:bg-white/10 sm:w-auto"
              >
                {t("land.explore")}
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
                {t("dash.controlPanel")}
              </span>
              <span
                className="rounded-full px-3 py-1 text-xs font-bold text-white"
                style={{ background: GOLD }}
              >
                {t("land.live")}
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
                    {t(f.title)}
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
  const { t, dir } = useI18n();
  return (
    <section id="about" dir={dir} className="bg-[#f7f5ef] py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <div
            className="mx-auto mb-4 h-1 w-9 rounded-full"
            style={{ background: `linear-gradient(90deg, ${GOLD}, ${GOLD_LIGHT})` }}
          />
          <h2 className="text-2xl font-extrabold sm:text-3xl md:text-4xl" style={{ color: GREEN_MID }}>
            {t("land.about")}
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-gray-600 sm:text-base">
            {t("land.aboutDesc")}
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
                {t(f.title)}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">{t(f.desc)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqSection() {
  const { t, dir } = useI18n();
  return (
    <section id="faq" dir={dir} className="bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <div
            className="mx-auto mb-4 h-1 w-9 rounded-full"
            style={{ background: `linear-gradient(90deg, ${GOLD}, ${GOLD_LIGHT})` }}
          />
          <h2 className="text-2xl font-extrabold sm:text-3xl md:text-4xl" style={{ color: GREEN_MID }}>
            {t("land.faq")}
          </h2>
          <p className="mt-4 text-sm text-gray-600 sm:text-base">
            {t("land.faqDesc")}
          </p>
        </div>

        <Accordion type="single" collapsible className="mt-10 w-full">
          {FAQ.map((item, i) => (
            <AccordionItem key={i} value={`faq-${i}`} style={{ borderColor: "rgba(212,165,52,0.2)" }}>
              <AccordionTrigger className={`${dir === "rtl" ? "text-right" : "text-left"} text-sm font-bold sm:text-base`} style={{ color: GREEN_MID }}>
                {t(item.q)}
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-gray-600">
                {t(item.a)}
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
  const { t, dir } = useI18n();
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [sending, setSending] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setTimeout(() => {
      toast({ title: t("land.sent"), description: t("land.sentDesc") });
      setForm({ name: "", email: "", message: "" });
      setSending(false);
    }, 500);
  };

  return (
    <section id="contact" dir={dir} className="bg-[#f7f5ef] py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <div
            className="mx-auto mb-4 h-1 w-9 rounded-full"
            style={{ background: `linear-gradient(90deg, ${GOLD}, ${GOLD_LIGHT})` }}
          />
          <h2 className="text-2xl font-extrabold sm:text-3xl md:text-4xl" style={{ color: GREEN_MID }}>
            {t("land.contact")}
          </h2>
          <p className="mt-4 text-sm text-gray-600 sm:text-base">
            {t("land.contactDesc")}
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-8 sm:mt-16 lg:grid-cols-5 lg:gap-10">
          <div className="space-y-4 lg:col-span-2">
            {[
              { icon: Phone, label: t("land.phone"), value: "+966 11 000 0000" },
              { icon: Mail, label: t("land.email"), value: "info@arabiangroup.example" },
              { icon: MapPin, label: t("land.address"), value: t("land.addressValue") },
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
                  {t("land.name")}
                </label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={t("land.namePh")}
                  className="w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-[#D4A534]"
                  style={{ borderColor: "#e8e0cc", background: "#fdfbf6" }}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold" style={{ color: GREEN_MID }}>
                  {t("land.email")}
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
                {t("land.message")}
              </label>
              <textarea
                required
                rows={4}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder={t("land.messagePh")}
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
              {sending ? t("land.sending") : t("land.send")}
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const { t, dir } = useI18n();
  return (
    <footer dir={dir} style={{ background: GREEN_DARK }} className="py-10">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 text-center sm:px-6 lg:px-8">
        <img src={logoImg} alt="Arabian Group" className="h-10 w-auto object-contain opacity-90" />
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="text-xs text-white/60 hover:text-white sm:text-sm">
              {t(l.label)}
            </a>
          ))}
        </nav>
        <p className="text-xs text-white/40">
          © {new Date().getFullYear()} {t("app.company")} — {t("land.rights")}
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
