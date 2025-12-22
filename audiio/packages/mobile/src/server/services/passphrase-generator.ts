/**
 * Passphrase Generator - Creates memorable passphrases for mobile access
 *
 * Generates easy-to-remember passphrases like:
 * - "purple-tiger-sunset-42"
 * - "cosmic-river-mountain-88"
 *
 * Also supports custom passwords with validation
 */

import * as crypto from 'crypto';

// Word lists for generating memorable passphrases
const ADJECTIVES = [
  'amber', 'azure', 'bold', 'brave', 'bright', 'calm', 'clear', 'clever',
  'cosmic', 'cozy', 'crisp', 'crystal', 'dancing', 'daring', 'deep', 'dream',
  'dusty', 'eager', 'early', 'echo', 'elegant', 'emerald', 'endless', 'epic',
  'fading', 'fancy', 'fast', 'fierce', 'fiery', 'flying', 'forest', 'frosty',
  'gentle', 'gleaming', 'glowing', 'golden', 'graceful', 'grand', 'green', 'happy',
  'hidden', 'hollow', 'humble', 'icy', 'jade', 'jolly', 'keen', 'kind',
  'lasting', 'lazy', 'light', 'little', 'lively', 'lone', 'lost', 'lucky',
  'lunar', 'magic', 'marble', 'meadow', 'mellow', 'mighty', 'misty', 'moonlit',
  'noble', 'northern', 'ocean', 'olive', 'orange', 'peaceful', 'pink', 'polar',
  'purple', 'quiet', 'radiant', 'rapid', 'red', 'rising', 'roaming', 'royal',
  'rustic', 'sage', 'sandy', 'sapphire', 'secret', 'serene', 'shadow', 'shining',
  'silent', 'silver', 'simple', 'sleepy', 'small', 'snowy', 'soft', 'solar',
  'southern', 'spring', 'starry', 'steady', 'stellar', 'still', 'stormy', 'summer',
  'sunny', 'sweet', 'swift', 'tender', 'thunder', 'tiny', 'tropical', 'turbo',
  'twilight', 'urban', 'velvet', 'violet', 'vivid', 'wandering', 'warm', 'wild',
  'winter', 'wise', 'yellow', 'young', 'zen'
];

const NOUNS = [
  'apple', 'arrow', 'aurora', 'beach', 'bear', 'bird', 'bloom', 'breeze',
  'bridge', 'brook', 'canyon', 'castle', 'cedar', 'cherry', 'cliff', 'cloud',
  'comet', 'coral', 'cosmos', 'creek', 'crystal', 'dawn', 'desert', 'dolphin',
  'dragon', 'dream', 'dune', 'eagle', 'earth', 'echo', 'ember', 'falcon',
  'feather', 'fern', 'fire', 'flame', 'flower', 'forest', 'fox', 'frost',
  'garden', 'glacier', 'glade', 'grove', 'harbor', 'hawk', 'heart', 'heron',
  'hill', 'horizon', 'island', 'jade', 'jasper', 'jungle', 'lake', 'leaf',
  'light', 'lily', 'lion', 'lotus', 'maple', 'meadow', 'meteor', 'moon',
  'moss', 'mountain', 'nebula', 'night', 'north', 'nova', 'oak', 'oasis',
  'ocean', 'orchid', 'owl', 'palm', 'panther', 'path', 'peak', 'pearl',
  'phoenix', 'pine', 'planet', 'pond', 'prism', 'pulse', 'rain', 'rainbow',
  'raven', 'reef', 'ridge', 'river', 'robin', 'rock', 'rose', 'sage',
  'sand', 'sapphire', 'sea', 'shadow', 'shore', 'sky', 'snow', 'spark',
  'spring', 'star', 'stone', 'storm', 'stream', 'summit', 'sun', 'sunrise',
  'sunset', 'swan', 'thunder', 'tiger', 'tree', 'valley', 'violet', 'wave',
  'whisper', 'willow', 'wind', 'wolf', 'wonder', 'wood', 'zenith'
];

