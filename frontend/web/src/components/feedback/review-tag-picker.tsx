"use client";

export function ReviewTagPicker({
  tags,
  selectedTags,
  onChange,
  label = "What stood out?",
}: {
  tags: string[];
  selectedTags: string[];
  onChange: (tags: string[]) => void;
  label?: string;
}) {
  function toggleTag(tag: string) {
    onChange(selectedTags.includes(tag) ? selectedTags.filter((item) => item !== tag) : [...selectedTags, tag]);
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <div className="flex flex-wrap gap-2" aria-label={label}>
        {tags.map((tag) => {
          const isSelected = selectedTags.includes(tag);

          return (
            <button
              key={tag}
              type="button"
              aria-pressed={isSelected}
              className={
                isSelected
                  ? "rounded-full border border-primary bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                  : "rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
              }
              onClick={() => toggleTag(tag)}
            >
              {tag}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function formatTaggedFeedback(comment: string, tags: string[]) {
  const trimmed = comment.trim();
  const tagSummary = tags.length ? `Tags: ${tags.join(", ")}` : "";

  if (trimmed && tagSummary) {
    return `${trimmed}\n\n${tagSummary}`;
  }

  return trimmed || tagSummary || undefined;
}