import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// AES-256-GCM. Payload layout: iv(12) | authTag(16) | ciphertext, base64-encoded.
const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

export function encryptSecret(plaintext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptSecret(payload: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  const raw = Buffer.from(payload, 'base64');
  const iv = raw.subarray(0, IV_LEN);
  const tag = raw.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const enc = raw.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}
