/**
 * @audiio/relay - Secure relay for remote mobile access
 *
 * Exports:
 * - RelayServer: Run your own relay server
 * - RelayClient: Connect desktop to relay
 * - Crypto utilities: E2E encryption
 * - Code utilities: Connection code generation
 */

// Server (for standalone relay deployment)
export { RelayServer } from './server';

// Client (for desktop app)
export {
  RelayClient,
  type RelayClientConfig,
  type RelayClientEvents,
  type ConnectedPeer
} from './client';

// Crypto utilities
export {
  generateKeyPair,
  encrypt,
  decrypt,
  decryptJSON,
  computeSharedSecret,
  hash,
  hashPassword,
  fingerprint,
  isValidPublicKey,
  type KeyPair,
  type EncryptedMessage
} from './shared/crypto';

// Code utilities
export {
  generateCode,
  normalizeCode,
  isValidCode,
  CODE_ENTROPY
} from './shared/codes';

// Types
export * from './shared/types';
