/**
 * Type declarations for packages without built-in types
 */

declare module 'tweetnacl' {
  interface BoxKeyPair {
    publicKey: Uint8Array;
    secretKey: Uint8Array;
  }

  interface BoxFunction {
    (msg: Uint8Array, nonce: Uint8Array, theirPublicKey: Uint8Array, mySecretKey: Uint8Array): Uint8Array | null;
    keyPair(): BoxKeyPair;
    before(theirPublicKey: Uint8Array, mySecretKey: Uint8Array): Uint8Array;
    open(msg: Uint8Array, nonce: Uint8Array, theirPublicKey: Uint8Array, mySecretKey: Uint8Array): Uint8Array | null;
    nonceLength: number;
    publicKeyLength: number;
    secretKeyLength: number;
  }

  const box: BoxFunction;
  function randomBytes(length: number): Uint8Array;
  function hash(data: Uint8Array): Uint8Array;

  const nacl: {
    box: BoxFunction;
    randomBytes: typeof randomBytes;
    hash: typeof hash;
  };

  export default nacl;
}

declare module 'tweetnacl-util' {
  export function encodeBase64(data: Uint8Array): string;
  export function decodeBase64(data: string): Uint8Array;
  export function encodeUTF8(data: Uint8Array): string;
  export function decodeUTF8(data: string): Uint8Array;
}
