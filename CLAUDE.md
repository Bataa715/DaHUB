# CLAUDE.md — Дотоод аудитын системийн хөгжүүлэлтийн заавар

> **Энэ файлыг AI (Claude) автоматаар уншина.** Доорх дүрмүүд нь зөвлөмж БИШ,
> заавал биелүүлэх шаардлага. Дүрэмтэй зөрчилдөх код бичихийн оронд ЗОГСОО,
> хэрэглэгчээс асуу.
>
> **AI-д хандсан үндсэн зарчим:** энэ бол банкны дотоод аудитын прод систем.
> "Ажиллаж байгаа" код хангалттай биш — **архитектурт нийцсэн** байх ёстой.
> Одоо байгаа хэв маягийг дуурай, шинэ хэв маяг зохиох гэж бүү оролд.

---

## 0. Хамгийн түрүүнд — 10 үнэмлэхүй хориглолт

Дараах зүйлсийг **хэзээ ч** бүү хий. Хэрэглэгч шууд хүссэн ч эхлээд эсэргүүц:

1. ❌ **SQL-д хувьсагчийг шууд наах** (`` `WHERE id = '${id}'` ``).
   → Зөвхөн `{name:Type}` параметр ашиглана.
2. ❌ **Controller дотор ClickHouse дуудах.** Бүх өгөгдлийн ажил Service-д.
3. ❌ **Component дотор `axios`/`fetch` шууд дуудах.** Бүх HTTP `lib/api.ts`-д.
4. ❌ **`@UseGuards(JwtAuthGuard)`-гүй шинэ endpoint** нэмэх (нээлттэй байх
   ёстой гэдгийг хэрэглэгч ил хэлээгүй бол).
5. ❌ **ReplacingMergeTree хүснэгтэд хэсэгчилсэн мөр insert хийх** — бусад
   багана хоосорно (§4.4).
6. ❌ **Прод дээрх өгөгдлийн ID/нэрийг код дотор өөрчлөх** (эрхийн id,
   хэлтсийн код, tool id). Эдгээр нь DB-д хадгалагдсан өгөгдөл.
7. ❌ **Нэг tool модулиас нөгөө tool модулийн `_`-тэй файл import хийх** (§5.3).
8. ❌ **`VALID_TOOLS`-д байхгүй эрхийн нэр** ашиглах.
9. ❌ **Frontend-ийн эрхийн шалгалтыг л нэмээд backend-ийнхийг мартах.**
   Хоёулаа заавал (§6).
10. ❌ **Прод алдааны шалтгааныг кодоос таамаглах.** Эхлээд бодит Request URL,
    хариу, backend лог, `system.query_log`-ийг шаард (§9).

---

## 1. Төслийн зураглал

```
apps/
  backend/          NestJS API (порт нь .env-д). ClickHouse-тэй ажиллана.
    src/
      <module>/     Функционал бүр өөрийн модультай (§3)
      clickhouse/   ClickHouseService — DB-тэй ажиллах ЦОР ГАНЦ хаалга
      auth/guards/  JwtAuthGuard, ToolGuard, AdminGuard, SuperAdminGuard
      common/       constants (tools, departments), utils, filters, types
      config/       env.validation.ts, configuration.ts
    python/main.py  Python API tool-уудыг ажиллуулах sandbox runner
  nextn/            Next.js 16 (App Router) + React 19 frontend
    src/
      app/          Маршрутууд (§5.1)
      lib/api.ts    Backend рүү хандах ЦОР ГАНЦ HTTP давхарга
      lib/tools-config.tsx  Хэрэгслийн бүртгэл (sidebar + /tools)
      contexts/     AuthContext, LanguageContext, translations.ts
      components/   Дундын UI (ui/ нь shadcn төрлийн үндсэн бүрдэл)
      proxy.ts      Middleware — маршрутын эрхийн хамгаалалт
```

**Командууд** (repo root дээрээс):

