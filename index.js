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

// Removed unused imports - logic moved to events.js

// ✅ Validate configuration before starting
config.validateConfig();

// Initialize Logger
const logger = new LoggerUtils({
    errorWebhookUrl: config.channels.errorWebhook,
    logChannelId: config.channels.log,
    debug: config.server.environment !== 'production'
});

// Initialize Security Manager
let securityManager = null;
if (EnhancedSecurityManager) {
    securityManager = new EnhancedSecurityManager({
        adminIds: config.security?.adminIds || []
    });
    console.log('✅ Enhanced Security Manager Active');
} else if (OptimizedSecurityManager) {
    securityManager = new OptimizedSecurityManager({
        adminIds: config.security?.adminIds || []
    });
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

// Removed unused import - logic moved to events.js

// Removed unused import - logic moved to events.js

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
        // Enhanced security check only if security manager exists
        if (securityManager) {
            const securityCheck = await securityManager.checkInteractionSecurity(interaction);
            if (!securityCheck.allowed) {
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
                return;
            }
        }

        // Handle different interaction types
        if (interaction.isChatInputCommand()) {
            await commands.handleSlashCommand(interaction);
        } else if (interaction.isButton()) {
            await handlers.handleButton(interaction, client, config);
        } else if (interaction.isStringSelectMenu()) {
            await handlers.handleSelectMenu(interaction, client);
        } else if (interaction.isModalSubmit()) {
            await handlers.handleModalSubmit(interaction, client);
        }
    } catch (error) {
        await logger.logError(error, 'Interaction Handler', {
            User: `${interaction.user.tag} (${interaction.user.id})`,
            Type: interaction.type,
            CustomId: interaction.customId || interaction.commandName || 'N/A'
        });
    }
});

// Set up modules with enhanced security
utils.setClient(client);
utils.setLogger(logger);
commands.setLogger(logger);

// تنظیمات Events Handler
events.setLogger(logger);
if (securityManager) {
    commands.setSecurity(securityManager);
    handlers.setSecurity(securityManager);
    
    // ✅ اضافه کردن سکیوریتی منیجر به ایونت‌ها
    events.setSecurity(securityManager);
}
handlers.setLogger(logger);
handlers.setConfig(config);
client.on(Events.MessageCreate, async (message) => {
    await events.onMessageCreate(message, client);
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

const transcript = require('./src/utils/transcript');
// پاکسازی هر 24 ساعت
setInterval(() => {
    transcript.cleanupOldTranscripts();
}, 24 * 60 * 60 * 1000);

// Login
client.login(config.bot.token);
