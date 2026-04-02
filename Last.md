# Uncommitted Changes

## Deleted
- Data/DataHub/ (бүх файлууд)
- Data/Database_Dictionary.md
- Data/Test.ipynb
- Data/Тооцоох харилцагч to DAA.xlsx

## Modified
- .gitignore (Docker файлуудыг gitignore-оос хаслаа)
- package.json (@types/dompurify → devDependencies)
- apps/backend/.gitignore (prisma/migrations хаслаа)
- apps/backend/package.json (ts-node → devDependencies)
- apps/backend/tsconfig.json (forceConsistentCasingInFileNames, noFallthroughCasesInSwitch → true, test glob)
- apps/backend/src/auth/auth.service.ts (guardLogin try-catch-аас гадна зөөсөн)
- apps/backend/src/auth/dto/auth.dto.ts (SignupDto: MinLength(8) + @Matches complexity regex)
- apps/backend/src/clickhouse/clickhouse.service.ts (getClient() хассан)
- apps/nextn/src/app/tools/tailan/_lib/usePagination.ts (MutationObserver style attribute хассан)
- apps/nextn/src/app/tools/tailan/department/page.tsx (year dropdown +100 хассан)
- apps/nextn/src/contexts/AuthContext.tsx (refresh token cookie 30→7 хоног)
- apps/nextn/src/lib/api.ts (network error logout хассан, refresh cookie 30→7)

## New
- .dockerignore
- Dockerfile.dev
- apps/backend/.dockerignore
- apps/backend/Dockerfile
- apps/backend/Dockerfile.dev
- apps/nextn/.dockerignore
- apps/nextn/Dockerfile
- docker-compose.yml (ClickHouse 24.8-alpine, 127.0.0.1, password/JWT required)
- docker-compose.dev.yml (ClickHouse 24.8-alpine)
