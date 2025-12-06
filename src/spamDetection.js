// spamDetection.js

// Store message timestamps for spam detection
const messageTimestamps = new Map();
const SPAM_THRESHOLD = 5; // Number of messages
const SPAM_TIME_WINDOW = 5000; // 5 seconds in milliseconds

/**
 * Check if a message is spam
 * @param {Message} message - Discord message object
 * @returns {Promise<boolean>} - True if spam detected
 */
async function isSpam(message) {
    const userId = message.author.id;
    const now = Date.now();
    
    // Get user's message timestamps
    let timestamps = messageTimestamps.get(userId) || [];
    
    // Add current message timestamp
    timestamps.push(now);
    
    // Remove old messages outside the time window
    timestamps = timestamps.filter(timestamp => now - timestamp < SPAM_TIME_WINDOW);
    
    // Update the user's timestamps
    messageTimestamps.set(userId, timestamps);
    
    // Check if user exceeded the threshold
    return timestamps.length >= SPAM_THRESHOLD;
}

/**
 * Get the number of messages detected for spam
 * @param {string} userId - Discord user ID
 * @returns {number} - Number of messages in the time window
 */
function getMessageCount(userId) {
    const timestamps = messageTimestamps.get(userId) || [];
    const now = Date.now();
    
    // Count messages in the time window
    const recentMessages = timestamps.filter(timestamp => now - timestamp < SPAM_TIME_WINDOW);
    return recentMessages.length;
}

/**
 * Clear message timestamps for a user
 * @param {string} userId - Discord user ID
 */
function clearSpamData(userId) {
    messageTimestamps.delete(userId);
}

/**
 * Clean up old message timestamps periodically
 */
function cleanup() {
    const now = Date.now();
    
    for (const [userId, timestamps] of messageTimestamps.entries()) {
        // Remove old timestamps
        const recentTimestamps = timestamps.filter(timestamp => now - timestamp < SPAM_TIME_WINDOW);
        
        if (recentTimestamps.length === 0) {
            // Remove user from map if no recent messages
            messageTimestamps.delete(userId);
        } else {
            // Update with recent timestamps only
            messageTimestamps.set(userId, recentTimestamps);
        }
    }
}

// Clean up every 5 minutes
setInterval(cleanup, 5 * 60 * 1000);

module.exports = {
    isSpam,
    getMessageCount,
    clearSpamData,
    cleanup
};
