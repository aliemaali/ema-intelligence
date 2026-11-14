import test from "node:test";
import assert from "node:assert/strict";
import { analyzeMessage } from "../src/lib/mail/analysis";
import { MailError } from "../src/lib/mail/graph";
import type { Message } from "../src/lib/mail/model";
const mail: Message = {
  id: "test",
  subject: "Rückmeldung",
  from: { emailAddress: { address: "sender@example.com" } },
  bodyPreview: "Bitte Rückmeldung zu zwei Punkten.",
  receivedDateTime: "2026-11-14T10:00:00Z",
  isRead: true,
  hasAttachments: false,
};
const valid = {
  summary: "Rückmeldung erbeten.",
  priority: "normal",
  reason: "Zwei offene Punkte.",
  invoiceCandidate: false,
  suggestedReply: "Vielen Dank. Ich prüfe die beiden Punkte.",
  tasks: ["Beide Punkte prüfen"],
};
function completed(value: unknown = valid) {
  return {
    status: "completed",
    output: [
      { type: "reasoning", summary: [] },
      {
        type: "message",
        content: [{ type: "output_text", text: JSON.stringify(value) }],
      },
    ],
  };
}
async function fixture(run: () => Promise<void>) {
  const previousFetch = globalThis.fetch,
    previousKey = process.env.OPENAI_API_KEY,
    previousModel = process.env.EMA_MAIL_AI_MODEL;
  process.env.OPENAI_API_KEY = "test-only";
  delete process.env.EMA_MAIL_AI_MODEL;
  try {
    await run();
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.EMA_MAIL_AI_MODEL;
    else process.env.EMA_MAIL_AI_MODEL = previousModel;
  }
}
test("actual analysis request bounds match local validation and do not gain sending capabilities", () =>
  fixture(async () => {
    let request: any;
    let count = 0;
    globalThis.fetch = async (url, init) => {
      count++;
      assert.equal(String(url), "https://api.openai.com/v1/responses");
      request = JSON.parse(String(init?.body));
      return Response.json(completed());
    };
    assert.deepEqual(await analyzeMessage(mail), valid);
    const schema = request.text.format.schema.properties;
    assert.equal(schema.tasks.maxItems, 5);
    assert.equal(schema.tasks.items.maxLength, 200);
    assert.equal(schema.reason.maxLength, 500);
    assert.equal(schema.summary.maxLength, 2000);
    assert.equal(schema.suggestedReply.maxLength, 10000);
    assert.equal(request.text.format.strict, true);
    assert.equal(request.store, false);
    assert.equal(request.max_output_tokens, 1800);
    assert.equal(request.reasoning.effort, "low");
    assert.equal(request.tools, undefined);
    assert.equal(count, 1);
  }));
test("configured non-reasoning model stays unchanged and receives no reasoning setting", () =>
  fixture(async () => {
    process.env.EMA_MAIL_AI_MODEL = "gpt-4.1-mini";
    globalThis.fetch = async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      assert.equal(body.model, "gpt-4.1-mini");
      assert.equal(body.reasoning, undefined);
      return Response.json(completed());
    };
    await analyzeMessage(mail);
  }));
test("oversized or unexpected results fail closed instead of truncating replies or creating actions", () =>
  fixture(async () => {
    for (const value of [
      { ...valid, tasks: Array(6).fill("Prüfen") },
      { ...valid, tasks: ["x".repeat(201)] },
      { ...valid, reason: "x".repeat(501) },
      { ...valid, summary: "x".repeat(2001) },
      { ...valid, suggestedReply: "x".repeat(10001) },
      { ...valid, send: true },
      { ...valid, priority: "urgent" },
    ]) {
      globalThis.fetch = async () => Response.json(completed(value));
      await assert.rejects(
        analyzeMessage(mail),
        (error: unknown) => error instanceof MailError && error.status === 502,
      );
    }
  }));
test("incomplete, refused, empty and malformed provider output cannot become a successful analysis", () =>
  fixture(async () => {
    for (const payload of [
      {
        ...completed(),
        status: "incomplete",
        incomplete_details: { reason: "max_output_tokens" },
      },
      {
        status: "completed",
        output: [
          {
            type: "message",
            content: [{ type: "refusal", refusal: "private" }],
          },
        ],
      },
      { status: "completed", output: [] },
      { status: "completed", output: {} },
      {
        status: "completed",
        output: [
          {
            type: "message",
            content: [{ type: "output_text", text: '{"summary":' }],
          },
        ],
      },
      null,
    ]) {
      globalThis.fetch = async () => Response.json(payload);
      await assert.rejects(
        analyzeMessage(mail),
        (error: unknown) => error instanceof MailError && error.status === 502,
      );
    }
    globalThis.fetch = async () => new Response("not-json", { status: 200 });
    await assert.rejects(
      analyzeMessage(mail),
      (error: unknown) => error instanceof MailError && error.status === 502,
    );
  }));
test("network errors and overload produce controlled errors without automatic retries", () =>
  fixture(async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      throw new DOMException("private payload", "TimeoutError");
    };
    await assert.rejects(
      analyzeMessage(mail),
      (error: unknown) =>
        error instanceof MailError &&
        error.status === 504 &&
        !error.message.includes("private"),
    );
    assert.equal(calls, 1);
    globalThis.fetch = async () =>
      new Response("private provider failure", { status: 429 });
    await assert.rejects(
      analyzeMessage(mail),
      (error: unknown) =>
        error instanceof MailError &&
        error.status === 429 &&
        !error.message.includes("private"),
    );
  }));
test("failure diagnostics contain paths only, never message text or generated output", () =>
  fixture(async () => {
    const previous = console.warn,
      logs: unknown[][] = [];
    console.warn = (...args) => {
      logs.push(args);
    };
    try {
      globalThis.fetch = async () =>
        Response.json(
          completed({ ...valid, reason: "SENSITIVE " + "x".repeat(600) }),
        );
      await assert.rejects(
        analyzeMessage({ ...mail, bodyPreview: "SECRET MAIL" }),
      );
      const output = JSON.stringify(logs);
      assert.match(output, /reason/);
      assert.ok(!output.includes("SENSITIVE"));
      assert.ok(!output.includes("SECRET MAIL"));
      assert.ok(!output.includes("test-only"));
    } finally {
      console.warn = previous;
    }
  }));
