# Uncommitted Changes

## Deleted
- Data/DataHub/ (бүх файлууд)
- Data/Test.ipynb
- Data/Тооцоох харилцагч to DAA.xlsx
- DataDoc/ (standalone апп — монорепод бүрэн шилжсэн тул устгасан)
- RAG/ (standalone апп — монорепод бүрэн шилжсэн тул устгасан)
- .env.example

## Modified
- .gitignore (Docker файлуудыг gitignore-оос хаслаа)
- package.json (@types/dompurify → devDependencies)
- apps/backend/.gitignore (prisma/migrations хаслаа)
- apps/backend/Dockerfile (шинэчилсэн)
- apps/backend/package.json (jest, ts-jest, @types/jest, @nestjs/testing устгасан; @types/multer буцааж нэмсэн; test scripts хассан)
- apps/backend/tsconfig.json (forceConsistentCasingInFileNames, noFallthroughCasesInSwitch → true)
- apps/backend/src/app.module.ts (RagChatModule нэмсэн)
- apps/backend/src/auth/auth.service.ts (guardLogin try-catch-аас гадна зөөсөн)
- apps/backend/src/auth/dto/auth.dto.ts (SignupDto: MinLength(8) + @Matches complexity regex)
- apps/backend/src/clickhouse/clickhouse.service.ts (getClient() хассан)
- apps/nextn/src/app/tools/page.tsx (rag-chat, data-doc tool картууд нэмсэн)
- apps/nextn/src/app/tools/tailan/_lib/usePagination.ts (MutationObserver style attribute хассан)
- apps/nextn/src/app/tools/tailan/department/_WordPreview.tsx (шинэчилсэн)
- apps/nextn/src/middleware.ts (шинэчилсэн)
- apps/nextn/src/contexts/AuthContext.tsx (refresh token cookie 30→7 хоног)
- apps/nextn/src/lib/api.ts (network error logout хассан, refresh cookie 30→7)
- docker-compose.yml (шинэчилсэн)

## New
- Data/Database_Dictionary.md (DataDoc-оос хуулсан — ClickHouse баазын баримт бичиг)
- .dockerignore
- Dockerfile.dev
- apps/backend/.dockerignore
- apps/backend/Dockerfile
- apps/backend/Dockerfile.dev
- apps/backend/src/rag-chat/ (RAG chat модуль: document, embedding, ollama, rag, vector-store, chat)
- apps/nextn/.dockerignore
- apps/nextn/Dockerfile
- apps/nextn/src/app/api/schema/ (Database Dictionary API route)
- apps/nextn/src/app/tools/data-doc/ (DataDoc tool: schema browser, inline editing)
- apps/nextn/src/app/tools/rag-chat/ (RAG Chat tool: LLM chat UI)
- apps/nextn/src/lib/data-doc-types.ts
- apps/nextn/src/lib/schema-parser.ts
- docker-compose.yml (ClickHouse 24.8-alpine, 127.0.0.1, password/JWT required)
- docker-compose.dev.yml (ClickHouse 24.8-alpine)
