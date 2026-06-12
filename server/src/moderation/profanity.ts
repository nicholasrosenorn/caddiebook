// Server-authoritative objectionable-language filter (App Store Guideline 1.2 /
// Google Play UGC: "a method for filtering objectionable material from being
// posted"). The client mirrors this list in lib/moderation/profanity.ts for an
// inline pre-check, but the server is the gate that actually rejects the write.
//
// Keep the list conservative — it should catch slurs and clearly hateful/
// sexual terms, not police mild words. Matching is word-boundary based and
// normalizes common letter→symbol substitutions so "f.u.c.k" / "f u c k" /
// "fvck" don't trivially slip through, while keeping false positives (e.g.
// "Scunthorpe", "assassin") out via boundary anchoring.

// Stems matched at a leading word boundary but allowing any suffix, so
// inflections (fucking, shitty, bitches, assholes) are caught. A preceding
// letter still blocks the match, so "scrape"/"classic" stay clean.
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

// Short/ambiguous terms matched as whole words only (both boundaries), since a
// prefix match would snag benign words (spic→spice, fag→...). Over-blocking a
// rare benign use here is acceptable for a backstop with admin review.
const EXACT_TERMS = ['fag', 'spic', 'chink', 'kike', 'wetback', 'rape', 'retard'];

// Map look-alike characters back to a canonical letter before matching.
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

// Map look-alike characters back to letters but KEEP separators intact, so word
// boundaries survive (gluing "a shit" → "ashit" would hide the boundary and
// miss the match). Catches leet like "sh1t" / "b!tch".
function canonical(input: string): string {
  let out = '';
  for (const ch of input.toLowerCase()) {
    out += LEET[ch] ?? ch;
  }
  return out;
}

// Leading boundary + stem + any trailing letters; or a whole-word exact term.
const PATTERN = new RegExp(
  `(?:^|[^a-z])(?:(?:${STEM_TERMS.join('|')})[a-z]*|(?:${EXACT_TERMS.join('|')}))(?:[^a-z]|$)`,
  'i',
);

export function containsProfanity(text: string | null | undefined): boolean {
  if (!text) return false;
  // Test both the raw lowercased text (catches normal usage with real spaces as
  // boundaries) and the canonical form (catches obfuscation like "sh1t").
  if (PATTERN.test(` ${text.toLowerCase()} `)) return true;
  return PATTERN.test(` ${canonical(text)} `);
}
