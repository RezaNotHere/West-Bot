// index.js
// 🔧 All configuration is now in config.json (loaded via configManager.js) - NO .env file needed!
const { 
    Client, 
    GatewayIntentBits, 
    Partials,
    Events,
    EmbedBuilder,
    ActivityType 
} = require('discord.js');
const config = require('./configManager');
const { db, dbManager } = require('./src/database');
const utils = require('./src/utils');
const commands = require('./src/commands');
const events = require('./src/events');
const handlers = require('./src/handlers');
const LoggerUtils = require('./src/utils/LoggerUtils');

// Conditional imports for security modules (may not exist in production)
let EnhancedSecurityManager = null;
let OptimizedSecurityManager = null;

try {
    EnhancedSecurityManager = require('./src/security/EnhancedSecurityManager');
    OptimizedSecurityManager = require('./src/security/OptimizedSecurityManager');
    console.log('✅ Security modules loaded successfully');
} catch (error) {
    console.warn('⚠️ Security modules not found:', error.message);
    console.log('🔄 Bot will continue without security features');
}

const commandLogger = require('./src/commandLogger');

// ✅ Validate configuration before starting
config.validateConfig();

// Initialize Logger
const logger = new LoggerUtils({
    errorWebhookUrl: config.channels.errorWebhook,
    logChannelId: config.channels.log,
    debug: config.server.environment !== 'production'
});

// Initialize optimized security manager only if module exists
let securityManager = null;
if (OptimizedSecurityManager) {
    try {
        securityManager = new OptimizedSecurityManager({
            adminIds: config.security?.adminIds || []
        });
        console.log('✅ OptimizedSecurityManager initialized successfully');
    } catch (error) {
        console.error('❌ Failed to initialize OptimizedSecurityManager:', error);
        securityManager = null;
    }
} else {
    console.warn('⚠️ OptimizedSecurityManager not available');
}

// Print configuration (only in debug mode and not showing logs)
if (config.server.debug) {
    // Silent config validation - no console output
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildPresences,
    ],
    partials: [
        Partials.Message, 
        Partials.Channel, 
        Partials.Reaction,
    ],
});

const env = config;
// provide dependencies to modules
module.exports.setModuleDependencies = (d) => {
    d.client = client;
    d.config = config;
};

function updateBotStatus() {
    const activities = config.bot.status.activities || [];
    if (activities.length > 0) {
        const activity = activities[Math.floor(Math.random() * activities.length)];
        // Convert string type to ActivityType enum
        const activityTypeMap = {
            'PLAYING': ActivityType.Playing,
            'STREAMING': ActivityType.Streaming,
            'LISTENING': ActivityType.Listening,
            'WATCHING': ActivityType.Watching,
            'COMPETING': ActivityType.Competing
        };
        const activityType = activityTypeMap[activity.type] || ActivityType.Playing;
        client.user.setActivity(activity.text, { type: activityType });
    }
}

// Set up modules with enhanced security
utils.setClient(client);
utils.setLogger(logger);
commands.setLogger(logger);
if (securityManager) {
    commands.setSecurity(securityManager);
}
handlers.setLogger(logger);
if (securityManager) {
    handlers.setSecurity(securityManager);
}
handlers.setConfig(config);
events.setLogger(logger);

const commandLogger_ins = new (require('./src/commandLogger'))();

// Import spam detection
const spamDetection = require('./src/spamDetection');

