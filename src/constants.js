const configManager = require('../configManager');

// Load constants from config.json
function getConstants() {
    const config = configManager.get('constants');
    
    return {
        DURATION_CONSTANTS: config.duration,
        CACHE_CONSTANTS: config.cache,
        RATE_LIMIT_CONSTANTS: config.rateLimit,
        ANTI_SPAM_CONSTANTS: config.antiSpam,
        ANTI_RAID_CONSTANTS: config.antiRaid,
        API_CONSTANTS: config.api,
        VALIDATION_CONSTANTS: {
            EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            MIN_RECOVERY_CODE_LENGTH: config.validation?.MIN_RECOVERY_CODE_LENGTH || 5,
            MIN_PASSWORD_LENGTH: config.validation?.MIN_PASSWORD_LENGTH || 3,
            ACCOUNT_CODE_LENGTH: config.validation?.ACCOUNT_CODE_LENGTH || 6,
            REGEX_DURATION_FORMAT: /^(\d+)([smhd])$/,
        },
        ERROR_CONSTANTS: {
            HYPIXEL_ERROR_THROTTLE: 'Key throttle',
            HYPIXEL_ERROR_INVALID_KEY: 'Invalid API key',
        },
        STATUS_CONSTANTS: config.status,
        
        ACCOUNT_STATUS_PENDING: config.status.ACCOUNT_STATUS_PENDING,
        ACCOUNT_STATUS_DELIVERED: config.status.ACCOUNT_STATUS_DELIVERED,
        BAN_REQUEST_STATUS_OPEN: config.status.BAN_REQUEST_STATUS_OPEN,
        BAN_REQUEST_STATUS_CLOSED: config.status.BAN_REQUEST_STATUS_CLOSED,
    };
}

module.exports = getConstants();