```bash
npm run typecheck     # tsc --noEmit  — өөрчлөлт хийсний ДАРАА заавал
npm run lint          # eslint
npm run test          # backend + frontend vitest
npm run test:backend  # зөвхөн backend
npm run dev           # nx serve nextn
npm run format        # prettier
```

> Код өөрчилсний дараа хамгийн багадаа `npm run typecheck` ажиллуул.
> Тест байгаа модуль засвал `npm run test:backend`-ийг бас ажиллуул.

---

## 2. Хэл, тайлбар бичих хэв маяг

- Кодын **тайлбар монголоор**. Одоо байгаа хэв маягийг дуурай.
- Яагаад ийм шийдэл гаргасныг тайлбарлана — юу хийж байгааг биш.
- Онцгой чухал/эмзэг шийдлийг `[AUDIT]`, `[SEC]`, `[PERF]`, `[ROUTE ORDER]`
  гэх мэт тэмдэглэгээтэй бичдэг уламжлалтай. Ийм тэмдэглэгээтэй тайлбарыг
  **хэзээ ч бүү устга** — тэдгээр нь өмнө нь гарсан бодит доголдлын түүх.
- Хэрэглэгчид харагдах бүх мессеж (алдаа, товчны нэр) **монголоор**.

---

## 3. Backend — модулийн архитектур

### 3.1 Давхарга (хатуу)

```
HTTP хүсэлт
   ↓
Guard      (JwtAuthGuard → ToolGuard/AdminGuard/SuperAdminGuard)
   ↓
DTO        (class-validator — бүх орж ирэх өгөгдөл шалгагдана)
   ↓
Controller (НИМГЭН: зөвхөн route, эрх, DTO, service дуудах, audit log)
   ↓
Service    (ЗУЗААН: бүх бизнес логик, SQL, тооцоолол)
   ↓
ClickHouseService (DB-тэй ажиллах цор ганц хаалга)
```

**Давхарга алгасахыг хориглоно.** Controller-оос `ClickHouseService`-ийг шууд
дуудах, эсвэл Service дотор `@Body()` decorator ашиглах гэх мэт зөрчлийг бүү хий.

### 3.2 Шинэ модуль үүсгэх бүтэц

`apps/backend/src/<нэр>/` дотор:

```
<нэр>.module.ts       @Module({ imports:[ClickHouseModule], controllers, providers })
<нэр>.controller.ts   @Controller("<зам>") + @UseGuards(...)
<нэр>.service.ts      @Injectable()
dto/<нэр>.dto.ts      class-validator-тай DTO
```

Дараа нь `app.module.ts`-ийн `imports`-д нэмнэ.

> ⚠️ **`app.module.ts`-ийн модулийн дараалал утгатай.** `QuizModule` нь
> `MedlegModule`-ээс ӨМНӨ байх ёстой (MedlegController-т `:id` param route
> байгаа тул). Дарааллыг эмх цэгцтэй харагдуулах гэж бүү өөрчил.

### 3.3 ClickHouse-тэй ажиллах

`ClickHouseService`-ийн нийтийн API — өөр аргаар DB рүү бүү хандаж бай:

| Метод | Хэрэглээ |
|---|---|
| `query<T>(sql, params)` | SELECT — мөрийн массив буцаана |
| `insert(table, rows)` | JSONEachRow insert |
| `exec(sql, params)` | DDL / mutation (ALTER, CREATE, DROP) |
| `replaceRows(table, where, params, rows)` | UPDATE эрхгүй тул DELETE+INSERT |
| `queryAcl` / `execAcl` | Зөвхөн ACL (CREATE USER, GRANT) — тусдаа client |
| `nowCH()` | ClickHouse-ийн DateTime формат (`YYYY-MM-DD HH:MM:SS`) |
| `uuid()` | Мөрийн id |

**Параметржүүлэлт — үл хэлэлцэх дүрэм:**

```ts
// ✅ ЗӨВ
await this.clickhouse.query<Row>(
  `SELECT id, name FROM users WHERE departmentId = {deptId:String} LIMIT {lim:UInt32}`,
  { deptId, lim: 100 },
);

// ❌ БУРУУ — SQL injection
await this.clickhouse.query(`SELECT * FROM users WHERE id = '${id}'`);
```

