const config = require('../configManager');
/**// --- Commands Array (must be defined before any use!) ---

 * Main utilities module that exports all functionalityconst commands = [];

 */// --- Bad Words List (in-memory, can be persisted to db if needed) ---



const cosmetics = require('./modules/cosmetics');// ...existing code...

const mojang = require('./modules/mojang');

const warnings = require('./modules/warnings');function createCosmeticEmbed(username, uuid, cosmeticCapes, cosmetics, page, EmbedBuilder) {

    const start = page * 5;

// Global state    const end = start + 5;

let client = null;    const capesPage = cosmeticCapes.slice(start, end);

let logger = null;    const cosmeticsPage = cosmetics.slice(start, end);



/**    const embed = new EmbedBuilder()

 * Set the Discord client instance        .setColor(COLOR_PRESETS.DEFAULT)

 * @param {Object} c - Discord client instance        .setTitle(`🎮 پروفایل ماینکرفت ${username}`)

 */        // کارت کامل پروفایل از mc-heads.net

function setClient(c) {        .setImage(`https://mc-heads.net/minecraft/profile/${username}`)

    client = c;        .setThumbnail(`https://mc-heads.net/head/${uuid}/left`)

}        .setTimestamp();



/**    // افزودن رندر کامل بدن در سمت چپ

 * Set the logger instance    embed.addFields({ 

 * @param {Object} l - Logger instance        name: "🎭 نمای کامل کاراکتر", 

 */        value: `[مشاهده رندر HD](https://mc-heads.net/body/${uuid}/left)`,

function setLogger(l) {        inline: true 

    logger = l;    });

}

    // اگر کیپی وجود داشت

/**    if (capesPage.length > 0) {

 * Get the current Discord client instance        embed.addFields({ 

 * @returns {Object} Discord client            name: "🧥 کیپ‌های فعال", 

 * @throws {Error} If client is not initialized            value: `[مشاهده کیپ‌ها در NameMC](https://namemc.com/profile/${uuid})`,

 */            inline: true 

function getClient() {    });

    if (!client) {    }

        throw new Error('Discord client not initialized');    

    }    if (cosmeticsPage.length > 0) {

    return client;        embed.addFields({ 

}            name: "🎨 مدل اسکین", 

/**            value: cosmeticsPage.join('\n'), 

 * Get the current logger instance            inline: true 

 * @returns {Object} Logger instance        });

 * @throws {Error} If logger is not initialized    }

*/

function getLogger() {    // افزودن لینک‌های مفید

    if (!logger) {    embed.addFields({ 

        throw new Error('Logger not initialized');        name: "🔍 لینک‌های مفید", 

    }        value: `[NameMC](https://namemc.com/profile/${uuid}) | [Skin History](https://namemc.com/profile/${uuid}/skin) | [Cape Viewer](https://mc-heads.net/cape/${uuid})`, 

    return logger;        inline: false 

}    });

}

    return embed;

module.exports = {}

    ...cosmetics,const axios = require('axios');

    ...mojang,const COLOR_PRESETS = {

    ...warnings,    DEFAULT: "#006400" // Dark Green

    setClient,};

    setLogger,

    getClient,function getCapeTypeName(capeUrl) {

    getLogger    if (capeUrl.includes('minecraft.net')) {

};        if (capeUrl.includes('migrator')) return '🌟 کیپ مهاجرت موجانگ';
        if (capeUrl.includes('scrolls')) return '📜 کیپ Scrolls';
        if (capeUrl.includes('translator')) return '🌍 کیپ مترجم موجانگ';
        if (capeUrl.includes('cobalt')) return '💠 کیپ Cobalt';
        if (capeUrl.includes('mojang')) return '⭐ کیپ کارمند موجانگ';
        if (capeUrl.includes('minecon')) {
            const year = capeUrl.match(/201[0-9]/);
            return `🎪 کیپ MineCon ${year ? year[0] : ''}`;
        }
        return '🌟 کیپ رسمی موجانگ';
    }
    if (capeUrl.includes('optifine')) return '🎭 کیپ OptiFine';
    return '🧥 کیپ ناشناخته';
};

async function getNameHistory(uuid) {
    try {
        const response = await axios.get(`https://api.mojang.com/user/profiles/${uuid}/names`);
        return response.data.reverse(); // جدیدترین نام‌ها اول
    } catch (error) {
        console.error('Error fetching name history:', error);
        return null;
    }
};

const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000;

