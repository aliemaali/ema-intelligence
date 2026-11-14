import test from "node:test";
import assert from "node:assert/strict";
import {
  draftSchema,
  mailboxRoot,
  canUseMail,
  isMailEnabled,
  invoiceHint,
} from "../src/lib/mail/model";
import { safeGraphUrl, mailGraph } from "../src/lib/mail/graph";
import {
  assertOrigin,
  digest,
  newApproval,
  tokenHash,
  graphMessage,
  submitApprovedDraft,
} from "../src/lib/mail/security";
const draft = () =>
  draftSchema.parse({
    to: ["customer@example.com"],
    subject: "Prüfung",
    body: "Bitte prüfen.",
  });
test("mail opt-in fails closed; Vercel preview stays disabled even with live flag", () => {
  for (const env of [
    {},
    { EMA_MAIL_ENABLED: "false" },
    { EMA_MAIL_ENABLED: "true", VERCEL_ENV: "preview" },
  ])
    assert.equal(isMailEnabled(env), false);
  assert.equal(
    isMailEnabled({ EMA_MAIL_ENABLED: "true", VERCEL_ENV: "production" }),
    true,
  );
});
test("only active internal roles may enter; partner, missing, disabled denied", () => {
  for (const p of [
    null,
    { role: "partner", is_active: true },
    { role: "admin", is_active: false },
    { role: "admin" },
    { role: "unknown", is_active: true },
  ])
    assert.equal(canUseMail(p), false);
  assert.equal(canUseMail({ role: "employee", is_active: true }), true);
});
test("mailbox path cannot inject path or URL", () => {
  assert.equal(mailboxRoot("me"), "/me");
  assert.equal(mailboxRoot("team@example.com"), "/users/team%40example.com");
  for (const s of ["../me", "https://evil.example", "me/messages", "foo"])
    assert.throws(() => mailboxRoot(s));
});
test("rejects foreign host, userinfo, protocol, prefix tricks, other mailbox pagination", () => {
  for (const path of [
    "https://evil.example/v1.0/me/messages",
    "https://graph.microsoft.com.evil.example/v1.0/me/messages",
    "http://graph.microsoft.com/v1.0/me/messages",
    "https://x@graph.microsoft.com/v1.0/me/messages",
    "https://graph.microsoft.com/beta/me/messages",
    "https://graph.microsoft.com/v1.0/users/other/messages",
    "https://graph.microsoft.com/v1.0/me2/messages",
  ])
    assert.throws(() => safeGraphUrl(path, "/me"));
  assert.equal(
    safeGraphUrl("/me/messages?$skiptoken=abc", "/me"),
    "https://graph.microsoft.com/v1.0/me/messages?$skiptoken=abc",
  );
});
test("same-origin JSON required; cross-site and missing origin denied", () => {
  for (const headers of [
    {},
    { origin: "https://evil.example", "content-type": "application/json" },
    { origin: "https://ema.example", "content-type": "text/plain" },
    {
      origin: "https://ema.example",
      "content-type": "application/json",
      "sec-fetch-site": "cross-site",
    },
  ])
    assert.throws(() =>
      assertOrigin(
        new Request("https://ema.example/api/mail/send", {
          headers: headers as Record<string, string>,
        }),
      ),
    );
  assert.doesNotThrow(() =>
    assertOrigin(
      new Request("https://ema.example/api/mail/send", {
        headers: {
          origin: "https://ema.example",
          "content-type": "application/json",
        },
      }),
    ),
  );
});
test("draft validation rejects header injection, invalid recipients, extra sender, large attachment", () => {
  for (const patch of [
    { to: ["x"] },
    { subject: "x\r\nBcc:evil@example.com" },
    { sender: "admin@example.com" },
    { body: "" },
    {
      attachments: [
        {
          name: "../evil",
          contentType: "application/pdf",
          contentBytes: "YQ==",
        },
      ],
    },
    {
      attachments: [
        {
          name: "a",
          contentType: "text/plain",
          contentBytes: "a".repeat(2_800_004),
        },
      ],
    },
  ])
    assert.equal(
      draftSchema.safeParse({ ...draft(), ...patch }).success,
      false,
    );
});
test("approval hash covers sender mailbox, all recipient types, text and attachment bytes", () => {
  const d = draft(),
    hash = digest(d);
  for (const patch of [
    { mailbox: "team@example.com" },
    { to: ["other@example.com"] },
    { cc: ["copy@example.com"] },
    { bcc: ["hidden@example.com"] },
    { subject: "changed" },
    { body: "changed" },
    {
      attachments: [
        { name: "a.pdf", contentType: "application/pdf", contentBytes: "YQ==" },
      ],
    },
  ])
    assert.notEqual(digest({ ...d, ...patch }), hash);
});
test("approval tokens are unpredictable; only hash persisted; short TTL", () => {
  const a = newApproval(),
    b = newApproval();
  assert.notEqual(a.token, b.token);
  assert.equal(a.hash, tokenHash(a.token));
  assert.notEqual(a.hash, a.token);
  assert.ok(
    Date.parse(a.expires) > Date.now() + 290000 &&
      Date.parse(a.expires) <= Date.now() + 300000,
  );
});
test("outgoing message is plain text, keeps BCC and attachments, includes reconciliation ID", () => {
  const m = graphMessage(
    { ...draft(), bcc: ["hidden@example.com"] },
    "draft-id",
  );
  assert.equal(m.body.contentType, "Text");
  assert.equal(m.bccRecipients[0].emailAddress.address, "hidden@example.com");
  assert.equal(m.internetMessageHeaders[0].value, "draft-id");
});
test("successful submission reports accepted, not delivered", async () => {
  const states: string[] = [];
  let calls = 0;
  const result = await submitApprovedDraft(
    draft(),
    "id",
    async () => {
      calls++;
    },
    async (status) => {
      states.push(status);
    },
  );
  assert.equal(calls, 1);
  assert.deepEqual(states, ["submitted"]);
  assert.equal(result.status, "submitted");
  assert.match(result.message, /nicht bestätigt/);
});
test("ambiguous failure is marked uncertain without retry", async () => {
  const states: string[] = [];
  let calls = 0;
  await assert.rejects(
    () =>
      submitApprovedDraft(
        draft(),
        "id",
        async () => {
          calls++;
          throw new Error("timeout after acceptance");
        },
        async (status) => {
          states.push(status);
        },
      ),
    /Versandstatus unklar/,
  );
  assert.equal(calls, 1);
  assert.deepEqual(states, ["uncertain"]);
});
test("Graph client sends no token off-host, disallows redirects, handles empty 202", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    calls++;
    assert.equal(new URL(String(url)).hostname, "graph.microsoft.com");
    assert.equal(init?.redirect, "error");
    assert.equal(init?.cache, "no-store");
    assert.match(
      (init?.headers as Record<string, string>).Prefer,
      /content-type="text"/,
    );
    return new Response(null, { status: 202 });
  };
  try {
    await assert.rejects(() =>
      mailGraph("secret", "https://evil.example/path"),
    );
    assert.equal(calls, 0);
    assert.equal(
      await mailGraph("secret", "/me/sendMail", { method: "POST" }),
      undefined,
    );
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = original;
  }
});
test("invoice candidate is a hint and requires attachments", () => {
  assert.equal(
    invoiceHint({
      subject: "Rechnung",
      bodyPreview: "",
      hasAttachments: false,
    }),
    false,
  );
  assert.equal(
    invoiceHint({ subject: "Invoice", bodyPreview: "", hasAttachments: true }),
    true,
  );
});

