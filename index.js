// index.js
// 🔧 All configuration is now in config.json (loaded via configManager.js) - NO .env file needed!
const { Client, GatewayIntentBits, Partials, Events } = require('discord.js');
const config = require('./configManager');
const db = require('./src/database');
const utils = require('./src/utils');
const commands = require('./src/commands');
const events = require('./src/events');
const handlers = require('./src/handlers');
const LoggerUtils = require('./src/utils/LoggerUtils');
const SecurityManager = require('./src/security/SecurityManager');
const commandLogger = require('./src/commandLogger');

// ✅ Validate configuration before starting
config.validateConfig();

// Initialize Logger
const logger = new LoggerUtils({
    errorWebhookUrl: config.channels.errorWebhook,
    debug: config.server.environment !== 'production'
});

// Initialize Security System
const security = new SecurityManager({
    adminIds: []
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

// Set logger and security for commands and handlers
commands.setLogger(logger);
commands.setSecurity(security);
handlers.setLogger(logger);
handlers.setSecurity(security);
handlers.setConfig(config);

const commandLogger_ins = new (require('./src/commandLogger'))(client, logger);

// Event: Ready
client.once(Events.ClientReady, () => {
    console.log(`✨ Logged in as ${client.user.tag}`);
    console.log(`🤖 Bot is ready!`);
    
    // Update bot status
    updateBotStatus();
    // Update status every hour
    setInterval(updateBotStatus, 3600000);
});

function updateBotStatus() {
    const activities = config.bot.status.activities || [];
    if (activities.length > 0) {
        const activity = activities[Math.floor(Math.random() * activities.length)];
        client.user.setActivity(activity.text, { type: activity.type });
    }
}

// Event: Interaction (Slash Commands)
client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isCommand()) {
        await commands.handleSlashCommand(interaction);
        commandLogger_ins.logCommand(interaction);
    } else if (interaction.isStringSelectMenu()) {
        await handlers.handleSelectMenu(interaction);
    } else if (interaction.isButton()) {
        await handlers.handleButton(interaction);
    } else if (interaction.isModalSubmit()) {
        await handlers.handleModal(interaction);
    }
});

// Event: Message Create
client.on(Events.MessageCreate, async (message) => {
    // Ignore bot messages
    if (message.author.bot) return;
    
    // Handle text commands with prefix
    if (message.content.startsWith(config.bot.prefix)) {
        const args = message.content.slice(config.bot.prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();
        await commands.handleTextCommand(message, commandName, args);
    }
    
    // Security checks
    if (security) {
        await security.checkMessageSpam(message);
    }
});

// Event: Guild Member Add
client.on(Events.GuildMemberAdd, async (member) => {
    await events.onMemberJoin(member);
});

// Event: Guild Member Remove
client.on(Events.GuildMemberRemove, async (member) => {
    await events.onMemberLeave(member);
});

// Event: Guild Ban Add
client.on(Events.GuildBanAdd, async (ban) => {
    await events.onGuildBanAdd(ban);
});

// Event: Message Delete
client.on(Events.MessageDelete, async (message) => {
    await events.onMessageDelete(message);
});

// Error Handling
client.on('error', error => {
    console.error('Client error:', error);
    logger.logError('Client Error', error);
});

process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
    logger.logError('Unhandled Rejection', error);
});

// Login
client.login(config.bot.token);
