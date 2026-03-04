# Scripts — ажиллуулах заавар

## Урьдчилсан нөхцөл
`clickhouse` container ажиллаж байх ёстой:
```bash
docker compose -f docker-compose.dev.yml up -d
```

## seed-clickhouse.ts — үндсэн seed
Хэлтэс, хэрэглэгч (admin, superadmin)-ийг DB-д бүртгэнэ. **Зөвхөн анх суулгахад эсвэл reset хийхэд** ажиллуулна.
```bash
cd apps/backend
CLICKHOUSE_HOST=http://localhost:8123 npx ts-node scripts/seed-clickhouse.ts
# эсвэл
npm run db:seed
```

## seed-test.ts — schema шалгалт
Бүх 35 table-ийн schema-г шалгаж, test мөр оруулаад, баталгаажуулаад, бүгдийг устгана. **DB-д өгөгдөл үлдэхгүй.**
```bash
cd apps/backend
CLICKHOUSE_HOST=http://localhost:8123 npx ts-node scripts/seed-test.ts
# эсвэл
npm run db:seed-test
```

## fix-dept-ids.ts — нэг удаагийн migration
`ZAGCHBH` → `ZACHBH` хэрэглэгч ID засна (2026-01 хийгдсэн, дахин ажиллуулах шаардлагагүй).
```bash
npm run db:fix-dept-ids
```
