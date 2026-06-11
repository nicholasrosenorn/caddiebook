// Query key factory. Every key is prefixed with the user id so an account
// switch can never read another account's cache (the persister buster is the
// second guard, clear-on-sign-out the third).

export const keys = {
  user: (uid: string) => ['u', uid] as const,
  rounds: (uid: string) => ['u', uid, 'rounds'] as const,
  roundFull: (uid: string, roundId: string) => ['u', uid, 'round', roundId] as const,
  stats: (uid: string) => ['u', uid, 'stats'] as const,
  courses: (uid: string) => ['u', uid, 'courses'] as const,
  journal: (uid: string) => ['u', uid, 'journal'] as const,
  settings: (uid: string) => ['u', uid, 'settings'] as const,
};

export type QueryKey = readonly unknown[];
