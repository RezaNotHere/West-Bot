const Enmap = require('enmap').default;
const { encrypt, decrypt } = require('./encryption');

// A wrapper for Enmap that automatically encrypts and decrypts data.
class SecureEnmap extends Enmap {
    constructor(options) {
        super(options);
    }

    // Encrypt value before setting
    set(key, value) {
        // To handle objects and other types, we stringify them before encryption.
        const stringValue = JSON.stringify(value);
        const encryptedValue = encrypt(stringValue);
        return super.set(key, encryptedValue);
    }

    // Decrypt value after getting
    get(key) {
        const encryptedValue = super.get(key);
        if (!encryptedValue) return null;
        
        try {
            const decryptedValue = decrypt(encryptedValue);
            // We parse the JSON string back into its original form.
            return JSON.parse(decryptedValue);
        } catch (e) {
            // Log the error properly
            if (this.logger) {
                this.logger.logError(e, 'Database', {
                    operation: 'get',
                    key: key,
                    errorType: e instanceof SyntaxError ? 'JSON Parse Error' : 'Decryption Error'
                });
            }
            throw new Error(`Failed to retrieve data for key '${key}'`);
        }
    }
}

// Define which collections need encryption
const SENSITIVE_COLLECTIONS = [
    'warnings',
    'tickets',
    'ticketInfo',
    'pendingAccounts',
    'giveaways'
];

// Define collection settings
const COLLECTION_SETTINGS = {
    warnings: { fetchAll: false },
    bannedWords: { fetchAll: true }, // Small dataset, safe to fetch all
    tickets: { fetchAll: false },
    ticketInfo: { fetchAll: false },
    giveaways: { fetchAll: false },
    cards: { fetchAll: false },
    polls: { fetchAll: false },
    invites: { fetchAll: false },
    pendingAccounts: { fetchAll: true }, // Needed for expiration checks
};

const db = {};

// Initialize collections with proper settings
for (const [name, settings] of Object.entries(COLLECTION_SETTINGS)) {
    const EnmapClass = SENSITIVE_COLLECTIONS.includes(name) ? SecureEnmap : Enmap;
    db[name] = new EnmapClass({
        name,
        ...settings,
        // Add optional batching for large collections
        ensureProps: !settings.fetchAll
    });
}

// --- Automatic Cleanup for Pending Accounts ---
/**
 * Cleanup expired pending accounts
 * @returns {number} Number of accounts cleaned up
 */
function cleanupPendingAccounts() {
    const now = Date.now();
    const ONE_HOUR_MS = 60 * 60 * 1000; // 1 hour in milliseconds
    let cleanedCount = 0;

    try {
        // Iterate over all pending accounts to check for expiration
        for (const [key, value] of db.pendingAccounts) {
            // Validate timestamp existence and format
            if (!value || typeof value !== 'object') {
                console.warn(`[DB] Invalid pending account found for key: ${key}`);
                db.pendingAccounts.delete(key);
                cleanedCount++;
                continue;
            }

            const timestamp = value.timestamp;
            if (!timestamp || typeof timestamp !== 'number') {
                console.warn(`[DB] Missing or invalid timestamp for pending account: ${key}`);
                db.pendingAccounts.delete(key);
                cleanedCount++;
                continue;
            }

            if (now - timestamp > ONE_HOUR_MS) {
                console.log(`[DB] Expired pending account found, deleting: ${key}`);
                db.pendingAccounts.delete(key);
                cleanedCount++;
            }
        }
    } catch (error) {
        console.error('[DB] Error during pending accounts cleanup:', error);
        if (db.pendingAccounts.logger) {
            db.pendingAccounts.logger.logError(error, 'Database', {
                operation: 'cleanupPendingAccounts'
            });
        }
    }

    return cleanedCount;
}

// Run cleanup every 15 minutes to keep the database clean.
console.log('[DB] Setting up periodic cleanup for pending accounts.');
setInterval(cleanupPendingAccounts, 15 * 60 * 1000);

// Initial cleanup on startup
cleanupPendingAccounts();

// Add enhanced database management functions
const dbManager = {
    /**
     * Set logger for all database collections
     * @param {Object} logger - The logger instance
     */
    setLogger(logger) {
        for (const collection of Object.values(db)) {
            if (collection instanceof Enmap) {
                collection.logger = logger;
            }
        }
    },

    /**
     * Get database statistics
     * @returns {Object} Database statistics
     */
    getStats() {
        const stats = {};
        for (const [name, collection] of Object.entries(db)) {
            if (collection instanceof Enmap) {
                stats[name] = {
                    size: collection.size,
                    encrypted: collection instanceof SecureEnmap,
                    autoFetch: COLLECTION_SETTINGS[name]?.fetchAll || false
                };
            }
        }
        return stats;
    },

    /**
     * Perform maintenance tasks
     */
    async maintenance() {
        const cleaned = cleanupPendingAccounts();
        console.log(`[DB] Maintenance complete. Cleaned ${cleaned} expired accounts.`);
    }
};

// Export both the database and manager
module.exports = {
    db,
    dbManager
};