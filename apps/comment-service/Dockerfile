FROM node:22-alpine AS build
WORKDIR /workspace
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/comment-service/package.json apps/comment-service/package.json
RUN pnpm install --frozen-lockfile
COPY apps/comment-service apps/comment-service
RUN pnpm --filter @comment/service build
RUN pnpm --filter @comment/service deploy --prod /output

FROM node:22-alpine
WORKDIR /app
COPY --from=build /output ./
EXPOSE 3000
CMD ["node", "dist/main.js"]