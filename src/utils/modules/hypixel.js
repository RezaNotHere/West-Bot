/**
 * Hypixel API Module - Completely New
 * 
 * Features:
 * - Full Hypixel API integration
 * - Retry logic and rate limiting
 * - Guild API support
 * - Advanced stats parsing
 * - Comprehensive error handling
 * - Cache integration
 */

const axios = require('axios');
const { LRUCache } = require('lru-cache');

// Constants
const HYPIXEL_API_BASE = 'https://api.hypixel.net';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const REQUEST_TIMEOUT = 10000;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// Configure cache
const cache = new LRUCache({
    max: 500,
    ttl: CACHE_TTL,
    updateAgeOnGet: true
});

// Rate limiting
const rateLimitState = {
    requests: 0,
    resetTime: Date.now() + 60000,
    limited: false
};

/**
 * Check rate limit
 */
function checkRateLimit() {
    if (Date.now() > rateLimitState.resetTime) {
        rateLimitState.requests = 0;
        rateLimitState.resetTime = Date.now() + 60000;
        rateLimitState.limited = false;
    }
    
    if (rateLimitState.requests >= 120) { // Hypixel limit is 120/min
        rateLimitState.limited = true;
        return false;
    }
    
    rateLimitState.requests++;
    return true;
}

/**
 * Sleep utility
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Retry with exponential backoff
 */
async function retryWithBackoff(fn, retries = MAX_RETRIES) {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === retries - 1) throw error;
            
            if (error.response?.status === 429) {
                const delay = Math.min(RETRY_DELAY * Math.pow(2, i + 2), 30000);
                console.warn(`[Hypixel] Rate limited, waiting ${delay}ms`);
                await sleep(delay);
            } else if (error.response?.status === 403) {
                throw new Error('Invalid API key');
            } else {
                const delay = RETRY_DELAY * Math.pow(2, i);
                await sleep(delay);
            }
        }
    }
}

/**
 * Fetch player data from Hypixel
 * @param {string} uuid - Player UUID
 * @param {string} apiKey - Hypixel API key
 * @returns {Promise<Object|null>} Player data or null
 */
async function getHypixelData(uuid, apiKey) {
    if (!uuid) throw new Error('UUID is required');
    if (!apiKey) throw new Error('API key is required');
    
    const normalizedUuid = uuid.replace(/-/g, '');
    const cacheKey = `hypixel-${normalizedUuid}`;
    
    // Check cache
    const cached = cache.get(cacheKey);
    if (cached) {
        console.log(`[Hypixel] Cache hit for UUID: ${normalizedUuid}`);
        return cached;
    }
    
    // Check rate limit
    if (!checkRateLimit()) {
        throw new Error('Rate limit exceeded');
    }
    
    try {
        const result = await retryWithBackoff(async () => {
            const response = await axios.get(
                `${HYPIXEL_API_BASE}/player`,
                {
                    params: { uuid: normalizedUuid, key: apiKey },
                    timeout: REQUEST_TIMEOUT,
                    validateStatus: status => status === 200 || status === 404
                }
            );
            
            if (!response.data || !response.data.success) {
                throw new Error('Invalid response from Hypixel');
            }
            
            return response.data;
        });
        
        if (result && result.player) {
            cache.set(cacheKey, result);
            console.log(`[Hypixel] Data fetched for UUID: ${normalizedUuid}`);
        }
        
        return result;
    } catch (error) {
        console.error('[Hypixel] Error fetching player data:', error.message);
        throw error;
    }
}

/**
 * Get player's guild information
 * @param {string} uuid - Player UUID
 * @param {string} apiKey - Hypixel API key
 * @returns {Promise<Object|null>} Guild info or null
 */
async function getGuildData(uuid, apiKey) {
    if (!uuid || !apiKey) return null;
    
    const normalizedUuid = uuid.replace(/-/g, '');
    const cacheKey = `guild-${normalizedUuid}`;
    
    // Check cache
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    
    // Check rate limit
    if (!checkRateLimit()) return null;
    
    try {
        const result = await retryWithBackoff(async () => {
            const response = await axios.get(
                `${HYPIXEL_API_BASE}/guild`,
                {
                    params: { player: normalizedUuid, key: apiKey },
                    timeout: REQUEST_TIMEOUT
                }
            );
            
            if (!response.data || !response.data.success) {
                return null;
            }
            
            return response.data.guild;
        });
        
        if (result) {
            const guildInfo = {
                name: result.name || 'N/A',
                tag: result.tag || '',
                level: calculateGuildLevel(result.exp || 0),
                members: result.members?.length || 0,
                created: result.created ? new Date(result.created).toLocaleDateString('fa-IR') : 'N/A'
            };
            
            // Find when player joined
            const member = result.members?.find(m => m.uuid === normalizedUuid);
            if (member) {
                guildInfo.joined = new Date(member.joined).toLocaleDateString('fa-IR');
            } else {
                guildInfo.joined = 'N/A';
            }
            
            cache.set(cacheKey, guildInfo);
            return guildInfo;
        }
        
        return null;
    } catch (error) {
        console.error('[Hypixel] Error fetching guild data:', error.message);
        return null; // Graceful degradation
    }
}

