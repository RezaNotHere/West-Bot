// events.js
const db = require('./database');
const utils = require('./utils');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../configManager');
const spamDetection = require('./spamDetection');

let logger = null;
const setLogger = (l) => { logger = l; }

async function onMessageCreate(message, client, env) {
    // Skip bot messages
    if (message.author.bot) return;

    // --- Message Deletion Detection (Anti-Delete Evidence) ---
    // This will be handled in messageDelete event, but we can track suspicious patterns here
    
    // --- Rapid Message Deletion Detection ---
    const userMessageCount = await utils.getUserMessageCount(message.author.id, message.channel.id);
    if (userMessageCount > 10) { // If user has sent more than 10 messages in this channel
        // Check if they're rapidly deleting messages (suspicious behavior)
        const recentDeletions = await utils.getRecentDeletions(message.author.id, message.channel.id);
        if (recentDeletions >= 3) { // If they deleted 3+ messages recently
            // This might be someone trying to hide inappropriate content
            
            // Check if this is in a support ticket channel
            if (message.channel.name && message.channel.name.toLowerCase().includes('ticket')) {
                const supportBans = db.get('support_bans') || [];
                const existingBan = supportBans.find(ban => ban.user_id === message.author.id && ban.status === 'active');
                
                if (!existingBan) {
                    const banHistory = db.get('ban_history') || {};
                    const userHistory = banHistory[message.author.id] || { warnings: 0, temp_bans: 0, perm_bans: 0, deletion_violations: 0 };
                    
                    userHistory.deletion_violations = (userHistory.deletion_violations || 0) + 1;
                    
                    // Auto-ban after 2 deletion violations in support tickets
                    if (userHistory.deletion_violations >= 2) {
                        // Create auto support ban
                        const banData = {
                            user_id: message.author.id,
                            user_tag: message.author.tag,
                            reason: 'Automatic ban: Suspicious message deletion pattern in support tickets',
                            level: 'temp',
                            duration: '2d',
                            duration_ms: 2 * 24 * 60 * 60 * 1000,
                            banned_at: Date.now(),
                            banned_by: 'Auto-Deletion Detection',
                            expires_at: Date.now() + (2 * 24 * 60 * 60 * 1000),
                            status: 'active'
                        };
                        
                        supportBans.push(banData);
                        db.set('support_bans', supportBans);
                        
                        // Update history
                        userHistory.temp_bans++;
                        userHistory.last_action = Date.now();
                        userHistory.last_action_by = 'Auto-Deletion Detection';
                        banHistory[message.author.id] = userHistory;
                        db.set('ban_history', banHistory);
                        
                        // Notify user
                        try {
                            const deletionBanEmbed = new EmbedBuilder()
                                .setColor('Red')
                                .setTitle('🚫 Automatic Support Ban - Suspicious Activity')
                                .setDescription('You have been automatically banned from creating support tickets for suspicious behavior.')
                                .addFields(
                                    { name: '📝 Reason', value: 'Rapidly deleting messages in support ticket (possible evidence hiding)', inline: true },
                                    { name: '⏱️ Duration', value: '2 Days', inline: true },
                                    { name: '📋 Appeal', value: 'You can appeal this ban if you believe it was made in error', inline: false }
                                )
                                .setFooter({ text: 'Deleting messages to hide inappropriate content is not allowed' })
                                .setTimestamp();
                            
                            await message.author.send({ embeds: [deletionBanEmbed] });
                        } catch (dmError) {
                            console.log(`Could not DM user ${message.author.id} about deletion support ban`);
                        }
                        
                        // Log auto-ban
                        if (logger) {
                            await logger.logInfo('Auto Support Ban - Deletion Pattern', {
                                User: `${message.author.tag} (${message.author.id})`,
                                Reason: 'Suspicious message deletion pattern in support tickets',
                                Duration: '2 Days',
                                DeletionViolations: userHistory.deletion_violations,
                                Channel: `${message.channel.name} (${message.channel.id})`
                            });
                        }
                        
                        // Notify staff
                        const staffChannelId = config.channels.staff;
                        if (staffChannelId) {
                            const staffChannel = message.guild.channels.cache.get(staffChannelId);
                            if (staffChannel && staffChannel.isTextBased()) {
                                const staffEmbed = new EmbedBuilder()
                                    .setColor('Red')
                                    .setTitle('🤖 Auto Support Ban Alert - Deletion Pattern')
                                    .addFields(
                                        { name: '👤 User', value: `${message.author.tag} (${message.author.id})`, inline: true },
                                        { name: '📝 Reason', value: 'Suspicious message deletion pattern', inline: true },
                                        { name: '⏱️ Duration', value: '2 Days', inline: true },
                                        { name: '🔢 Deletions', value: `${recentDeletions} recent deletions detected`, inline: true }
                                    )
                                    .setTimestamp();
                                
                                await staffChannel.send({ embeds: [staffEmbed] });
                            }
                        }
                    } else {
                        // Update history for first violation
                        banHistory[message.author.id] = userHistory;
                        db.set('ban_history', banHistory);
                        
                        // Warning for first violation
                        try {
                            const warningEmbed = new EmbedBuilder()
                                .setColor('Orange')
                                .setTitle('⚠️ Support Ticket Warning - Deletion Pattern')
                                .setDescription('We detected suspicious message deletion behavior in your support ticket.')
                                .addFields(
                                    { name: '📝 Reason', value: 'Rapidly deleting multiple messages', inline: true },
                                    { name: '⚠️ Warning', value: `This is violation ${userHistory.deletion_violations}/2 - next violation will result in auto-ban`, inline: true },
                                    { name: '📋 Please Be Transparent', value: 'Support tickets should maintain honest communication', inline: false }
                                )
                                .setTimestamp();
                            
                            await message.author.send({ embeds: [warningEmbed] });
                        } catch (dmError) {
                            console.log(`Could not DM user ${message.author.id} about deletion warning`);
                        }
                    }
                }
            }
        }
    }

    // --- Spam Detection ---
    if (await spamDetection.isSpam(message)) {
        try {
            await message.delete();
        } catch {}
        
        // Check if this is in a support ticket channel
        const supportBans = db.get('support_bans') || [];
        const existingBan = supportBans.find(ban => ban.user_id === message.author.id && ban.status === 'active');
        
        // Auto-ban from support for spam in tickets
        if (!existingBan && message.channel.name && message.channel.name.toLowerCase().includes('ticket')) {
            const banHistory = db.get('ban_history') || {};
            const userHistory = banHistory[message.author.id] || { warnings: 0, temp_bans: 0, perm_bans: 0, spam_violations: 0 };
            
            userHistory.spam_violations = (userHistory.spam_violations || 0) + 1;
            
            // Auto-ban after 1 spam violation in support tickets (spam is more serious)
            if (userHistory.spam_violations >= 1) {
                // Create auto support ban
                const banData = {
                    user_id: message.author.id,
                    user_tag: message.author.tag,
                    reason: 'Automatic ban: Spamming in support tickets',
                    level: 'temp',
                    duration: '3d',
                    duration_ms: 3 * 24 * 60 * 60 * 1000,
                    banned_at: Date.now(),
                    banned_by: 'Auto-Spam Detection',
                    expires_at: Date.now() + (3 * 24 * 60 * 60 * 1000),
                    status: 'active'
                };
                
                supportBans.push(banData);
                db.set('support_bans', supportBans);
                
                // Update history
                userHistory.temp_bans++;
                userHistory.last_action = Date.now();
                userHistory.last_action_by = 'Auto-Spam Detection';
                banHistory[message.author.id] = userHistory;
                db.set('ban_history', banHistory);
                
                // Notify user
                try {
                    const spamBanEmbed = new EmbedBuilder()
                        .setColor('Red')
                        .setTitle('🚫 Automatic Support Ban - Spam')
                        .setDescription('You have been automatically banned from creating support tickets for spamming.')
                        .addFields(
                            { name: '📝 Reason', value: 'Spamming messages in support ticket', inline: true },
                            { name: '⏱️ Duration', value: '3 Days', inline: true },
                            { name: '📋 Appeal', value: 'You can appeal this ban if you believe it was made in error', inline: false }
                        )
                        .setFooter({ text: 'Spamming is not tolerated in support channels' })
                        .setTimestamp();
                    
                    await message.author.send({ embeds: [spamBanEmbed] });
                } catch (dmError) {
                    console.log(`Could not DM user ${message.author.id} about spam support ban`);
                }
                
                // Log auto-ban
                if (logger) {
                    await logger.logInfo('Auto Support Ban - Spam', {
                        User: `${message.author.tag} (${message.author.id})`,
                        Reason: 'Spamming in support tickets',
                        Duration: '3 Days',
                        SpamViolations: userHistory.spam_violations,
                        Channel: `${message.channel.name} (${message.channel.id})`
                    });
                }
                
                // Notify staff
                const staffChannelId = config.channels.staff;
                if (staffChannelId) {
                    const staffChannel = message.guild.channels.cache.get(staffChannelId);
                    if (staffChannel && staffChannel.isTextBased()) {
                        const staffEmbed = new EmbedBuilder()
                            .setColor('Red')
                            .setTitle('🤖 Auto Support Ban Alert - Spam')
                            .addFields(
                                { name: '👤 User', value: `${message.author.tag} (${message.author.id})`, inline: true },
                                { name: '📝 Reason', value: 'Spamming in support tickets', inline: true },
                                { name: '⏱️ Duration', value: '3 Days', inline: true },
                                { name: '🔢 Messages', value: `${spamDetection.getMessageCount(message.author.id)} messages detected`, inline: true }
                            )
                            .setTimestamp();
                        
                        await staffChannel.send({ embeds: [staffEmbed] });
                    }
                }
            } else {
                // Update history
                banHistory[message.author.id] = userHistory;
                db.set('ban_history', banHistory);
            }
        }
        
        // Regular spam handling
        try {
            await message.author.send({
                embeds: [
                    new EmbedBuilder()
                        .setColor('Red')
                        .setTitle('⚠️ Spam Detection')
                        .setDescription('Your messages were deleted for spamming. Please slow down and follow server rules.')
                        .addFields({ name: '📊 Messages', value: `${spamDetection.getMessageCount(message.author.id)} messages detected` })
                        .setFooter({ text: 'Continued spamming will result in a ban.' })
                        .setTimestamp()
                ]
            });
        } catch {}
        
        await utils.logAction(message.guild, `🚫 Spam detected from ${message.author.tag}. Messages deleted.`);
        
        if (logger) {
            await logger.logWarn('Spam Detected', {
                User: `${message.author.tag} (${message.author.id})`,
                Channel: `${message.channel.name} (${message.channel.id})`,
                Guild: `${message.guild.name} (${message.guild.id})`,
                MessageCount: spamDetection.getMessageCount(message.author.id),
                Content: message.content.substring(0, 100)
            }, 'Moderation');
        }
    }

    // --- Bad Words Filter ---
    if (utils.isBadWord(message.content)) {
        try {
            await message.delete();
        } catch {}
        
        // Check if this is in a support ticket channel
        const supportBans = db.get('support_bans') || [];
        const existingBan = supportBans.find(ban => ban.user_id === message.author.id && ban.status === 'active');
        
        // Auto-ban from support if user repeatedly violates in tickets
        if (!existingBan && message.channel.name && message.channel.name.toLowerCase().includes('ticket')) {
            const banHistory = db.get('ban_history') || {};
            const userHistory = banHistory[message.author.id] || { warnings: 0, temp_bans: 0, perm_bans: 0, support_violations: 0 };
            
            userHistory.support_violations = (userHistory.support_violations || 0) + 1;
            
            // Auto-ban after 2 violations in support tickets
            if (userHistory.support_violations >= 2) {
                // Create auto support ban
                const banData = {
                    user_id: message.author.id,
                    user_tag: message.author.tag,
                    reason: 'Automatic ban: Repeated inappropriate content in support tickets',
                    level: 'temp',
                    duration: '1d',
                    duration_ms: 24 * 60 * 60 * 1000,
                    banned_at: Date.now(),
                    banned_by: 'Auto-Moderation System',
                    expires_at: Date.now() + (24 * 60 * 60 * 1000),
                    status: 'active'
                };
                
                supportBans.push(banData);
                db.set('support_bans', supportBans);
                
                // Update history
                userHistory.temp_bans++;
                userHistory.last_action = Date.now();
                userHistory.last_action_by = 'Auto-Moderation System';
                banHistory[message.author.id] = userHistory;
                db.set('ban_history', banHistory);
                
                // Notify user
                try {
                    const autoBanEmbed = new EmbedBuilder()
                        .setColor('Red')
                        .setTitle('🚫 Automatic Support Ban')
                        .setDescription('You have been automatically banned from creating support tickets.')
                        .addFields(
                            { name: '📝 Reason', value: 'Repeated inappropriate content in support tickets', inline: true },
                            { name: '⏱️ Duration', value: '1 Day', inline: true },
                            { name: '📋 Appeal', value: 'You can appeal this ban if you believe it was made in error', inline: false }
                        )
                        .setFooter({ text: 'This is an automatic action based on your behavior' })
                        .setTimestamp();
                    
                    await message.author.send({ embeds: [autoBanEmbed] });
                } catch (dmError) {
                    console.log(`Could not DM user ${message.author.id} about auto support ban`);
                }
                
                // Log auto-ban
                if (logger) {
                    await logger.logInfo('Auto Support Ban', {
                        User: `${message.author.tag} (${message.author.id})`,
                        Reason: 'Repeated inappropriate content in support tickets',
                        Duration: '1 Day',
                        Violations: userHistory.support_violations,
                        Channel: `${message.channel.name} (${message.channel.id})`
                    });
                }
                
                // Notify staff
                const staffChannelId = config.channels.staff;
                if (staffChannelId) {
                    const staffChannel = message.guild.channels.cache.get(staffChannelId);
                    if (staffChannel && staffChannel.isTextBased()) {
                        const staffEmbed = new EmbedBuilder()
                            .setColor('Red')
                            .setTitle('🤖 Auto Support Ban Alert')
                            .addFields(
                                { name: '👤 User', value: `${message.author.tag} (${message.author.id})`, inline: true },
                                { name: '📝 Reason', value: 'Repeated inappropriate content in support tickets', inline: true },
                                { name: '⏱️ Duration', value: '1 Day', inline: true },
                                { name: '📊 Violations', value: `${userHistory.support_violations}`, inline: true }
                            )
                            .setTimestamp();
                        
                        await staffChannel.send({ embeds: [staffEmbed] });
                    }
                }
            } else {
                // Update history for first violation
                banHistory[message.author.id] = userHistory;
                db.set('ban_history', banHistory);
                
                // Warning for first violation
                try {
                    const warningEmbed = new EmbedBuilder()
                        .setColor('Orange')
                        .setTitle('⚠️ Support Ticket Warning')
                        .setDescription('Your message was deleted for inappropriate content in a support ticket.')
                        .addFields(
                            { name: '📝 Reason', value: 'Using inappropriate language in support channel', inline: true },
                            { name: '⚠️ Warning', value: `This is violation ${userHistory.support_violations}/2 - next violation will result in auto-ban`, inline: true },
                            { name: '📋 Please Follow Rules', value: 'Support tickets are for getting help, not for inappropriate content', inline: false }
                        )
                        .setTimestamp();
                    
                    await message.author.send({ embeds: [warningEmbed] });
                } catch (dmError) {
                    console.log(`Could not DM user ${message.author.id} about support warning`);
                }
            }
        }
        
        // Regular warning system
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
