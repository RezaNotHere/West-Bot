// utils.js - Enhanced Modular Version v2.3.0
const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    PermissionsBitField, 
    REST, 
    Routes, 
    SlashCommandBuilder, 
    PermissionFlagsBits 
} = require('discord.js');
const axios = require('axios');
const { db } = require('./database');
const config = require('../configManager');
const { createProfileImage: generateProfileImage } = require('./profileImage');

// --- Enhanced Configuration & Constants ---
const CACHE_DURATION = 5 * 60 * 1000;
const COLOR_PRESETS = {
    DEFAULT: "#006400",
    SUCCESS: "#00FF00",
    WARNING: "#FFA500",
    ERROR: "#FF0000",
    INFO: "#0099FF"
};

// Enhanced API Configuration
const API_CONFIG = {
    MOJANG: {
        BASE_URL: 'https://api.mojang.com',
        TIMEOUT: 10000,
        RETRY_ATTEMPTS: 3
    },
    HYPIXEL: {
        BASE_URL: 'https://api.hypixel.net',
        TIMEOUT: 10000,
        RETRY_ATTEMPTS: 2
    }
};

// --- Global State Management ---
const commands = [];
const cache = new Map();
const badWords = new Set();
const rateLimits = new Map(); // New: Rate limiting for API calls

// --- Load Bad Words from Database ---
function loadBadWords() {
    try {
        // Check if database is ready
        if (!db || !db.bannedWords) {
            console.log('⚠️ Database not ready, skipping bad words loading');
            return;
        }
        
        // Load all banned words from database
        badWords.clear();
        
        // Try different iteration methods
        try {
            // Method 1: Direct iteration
            for (const [word, value] of db.bannedWords) {
                if (value) {
                    badWords.add(word);
                }
            }
        } catch (iterError) {
            console.log('⚠️ Direct iteration failed, trying alternative method...');
            
            // Method 2: Using keys() and get()
            try {
                const keys = db.bannedWords.keys();
                for (const word of keys) {
                    const value = db.bannedWords.get(word);
                    if (value) {
                        badWords.add(word);
                    }
                }
            } catch (keysError) {
                console.log('⚠️ Keys method failed, trying forEach...');
                
                // Method 3: Using forEach
                try {
                    db.bannedWords.forEach((value, word) => {
                        if (value) {
                            badWords.add(word);
                        }
                    });
                } catch (forEachError) {
                    console.log('⚠️ All iteration methods failed, database might not be ready');
                    return;
                }
            }
        }
        
        console.log(`✅ Loaded ${badWords.size} banned words from database`);
    } catch (error) {
        console.error('❌ Error loading bad words:', error.message);
    }
}

// Client & Logger References
let client = null;
let logger = null;

function setClient(c) { client = c; }
function setLogger(l) { logger = l; }

// --- Enhanced Utility Functions ---

function ms(str) {
    if (!str) return 0;
    const unitMap = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    const match = /^(\d+)([smhd])$/.exec(str);
    if (!match) return null;
    return parseInt(match[1], 10) * unitMap[match[2]];
}

// New: Enhanced rate limiting
function checkRateLimit(key, limit = 5, window = 60000) {
    const now = Date.now();
    const userRequests = rateLimits.get(key) || [];
    
    // Remove old requests
    const validRequests = userRequests.filter(time => now - time < window);
    
    if (validRequests.length >= limit) {
        return false;
    }
    
    validRequests.push(now);
    rateLimits.set(key, validRequests);
    return true;
}

// New: Smart cache management
function getCache(key, duration = CACHE_DURATION) {
    const cached = cache.get(key);
    if (cached && (Date.now() - cached.timestamp) < duration) {
        return cached.data;
    }
    return null;
}

function setCache(key, data, duration = CACHE_DURATION) {
    cache.set(key, { data, timestamp: Date.now() });
    // Auto-cleanup after duration
    setTimeout(() => cache.delete(key), duration);
}

// New: Enhanced error handling
function handleError(error, context, additionalInfo = {}) {
    const errorInfo = {
        message: error.message,
        stack: error.stack,
        context,
        timestamp: new Date().toISOString(),
        ...additionalInfo
    };
    
    if (logger) {
        logger.logError(error, context, additionalInfo);
    } else {
        console.error(`[${context}] Error:`, errorInfo);
    }
    
    return errorInfo;
}

// Enhanced logging with colors and levels
async function logAction(guild, message, level = 'info') {
    try {
        const LOG_CHANNEL_ID = config.channels.log;
        if (!LOG_CHANNEL_ID) return;
        
        const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);
        if (!logChannel || !logChannel.isTextBased()) return;
        
        const colors = {
            info: COLOR_PRESETS.INFO,
            success: COLOR_PRESETS.SUCCESS,
            warning: COLOR_PRESETS.WARNING,
            error: COLOR_PRESETS.ERROR
        };
        
        const embed = new EmbedBuilder()
            .setColor(colors[level] || COLOR_PRESETS.INFO)
            .setDescription(message)
            .setTimestamp()
            .setFooter({ text: `Level: ${level.toUpperCase()}` });
            
        await logChannel.send({ embeds: [embed] });
    } catch (e) {
        console.error('Error logging action:', e);
    }
}

// --- Bad Words Management ---

async function addBadWord(word) {
    if (!word || typeof word !== 'string') return false;
    const cleanWord = word.toLowerCase().trim();
    if (badWords.has(cleanWord)) return false;
    badWords.add(cleanWord);
    await db.bannedWords.set(cleanWord, true);
    return true;
}

async function removeBadWord(word) {
    if (!word || typeof word !== 'string') return false;
    const cleanWord = word.toLowerCase().trim();
    if (!badWords.has(cleanWord)) return false;
    badWords.delete(cleanWord);
    await db.bannedWords.delete(cleanWord);
    return true;
}

