"use client";

// Curated emoji set (no dependency) grouped by category for the composer picker.
// Shared by the Chats + Communities composers.
export const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  { label: "Smileys", emojis: ["😀", "😁", "😂", "🤣", "😊", "😉", "😍", "😘", "😎", "🤔", "😴", "😅", "😇", "🙂", "🙃", "😢", "😭", "😡", "🥳", "🤯", "😳", "🥺", "😬", "🤗"] },
  { label: "Gestures", emojis: ["👍", "👎", "👌", "🙌", "👏", "🙏", "💪", "🤝", "👋", "✌️", "🤞", "👀", "🫡", "🤙"] },
  { label: "Hearts", emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💔", "💯", "✨", "🔥"] },
  { label: "Objects", emojis: ["🎉", "🎊", "✅", "❌", "⚠️", "🚀", "💡", "📌", "📎", "🔔", "⏰", "☕", "🍕", "🎯", "🐛", "👻"] },
];

/** Dependency-free emoji picker; calls onPick with the chosen glyph. */
export function EmojiPicker({ onPick }: { onPick: (e: string) => void }) {
  return (
    <div className="absolute bottom-12 left-3 z-10 max-h-64 w-72 overflow-y-auto rounded-xl border border-border bg-card p-2 shadow-lg">
      {EMOJI_GROUPS.map((g) => (
        <div key={g.label} className="mb-2">
          <div className="mb-1 px-1 text-[10px] font-semibold uppercase text-muted-foreground">{g.label}</div>
          <div className="grid grid-cols-8 gap-0.5">
            {g.emojis.map((e) => (
              <button key={e} type="button" onClick={() => onPick(e)} className="rounded-md p-1 text-lg leading-none hover:bg-muted" title={e}>
                {e}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
