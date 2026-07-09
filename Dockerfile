FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml .npmrc ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile --prod=false

FROM base AS builder
WORKDIR /app
# NEXT_PUBLIC_* vars are inlined at build time; .env is dockerignored so the
# value must arrive as a build arg (deploy.sh reads it from the local .env).
ARG NEXT_PUBLIC_INTERNAL_USER_EMAILS=""
ENV NEXT_PUBLIC_INTERNAL_USER_EMAILS=$NEXT_PUBLIC_INTERNAL_USER_EMAILS
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm prisma generate
RUN pnpm build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    npm install -g prisma@6

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/seeds ./seeds
COPY --from=builder /app/docs ./docs
# Costi's knowledge base: fiscal JSONs, CFO playbooks, Saga guide. Read at
# runtime by buildSystemPrompt — without it Costi answers from base prompt
# alone (this exact failure shipped once; see loadJSON's production error).
COPY --from=builder /app/training ./training

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