function listBadWords() {
    return Array.from(badWords);
}

function isBadWord(text) {
    if (!text) return false;
    const words = text.toLowerCase().split(/\s+/);
    return words.some(word => badWords.has(word));
}

// --- Warning System ---

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

async function clearWarnings(userId) {
    await db.warnings.delete(userId);
    return true;
}

async function getWarnings(userId) {
    return await db.warnings.get(userId) || [];
}

async function sendWarningDM(member, warningCount, maxWarnings, reason, moderator) {
    try {
        const warningMessages = config.messages?.moderation || {};
        const colors = config.colors || {};
        
        const warningEmbed = new EmbedBuilder()
            .setColor(warningCount >= maxWarnings ? (colors.error || '#e74c3c') : (colors.warning || '#f39c12'))
            .setTitle(warningCount >= maxWarnings
                ? (warningMessages.banned || '🔨 You have been banned from the server')
                : (warningMessages.warned || '⚠️ Warning from server management'))
            .setDescription(warningCount >= maxWarnings
                ? `You have been banned from the server for receiving ${maxWarnings} warnings.`
                : `You have received a warning from server management.`
            )
            .addFields(
                { name: 'Number of warnings', value: `${warningCount} of ${maxWarnings}`, inline: true },
                { name: 'Warning reason', value: reason, inline: true },
                { name: 'Announcer', value: moderator.tag, inline: true }
            )
            .setFooter({ text: warningCount >= maxWarnings
                ? 'Your access to the server has been cut off'
                : 'Please follow the server rules'
            })
            .setTimestamp();

        await member.send({ embeds: [warningEmbed] });
        return true;
    } catch (error) {
        console.error('Failed to send warning DM:', error);
        return false;
    }
}

// --- Mojang & Hypixel API ---

