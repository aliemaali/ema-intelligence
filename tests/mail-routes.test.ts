import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST, GET } from "../src/app/api/mail/[...path]/route";
import { mailSession, mailboxAccess } from "../src/lib/mail/server";
import { draftSchema } from "../src/lib/mail/model";
import { GET as cronGet } from "../src/app/api/cron/ema-mail/route";
import { runMailWorker, cronAuthorized } from "../src/lib/mail/background";
import { digest } from "../src/lib/mail/security";
declare global {
  var __mailFixture: any;
}
const uid = "11111111-1111-4111-8111-111111111111",
  id = "22222222-2222-4222-8222-222222222222";
let rows: Record<string, any[]> = {},
  profile: any,
  user: any,
  assurance: any,
  graphCalls = 0;
function builder(table: string) {
  let op = "select",
    update: any,
    filters: ((r: any) => boolean)[] = [],
    columns = "*",
    limit = 1000;
  const b: any = {
    select: (c = "*") => {
      columns = c;
      return b;
    },
    update: (v: any) => {
      op = "update";
      update = v;
      return b;
    },
    insert: (v: any) => {
      op = "insert";
      update = v;
      return b;
    },
    upsert: (v: any) => {
      op = "insert";
      update = v;
      return b;
    },
    eq: (k: string, v: any) => {
      filters.push((r) => r[k] === v);
      return b;
    },
    gt: (k: string, v: any) => {
      filters.push((r) => r[k] > v);
      return b;
    },
    gte: (k: string, v: any) => {
      filters.push((r) => r[k] >= v);
      return b;
    },
    in: (k: string, v: any[]) => {
      filters.push((r) => v.includes(r[k]));
      return b;
    },
    order: () => b,
    limit: (n: number) => {
      limit = n;
      return b;
    },
    maybeSingle: () => execute(true),
    single: () => execute(true),
    then: (resolve: any) => Promise.resolve(execute(false)).then(resolve),
  };
  function execute(single: boolean) {
    let matched = (rows[table] || [])
      .filter((r) => filters.every((f) => f(r)))
      .slice(0, limit);
    if (table === "profiles") matched = profile ? [profile] : [];
    if (op === "update") matched.forEach((r) => Object.assign(r, update));
    if (op === "insert") {
      const r = { id, ...update };
      rows[table] ??= [];
      rows[table].push(r);
      matched = [r];
    }
    const result = JSON.parse(
      JSON.stringify(single ? matched[0] || null : matched),
    );
    return { data: result, error: null, count: matched.length };
  }
  return b;
}
function reset() {
  process.env.EMA_MAIL_ENABLED = "true";
  process.env.VERCEL_ENV = "development";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test";
  rows = {};
  profile = { role: "employee", is_active: true };
  user = { id: uid };
  assurance = { currentLevel: "aal1", nextLevel: "aal1" };
  graphCalls = 0;
  globalThis.__mailFixture = {
    admin: { from: builder },
    db: {
      from: builder,
      auth: {
        getUser: async () => ({ data: { user }, error: null }),
        mfa: {
          getAuthenticatorAssuranceLevel: async () => ({
            data: assurance,
            error: null,
          }),
        },
      },
    },
    token: async () => "test-token",
  };
  globalThis.fetch = async () => {
    graphCalls++;
    return new Response(null, { status: 202 });
  };
}
function req(action: string, body: any) {
  return new NextRequest(`https://ema.example/api/mail/${action}`, {
    method: "POST",
    headers: {
      origin: "https://ema.example",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
test("actual session rejects disabled module before touching database", async () => {
  reset();
  process.env.EMA_MAIL_ENABLED = "false";
  globalThis.__mailFixture.db = null;
  assert.equal((await POST(req("send", {}))).status, 503);
  assert.equal(graphCalls, 0);
});
test("session rejects missing user, partner, inactive profile, missing MFA", async () => {
  for (const setup of [
    () => {
      user = null;
    },
    () => {
      profile = { role: "partner", is_active: true };
    },
    () => {
      profile = { role: "admin", is_active: false };
    },
    () => {
      assurance = { currentLevel: "aal1", nextLevel: "aal2" };
    },
    () => {
      assurance = null;
    },
  ]) {
    reset();
    setup();
    await assert.rejects(() => mailSession());
    assert.equal(graphCalls, 0);
  }
});
test("shared mailbox requires matching explicit membership and exact permission", async () => {
  reset();
  const session = await mailSession();
  await assert.rejects(() => mailboxAccess(session, "other@example.com"));
  rows.ema_mail_memberships = [
    {
      user_id: uid,
      mailbox: "team@example.com",
      can_read: true,
      can_write: false,
      can_send: false,
    },
  ];
  assert.equal(
    (await mailboxAccess(session, "team@example.com")).mailbox,
    "team@example.com",
  );
  await assert.rejects(() =>
    mailboxAccess(session, "team@example.com", "send"),
  );
  await assert.rejects(() =>
    mailboxAccess(session, "team@example.com", "write"),
  );
});
test("send without approval, expired approval, foreign user, invalid token never reaches Graph", async () => {
  for (const change of [
    { status: "draft" },
    { approval_expires_at: new Date(Date.now() - 1000).toISOString() },
    { user_id: "other" },
    { approval_hash: "wrong" },
  ]) {
    reset();
    const payload = draftSchema.parse({
      to: ["x@example.com"],
      subject: "Hello",
      body: "World",
    });
    rows.ema_mail_drafts = [
      {
        id,
        user_id: uid,
        payload,
        content_hash: digest(payload),
        status: "approved",
        approval_hash: "not-valid",
        approval_expires_at: new Date(Date.now() + 300000).toISOString(),
        ...change,
      },
    ];
    const res = await POST(req("send", { id, approvalToken: "a".repeat(43) }));
    assert.ok(res.status >= 400);
    assert.equal(graphCalls, 0);
  }
});
test("review must match saved hash and affirmative confirmation", async () => {
  reset();
  const payload = draftSchema.parse({
    to: ["x@example.com"],
    subject: "Hello",
    body: "World",
  });
  rows.ema_mail_drafts = [
    {
      id,
      user_id: uid,
      payload,
      content_hash: digest(payload),
      status: "draft",
    },
  ];
  assert.equal(
    (await POST(req("approve", { id, contentHash: "wrong", confirmed: true })))
      .status,
    409,
  );
  assert.equal(
    (
      await POST(
        req("approve", { id, contentHash: digest(payload), confirmed: false }),
      )
    ).status,
    409,
  );
  assert.equal(graphCalls, 0);
});
test("parallel send/replay submits exactly once after user-approved saved draft", async () => {
  reset();
  const payload = draftSchema.parse({
    to: ["x@example.com"],
    subject: "Hello",
    body: "World",
  });
  rows.ema_mail_drafts = [
    {
      id,
      user_id: uid,
      payload,
      content_hash: digest(payload),
      status: "draft",
    },
  ];
  const approval = await POST(
    req("approve", { id, contentHash: digest(payload), confirmed: true }),
  );
  assert.equal(approval.status, 200);
  const { approvalToken } = await approval.json();
  const results = await Promise.all([
    POST(req("send", { id, approvalToken })),
    POST(req("send", { id, approvalToken })),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  assert.equal(graphCalls, 1);
  assert.equal(rows.ema_mail_drafts[0].status, "submitted");
  assert.equal((await POST(req("send", { id, approvalToken }))).status, 409);
  assert.equal(graphCalls, 1);
});
test("editing draft after review invalidates approval", async () => {
  reset();
  const payload = draftSchema.parse({
    to: ["x@example.com"],
    subject: "Hello",
    body: "World",
  });
  rows.ema_mail_drafts = [
    {
      id,
      user_id: uid,
      payload,
      content_hash: digest(payload),
      status: "draft",
    },
  ];
  const { approvalToken } = await (
    await POST(
      req("approve", { id, contentHash: digest(payload), confirmed: true }),
    )
  ).json();
  assert.equal(
    (
      await POST(
        req("drafts", { id, payload: { ...payload, body: "Changed" } }),
      )
    ).status,
    201,
  );
  assert.equal((await POST(req("send", { id, approvalToken }))).status, 409);
  assert.equal(graphCalls, 0);
});
test("unexpected network failure stays uncertain, cannot reapprove or retry", async () => {
  reset();
  const payload = draftSchema.parse({
    to: ["x@example.com"],
    subject: "Hello",
    body: "World",
  });
  rows.ema_mail_drafts = [
    {
      id,
      user_id: uid,
      payload,
      content_hash: digest(payload),
      status: "draft",
    },
  ];
  const { approvalToken } = await (
    await POST(
      req("approve", { id, contentHash: digest(payload), confirmed: true }),
    )
  ).json();
  globalThis.fetch = async () => {
    graphCalls++;
    throw new Error("timeout");
  };
  assert.equal((await POST(req("send", { id, approvalToken }))).status, 409);
  assert.equal(rows.ema_mail_drafts[0].status, "uncertain");
  assert.equal(
    (
      await POST(
        req("approve", { id, contentHash: digest(payload), confirmed: true }),
      )
    ).status,
    409,
  );
  assert.equal(graphCalls, 1);
});
test("CSRF rejected and responses explicitly no-store", async () => {
  reset();
  const bad = new NextRequest("https://ema.example/api/mail/send", {
    method: "POST",
    headers: {
      origin: "https://other.example",
      "content-type": "application/json",
    },
    body: "{}",
  });
  const res = await POST(bad);
  assert.equal(res.status, 403);
  assert.equal(res.headers.get("Cache-Control"), "private, no-store");
  assert.equal(graphCalls, 0);
});
test("foreign Graph cursor blocked before network", async () => {
  reset();
  const res = await GET(
    new NextRequest(
      "https://ema.example/api/mail/messages?cursor=" +
        encodeURIComponent("https://evil.example/steal"),
    ),
  );
  assert.equal(res.status, 400);
  assert.equal(graphCalls, 0);
});
test("regular employee cannot manage team permissions", async () => {
  reset();
  for (const request of [
    new NextRequest("https://ema.example/api/mail/team"),
    req("memberships", {
      userId: uid,
      mailbox: "team@example.com",
      canRead: true,
      canWrite: true,
      canSend: true,
    }),
  ]) {
    const result =
      request.method === "POST" ? await POST(request) : await GET(request);
    assert.equal(result.status, 403);
  }
  assert.equal(rows.ema_mail_memberships, undefined);
});

test("calendar and contact mutations require explicit approval before any Graph call", async () => {
  reset();
  for (const action of ["calendar", "contacts"]) {
    const response = await POST(
      req(action, { operation: "create", value: {}, confirmed: false }),
    );
    assert.equal(response.status, 409);
  }
  assert.equal(graphCalls, 0);
});
test("calendar create uses only current mailbox and transaction ID", async () => {
  reset();
  let captured: any;
  globalThis.fetch = async (url, init) => {
    captured = { url: String(url), body: JSON.parse(String(init?.body)) };
    return Response.json({ id: "event" }, { status: 201 });
  };
  const response = await POST(
    req("calendar", {
      operation: "create",
      confirmed: true,
      requestId: id,
      value: {
        subject: "Termin",
        start: "2026-11-14T10:00:00Z",
        end: "2026-11-14T11:00:00Z",
        attendees: ["guest@example.com"],
      },
      mailbox: "foreign@example.com",
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(captured.url, "https://graph.microsoft.com/v1.0/me/events");
  assert.equal(captured.body.transactionId, id);
  assert.equal(
    captured.body.attendees[0].emailAddress.address,
    "guest@example.com",
  );
});
test("calendar update preserves online meeting content and optional attendee type", async () => {
  reset();
  let patch: any;
  globalThis.fetch = async (url, init) => {
    if (init?.method === "PATCH") {
      patch = JSON.parse(String(init.body));
      return Response.json({ id: "event" });
    }
    return Response.json({
      isOrganizer: true,
      isOnlineMeeting: true,
      attendees: [
        { emailAddress: { address: "guest@example.com" }, type: "optional" },
      ],
    });
  };
  const response = await POST(
    req("calendar", {
      operation: "update",
      id: "event",
      confirmed: true,
      value: {
        subject: "Termin",
        start: "2026-11-14T10:00:00Z",
        end: "2026-11-14T11:00:00Z",
        notes: "changed",
        attendees: ["guest@example.com"],
      },
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(patch.body, undefined);
  assert.equal(patch.attendees[0].type, "optional");
});
test("contact edit preserves secondary addresses and telephone numbers", async () => {
  reset();
  let patch: any;
  globalThis.fetch = async (url, init) => {
    if (init?.method === "PATCH") {
      patch = JSON.parse(String(init.body));
      return Response.json({ id: "contact" });
    }
    return Response.json({
      emailAddresses: [
        { address: "old@example.com" },
        { address: "second@example.com" },
      ],
      businessPhones: ["1", "2"],
    });
  };
  const response = await POST(
    req("contacts", {
      operation: "update",
      id: "contact",
      confirmed: true,
      value: {
        displayName: "Name",
        email: "new@example.com",
        phone: "9",
        companyName: "EMA",
      },
    }),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(
    patch.emailAddresses.map((a: any) => a.address),
    ["new@example.com", "second@example.com"],
  );
  assert.deepEqual(patch.businessPhones, ["9", "2"]);
});
test("completing a foreign reminder cannot modify it", async () => {
  reset();
  rows.ema_reminders = [{ id, user_id: "other", completed_at: null }];
  assert.equal(
    (
      await POST(
        req("reminder-action", { id, complete: true, confirmed: true }),
      )
    ).status,
    404,
  );
  assert.equal(rows.ema_reminders[0].completed_at, null);
});
test("native reply is created, patched and sent only after the one-time approval", async () => {
  reset();
  const payload = draftSchema.parse({
    to: ["reply@example.com"],
    subject: "Re: Original",
    body: "Approved answer",
    replyToMessageId: "source-id",
  });
  rows.ema_mail_drafts = [
    {
      id,
      user_id: uid,
      payload,
      content_hash: digest(payload),
      status: "draft",
    },
  ];
  const calls: { url: string; method: string; body: any }[] = [];
  globalThis.fetch = async (url, init) => {
    calls.push({
      url: String(url),
      method: init?.method || "GET",
      body: init?.body ? JSON.parse(String(init.body)) : null,
    });
    if (String(url).endsWith("/createReply"))
      return Response.json({ id: "reply-id" }, { status: 201 });
    if (String(url).endsWith("/send"))
      return new Response(null, { status: 202 });
    return Response.json({ id: "reply-id" });
  };
  assert.equal(
    (await POST(req("send", { id, approvalToken: "a".repeat(43) }))).status,
    409,
  );
  assert.equal(calls.length, 0);
  const { approvalToken } = await (
    await POST(
      req("approve", { id, contentHash: digest(payload), confirmed: true }),
    )
  ).json();
  assert.equal((await POST(req("send", { id, approvalToken }))).status, 200);
  assert.equal(calls.length, 3);
  assert.match(calls[0].url, /source-id\/createReply$/);
  assert.equal(calls[1].body.body.content, "Approved answer");
  assert.equal(
    calls[1].body.toRecipients[0].emailAddress.address,
    "reply@example.com",
  );
  assert.match(calls[2].url, /reply-id\/send$/);
  assert.equal(rows.ema_mail_drafts[0].provider_draft_id, "reply-id");
});

test("worker refuses preview, disabled flag, missing/wrong secret and unicode mismatch", async () => {
  reset();
  process.env.EMA_MAIL_WORKER_ENABLED = "true";
  process.env.CRON_SECRET = "test-secret";
  process.env.VERCEL_ENV = "preview";
  assert.equal(
    (
      await cronGet(
        new NextRequest("https://ema.example/api/cron/ema-mail", {
          headers: { authorization: "Bearer test-secret" },
        }),
      )
    ).status,
    503,
  );
  process.env.VERCEL_ENV = "development";
  assert.equal(
    (await cronGet(new NextRequest("https://ema.example/api/cron/ema-mail")))
      .status,
    401,
  );
  assert.equal(
    cronAuthorized(
      new Request("https://ema.example", {
        headers: { authorization: "Bearer ééééééééééé" },
      }),
    ),
    false,
  );
  delete process.env.CRON_SECRET;
  assert.equal(cronAuthorized(new Request("https://ema.example")), false);
  assert.equal(graphCalls, 0);
});

test('actual worker sync persists jobs and cursor without any email send capability',async()=>{reset();const state={user_id:uid,mailbox:'me',enabled:true,analyze:false,push:false,enabled_since:'2026-11-14T08:00:00Z',cursor:null,lease_id:'lease',folder_id:'inbox'};rows.ema_mail_sync=[{...state}];globalThis.__mailFixture.admin.rpc=async(name:string)=>({data:name==='ema_mail_claim_sync'?[{...state}]:[],error:null});const urls:string[]=[];globalThis.fetch=async(url,init)=>{urls.push(String(url));assert.equal(init?.method,undefined);return Response.json({value:[{id:'new',receivedDateTime:'2026-11-14T09:00:00Z'}],'@odata.deltaLink':'https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages/delta?$deltatoken=next'})};assert.equal((await runMailWorker()).synced,1);assert.equal(rows.ema_mail_jobs[0].message_id,'new');assert.match(rows.ema_mail_sync[0].cursor,/deltatoken=next/);assert.equal(urls.length,1)})
test('actual worker rechecks disabled staff before loading a Microsoft token',async()=>{reset();profile={role:'employee',is_active:false};let tokens=0;globalThis.__mailFixture.token=async()=>{tokens++;return 'token'};const state={user_id:uid,mailbox:'me',enabled:true,analyze:true,push:true,enabled_since:new Date().toISOString(),cursor:null,lease_id:'lease'};rows.ema_mail_sync=[{...state}];globalThis.__mailFixture.admin.rpc=async(name:string)=>({data:name==='ema_mail_claim_sync'?[{...state}]:[],error:null});assert.equal((await runMailWorker()).errors,1);assert.equal(tokens,0);assert.equal(graphCalls,0);assert.equal(rows.ema_mail_sync[0].enabled,false)})
test('actual worker with no analysis or push finishes job without Graph or AI calls',async()=>{reset();rows.ema_mail_sync=[{user_id:uid,mailbox:'me',enabled:true,analyze:false,push:false}];const job={id,user_id:uid,mailbox:'me',message_id:'msg',state:'processing',attempts:1,lease_id:'lease',leased_until:new Date(Date.now()+60000).toISOString(),analysis_done:false,push_state:'pending'};rows.ema_mail_jobs=[{...job}];globalThis.__mailFixture.admin.rpc=async(name:string)=>({data:name==='ema_mail_claim_job'?[{...job}]:[],error:null});assert.equal((await runMailWorker()).jobs,1);assert.equal(rows.ema_mail_jobs[0].state,'done');assert.equal(graphCalls,0)})