Хүснэгт/баганын НЭР нь параметр болж чаддаггүй. Шаардлагатай бол:
- зөвхөн код дотор бичигдсэн (hardcoded) нэр ашиглах, эсвэл
- `replaceRows`-ийн адил `/^[a-zA-Z_][a-zA-Z0-9_]*$/` regex-ээр шалгах.

### 3.4 ReplacingMergeTree — ХАМГИЙН ТҮГЭЭМЭЛ АЛДАА

`users`, `access_grants`, `medleg_quizzes`, `avlaga_verifications` гэх мэт олон
хүснэгт `ReplacingMergeTree(<хувилбарын багана>)` engine-тэй (ихэвчлэн
`updatedAt`, `access_grants` дээр `grantedAt`). Энэ нь:

- **Шинэчлэх = бүтэн мөрийг дахин insert хийх.** Хэрэв зөвхөн 2 талбар
  явуулбал үлдсэн бүх багана **хоосон утгаар дарагдана**.
- Унших үед `FINAL` (эсвэл `ORDER BY updatedAt DESC LIMIT 1`) хэрэглэнэ.

```ts
// ✅ ЗӨВ — эхлээд одоогийн мөрийг уншиж, бүтнээр нь бичнэ
const [existing] = await this.clickhouse.query(
  `SELECT * FROM users FINAL WHERE id = {id:String} LIMIT 1`, { id });
await this.clickhouse.insert("users", [
  buildUsersTableRow(existing, { isActive: 0 }),   // ← туслах функц
]);

// ❌ БУРУУ — нэр, эрх, зураг бүгд алга болно
await this.clickhouse.insert("users", [{ id, isActive: 0 }]);
```

`users` хүснэгтийн хувьд **заавал** `buildUsersTableRow()`
([common/utils/user-utils.ts](apps/backend/src/common/utils/user-utils.ts))
ашиглана. Шинэ багана нэмэх бол энэ функцэд бас нэмнэ.

### 3.5 Хүснэгт үүсгэх / багана нэмэх

DDL-ийн хоёр байршил бий, аль нэгийг нь сонго — хоёуланд нь бүү бич:

1. **Үндсэн, апп даяарх хүснэгтүүд** →
   [clickhouse.service.ts](apps/backend/src/clickhouse/clickhouse.service.ts)-ийн
   `onModuleInit` доторх `CREATE TABLE IF NOT EXISTS` блокууд.
2. **Модулийн өөрийн хүснэгт** → тухайн Service-ийн `onModuleInit`
   (жишээ: `risk-assessment.service.ts`, `python-api.service.ts`).

**Байгаа хүснэгтэд багана нэмэх:** `CREATE TABLE IF NOT EXISTS` нь байгаа
хүснэгтийг ӨӨРЧИЛДӨГГҮЙ. Тиймээс DDL-д нэмэхээс гадна **заавал**:

```ts
await this.exec(
  `ALTER TABLE <table> ADD COLUMN IF NOT EXISTS <col> <Type> DEFAULT <утга>`,
  undefined, 1, true,   // silent
).catch(() => {});
```

**Багана устгах — дараалал чухал:** эхлээд **кодоос** хас (DDL мөр, insert
объектын талбар, `ALTER … ADD COLUMN` self-heal мөр, parser), deploy хий,
дараа нь DB дээр `ALTER TABLE … DROP COLUMN IF EXISTS`. Эсрэг дараалал нь
прод дээр insert-ийг унагана (байхгүй багана руу утга явуулна).
Мөн `is_in_sorting_key` / `is_in_primary_key` = 1 багана DROP хийгддэггүй —
`system.columns`-оос урьдчилан шалга.

### 3.6 Эрхийн систем

```ts
@Controller("zainii-audit")
@UseGuards(JwtAuthGuard, ToolGuard)          // 1) нэвтэрсэн 2) эрхтэй
@RequireTools("zainii_audit_rpt", "zainii_audit_expense")  // controller түвшин: аль нэг нь
export class ZainiiAuditController {
  @RequireTools("zainii_audit_rpt")          // route түвшин: нарийвчилна
  @Post("related-party-transactions")
  ...
}
```

