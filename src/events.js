// src/events.js
const { EmbedBuilder } = require('discord.js');
const db = require('./database');
const utils = require('./utils');
const config = require('../configManager');
const spamDetection = require('./spamDetection'); // اضافه شد
const commands = require('./commands'); // اضافه شد

// متغیرهای داخلی
let logger = null;
let security = null;

// توابع تنظیم کننده (Setter)
const setLogger = (l) => { logger = l; }
const setSecurity = (s) => { security = s; } // اضافه شد

async function onMessageCreate(message, client) {
    // نادیده گرفتن پیام‌های خود ربات
    if (message.author.bot) return;
    
    try {
        // ۱. تشخیص اسپم (Spam Detection)
        const isSpamming = await spamDetection.isSpam(message);
        if (isSpamming) {
            await message.delete().catch(() => {});
            
            // لاگ کردن اسپم
            if (logger) {
                await logger.logInfo('Spam Detected', {
                    User: `${message.author.tag} (${message.author.id})`,
                    Channel: `${message.channel.name} (${message.channel.id})`,
                    MessageCount: spamDetection.getMessageCount(message.author.id)
                });
            }
            return; // توقف پردازش
        }
        
        // ۲. فیلتر کلمات بد (Bad Words)
        if (utils.isBadWord(message.content)) {
            await message.delete().catch(() => {});
            
            // ثبت اخطار
            const warningCount = await utils.addWarning(
                message.author.id, 
                'Using inappropriate language', 
                message.guild.members.me || { tag: 'System', id: '0' }
            );
            
            // بررسی بن خودکار (۳ اخطار)
            if (warningCount >= 3) {
                try {
                    // چک کردن دسترسی بن
                    if (!message.guild.members.me.permissions.has('BanMembers')) {
                        console.log('⚠️ Bot missing BanMembers permission for auto-ban');
                        return;
                    }
                    
                    // ارسال پیام به کاربر قبل از بن
                    try {
                        const banDmEmbed = new EmbedBuilder()
                            .setColor('Red')
                            .setTitle('Banned from Server')
                            .setDescription('You have been automatically banned for receiving 3 warnings.')
                            .setTimestamp();
                        await message.author.send({ embeds: [banDmEmbed] });
                    } catch (e) {}

                    // انجام بن
                    await message.guild.members.ban(message.author, { 
                        reason: 'Auto-ban: 3 warnings for bad words',
                        deleteMessageSeconds: 3600 
                    });
                    
                    // لاگ کردن بن
                    if (logger) {
                        await logger.logModeration('User Auto-Banned', { tag: 'System' }, message.author, {
                            Reason: '3 warnings reached (Bad Words)',
                            Guild: message.guild.name
                        });
                    }
                } catch (banError) {
                    console.error('Failed to auto-ban user:', banError);
                }
                return; // توقف پردازش
            }
            
            // ارسال اخطار (اگر بن نشد)
            const warningEmbed = new EmbedBuilder()
                .setColor(warningCount >= 2 ? 'Orange' : 'Yellow')
                .setTitle('⚠️ Warning: Inappropriate Language')
                .setDescription('Your message was deleted for containing inappropriate language.')
                .addFields(
                    { name: '⚠️ Warning Count', value: `${warningCount}/3`, inline: true },
                    { name: '🔔 Reminder', value: '3 warnings = Ban', inline: true }
                )
                .setFooter({ text: 'West Bot Moderation' });
            
            try {
                await message.author.send({ embeds: [warningEmbed] });
            } catch (e) {}
            
            return; // توقف پردازش
        }
        
        // ۳. بررسی‌های امنیتی (Security Manager)
        if (security) {
            const securityCheck = await security.checkMessage(message);
            if (!securityCheck.allowed) {
                return; // اگر سیستم امنیتی اجازه نداد، متوقف شود
            }
        }
        
        // ۴. هندل کردن دستورات متنی (Prefix Commands)
        if (message.content.startsWith(config.bot.prefix)) {
            const args = message.content.slice(config.bot.prefix.length).trim().split(/ +/);
            const commandName = args.shift().toLowerCase();
            
            await commands.handleTextCommand(message, commandName, args);
            
            if (logger) {
                await logger.logInfo('Text Command Executed', {
                    User: message.author.tag,
                    Command: commandName,
                    Guild: message.guild.name
                }, 'Command');
            }
        }

    } catch (error) {
        if (logger) {
            await logger.logError(error, 'Message Handler', {
                User: message.author.tag,
                Channel: message.channel.name,
                Content: message.content.substring(0, 50)
            });
        } else {
            console.error('Message Handler Error:', error);
        }
    }
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
    setLogger,
    setSecurity
};
