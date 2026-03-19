import {
    createCipheriv,
    createDecipheriv,
    randomBytes,
    scryptSync,
} from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const TAG_LENGTH = 16; // 128-bit auth tag (GCM default)

/**
 * [CRIT-1] AES-256-GCM encryption utility for storing sensitive credentials
 * (e.g., ClickHouse passwords) encrypted at rest.
 *
 * Usage:
 *   const key = getEncryptionKey();   // from env
 *   const enc = encrypt(plaintext, key);
 *   const dec = decrypt(enc, key);
 */

/**
 * Derives a 32-byte AES key from the CREDENTIAL_ENCRYPTION_KEY env variable.
 * Uses scrypt so that even shorter keys result in a proper 256-bit key buffer.
 */
export function getEncryptionKey(): Buffer {
    const rawKey = process.env.CREDENTIAL_ENCRYPTION_KEY;
    if (!rawKey) {
        throw new Error(
            "CREDENTIAL_ENCRYPTION_KEY environment variable is required for credential encryption",
        );
    }
    // Salt is fixed (non-random) because we need deterministic key derivation.
    // Security comes from the secrecy of CREDENTIAL_ENCRYPTION_KEY itself.
    return scryptSync(rawKey, "internal-audit-cred-salt", 32) as Buffer;
}

/**
 * Encrypts plaintext with AES-256-GCM.
 * Returns a colon-separated hex string: `iv:authTag:ciphertext`
 */
export function encryptCredential(plaintext: string, keyBuffer: Buffer): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, keyBuffer, iv, {
        authTagLength: TAG_LENGTH,
    });
    const encrypted = Buffer.concat([
        cipher.update(plaintext, "utf8"),
        cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypts an AES-256-GCM ciphertext produced by `encryptCredential`.
 * Returns the original plaintext string.
 * Throws if tampered, wrong key, or wrong format.
 */
export function decryptCredential(data: string, keyBuffer: Buffer): string {
    const parts = data.split(":");
    if (parts.length !== 3) {
        throw new Error("Invalid encrypted credential format");
    }
    const [ivHex, tagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const encrypted = Buffer.from(encryptedHex, "hex");

    const decipher = createDecipheriv(ALGORITHM, keyBuffer, iv, {
        authTagLength: TAG_LENGTH,
    });
    decipher.setAuthTag(tag);
    return (
        decipher.update(encrypted).toString("utf8") +
        decipher.final("utf8")
    );
}

/**
 * Returns true if a string looks like an encrypted credential
 * (iv:tag:ciphertext — three hex segments joined by colons).
 * Used during migration: existing plaintext passwords can be detected and re-encrypted.
 */
export function isEncrypted(value: string): boolean {
    const parts = value.split(":");
    return parts.length === 3 && parts.every((p) => /^[0-9a-f]+$/i.test(p));
}