async function getMojangData(username) {
    if (!username || typeof username !== 'string') {
        throw new Error('Invalid username provided');
    }

    const cacheKey = `mojang-${username.toLowerCase()}`;
    const cached = cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
        return cached.data;
    }

    try {
        const response = await axios.get(`https://api.mojang.com/users/profiles/minecraft/${username}`, { 
            timeout: 10000,
            validateStatus: status => status === 200 || status === 404
        });
        
        if (response.data) {
            const data = response.data;
            cache.set(cacheKey, { data, timestamp: Date.now() });
            return data;
        }
        return null;
    } catch (error) {
        if (error.response?.status === 404) {
            return null;
        }
        
        // Log the error with proper context
        if (logger) {
            logger.logError(error, 'MojangAPI', {
                username,
                errorType: error.code || 'Unknown',
                message: error.message
            });
        }
        
        throw new Error(`Failed to fetch Mojang data: ${error.message}`);
        throw error;
    }
}

async function getMinecraftProfile(uuid) {
    const cacheKey = `profile-${uuid}`;
    const cached = cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) return cached.data;

    try {
        // دریافت اطلاعات از API موجانگ
        const sessionResponse = await axios.get(`https://sessionserver.mojang.com/session/minecraft/profile/${uuid}`, { timeout: 10000 });
        const texturesBase64 = sessionResponse.data.properties.find(prop => prop.name === 'textures').value;
        const texturesData = JSON.parse(Buffer.from(texturesBase64, 'base64').toString());
        
        const capes = [];
        const cosmetics = [];

        // چک کردن کیپ‌های موجانگ
        if (texturesData.textures.CAPE) {
            const capeUrl = texturesData.textures.CAPE.url;
            
            if (capeUrl.includes('minecraft.net')) {
                if (capeUrl.includes('migrator')) {
                    capes.push('🌟 کیپ مهاجرت موجانگ');
                } else if (capeUrl.includes('scrolls')) {
                    capes.push('📜 کیپ Scrolls');
                } else if (capeUrl.includes('translator')) {
                    capes.push('🌍 کیپ مترجم موجانگ');
                } else if (capeUrl.includes('cobalt')) {
                    capes.push('💠 کیپ Cobalt');
                } else if (capeUrl.includes('mojang')) {
                    capes.push('⭐ کیپ کارمند موجانگ');
                } else if (capeUrl.includes('minecon')) {
                    const year = capeUrl.match(/201[0-9]/);
                    capes.push(` کیپ MineCon ${year ? year[0] : ''}`);
                } else {
                    capes.push('🌟 کیپ رسمی موجانگ');
                }
            }
        }

        // چک کردن کیپ OptiFine
        try {
            const optifineCapeUrl = `http://s.optifine.net/capes/${username}.png`;
            const optifineResponse = await axios.head(optifineCapeUrl, { timeout: 5000 });
            if (optifineResponse.status === 200) {
                capes.push('🎭 کیپ OptiFine');
            }
        } catch (e) {
            // اگر کیپ OptiFine وجود نداشت، خطا را نادیده می‌گیریم
        }

        // چک کردن مدل اسکین
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

        cache.set(cacheKey, { data: result, timestamp: Date.now() });
        return result;
    } catch (error) {
        console.error('Error fetching profile:', error);
        return { capes: [], cosmetics: [], totalPages: 0 };
    }
}

async function getHypixelData(uuid, apiKey) {
    const cacheKey = `hypixel-${uuid}`;
    const cached = cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) return cached.data;
    try {
        const response = await axios.get(`https://api.hypixel.net/player?uuid=${uuid}&key=${apiKey}`, { timeout: 10000 });
        if (response.data && response.data.player) {
            cache.set(cacheKey, { data: response.data, timestamp: Date.now() });
        }
        return response.data;
    } catch (error) {
        throw error;
    }
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

function createCosmeticEmbed(username, uuid, cosmeticCapes, cosmetics, page, EmbedBuilder) {
    const start = page * 5;
    const end = start + 5;
    const capesPage = cosmeticCapes.slice(start, end);
    const cosmeticsPage = cosmetics.slice(start, end);

    const embed = new EmbedBuilder()
        .setColor(COLOR_PRESETS.DEFAULT)
        .setTitle(` اطلاعات اسکین ${username}`)
        .setThumbnail(`https://crafatar.com/avatars/${uuid}?size=256&overlay`)
        .setImage(`https://crafatar.com/renders/body/${uuid}?size=512&overlay`)
        .setTimestamp();

    // اگر کیپی وجود داشت
    if (capesPage.length > 0) {
        embed.setImage(capesPage[0]); // نمایش اولین کیپ به عنوان تصویر اصلی
    }
    
    if (cosmeticsPage.length > 0) {
        embed.addFields({ name: "🎨 مدل اسکین", value: cosmeticsPage.join('\n'), inline: false });
    }

    // افزودن دکمه‌های مشاهده پروفایل در NameMC
    embed.addFields({ 
        name: "🔍 مشاهده پروفایل کامل", 
        value: `[مشاهده در NameMC](https://namemc.com/profile/${uuid})`, 
        inline: false 
    });

    return embed;
}

