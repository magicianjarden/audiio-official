/**
 * Connection Code Generator
 *
 * Generates memorable, easy-to-type codes like:
 * - BLUE-TIGER-42
 * - SWIFT-MOON-17
 * - CALM-RIVER-83
 */

const ADJECTIVES = [
  'SWIFT', 'CALM', 'BOLD', 'WARM', 'COOL',
  'BLUE', 'GOLD', 'JADE', 'RUBY', 'SAGE',
  'WILD', 'SOFT', 'DEEP', 'HIGH', 'PURE',
  'DAWN', 'DUSK', 'NOON', 'STAR', 'MOON',
  'FIRE', 'WAVE', 'WIND', 'LEAF', 'SNOW',
  'IRON', 'SILK', 'AQUA', 'ROSE', 'PINE'
];

const NOUNS = [
  'TIGER', 'EAGLE', 'SHARK', 'WOLF', 'BEAR',
  'RIVER', 'OCEAN', 'STORM', 'CLOUD', 'STONE',
  'FLAME', 'FROST', 'LIGHT', 'SHADE', 'SPARK',
  'CROWN', 'BLADE', 'ARROW', 'TOWER', 'BRIDGE',
  'DREAM', 'QUEST', 'HAVEN', 'REALM', 'FORGE',
  'COMET', 'ORBIT', 'PULSE', 'ECHO', 'PRISM'
];

/**
 * Generate a random connection code
 */
export function generateCode(): string {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const number = Math.floor(Math.random() * 90) + 10; // 10-99

  return `${adjective}-${noun}-${number}`;
}

/**
 * Validate a connection code format
 */
export function isValidCode(code: string): boolean {
  const pattern = /^[A-Z]+-[A-Z]+-\d{2}$/;
  return pattern.test(code.toUpperCase());
}

/**
 * Normalize a code (uppercase, trim)
 */
export function normalizeCode(code: string): string {
  return code.toUpperCase().trim();
}

/**
 * Calculate entropy of the code system
 * 30 adjectives × 30 nouns × 90 numbers = 81,000 combinations
 */
export const CODE_ENTROPY = Math.log2(ADJECTIVES.length * NOUNS.length * 90);
