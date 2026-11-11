import crypto from 'crypto';

/**
 * Field-level encryption for sensitive Canadian tax data (e.g. Shareholder SIN, Business Numbers).
 * Follows PIPEDA / Law 25 compliance requirements using AES-256-GCM.
 */
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM

// In production, this key is injected via secure environment variables / AWS KMS / Azure Key Vault
const ENCRYPTION_KEY = process.env.DATA_ENCRYPTION_KEY 
  ? Buffer.from(process.env.DATA_ENCRYPTION_KEY, 'hex') 
  : crypto.scryptSync('development-secret-key-salt', 'salt', 32);

export function encryptSensitiveField(plaintext: string): string {
  if (!plaintext) return '';
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();

  // Format: iv:tag:ciphertext
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

export function decryptSensitiveField(encryptedPayload: string): string {
  if (!encryptedPayload || !encryptedPayload.includes(':')) return '';
  const [ivHex, tagHex, ciphertext] = encryptedPayload.split(':');
  
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    ENCRYPTION_KEY,
    Buffer.from(ivHex, 'hex')
  );
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Masks a Canadian Social Insurance Number for UI display (e.g., ***-***-789)
 */
export function maskSIN(sin: string): string {
  const clean = (sin || '').replace(/[^0-9]/g, '');
  if (clean.length < 3) return '***';
  return `***-***-${clean.slice(-3)}`;
}