// Event: Ready
client.once(Events.ClientReady, async () => {
    // 🚫 Prevent duplicate startup screens
    if (global.startupExecuted) {
        return;
    }
    global.startupExecuted = true;
    
    // 🧹 Clear console
    console.clear();
    
    // 🤖 Simple Startup
    console.log('🤖 West Bot is Online!');
    console.log(`📊 Logged in as: ${client.user.tag}`);
    console.log(`🚀 Serving ${client.guilds.cache.size} servers`);
    
    // Set up client
    logger.setClient(client);
    
    const utils = require('./src/utils');
    utils.setClient(client);
    utils.checkGiveaways();
    
    // 📚 Load bad words from database
    console.log('\x1b[96m📚 Loading banned words from database...');
    utils.loadBadWords();

    // 🚀 Update commands
    try {
        await utils.registerCommands(config.bot.clientId, config.bot.guildId, config.bot.token);
        console.log('✅ Commands updated!');
    } catch (error) {
        console.log('⚠️ Could not update commands');
    }
    
    // 🎯 Ready message
    console.log('🎯 Bot is ready to serve!');
    
    // 🔄 Auto-update commands every 24 hours
    setInterval(async () => {
        console.log('\x1b[96m🔄 [AUTO] Updating commands (24h check)...');
        try {
            await utils.registerCommands(config.bot.clientId, config.bot.guildId, config.bot.token);
            console.log('\x1b[92m✅ [AUTO] Commands updated successfully!\x1b[0m');
        } catch (error) {
            console.log('\x1b[91m❌ [AUTO] Error updating commands:', error.message, '\x1b[0m');
        }
    }, 24 * 60 * 60 * 1000); // 24 hours
    
    // Check giveaways every 3 seconds
    setInterval(() => {
        utils.checkGiveaways();
    }, 3000);
    
    // Log bot ready
    await logger.logSuccess('Bot Started', {
        Bot: `${client.user.tag} (${client.user.id})`,
        Guilds: client.guilds.cache.size,
        Users: client.users.cache.size,
        Channels: client.channels.cache.size
    }, 'Bot Status');
    
    // Update bot status
    updateBotStatus();
    // Update status every hour
    setInterval(updateBotStatus, 3600000);
});

// Event: Interaction (Slash Commands) with enhanced security
client.on(Events.InteractionCreate, async (interaction) => {
    try {
        // Enhanced security check only if security manager exists and has the method
        if (securityManager && typeof securityManager.checkInteractionSecurity === 'function') {
            try {
                const securityCheck = await securityManager.checkInteractionSecurity(interaction);
                if (!securityCheck.allowed) {
                    try {
                        if (interaction.replied || interaction.deferred) {
                            await interaction.followUp({ 
                                content: securityCheck.message || 'Access denied',
                                flags: MessageFlags.Ephemeral
                            });
                        } else {
                            await interaction.reply({ 
                                content: securityCheck.message || 'Access denied',
                                flags: MessageFlags.Ephemeral
                            });
                        }
                    } catch (replyError) {
                        // Ignore interaction errors (expired, already responded, etc.)
                        console.warn('Security check response failed:', replyError.message);
                    }
                    return;
                }
            } catch (securityError) {
                console.warn('Security check failed:', securityError.message);
                // Continue without security check
            }
        } else if (!securityManager) {
            // Security manager not available, continue without security
            console.debug('Security manager not available, skipping security check');
        } else {
            // Method not available, continue without security
            console.warn('checkInteractionSecurity method not available, skipping security check');
        }

        // Handle different interaction types
        try {
            if (interaction.isChatInputCommand()) {
                await commandLogger_ins.logCommand(interaction);
                await commands.handleSlashCommand(interaction);
            } else if (interaction.isButton()) {
                await handlers.handleButton(interaction, client, config);
            } else if (interaction.isStringSelectMenu()) {
                await handlers.handleSelectMenu(interaction, client);
            } else if (interaction.isModalSubmit()) {
                await handlers.handleModalSubmit(interaction, client);
            }
        } catch (interactionError) {
            // Handle Discord API errors gracefully
            if (interactionError.code === 10062) { // Unknown interaction
                console.warn('⚠️ Interaction expired or already handled:', interactionError.message);
            } else if (interactionError.code === 10008) { // Unknown member
                console.warn('⚠️ Member not found:', interactionError.message);
            } else if (interactionError.code === 10013) { // Unknown user
                console.warn('⚠️ User not found:', interactionError.message);
            } else {
                // Log other errors normally
                console.error('❌ Interaction handling error:', interactionError);
            }
        }
    } catch (error) {
        await logger.logError(error, 'Interaction Handler', {
            User: `${interaction.user.tag} (${interaction.user.id})`,
            Type: interaction.type,
            CustomId: interaction.customId || interaction.commandName || 'N/A'
        });
    }
});

