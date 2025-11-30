/**
 * Main Utilities & Logic Module - Enhanced Version
 * Complete functionality with all features
 */

// 1. IMPORTS
const config = require('../configManager');
const { db } = require('./database');
const axios = require('axios');
const { 
    REST, 
    Routes, 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    EmbedBuilder, 
    PermissionsBitField, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle 
} = require('discord.js');

// Import security modules
const InputValidator = require('./security/InputValidator');

// Import local modules
const { createProfileImage } = require('./profileImage');

// 2. GLOBAL VARIABLES & CONSTANTS
const commands = [];
const badWords = new Set();
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000;

const COLOR_PRESETS = {
    DEFAULT: "#006400" // Dark Green
};

let client = null;
let logger = null;

// 3. CORE UTILITIES (Client & Logger)

function ms(str) {
    if (!str) return 0;
    const unitMap = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    const match = /^(\d+)([smhd])$/.exec(str);
    if (!match) return null;
    return parseInt(match[1], 10) * unitMap[match[2]];
}

function setClient(c) {
    client = c;
}

function getClient() {
    if (!client) throw new Error('Discord client not initialized');
    return client;
}

function setLogger(l) {
    logger = l;
}

function getLogger() {
    if (!logger) throw new Error('Logger not initialized');
    return logger;
}

// 4. LOGGING FUNCTIONS

async function logAction(guild, message) {
    try {
        const LOG_CHANNEL_ID = config.channels.log;
        if (!LOG_CHANNEL_ID) return;
        const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);
        if (!logChannel || !logChannel.isTextBased()) return;
        const embed = new EmbedBuilder().setColor('Blurple').setDescription(message).setTimestamp();
        await logChannel.send({ embeds: [embed] });
    } catch (e) {
        console.error('Error logging action:', e);
    }
}

// Enhanced logging function that uses logger if available
async function logActionEnhanced(guild, action, fields = {}) {
    if (logger) {
        await logger.logInfo(action, {
            Guild: `${guild.name} (${guild.id})`,
            ...fields
        }, 'Action');
    }
    // Also use old logAction for backward compatibility
    await logAction(guild, action);
}

// 5. MOJANG & HYPIXEL API FUNCTIONS

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
        if (error.response?.status === 404) return null;
        if (logger) {
            logger.logError(error, 'MojangAPI', { username, message: error.message });
        }
        throw new Error(`Failed to fetch Mojang data: ${error.message}`);
    }
}

async function getUsernameFromUUID(uuid) {
    if (!uuid || typeof uuid !== 'string') {
        return 'Unknown';
    }

    const cacheKey = `uuid-${uuid}`;
    const cached = cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
        return cached.data;
    }

    try {
        const response = await axios.get(`https://sessionserver.mojang.com/session/minecraft/profile/${uuid}`, {
            timeout: 10000,
            validateStatus: status => status === 200 || status === 404
        });
        
        if (response.data && response.data.name) {
            cache.set(cacheKey, { data: response.data.name, timestamp: Date.now() });
            return response.data.name;
        }
        
        return 'Unknown';
    } catch (error) {
        if (error.response?.status === 404) return 'Unknown';
        return 'Unknown';
    }
}

