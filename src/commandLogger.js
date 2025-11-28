// commandLogger.js - Comprehensive command logging system
const { EmbedBuilder } = require('discord.js');
const config = require('../configManager');

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

            const embed = new EmbedBuilder()
                .setColor('#3498db')
                .setTitle('📝  Bot Log')
                .setTimestamp();

            // User info
            embed.addFields({
                name: '👤 User',
                value: `${interaction.user.tag} (<@${interaction.user.id}>)`,
                inline: true
            });

            // Command type
            let commandType = 'Unknown';
            let commandName = 'N/A';

            if (interaction.isChatInputCommand()) {
                commandType = 'Slash Command';
                commandName = `/${interaction.commandName}`;
                
                // Add subcommand if exists
                try {
                    const subcommand = interaction.options.getSubcommand(false);
                    if (subcommand) {
                        commandName += ` ${subcommand}`;
                    }
                } catch {}
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

            embed.addFields({
                name: '⚙️ Type',
                value: commandType,
                inline: true
            });

            embed.addFields({
                name: '📌 Command/Action',
                value: `\`${commandName}\``,
                inline: true
            });

            // Channel info
            if (interaction.channel) {
                embed.addFields({
                name: '💬 Channel',
                value: `${interaction.channel.name} (<#${interaction.channel.id}>)`,
                inline: false
                });
            }

            // Command options/values
            if (interaction.isChatInputCommand()) {
                const options = [];
                interaction.options.data.forEach(option => {
                    let value = option.value;
                    
                    // Format different types
                    if (option.type === 6) { // User
                        value = `<@${value}>`;
                    } else if (option.type === 7) { // Channel
                        value = `<#${value}>`;
                    } else if (option.type === 8) { // Role
                        value = `<@&${value}>`;
                    } else if (typeof value === 'string' && value.length > 100) {
                        value = value.substring(0, 97) + '...';
                    }
                    
                    options.push(`**${option.name}:** ${value}`);
                });

                if (options.length > 0) {
                    embed.addFields({
                        name: '📋 Parameters',
                        value: options.join('\n'),
                        inline: false
                    });
                }
            } else if (interaction.isButton() || interaction.isStringSelectMenu()) {
                // For buttons/menus, show selected values
                if (interaction.values && interaction.values.length > 0) {
                    embed.addFields({
                        name: '✅ Selected',
                        value: interaction.values.join(', '),
                        inline: false
                    });
                }
            }

            // Additional custom data
            if (Object.keys(additionalData).length > 0) {
                const dataFields = [];
                for (const [key, value] of Object.entries(additionalData)) {
                    if (value !== null && value !== undefined) {
                        dataFields.push(`**${key}:** ${value}`);
                    }
                }
                
                if (dataFields.length > 0) {
                    embed.addFields({
                        name: '📊 Additional Info',
                        value: dataFields.join('\n'),
                        inline: false
                    });
                }
            }

            // Send log
            await logChannel.send({ embeds: [embed] });

        } catch (error) {
            console.error('Error logging command:', error);
        }
    }

    /**
     * Log command errors
     */
    async logError(interaction, error, context = '') {
        if (!this.logChannelId) return;

        try {
            const guild = interaction.guild;
            if (!guild) return;

            const logChannel = guild.channels.cache.get(this.logChannelId);
            if (!logChannel || !logChannel.isTextBased()) return;

            const embed = new EmbedBuilder()
                .setColor('#e74c3c')
                .setTitle('❌ Command Execution Error')
                .setTimestamp();

            embed.addFields({
                name: '👤 User',
                value: `${interaction.user.tag} (<@${interaction.user.id}>)`,
                inline: true
            });

            let commandName = 'N/A';
            if (interaction.isChatInputCommand()) {
                commandName = `/${interaction.commandName}`;
            } else if (interaction.isButton()) {
                commandName = `Button: ${interaction.customId}`;
            } else if (interaction.isStringSelectMenu()) {
                commandName = `Menu: ${interaction.customId}`;
            }

            embed.addFields({
                name: '📌 Command',
                value: `\`${commandName}\``,
                inline: true
            });

            if (context) {
                embed.addFields({
                name: '📍 Error Location',
                value: context,
                inline: false
                });
            }

            const errorMessage = error.message || error.toString();
            embed.addFields({
                name: '⚠️ Error Message',
                value: `\`\`\`${errorMessage.substring(0, 1000)}\`\`\``,
                inline: false
            });

            await logChannel.send({ embeds: [embed] });

        } catch (logError) {
            console.error('Error logging error:', logError);
        }
    }
}

module.exports = new CommandLogger();
