// index.js
// 🔧 All configuration is now in config.json (loaded via configManager.js) - NO .env file needed!
const { Client, GatewayIntentBits, Events, ActivityType, EmbedBuilder, Partials } = require('discord.js');
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
} catch (error) {
    console.warn('Security modules not found:', error.message);
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

const commandLogger_ins = new (require('./src/commandLogger'))();

// Event: Ready
client.once(Events.ClientReady, async () => {
    // 🚫 Prevent duplicate startup screens
    if (global.startupExecuted) {
        console.log('🔄 Startup already executed, skipping...');
        return;
    }
    global.startupExecuted = true;
    
    // 🧹 Clear console only once
    console.clear();
    
    // 🎨 ASCII Art Banner
    const banner = `
╔══════════════════════════════════════════════════════════════╗
║                        🤖 WEST BOT IS READY! 🤖                ║
║                                                                  ║
║  ╔══════════════════════════════════════════════════════════╗  ║
║  │  ██╗    ██╗██╗  ██╗ █████╗ ████████╗██╗ ██████╗ ███╗   ██╗ │  ║
║  │  ██║    ██║██║  ██║██╔══██╗╚══██╔══╝██║██╔═══██╗████╗  ██║ │  ║
║  │  ██║ █╗ ██║███████║███████║   ██║   ██║██║   ██║██╔██╗ ██║ │  ║
║  │  ██║███╗██║██╔══██║██╔══██║   ██║   ██║██║   ██║██║╚██╗██║ │  ║
║  │  ╚███╔███╔╝██║  ██║██║  ██║   ██║   ██║╚██████╔╝██║ ╚████║ │  ║
║  │   ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝   ╚═╝ ╚═════╝ ╚═╝  ╚═══╝ │  ║
║  ╚══════════════════════════════════════════════════════════╝  ║
║                                                                  ║
║  🌟 Advanced Discord Bot with Professional Features              ║
║  🚀 Version 2.0 • Enhanced Support System                      ║
╚══════════════════════════════════════════════════════════════╝
`;

    // 🎯 Animated Startup Sequence
    const startupSteps = [
        { emoji: '🔧', text: 'Initializing Core Systems...', color: '\x1b[36m' },
        { emoji: '📊', text: 'Loading Database...', color: '\x1b[33m' },
        { emoji: '🛡️', text: 'Configuring Security...', color: '\x1b[35m' },
        { emoji: '🎫', text: 'Setting Up Ticket System...', color: '\x1b[34m' },
        { emoji: '🎮', text: 'Initializing Game Systems...', color: '\x1b[32m' },
        { emoji: '🔍', text: 'Starting Auto-Moderation...', color: '\x1b[31m' },
        { emoji: '📝', text: 'Loading Command Handlers...', color: '\x1b[37m' },
        { emoji: '✨', text: 'Finalizing Setup...', color: '\x1b[90m' }
    ];

    // 🎨 Display Banner
    console.log('\x1b[94m' + banner + '\x1b[0m');

    // 🚀 Animated Loading
    for (let i = 0; i < startupSteps.length; i++) {
        const step = startupSteps[i];
        const progress = Math.round(((i + 1) / startupSteps.length) * 100);
        const bar = '█'.repeat(Math.floor(progress / 5)) + '░'.repeat(20 - Math.floor(progress / 5));
        
        process.stdout.write('\r' + ' '.repeat(50));
        console.log(`${step.color}┌─ ${step.emoji} ${step.text}`);
        console.log(`│  Progress: [${bar}] ${progress}%`);
        console.log(`└─ Status: ${step.emoji} Loading...\x1b[0m`);
        
        await new Promise(resolve => setTimeout(resolve, 300));
    }

    // 🎉 Success Animation
    console.log('\n\x1b[92m╔══════════════════════════════════════════════════════════════╗');
    console.log('║                    🎉 BOT SUCCESSFULLY LOADED! 🎉                     ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\x1b[0m');

    // 📊 Bot Information Display
    const botInfo = [
        { label: '🤖 Bot Name', value: client.user.tag },
        { label: '🆔 Client ID', value: client.user.id },
        { label: '🌐 Guilds', value: `${client.guilds.cache.size} servers` },
        { label: '👥 Users', value: `${client.users.cache.size} total users` },
        { label: '📚 Commands', value: '45+ slash commands' },
        { label: '🔧 Features', value: 'Advanced moderation & support' }
    ];

    console.log('\n\x1b[96m┌─ 📊 BOT STATISTICS ────────────────────────────────────┐');
    botInfo.forEach(info => {
        const padding = ' '.repeat(20 - info.label.length);
        console.log(`│ ${info.label}${padding}│ ${info.value}`);
    });
    console.log('└─────────────────────────────────────────────────────┘\x1b[0m');

    // 🎯 Active Features Display
    const features = [
        '🛡️ Advanced Auto-Moderation',
        '🎫 Smart Support Ticket System', 
        '🚀 Auto-Ban Detection',
        '📊 Analytics Dashboard',
        '🎮 Game Integration',
        '💳 Account Shop System',
        '🎁 Giveaway Manager',
        '🔐 Security Protection'
    ];

    console.log('\n\x1b[93m🌟 ACTIVE FEATURES:');
    features.forEach((feature, index) => {
        setTimeout(() => {
            console.log(`   ${index + 1}. ${feature}`);
        }, index * 100);
    });

    // 🎨 Final Ready Message with Effects
    setTimeout(() => {
        console.log('\n\x1b[95m╔══════════════════════════════════════════════════════════════╗');
        console.log(`║  🚀 ${client.user.tag} is now ONLINE and ready to serve! 🚀          ║`);
        console.log('║  💫 Advanced systems activated • All modules operational      ║');
        console.log('╚══════════════════════════════════════════════════════════════╝\x1b[0m');
        console.log('\n⏰ Ready at: ' + new Date().toLocaleString());
        console.log('🌟 Status: All systems operational • Ready for commands!\n');
    }, features.length * 100 + 500);

    // 🎯 Set bot status with rotating messages
    const statuses = [
        { name: '🎫 Managing Support Tickets', type: ActivityType.Watching },
        { name: '🛡️ Protecting the Server', type: ActivityType.Watching },
        { name: '📊 Analyzing Data', type: ActivityType.Watching },
        { name: '/help for commands', type: ActivityType.Playing },
        { name: '🚀 Advanced Moderation', type: ActivityType.Competing }
    ];

    let statusIndex = 0;
    setInterval(() => {
        client.user.setActivity(statuses[statusIndex]);
        statusIndex = (statusIndex + 1) % statuses.length;
    }, 30000); // Change status every 30 seconds

    // Initial status
    client.user.setActivity(statuses[0]);

    // 🎊 Send startup notification to a designated channel (if configured)
    try {
        const config = require('./configManager');
        const logChannelId = config.channels?.startup;
        if (logChannelId) {
            const logChannel = client.channels.cache.get(logChannelId);
            if (logChannel && logChannel.isTextBased()) {
                const startupEmbed = new EmbedBuilder()
                    .setColor('Green')
                    .setTitle('🚀 Bot Startup Complete')
                    .setDescription(`${client.user.tag} has successfully come online!`)
                    .addFields(
                        { name: '🌐 Guilds', value: `${client.guilds.cache.size}`, inline: true },
                        { name: '👥 Total Users', value: `${client.users.cache.size}`, inline: true },
                        { name: '⏰ Startup Time', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
                        { name: '🔧 Active Features', value: 'Auto-Moderation, Support System, Analytics', inline: false }
                    )
                    .setThumbnail(client.user.displayAvatarURL())
                    .setFooter({ text: 'All systems operational and ready!' })
                    .setTimestamp();

                await logChannel.send({ embeds: [startupEmbed] });
            }
        }
    } catch (error) {
        // Silent error handling for startup notification
    }

    // Set client for logger to enable channel logging
    logger.setClient(client);
    
    // Set client for utils and start giveaway checker
    const utils = require('./src/utils');
    utils.setClient(client);
    utils.checkGiveaways();

    // 🚀 Auto-update slash commands on startup
    console.log('\x1b[96m🔄 Updating slash commands...');
    try {
        await utils.registerCommands(config.bot.clientId, config.bot.guildId, config.bot.token);
        console.log('\x1b[92m✅ Slash commands updated successfully!\x1b[0m');
    } catch (error) {
        console.log('\x1b[91m❌ Error updating slash commands:', error.message, '\x1b[0m');
    }

    // 🔄 Auto-update commands every 24 hours
    setInterval(async () => {
        console.log('\x1b[96m🔄 [AUTO] Updating slash commands (24h check)...');
        try {
            await utils.registerCommands(config.bot.clientId, config.bot.guildId, config.bot.token);
            console.log('\x1b[92m✅ [AUTO] Slash commands updated successfully!\x1b[0m');
        } catch (error) {
            console.log('\x1b[91m❌ [AUTO] Error updating slash commands:', error.message, '\x1b[0m');
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
