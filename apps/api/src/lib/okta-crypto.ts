// AES-256-GCM encryption for Okta client secrets stored in the DB.
// Protects secrets at rest — a DB compromise alone is insufficient to recover plaintext.
//
// Key source: OKTA_SECRET_KEY env var — 64-char hex string (32 bytes).
// Generate with: openssl rand -hex 32
//
// Encrypted format (stored in DB): "<iv_base64>:<ciphertext+tag_base64>"
// The GCM auth tag (16 bytes) is appended to the ciphertext by SubtleCrypto.

const ALG = { name: 'AES-GCM', length: 256 } as const;

function keyBytes(): Uint8Array {
  const hex = process.env.OKTA_SECRET_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('OKTA_SECRET_KEY must be a 64-character hex string (run: openssl rand -hex 32)');
  }
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

async function importKey(usage: 'encrypt' | 'decrypt'): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', keyBytes(), ALG, false, [usage]);
}

function toBase64(buf: ArrayBuffer | Uint8Array): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf instanceof ArrayBuffer ? buf : buf.buffer)));
}

function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

export async function encryptSecret(plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV recommended for GCM
  const key = await importKey('encrypt');
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  return `${toBase64(iv)}:${toBase64(ciphertext)}`;
}

export async function decryptSecret(encrypted: string): Promise<string> {
  const colon = encrypted.indexOf(':');
  if (colon < 1) throw new Error('Invalid encrypted secret format');
  const iv = fromBase64(encrypted.slice(0, colon));
  const ciphertext = fromBase64(encrypted.slice(colon + 1));
  const key = await importKey('decrypt');
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new TextDecoder().decode(plaintext);
}