function getCapeTypeName(capeUrl) {
    if (capeUrl.includes('minecraft.net')) {
        if (capeUrl.includes('migrator')) return '🌟 کیپ مهاجرت موجانگ';
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
}

async function getNameHistory(uuid) {
    try {
        const response = await axios.get(`https://api.mojang.com/user/profiles/${uuid}/names`);
        return response.data.reverse(); // جدیدترین نام‌ها اول
    } catch (error) {
        console.error('Error fetching name history:', error);
        return null;
    }
}

async function getMinecraftProfile(uuid) {
    const cacheKey = `profile-${uuid}`;
    const cached = cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) return cached.data;

    try {
        const sessionResponse = await axios.get(`https://sessionserver.mojang.com/session/minecraft/profile/${uuid}`, { timeout: 10000 });
        const texturesBase64 = sessionResponse.data.properties.find(prop => prop.name === 'textures').value;
        const texturesData = JSON.parse(Buffer.from(texturesBase64, 'base64').toString());
        
        const capes = [];
        const cosmetics = [];

        // Check Mojang Capes
        if (texturesData.textures.CAPE) {
            capes.push(getCapeTypeName(texturesData.textures.CAPE.url));
        }

        // Check OptiFine Cape
        try {
            const optifineCapeUrl = `http://s.optifine.net/capes/${sessionResponse.data.name}.png`;
            const optifineResponse = await axios.head(optifineCapeUrl, { timeout: 5000 });
            if (optifineResponse.status === 200) {
                capes.push('🎭 کیپ OptiFine');
            }
        } catch (e) { /* Ignore if no OptiFine cape */ }

        // Check Model
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
    const formatRank = (rank) => {
        const rankMap = {
            'VIP': '✨ VIP', 'VIP_PLUS': '✨ VIP+', 'MVP': '🌟 MVP', 'MVP_PLUS': '🌟 MVP+',
            'MVP_PLUS_PLUS': '💫 MVP++', 'SUPERSTAR': '💫 MVP++', 'YOUTUBER': '🎥 YouTuber',
            'MODERATOR': '🛡️ Moderator', 'HELPER': '🔰 Helper', 'ADMIN': '👑 Admin',
            'OWNER': '👑 Owner', 'GAME_MASTER': '🎮 Game Master', 'BUILD_TEAM': '🏗️ Build Team',
            'NONE': null, 'NORMAL': null
        };
        return rankMap[rank] || rank;
    };

    const ranks = [];
    if (player.rank && player.rank !== 'NORMAL') ranks.push(formatRank(player.rank));
    if (player.newPackageRank && player.newPackageRank !== 'NONE') ranks.push(formatRank(player.newPackageRank));
    if (player.monthlyPackageRank && player.monthlyPackageRank !== 'NONE') ranks.push(formatRank(player.monthlyPackageRank));
    if (player.monthlyRankColor && player.monthlyRankColor !== 'NONE') ranks.push(formatRank(player.monthlyRankColor));
    if (player.rankPlusColor) ranks.push(`+${formatRank(player.rankPlusColor)}`);
    if (player.youtubeRank) ranks.push(`🎥 ${formatRank(player.youtubeRank)}`);
    
    const uniqueRanks = [...new Set(ranks.filter(rank => rank))];
    return uniqueRanks.length > 0 ? uniqueRanks.join(' ') : 'پیش‌فرض';
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

// 6. EMBED & IMAGE FUNCTIONS

function createCosmeticEmbed(username, uuid, cosmeticCapes, cosmetics, page, EmbedBuilder) {
    const start = page * 5;
    const end = start + 5;
    const capesPage = cosmeticCapes.slice(start, end);
    const cosmeticsPage = cosmetics.slice(start, end);

    const embed = new EmbedBuilder()
        .setColor(COLOR_PRESETS.DEFAULT)
        .setTitle(`🎮 اطلاعات اسکین ${username}`)
        .setThumbnail(`https://crafatar.com/avatars/${uuid}?size=256&overlay`)
        .setImage(`https://crafatar.com/renders/body/${uuid}?size=512&overlay`)
        .setTimestamp();

    if (capesPage.length > 0) {
        embed.addFields({ name: "🧥 کیپ‌های فعال", value: capesPage.join('\n'), inline: true });
    }
    
    if (cosmeticsPage.length > 0) {
        embed.addFields({ name: "🎨 مدل اسکین", value: cosmeticsPage.join('\n'), inline: true });
    }

    embed.addFields({ 
        name: "🔍 لینک‌های مفید", 
        value: `[NameMC](https://namemc.com/profile/${uuid}) | [Skin History](https://namemc.com/profile/${uuid}/skin)`, 
        inline: false 
    });

    return embed;
}

async function sendProfileImageEmbed(interaction, uuid, capeUrls, hypixelStats) {
    try {
        let username = 'Unknown';
        // Get username from the UUID directly
        username = await getUsernameFromUUID(uuid);

        let stats = {};
        if (hypixelStats && typeof hypixelStats === 'object') {
            if (hypixelStats.Bedwars) {
                const bw = hypixelStats.Bedwars;
                stats['Bedwars Level'] = bw.level || 0;
                stats['Bedwars Wins'] = bw.wins || 0;
                stats['Bedwars W/L'] = ((bw.wins || 0) / (bw.losses || 1)).toFixed(2);
            }
            if (hypixelStats.SkyWars) {
                const sw = hypixelStats.SkyWars;
                stats['SkyWars Level'] = sw.level || 0;
                stats['SkyWars Wins'] = sw.wins || 0;
                stats['SkyWars W/L'] = ((sw.wins || 0) / (sw.losses || 1)).toFixed(2);
            }
        }
        
        const buffer = await createProfileImage({ uuid, username, rank: '', stats, capeUrls });

        // Send only the image, no embed, no buttons, no extra text
        await interaction.editReply({
            embeds: [],
            components: [],
            content: null,
            files: [{ attachment: buffer, name: 'profile.png' }]
        });
    } catch (error) {
        console.error('Error sending profile image:', error);
        await interaction.editReply({
            content: '❌ Error generating profile image.',
            embeds: [],
            components: []
        });
    }
}

// 7. MODERATION & BAD WORDS SYSTEM

async function addBadWord(word) {
    if (badWords.has(word)) return false;
    badWords.add(word);
    await db.bannedWords.set(word, true);
    return true;
}

async function removeBadWord(word) {
    if (!badWords.has(word)) return false;
    badWords.delete(word);
    await db.bannedWords.delete(word);
    return true;
}

function listBadWords() {
    return Array.from(badWords);
}

function isBadWord(text) {
    const words = text.toLowerCase().split(/\s+/);
    return words.some(word => badWords.has(word));
}

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
        const warningEmbed = new EmbedBuilder()
            .setColor(warningCount >= maxWarnings ? 'Red' : 'Orange')
            .setTitle(warningCount >= maxWarnings ? '🔨 بن از سرور' : '⚠️ اخطار مدیریت')
            .setDescription(`شما ${warningCount} اخطار دارید.`)
            .addFields(
                { name: 'دلیل', value: reason, inline: true },
                { name: 'مدیر', value: moderator.tag, inline: true }
            );

        await member.send({ embeds: [warningEmbed] });
        return true;
    } catch (error) {
        console.error('Failed to send warning DM:', error);
        return false;
    }
}

