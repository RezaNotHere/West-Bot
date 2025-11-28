const db = require('../../database').db;

/**
 * Add a warning to a user
 * @param {string} userId - Discord user ID
 * @param {string} reason - Warning reason
 * @param {Object} moderator - Moderator who issued the warning
 * @returns {Promise<number>} New warning count
 */
async function addWarning(userId, reason, moderator) {
    const warnings = await db.warnings.get(userId) || [];
    warnings.push({
        reason,
        moderatorId: moderator.id,
        timestamp: Date.now()
    });
    await db.warnings.set(userId, warnings);
    return warnings.length;
}

/**
 * Clear all warnings for a user
 * @param {string} userId - Discord user ID
 * @returns {Promise<boolean>} Success status
 */
async function clearWarnings(userId) {
    await db.warnings.delete(userId);
    return true;
}

/**
 * Get all warnings for a user
 * @param {string} userId - Discord user ID
 * @returns {Promise<Array>} Array of warnings
 */
async function getWarnings(userId) {
    return await db.warnings.get(userId) || [];
}

/**
 * Send a warning DM to a user
 * @param {Object} member - Discord guild member
 * @param {number} warningCount - Current warning count
 * @param {number} maxWarnings - Maximum warnings before action
 * @param {string} reason - Warning reason
 * @param {Object} moderator - Moderator who issued the warning
 * @returns {Promise<boolean>} Success status
 */
async function sendWarningDM(member, warningCount, maxWarnings, reason, moderator) {
    try {
        const warningEmbed = new EmbedBuilder()
            .setColor(warningCount >= maxWarnings ? 'Red' : 'Orange')
            .setTitle('⚠️ اخطار')
            .setDescription(`شما یک اخطار جدید در سرور دریافت کردید.
                \n**دلیل:** ${reason}
                \n**توسط:** ${moderator.displayName}
                \n**تعداد اخطارها:** ${warningCount}/${maxWarnings}`)
            .setTimestamp();

        await member.send({ embeds: [warningEmbed] });
        return true;
    } catch (error) {
        console.error('Failed to send warning DM:', error);
        return false;
    }
}

module.exports = {
    addWarning,
    clearWarnings,
    getWarnings,
    sendWarningDM
};