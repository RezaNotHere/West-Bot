/**
 * Security Management Commands
 * Commands for managing the enhanced security system
 */

const { EmbedBuilder, MessageFlags } = require('discord.js');
const InteractionUtils = require('../utils/InteractionUtils');

class SecurityCommands {
    constructor(securityManager, logger) {
        this.securityManager = securityManager;
        this.logger = logger;
    }

    /**
     * Handle /security command
     */
    async handleSecurityCommand(interaction) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'status':
                return await this.handleStatus(interaction);
            case 'blacklist':
                return await this.handleBlacklist(interaction);
            case 'whitelist':
                return await this.handleWhitelist(interaction);
            case 'emergency':
                return await this.handleEmergency(interaction);
            case 'report':
                return await this.handleReport(interaction);
            case 'reset':
                return await this.handleReset(interaction);
            default:
                return await InteractionUtils.sendError(interaction, 'Unknown subcommand', true);
        }
    }

    /**
     * Handle security status
     */
    async handleStatus(interaction) {
        const stats = this.securityManager.getStats();
        const uptime = Math.floor(stats.uptime / 1000 / 60); // minutes

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('🛡️ Security System Status')
            .addFields(
                { 
                    name: '📊 Statistics', 
                    value: `**Total Requests:** ${stats.totalRequests}\n**Blocked:** ${stats.blockedRequests} (${stats.blockRate}%)\n**Spam Detected:** ${stats.spamDetected}\n**Rate Limited:** ${stats.rateLimitBlocks}`,
                    inline: true
                },
                { 
                    name: '🚫 Blacklist', 
                    value: `**Users:** ${stats.blacklistSize.users}\n**Guilds:** ${stats.blacklistSize.guilds}\n**IPs:** ${stats.blacklistSize.ips}`,
                    inline: true
                },
                { 
                    name: '✅ Whitelist', 
                    value: `**Users:** ${stats.whitelistSize.users}\n**Guilds:** ${stats.whitelistSize.guilds}\n**Roles:** ${stats.whitelistSize.roles}`,
                    inline: true
                },
                { 
                    name: '⚡ Performance', 
                    value: `**Uptime:** ${uptime} minutes\n**Requests/min:** ${stats.requestsPerMinute}`,
                    inline: true
                },
                { 
                    name: '🚨 Emergency Mode', 
                    value: stats.emergencyMode ? '🔴 **ACTIVE**' : '🟢 **INACTIVE**',
                    inline: true
                }
            )
            .setFooter({ text: 'Security System Report' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    /**
     * Handle blacklist management
     */
    async handleBlacklist(interaction) {
        const action = interaction.options.getString('action');
        const type = interaction.options.getString('type');
        const id = interaction.options.getString('id');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        if (!interaction.member.permissions.has('Administrator')) {
            return await InteractionUtils.sendError(interaction, 'Administrator permission required', true);
        }

        let success = false;
        let message = '';

        switch (action) {
            case 'add':
                success = this.securityManager.addToBlacklist(type, id, reason);
                message = success ? `Added ${type} \`${id}\` to blacklist` : 'Failed to add to blacklist';
                break;
            case 'remove':
                success = this.securityManager.removeFromBlacklist(type, id);
                message = success ? `Removed ${type} \`${id}\` from blacklist` : 'Failed to remove from blacklist';
                break;
            case 'list':
                const blacklist = this.securityManager.blacklist[type];
                const list = Array.from(blacklist).slice(0, 20); // Limit to 20
                message = list.length ? list.join('\n') : 'No entries in blacklist';
                
                const embed = new EmbedBuilder()
                    .setColor('#ff6b6b')
                    .setTitle(`🚫 ${type.charAt(0).toUpperCase() + type.slice(1)} Blacklist`)
                    .setDescription(`\`\`\`\n${message}\n\`\`\``)
                    .setFooter({ text: `Total: ${blacklist.size} entries` });
                
                return await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        if (success) {
            await InteractionUtils.sendSuccess(interaction, message);
        } else {
            await InteractionUtils.sendError(interaction, message, true);
        }
    }

    /**
     * Handle whitelist management
     */
    async handleWhitelist(interaction) {
        const action = interaction.options.getString('action');
        const type = interaction.options.getString('type');
        const id = interaction.options.getString('id');

        if (!interaction.member.permissions.has('Administrator')) {
            return await InteractionUtils.sendError(interaction, 'Administrator permission required', true);
        }

        let success = false;
        let message = '';

        switch (action) {
            case 'add':
                success = this.securityManager.addToWhitelist(type, id);
                message = success ? `Added ${type} \`${id}\` to whitelist` : 'Failed to add to whitelist';
                break;
            case 'remove':
                success = this.securityManager.removeFromWhitelist(type, id);
                message = success ? `Removed ${type} \`${id}\` from whitelist` : 'Failed to remove from whitelist';
                break;
            case 'list':
                const whitelist = this.securityManager.whitelist[type];
                const list = Array.from(whitelist).slice(0, 20);
                message = list.length ? list.join('\n') : 'No entries in whitelist';
                
                const embed = new EmbedBuilder()
                    .setColor('#51cf66')
                    .setTitle(`✅ ${type.charAt(0).toUpperCase() + type.slice(1)} Whitelist`)
                    .setDescription(`\`\`\`\n${message}\n\`\`\``)
                    .setFooter({ text: `Total: ${whitelist.size} entries` });
                
                return await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        if (success) {
            await InteractionUtils.sendSuccess(interaction, message);
        } else {
            await InteractionUtils.sendError(interaction, message, true);
        }
    }

    /**
     * Handle emergency mode
     */
    async handleEmergency(interaction) {
        const action = interaction.options.getString('action');
        const reason = interaction.options.getString('reason') || 'Manual activation';

        if (!interaction.member.permissions.has('Administrator')) {
            return await InteractionUtils.sendError(interaction, 'Administrator permission required', true);
        }

        const currentState = this.securityManager.config.emergencyMode;

        if (action === 'toggle') {
            const newState = !currentState;
            this.securityManager.toggleEmergencyMode(newState, reason);
            
            const embed = new EmbedBuilder()
                .setColor(newState ? '#ff6b6b' : '#51cf66')
                .setTitle(`🚨 Emergency Mode ${newState ? 'ACTIVATED' : 'DEACTIVATED'}`)
                .setDescription(newState 
                    ? 'All security systems are now on high alert. Only admins can use commands.'
                    : 'Security systems returned to normal operation.')
                .addFields({ name: 'Reason', value: reason })
                .setFooter({ text: 'Emergency Mode Control' })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } else {
            const status = currentState ? '🔴 **ACTIVE**' : '🟢 **INACTIVE**';
            await InteractionUtils.sendSuccess(interaction, `Emergency mode is currently ${status}`);
        }
    }

    /**
     * Handle security report
     */
    async handleReport(interaction) {
        const period = interaction.options.getString('period') || '24h';
        
        if (!interaction.member.permissions.has('Administrator')) {
            return await InteractionUtils.sendError(interaction, 'Administrator permission required', true);
        }

        const report = this.securityManager.getSecurityReport();
        const recentEvents = this.securityManager.getRecentEvents(10);

        const embed = new EmbedBuilder()
            .setColor('#9b59b6')
            .setTitle('📊 Security Report')
            .setDescription(`**Period:** ${report.period}\n**Total Events:** ${report.totalEvents}`)
            .addFields(
                { 
                    name: '🔍 Event Types', 
                    value: Object.entries(report.eventsByType)
                        .map(([type, count]) => `**${type}:** ${count}`)
                        .join('\n') || 'No events recorded',
                    inline: true
                },
                { 
                    name: '⚠️ Top Violators', 
                    value: report.topViolators.length
                        ? report.topViolators.slice(0, 5)
                            .map(v => `<@${v.userId}>: ${v.violations}`)
                            .join('\n')
                        : 'No violators',
                    inline: true
                }
            );

        if (report.recommendations.length > 0) {
            embed.addFields({
                name: '💡 Recommendations',
                value: report.recommendations.map(r => `• ${r}`).join('\n')
            });
        }

        embed.setFooter({ text: 'Security System Report' }).setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    /**
     * Handle user reset
     */
    async handleReset(interaction) {
        const user = interaction.options.getUser('user');

        if (!interaction.member.permissions.has('Administrator')) {
            return await InteractionUtils.sendError(interaction, 'Administrator permission required', true);
        }

        this.securityManager.resetUser(user.id);
        
        const embed = new EmbedBuilder()
            .setColor('#f39c12')
            .setTitle('🔄 User Data Reset')
            .setDescription(`Reset all security data for ${user.tag}`)
            .addFields(
                { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
                { name: 'Reset Data', value: 'Rate limits, warnings, spam tracking', inline: true }
            )
            .setFooter({ text: 'User data has been cleared' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
}

module.exports = SecurityCommands;
