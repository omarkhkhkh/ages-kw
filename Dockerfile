# ══════════════════════════════════════════════════════════
#  التطبيق كاملًا في خدمة واحدة (API + واجهة الموقع) — منفذ 5000
#  السيرفر يقدّم الواجهة المبنية بنفسه، فلا حاجة لخدمة nginx منفصلة.
#  البناء من جذر المستودع:  docker build -t ages-app .
# ══════════════════════════════════════════════════════════
# node:22-slim (Debian/glibc) وليس alpine — تفاديًا لخلل اكتشاف musl في pnpm
FROM node:22-slim

RUN corepack enable
WORKDIR /app

# نسخ المستودع كاملًا (pnpm workspace يحتاج كل الحزم — .dockerignore يستثني الثقيل)
COPY . .

# تثبيت كامل (بدون فلترة — الفلترة تُسقط ربط peer dependencies لحزم الـworkspace)
RUN pnpm install --no-frozen-lockfile

# بناء السيرفر (esbuild) ثم الواجهة (vite) ونسخها لمجلد public الذي يقدّمه السيرفر
RUN pnpm --filter @workspace/api-server run build
RUN cd artifacts/tender-manager && pnpm exec vite build \
    && rm -rf ../api-server/public && cp -r dist ../api-server/public

# إصلاح نهايات الأسطر لسكربت الإقلاع (في حال البناء من Windows)
RUN sed -i 's/\r$//' docker/api-entrypoint.sh && chmod +x docker/api-entrypoint.sh

EXPOSE 5000
ENTRYPOINT ["/bin/sh", "/app/docker/api-entrypoint.sh"]
