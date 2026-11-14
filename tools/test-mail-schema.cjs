const { PGlite } = require(
  process.env.EMA_MAIL_PGLITE_PATH || "@electric-sql/pglite",
);
const fs = require("node:fs"),
  assert = require("node:assert/strict");
(async () => {
  const db = new PGlite();
  await db.exec(
    "create schema auth; create table auth.users(id uuid primary key); create role anon; create role authenticated; create role service_role bypassrls;",
  );
  await db.exec(
    fs.readFileSync(
      "supabase/migrations/20261114080713_ema_mail_foundation.sql",
      "utf8",
    ),
  );
  await db.exec(
    fs.readFileSync(
      "supabase/migrations/20261114083001_ema_mail_automation.sql",
      "utf8",
    ),
  );
  const tables = await db.query(
    "select relname,relrowsecurity from pg_class where relname like 'ema_mail_%' and relkind='r'",
  );
  assert.equal(tables.rows.length, 7);
  assert.ok(tables.rows.every((t) => t.relrowsecurity));
  await db.exec(
    "insert into auth.users values ('11111111-1111-4111-8111-111111111111');",
  );
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`set role ${role}`);
    for (const table of [
      "ema_mail_drafts",
      "ema_mail_memberships",
      "ema_mail_audit",
      "ema_mail_analysis",
      "ema_mail_sync",
      "ema_mail_jobs",
      "ema_mail_insights",
    ]) {
      await assert.rejects(
        () => db.query(`select * from public.${table}`),
        /permission denied/,
      );
    }
    await db.exec("reset role");
  }
  await db.exec("set role service_role");
  await db.exec(
    "insert into public.ema_mail_drafts(user_id,payload,content_hash) values ('11111111-1111-4111-8111-111111111111','{}',repeat('a',64))",
  );
  await assert.rejects(
    () => db.exec("update public.ema_mail_drafts set status='approved'"),
    /check constraint/,
  );
  const token = "a".repeat(64);
  await db.query(
    "update public.ema_mail_drafts set status='approved',approval_hash=$1,approval_expires_at=now()+interval '5 minutes'",
    [token],
  );
  const claim =
    "update public.ema_mail_drafts set status='sending',approval_hash=null,approval_expires_at=null where status='approved' and approval_hash=$1 and approval_expires_at>now() returning id";
  const claims = await Promise.all([
    db.query(claim, [token]),
    db.query(claim, [token]),
  ]);
  assert.equal(
    claims.reduce((n, r) => n + r.rows.length, 0),
    1,
  );
  const budgets = await Promise.all(
    Array.from({ length: 25 }, () =>
      db.query(
        "select public.ema_mail_claim_analysis('11111111-1111-4111-8111-111111111111',20) as allowed",
      ),
    ),
  );
  assert.equal(budgets.filter((r) => r.rows[0].allowed).length, 20);
  await db.exec(
    "insert into public.ema_mail_sync(user_id,mailbox,enabled) values ('11111111-1111-4111-8111-111111111111','me',true)",
  );
  const syncClaims = await Promise.all([
    db.query("select * from public.ema_mail_claim_sync()"),
    db.query("select * from public.ema_mail_claim_sync()"),
  ]);
  assert.equal(
    syncClaims.reduce((n, r) => n + r.rows.length, 0),
    1,
  );
  await db.exec(
    "insert into public.ema_mail_jobs(user_id,mailbox,message_id) values ('11111111-1111-4111-8111-111111111111','me','message-one')",
  );
  await assert.rejects(
    () =>
      db.exec(
        "insert into public.ema_mail_jobs(user_id,mailbox,message_id) values ('11111111-1111-4111-8111-111111111111','me','message-one')",
      ),
    /unique constraint/,
  );
  const jobClaims = await Promise.all([
    db.query("select * from public.ema_mail_claim_job()"),
    db.query("select * from public.ema_mail_claim_job()"),
  ]);
  assert.equal(
    jobClaims.reduce((n, r) => n + r.rows.length, 0),
    1,
  );
  await db.exec(
    "update public.ema_mail_jobs set leased_until=now()-interval '1 minute'",
  );
  assert.equal(
    (await db.query("select * from public.ema_mail_claim_job()")).rows.length,
    1,
  );
  await db.exec(
    "update public.ema_mail_jobs set attempts=6,leased_until=now()-interval '1 minute'",
  );
  assert.equal(
    (await db.query("select * from public.ema_mail_claim_job()")).rows.length,
    0,
  );
  assert.equal(
    (await db.query("select state from public.ema_mail_jobs")).rows[0].state,
    "failed",
  );
  await db.exec("reset role");
  await db.exec("set role authenticated");
  await assert.rejects(
    () => db.query("select * from public.ema_mail_claim_job()"),
    /permission denied/,
  );
  await db.exec("reset role");
  console.log(
    "SQL verification passed: 7 RLS tables; anon/authenticated denied on 7 tables each; service-only draft; approval constraint; single-winner claim; 20/25 concurrent budget claims allowed; exclusive sync/job leases; duplicate jobs blocked; abandoned leases retried and exhausted jobs failed",
  );
  await db.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
