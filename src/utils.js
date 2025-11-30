// utils.js
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
const { db } = require('./database'); // مطمئن شوید فایل database.js وجود دارد
const config = require('../configManager');

// --- Global Variables & Cache ---
const commands = [];
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000;
const COLOR_PRESETS = {
    DEFAULT: "#006400" // Dark Green
};

// Bad Words Set (In-Memory)
const badWords = new Set();

// Client & Logger References
let client = null;
let logger = null;

function setClient(c) { client = c; }
function setLogger(l) { logger = l; }

// --- Utility Functions ---

function ms(str) {
    if (!str) return 0;
    const unitMap = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    const match = /^(\d+)([smhd])$/.exec(str);
    if (!match) return null;
    return parseInt(match[1], 10) * unitMap[match[2]];
}

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

// --- Bad Words Management ---

async function addBadWord(word) {
    if (badWords.has(word)) return false;
    badWords.add(word);
    db.badWords.set(word, true);
    return true;
}

async function removeBadWord(word) {
    if (!badWords.has(word)) return false;
    badWords.delete(word);
    db.badWords.delete(word);
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

async function addWarning(userId, reason = null, moderator = null) {
    let warnings = db.warnings.get(userId);
    
    // If warnings is a number (legacy format), convert to array
    if (typeof warnings === 'number') {
        const count = warnings;
        warnings = [];
        for (let i = 0; i < count; i++) {
            warnings.push({
                reason: 'Legacy warning',
                moderatorId: '0',
                timestamp: Date.now() - (count - i) * 3600000
            });
        }
    }
    
    // Initialize as empty array if not exists
    if (!warnings || !Array.isArray(warnings)) {
        warnings = [];
    }
    
    // If called with just userId (automatic warnings), add a simple warning
    if (!reason && !moderator) {
        warnings.push({
            reason: 'Automatic warning (bad word detected)',
            moderatorId: '0',
            timestamp: Date.now()
        });
    } else {
        // If called with reason and moderator (manual warnings), store with details
        warnings.push({
            reason: reason || 'No reason provided',
            moderatorId: moderator?.id || '0',
            timestamp: Date.now()
        });
    }
    
    db.warnings.set(userId, warnings);
    return warnings.length;
}

async function clearWarnings(userId) {
    db.warnings.delete(userId);
    return true;
}

async function getWarnings(userId) {
    return db.warnings.get(userId) || [];
}

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
            .setFooter({
                text: warningCount >= maxWarnings
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

// --- Mojang & Hypixel API ---

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

async function getNameHistory(uuid) {
    try {
        const response = await axios.get(`https://api.mojang.com/user/profiles/${uuid}/names`);
        return response.data.reverse();
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

        // Mojang Capes
        if (texturesData.textures.CAPE) {
            const capeUrl = texturesData.textures.CAPE.url;
            capes.push(getCapeTypeName(capeUrl));
        }

        // OptiFine Cape
        try {
            const username = sessionResponse.data.name;
            const optifineCapeUrl = `http://s.optifine.net/capes/${username}.png`;
            const optifineResponse = await axios.head(optifineCapeUrl, { timeout: 5000 });
            if (optifineResponse.status === 200) {
                capes.push('🎭 کیپ OptiFine');
            }
        } catch (e) { /* Ignore */ }

        // Skin Model
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

// --- Helper Formatting Functions ---

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
    // This requires 'canvas' or similar library. Returning a dummy buffer for now.
    // You should implement the actual canvas drawing here using data.uuid, data.stats, etc.
    // console.warn("createProfileImage is using a placeholder. Please implement canvas logic.");
    return Buffer.from([]); // Return empty buffer or implement canvas
}

async function sendProfileImageEmbed(interaction, uuid, capeUrls, hypixelStats) {
    try {
        let username = 'Unknown';
        try {
            if (interaction?.options && typeof interaction.options.getString === 'function') {
                username = interaction.options.getString('username') || username;
            }
        } catch (e) { }

        if ((!username || username === 'Unknown') && uuid) {
            try {
                const mojang = await getMojangData(uuid);
                if (mojang && mojang.name) username = mojang.name || mojang.username || username;
            } catch (e) { }
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

// --- Ticket System ---

async function createTicketChannel(guild, user, reason, customReason = null, additionalDetails = '') {
    const ticketConfig = config.ticketSystem;
    const TICKET_ACCESS_ROLE_ID = config.roles.ticketAccess;
    const SHOP_ROLE_ID = config.roles.shop;

    // --- NEW: Find category by ticket reason, or create if missing
    const reasonConfig = ticketConfig.menu.categories.find(cat => cat.value === reason);
    const desiredCategoryName = reasonConfig?.value || reasonConfig?.label || reason || "Tickets";
    let category = guild.channels.cache.find(
      ch => ch.type === 4 && ch.name.toLowerCase() === desiredCategoryName.toLowerCase()
    );
    if (!category) {
        category = await guild.channels.create({
            name: desiredCategoryName,
            type: 4, // GUILD_CATEGORY
            permissionOverwrites: [
                { id: guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
                { id: TICKET_ACCESS_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.ManageMessages] },
                { id: SHOP_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.ManageMessages] }
            ]
        });
    }

    const finalReason = customReason || reason;
    const channelName = ticketConfig.channelNameTemplate.replace('{username}', user.username.replace(/[^a-z0-9-]/g, ''));
    const channelTopic = ticketConfig.channelTopicTemplate
        .replace('{user_tag}', user.tag)
        .replace('{reason}', finalReason);

    const ticketChannel = await guild.channels.create({
        name: channelName.slice(0, 100),
        type: 0, // TEXT_CHANNEL
        parent: category.id,
        topic: channelTopic,
        permissionOverwrites: [
            { id: guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
            { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
            { id: TICKET_ACCESS_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.ManageMessages] },
            { id: SHOP_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.ManageMessages] }
        ],
    });

    db.tickets.set(user.id, ticketChannel.id);
    db.ticketInfo.set(ticketChannel.id, { ownerId: user.id, reason: finalReason, status: 'open', claimedBy: null });

    const welcomeEmbed = new EmbedBuilder()
        .setColor(config.colors.info || '#3498DB')
        .setTitle(ticketConfig.welcomeMessage.title.replace('{username}', user.username))
        .setDescription(ticketConfig.welcomeMessage.description.replace('{reason}', finalReason))
        .setTimestamp();

    // Add additional details if provided
    if (additionalDetails && additionalDetails.trim()) {
        welcomeEmbed.addFields({
            name: 'Additional Details',
            value: additionalDetails.length > 1024 ? additionalDetails.substring(0, 1021) + '...' : additionalDetails,
            inline: false
        });
    }

    const userButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('complete_purchase').setLabel(ticketConfig.buttons.user.completePurchase.label).setStyle(ButtonStyle[ticketConfig.buttons.user.completePurchase.style]),
        new ButtonBuilder().setCustomId('close_ticket_user').setLabel(ticketConfig.buttons.user.closeTicket.label).setStyle(ButtonStyle[ticketConfig.buttons.user.closeTicket.style]),
        new ButtonBuilder().setCustomId('claim_ticket').setLabel(ticketConfig.buttons.admin.claimTicket.label).setStyle(ButtonStyle[ticketConfig.buttons.admin.claimTicket.style])
    );

    const adminButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('record_order_admin').setLabel(ticketConfig.buttons.admin.recordOrder.label).setStyle(ButtonStyle[ticketConfig.buttons.admin.recordOrder.style]),
        new ButtonBuilder().setCustomId('complete_purchase_admin').setLabel(ticketConfig.buttons.admin.completePurchase.label).setStyle(ButtonStyle[ticketConfig.buttons.admin.completePurchase.style])
    );

    // Management buttons for ticket operations (only for closed tickets)
    // For open tickets, no management buttons needed
    const managementButtons = new ActionRowBuilder().addComponents(
        // Remove close button for open tickets - users can close via userButtons
    );

    const mentionText = ticketConfig.mentionText
        .replace('{user_id}', user.id)
        .replace('{ticket_access_role_id}', TICKET_ACCESS_ROLE_ID);
    const components = [userButtons, adminButtons, managementButtons];

    await ticketChannel.send({
        content: mentionText,
        embeds: [welcomeEmbed],
        components: components
    });

    await logAction(guild, `🎟️ New ticket created for ${user.tag} with subject "${finalReason}". <#${ticketChannel.id}>`);
    
    if (logger) {
        await logger.logTicket('Created', user, {
            TicketChannel: `${ticketChannel.name} (${ticketChannel.id})`,
            Reason: finalReason,
            Category: reason,
            HasDetails: additionalDetails ? 'Yes' : 'No'
        });
    }
}

// --- Shop & Events Logic ---

async function updateShopStatus(client, guild) {
    // This function was broken in source.
    // Placeholder logic: Log status update.
    if (logger) logger.log('Shop status update triggered.');
    // Add real shop status logic here (e.g. updating channel stats)
}

async function checkGiveaways() {
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
    if (!client) return;
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
    commands.length = 0; // Clear existing commands to avoid duplicates if called multiple times

    commands.push(
        new SlashCommandBuilder()
            .setName("mcinfo")
            .setDescription("Display complete Minecraft account information on Hypixel")
            .addStringOption(option => option.setName("username").setDescription("Minecraft username").setRequired(true))
            .addStringOption(option => option.setName("price").setDescription("Account price (Toman)").setRequired(false))
            .addBooleanOption(option => option.setName("show_stats").setDescription("Show Hypixel stats").setRequired(false))
            .addBooleanOption(option => option.setName("show_history").setDescription("Show previous name history").setRequired(false))
            .toJSON(),

        new SlashCommandBuilder()
            .setName("send_account")
            .setDescription("Send account information to buyer")
            .addStringOption(option => option.setName("mail").setDescription("Account email").setRequired(true))
            .addStringOption(option => option.setName("recovery_code").setDescription("Account recovery code").setRequired(true))
            .addStringOption(option => option.setName("account_num").setDescription("Account number").setRequired(true))
            .addStringOption(option => option.setName("username").setDescription("Account username (optional)").setRequired(false))
            .addStringOption(option => option.setName("password").setDescription("Account password (optional)").setRequired(false))
            .toJSON(),

        new SlashCommandBuilder()
            .setName('addbadword')
            .setDescription('Add banned word')
            .addStringOption(opt => opt.setName('word').setDescription('Banned word').setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .toJSON(),

        new SlashCommandBuilder()
            .setName('removebadword')
            .setDescription('Remove banned word')
            .addStringOption(opt => opt.setName('word').setDescription('Banned word').setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .toJSON(),

        new SlashCommandBuilder()
            .setName('listbadwords')
            .setDescription('Show list of banned words')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .toJSON(),

        new SlashCommandBuilder()
            .setName('clearwarnings')
            .setDescription('Clear warnings for a user')
            .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
            .toJSON(),

        new SlashCommandBuilder()
            .setName('invites')
            .setDescription('Show invite details for a user')
            .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
            .toJSON(),

        new SlashCommandBuilder()
            .setName('start-giveaway')
            .setDescription('Start a new giveaway')
            .addChannelOption(opt => opt.setName('channel').setDescription('Target channel').setRequired(true))
            .addStringOption(opt => opt.setName('duration').setDescription('Duration (e.g. 1h, 30m, 2d)').setRequired(true))
            .addIntegerOption(opt => opt.setName('winners').setDescription('Number of winners').setRequired(true))
            .addStringOption(opt => opt.setName('prize').setDescription('Giveaway prize').setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
            .toJSON(),

        new SlashCommandBuilder()
            .setName('end-giveaway')
            .setDescription('End a giveaway')
            .addStringOption(opt => opt.setName('messageid').setDescription('Giveaway message ID').setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
            .toJSON(),

        new SlashCommandBuilder()
            .setName('reroll-giveaway')
            .setDescription('Reroll giveaway (select new winner)')
            .addStringOption(opt => opt.setName('messageid').setDescription('Giveaway message ID').setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
            .toJSON(),

        new SlashCommandBuilder()
            .setName('rolestats')
            .setDescription('Show member count for each server role')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
            .toJSON(),

        new SlashCommandBuilder()
            .setName('invites-leaderboard')
            .setDescription('Show server inviters leaderboard')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
            .toJSON(),

        new SlashCommandBuilder()
            .setName('sendrolemenu') // Fixed typo
            .setDescription('Send role selection menu with buttons')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
            .toJSON(),

        new SlashCommandBuilder()
            .setName('sendticketmenu')
            .setDescription('Send ticket creation menu in ticket channel')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
            .toJSON(),

        new SlashCommandBuilder()
            .setName('sendmessage')
            .setDescription('Send custom message to user or channel')
            .addChannelOption(option => option.setName('channel').setDescription('Target channel').setRequired(false))
            .addUserOption(option => option.setName('user').setDescription('Target user').setRequired(false))
            .addBooleanOption(option => option.setName('embed').setDescription('Send message as embed?').setRequired(false))
            .addStringOption(option => option.setName('color').setDescription('Embed color').setRequired(false)
                .addChoices(
                    { name: '🔵 Blue', value: 'Blue' },
                    { name: '🟢 Green', value: 'Green' },
                    { name: '🔴 Red', value: 'Red' },
                    { name: '🟡 Yellow', value: 'Yellow' },
                    { name: '🟠 Orange', value: 'Orange' },
                    { name: '🟣 Purple', value: 'Purple' },
                    { name: '⚪ Grey', value: 'Grey' }
                ))
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .toJSON(),

        new SlashCommandBuilder()
            .setName('warn')
            .setDescription('Warn a user')
            .addUserOption(option => option.setName('user').setDescription('User').setRequired(true))
            .addStringOption(option => option.setName('reason').setDescription('Warning reason').setRequired(false).setMaxLength(500))
            .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
            .toJSON(),

        new SlashCommandBuilder()
            .setName('clear')
            .setDescription('Clear messages')
            .addIntegerOption(option => option.setName('amount').setDescription('Number of messages (1-100)').setRequired(true).setMinValue(1).setMaxValue(100))
            .addUserOption(option => option.setName('user').setDescription('Filter by user').setRequired(false))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
            .toJSON(),

        new SlashCommandBuilder()
            .setName('kick')
            .setDescription('Kick user from server')
            .addUserOption(option => option.setName('user').setDescription('User').setRequired(true))
            .addStringOption(option => option.setName('reason').setDescription('Reason').setRequired(false).setMaxLength(500))
            .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
            .toJSON(),

        new SlashCommandBuilder()
            .setName('ban')
            .setDescription('Ban user')
            .addUserOption(option => option.setName('user').setDescription('User').setRequired(true))
            .addStringOption(option => option.setName('reason').setDescription('Reason').setRequired(false).setMaxLength(500))
            .addIntegerOption(option => option.setName('deletedays').setDescription('Delete messages (0-7 days)').setRequired(false).setMinValue(0).setMaxValue(7))
            .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
            .toJSON(),

        new SlashCommandBuilder()
            .setName('unban')
            .setDescription('Unban user')
            .addStringOption(option => option.setName('userid').setDescription('User ID').setRequired(true))
            .addStringOption(option => option.setName('reason').setDescription('Reason').setRequired(false).setMaxLength(500))
            .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
            .toJSON(),

        new SlashCommandBuilder()
            .setName('userinfo')
            .setDescription('Show user information')
            .addUserOption(option => option.setName('user').setDescription('User').setRequired(false))
            .toJSON(),

        new SlashCommandBuilder()
            .setName('serverinfo')
            .setDescription('Show server information')
            .toJSON()
    );

    const rest = new REST({ version: '10' }).setToken(token);

    try {
        console.log('Started refreshing application (/) commands.');
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
        console.log(`Successfully reloaded application (/) commands.`);
    } catch (error) { console.error(error); }
    console.log('Created By Reza✨.');
}

module.exports = {
    // Utility functions
    ms,
    logAction,
    logActionEnhanced,

    // Embed Generators
    createCosmeticEmbed,
    sendProfileImageEmbed,
    createProfileImage, // Mock/Placeholder

    // API & Data
    getNameHistory,
    getMojangData,
    getMinecraftProfile,
    getHypixelData,
    getGameStats,

    // Bad words
    addBadWord,
    removeBadWord,
    listBadWords,
    isBadWord,

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

    // Scheduled Tasks
    checkGiveaways,
    checkPolls
};