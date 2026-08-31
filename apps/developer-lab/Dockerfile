FROM node:22-alpine AS build
WORKDIR /workspace
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/developer-lab/package.json apps/developer-lab/package.json
RUN pnpm install --frozen-lockfile
COPY apps/developer-lab apps/developer-lab
RUN pnpm --filter @comment/developer-lab build
RUN pnpm --filter @comment/developer-lab deploy --prod /output
FROM nginx:1.27-alpine
COPY --from=build /output/dist /usr/share/nginx/html