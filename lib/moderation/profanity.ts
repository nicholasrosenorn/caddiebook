// Client mirror of the server's objectionable-language filter
// (server/src/moderation/profanity.ts). The server is the authoritative gate
// (it returns 422 and the outbox drops the poison command), but checking here
// first lets us show the user an inline error and never enqueue a write that
// would be silently dropped. Keep this list in sync with the server.

const STEM_TERMS = [
  'fuck',
  'motherfuck',
  'shit',
  'bitch',
  'cunt',
  'asshole',
  'bastard',
  'pussy',
  'slut',
  'whore',
  'faggot',
  'nigger',
  'nigga',
];

const EXACT_TERMS = ['fag', 'spic', 'chink', 'kike', 'wetback', 'rape', 'retard'];

const LEET: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '!': 'i',
  '3': 'e',
  '4': 'a',
  '@': 'a',
  '5': 's',
  '$': 's',
  '7': 't',
  '8': 'b',
};

function canonical(input: string): string {
  let out = '';
  for (const ch of input.toLowerCase()) out += LEET[ch] ?? ch;
  return out;
}

const PATTERN = new RegExp(
  `(?:^|[^a-z])(?:(?:${STEM_TERMS.join('|')})[a-z]*|(?:${EXACT_TERMS.join('|')}))(?:[^a-z]|$)`,
  'i',
);

export function containsProfanity(text: string | null | undefined): boolean {
  if (!text) return false;
  if (PATTERN.test(` ${text.toLowerCase()} `)) return true;
  return PATTERN.test(` ${canonical(text)} `);
}