Дүрмүүд:

- **Эрхийн шинэ id-г заавал `VALID_TOOLS`-д нэмнэ**
  ([common/constants/tools.ts](apps/backend/src/common/constants/tools.ts)).
  Тэнд байхгүй id олгох боломжгүй.
- `isAdmin` / `isSuperAdmin` нь `ToolGuard`-ыг давдаг (bypass).
- Админы хэсэг: `@UseGuards(JwtAuthGuard, SuperAdminGuard)`.
- **Эрхийн id-г хэзээ ч бүү сольж бичээрэй** — тэдгээр нь `users.allowedTools`
  дотор JSON болж хадгалагдсан бодит өгөгдөл. Нэрийг өөрчилбөл бүх хэрэглэгч
  эрхээ алдана.

### 3.7 DTO ба валидаци

Бүх `@Body()` заавал DTO класстай, class-validator-тай байна. Алдааны мессеж
монголоор:

```ts
export class ExampleDto {
  @IsDateString({}, { message: "Огноо буруу байна" })
  startDate: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: "Дүн тоо байх ёстой" })
  @Min(0)
  minAmount?: number;
}
```

Хязгаар (`@ArrayMaxSize`, `@Max`, `@MaxLength`) тавих нь заавал —
хязгааргүй оролт нь ClickHouse-ийн хүнд query болж 500 алдаа өгдөг.

### 3.8 Алдаа шийдвэрлэх

- Хэрэглэгчийн буруутай оролт → `BadRequestException("монгол мессеж")`
- Эрхгүй → `ForbiddenException(...)`, олдоогүй → `NotFoundException(...)`
- **`HttpException` биш алдаа шидвэл клиентэд `500 Internal server error`
  л очно** ([AllExceptionsFilter](apps/backend/src/common/filters/http-exception.filter.ts)).
  Хэрэглэгчид утгатай мессеж хүргэх ёстой бол зөв exception сонго.
- Алдааг залгих (`catch {}`) нь зөвхөн үнэхээр хамаагүй үед (audit log бичилт,
  idempotent DDL). Бусад тохиолдолд `throw` хийнэ.

### 3.9 Audit log

Хэрэглэгчийн төлөв өөрчилдөг үйлдэл (үүсгэх/засах/устгах/эрх олгох) бүрт
`AuditLogService.log(...)` дуудна — ихэвчлэн Controller-оос:

```ts
await this.auditLog.log({
  userId: user.id,
  action: "update",
  resource: "department",
  resourceId: id,
  method: "PATCH",
  status: "success",
});
```

### 3.10 Маршрутын нэршил (прод дээр эмзэг)

Шинэ `@Controller("...")` prefix нэмэх нь **прод дээр автоматаар ажиллахгүй** —
nginx нь Nest-ийн зам бүрийг тусад нь чиглүүлдэг тул шинэ prefix бүрд nginx
тохиргоо хэрэгтэй. Мөн `monitoring`, `metrics`, `status`, `health` гэх мэт
дэд бүтцийн түгээмэл нэр сонгож болохгүй (`/monitoring` нь өмнө нь reverse
proxy-д булаагдаж 404 өгч байсан — иймээс `zainii-audit` болгож нэрлэсэн).

**Шинэ prefix нэмэхээсээ өмнө:** байгаа модульд route нэмэх боломжтой эсэхийг
шалга. Заавал шинэ prefix хэрэгтэй бол хэрэглэгчид "nginx дээр
`location /<prefix>/` нэмэх шаардлагатай" гэдгийг ил хэл.

---

## 4. Backend — өөрчлөхөд онцгой болгоомжтой байх газрууд

Дараах файлуудыг засахаасаа өмнө **заавал хэрэглэгчээс зөвшөөрөл ав**:

