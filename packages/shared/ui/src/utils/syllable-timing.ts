/**
 * Syllable-based word timing utilities for sing-along mode
 *
 * Provides more accurate word timing by:
 * 1. Counting syllables instead of characters
 * 2. Weighting vowels (take longer to sing)
 * 3. Minimum durations for short words
 * 4. Punctuation-aware pauses
 * 5. End-of-line held note detection
 */

/**
 * Count syllables in a word using a heuristic approach
 * Based on vowel groups with common English exceptions
 */
export function countSyllables(word: string): number {
  const cleaned = word.toLowerCase().replace(/[^a-z]/g, '');
  if (cleaned.length === 0) return 1;
  if (cleaned.length <= 2) return 1;

  // Common exceptions - words that don't follow rules
  const exceptions: Record<string, number> = {
    // Silent e words that sound like 1 syllable
    'the': 1, 'love': 1, 'have': 1, 'give': 1, 'live': 1,
    'come': 1, 'some': 1, 'done': 1, 'gone': 1, 'one': 1,
    'were': 1, 'where': 1, 'there': 1, 'here': 1,
    'fire': 1, 'hire': 1, 'wire': 1, 'tire': 1,
    'like': 1, 'time': 1, 'life': 1, 'wife': 1,
    'make': 1, 'take': 1, 'wake': 1, 'sake': 1,
    'eye': 1, 'dye': 1, 'bye': 1, 'rye': 1,
    'are': 1, 'our': 1, 'your': 1,
    'more': 1, 'before': 2, 'ignore': 2, 'adore': 2,
    'sure': 1, 'pure': 1, 'cure': 1,
    'true': 1, 'blue': 1, 'clue': 1, 'due': 1,
    // 2 syllable words often miscounted
    'being': 2, 'doing': 2, 'going': 2, 'seeing': 2,
    'every': 2, 'different': 3, 'beautiful': 4,
    'heaven': 2, 'seven': 2, 'even': 2,
    'over': 2, 'ever': 2, 'never': 2,
    'only': 2, 'lonely': 2,
    'away': 2, 'today': 2, 'okay': 2,
    'maybe': 2, 'baby': 2, 'crazy': 2, 'lazy': 2,
    'really': 2, 'finally': 3, 'usually': 4,
    'everything': 3, 'anything': 3, 'something': 2, 'nothing': 2,
    'believe': 2, 'receive': 2, 'achieve': 2,
    'together': 3, 'forever': 3, 'remember': 3, 'surrender': 3,
    'afraid': 2, 'again': 2, 'against': 2,
    'around': 2, 'about': 2, 'without': 2,
    'between': 2, 'beneath': 2, 'beyond': 2,
    'myself': 2, 'yourself': 2, 'himself': 2, 'herself': 2,
    // Contractions
    "i'm": 1, "you're": 1, "we're": 1, "they're": 1,
    "don't": 1, "won't": 1, "can't": 1, "isn't": 2,
    "wasn't": 2, "weren't": 1, "hasn't": 2, "haven't": 2,
    "couldn't": 2, "wouldn't": 2, "shouldn't": 2, "didn't": 2,
    "i'll": 1, "you'll": 1, "we'll": 1, "he'll": 1, "she'll": 1,
    "i've": 1, "you've": 1, "we've": 1, "they've": 1,
    "i'd": 1, "you'd": 1, "we'd": 1, "he'd": 1, "she'd": 1,
    "let's": 1, "that's": 1, "what's": 1, "it's": 1, "there's": 1,
    "here's": 1, "who's": 1, "how's": 1, "where's": 1,
    // Informal/song words
    "gonna": 2, "wanna": 2, "gotta": 2, "kinda": 2, "sorta": 2,
    "cause": 1, "'cause": 1, "cuz": 1, "'cuz": 1,
    "yeah": 1, "yea": 1, "nah": 1, "uh": 1, "oh": 1, "ah": 1,
    "ooh": 1, "whoa": 1, "hey": 1, "yo": 1, "mmm": 1,
    "alright": 2, "aight": 1, "ight": 1,
    "tryna": 2, "finna": 2, "boutta": 2,
  };

  if (exceptions[cleaned] !== undefined) {
    return exceptions[cleaned];
  }

  let syllables = 0;
  const vowels = 'aeiouy';
  let prevWasVowel = false;

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    const isVowel = vowels.includes(char!);

    if (isVowel && !prevWasVowel) {
      syllables++;
    }
    prevWasVowel = isVowel;
  }

  // Handle silent e at end
  if (cleaned.endsWith('e') && syllables > 1) {
    // Check if it's not a word like "be", "he", "me", "we"
    const beforeE = cleaned[cleaned.length - 2];
    if (beforeE && !'aeiou'.includes(beforeE)) {
      syllables--;
    }
  }

  // Handle -le ending (like "little", "people") - adds a syllable
  if (cleaned.endsWith('le') && cleaned.length > 2) {
    const beforeLe = cleaned[cleaned.length - 3];
    if (beforeLe && !'aeiou'.includes(beforeLe)) {
      syllables++;
    }
  }

  // Handle -ed ending - usually silent unless preceded by t or d
  if (cleaned.endsWith('ed') && cleaned.length > 2) {
    const beforeEd = cleaned[cleaned.length - 3];
    if (beforeEd && !['t', 'd'].includes(beforeEd)) {
      // The -ed is silent, we may have overcounted
      // But our vowel counting should handle this
    }
  }

  return Math.max(1, syllables);
}