// 8. TICKET SYSTEM

async function ensureTicketCategory(guild) {
    const TICKET_CATEGORY_NAME = 'Tickets';
    let category = guild.channels.cache.find(c => c.name === TICKET_CATEGORY_NAME && c.type === 4);
    if (!category) {
        try {
            category = await guild.channels.create({ 
                name: TICKET_CATEGORY_NAME, 
                type: 4, 
                permissionOverwrites: [{ id: guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] }] 
            });
        } catch (e) { console.error('Error creating ticket category:', e); return null; }
    }
    return category;
}

async function createTicketChannel(guild, user, reason, customReason = null) {
    const TICKET_ACCESS_ROLE_ID = config.roles.ticketAccess;
    const SHOP_ROLE_ID = config.roles.shop;
    
    const category = await ensureTicketCategory(guild);
    if (!category) return;

    const channelName = `ticket-${user.username.replace(/[^a-z0-9-]/g, '')}`.slice(0, 99);
    const ticketChannel = await guild.channels.create({
        name: channelName, type: 0, parent: category.id,
        topic: `تیکت: ${user.tag} | موضوع: ${customReason || reason}`,
        permissionOverwrites: [
            { id: guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
            { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
            { id: SHOP_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
        ],
    });

    db.tickets.set(user.id, ticketChannel.id);
    db.ticketInfo.set(ticketChannel.id, { ownerId: user.id, reason: customReason || reason, status: 'open' });

    const welcomeEmbed = new EmbedBuilder().setColor('#3498DB').setTitle(`👋 خوش آمدید ${user.username}`).setDescription(`موضوع: ${customReason || reason}`);
    
    const adminButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('close_ticket').setLabel('بستن تیکت').setStyle(ButtonStyle.Danger)
    );

    await ticketChannel.send({ 
        content: `<@${user.id}> <@&${TICKET_ACCESS_ROLE_ID}>`, 
        embeds: [welcomeEmbed], 
        components: [adminButtons] 
    });

    await logAction(guild, `🎟️ تیکت جدید: <#${ticketChannel.id}> برای ${user.tag}`);
}

// 9. OTHER UTILITIES (Log, Status, Polls, Giveaways)

async function updateShopStatus(client, guild) {
    try {
        const totalMembers = guild.memberCount;
        client.user.setActivity(`👥 اعضای سرور: ${totalMembers}`, { type: 3 });
    } catch (e) { /* Ignore status update errors */ }
}

async function checkGiveaways() {
    if (!db || !db.giveaways || db.giveaways.size === 0) {
        return;
    }
    
    // Get all giveaway keys first, then fetch each one individually
    const giveawayKeys = Array.from(db.giveaways.keys());
    
    for (const messageId of giveawayKeys) {
        const giveaway = db.giveaways.get(messageId); // This will decrypt automatically
        
        if (!giveaway) {
            continue;
        }
        
        if (giveaway.ended) {
            continue;
        }
        
        // Fix endTime if it's a string
        const endTime = typeof giveaway.endTime === 'string' ? parseInt(giveaway.endTime) : giveaway.endTime;
        const timeLeft = endTime - Date.now();
        
        if (Date.now() >= endTime) {
            // Update endTime to number in database
            db.giveaways.set(messageId, { ...giveaway, endTime });
            await endGiveaway(messageId);
        }
    }
}

async function endGiveaway(messageId) {
    if (!client || !db || !db.giveaways) {
        return;
    }
    
    const giveaway = db.giveaways.get(messageId);
    if (!giveaway || giveaway.ended) {
        return;
    }
    
    const channel = client.channels.cache.get(giveaway.channelId);
    if (!channel) {
        return db.giveaways.delete(messageId);
    }
    
    const message = await channel.messages.fetch(messageId).catch(() => null);
    if (!message) {
        return db.giveaways.delete(messageId);
    }
    
    // Logic for picking winner(s)
    const participants = giveaway.participants || [];
    const winners = [];
    if (participants.length > 0) {
        const winnerCount = giveaway.winnerCount || 1;
        const tempParticipants = [...participants];
        
        for (let i = 0; i < winnerCount && tempParticipants.length > 0; i++) {
            const winnerIndex = Math.floor(Math.random() * tempParticipants.length);
            winners.push(tempParticipants.splice(winnerIndex, 1)[0]);
        }
    }
    
    // Create detailed end message
    const endEmbed = new EmbedBuilder()
        .setColor('#808080')
        .setTitle('🏁 گیوای به پایان رسید')
        .setDescription(`**جایزه:** ${giveaway.prize}\n**تعداد برندگان:** ${giveaway.winnerCount || 1}\n**تعداد شرکت‌کنندگان:** ${participants.length}`)
        .addFields(
            { 
                name: winners.length > 0 ? '🎉 برندگان' : '❌ نتیجه', 
                value: winners.length > 0 
                    ? winners.map(w => `<@${w}>`).join(', ')
                    : 'هیچ برنده‌ای انتخاب نشد چون کسی در گیوای شرکت نکرد!'
            }
        )
        .addFields(
            { 
                name: '👤 میزبان', 
                value: `<@${giveaway.host}>`,
                inline: true
            },
            { 
                name: '⏰ مدت زمان', 
                value: `<t:${Math.floor(giveaway.endTime/1000)}:R> تمام شد`,
                inline: true
            }
        )
        .setFooter({ text: `گیوای ID: ${messageId}` })
        .setTimestamp();
    
    await message.edit({ embeds: [endEmbed], components: [] });
    
    // Mark giveaway as ended
    db.giveaways.set(messageId, { ...giveaway, ended: true });
    
    // Send DM to winners
    if (winners.length > 0) {
        const winnerEmbed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🎆 تبریک! شما برنده گیووای شدید')
            .setDescription(`شما در سرور **${channel.guild.name}** برنده گیووای با جایزه **${giveaway.prize}** شدید!\n\nبرای دریافت جایزه خود، لطفاً یک تیکت باز کنید.`)
            .setFooter({ text: 'تیم مدیریت سرور' })
            .setTimestamp();

        for (const winnerId of winners) {
            try {
                const user = await client.users.fetch(winnerId);
                await user.send({ embeds: [winnerEmbed] });
            } catch (e) {
                // Ignore DM errors
            }
        }
    }
}

async function checkPolls() {
    // Poll logic implementation...
}

// 10. COMMAND REGISTRATION
async function registerCommands(clientId, guildId, token) {
    commands.length = 0; // Clear existing

    // MC Info - Enhanced Version
    commands.push(new SlashCommandBuilder()
        .setName("mcinfo")
        .setDescription("نمایش اطلاعات کامل اکانت ماینکرفت در هایپیکسل")
        .addStringOption(opt => opt.setName("username").setDescription("یوزرنیم ماینکرفت").setRequired(true))
        .addStringOption(opt => opt.setName("price").setDescription("قیمت اکانت (تومان)").setRequired(false))
        .addBooleanOption(opt => opt.setName("show_stats").setDescription("نمایش استتس هایپیکسل").setRequired(false))
        .addBooleanOption(opt => opt.setName("show_history").setDescription("نمایش تاریخچه نام‌های قبلی").setRequired(false))
        .toJSON());

    // Send Account Info
    commands.push(new SlashCommandBuilder()
        .setName("send_account")
        .setDescription("ارسال اطلاعات اکانت برای خریدار")
        .addStringOption(opt => opt.setName("mail").setDescription("ایمیل اکانت").setRequired(true))
        .addStringOption(opt => opt.setName("recovery_code").setDescription("کد بازیابی اکانت").setRequired(true))
        .addStringOption(opt => opt.setName("account_num").setDescription("شماره اکانت").setRequired(true))
        .addStringOption(opt => opt.setName("username").setDescription("یوزرنیم اکانت (اختیاری)").setRequired(false))
        .addStringOption(opt => opt.setName("password").setDescription("پسورد اکانت (اختیاری)").setRequired(false))
        .toJSON());

    // Moderation Commands
    commands.push(new SlashCommandBuilder()
        .setName('addbadword')
        .setDescription('افزودن کلمه غیرمجاز')
        .addStringOption(opt => opt.setName('word').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .toJSON());

    commands.push(new SlashCommandBuilder()
        .setName('removebadword')
        .setDescription('حذف کلمه غیرمجاز')
        .addStringOption(opt => opt.setName('word').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .toJSON());

    commands.push(new SlashCommandBuilder()
        .setName('listbadwords')
        .setDescription('لیست کلمات غیرمجاز')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .toJSON());

    commands.push(new SlashCommandBuilder()
        .setName('clearwarnings')
        .setDescription('پاک کردن اخطارهای یک کاربر')
        .addUserOption(opt => opt.setName('user').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .toJSON());

    commands.push(new SlashCommandBuilder()
        .setName('warn')
        .setDescription('اخطار به کاربر')
        .addUserOption(opt => opt.setName('user').setRequired(true))
        .addStringOption(opt => opt.setName('reason'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .toJSON());

    commands.push(new SlashCommandBuilder()
        .setName('clear')
        .setDescription('پاک کردن پیام‌ها')
        .addIntegerOption(opt => opt.setName('amount').setRequired(true).setMinValue(1).setMaxValue(100))
        .addUserOption(opt => opt.setName('user'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .toJSON());

    commands.push(new SlashCommandBuilder()
        .setName('kick')
        .setDescription('اخراج کاربر')
        .addUserOption(opt => opt.setName('user').setRequired(true))
        .addStringOption(opt => opt.setName('reason'))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
        .toJSON());

    commands.push(new SlashCommandBuilder()
        .setName('ban')
        .setDescription('بن کردن کاربر')
        .addUserOption(opt => opt.setName('user').setRequired(true))
        .addStringOption(opt => opt.setName('reason'))
        .addIntegerOption(opt => opt.setName('deletedays').setMinValue(0).setMaxValue(7))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .toJSON());

    commands.push(new SlashCommandBuilder()
        .setName('unban')
        .setDescription('آنبن کردن کاربر')
        .addStringOption(opt => opt.setName('userid').setRequired(true))
        .addStringOption(opt => opt.setName('reason'))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .toJSON());

    // Giveaway Commands
    commands.push(new SlashCommandBuilder()
        .setName('start-giveaway')
        .setDescription('شروع گیوای')
        .addChannelOption(opt => opt.setName('channel').setRequired(true))
        .addStringOption(opt => opt.setName('duration').setRequired(true))
        .addIntegerOption(opt => opt.setName('winners').setRequired(true).setMinValue(1).setMaxValue(10))
        .addStringOption(opt => opt.setName('prize').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .toJSON());

    commands.push(new SlashCommandBuilder()
        .setName('end-giveaway')
        .setDescription('پایان گیوای')
        .addStringOption(opt => opt.setName('messageid').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .toJSON());

    commands.push(new SlashCommandBuilder()
        .setName('reroll-giveaway')
        .setDescription('انتخاب مجدد برنده')
        .addStringOption(opt => opt.setName('messageid').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .toJSON());

    // Analytics Commands
    commands.push(new SlashCommandBuilder()
        .setName('invites')
        .setDescription('آمار دعوت کاربر')
        .addUserOption(opt => opt.setName('user'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .toJSON());

    commands.push(new SlashCommandBuilder()
        .setName('invites-leaderboard')
        .setDescription('لیست برترین دعوت‌کنندگان')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .toJSON());

    commands.push(new SlashCommandBuilder()
        .setName('rolestats')
        .setDescription('آمار رول‌ها')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .toJSON());

    commands.push(new SlashCommandBuilder()
        .setName('serverinfo')
        .setDescription('اطلاعات سرور')
        .toJSON());

    commands.push(new SlashCommandBuilder()
        .setName('userinfo')
        .setDescription('اطلاعات کاربر')
        .addUserOption(opt => opt.setName('user'))
        .toJSON());

    // Utility Commands
    commands.push(new SlashCommandBuilder()
        .setName('sendrolemenu')
        .setDescription('ارسال منوی رول‌ها')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .toJSON());

    commands.push(new SlashCommandBuilder()
        .setName('sendticketmenu')
        .setDescription('ارسال منوی تیکت')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .toJSON());

    commands.push(new SlashCommandBuilder()
        .setName('sendmessage')
        .setDescription('ارسال پیام سفارشی')
        .addChannelOption(opt => opt.setName('channel'))
        .addUserOption(opt => opt.setName('user'))
        .addBooleanOption(opt => opt.setName('embed'))
        .addStringOption(opt => opt.setName('color'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .toJSON());

    const rest = new REST({ version: '10' }).setToken(token);
    try {
        console.log('Started refreshing application (/) commands.');
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) { 
        console.error('Error registering commands:', error); 
    }
}

// 11. EXPORTS
module.exports = {
    // Client & Core
    setClient,
    getClient,
    setLogger,
    getLogger,
    ms,
    
    // API
    getMojangData,
    getUsernameFromUUID,
    getMinecraftProfile,
    getHypixelData,
    getHypixelRanks,
    getNetworkLevel,
    getGameStats,
    getNameHistory,
    
    // Features
    createCosmeticEmbed,
    sendProfileImageEmbed,
    registerCommands,
    updateShopStatus,
    logAction,
    logActionEnhanced,
    
    // Moderation
    addBadWord,
    removeBadWord,
    listBadWords,
    isBadWord,
    addWarning,
    clearWarnings,
    getWarnings,
    sendWarningDM,
    
    // Tickets & Events
    createTicketChannel,
    ensureTicketCategory,
    checkGiveaways,
    checkPolls
};
