# سجل المناقصات — نظام إدارة المناقصات والأعمال التجارية

نظام داخلي متكامل (عربي RTL) لإدارة دورة حياة المناقصات الحكومية بالكامل — من الإعلان والتسعير والتقديم، حتى الترسية والتنفيذ — مع وحدات مساندة للعقود والضمانات والموردين والجهات الحكومية والمالية والنقل والصيانة والإقامات والمراسلات الرسمية.

## أبرز الوحدات

| الوحدة | الوصف |
|---|---|
| المناقصات والممارسات | دورة حياة كاملة بمراحل، فض العطاءات، وتحليل المنافسة |
| ذكاء المنافسين | ترتيب المنافسين، تنبؤ الأسعار الإحصائي، توصيات ذكية، وتنبيهات تلقائية |
| التسعير | أوراق تسعير تفاعلية (بديل Excel) بحساب مركزي للشحن/الجمارك/الأرباح |
| مركز إدارة العمليات | مهام بـ5 طرق عرض (قائمة/Kanban/تقويم/Timeline/Gantt) + مهام يومية ذكية بتكرار تلقائي وإثبات إنجاز |
| الشؤون المالية | إيرادات ومصروفات مرتبطة بكل الوحدات + ميزانيات شهرية للصيانة والنقل |
| إدارة الصيانة | معدات، أوامر صيانة بدورة اعتماد، مستودع قطع غيار، وتقارير زيارات Word مولّدة |
| المراسلات | محرر خطابات رسمية (Tiptap) بترقيم تلقائي وتصدير docx |
| الجهات الحكومية | دليل هرمي: جهة ← إدارة ← مسؤول ← وسائل تواصل |
| البحث والتطوير | مركز معرفة ومواصفات بعزل بيانات لكل موظف (RBAC) |
| إدارة الإقامات | شركات وعمال وتنبيهات انتهاء المستندات |
| النقل والمركبات | أوامر نقل، أسطول، وقود وسيرفس |

## البنية التقنية

| الطبقة | التقنية |
|---|---|
| Monorepo | pnpm workspaces |
| Backend | Express 5 + TypeScript — `artifacts/api-server` |
| Frontend | React 18 + Vite — `artifacts/tender-manager` |
| Database | PostgreSQL 16 (Docker) + Drizzle ORM — `lib/db` |
| Validation | Zod + drizzle-zod |
| State/Data | @tanstack/react-query |
| ملفات Word | docx + docxtemplater |
| رسوم بيانية | recharts |
| تخزين الملفات | تخزين محلي على القرص (بروتوكول presigned-URL داخلي) |

## التشغيل محليًا

المتطلبات: Node.js 20+، pnpm، Docker Desktop.

```bash
# 1) التبعيات
pnpm install

# 2) قاعدة البيانات (PostgreSQL في Docker)
docker run -d --name tender-postgres \
  -e POSTGRES_USER=tender -e POSTGRES_PASSWORD=tender -e POSTGRES_DB=tender_manager \
  -p 5432:5432 postgres:16

# 3) بناء حزمة قاعدة البيانات ودفع المخطط
cd lib/db && npx tsc --build --force
npx drizzle-kit push   # أو طبّق ملفات SQL يدويًا

# 4) الباك إند (منفذ 5000)
cd artifacts/api-server
pnpm run build && node dist/index.mjs
# متغير البيئة المطلوب: DATABASE_URL=postgres://tender:tender@localhost:5432/tender_manager

# 5) الواجهة (منفذ 5173)
cd artifacts/tender-manager
npx vite --port 5173
```

ثم افتح: http://localhost:5173

> **حساب الدخول الافتراضي** (يُزرع تلقائيًا عند أول تشغيل): `admin` / `admin123`
> ⚠️ غيّر كلمة المرور فورًا في أي بيئة غير محلية.

## بنية المستودع

```
artifacts/
  api-server/       # Express API (routes/, middleware/, lib/)
  tender-manager/   # واجهة React (pages/, components/, lib/)
lib/
  db/               # مخطط Drizzle + Zod schemas (schema/*.ts)
  api-spec/         # OpenAPI spec
  api-client-react/ # عميل API مولّد
  object-storage-web/ # hook رفع الملفات المشترك
PROJECT_SUMMARY.md  # ملخص تفصيلي للوحدات والقرارات المعمارية
```

## ملاحظات

- الواجهة عربية RTL بالكامل، والعملة الافتراضية دينار كويتي (3 منازل عشرية).
- الصلاحيات على مستوى الوحدة لكل مستخدم (16+ علم وصول) + أدوار مدير/موظف.
- الملفات المرفوعة تُخزن محليًا في `artifacts/api-server/uploads/` (خارج Git).
