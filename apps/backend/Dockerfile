FROM node:20-slim
WORKDIR /app

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@9

# Install deps — workspace aware
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/ ./packages/

RUN pnpm install --frozen-lockfile --filter @gai/backend...

# Copy source
COPY apps/backend ./apps/backend
COPY packages ./packages

# Generate Prisma client
RUN cd apps/backend && npx prisma generate

WORKDIR /app/apps/backend
EXPOSE 3001
CMD ["npx", "tsx", "src/server.ts"]
