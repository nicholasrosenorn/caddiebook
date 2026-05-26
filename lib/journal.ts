import type { JournalTag } from '@/db/types';

export type JournalTagMeta = {
  key: JournalTag;
  /** Label shown on tag chips, filter rows, and entry cards. */
  label: string;
  /** Example shown as the editor body placeholder for this tag. */
  placeholder: string;
};

export const JOURNAL_TAGS: JournalTagMeta[] = [
  {
    key: 'swing_thought',
    label: 'Swing thought',
    placeholder: 'A feel or cue to remember…',
  },
  {
    key: 'practice_session',
    label: 'Practice session',
    placeholder: 'What you worked on and how it went…',
  },
  {
    key: 'round_summary',
    label: 'Round summary',
    placeholder: 'How the round went — takeaways, patterns…',
  },
];

const TAG_LABELS: Record<JournalTag, string> = JOURNAL_TAGS.reduce(
  (acc, t) => ({ ...acc, [t.key]: t.label }),
  {} as Record<JournalTag, string>,
);

export function journalTagLabel(tag: JournalTag): string {
  return TAG_LABELS[tag] ?? tag;
}

export function journalTagPlaceholder(tag: JournalTag): string {
  return JOURNAL_TAGS.find((t) => t.key === tag)?.placeholder ?? 'Write your thoughts…';
}

/** First non-empty line of the body, used as a card title/preview. */
export function journalPreviewTitle(body: string | null): string {
  const line = (body ?? '')
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  return line ?? '';
}
