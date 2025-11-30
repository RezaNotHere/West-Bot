// index.js
// 🔧 All configuration is now in config.json (loaded via configManager.js) - NO .env file needed!
console.log('[DEBUG] index.js started');
const { Client, GatewayIntentBits, Partials, Events, ActivityType } = require('discord.js');
const config = require('./configManager');
const { db, dbManager } = require('./src/database');
const utils = require('./src/utils');
const commands = require('./src/commands');
const events = require('./src/events');
const handlers = require('./src/handlers');
const LoggerUtils = require('./src/utils/LoggerUtils');
const EnhancedSecurityManager = require('./src/security/EnhancedSecurityManager');
const OptimizedSecurityManager = require('./src/security/OptimizedSecurityManager');
const commandLogger = require('./src/commandLogger');

// ✅ Validate configuration before starting
config.validateConfig();

// Initialize Logger
const logger = new LoggerUtils({
    errorWebhookUrl: config.channels.errorWebhook,
    logChannelId: config.channels.log,
    debug: config.server.environment !== 'production'
});

// Initialize optimized security manager
const securityManager = new OptimizedSecurityManager({
    adminIds: config.security?.adminIds || []
});
console.log('🛡️ Security System Initialized');

// Print configuration (only in debug mode)
if (config.server.debug) {
    config.printConfig();
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
commands.setSecurity(securityManager);
handlers.setLogger(logger);
handlers.setSecurity(securityManager);
handlers.setConfig(config);
events.setLogger(logger);

const commandLogger_ins = new (require('./src/commandLogger'))();

// Event: Ready
client.once(Events.ClientReady, async () => {
    console.log(`✨ Logged in as ${client.user.tag}`);
    console.log(`🤖 Bot is ready!`);
    
    // Set client for logger to enable channel logging
    logger.setClient(client);
    
    // Set client for utils and start giveaway checker
    const utils = require('./src/utils');
    utils.setClient(client);
    utils.checkGiveaways();
    
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
        // Enhanced security check
        const securityCheck = await securityManager.checkInteractionSecurity(interaction);
        if (!securityCheck.allowed) {
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ 
                    content: securityCheck.message || 'Access denied',
                    flags: MessageFlags.Ephemeral
                });
            } else {
                await InteractionUtils.sendError(interaction, securityCheck.message || 'Access denied', false);
            }
            return;
        }

        // Handle different interaction types
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
        // Security checks
        if (security) {
            const securityCheck = await security.checkMessage(message);
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
        if (security) {
            const securityCheck = await security.checkMemberJoin(member);
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
