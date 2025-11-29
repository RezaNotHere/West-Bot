// commandLogger.js - Comprehensive command logging system
const { EmbedBuilder } = require('discord.js');
const LoggerUtils = require("./utils/LoggerUtils");
const config = require('../configManager');
const logger = new LoggerUtils({ errorWebhookUrl: config.channels.errorWebhook, debug: config.server.debug });

class CommandLogger {
    constructor() {
        this.logChannelId = config.channels.log;
    }

    /**
     * Log any command or interaction with full details
     */
    async logCommand(interaction, additionalData = {}) {
        if (!this.logChannelId) return;
        try {
            const guild = interaction.guild;
            if (!guild) return;
            const logChannel = guild.channels.cache.get(this.logChannelId);
            if (!logChannel || !logChannel.isTextBased()) return;
            // Status-aware color (info for normal, warn for slow, error for failed)
            let logLevel = 'info';
            let commandType = 'Unknown';
            let commandName = 'N/A';
            if (interaction.isChatInputCommand()) {
                commandType = 'Slash Command';
                commandName = `/${interaction.commandName}`;
            } else if (interaction.isButton()) {
                commandType = 'Button';
                commandName = interaction.customId;
            } else if (interaction.isStringSelectMenu()) {
                commandType = 'Select Menu';
                commandName = interaction.customId;
            } else if (interaction.isModalSubmit()) {
                commandType = 'Modal Submit';
                commandName = interaction.customId;
            } else if (interaction.isAutocomplete()) {
                commandType = 'Autocomplete';
                commandName = interaction.commandName;
            }
            const fields = {
                User: `${interaction.user.tag} (<@${interaction.user.id}>)`,
                Channel: interaction.channel ? `${interaction.channel.name} (<#${interaction.channel.id}>)` : 'N/A',
                Guild: guild ? `${guild.name} (${guild.id})` : 'N/A',
                Command: `\`${commandName}\` (${commandType})`,
                ...(Object.keys(additionalData || {}).length > 0 ? additionalData : {})
            };
            // Default logInfo for normal commands
            await logger.logInfo('Command invocation', fields, commandType);
            await logChannel.send({ embeds: [logger.buildBaseEmbed('info', '📝 Command Executed').addFields(
                Object.entries(fields).map(([k, v]) => ({ name: k, value: v.toString() }))
            )] });
        } catch (error) {
            logger.logError(error, 'logCommand failed');
        }
    }

    /**
     * Log command errors
     */
    async logError(interaction, error, context = "") {
        if (!this.logChannelId) return;
        try {
            const guild = interaction.guild;
            if (!guild) return;
            const logChannel = guild.channels.cache.get(this.logChannelId);
            if (!logChannel || !logChannel.isTextBased()) return;
            const fields = {
                User: `${interaction.user.tag} (<@${interaction.user.id}>)`,
                Channel: interaction.channel ? `${interaction.channel.name} (<#${interaction.channel.id}>)` : 'N/A',
                Guild: guild ? `${guild.name} (${guild.id})` : 'N/A',
                Command: interaction.commandName || interaction.customId || 'N/A',
                Error: error.message || error.toString()
            };
            if (context) fields.Context = context;
            await logger.logError(error, context, fields);
            await logChannel.send({ embeds: [logger.buildBaseEmbed('error', '❌ Command Error').addFields(
                Object.entries(fields).map(([k, v]) => ({ name: k, value: v.toString() }))
            )] });
        } catch (err) {
            logger.logError(err, 'logError (commandLogger)');
        }
    }
}

module.exports = CommandLogger;
