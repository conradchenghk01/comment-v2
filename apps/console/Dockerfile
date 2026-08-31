FROM node:22-alpine AS build
WORKDIR /workspace
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/console/package.json apps/console/package.json
RUN pnpm install --frozen-lockfile
COPY apps/console apps/console
RUN pnpm --filter @comment/console build
RUN pnpm --filter @comment/console deploy --prod /output
FROM nginx:1.27-alpine
COPY --from=build /output/dist /usr/share/nginx/html