test("approval hash includes the source message of a native reply", () => {
  const d = draft();
  assert.notEqual(
    digest({ ...d, replyToMessageId: "one" }),
    digest({ ...d, replyToMessageId: "two" }),
  );
});

test("receipt requests are opt-in, reach Graph independently and are bound to approval", () => {
  const d = draft();
  assert.equal(graphMessage(d, "id").isReadReceiptRequested, false);
  assert.equal(graphMessage(d, "id").isDeliveryReceiptRequested, false);
  for (const field of [
    "isReadReceiptRequested",
    "isDeliveryReceiptRequested",
  ] as const) {
    const next = draftSchema.parse({ ...d, [field]: true });
    assert.equal(graphMessage(next, "id")[field], true);
    assert.notEqual(digest(next), digest(d));
    assert.throws(() => draftSchema.parse({ ...d, [field]: "true" }));
  }
});
test("signature uses the supplied immutable image as CID and escapes mail text", () => {
  const d = draftSchema.parse({
    ...draft(),
    signatureId: "ali-unluer-v1",
    body: '<script>alert("x")</script>\nHello & goodbye',
  });
  const m = graphMessage(d, "id");
  assert.equal(m.body.contentType, "HTML");
  assert.ok(m.body.content.includes('width="320"'));
  assert.ok(m.body.content.includes("&lt;script&gt;"));
  assert.ok(m.body.content.includes("<br>Hello &amp; goodbye"));
  assert.ok(!m.body.content.includes("<script>"));
  assert.ok(m.body.content.includes('src="cid:ema-signature-ali-unluer-v1"'));
  assert.equal(m.attachments.length, 1);
  const a = m.attachments[0] as any;
  assert.equal(a.isInline, true);
  assert.equal(a.contentId, "ema-signature-ali-unluer-v1");
  assert.equal(a.contentType, "image/jpeg");
  assert.ok(Buffer.from(a.contentBytes, "base64").byteLength > 0);
  assert.notEqual(digest(d), digest(draft()));
});

