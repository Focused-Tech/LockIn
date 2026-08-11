"use client";

/**
 * SUGGEST A QUESTION (E) — a follower control on a creator's published slate. The follower types a
 * plain-language idea; the server moderates it and the Locksmith reconstructs it into a compliant
 * proposal that lands in the CREATOR's queue. The follower can never publish — on success they just
 * see the reconstructed wording that was sent to the creator.
 */
import { useState, useTransition } from "react";
import { submitSuggestion } from "@/app/app/slate/[id]/suggest-actions";

export function SuggestQuestion({ slateId }: { slateId: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const submit = () =>
    start(async () => {
      setResult(null);
      const r = await submitSuggestion(slateId, text);
      if (r.ok) {
        setResult({ ok: true, msg: `Sent to the creator: “${r.question}”` });
        setText("");
      } else {
        setResult({ ok: false, msg: r.error });
      }
    });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center justify-between rounded border border-[#1E2A38] bg-[#12161E] px-4 py-2.5 text-sm font-medium text-[#E8ECF2]"
      >
        Suggest a question
        <span className="text-muted">＋</span>
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded border border-[#1E2A38] bg-[#12161E] px-4 py-3">
      <p className="text-sm font-semibold">Suggest a question</p>
      <p className="text-xs text-muted">
        Describe your idea in plain words. The Locksmith rewrites it into an allowed question for the
        creator to review — you can’t publish it, and the creator decides.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={300}
        rows={3}
        placeholder="e.g. who’s going to bring the most drama between the two of them tonight"
        className="w-full resize-none rounded border border-[#1E2A38] bg-[#0D1118] px-3 py-2 text-sm text-[#E8ECF2] outline-none placeholder:text-muted"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={pending || text.trim().length < 6}
          onClick={submit}
          className="rounded bg-[rgba(59,139,255,.14)] px-3 py-1.5 text-sm font-semibold text-[#3B8BFF] disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send to creator"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm font-medium text-muted">
          Cancel
        </button>
      </div>
      {result && (
        <p className={`text-xs ${result.ok ? "text-[#22C55E]" : "text-[#E85454]"}`}>{result.msg}</p>
      )}
    </div>
  );
}
