/**
 * E2E Encryption for Audiio Relay
 *
 * Uses X25519 for key exchange and XSalsa20-Poly1305 for encryption.
 * The relay server never sees plaintext data.
 */

import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } from 'tweetnacl-util';

export interface KeyPair {
  publicKey: string;  // Base64 encoded
  secretKey: string;  // Base64 encoded
}

export interface EncryptedMessage {
  encrypted: string;  // Base64 encoded ciphertext
  nonce: string;      // Base64 encoded nonce
}

/**
 * Generate a new key pair for encryption
 */
export function generateKeyPair(): KeyPair {
  const keyPair = nacl.box.keyPair();
  return {
    publicKey: encodeBase64(keyPair.publicKey),
    secretKey: encodeBase64(keyPair.secretKey)
  };
}

/**
 * Encrypt a message for a recipient
 *
 * @param message - The plaintext message (string or object)
 * @param recipientPublicKey - Recipient's public key (base64)
 * @param senderSecretKey - Sender's secret key (base64)
 */
export function encrypt(
  message: string | object,
  recipientPublicKey: string,
  senderSecretKey: string
): EncryptedMessage {
  // Convert message to string if object
  const messageStr = typeof message === 'object' ? JSON.stringify(message) : message;
  const messageBytes = decodeUTF8(messageStr);

  // Generate random nonce
  const nonce = nacl.randomBytes(nacl.box.nonceLength);

  // Decrypt keys from base64
  const recipientPubKey = decodeBase64(recipientPublicKey);
  const senderSecKey = decodeBase64(senderSecretKey);

  // Encrypt
  const encrypted = nacl.box(messageBytes, nonce, recipientPubKey, senderSecKey);

  if (!encrypted) {
    throw new Error('Encryption failed');
  }

  return {
    encrypted: encodeBase64(encrypted),
    nonce: encodeBase64(nonce)
  };
}

/**
 * Decrypt a message from a sender
 *
 * @param encryptedMessage - The encrypted message object
 * @param senderPublicKey - Sender's public key (base64)
 * @param recipientSecretKey - Recipient's secret key (base64)
 * @returns The decrypted message string
 */
export function decrypt(
  encryptedMessage: EncryptedMessage,
  senderPublicKey: string,
  recipientSecretKey: string
): string {
  const encrypted = decodeBase64(encryptedMessage.encrypted);
  const nonce = decodeBase64(encryptedMessage.nonce);
  const senderPubKey = decodeBase64(senderPublicKey);
  const recipientSecKey = decodeBase64(recipientSecretKey);

  const decrypted = nacl.box.open(encrypted, nonce, senderPubKey, recipientSecKey);

  if (!decrypted) {
    throw new Error('Decryption failed - invalid key or corrupted message');
  }

  return encodeUTF8(decrypted);
}

/**
 * Decrypt a message and parse as JSON
 */
export function decryptJSON<T = unknown>(
  encryptedMessage: EncryptedMessage,
  senderPublicKey: string,
  recipientSecretKey: string
): T {
  const decrypted = decrypt(encryptedMessage, senderPublicKey, recipientSecretKey);
  return JSON.parse(decrypted) as T;
}

/**
 * Compute a shared secret (for key derivation if needed)
 */
export function computeSharedSecret(
  theirPublicKey: string,
  mySecretKey: string
): string {
  const theirPubKey = decodeBase64(theirPublicKey);
  const mySecKey = decodeBase64(mySecretKey);

  const sharedSecret = nacl.box.before(theirPubKey, mySecKey);
  return encodeBase64(sharedSecret);
}

/**
 * Hash data using SHA-512 (for fingerprints, etc.)
 */
export function hash(data: string): string {
  const bytes = decodeUTF8(data);
  const hashed = nacl.hash(bytes);
  return encodeBase64(hashed);
}

/**
 * Generate a fingerprint from a public key (for verification)
 * Returns first 8 characters of base64-encoded hash
 */
export function fingerprint(publicKey: string): string {
  const hashed = hash(publicKey);
  return hashed.substring(0, 8).toUpperCase();
}

/**
 * Verify that a public key is valid
 */
export function isValidPublicKey(publicKey: string): boolean {
  try {
    const decoded = decodeBase64(publicKey);
    return decoded.length === nacl.box.publicKeyLength;
  } catch {
    return false;
  }
}
