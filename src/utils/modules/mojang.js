const axios = require('axios');
const { LRUCache } = require('lru-cache');
const { getCapeTypeName } = require('./cosmetics');

// Configure cache with size limits and max age
const cache = new LRUCache({
    max: 500, // Maximum number of items
    ttl: 5 * 60 * 1000, // Items expire after 5 minutes (ttl instead of maxAge in newer versions)
    updateAgeOnGet: true // Reset timer when item is accessed
});

/**
 * Fetch name history for a Minecraft UUID
 * @param {string} uuid - Minecraft UUID
 * @returns {Promise<Array|null>} Array of name history entries or null on error
 */
async function getNameHistory(uuid) {
    try {
        const response = await axios.get(`https://api.mojang.com/user/profiles/${uuid}/names`);
        return response.data.reverse();
    } catch (error) {
        console.error('Error fetching name history:', error);
        return null;
    }
}

/**
 * Fetch Mojang profile data for a username
 * @param {string} username - Minecraft username
 * @param {Object} logger - Logger instance
 * @returns {Promise<Object|null>} Mojang profile data or null
 * @throws {Error} If request fails
 */
async function getMojangData(username, logger) {
    if (!username || typeof username !== 'string') {
        throw new Error('Invalid username provided');
    }

    const cacheKey = `mojang-${username.toLowerCase()}`;
    const cached = cache.get(cacheKey);
    if (cached) {
        return cached;
    }

    try {
        const response = await axios.get(
            `https://api.mojang.com/users/profiles/minecraft/${username}`,
            { 
                timeout: 10000,
                validateStatus: status => status === 200 || status === 404
            }
        );
        
        if (response.data) {
            cache.set(cacheKey, response.data);
            return response.data;
        }
        return null;
    } catch (error) {
        if (error.response?.status === 404) {
            return null;
        }
        
        if (logger) {
            logger.logError(error, 'MojangAPI', {
                username,
                errorType: error.code || 'Unknown',
                message: error.message
            });
        }
        
        throw new Error(`Failed to fetch Mojang data: ${error.message}`);
    }
}

/**
 * Fetch detailed Minecraft profile information
 * @param {string} uuid - Minecraft UUID
 * @param {string} username - Minecraft username
 * @returns {Promise<Object>} Profile information including capes and cosmetics
 */
async function getMinecraftProfile(uuid, username) {
    const cacheKey = `profile-${uuid}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    try {
        const sessionResponse = await axios.get(
            `https://sessionserver.mojang.com/session/minecraft/profile/${uuid}`,
            { timeout: 10000 }
        );

        const texturesBase64 = sessionResponse.data.properties.find(prop => prop.name === 'textures').value;
        const texturesData = JSON.parse(Buffer.from(texturesBase64, 'base64').toString());
        
        const capes = [];
        const cosmetics = [];

        if (texturesData.textures.CAPE) {
            const capeUrl = texturesData.textures.CAPE.url;
            capes.push(getCapeTypeName(capeUrl));
        }

        try {
            const optifineCapeUrl = `http://s.optifine.net/capes/${username}.png`;
            const optifineResponse = await axios.head(optifineCapeUrl, { timeout: 5000 });
            if (optifineResponse.status === 200) {
                capes.push('🎭 کیپ OptiFine');
            }
        } catch (e) {
            // Optifine cape check failed, continue without it
        }

        if (texturesData.textures.SKIN?.metadata?.model === 'slim') {
            cosmetics.push('👕 مدل Slim (Alex)');
        } else {
            cosmetics.push('👕 مدل Classic (Steve)');
        }

        const result = {
            capes,
            cosmetics,
            totalPages: Math.ceil((capes.length + cosmetics.length) / 5)
        };

        cache.set(cacheKey, result);
        return result;
    } catch (error) {
        console.error('Error fetching profile:', error);
        return { capes: [], cosmetics: [], totalPages: 0 };
    }
}

module.exports = {
    getNameHistory,
    getMojangData,
    getMinecraftProfile
};