test("rich HTML is canonical, keeps formatting and tables, removes executable content", async () => {
  const { sanitizeRichHtml } = await import("../src/lib/mail/rich-text");
  const dirty =
    '<p onclick="alert(1)"><b>Bold</b><i>Italic</i><span style="color:#ff0000;background:url(https://evil.example/x)">Red</span><a href="javascript:alert(1)">bad</a><a href="https://ema-enterprise.de">good</a></p><img src="https://evil.example/pixel"><svg onload="alert(1)"></svg><script>alert(1)</script><table><tr><td>Cell</td></tr></table>';
  const html = sanitizeRichHtml(dirty);
  assert.match(html, /<b>Bold<\/b>/);
  assert.match(html, /<table>/);
  assert.match(html, /#ff0000/);
  assert.ok(
    !/onclick|javascript:|<img|<svg|<script|background|evil\.example/.test(
      html,
    ),
  );
  assert.equal(sanitizeRichHtml(html), html);
  const d = draftSchema.parse({
    ...draft(),
    bodyHtml: dirty,
    signatureText: "<script>signature</script>",
  });
  const m = graphMessage(d, "id");
  assert.equal(m.body.contentType, "HTML");
  assert.ok(m.body.content.includes("&lt;script&gt;signature"));
  assert.notEqual(digest(d), digest(draft()));
});
test("reply-all excludes own address, deduplicates To/Cc and never copies Bcc", async () => {
  const { replyAllRecipients } = await import("../src/lib/mail/productivity");
  const a = (address: string) => ({ emailAddress: { address } });
  const result = replyAllRecipients(
    {
      id: "m",
      subject: "s",
      bodyPreview: "",
      receivedDateTime: new Date().toISOString(),
      isRead: true,
      hasAttachments: false,
      from: a("sender@example.com"),
      replyTo: [a("reply@example.com")],
      toRecipients: [
        a("UNLUER@EMA-ENTERPRISE.DE"),
        a("reply@example.com"),
        a("colleague@example.com"),
      ],
      ccRecipients: [a("colleague@example.com"), a("cc@example.com")],
    },
    "unluer@ema-enterprise.de",
  );
  assert.deepEqual(result, {
    to: ["reply@example.com", "colleague@example.com"],
    cc: ["cc@example.com"],
    bcc: [],
  });
});
test("scheduled time and personal signature are immutable approval inputs", async () => {
  const { checkSchedule } = await import("../src/lib/mail/productivity");
  const when = new Date(Date.now() + 3600000).toISOString();
  assert.equal(checkSchedule(when), when);
  assert.throws(() => checkSchedule(new Date(Date.now() - 1000).toISOString()));
  assert.throws(() =>
    checkSchedule(new Date(Date.now() + 31 * 86400000).toISOString()),
  );
  const d = draftSchema.parse({
    ...draft(),
    scheduledAt: when,
    signatureText: "Employee",
  });
  assert.notEqual(
    digest(d),
    digest({ ...d, scheduledAt: new Date(Date.now() + 7200000).toISOString() }),
  );
  assert.notEqual(digest(d), digest({ ...d, signatureText: "Changed" }));
});

test("file picker and drop share count, size and encoded-total limits", async () => {
  const { validateComposeFiles } = await import("../src/lib/mail/attachments");
  validateComposeFiles([], [{ size: 2_000_000 }]);
  assert.throws(() => validateComposeFiles([], [{ size: 2_000_001 }]));
  assert.throws(() =>
    validateComposeFiles(
      Array.from({ length: 10 }, () => ({ contentBytes: "" })),
      [{ size: 1 }],
    ),
  );
  assert.throws(() =>
    validateComposeFiles(
      [{ contentBytes: "a".repeat(2_800_000) }],
      [{ size: 200_000 }],
    ),
  );
});

import {
  monthDays,
  isoWeek,
  dayKey,
  eventOnDay,
  teamsJoinUrl,
} from "../src/lib/mail/calendar";
test("month grid is Monday-first, includes leap days and correct ISO year boundaries", () => {
  const november = monthDays(new Date(2026, 10, 1));
  assert.equal(november.length, 42);
  assert.equal(dayKey(november[0]), "2026-10-26");
  assert.equal(dayKey(november[41]), "2026-12-06");
  assert.equal(november[0].getDay(), 1);
  assert.deepEqual(
    november.filter((_, i) => i % 7 === 0).map(isoWeek),
    [44, 45, 46, 47, 48, 49],
  );
  assert.equal(
    monthDays(new Date(2024, 1, 1)).filter((d) => d.getMonth() === 1).length,
    29,
  );
  assert.equal(isoWeek(new Date(2027, 0, 1)), 53);
  assert.equal(isoWeek(new Date(2027, 0, 4)), 1);
});
test("calendar overlaps use exclusive ends and local days across daylight saving", () => {
  const previous = process.env.TZ;
  process.env.TZ = "Europe/Berlin";
  try {
    const event = {
      start: { dateTime: "2026-03-28T23:00:00Z" },
      end: { dateTime: "2026-03-29T22:00:00Z" },
    };
    assert.equal(eventOnDay(event, new Date(2026, 2, 29)), true);
    assert.equal(eventOnDay(event, new Date(2026, 2, 28)), false);
    assert.equal(eventOnDay(event, new Date(2026, 2, 30)), false);
    const days = monthDays(new Date(2026, 2, 1));
    assert.equal(new Set(days.map(dayKey)).size, days.length);
    assert.equal(days.filter((d) => d.getMonth() === 2).length, 31);
    assert.equal(
      eventOnDay(
        {
          start: { dateTime: "2026-11-14T22:30:00Z" },
          end: { dateTime: "2026-11-15T00:30:00Z" },
        },
        new Date(2026, 10, 15),
      ),
      true,
    );
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});
test("meeting join URLs reject scripts, credentials, insecure and lookalike domains", () => {
  for (const value of [
    "javascript:alert(1)",
    "http://teams.microsoft.com/meet/1",
    "https://teams.microsoft.com.evil.example/meet/1",
    "https://user@teams.microsoft.com/meet/1",
    "https://evil.example/",
  ])
    assert.equal(teamsJoinUrl(value), null);
  assert.equal(
    teamsJoinUrl("https://teams.microsoft.com/l/meetup-join/test"),
    "https://teams.microsoft.com/l/meetup-join/test",
  );
});
