export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <h1 className="text-6xl font-bold text-slate-200 mb-4">404</h1>
      <h2 className="text-2xl font-semibold text-foreground mb-2">الصفحة غير موجودة</h2>
      <p className="text-muted-foreground mb-6 max-w-md">
        عذراً، لم نتمكن من العثور على الصفحة التي تبحث عنها. قد تكون حذفت أو تم تغيير رابطها.
      </p>
      <a href="/" className="inline-flex items-center justify-center h-10 px-6 rounded-md bg-primary text-primary-foreground font-medium shadow-sm hover:bg-primary/90 transition-colors">
        العودة للوحة التحكم
      </a>
    </div>
  );
}
