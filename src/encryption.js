const crypto = require('crypto');
const config = require('../configManager');

const ENCRYPTION_KEY = config.database.encryptionKey;
if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes).');
}

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // For AES, this is always 16
const AUTH_TAG_LENGTH = 16;
const KEY = Buffer.from(ENCRYPTION_KEY, 'hex');

/**
 * Encrypts a text string.
 * @param {string} text The text to encrypt.
 * @returns {string} The encrypted text, formatted as iv:encrypted:tag.
 */
function encrypt(text) {
    if (text === null || typeof text === 'undefined') {
        return text;
    }
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
    const encrypted = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${encrypted.toString('hex')}:${tag.toString('hex')}`;
}

/**
 * Decrypts a text string.
 * @param {string} text The text to decrypt (iv:encrypted:tag).
 * @returns {string} The decrypted text.
 */
function decrypt(text) {
    if (text === null || typeof text === 'undefined' || typeof text !== 'string' || !text.includes(':')) {
        return text;
    }
    try {
        const textParts = text.split(':');
        if (textParts.length !== 3) {
            // This might be unencrypted legacy data, return as is.
            return text;
        }
        const iv = Buffer.from(textParts[0], 'hex');
        const encryptedText = Buffer.from(textParts[1], 'hex');
        const tag = Buffer.from(textParts[2], 'hex');
        
        const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
        decipher.setAuthTag(tag);
        
        const decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]);
        return decrypted.toString('utf8');
    } catch (error) {
        console.error("Decryption failed:", error);
        // If decryption fails, it might be legacy data or corrupted.
        // Returning the original text is a safe fallback.
        return text;
    }
}

module.exports = { encrypt, decrypt };