| Файл | Яагаад |
|---|---|
| `auth/auth.service.ts` | Токен эргэлт (rotation), brute-force түгжээ |
| `clickhouse/clickhouse.service.ts` | Бүх хүснэгтийн DDL + миграц |
| `db-access/*` | Аудиторуудад ClickHouse эрх олгодог — AES шифрлэлт |
| `python-api/*` + `python/main.py` | Хэрэглэгчийн Python код ажиллуулдаг sandbox |
| `main.ts` | CORS, helmet, trust proxy, body limit |
| `config/env.validation.ts` | Startup дээр орчны хувьсагч шалгадаг |
| `common/constants/tools.ts` | Эрхийн жагсаалт |

---

## 5. Frontend — модулийн архитектур

### 5.1 App Router-ийн бүтэц ба `_` дүрэм

```
app/tools/<tool-нэр>/
  page.tsx              ← маршрут (заавал энэ нэртэй)
  _access.ts            ← эрхийн hook (маршрут БИШ)
  _SomeTool.tsx         ← зөвхөн энэ tool-ын component
  _lib/helper.ts        ← зөвхөн энэ tool-ын логик
  _hooks/useX.ts        ← зөвхөн энэ tool-ын hook
  sub-page/page.tsx     ← дэд маршрут
```

- **`_`-ээр эхэлсэн файл/фолдер нь маршрут үүсгэдэггүй** (Next.js private
  folder). Модулийн дотоод хэсгийг заавал `_`-тэй нэрлэ.
- Нэг tool-д хамаарах бүх зүйл түүний фолдерт байрлана (colocation).
  `components/` руу бүү зөө — тэнд зөвхөн **олон tool** хуваалцдаг зүйл.
- Файл 400-500 мөр давбал `_`-тэй дэд файл болгон хуваа (жишээ:
  `tools/risk-assessment/_report-view/`).

### 5.2 HTTP давхарга — `lib/api.ts` цор ганц

```ts
// lib/api.ts дотор — домэйн бүрт нэг объект.
// ⚠️ Конвенц: функц нь axios хариуг БИШ, `res.data`-г шууд буцаана.
export interface RelatedPartyRequest { customerIds: string[]; startDate: string; endDate: string }
export interface RelatedPartyResult { accounts: […]; transactions: […]; summary: […] }

export const zainiiAuditRptApi = {
  findRelatedPartyTransactions: async (
    req: RelatedPartyRequest,
  ): Promise<RelatedPartyResult> => {
    const res = await api.post("/zainii-audit/related-party-transactions", req, {
      timeout: TIMEOUT_LONG,   // хүнд scan → урт timeout
    });
    return res.data;
  },
};

// Component дотор — задлах шаардлагагүй
const result = await zainiiAuditRptApi.findRelatedPartyTransactions(req);
```

Дүрмүүд:

- Component дотор `axios`/`fetch` шууд бичихийг **хориглоно**.
- Шинэ endpoint нэмэхдээ тохирох `<домэйн>Api` объектод нэм; байхгүй бол шинэ
  объект үүсгэ (`export const xxxApi = { ... }`).
- Хүсэлт/хариуны `interface`-ийг `api.ts`-д тодорхойл — backend-ийн буцаадаг
  бодит бүтэцтэй тааруул.
- Удаан endpoint (docx үүсгэх, хүнд scan) → `{ timeout: TIMEOUT_LONG }`.
- Алдааны текст авахдаа `getApiErrorMessage(e)` ашигла.
- **401-ийн silent refresh логикт бүү хүр** — `refreshSession()` нь нэг
  in-flight promise хуваалцдаг; үүнийг эвдвэл "токен дахин дахин дуудагдаад
  апп гацдаг" алдаа эргэж ирнэ.

### 5.3 Модуль хоорондын хамаарал

```
✅ tool → lib/api.ts, contexts/*, components/ui/*, components/shared/*
✅ tool → өөрийн _файлууд
❌ tool A → tool B-ийн _файл руу import
```

Хоёр tool ижил кодыг хэрэглэх болбол `lib/` эсвэл `components/shared/`-д
гарга — нөгөө tool-ын дотоод файлаас бүү import хий.

