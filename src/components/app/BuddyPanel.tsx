import { useEffect, useRef, useState } from "react";
import { Sparkles, Send, Loader2 } from "lucide-react";
import { useRouter } from "@tanstack/react-router";
import type { BuddyMessage } from "@/db/schema";
import { listBuddyMessagesFn, sendBuddyMessageFn } from "@/api/buddy";

const SUGGESTIONS = ["Show my week", "Save ₹100", "Where am I overspending?", "What's my net worth?"];

const GREETING: Pick<BuddyMessage, "role" | "content"> = {
  role: "assistant",
  content: "Hey! I'm Buddy 🤖 Ask me about your money — try \"where am I overspending?\" or tell me to \"save ₹100\".",
};

export function BuddyPanel({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [messages, setMessages] = useState<Array<Pick<BuddyMessage, "role" | "content">>>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listBuddyMessagesFn()
      .then((res) => setMessages(res.messages.map((m) => ({ role: m.role, content: m.content }))))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || sending) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content }]);
    setSending(true);
    try {
      const res = await sendBuddyMessageFn({ data: { content } });
      setMessages((m) => [...m, { role: "assistant", content: res.reply.content }]);
      // A "save ₹X" reply may have moved money — refresh loaders.
      if (/moved|completes the pod|done!/i.test(res.reply.content)) router.invalidate();
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Hmm, I couldn't reach the vault just now. Try again?" }]);
    } finally {
      setSending(false);
    }
  };

  const shown = messages.length ? messages : loaded ? [GREETING] : [];

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between shrink-0">
        <span className="chip"><Sparkles size={10} className="text-[#00E5FF]" /> Buddy AI</span>
        <span className="font-mono-tech text-[9px] text-white/40 tracking-widest">LOCAL · INR-TUNED</span>
      </div>

      <div ref={scrollRef} className={`mt-4 flex-1 min-h-0 space-y-3 overflow-y-auto pr-1 ${compact ? "max-h-[240px]" : ""}`}>
        {shown.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] bg-white/[0.06] text-sm rounded-2xl rounded-tr-sm px-3.5 py-2.5 border border-white/[0.06]">
                {m.content}
              </div>
            </div>
          ) : (
            <div key={i} className="flex items-start gap-2">
              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-[#00E5FF] to-[#1E1E5A] grid place-items-center shrink-0">
                <Sparkles size={12} className="text-[#06060F]" />
              </div>
              <div className="max-w-[85%] bg-[#00E5FF]/10 border border-[#00E5FF]/20 text-sm rounded-2xl rounded-tl-sm px-3.5 py-2.5 whitespace-pre-wrap">
                {m.content}
              </div>
            </div>
          ),
        )}
        {sending && (
          <div className="flex items-center gap-2 pl-9 text-white/40 text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-[#00E5FF] animate-pulse" />
            <span className="font-mono-tech tracking-wider">buddy is thinking…</span>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="mt-4 shrink-0 flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl pl-3 pr-1.5 py-1.5"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message Buddy…"
          aria-label="Message Buddy"
          className="flex-1 bg-transparent text-sm placeholder:text-white/30 focus:outline-none py-1.5"
        />
        <button type="submit" disabled={sending || !input.trim()} className="h-8 w-8 rounded-lg bg-[#00E5FF] text-[#06060F] grid place-items-center disabled:opacity-50" aria-label="Send">
          {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        </button>
      </form>

      <div className="mt-2 flex gap-1.5 flex-wrap shrink-0">
        {SUGGESTIONS.map((s) => (
          <button key={s} onClick={() => send(s)} disabled={sending}
            className="text-[11px] px-2.5 py-1 rounded-full border border-white/10 text-white/60 hover:text-white hover:border-white/20 transition disabled:opacity-50">
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