/**
 * Calculate guild level from experience
 * @param {number} exp - Guild experience
 * @returns {number} Guild level
 */
function calculateGuildLevel(exp) {
    const EXP_NEEDED = [
        100000, 150000, 250000, 500000, 750000, 1000000, 1250000, 1500000, 
        2000000, 2500000, 2500000, 2500000, 2500000, 2500000, 3000000
    ];
    
    let level = 0;
    
    for (let i = 0; i <= 1000; i++) {
        let needed = i >= EXP_NEEDED.length ? EXP_NEEDED[EXP_NEEDED.length - 1] : EXP_NEEDED[i];
        
        if (exp - needed < 0) {
            return level;
        }
        
        level++;
        exp -= needed;
    }
    
    return level;
}

/**
 * Parse and format player rank
 * @param {Object} player - Hypixel player data
 * @returns {string} Formatted rank
 */
function getPlayerRank(player) {
    if (!player) return 'پیش‌فرض';
    
    const rankMap = {
        'VIP': '✨ VIP',
        'VIP_PLUS': '✨ VIP+',
        'MVP': '🌟 MVP',
        'MVP_PLUS': '🌟 MVP+',
        'MVP_PLUS_PLUS': '💫 MVP++',
        'SUPERSTAR': '💫 MVP++',
        'YOUTUBER': '🎥 YouTuber',
        'MODERATOR': '🛡️ Moderator',
        'HELPER': '🔰 Helper',
        'ADMIN': '👑 Admin',
        'OWNER': '👑 Owner',
        'GAME_MASTER': '🎮 GM'
    };
    
    // Priority order
    if (player.rank && player.rank !== 'NORMAL') {
        return rankMap[player.rank] || player.rank;
    }
    
    if (player.monthlyPackageRank && player.monthlyPackageRank !== 'NONE') {
        return rankMap[player.monthlyPackageRank] || player.monthlyPackageRank;
    }
    
    if (player.newPackageRank && player.newPackageRank !== 'NONE') {
        return rankMap[player.newPackageRank] || player.newPackageRank;
    }
    
    if (player.packageRank && player.packageRank !== 'NONE') {
        return rankMap[player.packageRank] || player.packageRank;
    }
    
    return 'پیش‌فرض';
}

/**
 * Calculate network level
 * @param {Object} player - Hypixel player data
 * @returns {number} Network level
 */
function getNetworkLevel(player) {
    if (!player) return 0;
    
    const exp = player.networkExp || 0;
    return Math.floor((Math.sqrt(exp + 15312.5) - 125 / Math.sqrt(2)) / (25 * Math.sqrt(2)));
}

/**
 * Get game statistics
 * @param {Object} player - Hypixel player data
 * @returns {Object} Formatted game stats
 */
function getGameStats(player) {
    if (!player || !player.stats) return {};
    
    const stats = {};
    
    // BedWars
    if (player.stats.Bedwars) {
        stats.bedwars = {
            wins: player.stats.Bedwars.wins_bedwars || 0,
            losses: player.stats.Bedwars.losses_bedwars || 0,
            kills: player.stats.Bedwars.kills_bedwars || 0,
            deaths: player.stats.Bedwars.deaths_bedwars || 0,
            finalKills: player.stats.Bedwars.final_kills_bedwars || 0,
            finalDeaths: player.stats.Bedwars.final_deaths_bedwars || 0,
            bedsDestroyed: player.stats.Bedwars.beds_broken_bedwars || 0,
            level: Math.floor(player.stats.Bedwars.Experience / 487000) || 0
        };
    }
    
    // SkyWars
    if (player.stats.SkyWars) {
        stats.skywars = {
            wins: player.stats.SkyWars.wins || 0,
            losses: player.stats.SkyWars.losses || 0,
            kills: player.stats.SkyWars.kills || 0,
            deaths: player.stats.SkyWars.deaths || 0,
            level: (player.stats.SkyWars.level || 1) + (player.stats.SkyWars.levelFormatted ? 0 : 0)
        };
    }
    
    // Duels
    if (player.stats.Duels) {
        stats.duels = {
            wins: player.stats.Duels.wins || 0,
            losses: player.stats.Duels.losses || 0
        };
    }
    
    return stats;
}

/**
 * Get cache stats
 */
function getCacheStats() {
    return {
        size: cache.size,
        max: cache.max,
        rateLimitState: {
            requests: rateLimitState.requests,
            limited: rateLimitState.limited,
            resetIn: Math.max(0, rateLimitState.resetTime - Date.now())
        }
    };
}

/**
 * Clear cache
 */
function clearCache() {
    cache.clear();
    console.log('[Hypixel] Cache cleared');
}

module.exports = {
    getHypixelData,
    getGuildData,
    getPlayerRank,
    getNetworkLevel,
    getGameStats,
    getCacheStats,
    clearCache
};