### 5.4 Эрх — хоёр давхар

1. **`proxy.ts`** — маршрутын түвшин. Шинэ хамгаалалттай хуудас нэмбэл
   `TOOL_GUARDS` (эсвэл `SUPERADMIN_ROUTES`)-д зам нэм.
2. **`_access.ts` hook** — хуудас доторх UI-г шүүх (жишээ:
   [tools/zainii-audit/_access.ts](apps/nextn/src/app/tools/zainii-audit/_access.ts)).
   Админ/супер админд бүх зүйл нээлттэй — `ToolGuard`-тай ижил дүрэм.

> ⚠️ Frontend-ийн эрх нь зөвхөн UI цэгцлэх зорилготой. **Жинхэнэ хамгаалалт
> backend дээрх `@RequireTools`.** Frontend-д шалгаад backend-д мартвал
> хамгаалалт байхгүйтэй адил.

### 5.5 Хэрэгслийн бүртгэл

Шинэ tool-ыг [lib/tools-config.tsx](apps/nextn/src/lib/tools-config.tsx)-ийн
`getTools()`-д нэмнэ — Sidebar болон `/tools` хуудас хоёулаа эндээс уншина.
`id` нь backend-ийн эрхийн id-тай яг таарна (олон эрхийн аль нэг хангалттай
бол `matchIds`).

### 5.6 Орчуулга

Шинэ текстийг [contexts/translations.ts](apps/nextn/src/contexts/translations.ts)-д
нэмнэ:

- **`mn` болон `en` ХОЁУЛАНД нэм.** `TranslationKey` нь `mn`-ээс гаралтай тул
  `en`-д дутуу бол ажиллах үед `undefined` буцаана.
- Component дотор `const { t } = useLanguage()` → `t("myKey")`.
- Хатуу бичсэн (hardcoded) монгол текстийг шинэ код дээр бүү үлдээ.

### 5.7 Client vs Server component

- Hook (`useState`, `useEffect`, `useAuth`, `useLanguage`) ашиглах бүх файлын
  эхэнд `"use client"`.
- `app/api/**/route.ts` (BFF) нь зөвхөн дараах тохиолдолд:
  сервер талын нууц хэрэгтэй, binary/зураг proxy хийх, эсвэл backend-ийн
  хариуг ижил origin-оор буцаах шаардлагатай үед. Ердийн JSON дуудлагыг
  `lib/api.ts`-ээр шууд backend руу явуул.
- BFF route дотор: `getApiAuth(req)`-ээр эрх шалгаж,
  `getServerBackendUrl()`-ээр backend хаягийг ав.

---

## 6. Шинэ хэрэгсэл (tool) нэмэх — бүрэн чеклист

Аль нэг алхмыг алгасвал систем хагас ажиллана. Дарааллаар нь:

**Backend**
1. `common/constants/tools.ts` → `VALID_TOOLS`-д шинэ id нэм.
2. `src/<нэр>/` модуль үүсгэ (module + controller + service + dto).
3. Controller дээр `@UseGuards(JwtAuthGuard, ToolGuard)` + `@RequireTools("<id>")`.
4. `app.module.ts`-д модулиа нэм.
5. Хүснэгт хэрэгтэй бол Service-ийн `onModuleInit`-д DDL.
6. Төлөв өөрчилдөг үйлдэлд `AuditLogService.log(...)`.

**Frontend**
7. `lib/api.ts` → `export const <нэр>Api = { ... }`.
8. `app/tools/<нэр>/page.tsx` + `_`-тэй дотоод файлууд.
9. `proxy.ts` → `TOOL_GUARDS`-д `"/tools/<нэр>": ["<id>"]`.
10. `lib/tools-config.tsx` → `getTools()`-д карт нэм.
11. `contexts/translations.ts` → `mn` + `en` текст.

**Дэд бүтэц**
12. Шинэ backend prefix бол nginx тохиргоо хэрэгтэйг хэрэглэгчид сануул.

**Шалгалт**
13. `npm run typecheck && npm run lint`.

---

