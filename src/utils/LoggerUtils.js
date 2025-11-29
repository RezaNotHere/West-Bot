const { EmbedBuilder, WebhookClient } = require('discord.js');

class LoggerUtils {
    constructor(config) {
        this.webhookClient = config.errorWebhookUrl ? new WebhookClient({ url: config.errorWebhookUrl }) : null;
        this.debug = !!config.debug;
        this.logChannelId = config.logChannelId || null;
        this.client = null; // Will be set after client is ready
        
        // Color mapping for Discord embeds based on urgency/severity
        this.urgencyColors = {
            low: 0x3498db,       // Blue - Low urgency (info, debug)
            medium: 0xf1c40f,    // Yellow - Medium urgency (warnings)
            high: 0xe67e22,       // Orange - High urgency (security, important)
            critical: 0xe74c3c   // Red - Critical urgency (errors, critical security)
        };
        
        // Legacy color mapping for backward compatibility
        this.colors = {
            info: 0x3498db,      // Blue - General information
            success: 0x2ecc71,   // Green - Successful operations
            warn: 0xf1c40f,      // Yellow - Warnings
            error: 0xe74c3c,     // Red - Errors
            debug: 0x8e44ad,     // Purple - Debug info
            security: 0xe67e22,  // Orange - Security events
            moderation: 0x9b59b6 // Purple - Moderation actions
        };
        
        // Default urgency mapping for log levels
        this.levelUrgency = {
            info: 'low',
            success: 'low',
            warn: 'medium',
            error: 'critical',
            debug: 'low',
            security: 'high',
            moderation: 'medium'
        };
    }

    /**
     * Set Discord client for logging to channels
     */
    setClient(client) {
        this.client = client;
    }

    /**
     * Send embed to log channel and webhook
     */
    async sendEmbed(embed, level = 'info') {
        // Always send to log channel
        if (this.client && this.logChannelId) {
            try {
                const logChannel = this.client.channels.cache.get(this.logChannelId);
                if (logChannel && logChannel.isTextBased()) {
                    await logChannel.send({ embeds: [embed] });
                }
            } catch (err) {
                if (err.code !== 'ECONNRESET' && err.code !== 'ETIMEDOUT') {
                    console.error('[Logger] Channel error:', err.message);
                }
            }
        }
        // Only send to webhook for error/security
        if (this.webhookClient && (level === 'error' || level === 'security')) {
            try {
                await this.webhookClient.send({ embeds: [embed] });
            } catch (err) {
                if (err.code !== 'ECONNRESET' && err.code !== 'ETIMEDOUT' && err.code !== 'ENOTFOUND') {
                    console.error('[Logger] Webhook error:', err.message);
                }
            }
        }
    }

    /**
     * Get color based on urgency level
     */
    getColorByUrgency(urgency) {
        return this.urgencyColors[urgency] || this.urgencyColors.low;
    }

    /**
     * Build base embed with color and timestamp
     */
    buildBaseEmbed(level, title, description = '', urgency = null) {
        // Use urgency if provided, otherwise use level-based urgency
        const finalUrgency = urgency || this.levelUrgency[level] || 'low';
        const color = this.getColorByUrgency(finalUrgency);
        
        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle(title)
            .setTimestamp();
        
        if (description) {
            embed.setDescription(description);
        }
        // Set color based on log level for clarity
        if (this.colors[level]) {
            embed.setColor(this.colors[level]);
        }
        
        return embed;
    }