export interface PassphraseOptions {
  /** Number of words in the passphrase (default: 3) */
  wordCount?: number;
  /** Include a number suffix (default: true) */
  includeNumber?: boolean;
  /** Separator between words (default: '-') */
  separator?: string;
  /** Use a specific pattern (adjective-noun-noun, etc.) */
  pattern?: ('adjective' | 'noun')[];
}

export interface PasswordValidation {
  valid: boolean;
  errors: string[];
}

const DEFAULT_OPTIONS: Required<PassphraseOptions> = {
  wordCount: 3,
  includeNumber: true,
  separator: '-',
  pattern: ['adjective', 'noun', 'noun']
};

/**
 * Generate a memorable passphrase
 */
export function generatePassphrase(options: PassphraseOptions = {}): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Use pattern if provided, otherwise generate based on word count
  const pattern = opts.pattern || generatePattern(opts.wordCount);

  const words: string[] = [];

  for (const wordType of pattern) {
    const wordList = wordType === 'adjective' ? ADJECTIVES : NOUNS;
    const randomIndex = crypto.randomInt(wordList.length);
    words.push(wordList[randomIndex]!);
  }

  let passphrase = words.join(opts.separator);

  // Add a random number suffix
  if (opts.includeNumber) {
    const num = crypto.randomInt(10, 100); // 10-99
    passphrase += opts.separator + num;
  }

  return passphrase;
}

/**
 * Generate a pattern based on word count
 */
function generatePattern(wordCount: number): ('adjective' | 'noun')[] {
  const pattern: ('adjective' | 'noun')[] = [];

  for (let i = 0; i < wordCount; i++) {
    // Alternate between adjective and noun, starting with adjective
    pattern.push(i % 2 === 0 ? 'adjective' : 'noun');
  }

  return pattern;
}

/**
 * Generate multiple passphrase suggestions
 */
export function generatePassphraseSuggestions(count: number = 5, options: PassphraseOptions = {}): string[] {
  const suggestions: string[] = [];

  for (let i = 0; i < count; i++) {
    suggestions.push(generatePassphrase(options));
  }

  return suggestions;
}

/**
 * Validate a custom password
 */
export function validatePassword(password: string): PasswordValidation {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (password.length > 128) {
    errors.push('Password must be 128 characters or less');
  }

  // Check for common weak patterns
  const lowerPassword = password.toLowerCase();
  const weakPatterns = [
    'password', '123456', 'qwerty', 'abc123', 'letmein',
    'welcome', 'admin', 'user', 'login', 'test'
  ];

  for (const weak of weakPatterns) {
    if (lowerPassword.includes(weak)) {
      errors.push('Password contains a common weak pattern');
      break;
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Hash a password/passphrase for storage
 * Uses SHA-256 with a salt
 */
export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const useSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .createHash('sha256')
    .update(password + useSalt)
    .digest('hex');

  return { hash, salt: useSalt };
}

/**
 * Verify a password against a stored hash
 */
export function verifyPassword(password: string, storedHash: string, salt: string): boolean {
  const { hash } = hashPassword(password, salt);
  return hash === storedHash;
}

/**
 * Estimate passphrase strength (entropy in bits)
 */
export function estimatePassphraseStrength(options: PassphraseOptions = {}): number {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  let entropy = 0;

  // Each adjective choice: log2(adjectives.length) bits
  // Each noun choice: log2(nouns.length) bits
  const pattern = opts.pattern || generatePattern(opts.wordCount);

  for (const wordType of pattern) {
    const wordList = wordType === 'adjective' ? ADJECTIVES : NOUNS;
    entropy += Math.log2(wordList.length);
  }

  // Number suffix adds ~6.5 bits (90 possibilities: 10-99)
  if (opts.includeNumber) {
    entropy += Math.log2(90);
  }

  return Math.round(entropy);
}

/**
 * Get passphrase strength description
 */
export function getStrengthDescription(entropyBits: number): string {
  if (entropyBits < 28) return 'Weak';
  if (entropyBits < 36) return 'Fair';
  if (entropyBits < 60) return 'Good';
  if (entropyBits < 80) return 'Strong';
  return 'Very Strong';
}