/**
 * Calculate the "singing weight" of a word
 * Vowels take longer to sing than consonants
 * Returns a weight multiplier (1.0 = normal)
 */
export function getWordWeight(word: string): number {
  const cleaned = word.toLowerCase().replace(/[^a-z]/g, '');
  if (cleaned.length === 0) return 1;

  const vowels = 'aeiou';
  let vowelCount = 0;
  let consonantCount = 0;

  for (const char of cleaned) {
    if (vowels.includes(char)) {
      vowelCount++;
    } else {
      consonantCount++;
    }
  }

  // Vowels are weighted 1.5x, consonants 0.5x
  // This reflects that vowels are held while consonants are quick
  const totalWeight = (vowelCount * 1.5) + (consonantCount * 0.5);
  const averageWeight = totalWeight / cleaned.length;

  // Normalize around 1.0 (average word has ~40% vowels)
  // Average word weight: 0.4 * 1.5 + 0.6 * 0.5 = 0.6 + 0.3 = 0.9
  return averageWeight / 0.9;
}

/**
 * Detect if a word is likely to be "held" (elongated) when sung
 */
export function isLikelyHeldWord(word: string, isLastInLine: boolean, isBeforePause: boolean): boolean {
  const cleaned = word.toLowerCase().replace(/[^a-z]/g, '');

  // Last word in line is often held
  if (isLastInLine) return true;

  // Word before comma/pause
  if (isBeforePause) return true;

  // Words ending in open vowels are often held
  const openVowelEndings = ['a', 'e', 'i', 'o', 'ay', 'ey', 'ow', 'oo', 'ee', 'ie', 'ue'];
  for (const ending of openVowelEndings) {
    if (cleaned.endsWith(ending)) return true;
  }

  // Common held words in songs
  const heldWords = ['oh', 'yeah', 'hey', 'no', 'so', 'go', 'know', 'you', 'me', 'we', 'be', 'see', 'free'];
  if (heldWords.includes(cleaned)) return true;

  return false;
}

/**
 * Get pause duration after a word based on punctuation
 */
export function getPauseDuration(wordWithPunctuation: string, baseGap: number): number {
  const lastChar = wordWithPunctuation.trim().slice(-1);

  switch (lastChar) {
    case '.':
    case '!':
    case '?':
      return baseGap * 4; // Full stop - long pause
    case ',':
    case ';':
      return baseGap * 2.5; // Comma - medium pause
    case ':':
      return baseGap * 2;
    case '-':
    case '—':
      return baseGap * 1.5;
    case '...':
      return baseGap * 3;
    default:
      return baseGap;
  }
}

/**
 * Minimum duration for a word based on syllable count
 * Prevents very short words from being impossibly fast
 */
export function getMinimumDuration(syllables: number): number {
  // Minimum ~150ms per syllable (very fast singing)
  // Most natural singing is 200-400ms per syllable
  return Math.max(120, syllables * 150);
}

