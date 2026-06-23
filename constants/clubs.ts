export const CLUB_OPTIONS = [
  '60°',
  '58°',
  '56°',
  '54°',
  '52°',
  '50°',
  '48°',
  '46°',
  'PW',
  '9i',
  '8i',
  '7i',
  '6i',
  '5i',
  '4i',
  '3i',
  '2i',
  `1i`,
  `5H`,
  '4H',
  '3H',
  '2H',
  '9W',
  '7W',
  '5W',
  '3W',
  'Mini Driver',
  'Driver',
  'Putter',
] as const;

export const OTHER_CLUB = 'Other';

// Rough default carry distances (yards) by tee club — used to prefill the drive
// distance chips when the player hasn't set their own stock yardages. Coarse on
// purpose; the player nudges from here.
export const DEFAULT_DRIVE_DISTANCE: Record<string, number> = {
  Driver: 250,
  'Mini Driver': 235,
  '3W': 225,
  '5W': 210,
  '7W': 195,
  '9W': 180,
  '2H': 220,
  '3H': 210,
  '4H': 200,
  '5H': 190,
  '1i': 220,
  '2i': 215,
  '3i': 205,
  '4i': 195,
  '5i': 185,
  '6i': 175,
  '7i': 165,
  '8i': 155,
  '9i': 145,
  PW: 135,
};

// The player's stored stock yardage if set, else a coarse default for the club,
// else a generic driver park. Drives the prefill + chip centering on the drive page.
export function driveDistanceForClub(
  club: string | null,
  yardages: Record<string, number>,
): number {
  if (club == null || club === '') return 250;
  return yardages[club] ?? DEFAULT_DRIVE_DISTANCE[club] ?? 250;
}

// Tee-club ordering, longest carry → shortest. CLUB_OPTIONS runs shortest →
// longest with Putter last; reverse it, then push Putter back to the end so the
// driver leads and the putter trails.
export const DRIVE_CLUB_ORDER: readonly string[] = [
  ...[...(CLUB_OPTIONS as readonly string[])].reverse().filter((c) => c !== 'Putter'),
  'Putter',
];

// Sort an arbitrary bag by DRIVE_CLUB_ORDER (longest → shortest); clubs not in
// the canonical order fall to the end, preserving their relative order.
export function sortByDriveLength(clubs: readonly string[]): string[] {
  const rank = (c: string) => {
    const i = DRIVE_CLUB_ORDER.indexOf(c);
    return i === -1 ? DRIVE_CLUB_ORDER.length : i;
  };
  return [...clubs].sort((a, b) => rank(a) - rank(b));
}

// Approach clubs read most naturally in canonical loft order (wedges → long
// irons); unknown/custom clubs fall to the end.
export function sortByClubOrder(clubs: string[]): string[] {
  const order = CLUB_OPTIONS as readonly string[];
  const rank = (c: string) => {
    const i = order.indexOf(c);
    return i === -1 ? order.length : i;
  };
  return [...clubs].sort((a, b) => rank(a) - rank(b));
}

// A wedge is the pitching wedge or any more-lofted (degree-labelled) club —
// the scoring clubs that get a wedge-grid column.
export function isWedge(club: string): boolean {
  return club === 'PW' || club.endsWith('°');
}