## 7. Өгөгдлийн сангийн зохион байгуулалт

- **`audit_db`** — аппын өөрийн бааз (users, medleg, access_*, risk_*, …).
  Апп бичдэг, уншдаг.
- **`FINACLE`, `ERP`, `EBANK`, `CARDZONE`** — эх банкны системүүдээс хуулагдсан
  бааз. **Зөвхөн уншина.** Эдгээрт хэзээ ч INSERT/ALTER бүү хий.
- **`avlaga`, `tulbur`, `budget`, `havsralt`** — гадны ETL loader (энэ репод
  БАЙХГҮЙ) дүүргэдэг. Схемийг нь өөрчлөх нь ETL-ийг унагаж болзошгүй.

Хүснэгт/багана устгах, нэр солихыг **шалгах → нөөцлөх → устгах** дарааллаар
гүйцэтгэ: (1) `system.parts`, `system.query_log`, `system.columns`-оор
ашиглалтыг батал, (2) `RENAME TABLE … TO zz_deprecated_*` эсвэл нөөц хүснэгт
рүү хуулж ав, (3) дараа нь л `DROP`. Шууд `DROP` хийхийг хориглоно.

> Санамж: `python_api_tools.pythonCode` нь **ClickHouse дотор** хадгалагддаг
> Python код. Тиймээс "репод хайхад олдсонгүй" гэдэг нь "ашиглагддаггүй"
> гэсэн үг БИШ — DB-г бас шалга.

---

## 8. Тест

- Backend: `apps/backend/**/*.spec.ts` (vitest). Бизнес логик, эрхийн шалгалт,
  ID үүсгэх дүрэм гэх мэт цэвэр функцүүдийг тестлэдэг.
- Логик өөрчилсөн бол тухайн модулийн spec-ийг шинэчил; шинэ цэвэр функц
  бичсэн бол тест нэм.
- Тест унагаасан бол **тестийг өөрчилж "зассан" болгож болохгүй** — эхлээд
  кодын алдааг ол.

---

## 9. Прод дээрх алдаа шинжлэх

Кодоос таамаглахын оронд **бодит нотолгоог эхлээд шаард**:

1. Бодит **Request URL + HTTP method + хариуны body** (мөн `X-Request-Id`).
2. Backend лог: `Unhandled error on <METHOD> <URL>` эсвэл
   `ClickHouse query error: ...` мөр.
3. ClickHouse-ийн `system.query_log` — `exception`, `query_duration_ms`,
   `memory_usage`.

Эдгээргүйгээр "магадгүй nginx…", "магадгүй эрх…" гэж таамаглах нь цаг
алдуулдаг. Дэд бүтцийн зан төлөвийг (nginx маршрут, proxy) кодоос дүгнэж
болохгүй.

Түгээмэл шалтгаанууд: ClickHouse client-ийн `request_timeout: 60_000`-оос
хэтэрсэн хүнд query, memory limit, `@RequireTools` эрх дутуу, ReplacingMergeTree
дээр `FINAL` мартсанаас хуучин мөр буцаах.

---

## 10. AI-ийн ажиллах горим

- **Өөрчлөхөөсөө өмнө унш.** Ижил төстэй байгаа модулийг олж, түүний хэв
  маягийг дуурай. Шинэ загвар зохиох нь техникийн өр.
- **Хамрах хүрээг бүү өргөсгө.** Хүссэн зүйлийг хий; "энэ дашрамд цэвэрлэлээ"
  гэж хажуугийн файл бүү өөрчил.
- **Тодорхойгүй бол асуу** — ялангуяа: өгөгдөл устгах, схем өөрчлөх, эрхийн
  логик, auth, прод дэд бүтэц.
- **Хийснээ үнэн зөв тайлагна.** Тест унасан бол унасан гэж хэл. Шалгаагүй
  бол "шалгасан" гэж бүү хэл.
- **Устгах/дарж бичихээсээ өмнө** тухайн файл/багана/хүснэгтийг эхлээд хар.
- Git commit / push-ийг хэрэглэгч ил хүсээгүй бол бүү хий.