export interface WordTimingConfig {
  /** Minimum milliseconds per syllable */
  minMsPerSyllable: number;
  /** Base gap between words in ms */
  baseWordGap: number;
  /** Multiplier for held words (last in line, before pause) */
  heldWordMultiplier: number;
  /** Whether to apply vowel weighting */
  useVowelWeighting: boolean;
  /** Anticipation offset in ms - words start this much earlier to account for visual latency */
  anticipationOffset: number;
}

export const DEFAULT_TIMING_CONFIG: WordTimingConfig = {
  minMsPerSyllable: 150,
  baseWordGap: 40,
  heldWordMultiplier: 1.4,
  useVowelWeighting: true,
  anticipationOffset: 50, // 50ms early start for smoother perceived sync
};

export interface TimedWord {
  word: string;
  syllables: number;
  weight: number;
  duration: number;
  startTime: number;
  endTime: number;
  isHeld: boolean;
  pauseAfter: number;
}

/**
 * Calculate word timings for a line using syllable-based algorithm
 */
export function calculateWordTimings(
  lineText: string,
  lineStartTime: number,
  lineDuration: number,
  config: WordTimingConfig = DEFAULT_TIMING_CONFIG
): TimedWord[] {
  const words = lineText.trim().split(/\s+/);
  if (words.length === 0) return [];

  // First pass: calculate syllables and weights for all words
  const wordData = words.map((word, index) => {
    const cleanWord = word.replace(/[^a-zA-Z'']/g, '');
    const syllables = countSyllables(cleanWord);
    const weight = config.useVowelWeighting ? getWordWeight(cleanWord) : 1;
    const isLast = index === words.length - 1;
    const hasTrailingPunctuation = /[,;:!?.—-]$/.test(word);
    const isHeld = isLikelyHeldWord(cleanWord, isLast, hasTrailingPunctuation);
    const pauseAfter = isLast ? 0 : getPauseDuration(word, config.baseWordGap);

    return {
      word,
      syllables,
      weight,
      isHeld,
      pauseAfter,
      // Will be calculated in second pass
      duration: 0,
      startTime: 0,
      endTime: 0,
    };
  });

  // Calculate total "singing units" (weighted syllables)
  let totalUnits = 0;
  for (const data of wordData) {
    let units = data.syllables * data.weight;
    if (data.isHeld) {
      units *= config.heldWordMultiplier;
    }
    totalUnits += units;
  }

  // Calculate total pause time
  const totalPauseTime = wordData.reduce((sum, w) => sum + w.pauseAfter, 0);

  // Available time for actual singing (minus pauses)
  const availableSingingTime = Math.max(lineDuration - totalPauseTime, lineDuration * 0.7);

  // Time per unit
  const timePerUnit = availableSingingTime / totalUnits;

  // Second pass: assign actual times
  // Apply anticipation offset so words highlight slightly before audio
  let currentTime = lineStartTime - config.anticipationOffset;

  for (const data of wordData) {
    let units = data.syllables * data.weight;
    if (data.isHeld) {
      units *= config.heldWordMultiplier;
    }

    // Calculate duration
    let duration = units * timePerUnit;

    // Apply minimum duration
    const minDuration = getMinimumDuration(data.syllables);
    duration = Math.max(duration, minDuration);

    data.startTime = currentTime;
    data.duration = duration;
    data.endTime = currentTime + duration;

    currentTime = data.endTime + data.pauseAfter;
  }

  // If we went over the line duration, scale everything back proportionally
  const lastWord = wordData[wordData.length - 1];
  if (lastWord && lastWord.endTime > lineStartTime + lineDuration) {
    const overrun = lastWord.endTime - (lineStartTime + lineDuration);
    const totalDuration = lastWord.endTime - lineStartTime;
    const scale = (totalDuration - overrun) / totalDuration;

    currentTime = lineStartTime;
    for (const data of wordData) {
      data.startTime = currentTime;
      data.duration *= scale;
      data.pauseAfter *= scale;
      data.endTime = currentTime + data.duration;
      currentTime = data.endTime + data.pauseAfter;
    }
  }

  return wordData;
}