const db = require('./database');
const { REST, Routes, SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');

// Bad Words Management
const badWords = new Set();

async function addBadWord(word) {
    if (badWords.has(word)) return false;
    badWords.add(word);
    await db.badWords.set(word, true);
    return true;
}

async function removeBadWord(word) {
    if (!badWords.has(word)) return false;
    badWords.delete(word);
    await db.badWords.delete(word);
    return true;
}

function listBadWords() {
    return Array.from(badWords);
}

function isBadWord(text) {
    const words = text.toLowerCase().split(/\s+/);
    return words.some(word => badWords.has(word));
}

// Warning System Management
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

let client = null;
function setClient(c) { client = c; }

let logger = null;
function setLogger(l) { logger = l; }

async function sendWarningDM(member, warningCount, maxWarnings, reason, moderator) {
    try {
        const warningEmbed = new EmbedBuilder()
            .setColor(warningCount >= maxWarnings ? 'Red' : 'Orange')
            .setTitle(warningCount >= maxWarnings ? '🔨 شما از سرور بن شدید' : '⚠️ اخطار از مدیریت سرور')
            .setDescription(warningCount >= maxWarnings 
                ? `شما به دلیل دریافت ${maxWarnings} اخطار از سرور حذف شدید.` 
                : `شما یک اخطار از مدیریت سرور دریافت کردید.` 
            )
            .addFields(
                { name: 'تعداد اخطارها', value: `${warningCount} از ${maxWarnings}`, inline: true },
                { name: 'دلیل اخطار', value: reason, inline: true },
                { name: 'اعلام کننده', value: moderator.tag, inline: true }
            )
            .setFooter({ text: warningCount >= maxWarnings 
                ? 'دسترسی شما به سرور قطع شد' 
                : 'لطفاً قوانین سرور را رعایت کنید'
            })
            .setTimestamp();

        await member.send({ embeds: [warningEmbed] });
        return true;
    } catch (error) {
        console.error('Failed to send warning DM:', error);
        return false;
    }
}

async function registerCommands(clientId, guildId, token) {
    commands.unshift(
        new SlashCommandBuilder()
            .setName("mcinfo")
            .setDescription("نمایش اطلاعات کامل اکانت ماینکرفت در هایپیکسل")
            .addStringOption(option => 
                option.setName("username")
                .setDescription("یوزرنیم ماینکرفت")
                .setRequired(true)
            )
            .addStringOption(option => 
                option.setName("price")
                .setDescription("قیمت اکانت (تومان)")
                .setRequired(false)
            )
            .addBooleanOption(option =>
                option.setName("show_stats")
                .setDescription("نمایش استتس هایپیکسل")
                .setRequired(false)
            )
            .addBooleanOption(option =>
                option.setName("show_history")
                .setDescription("نمایش تاریخچه نام‌های قبلی")
                .setRequired(false)
            )
            .toJSON()
    );
    commands.unshift(
        new SlashCommandBuilder()
            .setName("send_account")
            .setDescription("ارسال اطلاعات اکانت برای خریدار")
            .addStringOption(option => option.setName("mail").setDescription("ایمیل اکانت").setRequired(true))
            .addStringOption(option => option.setName("recovery_code").setDescription("کد بازیابی اکانت").setRequired(true))
            .addStringOption(option => option.setName("account_num").setDescription("شماره اکانت").setRequired(true))
            .addStringOption(option => option.setName("username").setDescription("یوزرنیم اکانت (اختیاری)").setRequired(false))
            .addStringOption(option => option.setName("password").setDescription("پسورد اکانت (اختیاری)").setRequired(false))
            .toJSON()
    );
    commands.unshift(
        new SlashCommandBuilder()
            .setName('addbadword')
            .setDescription('افزودن کلمه غیرمجاز')
            .addStringOption(opt =>
                opt.setName('word').setDescription('کلمه غیرمجاز').setRequired(true)
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .toJSON()
    );
    commands.unshift(
        new SlashCommandBuilder()
            .setName('removebadword')
            .setDescription('حذف کلمه غیرمجاز')
            .addStringOption(opt =>
                opt.setName('word').setDescription('کلمه غیرمجاز').setRequired(true)
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .toJSON()
    );
    commands.unshift(
        new SlashCommandBuilder()
            .setName('listbadwords')
            .setDescription('نمایش لیست کلمات غیرمجاز')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .toJSON()
    );
    commands.unshift(
        new SlashCommandBuilder()
            .setName('clearwarnings')
            .setDescription('پاک کردن اخطارهای یک کاربر')
            .addUserOption(opt =>
                opt.setName('user').setDescription('کاربر مورد نظر').setRequired(true)
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
            .toJSON()
    );

// Warning System
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
    commands.unshift(
        new SlashCommandBuilder()
            .setName('invites')
            .setDescription('نمایش جزئیات دعوت‌های یک کاربر')
            .addUserOption(opt =>
                opt.setName('user').setDescription('کاربر مورد نظر').setRequired(true)
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
            .toJSON()
    );
    // Giveaway Commands
    commands.unshift(
        new SlashCommandBuilder()
            .setName('start-giveaway')
            .setDescription('شروع گیووای جدید')
            .addChannelOption(opt =>
                opt.setName('channel').setDescription('چنل مقصد').setRequired(true)
            )
            .addStringOption(opt =>
                opt.setName('duration').setDescription('مدت زمان (مثلاً 1h, 30m, 2d)').setRequired(true)
            )
            .addIntegerOption(opt =>
                opt.setName('winners').setDescription('تعداد برندگان').setRequired(true)
            )
            .addStringOption(opt =>
                opt.setName('prize').setDescription('جایزه گیووای').setRequired(true)
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
            .toJSON()
    );
    commands.unshift(
        new SlashCommandBuilder()
            .setName('end-giveaway')
            .setDescription('پایان دادن به گیووای')
            .addStringOption(opt =>
                opt.setName('messageid').setDescription('آیدی پیام گیووای').setRequired(true)
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
            .toJSON()
    );
    commands.unshift(
        new SlashCommandBuilder()
            .setName('reroll-giveaway')
            .setDescription('ری‌رول گیووای (انتخاب برنده جدید)')
            .addStringOption(opt =>
                opt.setName('messageid').setDescription('آیدی پیام گیووای').setRequired(true)
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
            .toJSON()
    );
    // Role Stats Command
    commands.unshift(
        new SlashCommandBuilder()
            .setName('rolestats')
            .setDescription('نمایش تعداد اعضای هر رول سرور')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
            .toJSON()
    );
    // Invites Leaderboard Command
    commands.unshift(
        new SlashCommandBuilder()
            .setName('invites-leaderboard')
            .setDescription('نمایش لیدربورد برترین دعوت‌کنندگان سرور')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
            .toJSON()
    );
    // Send Role Menu Command
    commands.unshift(
        new SlashCommandBuilder()
            .setName('sendolemenu')
            .setDescription('ارسال منوی انتخاب رول با دکمه')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
            .toJSON()
    );
    // سایر کامندها:
    commands.push(
        // Send Ticket Menu Command
        new SlashCommandBuilder()
            .setName('sendticketmenu')
            .setDescription('ارسال منوی ساخت تیکت در چنل تیکت')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
            .toJSON(),
        // Send Message Command
        new SlashCommandBuilder()
            .setName('sendmessage')
            .setDescription('ارسال پیام دلخواه به کاربر یا چنل')
            .addChannelOption(option =>
                option.setName('channel')
                    .setDescription('چنل مقصد برای ارسال پیام')
                    .setRequired(false)
            )
            .addUserOption(option =>
                option.setName('user')
                    .setDescription('کاربر مقصد برای ارسال پیام خصوصی')
                    .setRequired(false)
            )
            .addBooleanOption(option =>
                option.setName('embed')
                    .setDescription('آیا پیام به صورت امبد ارسال شود؟')
                    .setRequired(false)
            )
            .addStringOption(option =>
                option.setName('color')
                    .setDescription('رنگ امبد (در صورت انتخاب امبد)')
                    .setRequired(false)
                    .addChoices(
                        { name: '🔵 آبی', value: 'Blue' },
                        { name: '🟢 سبز', value: 'Green' },
                        { name: '🔴 قرمز', value: 'Red' },
                        { name: '🟡 زرد', value: 'Yellow' },
                        { name: '🟠 نارنجی', value: 'Orange' },
                        { name: '🟣 بنفش', value: 'Purple' },
                        { name: '⚪ خاکستری', value: 'Grey' }
                    )
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .toJSON(),
        // Warn Command
        new SlashCommandBuilder()
            .setName('warn')
            .setDescription('اخطار به کاربر')
            .addUserOption(option =>
                option.setName('user')
                    .setDescription('کاربری که اخطار دریافت می‌کند')
                    .setRequired(true)
            )
            .addStringOption(option =>
                option.setName('reason')
                    .setDescription('دلیل اخطار')
                    .setRequired(false)
                    .setMaxLength(500)
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
            .toJSON(),
        // Clear Messages Command
        new SlashCommandBuilder()
            .setName('clear')
            .setDescription('پاک کردن پیام‌ها')
            .addIntegerOption(option =>
                option.setName('amount')
                    .setDescription('تعداد پیام‌های قابل حذف (1-100)')
                    .setRequired(true)
                    .setMinValue(1)
                    .setMaxValue(100)
            )
            .addUserOption(option =>
                option.setName('user')
                    .setDescription('فقط پیام‌های این کاربر پاک شوند (اختیاری)')
                    .setRequired(false)
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
            .toJSON(),
        // Kick Command
        new SlashCommandBuilder()
            .setName('kick')
            .setDescription('اخراج کاربر از سرور')
            .addUserOption(option =>
                option.setName('user')
                    .setDescription('کاربری که اخراج می‌شود')
                    .setRequired(true)
            )
            .addStringOption(option =>
                option.setName('reason')
                    .setDescription('دلیل اخراج')
                    .setRequired(false)
                    .setMaxLength(500)
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
            .toJSON(),
        // Ban Command
        new SlashCommandBuilder()
            .setName('ban')
            .setDescription('مسدود کردن کاربر')
            .addUserOption(option =>
                option.setName('user')
                    .setDescription('کاربری که مسدود می‌شود')
                    .setRequired(true)
            )
            .addStringOption(option =>
                option.setName('reason')
                    .setDescription('دلیل مسدودی')
                    .setRequired(false)
                    .setMaxLength(500)
            )
            .addIntegerOption(option =>
                option.setName('deletedays')
                    .setDescription('تعداد روزهای پیام‌های حذف شده (0-7)')
                    .setRequired(false)
                    .setMinValue(0)
                    .setMaxValue(7)
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
            .toJSON(),
        // Unban Command
        new SlashCommandBuilder()
            .setName('unban')
            .setDescription('رفع مسدودیت کاربر')
            .addStringOption(option =>
                option.setName('userid')
                    .setDescription('شناسه کاربر مسدود شده')
                    .setRequired(true)
            )
            .addStringOption(option =>
                option.setName('reason')
                    .setDescription('دلیل رفع مسدودی')
                    .setRequired(false)
                    .setMaxLength(500)
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
            .toJSON(),
        // User Info Command
        new SlashCommandBuilder()
            .setName('userinfo')
            .setDescription('نمایش اطلاعات کاربر')
            .addUserOption(option =>
                option.setName('user')
                    .setDescription('کاربری که اطلاعاتش نمایش داده شود')
                    .setRequired(false)
            )
            .toJSON(),
        // Server Info Command
        new SlashCommandBuilder()
            .setName('serverinfo')
            .setDescription('نمایش اطلاعات سرور')
            .toJSON()
    );
        // Send Ticket Menu Command
        new SlashCommandBuilder()
            .setName('sendticketmenu')
            .setDescription('ارسال منوی ساخت تیکت در چنل تیکت')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
            .toJSON(),
        // Send Message Command
        new SlashCommandBuilder()
            .setName('sendmessage')
            .setDescription('ارسال پیام دلخواه به کاربر یا چنل')
            .addChannelOption(option =>
                option.setName('channel')
                    .setDescription('چنل مقصد برای ارسال پیام')
                    .setRequired(false)
            )
            .addUserOption(option =>
                option.setName('user')
                    .setDescription('کاربر مقصد برای ارسال پیام خصوصی')
                    .setRequired(false)
            )
            .addBooleanOption(option =>
                option.setName('embed')
                    .setDescription('آیا پیام به صورت امبد ارسال شود؟')
                    .setRequired(false)
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .toJSON(),
         
        // Warn Command
        new SlashCommandBuilder()
            .setName('warn')
            .setDescription('اخطار به کاربر')
            .addUserOption(option =>
                option.setName('user')
                    .setDescription('کاربری که اخطار دریافت می‌کند')
                    .setRequired(true)
            )
            .addStringOption(option =>
                option.setName('reason')
                    .setDescription('دلیل اخطار')
                    .setRequired(false)
                    .setMaxLength(500)
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
            .toJSON(),
         
        // Clear Messages Command
        new SlashCommandBuilder()
            .setName('clear')
            .setDescription('پاک کردن پیام‌ها')
            .addIntegerOption(option =>
                option.setName('amount')
                    .setDescription('تعداد پیام‌های قابل حذف (1-100)')
                    .setRequired(true)
                    .setMinValue(1)
                    .setMaxValue(100)
            )
            .addUserOption(option =>
                option.setName('user')
                    .setDescription('فقط پیام‌های این کاربر پاک شوند (اختیاری)')
                    .setRequired(false)
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
            .toJSON(),
         
        // Kick Command
        new SlashCommandBuilder()
            .setName('kick')
            .setDescription('اخراج کاربر از سرور')
            .addUserOption(option =>
                option.setName('user')
                    .setDescription('کاربری که اخراج می‌شود')
                    .setRequired(true)
            )
            .addStringOption(option =>
                option.setName('reason')
                    .setDescription('دلیل اخراج')
                    .setRequired(false)
                    .setMaxLength(500)
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
            .toJSON(),
         
        // Ban Command
        new SlashCommandBuilder()
            .setName('ban')
            .setDescription('مسدود کردن کاربر')
            .addUserOption(option =>
                option.setName('user')
                    .setDescription('کاربری که مسدود می‌شود')
                    .setRequired(true)
            )
            .addStringOption(option =>
                option.setName('reason')
                    .setDescription('دلیل مسدودی')
                    .setRequired(false)
                    .setMaxLength(500)
            )
            .addIntegerOption(option =>
                option.setName('deletedays')
                    .setDescription('تعداد روزهای پیام‌های حذف شده (0-7)')
                    .setRequired(false)
                    .setMinValue(0)
                    .setMaxValue(7)
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
            .toJSON(),
         
        // Unban Command
        new SlashCommandBuilder()
            .setName('unban')
            .setDescription('رفع مسدودیت کاربر')
            .addStringOption(option =>
                option.setName('userid')
                    .setDescription('شناسه کاربر مسدود شده')
                    .setRequired(true)
            )
            .addStringOption(option =>
                option.setName('reason')
                    .setDescription('دلیل رفع مسدودی')
                    .setRequired(false)
                    .setMaxLength(500)
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
            .toJSON(),
         
        // User Info Command
        new SlashCommandBuilder()
            .setName('userinfo')
            .setDescription('نمایش اطلاعات کاربر')
            .addUserOption(option =>
                option.setName('user')
                    .setDescription('کاربری که اطلاعاتش نمایش داده شود')
                    .setRequired(false)
            )
            .toJSON(),
         
        // Server Info Command
        new SlashCommandBuilder()
            .setName('serverinfo')
            .setDescription('نمایش اطلاعات سرور')
            .toJSON()
    ;
    const rest = new REST({ version: '10' }).setToken(token);

 try {
    console.log('Started refreshing application (/) commands.');
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    console.log(`Successfully reloaded application (/) commands.`);
 } catch (error) { console.error(error); }
    console.log('Created By Reza✨.');
}

async function checkGiveaways() {
    if (db.giveaways.size === 0) return;
    if (db.giveaways.size === 0) return;
    console.log(`Checking ${db.giveaways.size} total giveaway(s) in the database...`);
    for (const [messageId, giveaway] of db.giveaways.entries()) {
        if (giveaway.ended) continue;
        const now = Date.now();
        const remainingTime = giveaway.endTime - now;
        if (remainingTime <= 0) {
            await endGiveaway(messageId);
        } else {
            setTimeout(() => endGiveaway(messageId), remainingTime);
        }
    }
}

async function endGiveaway(messageId) {
    if (!client) return; // setClient must be called by index.js
    const giveaway = db.giveaways.get(messageId);
    if (!giveaway || giveaway.ended) return;
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
    const endEmbed = new EmbedBuilder().setColor('#808080').setTitle('🏁 **قرعه‌کشی تمام شد** 🏁').setDescription(`**جایزه:** ${giveaway.prize}\n\n${winners.length > 0 ? `**برنده(گان):** ${winners.map(w => `<@${w}>`).join(', ')}` : '**هیچ برنده‌ای انتخاب نشد!**'}`).setFooter({ text: 'پایان یافته' }).setTimestamp();
    await message.edit({ embeds: [endEmbed], components: [] });
    if (winners.length > 0) {
        const winnerEmbed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🏆 تبریک! شما برنده گیووای شدید')
            .setDescription(`شما در سرور **${channel.guild.name}** برنده گیووای با جایزه **${giveaway.prize}** شدید!\n\nبرای دریافت جایزه خود، لطفاً یک تیکت باز کنید تا تیم پشتیبانی جایزه را به شما تحویل دهد.\n\n⚠️ توجه: اگر تا ۲۴ ساعت آینده تیکت باز نکنید، جایزه شما ممکن است به فرد دیگری داده شود.`)
            .setFooter({ text: 'تیم مدیریت سرور' })
            .setTimestamp();
        // ارسال پیام خصوصی به هر برنده
        for (const winnerId of winners) {
            try {
                const user = await channel.client.users.fetch(winnerId);
                await user.send({ embeds: [winnerEmbed] });
            } catch (e) {
                // اگر پیام ارسال نشد، صرفاً لاگ کن
                console.error('Failed to DM giveaway winner:', winnerId, e);
            }
        }
        // پیام عمومی در چنل
        const publicEmbed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🎉 برندگان گیووای')
            .setDescription(` تبریک به ${winners.map(w => `<@${w}>`).join(', ')}!\nشما برنده **${giveaway.prize}** شدید. لطفاً برای دریافت جایزه تیکت باز کنید.`)
            .setFooter({ text: 'برای دریافت جایزه حتماً تیکت باز کنید.' })
            .setTimestamp();
        await channel.send({ embeds: [publicEmbed] });
    }
    db.giveaways.set(messageId, true, 'ended');
}

async function checkPolls() {
    const db = require('./database');
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
    if (!client) return; // setClient must be called by index.js
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
    db.polls.set(messageId, true, 'ended');
}

async function createTicketChannel(guild, user, reason, customReason = null) {
    const TICKET_ACCESS_ROLE_ID = config.roles.ticketAccess;
    const SHOP_ROLE_ID = config.roles.shop;
    const category = await ensureTicketCategory(guild);
    if (!category) return;
    const channelName = `ticket-${user.username.replace(/[^a-z0-9-]/g, '')}`.slice(0, 99);
    const ticketChannel = await guild.channels.create({
        name: channelName, type: 0, parent: category.id,
        topic: `تیکت برای ${user.tag} | موضوع: ${customReason || reason} | وضعیت: باز`,
        permissionOverwrites: [
            { id: guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
            { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
            { id: SHOP_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.ManageMessages] }
        ],
    });
    db.tickets.set(user.id, ticketChannel.id);
    db.ticketInfo.set(ticketChannel.id, { ownerId: user.id, reason: customReason || reason, status: 'open', claimedBy: null });

    const welcomeEmbed = new EmbedBuilder().setColor('#3498DB').setTitle(`👋 خوش آمدید ${user.username}!`).setDescription(`تیکت شما با موضوع **${customReason || reason}** با موفقیت ایجاد شد.\n\nلطفا مشکل یا درخواست خود را به طور کامل شرح دهید تا تیم پشتیبانی در اسرع وقت به شما پاسخ دهد.`).setTimestamp();

    const panelEmbed = new EmbedBuilder().setColor('#E67E22').setTitle('⚙️ پنل‌های مدیریتی').setDescription('**پنل کاربر:**\nبرای تکمیل خرید یا بستن تیکت از دکمه‌های زیر استفاده کنید.\n\n**پنل ادمین:**\n• دکمه «ثبت سفارش» برای تأیید دریافت سفارش\n• دکمه «تکمیل سفارش» برای اطلاع‌رسانی تکمیل سفارش به کاربر');

    const userButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('complete_purchase').setLabel('تکمیل خرید').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('close_ticket_user').setLabel('بستن تیکت').setStyle(ButtonStyle.Danger)
    );

    const adminButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('record_order_admin').setLabel('ثبت سفارش (ادمین)').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('complete_purchase_admin').setLabel('تکمیل سفارش (ادمین)').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('claim_ticket').setLabel('اعلام رسیدگی').setStyle(ButtonStyle.Secondary)
    );

    const mentionText = `<@${user.id}> <@&${TICKET_ACCESS_ROLE_ID}>`;
    await ticketChannel.send({ 
        content: mentionText, 
        embeds: [welcomeEmbed, panelEmbed], 
        components: [userButtons, adminButtons] 
    });

    await logAction(guild, `🎟️ تیکت جدید برای ${user.tag} با موضوع "${customReason || reason}" ساخته شد. <#${ticketChannel.id}>`);
}

// utils.js
const LOG_CHANNEL_ID = config.channels.log;

function ms(str) {
    const unitMap = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    const match = /^(\d+)([smhd])$/.exec(str);
    if (!match) return null;
    return parseInt(match[1], 10) * unitMap[match[2]];
}

async function logAction(guild, message) {
    try {
        const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);
        if (!logChannel || !logChannel.isTextBased()) return;
        const embed = new EmbedBuilder().setColor('Blurple').setDescription(message).setTimestamp();
        await logChannel.send({ embeds: [embed] });
    } catch (e) {
        console.error('Error logging action:', e);
    }
}

async function updateShopStatus(client, guild) {
    try {
        const totalMembers = guild.memberCount;
        const statusText = `👥 اعضای سرور: ${totalMembers}`;
        client.user.setActivity(statusText, { type: 3 });
    } catch (e) { console.error('Error updating server status:', e); }
}

const TICKET_CATEGORY_NAME = 'Tickets';
async function ensureTicketCategory(guild) {
    let category = guild.channels.cache.find(c => c.name === TICKET_CATEGORY_NAME && c.type === 4);
    if (!category) {
        try {
            category = await guild.channels.create({ name: TICKET_CATEGORY_NAME, type: 4, permissionOverwrites: [{ id: guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] }] });
        } catch (e) { console.error('Error creating ticket category:', e); return null; }
    }
    return category;
}

const { createProfileImage } = require('./profileImage');

/**
 * ارسال تصویر ترکیبی پروفایل به دیسکورد (شامل اسکین، کیپ و استتس)
 * @param {object} interaction اینتراکشن دیسکورد
 * @param {string} uuid UUID بازیکن
 * @param {string[]} capeUrls آرایه URL کیپ‌ها
 * @param {object} hypixelStats اطلاعات هایپیکسل
 */
async function sendProfileImageEmbed(interaction, uuid, capeUrls, hypixelStats) {
    try {
        // Extract username and rank if available. interaction may be a message or an interaction without options.
        let username = 'Unknown';
        let rank = '';
        try {
            if (interaction?.options && typeof interaction.options.getString === 'function') {
                username = interaction.options.getString('username') || username;
                rank = interaction.options.getString('rank') || rank;
            }
        } catch (e) {
            // ignore and fallback
        }

        // If username not provided, try to fetch from Mojang using uuid
        if ((!username || username === 'Unknown') && uuid) {
            try {
                const mojang = await getMojangData ? await getMojangData(uuid) : null;
                if (mojang && mojang.name) username = mojang.name || mojang.username || username;
            } catch (e) {
                // ignore lookup failures
            }
        }
        // Flatten stats for new image (combine Bedwars/SkyWars if present)
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
        // Call new image generator
        const buffer = await createProfileImage({ uuid, username, rank, stats, capeUrls });

        // اطلاعات کیپ‌ها
        const capeInfo = capeUrls.length > 0 
            ? `🧥 **${capeUrls.length}** کیپ فعال` 
            : '❌ بدون کیپ فعال';

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
                interaction.options.getString('price') ? `> 💰 **قیمت:** ${interaction.options.getString('price')} تومان` : '',
                `\n${capeUrls.length > 0 ? '**🏆 کیپ‌های فعال:**\n' + capeUrls.map(url => '> • ' + getCapeTypeName(url)).join('\n') : ''}` 
            ].filter(Boolean).join('\n'),
            image: { url: 'attachment://profile.png' },
            fields: [],
            footer: { 
                text: '⭐ کلیک روی دکمه‌های زیر برای اطلاعات بیشتر',
                icon_url: 'https://mc-heads.net/head/' + uuid
            },
            timestamp: new Date()
        };

        await interaction.editReply({
            embeds: [mainEmbed],
            components: [
                new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`namehistory_${uuid}`)
                            .setLabel('📜 تاریخچه نام‌ها')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setURL(`https://namemc.com/profile/${uuid}`)
                            .setLabel('🔍 مشاهده در NameMC')
                            .setStyle(ButtonStyle.Link),
                        new ButtonBuilder()
                            .setURL(`https://plancke.io/hypixel/player/stats/${uuid}`)
                            .setLabel('📊 استتس کامل هایپیکسل')
                            .setStyle(ButtonStyle.Link)
                    )
            ],
            files: [{ 
                attachment: buffer, 
                name: 'profile.png'
            }]
        });
    } catch (e) {
        console.error('Error sending profile image embed:', e);
        const errorEmbed = new EmbedBuilder()
            .setColor('Red')
            .setTitle('❌ خطا')
            .setDescription('خطا در ساخت تصویر پروفایل.')
            .setFooter({ text: 'لطفاً مجدداً تلاش کنید' })
            .setTimestamp();
        await interaction.editReply({ embeds: [errorEmbed], files: [] });
    }
}

module.exports = {
    createCosmeticEmbed,
    sendProfileImageEmbed,
    getNameHistory,
    // Profile and Mojang API
    createProfileImage,
    getMojangData,
    getMinecraftProfile,
    getHypixelData,
    getGameStats,
    // Bad words management
    addBadWord,
    removeBadWord,
    listBadWords,
    isBadWord,
    // Warning system
    addWarning,
    clearWarnings,
    getWarnings,
    // Client and logger
    setClient,
    setLogger,
    // Discord commands and shop
    registerCommands,
    updateShopStatus,
    // Ticket system
    createTicketChannel,
    logAction,
    ensureTicketCategory,
    // Utils
    checkGiveaways,
    checkPolls
};
