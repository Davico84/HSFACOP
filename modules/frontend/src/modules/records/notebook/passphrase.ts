/**
 * Frase de exportación (design D5): 6 palabras de una lista de 2 048 (11 bits cada una, unos 66 bits)
 * generadas por la aplicación con `crypto.getRandomValues`; el usuario no elige frase. Las palabras son
 * sílabas pronunciables de dos sílabas (consonante + vocal), sin tildes ni parecidos confusos, para
 * dictarlas y copiarlas sin ambigüedad. La lista se calcula de forma determinista: 16 consonantes ×
 * 5 vocales = 80 sílabas; las primeras 2 048 combinaciones de dos sílabas, en orden fijo.
 */
const CONSONANTS = ["b", "d", "f", "g", "j", "k", "l", "m", "n", "p", "r", "s", "t", "v", "x", "z"] as const;
const VOWELS = ["a", "e", "i", "o", "u"] as const;

export const WORD_COUNT = 2048;
export const PHRASE_WORDS = 6;

function buildWordList(): readonly string[] {
  const syllables = CONSONANTS.flatMap((consonant) => VOWELS.map((vowel) => consonant + vowel));
  const words: string[] = [];
  for (const first of syllables) {
    for (const second of syllables) {
      if (words.length < WORD_COUNT) words.push(first + second);
    }
  }
  return words;
}

export const WORDS: readonly string[] = buildWordList();

/** Una frase nueva de 6 palabras separadas por un espacio. */
export function generatePassphrase(random: (array: Uint16Array<ArrayBuffer>) => Uint16Array = (array) => crypto.getRandomValues(array)): string {
  // 2 048 = 2^11: enmascarar 11 bits no sesga la elección.
  const values = random(new Uint16Array(new ArrayBuffer(PHRASE_WORDS * 2)));
  return Array.from(values, (value) => WORDS[value & 0x7ff]).join(" ");
}

/** Forma canónica con la que se deriva la clave: NFKC, minúsculas y un solo espacio entre palabras. */
export function normalizePassphrase(passphrase: string): string {
  return passphrase.normalize("NFKC").toLowerCase().trim().split(/\s+/).join(" ");
}
