/** Email sender. Uses Resend when RESEND_API_KEY is set; otherwise logs the
 *  message (and, in dev, returns the link so the UI can surface it). No email
 *  provider is required for the app to work. */
export type EmailResult = { sent: boolean; devLink?: string };

export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
  link?: string;
}): Promise<EmailResult> {
  const key = typeof process !== "undefined" ? process.env.RESEND_API_KEY : undefined;
  const from = (typeof process !== "undefined" && process.env.EMAIL_FROM) || "finAI-Buddy <onboarding@resend.dev>";

  if (key) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({ from, to: opts.to, subject: opts.subject, text: opts.text }),
      });
      if (res.ok) return { sent: true };
      console.error("Resend error:", await res.text());
    } catch (e) {
      console.error("Resend request failed:", e);
    }
  }

  // Dev fallback: log the message + link to the server console.
  console.log(`\n📧 [email → ${opts.to}] ${opts.subject}\n${opts.text}\n`);
  const isProd = typeof process !== "undefined" && process.env.NODE_ENV === "production";
  return { sent: false, devLink: isProd ? undefined : opts.link };
}
