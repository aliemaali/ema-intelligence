import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST, GET } from "../src/app/api/mail/[...path]/route";
import { mailSession, mailboxAccess } from "../src/lib/mail/server";
import { runApprovedDispatch } from "../src/lib/mail/dispatch";
import { GET as dispatchCron } from "../src/app/api/cron/ema-mail-dispatch/route";
import { getDocuments } from "../src/lib/actions/document.actions";
import { draftSchema } from "../src/lib/mail/model";
import { GET as cronGet } from "../src/app/api/cron/ema-mail/route";
import { runMailWorker, cronAuthorized } from "../src/lib/mail/background";
import { digest } from "../src/lib/mail/security";
import { sealDeltaCursor } from "../src/lib/mail/delta-cursor";
import { SHARED_CONTACT_OWNER, SHARED_CONTACT_READER, SHARED_CONTACT_PREFIX } from "../src/lib/mail/shared-contacts";
declare global {
  var __mailFixture: any;
}
test('delta route returns signed continuation, binds it to the folder, and enforces mailbox access', async () => {
  reset();
  let requested = '';
  globalThis.fetch = async (input) => {
    graphCalls++; requested = String(input);
    return Response.json({ value: [{ id: 'changed', isRead: true }], '@odata.deltaLink': 'https://graph.microsoft.com/v1.0/me/mailFolders/opaque/messages/delta?$deltatoken=next' });
  };
  const response = await GET(new NextRequest('https://ema.example/api/mail/message-delta?mailbox=me&folder=inbox'));
  assert.equal(response.status,200);
  assert.ok(requested.includes('/mailFolders/inbox/messages/delta?'));
  const data = await response.json(); assert.ok(data.delta); assert.equal(data.changes[0].isRead,true);
  const cursorQuery = new URLSearchParams({mailbox:'me',folder:'inbox',cursor:data.delta});
  assert.equal((await GET(new NextRequest(`https://ema.example/api/mail/message-delta?${cursorQuery}`))).status,200);
  assert.ok(requested.includes('/mailFolders/opaque/messages/delta?'));
  const before=graphCalls; cursorQuery.set('folder','sentitems');
  assert.equal((await GET(new NextRequest(`https://ema.example/api/mail/message-delta?${cursorQuery}`))).status,400);
  assert.equal(graphCalls,before);
  assert.equal((await GET(new NextRequest('https://ema.example/api/mail/message-delta?mailbox=other@example.com&folder=inbox'))).status,403);
  assert.equal(graphCalls,before);
});
test('delta route rejects signed URLs for non-delta resources and preserves expired-state status',async()=>{
  reset(); const scope=JSON.stringify([uid,'me','inbox']);
  const cursor=sealDeltaCursor('https://graph.microsoft.com/v1.0/me/messages',scope,process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const query=new URLSearchParams({mailbox:'me',folder:'inbox',cursor});
  assert.equal((await GET(new NextRequest(`https://ema.example/api/mail/message-delta?${query}`))).status,400);
  assert.equal(graphCalls,0);
  globalThis.fetch=async()=>new Response(null,{status:410});
  assert.equal((await GET(new NextRequest('https://ema.example/api/mail/message-delta?mailbox=me&folder=inbox'))).status,410);
});
test('delta follows server-signed canonical user-ID links for me and shared mailbox aliases',async()=>{
  for(const mailbox of ['me','team@example.com']) {
    reset();
    rows.ema_mail_memberships=[{user_id:uid,mailbox:'team@example.com',can_read:true,can_write:false,can_send:false}];
    const canonical='https://graph.microsoft.com/v1.0/users(\'33333333-3333-4333-8333-333333333333\')/mailFolders(\'opaque-folder\')/messages/delta?$skiptoken=next';
    let requested='';
    globalThis.fetch=async input=>{
      graphCalls++; requested=String(input);
      return Response.json({value:[{id:'old',isRead:true}],'@odata.nextLink':canonical});
    };
    const query=new URLSearchParams({mailbox,folder:'inbox'});
    const first=await GET(new NextRequest(`https://ema.example/api/mail/message-delta?${query}`));
    assert.equal(first.status,200,`canonical continuation must be accepted for ${mailbox}`);
    const data=await first.json(); assert.ok(data.next);
    query.set('cursor',data.next);
    assert.equal((await GET(new NextRequest(`https://ema.example/api/mail/message-delta?${query}`))).status,200);
    assert.ok(requested.includes('/users/33333333-3333-4333-8333-333333333333/mailFolders/opaque-folder/messages/delta?'));
    const before=graphCalls; query.set('mailbox',mailbox==='me'?'team@example.com':'me');
    assert.equal((await GET(new NextRequest(`https://ema.example/api/mail/message-delta?${query}`))).status,400);
    assert.equal(graphCalls,before,'signed links cannot be replayed under another mailbox scope');
  }
});
test('delta never signs a returned link to a foreign host or a non-delta resource',async()=>{
  for(const link of ['https://example.com/v1.0/me/mailFolders/inbox/messages/delta','https://graph.microsoft.com/v1.0/users/other/messages']) {
    reset(); globalThis.fetch=async()=>Response.json({value:[],'@odata.nextLink':link});
    const response=await GET(new NextRequest('https://ema.example/api/mail/message-delta?mailbox=me&folder=inbox'));
    assert.ok(response.status>=400); const data=await response.json(); assert.equal(data.next,undefined);
  }
});
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
    delete: () => {
      op = "delete";
      return b;
    },
    lt: (k: string, v: any) => {
      filters.push((r) => r[k] < v);
      return b;
    },
    range: (a: number, z: number) => {
      limit = z + 1;
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
      filters.push((r) => (k === "payload->>mailbox" ? r.payload?.mailbox : r[k]) === v);
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
    if (op === "delete")
      rows[table] = (rows[table] || []).filter((r) => !matched.includes(r));
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
  process.env.EMA_MAIL_SCHEDULED_SEND_ENABLED = "false";
  process.env.EMA_MAIL_ENABLED = "true";
  process.env.VERCEL_ENV = "development";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test";
  rows = {
    microsoft_connections: [
      { user_id: uid, microsoft_email: "tester@example.com" },
    ],
  };
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
test('sender contact creation writes to the shared owner for both Ali and Tuba', async () => {
  for (const userId of [SHARED_CONTACT_OWNER, SHARED_CONTACT_READER]) {
    reset();
    user = { id: userId };
    profile = { role: 'employee', is_active: true, email: 'unluer@ema-enterprise.de' };
    rows.microsoft_connections = [{ user_id: SHARED_CONTACT_OWNER, microsoft_email: 'unluer@ema-enterprise.de' }];
    rows.ema_mail_memberships = [{ user_id: SHARED_CONTACT_READER, mailbox: 'unluer@ema-enterprise.de', can_read: true, can_write: true }];
    const tokenOwners: string[] = [];
    globalThis.__mailFixture.token = async (owner: string) => { tokenOwners.push(owner); return `token-${owner}`; };
    let authorization = '', path = '', sent: any;
    globalThis.fetch = async (input, init) => {
      graphCalls++; path = String(input);
      authorization = new Headers(init?.headers).get('authorization') || '';
      sent = JSON.parse(init?.body as string);
      return Response.json({ id: 'created-contact', ...sent }, { status: 201 });
    };
    const response = await POST(req('contacts', { operation: 'create', target: 'shared', confirmed: true,
      value: { displayName: 'New Sender', email: 'sender@example.com', companyName: 'Company', phone: '+49 123' } }));
    assert.equal(response.status, 200, await response.clone().text());
    assert.equal(graphCalls, 1);
    assert.equal(path, 'https://graph.microsoft.com/v1.0/me/contacts');
    assert.equal(authorization, `Bearer token-${SHARED_CONTACT_OWNER}`);
    assert.equal(tokenOwners.at(-1), SHARED_CONTACT_OWNER);
    assert.equal(sent.displayName, 'New Sender');
    assert.deepEqual(sent.emailAddresses, [{ address: 'sender@example.com' }]);
    const saved = (await response.json()).item;
    assert.equal(saved.id, userId === SHARED_CONTACT_READER ? SHARED_CONTACT_PREFIX + 'created-contact' : 'created-contact');
  }
});
test('shared sender creation rejects other users, revoked write access and missing confirmation', async () => {
  const body = { operation: 'create', target: 'shared', confirmed: true,
    value: { displayName: 'Sender', email: 'sender@example.com' } };
  reset();
  assert.equal((await POST(req('contacts', body))).status, 403);
  assert.equal(graphCalls, 0);
  user = { id: SHARED_CONTACT_READER };
  assert.equal((await POST(req('contacts', body))).status, 403);
  assert.equal(graphCalls, 0);
  rows.ema_mail_memberships = [{ user_id: SHARED_CONTACT_READER, mailbox: 'unluer@ema-enterprise.de', can_read: true, can_write: false }];
  assert.equal((await POST(req('contacts', body))).status, 403);
  assert.equal((await POST(req('contacts', { ...body, confirmed: false }))).status, 409);
  assert.equal(graphCalls, 0);
});
test('owned draft and approved draft can be deleted without Microsoft access; deletion invalidates send approval',async()=>{
  for(const status of ['draft','approved']) {
    reset();
    rows.ema_mail_drafts=[{id,user_id:uid,status,payload:{mailbox:'me'},approval_hash:'old-approval'}];
    globalThis.__mailFixture.token=async()=>{throw new Error('Deleting an EMA draft must not require Microsoft');};
    const response=await POST(req('draft-delete',{id}));
    assert.equal(response.status,200); assert.equal((await response.json()).id,id);
    assert.equal(rows.ema_mail_drafts.length,0); assert.equal(graphCalls,0);
    assert.ok(rows.ema_mail_audit.some(row=>row.action==='draft_delete_requested'&&row.resource_id===id));
    assert.equal((await POST(req('send',{id,approvalToken:'a'.repeat(43)}))).status,404);
  }
});
test('draft deletion hides foreign records and preserves sending, scheduled, submitted and uncertain records',async()=>{
  reset(); rows.ema_mail_drafts=[{id,user_id:'another-user',status:'draft'}];
  assert.equal((await POST(req('draft-delete',{id}))).status,404);
  assert.equal(rows.ema_mail_drafts.length,1);
  for(const status of ['sending','scheduled','submitted','uncertain']) {
    reset(); rows.ema_mail_drafts=[{id,user_id:uid,status}];
    assert.equal((await POST(req('draft-delete',{id}))).status,409);
    assert.equal(rows.ema_mail_drafts.length,1); assert.equal(graphCalls,0);
  }
});
test('atomic draft deletion cannot remove a draft claimed by a concurrent sender',async()=>{
  reset(); rows.ema_mail_drafts=[{id,user_id:uid,status:'approved'}];
  globalThis.__mailFixture.admin.from=(table:string)=>table==='ema_mail_audit'
    ? {insert:async()=>{rows.ema_mail_drafts[0].status='sending';return {error:null};}}
    : builder(table);
  assert.equal((await POST(req('draft-delete',{id}))).status,409);
  assert.equal(rows.ema_mail_drafts[0].status,'sending'); assert.equal(graphCalls,0);
});
test('draft deletion requires same-origin POST and rejects malformed IDs or injected ownership',async()=>{
  reset(); rows.ema_mail_drafts=[{id,user_id:uid,status:'draft'}];
  const crossSite=new NextRequest('https://ema.example/api/mail/draft-delete',{method:'POST',headers:{origin:'https://other.example','content-type':'application/json'},body:JSON.stringify({id})});
  assert.equal((await POST(crossSite)).status,403);
  assert.equal((await POST(req('draft-delete',{id:'invalid'}))).status,400);
  assert.equal((await POST(req('draft-delete',{id,user_id:uid}))).status,400);
  assert.ok((await GET(new NextRequest('https://ema.example/api/mail/draft-delete'))).status>=400);
  assert.equal(rows.ema_mail_drafts.length,1); assert.equal(graphCalls,0);
});
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
  rows.microsoft_connections = [
    { user_id: uid, microsoft_email: "unluer@ema-enterprise.de" },
  ];
  const payload = draftSchema.parse({
    to: ["reply@example.com"],
    subject: "Re: Original",
    body: "Approved answer",
    replyQuote: { from: "Original Sender <sender@example.com>", to: ["unluer@ema-enterprise.de"], cc: [], date: "2026-11-15T08:00:00Z", subject: "Original", body: "Quoted original thread" },
    signatureId: "ali-unluer-v1",
    isReadReceiptRequested: true,
    isDeliveryReceiptRequested: true,
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
  assert.equal(calls.length, 4);
  assert.match(calls[0].url, /source-id\/createReply$/);
  assert.ok(calls[1].body.body.content.includes("Approved answer"));
  assert.equal(calls[1].body.body.content.split("Quoted original thread").length - 1, 1);
  assert.ok(calls[1].body.body.content.indexOf("cid:ema-signature-ali-unluer-v1") < calls[1].body.body.content.indexOf("Quoted original thread"));
  assert.equal(calls[1].body.body.contentType, "HTML");
  assert.equal(calls[1].body.isReadReceiptRequested, true);
  assert.equal(calls[1].body.isDeliveryReceiptRequested, true);
  assert.equal(calls[2].body.isInline, true);
  assert.equal(calls[2].body.contentId, "ema-signature-ali-unluer-v1");
  assert.equal(
    calls[1].body.toRecipients[0].emailAddress.address,
    "reply@example.com",
  );
  assert.match(calls[2].url, /reply-id\/attachments$/);
  assert.match(calls[3].url, /reply-id\/send$/);
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

test("actual worker sync persists jobs and cursor without any email send capability", async () => {
  reset();
  const state = {
    user_id: uid,
    mailbox: "me",
    enabled: true,
    analyze: false,
    push: false,
    enabled_since: "2026-11-14T08:00:00Z",
    cursor: null,
    lease_id: "lease",
    folder_id: "inbox",
  };
  rows.ema_mail_sync = [{ ...state }];
  globalThis.__mailFixture.admin.rpc = async (name: string) => ({
    data: name === "ema_mail_claim_sync" ? [{ ...state }] : [],
    error: null,
  });
  const urls: string[] = [];
  globalThis.fetch = async (url, init) => {
    urls.push(String(url));
    assert.equal(init?.method, undefined);
    return Response.json({
      value: [{ id: "new", receivedDateTime: "2026-11-14T09:00:00Z" }],
      "@odata.deltaLink":
        "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages/delta?$deltatoken=next",
    });
  };
  assert.equal((await runMailWorker()).synced, 1);
  assert.equal(rows.ema_mail_jobs[0].message_id, "new");
  assert.match(rows.ema_mail_sync[0].cursor, /deltatoken=next/);
  assert.equal(urls.length, 1);
});
test("actual worker rechecks disabled staff before loading a Microsoft token", async () => {
  reset();
  profile = { role: "employee", is_active: false };
  let tokens = 0;
  globalThis.__mailFixture.token = async () => {
    tokens++;
    return "token";
  };
  const state = {
    user_id: uid,
    mailbox: "me",
    enabled: true,
    analyze: true,
    push: true,
    enabled_since: new Date().toISOString(),
    cursor: null,
    lease_id: "lease",
  };
  rows.ema_mail_sync = [{ ...state }];
  globalThis.__mailFixture.admin.rpc = async (name: string) => ({
    data: name === "ema_mail_claim_sync" ? [{ ...state }] : [],
    error: null,
  });
  assert.equal((await runMailWorker()).errors, 1);
  assert.equal(tokens, 0);
  assert.equal(graphCalls, 0);
  assert.equal(rows.ema_mail_sync[0].enabled, false);
});
test("actual worker with no analysis or push finishes job without Graph or AI calls", async () => {
  reset();
  rows.ema_mail_sync = [
    { user_id: uid, mailbox: "me", enabled: true, analyze: false, push: false },
  ];
  const job: any = {
    id,
    user_id: uid,
    mailbox: "me",
    message_id: "msg",
    state: "processing",
    attempts: 1,
    lease_id: "lease",
    leased_until: new Date(Date.now() + 60000).toISOString(),
    analysis_done: false,
    push_state: "pending",
  };
  rows.ema_mail_jobs = [{ ...job }];
  globalThis.__mailFixture.admin.rpc = async (name: string) => ({
    data: name === "ema_mail_claim_job" ? [{ ...job }] : [],
    error: null,
  });
  assert.equal((await runMailWorker()).jobs, 1);
  assert.equal(rows.ema_mail_jobs[0].state, "done");
  assert.equal(graphCalls, 0);
});

test("signature policy rejects missing signature, wrong sender and changed sender before send", async () => {
  reset();
  rows.microsoft_connections = [
    { user_id: uid, microsoft_email: "unluer@ema-enterprise.de" },
  ];
  const plain = draftSchema.parse({
    to: ["test@example.com"],
    subject: "Test",
    body: "Test",
  });
  assert.equal((await POST(req("drafts", { payload: plain }))).status, 409);
  const payload = draftSchema.parse({ ...plain, signatureId: "ali-unluer-v1" });
  assert.equal((await POST(req("drafts", { payload }))).status, 201);
  rows.microsoft_connections[0].microsoft_email = "other@example.com";
  assert.equal((await POST(req("drafts", { payload }))).status, 409);
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
    (
      await POST(
        req("approve", { id, contentHash: digest(payload), confirmed: true }),
      )
    ).status,
    409,
  );
  assert.equal(graphCalls, 0);
});

test("project assignment rejects foreign projects before fetching mailbox data", async () => {
  reset();
  rows.projects = [
    {
      id: "33333333-3333-4333-8333-333333333333",
      user_id: "foreign",
      project_name: "Secret",
    },
  ];
  const r = await POST(
    req("project-link", {
      mailbox: "me",
      messageId: "source",
      projectId: rows.projects[0].id,
    }),
  );
  assert.equal(r.status, 403);
  assert.equal(graphCalls, 0);
});
test("templates are sanitized and private; personal signatures are stored under the caller", async () => {
  reset();
  assert.equal(
    (
      await POST(
        req("template", {
          mailbox: "me",
          title: "Personal",
          subject: "Subject",
          body: "Hello",
          bodyHtml: '<b>Hello</b><img src="https://evil.example">',
        }),
      )
    ).status,
    201,
  );
  assert.equal(rows.ema_mail_templates[0].user_id, uid);
  assert.equal(rows.ema_mail_templates[0].body_html, "<b>Hello</b>");
  assert.equal(
    (await POST(req("signature", { mailbox: "me", text: "Employee\nCompany" })))
      .status,
    200,
  );
  assert.equal(rows.ema_mail_user_settings[0].user_id, uid);
  rows.ema_mail_templates.push({
    id: "33333333-3333-4333-8333-333333333333",
    user_id: "foreign",
    title: "private",
  });
  await POST(
    req("template", {
      mailbox: "me",
      operation: "delete",
      id: "33333333-3333-4333-8333-333333333333",
    }),
  );
  assert.equal(
    rows.ema_mail_templates.filter((r) => r.user_id === "foreign").length,
    1,
  );
});
test("conversation cursor is bound to source mailbox and conversation", async () => {
  reset();
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return Response.json({ id: "source", conversationId: "conversation-A" });
  };
  const query = new URLSearchParams({
    messageId: "source",
    cursor:
      "https://graph.microsoft.com/v1.0/me/messages?$filter=conversationId%20eq%20%27foreign%27",
  });
  assert.equal(
    (await GET(new NextRequest(`https://ema.example/api/mail/thread?${query}`)))
      .status,
    400,
  );
  assert.equal(calls, 1);
});
test("schedule requires separate explicit approval and blocks immediate-send bypass", async () => {
  reset();
  process.env.EMA_MAIL_SCHEDULED_SEND_ENABLED = "true";
  const payload = draftSchema.parse({
    to: ["test@example.com"],
    subject: "Later",
    body: "Approved",
    scheduledAt: new Date(Date.now() + 3600000).toISOString(),
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
    (
      await POST(
        req("schedule", { mailbox: "me", id, contentHash: digest(payload) }),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await POST(
        req("approve", { id, contentHash: digest(payload), confirmed: true }),
      )
    ).status,
    409,
  );
  let calls = 0;
  globalThis.__mailFixture.admin.rpc = async (name: string, args: any) => {
    calls++;
    assert.equal(name, "ema_mail_schedule_draft");
    assert.equal(args.p_user_id, uid);
    assert.equal(args.p_hash, digest(payload));
    return { data: "scheduled-id", error: null };
  };
  assert.equal(
    (
      await POST(
        req("schedule", {
          mailbox: "me",
          id,
          contentHash: "changed",
          confirmed: true,
        }),
      )
    ).status,
    409,
  );
  assert.equal(calls, 0);
  assert.equal(
    (
      await POST(
        req("schedule", {
          mailbox: "me",
          id,
          contentHash: digest(payload),
          confirmed: true,
        }),
      )
    ).status,
    200,
  );
  assert.equal(calls, 1);
  assert.equal(graphCalls, 0);
});
function scheduledFixture() {
  reset();
  process.env.EMA_MAIL_SCHEDULED_SEND_ENABLED = "true";
  const when = new Date(Date.now() - 60000).toISOString(),
    payload = draftSchema.parse({
      to: ["recipient@example.com"],
      subject: "Scheduled",
      body: "Approved",
      scheduledAt: when,
    });
  const job: any = {
    id: "33333333-3333-4333-8333-333333333333",
    draft_id: id,
    user_id: uid,
    mailbox: "me",
    payload,
    content_hash: digest(payload),
    run_at: when,
    state: "pending",
    approved_at: new Date(Date.now() - 3600000).toISOString(),
  };
  rows.ema_mail_scheduled = [job];
  rows.ema_mail_drafts = [
    {
      id,
      user_id: uid,
      payload,
      content_hash: job.content_hash,
      status: "scheduled",
    },
  ];
  globalThis.__mailFixture.admin.rpc = async (name: string) => {
    if (name === "ema_mail_claim_scheduled" && job.state === "pending") {
      job.state = "sending";
      job.claimed_at = new Date().toISOString();
      return { data: [JSON.parse(JSON.stringify(job))], error: null };
    }
    return { data: [], error: null };
  };
  return job as any;
}
test("scheduled delivery consumes approved work once and never retries ambiguous sends", async () => {
  const job = scheduledFixture();
  let sends = 0;
  globalThis.fetch = async () => {
    sends++;
    throw new Error("timeout after acceptance");
  };
  await runApprovedDispatch();
  assert.equal(job.state, "uncertain");
  assert.equal(rows.ema_mail_drafts[0].status, "uncertain");
  await runApprovedDispatch();
  assert.equal(sends, 1);
});
test("scheduled delivery rejects changed snapshots, stale approval and revoked staff", async () => {
  for (const mutate of [
    (job: any) => {
      job.payload.body = "tampered";
    },
    (job: any) => {
      job.run_at = new Date(Date.now() - 2 * 86400000).toISOString();
    },
    () => {
      profile.is_active = false;
    },
  ]) {
    const job = scheduledFixture();
    mutate(job);
    await runApprovedDispatch();
    assert.equal(job.state, "blocked");
    assert.equal(graphCalls, 0);
  }
});
test("scheduled delivery submits only exact stored recipients and request flags", async () => {
  const job = scheduledFixture();
  let sent: any;
  globalThis.fetch = async (_url, init) => {
    sent = JSON.parse(String(init?.body));
    return new Response(null, { status: 202 });
  };
  const result = await runApprovedDispatch();
  assert.equal(result.scheduled, 1);
  assert.equal(job.state, "submitted");
  assert.equal(
    sent.message.toRecipients[0].emailAddress.address,
    "recipient@example.com",
  );
  assert.equal(sent.message.body.content, "Approved");
  await runApprovedDispatch();
  assert.equal(job.state, "submitted");
});
test("dispatch route is disabled in previews even with scheduler flag", async () => {
  reset();
  process.env.EMA_MAIL_SCHEDULED_SEND_ENABLED = "true";
  process.env.VERCEL_ENV = "preview";
  assert.equal(
    (
      await dispatchCron(
        new NextRequest("https://ema.example/api/cron/ema-mail-dispatch"),
      )
    ).status,
    503,
  );
  assert.equal(graphCalls, 0);
});
test("retired followup endpoints reject stale clients without writes", async () => {
  reset();
  process.env.EMA_MAIL_SCHEDULED_SEND_ENABLED = "true";
  for (const action of ["followup", "cancel-followup"]) {
    const response = await POST(
      req(action, { mailbox: "me", messageId: "incoming", id }),
    );
    assert.equal(response.status, 410);
  }
  assert.equal(graphCalls, 0);
  assert.ok(!rows.ema_mail_followups);
});
test("scheduled dispatcher ignores legacy followups and creates no reminders", async () => {
  reset();
  process.env.EMA_MAIL_SCHEDULED_SEND_ENABLED = "true";
  rows.ema_mail_followups = [
    { id, user_id: uid, mailbox: "me", state: "pending" },
  ];
  const calls: string[] = [];
  globalThis.__mailFixture.admin.rpc = async (name: string) => {
    calls.push(name);
    return { data: [], error: null };
  };
  assert.deepEqual(await runApprovedDispatch(), { scheduled: 0 });
  assert.deepEqual(calls, ["ema_mail_claim_scheduled"]);
  assert.equal(rows.ema_mail_followups[0].state, "pending");
  assert.ok(!rows.ema_reminders?.length);
});
test("project documents include only own linked DMS records when mail is enabled", async () => {
  reset();
  const projectId = "33333333-3333-4333-8333-333333333333";
  rows.documents = [
    {
      id: "direct",
      user_id: uid,
      project_id: projectId,
      is_archived: false,
      created_at: "2026-01-01",
    },
    {
      id: "linked",
      user_id: uid,
      project_id: null,
      is_archived: false,
      created_at: "2026-01-02",
    },
    {
      id: "foreign",
      user_id: "foreign",
      project_id: null,
      is_archived: false,
      created_at: "2026-01-03",
    },
  ];
  rows.dms_document_links = [
    {
      user_id: uid,
      document_id: "linked",
      entity_type: "project",
      entity_id: projectId,
    },
    {
      user_id: uid,
      document_id: "foreign",
      entity_type: "project",
      entity_id: projectId,
    },
  ];
  assert.deepEqual(
    (await getDocuments(projectId)).map((d) => d.id),
    ["linked", "direct"],
  );
  process.env.EMA_MAIL_ENABLED = "false";
  assert.deepEqual(
    (await getDocuments(projectId)).map((d) => d.id),
    ["direct"],
  );
});

test("badge sums authorized Inbox counts, excludes foreign and revoked mailboxes", async () => {
  reset();
  rows.ema_mail_memberships = [
    { user_id: uid, mailbox: "team@example.com", can_read: true },
    { user_id: uid, mailbox: "tester@example.com", can_read: true },
    { user_id: uid, mailbox: "revoked@example.com", can_read: false },
    { user_id: "other", mailbox: "foreign@example.com", can_read: true },
  ];
  const paths: string[] = [];
  globalThis.fetch = async (url) => {
    paths.push(String(url));
    return Response.json({
      unreadItemCount: String(url).includes("/me/") ? 4 : 7,
    });
  };
  const response = await GET(
    new NextRequest("https://ema.example/api/mail/badge"),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { count: 11 });
  assert.equal(paths.length, 2);
  assert.ok(paths.every((path) => path.includes("/mailFolders/inbox?")));
  assert.ok(!paths.some((path) => /foreign|revoked|tester/.test(path)));
});
test("badge refuses partial or invalid counts and stays gated in preview", async () => {
  reset();
  globalThis.fetch = async () => Response.json({ unreadItemCount: -1 });
  assert.equal(
    (await GET(new NextRequest("https://ema.example/api/mail/badge"))).status,
    502,
  );
  process.env.VERCEL_ENV = "preview";
  assert.equal(
    (await GET(new NextRequest("https://ema.example/api/mail/badge"))).status,
    503,
  );
});
test("mail push registration rejects external endpoints and cross-origin writes", async () => {
  reset();
  assert.equal(
    (
      await POST(
        req("push-subscription", {
          endpoint: "https://internal.example/push",
          keys: { p256dh: "test", auth: "test" },
        }),
      )
    ).status,
    400,
  );
  const bad = new NextRequest(
    "https://ema.example/api/mail/push-subscription",
    { method: "POST", headers: { origin: "https://evil.example" }, body: "{}" },
  );
  assert.equal((await POST(bad)).status, 403);
  assert.equal(
    (
      await POST(
        req("push-subscription", {
          endpoint: "https://web.push.apple.com/test",
          keys: { p256dh: "test", auth: "test" },
        }),
      )
    ).status,
    200,
  );
  assert.equal(rows.ema_push_subscriptions[0].user_id, uid);
});

const meetingValue = {
  subject: "Teams-Test",
  start: "2026-11-14T10:00:00Z",
  end: "2026-11-14T11:00:00Z",
  attendees: ["guest@example.com"],
  teamsMeeting: true,
};
test("Teams invitations require explicit approval before even checking the calendar", async () => {
  reset();
  assert.equal(
    (
      await POST(
        req("calendar", {
          operation: "create",
          confirmed: false,
          requestId: id,
          value: meetingValue,
        }),
      )
    ).status,
    409,
  );
  assert.equal(graphCalls, 0);
});
test("Teams creation checks mailbox capability before creating an invitation", async () => {
  reset();
  const calls: { url: string; method: string; body: any }[] = [];
  globalThis.fetch = async (url, init) => {
    calls.push({
      url: String(url),
      method: init?.method || "GET",
      body: init?.body ? JSON.parse(String(init.body)) : null,
    });
    return Response.json(
      init?.method === "POST"
        ? {
            id: "event",
            onlineMeeting: { joinUrl: "https://teams.microsoft.com/meet/test" },
          }
        : { allowedOnlineMeetingProviders: ["teamsForBusiness"] },
    );
  };
  const response = await POST(
    req("calendar", {
      operation: "create",
      confirmed: true,
      requestId: id,
      value: meetingValue,
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /\/me\/calendar\?/);
  assert.equal(calls[1].body.isOnlineMeeting, true);
  assert.equal(calls[1].body.onlineMeetingProvider, "teamsForBusiness");
  assert.equal(calls[1].body.transactionId, id);
  assert.equal(
    calls[1].body.attendees[0].emailAddress.address,
    "guest@example.com",
  );
});
test("missing Teams entitlement stops before any mutation or invitation audit", async () => {
  reset();
  const methods: string[] = [];
  globalThis.fetch = async (_url, init) => {
    methods.push(init?.method || "GET");
    return Response.json({ allowedOnlineMeetingProviders: [] });
  };
  const response = await POST(
    req("calendar", {
      operation: "create",
      confirmed: true,
      requestId: id,
      value: meetingValue,
    }),
  );
  assert.equal(response.status, 409);
  assert.deepEqual(methods, ["GET"]);
  assert.equal(rows.ema_mail_audit?.length || 0, 0);
});
test("own existing appointment converts to Teams but foreign organizers cannot convert", async () => {
  for (const organizer of [true, false]) {
    reset();
    let patch: any;
    let capability = 0;
    globalThis.fetch = async (url, init) => {
      if (init?.method === "PATCH") {
        patch = JSON.parse(String(init.body));
        return Response.json({ id: "event" });
      }
      if (String(url).includes("/me/calendar?")) {
        capability++;
        return Response.json({
          allowedOnlineMeetingProviders: ["teamsForBusiness"],
        });
      }
      return Response.json({
        isOrganizer: organizer,
        isOnlineMeeting: false,
        attendees: [],
      });
    };
    const response = await POST(
      req("calendar", {
        operation: "update",
        id: "event",
        confirmed: true,
        value: meetingValue,
      }),
    );
    assert.equal(response.status, organizer ? 200 : 403);
    assert.equal(capability, organizer ? 1 : 0);
    assert.equal(patch?.isOnlineMeeting, organizer ? true : undefined);
  }
});
test("existing Teams meeting preserves body and provider without re-provisioning", async () => {
  reset();
  let patch: any;
  const methods: string[] = [];
  globalThis.fetch = async (_url, init) => {
    methods.push(init?.method || "GET");
    if (init?.method === "PATCH") {
      patch = JSON.parse(String(init.body));
      return Response.json({ id: "event" });
    }
    return Response.json({
      isOrganizer: true,
      isOnlineMeeting: true,
      onlineMeetingProvider: "teamsForBusiness",
      attendees: [],
    });
  };
  assert.equal(
    (
      await POST(
        req("calendar", {
          operation: "update",
          id: "event",
          confirmed: true,
          value: meetingValue,
        }),
      )
    ).status,
    200,
  );
  assert.equal(patch.body, undefined);
  assert.equal(patch.isOnlineMeeting, undefined);
  assert.equal(patch.onlineMeetingProvider, undefined);
  assert.deepEqual(methods, ["GET", "PATCH"]);
});
test("month calendar validates bounds and binds pagination to the requested window", async () => {
  reset();
  const start = "2026-10-25T23:00:00.000Z",
    end = "2026-12-06T23:00:00.000Z";
  let captured = "";
  globalThis.fetch = async (url) => {
    captured = String(url);
    return Response.json({ value: [] });
  };
  const window = new URLSearchParams({ start, end });
  assert.equal(
    (
      await GET(
        new NextRequest(`https://ema.example/api/mail/calendar?${window}`),
      )
    ).status,
    200,
  );
  assert.equal(new URL(captured).searchParams.get("startDateTime"), start);
  assert.match(
    new URL(captured).searchParams.get("$select") || "",
    /onlineMeeting/,
  );
  for (const bad of [
    new URLSearchParams({ start }),
    new URLSearchParams({ start, end: start }),
    new URLSearchParams({ start, end: "2027-01-01T00:00:00Z" }),
  ])
    assert.equal(
      (
        await GET(
          new NextRequest(`https://ema.example/api/mail/calendar?${bad}`),
        )
      ).status,
      400,
    );
  window.set(
    "cursor",
    `https://graph.microsoft.com/v1.0/me/calendarView?${new URLSearchParams({ startDateTime: start, endDateTime: end, $skiptoken: "abc" })}`,
  );
  assert.equal(
    (
      await GET(
        new NextRequest(`https://ema.example/api/mail/calendar?${window}`),
      )
    ).status,
    200,
  );
  window.set("end", "2026-12-07T23:00:00.000Z");
  assert.equal(
    (
      await GET(
        new NextRequest(`https://ema.example/api/mail/calendar?${window}`),
      )
    ).status,
    400,
  );
});
test("Teams capability can be checked without creating an event or invitation", async () => {
  reset();
  let method = "";
  globalThis.fetch = async (_url, init) => {
    method = init?.method || "GET";
    return Response.json({
      allowedOnlineMeetingProviders: ["teamsForBusiness"],
    });
  };
  const response = await GET(
    new NextRequest("https://ema.example/api/mail/calendar-options"),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { teamsAvailable: true });
  assert.equal(method, "GET");
});

test("Teams conversion preserves all-day boundaries in the original Exchange timezone", async () => {
  reset();
  let patch: any;
  globalThis.fetch = async (url, init) => {
    if (init?.method === "PATCH") {
      patch = JSON.parse(String(init.body));
      return Response.json({ id: "event" });
    }
    return Response.json(
      String(url).includes("/me/calendar?")
        ? { allowedOnlineMeetingProviders: ["teamsForBusiness"] }
        : { isOrganizer: true, isAllDay: true, isOnlineMeeting: false },
    );
  };
  const response = await POST(
    req("calendar", {
      operation: "update",
      id: "event",
      confirmed: true,
      value: {
        ...meetingValue,
        start: "2026-11-13T23:00:00Z",
        end: "2026-11-14T23:00:00Z",
      },
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(patch.start, undefined);
  assert.equal(patch.end, undefined);
  assert.equal(patch.isOnlineMeeting, true);
});

test("actual analysis route rejects malformed model output without persisting partial results or drafts", async () => {
  reset();
  const key = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-only";
  globalThis.__mailFixture.admin.rpc = async () => ({
    data: true,
    error: null,
  });
  const targets: string[] = [];
  globalThis.fetch = async (url) => {
    targets.push(new URL(String(url)).hostname);
    return Response.json(
      String(url).startsWith("https://graph.microsoft.com/")
        ? {
            id: "message",
            subject: "Prüfen",
            from: { emailAddress: { address: "sender@example.com" } },
            bodyPreview: "Zwei offene Punkte",
          }
        : {
            status: "completed",
            output: [
              {
                type: "message",
                content: [{ type: "output_text", text: '{"summary":' }],
              },
            ],
          },
    );
  };
  try {
    const response = await POST(
      req("analyze", { mailbox: "me", id: "message" }),
    );
    assert.equal(response.status, 502);
    assert.match((await response.json()).error, /KI-Antwort/);
    assert.equal(rows.ema_mail_analysis, undefined);
    assert.equal(rows.ema_mail_insights, undefined);
    assert.equal(rows.ema_mail_drafts, undefined);
    assert.deepEqual(targets, ["graph.microsoft.com", "api.openai.com"]);
  } finally {
    if (key === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = key;
  }
});
test("actual analysis route caches only validated results under the current user without sending messages", async () => {
  reset();
  const key = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-only";
  globalThis.__mailFixture.admin.rpc = async () => ({
    data: true,
    error: null,
  });
  const value = {
    summary: "Zwei Punkte offen.",
    priority: "normal",
    reason: "Rückmeldung erbeten.",
    invoiceCandidate: false,
    suggestedReply: "Ich prüfe die beiden Punkte.",
    tasks: ["Punkte prüfen"],
  };
  const targets: string[] = [];
  globalThis.fetch = async (url) => {
    targets.push(String(url));
    return Response.json(
      String(url).startsWith("https://graph.microsoft.com/")
        ? {
            id: "message",
            subject: "Prüfen",
            from: { emailAddress: { address: "sender@example.com" } },
            bodyPreview: "Zwei offene Punkte",
          }
        : {
            status: "completed",
            output: [
              {
                type: "message",
                content: [{ type: "output_text", text: JSON.stringify(value) }],
              },
            ],
          },
    );
  };
  try {
    const response = await POST(
      req("analyze", { mailbox: "me", id: "message" }),
    );
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).analysis, value);
    assert.equal(rows.ema_mail_analysis[0].user_id, uid);
    assert.equal(rows.ema_mail_insights[0].message_id, "message");
    assert.equal(rows.ema_mail_drafts, undefined);
    assert.equal(targets.length, 2);
    assert.ok(targets.every((url) => !url.includes("/send")));
  } finally {
    if (key === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = key;
  }
});

test("AI connection test never reads a mailbox, forwards client content or stores a real draft", async () => {
  reset();
  const key = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-only";
  globalThis.__mailFixture.token = async () => {
    throw new Error("Mailbox must not be accessed");
  };
  globalThis.__mailFixture.admin.rpc = async () => ({
    data: true,
    error: null,
  });
  const value = {
    summary: "Fiktiver Termin.",
    priority: "normal",
    reason: "Test.",
    invoiceCandidate: false,
    suggestedReply: "Danke für den Vorschlag.",
    tasks: ["Termin prüfen"],
  };
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    calls++;
    assert.equal(String(url), "https://api.openai.com/v1/responses");
    const body = JSON.parse(String(init?.body));
    assert.ok(!body.input.includes("PRIVATE MAIL"));
    assert.match(body.input, /fiktive Testnachricht/);
    return Response.json({
      status: "completed",
      output: [
        {
          type: "message",
          content: [{ type: "output_text", text: JSON.stringify(value) }],
        },
      ],
    });
  };
  try {
    const response = await POST(
      req("analyze-test", {
        mailbox: "foreign@example.com",
        body: "PRIVATE MAIL",
      }),
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { analysis: value, test: true });
    assert.equal(calls, 1);
    assert.equal(rows.ema_mail_analysis, undefined);
    assert.equal(rows.ema_mail_drafts, undefined);
  } finally {
    if (key === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = key;
  }
});
test("AI connection test requires active staff, same origin, POST and the existing hourly budget", async () => {
  reset();
  globalThis.__mailFixture.admin.rpc = async () => ({
    data: false,
    error: null,
  });
  assert.equal((await POST(req("analyze-test", {}))).status, 429);
  assert.equal(
    (await GET(new NextRequest("https://ema.example/api/mail/analyze-test")))
      .status,
    405,
  );
  const cross = req("analyze-test", {});
  cross.headers.set("origin", "https://evil.example");
  assert.equal((await POST(cross)).status, 403);
  user = null;
  assert.equal((await POST(req("analyze-test", {}))).status, 401);
  reset();
  process.env.VERCEL_ENV = "preview";
  assert.equal((await POST(req("analyze-test", {}))).status, 503);
  assert.equal(graphCalls, 0);
});

test("swipe-compatible trash action moves the exact message into deleteditems without permanent deletion", async () => {
  reset();
  let captured: any;
  globalThis.fetch = async (url, init) => {
    captured = {
      url: String(url),
      method: init?.method,
      body: JSON.parse(String(init?.body)),
    };
    return Response.json({ id: "moved" });
  };
  const response = await POST(
    req("message-action", {
      mailbox: "me",
      id: "swiped-message",
      operation: "trash",
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(captured.method, "POST");
  assert.equal(
    captured.url,
    "https://graph.microsoft.com/v1.0/me/messages/swiped-message/move",
  );
  assert.deepEqual(captured.body, { destinationId: "deleteditems" });
  reset();
  rows.ema_mail_memberships = [
    {
      user_id: uid,
      mailbox: "team@example.com",
      can_read: true,
      can_write: false,
      can_send: false,
    },
  ];
  const denied = await POST(
    req("message-action", {
      mailbox: "team@example.com",
      id: "swiped-message",
      operation: "trash",
    }),
  );
  assert.equal(denied.status, 403);
  assert.equal(graphCalls, 0);
});


test("dashboard statistics are scoped to the selected authorized mailbox and the current user's active drafts", async () => {
  reset();
  rows.ema_mail_memberships = [{ user_id: uid, mailbox: "team@example.com", can_read: true }];
  rows.ema_mail_drafts = [
    {user_id:uid,payload:{mailbox:"me"},status:"draft"},
    {user_id:uid,payload:{mailbox:"me"},status:"approved"},
    {user_id:uid,payload:{mailbox:"me"},status:"submitted"},
    {user_id:"other",payload:{mailbox:"me"},status:"draft"},
    {user_id:uid,payload:{mailbox:"team@example.com"},status:"draft"},
  ];
  const paths:string[]=[];
  globalThis.fetch = async url => {paths.push(String(url)); return Response.json({unreadItemCount:String(url).includes("/me/")?42:7});};
  const own=await GET(new NextRequest("https://ema.example/api/mail/dashboard-stats"));
  assert.equal(own.status,200);
  assert.deepEqual(await own.json(),{unread:42,drafts:2});
  assert.match(own.headers.get("cache-control")||"",/no-store/);
  const shared=await GET(new NextRequest("https://ema.example/api/mail/dashboard-stats?mailbox=team%40example.com"));
  assert.equal(shared.status,200);
  assert.deepEqual(await shared.json(),{unread:7,drafts:1});
  assert.equal(paths.length,2);
  assert.ok(paths.every(path=>path.includes("mailFolders/inbox?$select=unreadItemCount")));
  const denied=await GET(new NextRequest("https://ema.example/api/mail/dashboard-stats?mailbox=foreign%40example.com"));
  assert.equal(denied.status,403);
  assert.equal(paths.length,2);
});
test("dashboard statistics reject invalid counters and are unavailable in preview", async () => {
  reset();
  for (const unreadItemCount of [-1,1.5,"2",null]) {
    globalThis.fetch = async () => Response.json({unreadItemCount});
    assert.equal((await GET(new NextRequest("https://ema.example/api/mail/dashboard-stats"))).status,502);
  }
  process.env.VERCEL_ENV="preview";
  assert.equal((await GET(new NextRequest("https://ema.example/api/mail/dashboard-stats"))).status,503);
});

test('message pagination accepts actual Graph OData folder links and rejects a different folder', async () => {
  reset();
  let calls = 0;
  globalThis.fetch = async (url) => {
    calls++;
    assert.equal(new URL(String(url)).pathname, '/v1.0/me/mailFolders/inbox/messages');
    return Response.json({value:[]});
  };
  const link = "https://graph.microsoft.com/v1.0/me/mailFolders('inbox')/messages?$skip=30";
  const response = await GET(new NextRequest('https://ema.example/api/mail/messages?' + new URLSearchParams({cursor:link})));
  assert.equal(response.status, 200);
  assert.equal(calls, 1);
  const denied = await GET(new NextRequest('https://ema.example/api/mail/messages?' + new URLSearchParams({cursor:link.replace("('inbox')", "('sentitems')")})));
  assert.equal(denied.status, 400);
  assert.equal(calls, 1);
});
test('normal pagination signs canonical user and folder IDs and binds replay to user, mailbox, folder and search',async()=>{
  reset(); let requested='';
  globalThis.fetch=async input=>{
    graphCalls++; requested=String(input);
    return Response.json({value:[], '@odata.nextLink':"https://graph.microsoft.com/v1.0/users('33333333-3333-4333-8333-333333333333')/mailFolders('opaque-inbox')/messages?$skiptoken=next"});
  };
  const first=await GET(new NextRequest('https://ema.example/api/mail/messages?mailbox=me&folder=inbox'));
  assert.equal(first.status,200); const data=await first.json(); assert.ok(data.cursor); assert.ok(!data.cursor.startsWith('https://'));
  const query=new URLSearchParams({mailbox:'me',folder:'inbox',cursor:data.cursor});
  assert.equal((await GET(new NextRequest(`https://ema.example/api/mail/messages?${query}`))).status,200);
  assert.ok(requested.includes('/users/33333333-3333-4333-8333-333333333333/mailFolders/opaque-inbox/messages?'));
  const before=graphCalls;
  query.set('folder','sentitems'); assert.equal((await GET(new NextRequest(`https://ema.example/api/mail/messages?${query}`))).status,400);
  query.set('folder','inbox');query.set('q','other'); assert.equal((await GET(new NextRequest(`https://ema.example/api/mail/messages?${query}`))).status,400);
  assert.equal(graphCalls,before);
  query.delete('q'); user={id:'44444444-4444-4444-8444-444444444444'};
  assert.equal((await GET(new NextRequest(`https://ema.example/api/mail/messages?${query}`))).status,400);
  assert.equal(graphCalls,before);
});
test('contact pagination accepts canonical user IDs only through owner-bound signed continuation links',async()=>{
  reset(); let requested='';
  globalThis.fetch=async input=>{
    graphCalls++; requested=String(input);
    return Response.json({value:[{id:'contact',displayName:'Saved Contact',emailAddresses:[{address:'sender@example.com'}]}], '@odata.nextLink':"https://graph.microsoft.com/v1.0/users('33333333-3333-4333-8333-333333333333')/contacts?$skiptoken=next"});
  };
  const first=await GET(new NextRequest('https://ema.example/api/mail/contacts'));
  assert.equal(first.status,200); const data=await first.json(); const cursor=data['@odata.nextLink'];
  assert.ok(cursor); assert.ok(!cursor.startsWith('https://'));
  assert.equal((await GET(new NextRequest('https://ema.example/api/mail/contacts?'+new URLSearchParams({cursor})))).status,200);
  assert.ok(requested.includes('/users/33333333-3333-4333-8333-333333333333/contacts?'));
  const before=graphCalls;user={id:'44444444-4444-4444-8444-444444444444'};
  assert.equal((await GET(new NextRequest('https://ema.example/api/mail/contacts?'+new URLSearchParams({cursor})))).status,400);
  assert.equal(graphCalls,before);
});
test('contact continuation cannot fetch a foreign host or another resource',async()=>{
  reset();
  for(const link of ['https://evil.example/contacts','https://graph.microsoft.com/v1.0/me/messages']){
    assert.equal((await GET(new NextRequest('https://ema.example/api/mail/contacts?'+new URLSearchParams({cursor:link})))).status,400);
  }
  assert.equal(graphCalls,0);
});

test('reading a message requests HTML while retaining immutable IDs and mailbox authorization', async () => {
  reset();
  let calls=0;
  globalThis.fetch = async (_url, init) => {
    calls++;
    assert.equal(new Headers(init?.headers).get('Prefer'), 'outlook.body-content-type="html", IdType="ImmutableId"');
    return Response.json({id:'img-test',body:{contentType:'html',content:'<img src="cid:logo">'}});
  };
  const read = await GET(new NextRequest('https://ema.example/api/mail/message?id=img-test'));
  assert.equal(read.status,200); assert.equal((await read.json()).message.body.contentType,'html');
  const denied = await GET(new NextRequest('https://ema.example/api/mail/message?id=img-test&mailbox=foreign%40example.com'));
  assert.equal(denied.status,403); assert.equal(calls,1);
});

test('translation is cached per user, language and source, using only the authorized Microsoft message', async () => {
  reset(); const previousKey=process.env.OPENAI_API_KEY; process.env.OPENAI_API_KEY='test-only';
  let providerCalls=0, limitCalls=0;
  globalThis.__mailFixture.admin.rpc=async()=>{limitCalls++;return {data:true,error:null};};
  const requests:string[]=[];
  globalThis.fetch=async(url,init)=>{
    requests.push(String(url));
    if(String(url).startsWith('https://graph.microsoft.com/')) {
      assert.equal(init?.method,undefined);
      return Response.json({id:'message',subject:'Original subject',body:{contentType:'text',content:'Original body'}});
    }
    providerCalls++;
    const input=JSON.parse(JSON.parse(String(init?.body)).input);
    assert.deepEqual(input,{subject:'Original subject',body:'Original body'});
    return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({subject:'Betreff',body:'Übersetzung'})}]}]});
  };
  try {
    const call=(target:string)=>POST(req('translate',{mailbox:'me',id:'message',target,body:'Untrusted browser text'}));
    const first=await call('de'); assert.equal(first.status,200); assert.equal((await first.json()).cached,false);
    const cached=await call('de'); assert.equal(cached.status,200); assert.equal((await cached.json()).cached,true); assert.equal(providerCalls,1);
    assert.equal((await call('en')).status,200); assert.equal(providerCalls,2);
    user={id:'33333333-3333-4333-8333-333333333333'};
    assert.equal((await call('de')).status,200); assert.equal(providerCalls,3); assert.equal(limitCalls,3);
    assert.equal(rows.ema_mail_analysis[0].user_id,uid);
    assert.equal(rows.ema_mail_analysis.length,3);
    assert.equal(rows.ema_mail_drafts,undefined); assert.equal(rows.ema_mail_insights,undefined);
    assert.ok(requests.every(url=>!url.includes('/send')));
  } finally { if(previousKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=previousKey; }
});
test('translation requires POST, valid targets, mailbox access, a user session and the existing AI budget', async () => {
  reset();
  assert.equal((await GET(new NextRequest('https://ema.example/api/mail/translate'))).status,405);
  assert.equal((await POST(req('translate',{mailbox:'me',id:'message',target:'fr'}))).status,400);
  assert.equal((await POST(req('translate',{mailbox:'foreign@example.com',id:'message',target:'de'}))).status,403);
  assert.equal(graphCalls,0);
  user=null;
  assert.equal((await POST(req('translate',{mailbox:'me',id:'message',target:'de'}))).status,401);
  reset(); globalThis.__mailFixture.admin.rpc=async()=>({data:false,error:null});
  globalThis.fetch=async(url)=>{assert.ok(String(url).startsWith('https://graph.microsoft.com/'));graphCalls++;return Response.json({id:'message',subject:'Original',bodyPreview:'Body'});};
  assert.equal((await POST(req('translate',{mailbox:'me',id:'message',target:'de'}))).status,429);
  assert.equal(graphCalls,1); assert.equal(rows.ema_mail_analysis,undefined);
});

test('draft AI returns a proposal without sending or creating a draft and caches by user, source and operation',async()=>{
  reset();const previousKey=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY='test-only';
  let calls=0;globalThis.__mailFixture.admin.rpc=async()=>({data:true,error:null});
  globalThis.fetch=async(url,init)=>{
    calls++;assert.equal(String(url),'https://api.openai.com/v1/responses');
    const input=JSON.parse(JSON.parse(String(init?.body)).input);
    assert.deepEqual(input,{subject:'Unterlagen',body:'bitte senden sie die unterlagen'});
    return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({subject:'Unterlagen',body:'Bitte senden Sie die Unterlagen.'})}]}]});
  };
  const input={mailbox:'me',subject:'Unterlagen',body:'bitte senden sie die unterlagen',mode:'improve'};
  try{
    let response=await POST(req('draft-assist',input));assert.equal(response.status,200);assert.equal((await response.json()).cached,false);
    response=await POST(req('draft-assist',input));assert.equal(response.status,200);assert.equal((await response.json()).cached,true);assert.equal(calls,1);
    assert.equal((await POST(req('draft-assist',{...input,mode:'en'}))).status,200);assert.equal(calls,2);
    user={id:'33333333-3333-4333-8333-333333333333'};
    assert.equal((await POST(req('draft-assist',input))).status,200);assert.equal(calls,3);
    assert.equal(rows.ema_mail_drafts,undefined);assert.equal(rows.ema_mail_insights,undefined);
    assert.equal(rows.ema_mail_analysis.length,3);
  }finally{if(previousKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=previousKey;}
});
test('draft AI requires the current sender permission, POST, valid source and AI budget',async()=>{
  reset();const input={mailbox:'team@example.com',subject:'Subject',body:'Body',mode:'en'};
  assert.equal((await GET(new NextRequest('https://ema.example/api/mail/draft-assist'))).status,405);
  assert.equal((await POST(req('draft-assist',{...input,to:['somebody@example.com']}))).status,400);
  rows.ema_mail_memberships=[{user_id:uid,mailbox:'team@example.com',can_read:true,can_write:true,can_send:false}];
  assert.equal((await POST(req('draft-assist',input))).status,403);
  rows.ema_mail_memberships[0].can_send=true;
  globalThis.__mailFixture.admin.rpc=async()=>({data:false,error:null});
  assert.equal((await POST(req('draft-assist',input))).status,429);
  assert.equal(graphCalls,0);assert.equal(rows.ema_mail_analysis,undefined);
  user=null;assert.equal((await POST(req('draft-assist',input))).status,401);
});

test('draft formulation starts from a briefing without an existing email and caches different briefings separately',async()=>{
  reset();const previousKey=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY='test-only';
  let calls=0;globalThis.__mailFixture.admin.rpc=async()=>({data:true,error:null});
  globalThis.fetch=async(url,init)=>{
    calls++;assert.equal(String(url),'https://api.openai.com/v1/responses');
    const source=JSON.parse(JSON.parse(String(init?.body)).input);
    assert.match(source.body,/Auftrag und Stichpunkte/);
    return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({subject:'Unterlagen',body:'Bitte senden Sie uns die Unterlagen.'})}]}]});
  };
  const input={mailbox:'me',subject:'',body:'',mode:'formulate',instructions:'Bitte freundlich um Unterlagen bitten.'};
  try{
    assert.equal((await POST(req('draft-assist',{...input,instructions:''}))).status,400);assert.equal(calls,0);
    const first=await POST(req('draft-assist',input));assert.equal(first.status,200);assert.equal((await first.json()).cached,false);
    const again=await POST(req('draft-assist',input));assert.equal(again.status,200);assert.equal((await again.json()).cached,true);assert.equal(calls,1);
    assert.equal((await POST(req('draft-assist',{...input,instructions:'Bitte auf Englisch um Unterlagen bitten.'}))).status,200);assert.equal(calls,2);
    assert.equal(rows.ema_mail_drafts,undefined);assert.equal(rows.ema_mail_insights,undefined);
  }finally{if(previousKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=previousKey;}
});
