# Internal Audit — Тохиргоо & Ажиллуулах заавар

---

## Агуулга

1. [Төслийн бүтэц](#1-төслийн-бүтэц)
2. [ENV файлууд — юуг хаана өөрчлөх](#2-env-файлууд--юуг-хаана-өөрчлөх)
3. [Docker — хөгжүүлэлтийн орчин (dev)](#3-docker--хөгжүүлэлтийн-орчин-dev)
4. [Docker — production орчин](#4-docker--production-орчин)
5. [Docker ашиглахгүйгээр (local bare-metal)](#5-docker-ашиглахгүйгээр-local-bare-metal)
6. [Тест & format](#6-тест--format)
7. [Нийтлэг алдаа & шийдэл](#7-нийтлэг-алдаа--шийдэл)

---

## 1. Төслийн бүтэц

```
Internal Audit/
├── docker-compose.yml          ← Production Docker
├── docker-compose.dev.yml      ← Development Docker (hot-reload)
├── Dockerfile.dev              ← Frontend dev container
├── .env.example                ← ROOT ENV загвар (эхлээд уншина уу!)
│
├── apps/
│   ├── backend/                ← NestJS API сервер (port 3001)
│   │   ├── Dockerfile          ← Production build
│   │   ├── Dockerfile.dev      ← Dev hot-reload
│   │   ├── .env                ← Backend local dev ENV (git-д байхгүй)
│   │   └── .env.example        ← Backend ENV загвар
│   │
│   └── nextn/                  ← Next.js frontend (port 9002)
│       ├── Dockerfile          ← Production build
│       ├── .env.local          ← Frontend local dev ENV (git-д байхгүй)
│       └── .env.local.example  ← Frontend ENV загвар
```

---

## 2. ENV файлууд — юуг хаана өөрчлөх

### ⚡ Хамгийн чухал дүрэм

> **IP/URL өөрчлөхөд зөвхөн НЭГ файлд** өөрчлөлт хийнэ —
> **Docker ашиглах үед** → `/.env` (root)
> **Local ажиллуулах үед** → хоёр тусдаа файл (доор тайлбарласан)

---

### 2.1 Docker ашиглах үед → root `.env`

```bash
# root/.env файл үүсгэх (загвараас хуулах)
copy .env.example .env
```

`.env` файлд өөрчлөх утгууд:

| Хувьсагч | Утга | Тайлбар |
|---|---|---|
| `BACKEND_URL` | `http://192.168.1.100:3001` | Backend сервер/IP (browser-с харагдах) |
| `FRONTEND_URL` | `http://192.168.1.100:9002` | Frontend URL (CORS-д зөвшөөрөх) |
| `JWT_SECRET` | `<32+ тэмдэгт>` | **Заавал өөрчлөх!** Random урт мөр |
| `CLICKHOUSE_USER` | `default` | ClickHouse хэрэглэгч |
| `CLICKHOUSE_PASSWORD` | `<нууц үг>` | ClickHouse нууц үг (production дээр тавих) |
| `CLICKHOUSE_DATABASE` | `audit_db` | DB нэр (өөрчлөх шаардлагагүй) |
| `PORT` | `3001` | Backend порт |
| `NODE_ENV` | `production` | Орчин |

> ⚠️ `localhost` ашиглаж болохгүй — `BACKEND_URL` нь **browser-с** хандах боломжтой IP байх ёстой.
> Docker container дотор container хоорондын холбоо автоматаар шийдэгддэг.

---

### 2.2 Local (Docker-гүй) ажиллуулах үед — 2 тусдаа файл

**Backend** (`apps/backend/.env`):
```bash
copy apps\backend\.env.example apps\backend\.env
```

```dotenv
PORT=3001
NODE_ENV=development
JWT_SECRET=<32+ тэмдэгт оруулна>
CORS_ORIGINS=http://localhost:9002     # Frontend URL
CLICKHOUSE_HOST=http://localhost:8123  # ClickHouse хаяг
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=
CLICKHOUSE_DATABASE=audit_db
```

**Frontend** (`apps/nextn/.env.local`):
```bash
copy apps\nextn\.env.local.example apps\nextn\.env.local
```

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:3001   # Backend хаяг
```

---

## 3. Docker — хөгжүүлэлтийн орчин (dev)

`docker-compose.dev.yml` ашиглана. **Онцлог:**
- Source код volume mount → файл хадгалахад автоматаар reload
- Windows дээр `WATCHPACK_POLLING` + `CHOKIDAR_USEPOLLING` идэвхтэй
- ClickHouse container оролцсон

### Ажиллуулах

```bash
# 1. Env файл бэлдэх (нэг удаа)
copy .env.example .env
# .env файлд JWT_SECRET заавал өөрчилнө

# 2. Container-уудыг эхлүүлэх
docker-compose -f docker-compose.dev.yml up --build

# 3. Ажиллаж байгааг шалгах
# Frontend: http://localhost:9002
# Backend:  http://localhost:3001/health
# Swagger:  http://localhost:3001/api/docs
```

### Зогсоох

```bash
docker-compose -f docker-compose.dev.yml down
```

### Зөвхөн нэг service дахин эхлүүлэх

```bash
docker-compose -f docker-compose.dev.yml restart backend
docker-compose -f docker-compose.dev.yml restart frontend
```

### Log харах

```bash
docker-compose -f docker-compose.dev.yml logs -f backend
docker-compose -f docker-compose.dev.yml logs -f frontend
```

### Dev container-уудын үүрэг

| Service | Port | Тайлбар |
|---|---|---|
| `clickhouse` | 8123, 9000 | ClickHouse DB — өгөгдөл хадгалдаг |
| `backend` | 3001 | NestJS API — hot-reload идэвхтэй |
| `frontend` | 9002 | Next.js UI — hot-reload идэвхтэй |

> ClickHouse өгөгдөл `clickhouse-data` Docker volume-д хадгалагдана (container устгахад алдагдахгүй).

---

## 4. Docker — production орчин

`docker-compose.yml` ашиглана. **Онцлог:**
- Optimized build (Next.js standalone output)
- Health check — backend бэлэн болтол frontend эхлэхгүй
- `restart: unless-stopped` — сервер дахин асахад автоматаар эхэлнэ

### Ажиллуулах

```bash
# 1. Env файл бэлдэх
copy .env.example .env
# .env файлд:
#   BACKEND_URL=http://<server-ip>:3001
#   FRONTEND_URL=http://<server-ip>:9002
#   JWT_SECRET=<урт random мөр>
#   NODE_ENV=production

# 2. Build & run
docker-compose up --build -d

# 3. Шалгах
docker-compose ps          # бүх container Running байх ёстой
docker-compose logs -f     # нэгдсэн log
```

### Зогсоох / дахин эхлүүлэх

```bash
docker-compose down
docker-compose restart
```

### Шинэ кодыг deploy хийх

```bash
git pull
docker-compose up --build -d
```

### Production container-уудын үүрэг

| Service | Port | Тайлбар |
|---|---|---|
| `backend` | 3001 | NestJS API (production build) |
| `frontend` | 9002 | Next.js (standalone build) |

> Production docker-compose дотор ClickHouse **алга** — тусдаа байнгын container гэж үздэг.
> ClickHouse-г тусад нь ажиллуулж байгаа тохиолдолд `.env`-д `CLICKHOUSE_HOST` тохируулна.
> ⚡ `.env`-д `CLICKHOUSE_HOST` хувьсагч байхгүй тул backend `.env` файлд тусад нь тохируулна:
> `apps/backend/.env` файлд `CLICKHOUSE_HOST=http://<clickhouse-ip>:8123` нэмнэ.

---

## 5. Docker ашиглахгүйгээр (local bare-metal)

### Урьдчилсан шаардлага

- Node.js 20+
- ClickHouse ([татах](https://clickhouse.com/docs/en/install)) — localhost:8123 дээр ажиллаж байх
- npm

### Backend эхлүүлэх

```bash
cd apps/backend

# ENV файл бэлдэх (нэг удаа)
copy .env.example .env
# .env → JWT_SECRET өөрчлөх

# Dependencies суулгах
npm install

# Dev горим (hot-reload)
npm run start:dev

# Эсвэл production горим
npm run build
npm run start:prod
```

### Frontend эхлүүлэх (шинэ terminal)

```bash
cd apps/nextn

# ENV файл бэлдэх (нэг удаа)
copy .env.local.example .env.local

# Root-ийн package.json-аас ажиллуулах
cd ../..
npm install
npx nx serve nextn
```

### Хаягууд
- Frontend: http://localhost:9002
- Backend API: http://localhost:3001
- Swagger: http://localhost:3001/api/docs

---

## 6. Тест & format

### Backend тестүүд

```bash
cd apps/backend

npm run test          # нэг удаа ажиллуулах
npm run test:watch    # файл хадгалахад автоматаар
npm run test:cov      # coverage тайлантай
```

### Код форматлах (Prettier)

```bash
# Backend
cd apps/backend
npm run format

# Frontend  
cd apps/nextn
npx prettier --write "src/**/*.{ts,tsx}"
```

### TypeScript шалгах

```bash
# Backend
cd apps/backend
npx tsc --noEmit

# Frontend
cd apps/nextn
npx tsc --noEmit
```

### DB seed (ClickHouse өгөгдөл оруулах)

```bash
cd apps/backend
npm run db:seed
```

---

## 7. Нийтлэг алдаа & шийдэл

### ❌ `CORS_ORIGINS environment variable is required`
**.env файл байхгүй** эсвэл `CORS_ORIGINS` хувьсагч дутуу байна.
```bash
# Local dev
copy apps\backend\.env.example apps\backend\.env
# Docker
copy .env.example .env
```

### ❌ `CLICKHOUSE_HOST environment variable is required`
Local dev дээр `apps/backend/.env`-д `CLICKHOUSE_HOST` байхгүй.
```dotenv
CLICKHOUSE_HOST=http://localhost:8123
```

### ❌ `NEXT_PUBLIC_API_URL` тохируулаагүй
`apps/nextn/.env.local` файл байхгүй.
```bash
copy apps\nextn\.env.local.example apps\nextn\.env.local
```

### ❌ Login хийсний дараа өгөгдөл харагдахгүй (refresh хэрэгтэй болох)
`window.location.href` ашиглаж байгаа тул энэ асуудал засагдсан. Лог-ийн эр нь browser кэш — хатуу refresh (`Ctrl+Shift+R`) хийнэ.

### ❌ Docker hot-reload ажиллахгүй (Windows)
`docker-compose.dev.yml`-д `WATCHPACK_POLLING=true` болон `CHOKIDAR_USEPOLLING=true` байгаа эсэхийг шалгах.

### ❌ Port аль хэдийн ашиглагдаж байна
```bash
# Port 3001 ашиглаж буй process
netstat -ano | findstr :3001
# Port 9002
netstat -ano | findstr :9002
# Port 8123 (ClickHouse)
netstat -ano | findstr :8123
```

### ❌ ClickHouse холбогдохгүй
ClickHouse ажиллаж байгаа эсэхийг шалгах:
```bash
# Docker dev ашиглаж байвал
docker ps | findstr clickhouse
# Local бол
curl http://localhost:8123/ping    # "Ok." гэж хариу ирэх ёстой
```