    /**
     * Add fields to embed from object
     */
    addFieldsToEmbed(embed, fields = {}) {
        Object.entries(fields).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                const stringValue = typeof value === 'string' 
                    ? value 
                    : '```json\n' + JSON.stringify(value, null, 2) + '\n```';
                
                // Split long values
                if (stringValue.length > 1024) {
                    const chunks = stringValue.match(/.{1,1024}/g) || [];
                    chunks.forEach((chunk, index) => {
                        embed.addFields({ 
                            name: index === 0 ? key : `\u200b`, 
                            value: chunk, 
                            inline: false 
                        });
                    });
                } else {
                    embed.addFields({ name: key, value: stringValue, inline: false });
                }
            }
        });
    }

    /**
     * Log general information
     */
    async logInfo(subject, fields = {}, context = '', urgency = 'low') {
        const embed = this.buildBaseEmbed('info', `ℹ️ Info${context ? ' - ' + context : ''}`, '', urgency);
        this.addFieldsToEmbed(embed, fields);
        await this.sendEmbed(embed, 'info');
        console.log(`[INFO] ${subject}`, Object.keys(fields).length > 0 ? fields : '');
    }

    /**
     * Log successful operations
     */
    async logSuccess(subject, fields = {}, context = '', urgency = 'low') {
        const embed = this.buildBaseEmbed('success', `✅ Success${context ? ' - ' + context : ''}`, '', urgency);
        this.addFieldsToEmbed(embed, fields);
        await this.sendEmbed(embed, 'success');
        console.log(`[SUCCESS] ${subject}`, Object.keys(fields).length > 0 ? fields : '');
    }

    /**
     * Log warnings
     */
    async logWarn(subject, fields = {}, context = '', urgency = 'medium') {
        const embed = this.buildBaseEmbed('warn', `⚠️ Warning${context ? ' - ' + context : ''}`, '', urgency);
        this.addFieldsToEmbed(embed, fields);
        await this.sendEmbed(embed, 'warn');
        console.warn(`[WARN] ${subject}`, Object.keys(fields).length > 0 ? fields : '');
    }

    /**
     * Log errors
     */
    async logError(error, context = '', fields = {}, urgency = 'critical') {
        const errorMessage = error?.message || error?.toString() || 'Unknown error';
        const errorName = error?.name || 'Error';
        
        const embed = this.buildBaseEmbed('error', `❌ Error${context ? ' - ' + context : ''}`, '', urgency);
        embed.setDescription(`**${errorName}**\n\`\`\`\n${errorMessage}\n\`\`\``);
        
        this.addFieldsToEmbed(embed, fields);
        
        if (error?.stack) {
            const stackTrace = error.stack.substring(0, 2000);
            embed.addFields({ 
                name: 'Stack Trace', 
                value: `\`\`\`\n${stackTrace}\n\`\`\``,
                inline: false 
            });
        }
        
        await this.sendEmbed(embed, 'error');
        console.error(`[ERROR] [${context}]`, error, Object.keys(fields).length > 0 ? fields : '');
    }

    /**
     * Log debug information (only if debug mode enabled)
     */
    async logDebug(subject, fields = {}, context = '', urgency = 'low') {
        if (!this.debug) return;
        
        const embed = this.buildBaseEmbed('debug', `🐞 Debug${context ? ' - ' + context : ''}`, '', urgency);
        this.addFieldsToEmbed(embed, fields);
        await this.sendEmbed(embed, 'debug');
        console.debug(`[DEBUG] ${subject}`, Object.keys(fields).length > 0 ? fields : '');
    }

    /**
     * Log security events
     */
    async logSecurity(eventType, subject, fields = {}, severity = 'medium') {
        const severityEmoji = {
            low: '🔵',
            medium: '🟡',
            high: '🟠',
            critical: '🔴'
        };
        
        // Map severity to urgency for color
        const severityToUrgency = {
            low: 'low',
            medium: 'medium',
            high: 'high',
            critical: 'critical'
        };
        const urgency = severityToUrgency[severity] || 'medium';
        
        const embed = this.buildBaseEmbed('security', 
            `${severityEmoji[severity] || '🛡️'} Security Event - ${eventType}`, '', urgency);
        this.addFieldsToEmbed(embed, { Subject: subject, ...fields });
        embed.addFields({ name: 'Severity', value: severity.toUpperCase(), inline: true });
        
        await this.sendEmbed(embed, 'security');
        console.warn(`[SECURITY] [${severity.toUpperCase()}] ${eventType}: ${subject}`, fields);
    }

    /**
     * Log moderation actions
     */
    async logModeration(action, moderator, target, fields = {}, urgency = 'medium') {
        const embed = this.buildBaseEmbed('moderation', `⚖️ Moderation - ${action}`, '', urgency);
        this.addFieldsToEmbed(embed, {
            Moderator: `${moderator.tag} (${moderator.id})`,
            Target: `${target.tag} (${target.id})`,
            ...fields
        });
        
        await this.sendEmbed(embed, 'moderation');
        console.log(`[MODERATION] ${action} by ${moderator.tag} on ${target.tag}`, fields);
    }

    /**
     * Log command execution
     */
    async logCommand(interaction, additionalData = {}) {
        const commandType = interaction.isChatInputCommand() ? 'Slash Command' :
                           interaction.isButton() ? 'Button' :
                           interaction.isStringSelectMenu() ? 'Select Menu' :
                           interaction.isModalSubmit() ? 'Modal' :
                           'Unknown';
        
        const commandName = interaction.commandName || interaction.customId || 'N/A';
        
        const fields = {
            User: `${interaction.user.tag} (${interaction.user.id})`,
            Command: commandName,
            Type: commandType,
            Channel: interaction.channel ? `${interaction.channel.name} (${interaction.channel.id})` : 'N/A',
            Guild: interaction.guild ? `${interaction.guild.name} (${interaction.guild.id})` : 'N/A',
            ...additionalData
        };
        
        await this.logInfo('Command Executed', fields, commandType);
    }

    /**
     * Log ticket operations
     */
    async logTicket(action, user, ticketInfo = {}) {
        const fields = {
            User: `${user.tag} (${user.id})`,
            ...ticketInfo
        };
        
        await this.logInfo(`Ticket ${action}`, fields, 'Ticket System');
    }

    /**
     * Log giveaway operations
     */
    async logGiveaway(action, fields = {}) {
        await this.logInfo(`Giveaway ${action}`, fields, 'Giveaway System');
    }

    /**
     * Log shop operations
     */
    async logShop(action, user, fields = {}) {
        const shopFields = {
            User: `${user.tag} (${user.id})`,
            ...fields
        };
        
        await this.logInfo(`Shop ${action}`, shopFields, 'Shop System');
    }
}

module.exports = LoggerUtils;