// Event: Message Create
client.on(Events.MessageCreate, async (message) => {
    // Ignore bot messages
    if (message.author.bot) return;
    
    try {
        // 🚨 Spam Detection
        const isSpamming = await spamDetection.isSpam(message);
        if (isSpamming) {
            // Delete spam messages
            await message.delete().catch(() => {});
            
            // Log spam detection
            await logger.logInfo('Spam Detected', {
                User: `${message.author.tag} (${message.author.id})`,
                Channel: `${message.channel.name} (${message.channel.id})`,
                MessageCount: spamDetection.getMessageCount(message.author.id)
            });
            
            return; // Stop processing
        }
        
        // 🚫 Bad Words Detection
        const utils = require('./src/utils');
        if (utils.isBadWord(message.content)) {
            // Delete message with bad words
            await message.delete().catch(() => {});
            
            // Add warning to user
            const warningCount = await utils.addWarning(message.author.id, 'Using inappropriate language (bad words)', message.guild.members.me || { tag: 'System', id: '0' });
            
            // Check if user should be banned (3 warnings = ban)
            if (warningCount >= 3) {
                try {
                    // Check if bot has ban permissions
                    if (!message.guild.members.me.permissions.has('BanMembers')) {
                        console.log('⚠️ Bot missing BanMembers permission for auto-ban');
                        
                        // Send notification to support about missing permissions
                        const permErrorEmbed = new EmbedBuilder()
                            .setColor('Orange')
                            .setTitle('⚠️ Missing Permissions for Auto-Ban')
                            .setDescription(`User reached 3 warnings but bot lacks ban permissions.`)
                            .addFields(
                                { name: '👤 User', value: `${message.author.tag} (${message.author.id})`, inline: false },
                                { name: '⚠️ Warning Count', value: `${warningCount}/3`, inline: true },
                                { name: '🔧 Required Permission', value: 'BanMembers', inline: true },
                                { name: '📝 Suggestion', value: 'Please give the bot BanMembers permission or ban manually', inline: false }
                            )
                            .setTimestamp()
                            .setFooter({ text: 'West Bot Auto-Moderation System' });
                        
                        const supportChannelId = config.channels.log || config.channels.support;
                        if (supportChannelId) {
                            const supportChannel = message.guild.channels.cache.get(supportChannelId);
                            if (supportChannel) {
                                await supportChannel.send({ embeds: [permErrorEmbed] });
                            }
                        }
                        
                        return; // Stop processing
                    }
                    
                    // Ban the user
                    await message.guild.members.ban(message.author, { 
                        reason: '3 warnings for inappropriate language (auto-ban)',
                        deleteMessageDays: 1 
                    });
                    
                    // Send ban notification to support channel
                    const banEmbed = new EmbedBuilder()
                        .setColor('Red')
                        .setTitle('🔨 USER AUTO-BANNED')
                        .setDescription(`User has been automatically banned after 3 warnings.`)
                        .addFields(
                            { name: '👤 Banned User', value: `${message.author.tag} (${message.author.id})`, inline: false },
                            { name: '⚠️ Warning Count', value: `${warningCount}/3`, inline: true },
                            { name: '📝 Reason', value: 'Inappropriate language (bad words)', inline: true },
                            { name: '🔧 Action', value: 'Auto-ban (3 warnings reached)', inline: true },
                            { name: '📅 Date', value: `<t:${Math.floor(Date.now()/1000)}:F>`, inline: true }
                        )
                        .setTimestamp()
                        .setFooter({ text: 'West Bot Auto-Moderation System' });
                    
                    // Send to support/log channel
                    const supportChannelId = config.channels.log || config.channels.support;
                    if (supportChannelId) {
                        const supportChannel = message.guild.channels.cache.get(supportChannelId);
                        if (supportChannel) {
                            await supportChannel.send({ embeds: [banEmbed] });
                            
                            // Also try to send DM to banned user
                            try {
                                const dmEmbed = new EmbedBuilder()
                                    .setColor('Red')
                                    .setTitle('🔨 You have been banned')
                                    .setDescription('You have been automatically banned from the server.')
                                    .addFields(
                                        { name: '⚠️ Reason', value: 'You received 3 warnings for inappropriate language', inline: false },
                                        { name: '📊 Warning Count', value: `${warningCount}/3`, inline: true },
                                        { name: '📝 Note', value: 'This is an automatic action. If you believe this is a mistake, please contact server administration.', inline: false }
                                    )
                                    .setTimestamp()
                                    .setFooter({ text: message.guild.name, iconURL: message.guild.iconURL() });
                                
                                await message.author.send({ embeds: [dmEmbed] });
                            } catch (dmError) {
                                // Can't send DM, ignore
                            }
                        }
                    }
                    
                    // Log the ban
                    await logger.logInfo('User Auto-Banned (3 Warnings)', {
                        Moderator: `${message.guild.members.me?.tag || 'System'} (${message.guild.members.me?.id || '0'})`,
                        Target: `${message.author.tag} (${message.author.id})`,
                        WarningCount: warningCount,
                        Reason: 'Inappropriate language (bad words)',
                        Action: 'Auto-ban after 3 warnings',
                        Channel: `${message.channel.name} (${message.channel.id})`
                    });
                    
                } catch (banError) {
                    console.error('Failed to ban user:', banError);
                }
                
                return; // Stop processing
            }
            
            // Send warning to user (if not banned)
            const warningEmbed = new EmbedBuilder()
                .setColor(warningCount >= 2 ? 'Orange' : 'Yellow')
                .setTitle('⚠️ Warning: Inappropriate Language')
                .setDescription('Your message was deleted for containing inappropriate language.')
                .addFields(
                    { name: '📝 Rule Violation', value: 'Use of prohibited words is not allowed.', inline: false },
                    { name: '⚡ Action Taken', value: 'Message deleted automatically', inline: false },
                    { name: '⚠️ Warning Count', value: `${warningCount}/3 (3 warnings = ban)`, inline: true },
                    { name: '🔔 Reminder', value: 'Repeated violations will result in a ban.', inline: false }
                )
                .setTimestamp()
                .setFooter({ text: 'West Bot Moderation System' });
            
            try {
                await message.author.send({ embeds: [warningEmbed] });
            } catch (dmError) {
                // Can't send DM, ignore
            }
            
            // Log bad word detection
            await logger.logInfo('Bad Word Detected', {
                Moderator: `${message.guild.members.me?.tag || 'System'} (${message.guild.members.me?.id || '0'})`,
                Target: `${message.author.tag} (${message.author.id})`,
                Channel: `${message.channel.name} (${message.channel.id})`,
                Message: message.content.substring(0, 100),
                WarningCount: `${warningCount}/3`,
                Action: 'Message deleted + Warning added'
            });
            
            return; // Stop processing
        }
        
        // Security checks
        if (securityManager) {
            const securityCheck = await securityManager.checkMessage(message);
            if (!securityCheck.allowed) {
                // Security system handles the action (delete, mute, etc.)
                return;
            }
        }
        
        // Handle text commands with prefix
        if (message.content.startsWith(config.bot.prefix)) {
            const args = message.content.slice(config.bot.prefix.length).trim().split(/ +/);
            const commandName = args.shift().toLowerCase();
            await commands.handleTextCommand(message, commandName, args);
            
            await logger.logInfo('Text Command Executed', {
                User: `${message.author.tag} (${message.author.id})`,
                Command: commandName,
                Args: args.join(' '),
                Channel: `${message.channel.name} (${message.channel.id})`,
                Guild: `${message.guild?.name} (${message.guild?.id})`
            }, 'Text Command');
        }
    } catch (error) {
        await logger.logError(error, 'Message Handler', {
            User: `${message.author.tag} (${message.author.id})`,
            Channel: `${message.channel.name} (${message.channel.id})`,
            Content: message.content.substring(0, 100)
        });
    }
});

