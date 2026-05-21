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

// A wedge is the pitching wedge or any more-lofted (degree-labelled) club —
// the scoring clubs that get a wedge-grid column.
export function isWedge(club: string): boolean {
  return club === 'PW' || club.endsWith('°');
}
