import test from "node:test";
import assert from "node:assert/strict";
import {
  operationTimeout,
  deltaPath,
  checkedDeltaLink,
  newMessageIds,
  synchronizeInbox,
  processMailJob,
  retryAt,
  type SyncState,
  type MailJob,
  type DeltaPage,
} from "../src/lib/mail/automation";
import {
  contactSchema,
  eventSchema,
  graphContact,
  graphEvent,
  assertPimConfirmation,
} from "../src/lib/mail/pim";
import { safePushEndpoint } from "../src/lib/mail/push";
import { validateStoredAttachment } from "../src/lib/mail/attachments";
const state: SyncState = {
  user_id: "user",
  mailbox: "me",
  enabled: true,
  analyze: true,
  push: true,
  enabled_since: "2026-11-14T08:00:00Z",
  cursor: null,
  lease_id: "lease",
};
const job: MailJob = {
  id: "job",
  user_id: "user",
  mailbox: "me",
  message_id: "msg",
  attempts: 1,
  lease_id: "lease",
  analysis_done: false,
  push_state: "pending",
};
const page: DeltaPage = {
  value: [
    { id: "new", receivedDateTime: "2026-11-14T09:00:00Z" },
    { id: "old", receivedDateTime: "2026-11-13T09:00:00Z" },
    { id: "new", receivedDateTime: "2026-11-14T09:00:00Z" },
    { id: "removed", "@removed": {}, receivedDateTime: "2026-11-14T09:00:00Z" },
  ],
  "@odata.deltaLink":
    "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages/delta?$deltatoken=safe",
};
test("delta is folder and mailbox scoped; opaque cursor stays intact", () => {
  assert.match(deltaPath(state), /changeType=created/);
  assert.deepEqual(newMessageIds(page, state.enabled_since), ["new"]);
  assert.equal(
    checkedDeltaLink(page["@odata.deltaLink"]!, "me"),
    page["@odata.deltaLink"],
  );
  for (const url of [
    "https://evil.example/v1.0/me/mailFolders/inbox/messages/delta",
    "https://graph.microsoft.com/v1.0/users/other/mailFolders/inbox/messages/delta",
    "https://graph.microsoft.com/v1.0/me/mailFolders/sentitems/messages/delta",
  ])
    assert.throws(() => checkedDeltaLink(url, "me"));
});
test("initial history does not create notifications, including drafts/malformed times", () => {
  assert.deepEqual(
    newMessageIds(
      {
        value: [
          { id: "old", receivedDateTime: "2026-11-13T00:00:00Z" },
          { id: "bad", receivedDateTime: "nonsense" },
          {
            id: "draft",
            receivedDateTime: "2026-11-15T00:00:00Z",
            isDraft: true,
          } as any,
        ],
      },
      state.enabled_since,
    ),
    [],
  );
});
test("cursor is committed only after durable enqueue and valid next link", async () => {
  const calls: string[] = [];
  await synchronizeInbox(state, {
    authorized: async () => true,
    read: async () => page,
    enqueue: async (id) => {
      calls.push(id);
    },
    checkpoint: async () => {
      calls.push("checkpoint");
    },
  });
  assert.deepEqual(calls, ["new", "checkpoint"]);
});
test("partial enqueue failure retains cursor for idempotent replay", async () => {
  let committed = false;
  await assert.rejects(() =>
    synchronizeInbox(state, {
      authorized: async () => true,
      read: async () => page,
      enqueue: async () => {
        throw new Error("db down");
      },
      checkpoint: async () => {
        committed = true;
      },
    }),
  );
  assert.equal(committed, false);
});
test("foreign or incomplete delta response is rejected before enqueue", async () => {
  for (const p of [
    { value: [] },
    { ...page, "@odata.deltaLink": "https://evil.example/steal" },
  ]) {
    let queued = 0;
    await assert.rejects(() =>
      synchronizeInbox(state, {
        authorized: async () => true,
        read: async () => p,
        enqueue: async () => {
          queued++;
        },
        checkpoint: async () => {},
      }),
    );
    assert.equal(queued, 0);
  }
});
test("revocation stops sync before Graph and during enqueue", async () => {
  let reads = 0;
  await assert.rejects(() =>
    synchronizeInbox(state, {
      authorized: async () => false,
      read: async () => {
        reads++;
        return page;
      },
      enqueue: async () => {},
      checkpoint: async () => {},
    }),
  );
  assert.equal(reads, 0);
  let checks = 0,
    committed = false;
  await assert.rejects(() =>
    synchronizeInbox(state, {
      authorized: async () => ++checks === 1,
      read: async () => page,
      enqueue: async () => {},
      checkpoint: async () => {
        committed = true;
      },
    }),
  );
  assert.equal(committed, false);
});
function deps(events: string[], authorized = async () => true) {
  return {
    authorized,
    read: async () => {
      events.push("read");
      return { id: "msg" } as any;
    },
    analyze: async () => {
      events.push("analyze");
    },
    analysisDone: async () => {
      events.push("saved");
    },
    push: async () => {
      events.push("push");
    },
    complete: async () => {
      events.push("done");
    },
    cancel: async () => {
      events.push("cancel");
    },
  };
}
test("worker creates analysis only through supplied capabilities, with early private push", async () => {
  const events: string[] = [];
  await processMailJob(job, deps(events));
  assert.deepEqual(events, ["push", "read", "analyze", "saved", "done"]);
  assert.ok(!events.includes("send"));
});
test("worker skips completed AI stage after retry", async () => {
  const events: string[] = [];
  await processMailJob({ ...job, analysis_done: true }, deps(events));
  assert.deepEqual(events, ["push", "done"]);
});
test("revoked job has no read, AI, or push side effects", async () => {
  const events: string[] = [];
  assert.equal(
    await processMailJob(
      job,
      deps(events, async () => false),
    ),
    "cancelled",
  );
  assert.deepEqual(events, ["cancel"]);
});
test("rate-limited AI does not prevent arrival notification", async () => {
  const events: string[] = [];
  const d = deps(events);
  d.analyze = async () => {
    throw new Error("budget");
  };
  await assert.rejects(() => processMailJob(job, d));
  assert.equal(events[0], "push");
  assert.ok(!events.includes("done"));
});
test("push failure does not discard completed AI stage", async () => {
  const events: string[] = [];
  const d = deps(events);
  d.push = async () => {
    throw new Error("push unavailable");
  };
  await assert.rejects(() => processMailJob(job, d));
  assert.ok(events.includes("saved"));
  assert.ok(!events.includes("done"));
});
test("bounded retry backoff honors an exhausted hourly budget", () => {
  assert.equal(Date.parse(retryAt(1, 0)), 60000);
  assert.equal(Date.parse(retryAt(10, 0)), 3600000);
  assert.equal(Date.parse(retryAt(1, 0, 3600)), 3600000);
});
test("push endpoint restricts providers and rejects SSRF/credentials", () => {
  for (const value of [
    "https://fcm.googleapis.com/a",
    "https://web.push.apple.com/a",
    "https://updates.push.services.mozilla.com/a",
  ])
    assert.ok(safePushEndpoint(value));
  for (const value of [
    "http://fcm.googleapis.com/a",
    "https://fcm.googleapis.com.evil.example/a",
    "https://127.0.0.1/a",
    "https://user:pass@web.push.apple.com/a",
    "https://web.push.apple.com:444/a",
    "https://example.com",
  ])
    assert.equal(safePushEndpoint(value), false);
});
test("calendar validation and invitation confirmation are mandatory", () => {
  const v = eventSchema.parse({
    subject: "Termin",
    start: "2026-11-14T10:00:00Z",
    end: "2026-11-14T11:00:00Z",
    attendees: ["test@example.com"],
  });
  assert.equal(
    graphEvent(v, "request").attendees[0].emailAddress.address,
    "test@example.com",
  );
  assert.equal(graphEvent(v, "request").transactionId, "request");
  assert.throws(() => eventSchema.parse({ ...v, end: "2026-11-14T09:00:00Z" }));
  assert.throws(() => assertPimConfirmation(false));
  assert.doesNotThrow(() => assertPimConfirmation(true));
});
test("contact mapping rejects unknown sender and invalid mail fields", () => {
  assert.equal(
    graphContact(
      contactSchema.parse({ displayName: "Test", email: "test@example.com" }),
    ).emailAddresses[0].address,
    "test@example.com",
  );
  assert.throws(() =>
    contactSchema.parse({ displayName: "Test", email: "wrong" }),
  );
  assert.throws(() =>
    contactSchema.parse({ displayName: "Test", email: "", user_id: "other" }),
  );
});
test("DMS validates actual file signatures, not untrusted MIME alone", () => {
  assert.doesNotThrow(() =>
    validateStoredAttachment(
      new Uint8Array([37, 80, 68, 70, 45]),
      "application/pdf",
    ),
  );
  assert.doesNotThrow(() =>
    validateStoredAttachment(
      new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
      "image/png",
    ),
  );
  assert.throws(() =>
    validateStoredAttachment(
      new TextEncoder().encode("<script>"),
      "application/pdf",
    ),
  );
});
test("delta cursor binds resolved Inbox ID and accepts Microsoft OData spelling", () => {
  for (const url of [
    "https://graph.microsoft.com/v1.0/me/mailFolders/AAMk%3D%3D/messages/delta?$deltatoken=x",
    "https://graph.microsoft.com/v1.0/me/mailfolders('AAMk==')/messages/delta?$deltatoken=x",
  ]) {
    assert.equal(checkedDeltaLink(url, "me", "AAMk=="), new URL(url).href);
  }
  assert.throws(() =>
    checkedDeltaLink(
      "https://graph.microsoft.com/v1.0/me/mailFolders/OTHER/messages/delta",
      "me",
      "AAMk==",
    ),
  );
});

test("worker bounds network calls and refuses new work after its budget", () => {
  assert.equal(operationTimeout(50000, 20000, 0), 20000);
  assert.equal(operationTimeout(5000, 20000, 0), 2000);
  assert.throws(() => operationTimeout(3000, 20000, 0), /Laufzeitbudget/);
});

test("Teams is opt-in and only adds Microsoft's calendar meeting provider", () => {
  const base = {
    subject: "Besprechung",
    start: "2026-11-14T10:00:00Z",
    end: "2026-11-14T11:00:00Z",
  };
  assert.equal(graphEvent(eventSchema.parse(base)).isOnlineMeeting, undefined);
  const meeting = graphEvent(
    eventSchema.parse({
      ...base,
      teamsMeeting: true,
      attendees: ["guest@example.com"],
    }),
  );
  assert.equal(meeting.isOnlineMeeting, true);
  assert.equal(meeting.onlineMeetingProvider, "teamsForBusiness");
  assert.equal(meeting.attendees[0].emailAddress.address, "guest@example.com");
  assert.throws(() => eventSchema.parse({ ...base, teamsMeeting: "true" }));
});
