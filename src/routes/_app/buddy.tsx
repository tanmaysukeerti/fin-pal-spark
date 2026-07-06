import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/primitives";
import { BuddyPanel } from "@/components/app/BuddyPanel";
import { clearBuddyMessagesFn } from "@/api/buddy";

export const Route = createFileRoute("/_app/buddy")({
  component: BuddyPage,
});

function BuddyPage() {
  const [resetKey, setResetKey] = useState(0);

  const clear = async () => {
    await clearBuddyMessagesFn();
    toast.success("Chat cleared");
    setResetKey((k) => k + 1);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        eyebrow="Buddy AI"
        title="Ask Buddy"
        subtitle="Your personal money coach. Ask about spending, net worth, streaks — or tell Buddy to move money into a pod."
        actions={
          <button onClick={clear} className="btn-ghost btn-danger text-sm">
            <Trash2 size={14} /> Clear chat
          </button>
        }
      />
      <div className="panel p-5 sm:p-6 mt-6 h-[68vh] flex flex-col">
        <BuddyPanel key={resetKey} />
      </div>
    </div>
  );
}