// Event: Guild Member Add
client.on(Events.GuildMemberAdd, async (member) => {
    try {
        // Security check
        if (securityManager) {
            const securityCheck = await securityManager.checkMemberJoin(member);
            if (!securityCheck.allowed) {
                // Security system handles the action (kick, etc.)
                return;
            }
        }
        
        await events.onGuildMemberAdd(member);
        
        await logger.logInfo('Member Joined', {
            User: `${member.user.tag} (${member.user.id})`,
            Guild: `${member.guild.name} (${member.guild.id})`,
            AccountAge: `${Math.floor((Date.now() - member.user.createdTimestamp) / 86400000)} days`,
            MemberCount: member.guild.memberCount
        }, 'Guild Member');
    } catch (error) {
        await logger.logError(error, 'Member Join Handler', {
            User: `${member.user.tag} (${member.user.id})`,
            Guild: `${member.guild.name} (${member.guild.id})`
        });
    }
});

// Event: Guild Member Remove
client.on(Events.GuildMemberRemove, async (member) => {
    try {
        await events.onGuildMemberRemove(member);
        
        await logger.logInfo('Member Left', {
            User: `${member.user.tag} (${member.user.id})`,
            Guild: `${member.guild.name} (${member.guild.id})`,
            MemberCount: member.guild.memberCount
        }, 'Guild Member');
    } catch (error) {
        await logger.logError(error, 'Member Leave Handler', {
            User: `${member.user.tag} (${member.user.id})`,
            Guild: `${member.guild.name} (${member.guild.id})`
        });
    }
});

