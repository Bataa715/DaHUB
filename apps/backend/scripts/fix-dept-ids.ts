/**
 * fix-dept-ids.ts
 *
 * Fixes user IDs that were generated with the wrong department code (ZAGCHBH → ZACHBH).
 * Runs ALTER TABLE UPDATE mutations on audit_db.users to rename affected userIds.
 *
 * Usage (inside backend container):
 *   npx ts-node scripts/fix-dept-ids.ts
 */

import { createClient } from "@clickhouse/client";

if (!process.env.CLICKHOUSE_HOST) {
  throw new Error("CLICKHOUSE_HOST environment variable is required");
}

const client = createClient({
  url: process.env.CLICKHOUSE_HOST,
  username: process.env.CLICKHOUSE_USER || "default",
  password: process.env.CLICKHOUSE_PASSWORD || "",
});

const DB = process.env.CLICKHOUSE_DATABASE || "audit_db";

async function main() {
  console.log("🔧 fix-dept-ids: Connecting to ClickHouse...");

  const ping = await client.query({ query: "SELECT version() as v" });
  const pingData: any = await ping.json();
  console.log(`✅ Connected — ClickHouse ${pingData.data[0].v}`);

  // ── 1. Find affected users ──────────────────────────────────────────────
  const res = await client.query({
    query: `SELECT id, userId FROM ${DB}.users WHERE userId LIKE '%ZAGCHBH%'`,
  });
  const data: any = await res.json();
  const affected: { id: string; userId: string }[] = data.data;

  if (affected.length === 0) {
    console.log("✅ No users with ZAGCHBH found — nothing to fix.");
    await client.close();
    return;
  }

  console.log(`\n📋 Found ${affected.length} user(s) to fix:`);
  for (const u of affected) {
    const newId = u.userId.replace(/ZAGCHBH/g, "ZACHBH");
    console.log(`  ${u.userId}  →  ${newId}`);
  }

  // ── 2. Apply mutation per user ──────────────────────────────────────────
  console.log("\n⚙️  Applying ALTER TABLE UPDATE mutations...");

  for (const u of affected) {
    const newUserId = u.userId.replace(/ZAGCHBH/g, "ZACHBH");
    await client.exec({
      query: `ALTER TABLE ${DB}.users UPDATE userId = {newUserId:String} WHERE id = {id:String}`,
      query_params: { newUserId, id: u.id },
    });
    console.log(`  ✓ ${u.userId} → ${newUserId}`);
  }

  // ── 3. Verify ───────────────────────────────────────────────────────────
  console.log("\n🔍 Waiting for mutations to settle (3s)...");
  await new Promise((r) => setTimeout(r, 3000));

  const verify = await client.query({
    query: `SELECT id, userId FROM ${DB}.users WHERE userId LIKE '%ZAGCHBH%'`,
  });
  const verifyData: any = await verify.json();

  if (verifyData.data.length === 0) {
    console.log("✅ Verification passed — no ZAGCHBH user IDs remain.");
  } else {
    console.warn(
      `⚠️  ${verifyData.data.length} user(s) still have ZAGCHBH — mutation may still be processing.`,
    );
    console.warn("   Re-run this script in a few seconds to verify.");
  }

  // ── 4. Show final ZACHBH users ──────────────────────────────────────────
  const final = await client.query({
    query: `SELECT userId, name FROM ${DB}.users WHERE userId LIKE '%ZACHBH%' ORDER BY userId`,
  });
  const finalData: any = await final.json();
  console.log(`\n📌 Current ZACHBH users (${finalData.data.length}):`);
  for (const u of finalData.data) {
    console.log(`  ${u.userId}  (${u.name})`);
  }

  await client.close();
  console.log("\n🎉 Done.");
}

main().catch((e) => {
  console.error("❌ Error:", e.message);
  process.exit(1);
});
