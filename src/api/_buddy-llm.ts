import Anthropic from "@anthropic-ai/sdk";
import type { PublicUser } from "../lib/auth/session";

export function hasClaude(): boolean {
  return typeof process !== "undefined" && !!process.env.ANTHROPIC_API_KEY;
}

/** Ask Claude for a Buddy reply grounded in the user's financial snapshot.
 *  Returns null on refusal/error so the caller can fall back to the local
 *  responder. Model + params follow the claude-api skill (Opus 4.8, no
 *  sampling params). */
export async function claudeReply(opts: {
  user: PublicUser;
  snapshot: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  message: string;
}): Promise<string | null> {
  try {
    const client = new Anthropic();
    const system =
      `You are "Buddy", a warm, concise money coach for teenagers in India, inside the finAI-Buddy app. ` +
      `Currency is Indian Rupees (₹). Keep replies to 2-4 sentences with at most one emoji. ` +
      `Use ONLY the numbers in the snapshot below — never invent figures. ` +
      `If the user asks to move money, tell them Buddy can do it when they say e.g. "save ₹100", or point them to the right page. ` +
      `Be encouraging and practical.\n\n` +
      `User: ${opts.user.name} (Level ${opts.user.level}).\n` +
      `Financial snapshot:\n${opts.snapshot}`;

    const msg = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 400,
      system,
      messages: [
        ...opts.history.slice(-8).map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: opts.message },
      ],
    });

    if (msg.stop_reason === "refusal") return null;
    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return text || null;
  } catch (e) {
    console.error("Claude Buddy error:", e);
    return null;
  }
}