// Event: Guild Ban Add
client.on(Events.GuildBanAdd, async (ban) => {
    try {
        await events.onGuildBanAdd(ban);
        
        await logger.logModeration('User Banned', 
            ban.guild.members.me || { tag: 'System', id: '0' },
            ban.user,
            {
                Guild: `${ban.guild.name} (${ban.guild.id})`,
                Reason: ban.reason || 'No reason provided'
            }
        );
    } catch (error) {
        await logger.logError(error, 'Ban Handler', {
            User: `${ban.user.tag} (${ban.user.id})`,
            Guild: `${ban.guild.name} (${ban.guild.id})`
        });
    }
});

// Event: Message Delete
client.on(Events.MessageDelete, async (message) => {
    try {
        if (message.author && !message.author.bot) {
            await logger.logInfo('Message Deleted', {
                User: `${message.author.tag} (${message.author.id})`,
                Channel: `${message.channel.name} (${message.channel.id})`,
                Guild: `${message.guild?.name} (${message.guild?.id})`,
                Content: message.content?.substring(0, 100) || 'N/A'
            }, 'Message');
        }
    } catch (error) {
        await logger.logError(error, 'Message Delete Handler', {
            Channel: message.channel ? `${message.channel.name} (${message.channel.id})` : 'N/A'
        });
    }
});

// Error Handling
client.on('error', async error => {
    console.error('Client error:', error);
    await logger.logError(error, 'Discord Client Error', {
        ErrorType: error.name,
        ErrorCode: error.code || 'N/A'
    });
});

process.on('unhandledRejection', async error => {
    console.error('Unhandled promise rejection:', error);
    await logger.logError(error, 'Unhandled Promise Rejection', {
        ErrorType: error?.name || 'Unknown',
        ErrorCode: error?.code || 'N/A'
    });
});

process.on('uncaughtException', async error => {
    console.error('Uncaught exception:', error);
    await logger.logError(error, 'Uncaught Exception', {
        ErrorType: error?.name || 'Unknown'
    });
});

// Login
client.login(config.bot.token);
