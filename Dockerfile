# ══════════════════════════════════════════════════════════
#  سيرفر الباك إند (Express + Drizzle) — منفذ 5000
#  البناء من جذر المستودع:  docker build -t ages-api .
# ══════════════════════════════════════════════════════════
# node:22-slim (Debian/glibc) — متسق مع صورة الواجهة وتفاديًا لمشاكل musl
FROM node:22-slim

RUN corepack enable
WORKDIR /app

# نسخ المستودع كاملًا (pnpm workspace يحتاج كل الحزم — .dockerignore يستثني الثقيل)
COPY . .

# تثبيت تبعيات الباك إند وحزمة قاعدة البيانات فقط (يشمل drizzle-kit لدفع المخطط)
RUN pnpm install --no-frozen-lockfile --filter @workspace/api-server... --filter @workspace/db...

# بناء السيرفر (esbuild يحزم @workspace/db من المصدر مباشرة)
RUN pnpm --filter @workspace/api-server run build

# إصلاح نهايات الأسطر لسكربت الإقلاع (في حال البناء من Windows)
RUN sed -i 's/\r$//' docker/api-entrypoint.sh && chmod +x docker/api-entrypoint.sh

EXPOSE 5000
ENTRYPOINT ["/bin/sh", "/app/docker/api-entrypoint.sh"]
