# Comment v2

以應用為隔離單位的多租戶評論系統：API 閘道＋後端服務（NestJS）、操作員控制台（React）、開發者實驗室（React）。術語表見 `CONTEXT.md`；規格見 `docs/spec-comment.md`；技術設計見 `docs/technical-design.md`；ADR 見 `docs/adr/`。

## 架構（local）

```
瀏覽器 ──► Kong :8000 ──► comment-service :3000 ──► PostgreSQL 17 / Redis 7
             │
console :5173 (操作員控制台)
developer-lab :5174 (開發者實驗室)
```

六個 Docker 服務：`postgres`、`redis`、`comment-service`、`kong`、`console`、`developer-lab`。Kong 只做邊界（轉發、JWT、CORS、request ID、rate limit 300/min/IP，Redis-backed）；所有領域邏輯在 `comment-service`。

## 快速開始

需求：Node 22+、pnpm 9.15、Docker。

```bash
pnpm install
docker compose up -d --build   # 或 pnpm local:up
```

| 服務 | URL | 說明 |
| --- | --- | --- |
| Kong API | http://localhost:8000 | 所有 `/v1` 請求經這裡；Swagger UI 在 `/v1/docs` |
| Console | http://localhost:5173 | 操作員控制台（審核、搜尋、封鎖、設定、審計） |
| Developer Lab | http://localhost:5174 | 開發者實驗室（模擬用戶互動、種子資料、完全重置） |

Console 與 Lab 的 local 登入帳號：`operator` / `change-me-local-only`（僅 local 存在）。

Lab 模擬用戶：`author`、`reactor`、`reporter-one`～`reporter-five`、`new-user`（`new-user` 在冷卻期內不能留言，用來驗證冷卻規則）。

## 開發指令

```bash
pnpm check          # 全 workspace typecheck
pnpm test           # 單元測試＋lab 元件測試（vitest）
pnpm test:e2e       # 建 image 並跑 HTTP e2e（經 Kong）
pnpm build          # 全 workspace build（含 openapi.json 生成）
pnpm dev:service    # 本機跑 service（tsx watch，需 DB/Redis）
pnpm dev:console    # console 開發伺服器
pnpm dev:lab        # lab 開發伺服器
pnpm local:down     # 停止
pnpm local:reset    # 刪 volume 重建（危險：清空所有資料）
```

## Repo 結構

```
apps/
  comment-service/   NestJS 11；模組化單體；公開 API＋控制台 API；test/unit + test/e2e
  console/           React 19 + Vite；操作員介面（8 個分頁）
  developer-lab/     React 19 + Vite；互動式留言板＋指南（中／英）；test/lab.spec.tsx
infra/kong/          kong.local.yml（DB-less 宣告式設定）
docs/                spec、user stories、technical design、ADR
```

## 測試與 CI

- 每個功能需求同時要求單元測試與 HTTP e2e 測試；測試名以 user story ID 標註（如 `US-10: rejects whitespace-only comments`）。
- CI（`.github/workflows/ci.yml`）：`pnpm check` → `pnpm test` → `pnpm build`（上傳 openapi.json artifact）→ `pnpm test:e2e`。
- 修改 API 合約時，`openapi.json` 必須在同一個 commit 內更新（build 時自動生成，記得 commit）。

## 重要行為備忘

- 所有 API 必帶 `X-Application-Key`；應用 disabled 時公開 API 一律 404（控制台仍可操作）。
- 檢舉＝per-reporter shadow hide：檢舉主評論 → 該則與其子留言對檢舉者隱藏；其他人不受影響。
- 留言間隔、每日額度、新用戶冷卻期按應用設定，預設 60s / 20 則 / 24h。
- Yidun 機審預設關閉（應用設定可開）；關閉時所有合法留言直接 published。
