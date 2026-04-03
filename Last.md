# Last Session Summary — 2026-04-03

## RAG Chat — UI/Layout засвар
- `apps/nextn/src/app/tools/rag-chat/page.tsx`
  - Давхардсан `export default` (843 мөр → 464 мөр) устгасан
  - Layout: `height:100dvh` → `position:fixed; inset:0; z-index:60` болгосон (site header/padding давхцалт засагдсан)
  - `scrollToBottom()` — зөвхөн `messages.length > 0` үед ажиллахаар засагдсан (empty state-д буруу scroll хийдэг байсан)
  - **3D animated bot character** нэмсэн (CSS animation: float, eye blink, LED mouth, glow ring)
  - Sidebar layout: doc management + toggle, Ollama status indicator

## Docker — Ollama + DataDoc засвар
- `docker-compose.yml`
  - Backend: `OLLAMA_BASE_URL=http://host.docker.internal:11434`, `OLLAMA_MODEL=llama3`, `extra_hosts: host.docker.internal:host-gateway` нэмсэн
  - Frontend: `MD_FILE_PATH=/app/Data/Database_Dictionary.md` env, `./Data:/app/Data` volume mount нэмсэн

## Docker build хурдасгалт
- `apps/nextn/Dockerfile` дахин бичигдсэн:
  - `COPY source` → `npm ci` давталтаас зайлсхийж, `package.json` тусдаа layer болгосон
  - `--mount=type=cache,target=/root/.npm` (npm registry cache)
  - `--mount=type=cache,target=/app/apps/nextn/.next/cache` (Next.js incremental build cache)

## TypeScript засвар
- `apps/nextn/tsconfig.json`: `../../.next/types/**/*.ts` буруу зам устгасан
- `apps/backend/tsconfig.json`: `rootDir: "./src"` нэмсэн, `baseUrl` устгасан (paths-гүй тул хэрэггүй)
- `apps/nextn/tsconfig.json` + `apps/backend/tsconfig.json`: `ignoreDeprecations` нэмэхгүй болсон (TS 5.9.3-д хэрэггүй)

## VS Code тохиргоо
- `.vscode/settings.json`: `"typescript.tsdk": "node_modules/typescript/lib"` нэмсэн (bundled TS-ийн оронд workspace TS 5.9.3 ашиглах → baseUrl deprecation анхааруулга гарахгүй)

## Prettier / Type check
- `tsc --noEmit` — frontend ✅ 0 алдаа, backend ✅ 0 алдаа
- Prettier — 25+ файл форматлагдсан
