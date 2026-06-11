import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';

import type { JournalEntry, JournalTag } from '@/lib/data/models';
import { useUserId } from '@/lib/auth/provider';
import { uuid } from '@/lib/uuid';

import { fetchJournal } from './api';
import { keys } from './keys';
import { enqueue } from './outbox';
import { queryClient } from './query-client';
import { wireToJournalEntry } from './types';

export function useJournal() {
  const uid = useUserId();
  return useQuery({
    queryKey: keys.journal(uid),
    enabled: uid !== '',
    queryFn: async (): Promise<JournalEntry[]> => {
      const res = await fetchJournal();
      return res.entries.map(wireToJournalEntry);
    },
  });
}

function patchJournal(uid: string, fn: (entries: JournalEntry[]) => JournalEntry[]) {
  queryClient.setQueryData<JournalEntry[]>(keys.journal(uid), (prev) => fn(prev ?? []));
}

// Newest-touched first, matching the server's (and the old SQLite) ordering.
function sortEntries(entries: JournalEntry[]): JournalEntry[] {
  return [...entries].sort((a, b) =>
    (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt),
  );
}

export function useCreateJournalEntry() {
  const uid = useUserId();
  return useCallback(
    async (input: { tag: JournalTag; body: string | null }): Promise<string> => {
      const now = new Date().toISOString();
      const entry: JournalEntry = {
        id: uuid(),
        tag: input.tag,
        body: input.body,
        createdAt: now,
        updatedAt: now,
      };
      patchJournal(uid, (entries) => sortEntries([entry, ...entries]));
      await enqueue({
        method: 'PUT',
        path: `/data/journal/${entry.id}`,
        body: { tag: entry.tag, body: entry.body, created_at: now },
        touches: [keys.journal(uid)],
      });
      return entry.id;
    },
    [uid],
  );
}

export function useUpdateJournalEntry() {
  const uid = useUserId();
  return useCallback(
    async (id: string, patch: { tag?: JournalTag; body?: string | null }): Promise<void> => {
      const now = new Date().toISOString();
      patchJournal(uid, (entries) =>
        sortEntries(entries.map((e) => (e.id === id ? { ...e, ...patch, updatedAt: now } : e))),
      );
      await enqueue({
        method: 'PUT',
        path: `/data/journal/${id}`,
        body: {
          ...(patch.tag !== undefined ? { tag: patch.tag } : {}),
          ...(patch.body !== undefined ? { body: patch.body } : {}),
        },
        touches: [keys.journal(uid)],
      });
    },
    [uid],
  );
}

export function useDeleteJournalEntry() {
  const uid = useUserId();
  return useCallback(
    async (id: string): Promise<void> => {
      patchJournal(uid, (entries) => entries.filter((e) => e.id !== id));
      await enqueue({
        method: 'DELETE',
        path: `/data/journal/${id}`,
        touches: [keys.journal(uid)],
      });
    },
    [uid],
  );
}
