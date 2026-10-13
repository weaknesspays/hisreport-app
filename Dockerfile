# ระบบรายงาน HIS (Next.js standalone) — ดูวิธีใช้ใน DOCKER.md
# build: docker compose build   |   ความลับส่งตอนรันผ่าน .env.docker เท่านั้น (ไม่ฝังใน image)

# ---------- 1) ติดตั้ง dependencies ----------
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------- 1b) dependencies สำหรับรันจริง (ไม่มี dev) ----------
# ใช้แทน node_modules ที่ standalone trace ให้ — trace ตกบางไฟล์ (เช่น generator-function/require.mjs ที่ exceljs ใช้ → Export Excel พัง)
FROM node:22-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
# @next/swc-* (~140MB) ใช้ตอน build เท่านั้น ไม่ต้องอยู่ใน image ที่รันจริง
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force \
 && rm -rf node_modules/@next/swc-*

# ---------- 2) build ----------
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_OUTPUT=standalone
# ฟอนต์ Sarabun (next/font/google) ถูกดาวน์โหลดตอน build → ต้องต่ออินเทอร์เน็ตได้
RUN npm run build

# ---------- 3) image สำหรับรันจริง ----------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    TZ=Asia/Bangkok
RUN apk add --no-cache tzdata \
 && addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=prod-deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# สำหรับสร้าง/อัปเดตตารางตอนเริ่ม container (ไม่ลบข้อมูลเดิม)
COPY --from=builder --chown=nextjs:nodejs /app/db ./db
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts

USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO /dev/null http://127.0.0.1:3000/hisreport-app/login || exit 1

# migrate ทำซ้ำได้ปลอดภัย (CREATE IF NOT EXISTS / INSERT IGNORE) แล้วค่อยเปิดเว็บ
CMD ["sh", "-c", "node scripts/migrate.mjs && exec node server.js"]