async function getMojangData(username) {
    if (!username || typeof username !== 'string') {
        throw new Error('Invalid username provided');
    }

    // Rate limiting check
    if (!checkRateLimit(`mojang-${username}`, 3, 60000)) {
        throw new Error('Rate limit exceeded for Mojang API');
    }

    // Check cache first
    const cacheKey = `mojang-${username.toLowerCase()}`;
    const cached = getCache(cacheKey);
    if (cached) return cached;

    let lastError;
    
    // Retry logic
    for (let attempt = 1; attempt <= API_CONFIG.MOJANG.RETRY_ATTEMPTS; attempt++) {
        try {
            const response = await axios.get(`${API_CONFIG.MOJANG.BASE_URL}/users/profiles/minecraft/${username}`, { 
                timeout: API_CONFIG.MOJANG.TIMEOUT,
                validateStatus: status => status === 200 || status === 404
            });
            
            if (response.data) {
                setCache(cacheKey, response.data);
                return response.data;
            }
            
            return null;
        } catch (error) {
            lastError = error;
            
            if (error.response?.status === 404) {
                return null; // User not found, don't retry
            }
            
            if (attempt < API_CONFIG.MOJANG.RETRY_ATTEMPTS) {
                // Exponential backoff
                const delay = Math.pow(2, attempt) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    handleError(lastError, 'MojangAPI', { username, attempts: API_CONFIG.MOJANG.RETRY_ATTEMPTS });
    throw new Error(`Failed to fetch Mojang data after ${API_CONFIG.MOJANG.RETRY_ATTEMPTS} attempts: ${lastError.message}`);
}

async function getNameHistory(uuid) {
    // Rate limiting check
    if (!checkRateLimit(`namehistory-${uuid}`, 2, 60000)) {
        throw new Error('Rate limit exceeded for Name History API');
    }

    // Check cache first
    const cacheKey = `namehistory-${uuid}`;
    const cached = getCache(cacheKey);
    if (cached) return cached;

    try {
        const response = await axios.get(`${API_CONFIG.MOJANG.BASE_URL}/user/profiles/${uuid}/names`, {
            timeout: API_CONFIG.MOJANG.TIMEOUT
        });
        
        const history = response.data.reverse();
        setCache(cacheKey, history);
        return history;
    } catch (error) {
        handleError(error, 'NameHistoryAPI', { uuid });
        return null;
    }
}

async function getMinecraftProfile(uuid) {
    // Rate limiting check
    if (!checkRateLimit(`profile-${uuid}`, 2, 60000)) {
        throw new Error('Rate limit exceeded for Profile API');
    }

    // Check cache first
    const cacheKey = `profile-${uuid}`;
    const cached = getCache(cacheKey);
    if (cached) return cached;

    try {
        const sessionResponse = await axios.get(
            `https://sessionserver.mojang.com/session/minecraft/profile/${uuid}`, 
            { timeout: API_CONFIG.MOJANG.TIMEOUT }
        );
        
        const texturesBase64 = sessionResponse.data.properties.find(prop => prop.name === 'textures').value;
        const texturesData = JSON.parse(Buffer.from(texturesBase64, 'base64').toString());
        
        const capes = [];
        const cosmetics = [];

        // Mojang Capes
        if (texturesData.textures.CAPE) {
            const capeUrl = texturesData.textures.CAPE.url;
            capes.push(getCapeTypeName(capeUrl));
        }

        // OptiFine Cape (with error handling)
        try {
            const username = sessionResponse.data.name;
            const optifineCapeUrl = `http://s.optifine.net/capes/${username}.png`;
            const optifineResponse = await axios.head(optifineCapeUrl, { timeout: 5000 });
            if (optifineResponse.status === 200) {
                capes.push('🎭 کیپ OptiFine');
            }
        } catch (e) { /* Ignore OptiFine errors */ }

        // Skin Model
        if (texturesData.textures.SKIN?.metadata?.model === 'slim') {
            cosmetics.push('👕 مدل Slim (Alex)');
        } else {
            cosmetics.push('👕 مدل Classic (Steve)');
        }

        const result = {
            capes,
            cosmetics,
            totalPages: Math.ceil((capes.length + cosmetics.length) / 5),
            username: sessionResponse.data.name,
            uuid: uuid
        };

        setCache(cacheKey, result);
        return result;
    } catch (error) {
        handleError(error, 'ProfileAPI', { uuid });
        return { capes: [], cosmetics: [], totalPages: 0 };
    }
}

async function getHypixelData(uuid, apiKey) {
    if (!apiKey) {
        throw new Error('Hypixel API key is required');
    }

    // Rate limiting check
    if (!checkRateLimit(`hypixel-${uuid}`, 2, 60000)) {
        throw new Error('Rate limit exceeded for Hypixel API');
    }

    // Check cache first
    const cacheKey = `hypixel-${uuid}`;
    const cached = getCache(cacheKey);
    if (cached) return cached;

    let lastError;
    
    // Retry logic for Hypixel
    for (let attempt = 1; attempt <= API_CONFIG.HYPIXEL.RETRY_ATTEMPTS; attempt++) {
        try {
            const response = await axios.get(
                `${API_CONFIG.HYPIXEL.BASE_URL}/player?uuid=${uuid}&key=${apiKey}`, 
                { timeout: API_CONFIG.HYPIXEL.TIMEOUT }
            );
            
            if (response.data && response.data.player) {
                setCache(cacheKey, response.data);
                return response.data;
            }
            
            return response.data;
        } catch (error) {
            lastError = error;
            
            if (attempt < API_CONFIG.HYPIXEL.RETRY_ATTEMPTS) {
                // Exponential backoff
                const delay = Math.pow(2, attempt) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    handleError(lastError, 'HypixelAPI', { uuid, attempts: API_CONFIG.HYPIXEL.RETRY_ATTEMPTS });
    throw new Error(`Failed to fetch Hypixel data after ${API_CONFIG.HYPIXEL.RETRY_ATTEMPTS} attempts: ${lastError.message}`);
}

// --- Helper Formatting Functions ---

function getCapeTypeName(capeUrl) {
    if (capeUrl.includes('minecraft.net')) {
        if (capeUrl.includes('migrator')) return '🌟 Mojang Migration Cape';
        if (capeUrl.includes('scrolls')) return '📜 Scrolls Cape';
        if (capeUrl.includes('translator')) return '🌍 Mojang Translator Cape';
        if (capeUrl.includes('cobalt')) return '💠 Cobalt Cape';
        if (capeUrl.includes('mojang')) return '⭐ Mojang Employee Cape';
        if (capeUrl.includes('minecon')) {
            const year = capeUrl.match(/201[0-9]/);
            return `🎪 MineCon Cape ${year ? year[0] : ''}`;
        }
        return '🌟 Official Mojang Cape';
    }
    if (capeUrl.includes('optifine')) return '🎭 OptiFine Cape';
    return '🧥 Unknown Cape';
}

function getHypixelRanks(player) {
    const ranks = [];
    if (player.rank && player.rank !== 'NORMAL') ranks.push(formatRank(player.rank));
    if (player.newPackageRank && player.newPackageRank !== 'NONE') ranks.push(formatRank(player.newPackageRank));
    if (player.monthlyPackageRank && player.monthlyPackageRank !== 'NONE') ranks.push(formatRank(player.monthlyPackageRank));
    if (player.monthlyRankColor && player.monthlyRankColor !== 'NONE') ranks.push(formatRank(player.monthlyRankColor));
    if (player.rankPlusColor) ranks.push(`+${formatRank(player.rankPlusColor)}`);
    if (player.youtubeRank) ranks.push(`🎥 ${formatRank(player.youtubeRank)}`);
    if (player.role) ranks.push(formatRank(player.role));
    const uniqueRanks = [...new Set(ranks.filter(rank => rank))];
    return uniqueRanks.length > 0 ? uniqueRanks.join(' ') : 'پیش‌فرض';
}

function formatRank(rank) {
    const rankMap = {
        'VIP': '✨ VIP', 'VIP_PLUS': '✨ VIP+', 'MVP': '🌟 MVP', 'MVP_PLUS': '🌟 MVP+',
        'MVP_PLUS_PLUS': '💫 MVP++', 'SUPERSTAR': '💫 MVP++', 'YOUTUBER': '🎥 YouTuber',
        'MODERATOR': '🛡️ Moderator', 'HELPER': '🔰 Helper', 'ADMIN': '👑 Admin',
        'OWNER': '👑 Owner', 'GAME_MASTER': '🎮 Game Master', 'BUILD_TEAM': '🏗️ Build Team',
        'NONE': null, 'NORMAL': null
    };
    return rankMap[rank] || rank;
}

function getNetworkLevel(player) {
    const networkExp = player.networkExp || 0;
    return Math.floor((Math.sqrt(networkExp + 15312.5) - 125 / Math.sqrt(2)) / (25 * Math.sqrt(2)));
}

function getGameStats(player) {
    const games = {};
    if (player.stats) {
        if (player.stats.Bedwars) games.Bedwars = { wins: player.stats.Bedwars.wins_bedwars || 0, losses: player.stats.Bedwars.losses_bedwars || 0, level: player.stats.Bedwars.Experience || 0 };
        if (player.stats.SkyWars) games.SkyWars = { wins: player.stats.SkyWars.wins || 0, losses: player.stats.SkyWars.losses || 0, level: player.stats.SkyWars.level || 0 };
        if (player.stats.MurderMystery) games.MurderMystery = { wins: player.stats.MurderMystery.wins || 0, games: player.stats.MurderMystery.games || 0 };
    }
    return games;
}

// --- Embed Generators ---

function createCosmeticEmbed(username, uuid, cosmeticCapes, cosmetics, page) {
    const start = page * 5;
    const end = start + 5;
    const capesPage = cosmeticCapes.slice(start, end);
    const cosmeticsPage = cosmetics.slice(start, end);

    const embed = new EmbedBuilder()
        .setColor(COLOR_PRESETS.DEFAULT)
        .setTitle(`🎮 پروفایل ماینکرفت ${username}`)
        .setImage(`https://mc-heads.net/minecraft/profile/${username}`)
        .setThumbnail(`https://mc-heads.net/head/${uuid}/left`)
        .setTimestamp();

    embed.addFields({ 
        name: "🎭 نمای کامل کاراکتر", 
        value: `[مشاهده رندر HD](https://mc-heads.net/body/${uuid}/left)`,
        inline: true 
    });

    if (capesPage.length > 0) {
        embed.addFields({ 
            name: "🧥 کیپ‌های فعال", 
            value: `[مشاهده کیپ‌ها در NameMC](https://namemc.com/profile/${uuid})\n${capesPage.join('\n')}`,
            inline: true 
        });
    }
    
    if (cosmeticsPage.length > 0) {
        embed.addFields({ 
            name: "🎨 مدل اسکین", 
            value: cosmeticsPage.join('\n'), 
            inline: true 
        });
    }

    embed.addFields({ 
        name: "🔍 لینک‌های مفید", 
        value: `[NameMC](https://namemc.com/profile/${uuid}) | [Skin History](https://namemc.com/profile/${uuid}/skin) | [Cape Viewer](https://mc-heads.net/cape/${uuid})`, 
        inline: false 
    });

    return embed;
}

// Placeholder function for createProfileImage since it was missing in source
async function createProfileImage(data) {
    try {
        return await generateProfileImage(data);
    } catch (error) {
        console.error('Error generating profile image:', error);
        return Buffer.from([]);
    }
}

async function sendProfileImageEmbed(interaction, uuid, capeUrls, hypixelStats) {
    try {
        let username = 'Unknown';
        try {
            if (interaction?.options && typeof interaction.options.getString === 'function') {
                username = interaction.options.getString('username') || username;
            }
        } catch (e) {}

        if ((!username || username === 'Unknown') && uuid) {
            try {
                const mojang = await getMojangData(uuid);
                if (mojang && mojang.name) username = mojang.name || mojang.username || username;
            } catch (e) {}
        }

        let stats = {};
        if (hypixelStats && typeof hypixelStats === 'object') {
            if (hypixelStats.Bedwars) {
                const bw = hypixelStats.Bedwars;
                stats['Bedwars Level'] = bw.level || 0;
                stats['Bedwars Wins'] = bw.wins || 0;
                stats['Bedwars Losses'] = bw.losses || 0;
                stats['Bedwars W/L'] = ((bw.wins || 0) / (bw.losses || 1)).toFixed(2);
            }
            if (hypixelStats.SkyWars) {
                const sw = hypixelStats.SkyWars;
                stats['SkyWars Level'] = sw.level || 0;
                stats['SkyWars Wins'] = sw.wins || 0;
                stats['SkyWars Losses'] = sw.losses || 0;
                stats['SkyWars W/L'] = ((sw.wins || 0) / (sw.losses || 1)).toFixed(2);
            }
        }

        const buffer = await createProfileImage({ uuid, username, rank: 'Unknown', stats, capeUrls });

        const capeInfo = capeUrls.length > 0 
            ? `🧥 **${capeUrls.length}** کیپ فعال`
            : '❌ بدون کیپ فعال';

        const price = interaction.options?.getString('price');

        const mainEmbed = {
            color: parseInt(COLOR_PRESETS.DEFAULT.replace("#", ""), 16),
            author: {
                name: `🎮 پروفایل ماینکرفت ${username}`,
                icon_url: `https://mc-heads.net/avatar/${uuid}`
            },
            title: capeInfo,
            description: [
                `> 📝 **نام کاربری:** \`${username}\``,
                `> 🆔 **UUID:** \`${uuid}\``,
                price ? `> 💰 **قیمت:** ${price} تومان` : '',
                `\n${capeUrls.length > 0 ? '**🏆 کیپ‌های فعال:**\n' + capeUrls.map(url => '> • ' + getCapeTypeName(url)).join('\n') : ''}`
            ].filter(Boolean).join('\n'),
            image: { url: 'attachment://profile.png' },
            footer: { 
                text: '⭐ کلیک روی دکمه‌های زیر برای اطلاعات بیشتر',
                icon_url: 'https://mc-heads.net/head/' + uuid
            },
            timestamp: new Date()
        };

        const files = buffer.length > 0 ? [{ attachment: buffer, name: 'profile.png' }] : [];
        if (files.length === 0) delete mainEmbed.image;

        await interaction.editReply({
            embeds: [mainEmbed],
            components: [
                new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder().setCustomId(`namehistory_${uuid}`).setLabel('📜 تاریخچه نام‌ها').setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setURL(`https://namemc.com/profile/${uuid}`).setLabel('🔍 مشاهده در NameMC').setStyle(ButtonStyle.Link),
                        new ButtonBuilder().setURL(`https://plancke.io/hypixel/player/stats/${uuid}`).setLabel('📊 استتس کامل هایپیکسل').setStyle(ButtonStyle.Link)
                    )
            ],
            files: files
        });
    } catch (e) {
        console.error('Error sending profile image embed:', e);
        const errorEmbed = new EmbedBuilder()
            .setColor('Red')
            .setTitle('❌ خطا')
            .setDescription('خطا در ساخت تصویر پروفایل.')
            .setTimestamp();
        await interaction.editReply({ embeds: [errorEmbed], files: [] });
    }
}

// --- Helper Functions ---

function getButtonStyle(styleName) {
    const styles = {
        'Primary': ButtonStyle.Primary,
        'Secondary': ButtonStyle.Secondary,
        'Success': ButtonStyle.Success,
        'Danger': ButtonStyle.Danger,
        'Link': ButtonStyle.Link
    };
    return styles[styleName] || ButtonStyle.Primary;
}

// --- Ticket System ---

function getCategoryNameForReason(reason) {
    // Get category from config
    const ticketConfig = config.ticketSystem;
    const category = ticketConfig?.menu?.categories?.find(cat => cat.value === reason);

    // If found, create category name with emoji prefix + label (minus any existing emoji)
    if (category && category.label) {
        // Remove any existing emojis from the label to avoid duplication
        const cleanLabel = category.label.replace(/[^\w\s-]/g, '').trim();
        return `🎫${cleanLabel}`;
    }

    // Fallback
    return '🎫Tickets';
}

async function ensureTicketCategory(guild, categoryName) {
    let category = guild.channels.cache.find(c => c.name === categoryName && c.type === 4); // 4 = GUILD_CATEGORY
    if (!category) {
        category = await guild.channels.create({
            name: categoryName,
            type: 4
        });
    }
    return category;
}

// در فایل src/utils.js این تابع را جایگزین کنید:

async function createTicketChannel(guild, user, reason, additionalDetails = '') {
    const ticketConfig = config.ticketSystem;
    if (!ticketConfig) throw new Error('Ticket system configuration not found');

    // ۱. دریافت ID رول پشتیبانی (برای تنظیم دسترسی دیدن تیکت)
    const SUPPORT_ROLE_ID = config.roles?.ticketAccess;
    if (!SUPPORT_ROLE_ID) throw new Error('Ticket access role ID (config.roles.ticketAccess) not configured');

    // ۲. تعیین نام کتگوری بر اساس نوع تیکت
    const categoryName = getCategoryNameForReason(reason);

    // ۳. پیدا کردن یا ساختن کتگوری بر اساس نوع تیکت
    let category = await ensureTicketCategory(guild, categoryName);

    const ticketNumber = (guild.channels.cache.filter(ch => ch.name.startsWith('ticket-')).size) + 1;
    const channelName = ticketConfig.channelNameTemplate.replace('{username}', user.username).replace('{number}', ticketNumber);
    
    const ticketChannel = await guild.channels.create({
        name: channelName,
        type: 0, // GUILD_TEXT
        parent: category.id,
        permissionOverwrites: [
            { id: guild.id, deny: ['ViewChannel'] }, // همه ممبرها نبینند
            { id: user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AttachFiles', 'EmbedLinks'] }, // کاربر ببیند
            { id: client.user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageMessages'] } // ربات ببیند
        ]
    });

    // ۳. دادن دسترسی به تیم پشتیبانی
    if (SUPPORT_ROLE_ID && SUPPORT_ROLE_ID !== guild.id) {
        try {
            await ticketChannel.permissionOverwrites.edit(SUPPORT_ROLE_ID, {
                ViewChannel: true,
                ReadMessageHistory: true,
                SendMessages: true // ✅ اصلاح شد: قبلاً false بود و ادمین نمی‌توانست تایپ کند!
            });
        } catch (error) {
            console.error('Error setting permissions for support role:', error);
        }
    }

    // بقیه کدها مثل قبل...
    const finalReason = ticketConfig.menu.categories.find(cat => cat.value === reason)?.label || reason;
    
    const welcomeEmbed = new EmbedBuilder()
        .setColor(ticketConfig.embedColor || '#0099ff')
        .setTitle(ticketConfig.welcomeMessage?.title?.replace('{username}', user.username).replace('{user_tag}', user.tag) || '🎟️ Support Ticket')
        .setDescription(ticketConfig.welcomeMessage?.description?.replace('{username}', user.username).replace('{user_tag}', user.tag).replace('{reason}', finalReason) || `Hello ${user},\n\nThank you for creating a ticket. Our support team will be with you shortly.\n\n**Subject:** ${finalReason}`)
        .addFields(
            { name: 'Created By', value: `${user.tag} (${user.id})`, inline: true },
            { name: 'Ticket ID', value: `#${ticketNumber}`, inline: true },
            { name: 'Created At', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
        )
        .setThumbnail(guild.iconURL())
        .setFooter({ text: guild.name, iconURL: guild.iconURL() })
        .setTimestamp();

    if (additionalDetails) {
        welcomeEmbed.addFields({
            name: 'Additional Details',
            value: additionalDetails.length > 1024 ? additionalDetails.substring(0, 1021) + '...' : additionalDetails,
            inline: false
        });
    }

    const userButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('complete_purchase').setLabel(ticketConfig.buttons?.user?.completePurchase?.label || '✅ Complete Purchase').setStyle(getButtonStyle(ticketConfig.buttons?.user?.completePurchase?.style || 'Success')),
        new ButtonBuilder().setCustomId('close_ticket_user').setLabel(ticketConfig.buttons?.user?.closeTicket?.label || '🔒 Close Ticket').setStyle(getButtonStyle(ticketConfig.buttons?.user?.closeTicket?.style || 'Danger'))
    );

    const adminButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('record_order_admin').setLabel(ticketConfig.buttons?.admin?.recordOrder?.label || '📝 Record Order').setStyle(getButtonStyle(ticketConfig.buttons?.admin?.recordOrder?.style || 'Primary')),
        new ButtonBuilder().setCustomId('complete_purchase_admin').setLabel(ticketConfig.buttons?.admin?.completePurchase?.label || '✅ Complete Order').setStyle(getButtonStyle(ticketConfig.buttons?.admin?.completePurchase?.style || 'Success')),
        new ButtonBuilder().setCustomId('claim_ticket').setLabel(ticketConfig.buttons?.admin?.claimTicket?.label || '👋 Claim Ticket').setStyle(getButtonStyle(ticketConfig.buttons?.admin?.claimTicket?.style || 'Secondary'))
    );

    const mentionText = `<@${user.id}> <@&${SUPPORT_ROLE_ID}>`;

    await ticketChannel.send({ 
        content: mentionText, 
        embeds: [welcomeEmbed], 
        components: [userButtons, adminButtons]
    });

    // ذخیره اطلاعات تیکت در دیتابیس
    db.ticketInfo.set(ticketChannel.id, {
        ownerId: user.id,
        reason: finalReason,
        createdAt: Date.now(),
        originalCategory: category.id,
        additionalDetails: additionalDetails || ''
    });

    // ذخیره Channel ID برای امکان بازگشت به تیکت
    db.tickets.set(user.id, ticketChannel.id);

    await logAction(guild, `🎟️ New ticket created for ${user.tag} with subject "${finalReason}". <#${ticketChannel.id}>`);

    return ticketChannel;
}

// --- Shop & Events Logic ---

async function updateShopStatus(client, guild) {
    // This function was broken in source.
    // Placeholder logic: Log status update.
    if (logger) logger.log('Shop status update triggered.');
    // Add real shop status logic here (e.g. updating channel stats)
}

// Active giveaway timers to prevent duplicate processing
const activeGiveawayTimers = new Set();

async function checkGiveaways() {
    if (db.giveaways.size === 0) return;
    for (const messageId of db.giveaways.keys()) {
        const giveaway = db.giveaways.get(messageId);
        if (!giveaway || giveaway.ended) continue;

        const now = Date.now();
        const remainingTime = giveaway.endTime - now;

        // If giveaway has already ended, immediately process it
        if (remainingTime <= 0) {
            // Check if already being processed to prevent duplicate calls
            if (!activeGiveawayTimers.has(messageId)) {
                activeGiveawayTimers.add(messageId);
                await endGiveaway(messageId);
                activeGiveawayTimers.delete(messageId);
            }
        } else {
            // For future giveaways, set a timer only if not already set
            if (!activeGiveawayTimers.has(messageId)) {
                const delay = Math.min(remainingTime, 2147483647); // Max timer delay
                activeGiveawayTimers.add(messageId);
                setTimeout(async () => {
                    await endGiveaway(messageId);
                    activeGiveawayTimers.delete(messageId);
                }, delay);
            }
        }
    }
}

async function endGiveaway(messageId) {
    if (!client) return;
    const giveaway = db.giveaways.get(messageId);
    if (!giveaway || giveaway.ended) return;

    // Double-check if giveaway is being processed to prevent race conditions
    if (activeGiveawayTimers.has(messageId)) {
        return; // Already being processed
    }

    // Mark as being processed immediately
    activeGiveawayTimers.add(messageId);
    const channel = client.channels.cache.get(giveaway.channelId);
    if (!channel) return db.giveaways.delete(messageId);
    const message = await channel.messages.fetch(messageId).catch(() => null);
    if (!message) return db.giveaways.delete(messageId);
    const participants = giveaway.participants || [];
    const winners = [];
    if (participants.length > 0) {
        for (let i = 0; i < giveaway.winnerCount; i++) {
            if (participants.length === 0) break;
            const winnerIndex = Math.floor(Math.random() * participants.length);
            winners.push(participants.splice(winnerIndex, 1)[0]);
        }
    }
    const endEmbed = new EmbedBuilder()
        .setColor('#808080')
        .setTitle('🏁 **قرعه‌کشی تمام شد** 🏁')
        .setDescription(`**جایزه:** ${giveaway.prize}\n\n${winners.length > 0 ? `**برنده(گان):** ${winners.map(w => `<@${w}>`).join(', ')}` : '**هیچ برنده‌ای انتخاب نشد!**'}`)
        .setFooter({ text: 'پایان یافته' })
        .setTimestamp();
    await message.edit({ embeds: [endEmbed], components: [] });
    
    if (winners.length > 0) {
        const winnerEmbed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🏆 تبریک! شما برنده گیووای شدید')
            .setDescription(`شما در سرور **${channel.guild.name}** برنده گیووای با جایزه **${giveaway.prize}** شدید!\n\nبرای دریافت جایزه خود، لطفاً یک تیکت باز کنید.\n\n⚠️ توجه: اگر تا ۲۴ ساعت آینده تیکت باز نکنید، جایزه شما ممکن است به فرد دیگری داده شود.`)
            .setFooter({ text: 'تیم مدیریت سرور' })
            .setTimestamp();
        
        for (const winnerId of winners) {
            try {
                const user = await client.users.fetch(winnerId);
                await user.send({ embeds: [winnerEmbed] });
            } catch (e) {
                console.error('Failed to DM giveaway winner:', winnerId, e);
            }
        }
        
        const publicEmbed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🎉 برندگان گیووای')
            .setDescription(`تبریک به ${winners.map(w => `<@${w}>`).join(', ')}!\nشما برنده **${giveaway.prize}** شدید. لطفاً برای دریافت جایزه تیکت باز کنید.`)
            .setFooter({ text: 'برای دریافت جایزه حتماً تیکت باز کنید.' })
            .setTimestamp();
        await channel.send({ embeds: [publicEmbed] });
    }
    db.giveaways.set(messageId, { ...giveaway, ended: true });
}

async function checkPolls() {
    if (db.polls.size === 0) return;
    console.log(`Checking ${db.polls.size} total poll(s) in the database...`);
    for (const [messageId, poll] of db.polls.entries()) {
        if (poll.ended) continue;
        const now = Date.now();
        const remainingTime = poll.endTime - now;
        if (remainingTime <= 0) {
            await endPoll(messageId);
        } else {
            setTimeout(() => endPoll(messageId), remainingTime);
        }
    }
}

async function endPoll(messageId) {
    if (!client) return;
    const poll = db.polls.get(messageId);
    if (!poll || poll.ended) return;
    const channel = client.channels.cache.get(poll.channelId);
    if (!channel) return db.polls.delete(messageId);
    const message = await channel.messages.fetch(messageId).catch(() => null);
    if (!message) return db.polls.delete(messageId);
    const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes, 0);
    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];

    const resultsDescription = poll.options
        .sort((a, b) => b.votes - a.votes)
        .map((opt, i) => {
            const percentage = totalVotes === 0 ? 0 : ((opt.votes / totalVotes) * 100).toFixed(1);
            return `${emojis[i]} ${opt.name} - **${opt.votes} رای** (${percentage}%)`;
        })
        .join('\n\n');

    const resultsEmbed = new EmbedBuilder()
        .setColor('Grey')
        .setTitle(`🏁 نتایج نظرسنجی: ${poll.question}`)
        .setDescription(resultsDescription)
        .setFooter({ text: `نظرسنجی تمام شد • کل آرا: ${totalVotes}` })
        .setTimestamp();

    await message.edit({ embeds: [resultsEmbed], components: [] });
    db.polls.set(messageId, { ...poll, ended: true });
}

// --- Command Registration ---

async function registerCommands(clientId, guildId, token) {
    // Adding commands to the array
    commands.length = 0; // Clear existing commands

    commands.push(
        // --- Polls ---
        new SlashCommandBuilder()
            .setName('poll')
            .setDescription('ایجاد یک نظرسنجی جدید')
            .addStringOption(opt => opt.setName('question').setDescription('سوال نظرسنجی').setRequired(true))
            .addStringOption(opt => opt.setName('options').setDescription('گزینه‌ها (با | جدا کنید)').setRequired(true))
            .addStringOption(opt => opt.setName('duration').setDescription('مدت زمان (مثلا: 1h)').setRequired(true))
            .addChannelOption(opt => opt.setName('channel').setDescription('کانال ارسال').setRequired(false))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
            .toJSON(),

        // --- Minecraft ---
        new SlashCommandBuilder()
            .setName("mcinfo")
            .setDescription("Display Minecraft account info")
            .addStringOption(opt => opt.setName("username").setDescription("Minecraft username").setRequired(true))
            .addStringOption(opt => opt.setName("price").setDescription("Account price").setRequired(false))
            .addBooleanOption(opt => opt.setName("show_stats").setDescription("Show Hypixel stats").setRequired(false))
            .addBooleanOption(opt => opt.setName("show_history").setDescription("Show name history").setRequired(false))
            .toJSON(),

        // --- Bad Words ---
        new SlashCommandBuilder()
            .setName('addbadword')
            .setDescription('Add banned word')
            .addStringOption(opt => opt.setName('word').setDescription('Word').setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .toJSON(),
        new SlashCommandBuilder()
            .setName('removebadword')
            .setDescription('Remove banned word')
            .addStringOption(opt => opt.setName('word').setDescription('Word').setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .toJSON(),
        new SlashCommandBuilder()
            .setName('listbadwords')
            .setDescription('List banned words')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .toJSON(),
        new SlashCommandBuilder()
            .setName('importbadwords')
            .setDescription('Import banned words from text')
            .addStringOption(opt => opt.setName('text').setDescription('Text containing words').setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .toJSON(),

        // --- Moderation ---
        new SlashCommandBuilder()
            .setName('warn')
            .setDescription('Warn a user')
            .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true))
            .addStringOption(opt => opt.setName('reason').setDescription('Reason').setRequired(false))
            .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
            .toJSON(),
        new SlashCommandBuilder()
            .setName('clearwarnings')
            .setDescription('Clear warnings for a user')
            .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
            .toJSON(),
        new SlashCommandBuilder()
            .setName('kick')
            .setDescription('Kick user')
            .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true))
            .addStringOption(opt => opt.setName('reason').setDescription('Reason').setRequired(false))
            .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
            .toJSON(),
        new SlashCommandBuilder()
            .setName('ban')
            .setDescription('Ban user')
            .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true))
            .addStringOption(opt => opt.setName('reason').setDescription('Reason').setRequired(false))
            .addIntegerOption(opt => opt.setName('deletedays').setDescription('Delete messages days').setRequired(false))
            .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
            .toJSON(),
        new SlashCommandBuilder()
            .setName('unban')
            .setDescription('Unban user')
            .addStringOption(opt => opt.setName('userid').setDescription('User ID').setRequired(true))
            .addStringOption(opt => opt.setName('reason').setDescription('Reason').setRequired(false))
            .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
            .toJSON(),
        new SlashCommandBuilder()
            .setName('clear')
            .setDescription('Clear messages')
            .addIntegerOption(opt => opt.setName('amount').setDescription('Amount (1-100)').setRequired(true))
            .addUserOption(opt => opt.setName('user').setDescription('Filter by user').setRequired(false))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
            .toJSON(),

        // --- Security (Missing ones added) ---
        new SlashCommandBuilder()
            .setName('security')
            .setDescription('Manage security settings')
            .addSubcommand(sub => sub.setName('status').setDescription('Check status'))
            .addSubcommand(sub => sub.setName('report').setDescription('Security report'))
            .addSubcommand(sub => sub.setName('reset').setDescription('Reset user security data')
                .addUserOption(o => o.setName('user').setDescription('User').setRequired(true)))
            .addSubcommand(sub => sub.setName('blacklist').setDescription('Manage blacklist')
                .addStringOption(o => o.setName('action').setDescription('add/remove').setRequired(true).addChoices({name:'Add',value:'add'},{name:'Remove',value:'remove'}))
                .addStringOption(o => o.setName('type').setDescription('Type').setRequired(true).addChoices({name:'User',value:'user'},{name:'Guild',value:'guild'}))
                .addStringOption(o => o.setName('id').setDescription('ID').setRequired(true)))
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .toJSON(),
        new SlashCommandBuilder()
            .setName('bansupport')
            .setDescription('Ban user from support tickets')
            .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true))
            .addStringOption(opt => opt.setName('reason').setDescription('Reason').setRequired(false))
            .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
            .toJSON(),
        new SlashCommandBuilder()
            .setName('banstats')
            .setDescription('View support ban statistics')
            .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
            .toJSON(),

        // --- Shop & Cards (Missing ones added) ---
        new SlashCommandBuilder()
            .setName('add_card')
            .setDescription('Add a bank card')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .toJSON(),
        new SlashCommandBuilder()
            .setName('list_cards')
            .setDescription('List bank cards')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .toJSON(),
        new SlashCommandBuilder()
            .setName('send_card')
            .setDescription('Send a card to user/channel')
            .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(false))
            .addChannelOption(opt => opt.setName('channel').setDescription('Target channel').setRequired(false))
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .toJSON(),
        new SlashCommandBuilder()
            .setName("send_account")
            .setDescription("Send account info")
            .addStringOption(o => o.setName("mail").setDescription("Email").setRequired(true))
            .addStringOption(o => o.setName("recovery_code").setDescription("Recovery Code").setRequired(true))
            .addStringOption(o => o.setName("account_num").setDescription("Account Num").setRequired(true))
            .addStringOption(o => o.setName("username").setDescription("Username").setRequired(false))
            .addStringOption(o => o.setName("password").setDescription("Password").setRequired(false))
            .toJSON(),

        // --- Giveaways ---
        new SlashCommandBuilder()
            .setName('start-giveaway')
            .setDescription('Start a giveaway')
            .addChannelOption(opt => opt.setName('channel').setDescription('Channel').setRequired(true))
            .addStringOption(opt => opt.setName('duration').setDescription('Duration').setRequired(true))
            .addIntegerOption(opt => opt.setName('winners').setDescription('Winners').setRequired(true))
            .addStringOption(opt => opt.setName('prize').setDescription('Prize').setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
            .toJSON(),
        new SlashCommandBuilder()
            .setName('end-giveaway')
            .setDescription('End a giveaway')
            .addStringOption(opt => opt.setName('messageid').setDescription('Message ID').setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
            .toJSON(),
        new SlashCommandBuilder()
            .setName('reroll-giveaway')
            .setDescription('Reroll giveaway')
            .addStringOption(opt => opt.setName('messageid').setDescription('Message ID').setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
            .toJSON(),

        // --- Utility & Admin ---
        new SlashCommandBuilder()
            .setName('advertise')
            .setDescription('Send advertisement to a role')
            .addRoleOption(opt => opt.setName('target_role').setDescription('Role').setRequired(true))
            .addStringOption(opt => opt.setName('color').setDescription('Color').setRequired(false))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
            .toJSON(),
        new SlashCommandBuilder()
            .setName('sendmessage')
            .setDescription('Send custom message')
            .addChannelOption(opt => opt.setName('channel').setDescription('Target channel').setRequired(false))
            .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(false))
            .addBooleanOption(opt => opt.setName('embed').setDescription('Use embed').setRequired(false))
            .addStringOption(opt => opt.setName('color').setDescription('Color').setRequired(false))
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .toJSON(),
        new SlashCommandBuilder()
            .setName('sendrolemenu')
            .setDescription('Send role selection menu')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
            .toJSON(),
        new SlashCommandBuilder()
            .setName('sendticketmenu')
            .setDescription('Send ticket menu')
            .addChannelOption(opt => opt.setName('channel').setDescription('Target channel').setRequired(false))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
            .toJSON(),
        
        // --- Stats ---
        new SlashCommandBuilder()
            .setName('invites')
            .setDescription('Show invites')
            .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(false))
            .toJSON(),
        new SlashCommandBuilder()
            .setName('invites-leaderboard')
            .setDescription('Invites leaderboard')
            .toJSON(),
        new SlashCommandBuilder()
            .setName('rolestats')
            .setDescription('Role statistics')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
            .toJSON(),
        new SlashCommandBuilder()
            .setName('userinfo')
            .setDescription('Show user info')
            .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(false))
            .toJSON(),
        new SlashCommandBuilder()
            .setName('serverinfo')
            .setDescription('Show server info')
            .toJSON()
        ,
        new SlashCommandBuilder()
            .setName('help')
            .setDescription('راهنمای کامل مدیریت و تنظیمات بات')
            .toJSON()
    );

    const rest = new REST({ version: '10' }).setToken(token);

    try {
        console.log('Started refreshing application (/) commands.');
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
        console.log(`Successfully reloaded ${commands.length} application (/) commands.`);
    } catch (error) { console.error(error); }
    console.log('Created By Reza✨.');
}

module.exports = {
    // Core Utility Functions
    ms,
    logAction,
    
    // Enhanced System Functions (NEW v2.3.0)
    checkRateLimit,
    getCache,
    setCache,
    handleError,
    
    // Embed Generators
    createCosmeticEmbed,
    sendProfileImageEmbed,
    createProfileImage,

    // Enhanced API Functions
    getNameHistory,
    getMojangData,
    getMinecraftProfile,
    getHypixelData,
    getGameStats,
    
    // Bad Words Management
    addBadWord,
    removeBadWord,
    listBadWords,
    isBadWord,
    loadBadWords,

    // Warning System
    addWarning,
    clearWarnings,
    getWarnings,
    sendWarningDM,

    // Setup & Registration
    setClient,
    setLogger,
    registerCommands,
    updateShopStatus,

    // Ticket System
    createTicketChannel,
    ensureTicketCategory,

    // Scheduled Tasks
    checkGiveaways,
    checkPolls,
    
    // Helper Functions
    getCapeTypeName,
    getHypixelRanks,
    formatRank,
    getNetworkLevel,
    
    // Configuration Constants (NEW v2.3.0)
    COLOR_PRESETS,
    API_CONFIG,
    CACHE_DURATION
};
