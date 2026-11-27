// The contact form at the bottom of every page posts here (/api/contact).
// Vercel runs this file as a small server function. It checks the message
// and emails it to Rob through Resend (resend.com).
//
// Setup, once, in the Vercel project (Settings, Environment Variables):
//   RESEND_API_KEY  an API key from the Resend account. Never put it in the repo.
// Resend only sends from a domain verified in that account (robxbridges.com).

// Who receives the messages. Keep it the same as the Site Email in
// references/links.md (a test checks that).
export const TO = "robbridgesmusic@gmail.com";
// Who the email says it is from. Replying answers the visitor, not this address.
export const FROM = "robxbridges.com <contact@robxbridges.com>";

const LIMITS = { name: 200, email: 200, message: 5000 };
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type Answer = { ok: boolean; error?: string };

export async function POST(request: Request): Promise<Response> {
  const wantsJson = (request.headers.get("accept") ?? "").includes("application/json");
  const reply = (status: number, answer: Answer): Response => {
    // Without JavaScript the browser posted the form itself, so send it back
    // to the contact section of the page it came from.
    if (!wantsJson && answer.ok) {
      const back = request.headers.get("referer") ?? "/";
      return Response.redirect(new URL("#contact", back).toString(), 303);
    }
    return Response.json(answer, { status });
  };

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return reply(400, { ok: false, error: "Could not read the form." });
  }
  const field = (key: string) => {
    const value = form.get(key);
    return typeof value === "string" ? value.trim() : "";
  };

  // The hidden spam trap. People never fill it, bots do. Pretend it worked.
  if (field("website")) return reply(200, { ok: true });

  const name = field("name");
  const email = field("email");
  const message = field("message");
  if (!name || name.length > LIMITS.name)
    return reply(400, { ok: false, error: "name" });
  if (!EMAIL_SHAPE.test(email) || email.length > LIMITS.email)
    return reply(400, { ok: false, error: "email" });
  if (!message || message.length > LIMITS.message)
    return reply(400, { ok: false, error: "message" });

  const key = process.env.RESEND_API_KEY;
  if (!key) return reply(503, { ok: false, error: "Email is not set up." });

  const sent = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM,
      to: [TO],
      reply_to: email,
      subject: `Message from ${name.replace(/[\r\n]+/g, " ")} (robxbridges.com)`,
      text: `${message}\n\n${name}\n${email}`,
    }),
  }).catch(() => null);

  if (!sent?.ok) return reply(502, { ok: false, error: "The email service failed." });
  return reply(200, { ok: true });
}
