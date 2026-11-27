// Checks the contact form's server function (api/contact.ts) without sending
// real email: Resend is replaced by a stand-in that records what it was given.
import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { FROM, POST, TO } from "../api/contact.ts";

type Sent = { url: string; body: Record<string, unknown> };

function post(fields: Record<string, string>, accept = "application/json") {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return new Request("https://robxbridges.com/api/contact", {
    method: "POST",
    headers: { Accept: accept, Referer: "https://robxbridges.com/music" },
    body: form,
  });
}

function fakeResend(status = 200): Sent[] {
  const sent: Sent[] = [];
  globalThis.fetch = async (url, init) => {
    sent.push({ url: String(url), body: JSON.parse(String(init?.body)) });
    return new Response("{}", { status });
  };
  return sent;
}

const good = { name: "Ana", email: "ana@example.com", message: "Hello Rob" };
process.env.RESEND_API_KEY = "test-key";

test("the inbox is the Site Email in links.md", () => {
  const links = fs.readFileSync("references/links.md", "utf8");
  assert.match(links, new RegExp(`^- Email: ${TO.replace(".", "\\.")}$`, "m"));
  assert.match(FROM, /@robxbridges\.com>$/);
});

test("a good message goes to Rob, and Reply answers the visitor", async () => {
  const sent = fakeResend();
  const response = await POST(post(good));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].url, "https://api.resend.com/emails");
  assert.deepEqual(sent[0].body.to, [TO]);
  assert.equal(sent[0].body.reply_to, "ana@example.com");
  assert.match(String(sent[0].body.text), /Hello Rob/);
});

test("bad fields are refused and nothing is sent", async () => {
  const sent = fakeResend();
  for (const bad of [
    { ...good, name: "" },
    { ...good, email: "not-an-email" },
    { ...good, message: "   " },
    { ...good, message: "x".repeat(5001) },
  ]) {
    assert.equal((await POST(post(bad))).status, 400);
  }
  assert.equal(sent.length, 0);
});

test("a bot that fills the hidden field is ignored quietly", async () => {
  const sent = fakeResend();
  const response = await POST(post({ ...good, website: "spam.example" }));
  assert.equal(response.status, 200);
  assert.equal(sent.length, 0);
});

test("a Resend failure is reported, not hidden", async () => {
  fakeResend(500);
  assert.equal((await POST(post(good))).status, 502);
});

test("without the key it says so", async () => {
  fakeResend();
  delete process.env.RESEND_API_KEY;
  assert.equal((await POST(post(good))).status, 503);
  process.env.RESEND_API_KEY = "test-key";
});

test("without JavaScript the browser goes back to the contact section", async () => {
  fakeResend();
  const response = await POST(post(good, "text/html"));
  assert.equal(response.status, 303);
  assert.equal(
    response.headers.get("location"),
    "https://robxbridges.com/music#contact",
  );
});
