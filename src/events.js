// events.js
const db = require('./database');
const utils = require('./utils');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../configManager');

let logger = null;
const setLogger = (l) => { logger = l; }

async function onMessageCreate(message, client, env) {
    // Skip bot messages
    if (message.author.bot) return;

    // --- Bad Words Filter ---
    if (utils.isBadWord(message.content)) {
        try {
            await message.delete();
        } catch {}
        // Warn user
        const warnCount = await utils.addWarning(message.author.id);
        try {
            await message.author.send({
                embeds: [
                    new EmbedBuilder()
                        .setColor('Red')
                        .setTitle('⚠️ Behavioral Warning')
                        .setDescription('Your message was deleted for using banned words. Please follow server rules.')
                        .addFields({ name: 'Warning Count', value: `${warnCount} / 3` })
                        .setFooter({ text: 'If repeated, you will be banned from the server.' })
                        .setTimestamp()
                ]
            });
        } catch {}
        // Log
        await utils.logAction(message.guild, `🚫 Message containing banned word deleted from ${message.author.tag}. (${warnCount}/3 warnings)`);
        
        if (logger) {
            await logger.logWarn('Banned Word Detected', {
                User: `${message.author.tag} (${message.author.id})`,
                Channel: `${message.channel.name} (${message.channel.id})`,
                Guild: `${message.guild.name} (${message.guild.id})`,
                WarningCount: `${warnCount}/3`,
                Content: message.content.substring(0, 100)
            }, 'Moderation');
        }
        
        // Ban after 3 warnings
        if (warnCount >= 3) {
            try {
                // Send English ban DM
                try {
                    const banEmbed = new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle('Banned from Server')
                        .setDescription('You have been banned from the server for receiving 3 warnings. Contact an admin for more information.')
                        .setTimestamp();
                    await message.author.send({ embeds: [banEmbed] });
                } catch (dmError) {
                    console.error('Failed to send ban DM:', dmError);
                }
                await message.member.ban({ reason: 'Received 3 warnings for repeated use of banned words' });
                utils.clearWarnings(message.author.id);
                await utils.logAction(message.guild, `⛔️ ${message.author.tag} banned for receiving 3 warnings.`);
                
                if (logger) {
                    await logger.logModeration('User Auto-Banned (3 Warnings)', 
                        { tag: 'System', id: '0' }, message.author, {
                        Reason: 'Received 3 warnings for banned words',
                        Guild: `${message.guild.name} (${message.guild.id})`
                    });
                }
            } catch {}
        }
        return;
    }
    // ...existing code...
}

async function onGuildMemberAdd(member, client, env) {
    // Welcome new members
    console.log(`New member joined: ${member.user.tag}`);

    // Send mention message in role channel and delete it quickly
    const roleChannelId = config.channels.roleMenu;
    if (roleChannelId) {
        try {
            const channel = member.guild.channels.cache.get(roleChannelId);
            if (channel && channel.isTextBased()) {
                const msg = await channel.send({ content: `${member} Please select your role from the menu above.` });
                setTimeout(() => msg.delete().catch(() => {}), 1000);
            }
        } catch (e) {
            console.error('Error sending quick role mention:', e);
        }
    }
    try {
        await utils.logAction(member.guild, `👋 ${member.user.tag} joined the server.`);
        
        if (logger) {
            await logger.logInfo('Member Joined', {
                User: `${member.user.tag} (${member.user.id})`,
                Guild: `${member.guild.name} (${member.guild.id})`,
                AccountAge: `${Math.floor((Date.now() - member.user.createdTimestamp) / 86400000)} days`,
                MemberCount: member.guild.memberCount
            }, 'Guild Event');
        }
    } catch (e) {
        console.error('Error logging member join:', e);
    }
}

async function onGuildMemberRemove(member, client, env) {
    // Handle member leaving
    console.log(`Member left: ${member.user.tag}`);
    
    // Cleanup user data if they leave
    if (db.tickets.has(member.id)) {
        const ticketChannelId = db.tickets.get(member.id);
        db.tickets.delete(member.id);
        if (db.ticketInfo.has(ticketChannelId)) {
            db.ticketInfo.delete(ticketChannelId);
        }
    }
    
    try {
        await utils.logAction(member.guild, `👋 ${member.user.tag} left the server.`);
        
        if (logger) {
            await logger.logInfo('Member Left', {
                User: `${member.user.tag} (${member.user.id})`,
                Guild: `${member.guild.name} (${member.guild.id})`,
                MemberCount: member.guild.memberCount
            }, 'Guild Event');
        }
    } catch (e) {
        console.error('Error logging member leave:', e);
    }
}

async function onReady(client) {
    console.log(`✅ Bot logged in: ${client.user.tag}`);
}

async function onInteractionCreate(interaction, client, env) {
    console.log(`events.onInteractionCreate entry: type=${interaction.type}, isButton=${interaction.isButton()}, customId='${interaction.customId || 'N/A'}', replied=${interaction.replied}, deferred=${interaction.deferred}`);
    // All slash command logic has been moved to commands.js to avoid dual processing.
    // This function can be used for other interaction types like buttons or select menus if needed in the future.
}
async function onGuildBanAdd(ban, client, env) {
    const { user, guild } = ban;

    // Find a suitable channel for creating an invite
    let inviteUrl = 'Unable to create invite at this time.';
    try {
        const channel = guild.channels.cache.find(c =>
            c.isTextBased() &&
            c.permissionsFor(guild.members.me).has('CreateInvite')
        );
        if (channel) {
            const invite = await channel.createInvite({
                maxAge: 86400, // 24 hours
                maxUses: 1,
                reason: 'Temporary invite for ban notification'
            });
            inviteUrl = invite.url;
        }
    } catch (inviteError) {
        console.error('Error creating invite:', inviteError);
    }

    const embed = new EmbedBuilder()
        .setColor('Red')
        .setTitle('You have been banned')
        .setDescription('You have been banned from the server for violating our community guidelines. If you believe this was a mistake, please contact server administration for more details.')
        .setFooter({ text: `Server Invite: ${inviteUrl}` })
        .setTimestamp();

    try {
        await user.send({
            content: 'You have been banned from the server.',
            embeds: [embed]
        });
    } catch (dmError) {
        console.error('Failed to send DM to banned user:', dmError);
    }

    // Log the ban action
    try {
        await utils.logAction(guild, `⛔️ ${user.tag} was banned from the server.`);
        
        if (logger) {
            await logger.logModeration('User Banned', 
                { tag: 'System', id: '0' }, user, {
                Guild: `${guild.name} (${guild.id})`,
                Reason: ban.reason || 'No reason provided'
            });
        }
    } catch (logError) {
        console.error('Failed to log ban:', logError);
    }
}

module.exports = {
    onMessageCreate,
    onGuildMemberAdd,
    onGuildMemberRemove,
    onReady,
    onInteractionCreate,
    onGuildBanAdd,
    setLogger
};
