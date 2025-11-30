const { EmbedBuilder, WebhookClient } = require('discord.js');

class LoggerUtils {
    constructor(config) {
        this.client = null;

        this.webhookClient = config.errorWebhookUrl ? new WebhookClient({ url: config.errorWebhookUrl }) : null;
        this.debug = config.debug || false;
    }

    /**
     * ست کردن کلاینت دیسکورد برای ارسال لاگ به چنل
     */
    setClient(client) {
        this.client = client;
    }

    /**
     * ثبت خطای عمومی
     * @param {Error} error - خطای رخ داده
     * @param {string} context - بافتار خطا (مثلاً نام دستور)
     * @param {Object} additionalInfo - اطلاعات اضافی
     */
    async logError(error, context, additionalInfo = {}) {
        console.error(`[ERROR][${context}]`, error);
        
        if (this.debug) {
            console.debug('Additional Info:', additionalInfo);
        }

        if (this.webhookClient) {
            try {
                const embed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle(`❌ خطا در ${context}`)
                    .setDescription(`\`\`\`\n${error.message}\n\`\`\``)
                    .addFields([
                        { name: 'نوع خطا', value: error.name, inline: true },
                        { name: 'زمان', value: new Date().toISOString(), inline: true }
                    ])
                    .setTimestamp();

                if (error.stack) {
                    embed.addFields({ 
                        name: 'Stack Trace', 
                        value: `\`\`\`\n${error.stack.substring(0, 1000)}\n\`\`\``
                    });
                }

                if (Object.keys(additionalInfo).length > 0) {
                    embed.addFields({
                        name: 'اطلاعات تکمیلی',
                        value: `\`\`\`json\n${JSON.stringify(additionalInfo, null, 2)}\n\`\`\``
                    });
                }

                await this.webhookClient.send({ embeds: [embed] });
            } catch (webhookError) {
                console.error('Error sending error log to webhook:', webhookError);
            }
        }
    }

    /**
     * ثبت خطای دیتابیس
     * @param {Error} error - خطای رخ داده
     * @param {string} operation - عملیات دیتابیس
     * @param {Object} data - داده‌های مرتبط
     */
    async logDatabaseError(error, operation, data = {}) {
        await this.logError(error, 'Database', {
            operation,
            ...data
        });
    }

    /**
     * ثبت خطای دستور
     * @param {Error} error - خطای رخ داده
     * @param {string} commandName - نام دستور
     * @param {Object} interaction - اینتراکشن دیسکورد
     */
    async logCommandError(error, commandName, interaction) {
        await this.logError(error, `Command: ${commandName}`, {
            userId: interaction.user?.id,
            guildId: interaction.guild?.id,
            channelId: interaction.channel?.id
        });
    }

    /**
     * ثبت اطلاعات عمومی
     * @param {string} message - پیام
     * @param {Object} data - داده‌های اضافی
     */
    info(message, data = {}) {
        console.log(`[INFO] ${message}`, data);
    }

    /**
     * ثبت اطلاعات دیباگ
     * @param {string} message - پیام
     * @param {Object} data - داده‌های اضافی
     */
    debugLog(message, data = {}) {
        if (this.debug) {
            console.debug(`[DEBUG] ${message}`, data);
        }
    }

    /**
     * ثبت هشدار
     * @param {string} message - پیام
     * @param {Object} data - داده‌های اضافی
     */
    warn(message, data = {}) {
        console.warn(`[WARN] ${message}`, data);
    }

    /**
     * ثبت موفقیت‌آمیز بودن عملیات
     * @param {string} subject - موضوع
     * @param {Object} fields - فیلدهای اضافی
     * @param {string} context - بافتار
     */
    async logSuccess(subject, fields = {}, context = '') {
        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle(`✅ Success${context ? ' - ' + context : ''}`)
            .setTimestamp();

        this.addFieldsToEmbed(embed, { Subject: subject, ...fields });
        await this.sendEmbed(embed, 'success');
    }

    /**
     * ثبت اطلاعات عمومی
     * @param {string} subject - موضوع
     * @param {Object} fields - فیلدهای اضافی
     * @param {string} context - بافتار
     */
    async logInfo(subject, fields = {}, context = '') {
        const embed = new EmbedBuilder()
            .setColor('#3498db')
            .setTitle(`ℹ️ Info${context ? ' - ' + context : ''}`)
            .setTimestamp();

        this.addFieldsToEmbed(embed, { Subject: subject, ...fields });
        await this.sendEmbed(embed, 'info');
    }

    /**
     * ثبت دستورات
     * @param {Object} interaction - اینتراکشن دیسکورد
     */
    async logCommand(interaction) {
        const commandType = interaction.isChatInputCommand() ? 'Slash Command' :
                           interaction.isButton() ? 'Button' :
                           interaction.isStringSelectMenu() ? 'Select Menu' :
                           interaction.isModalSubmit() ? 'Modal' :
                           'Unknown';
        
        const commandName = interaction.commandName || interaction.customId || 'N/A';
        
        await this.logInfo('Command Executed', {
            User: `${interaction.user.tag} (${interaction.user.id})`,
            Command: commandName,
            Type: commandType,
            Channel: interaction.channel ? `${interaction.channel.name} (${interaction.channel.id})` : 'N/A',
            Guild: interaction.guild ? `${interaction.guild.name} (${interaction.guild.id})` : 'N/A'
        }, commandType);
    }

    /**
     * ثبت عملیات تیکت
     * @param {string} action - عملیات
     * @param {Object} user - کاربر
     * @param {Object} ticketInfo - اطلاعات تیکت
     */
    async logTicket(action, user, ticketInfo = {}) {
        await this.logInfo(`Ticket ${action}`, {
            User: `${user.tag} (${user.id})`,
            ...ticketInfo
        }, 'Ticket System');
    }

    /**
     * ارسال امبد به چنل لاگ و وب‌هوک
     * @param {Object} embed - امبد دیسکورد
     * @param {string} level - سطح لاگ
     */
    async sendEmbed(embed, level = 'info') {
        // Always send to log channel
        if (this.client && this.client.channels) {
            try {
                // Try to get log channel from config or use default
                const logChannelId = process.env.LOG_CHANNEL_ID || null;
                if (logChannelId) {
                    const logChannel = this.client.channels.cache.get(logChannelId);
                    if (logChannel && logChannel.isTextBased()) {
                        await logChannel.send({ embeds: [embed] });
                    }
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
     * Add fields to embed with proper validation
     * @param {EmbedBuilder} embed - The embed to add fields to
     * @param {Object} fields - Fields object
     */
    addFieldsToEmbed(embed, fields) {
        if (!fields || typeof fields !== 'object') return;
        
        Object.entries(fields).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                const stringValue = String(value).substring(0, 1024); // Limit field value length
                embed.addFields({
                    name: key,
                    value: stringValue || 'N/A',
                    inline: false
                });
            }
        });
    }

    /**
     * ساخت امبد پایه با رنگ و زمان
     * @param {string} level - سطح لاگ
     * @param {string} title - عنوان امبد
     * @param {string} description - توضیحات
     */
    buildBaseEmbed(level, title, description = '') {
        const colors = {
            info: 0x3498db,
            success: 0x2ecc71,
            warn: 0xf1c40f,
            error: 0xe74c3c,
            debug: 0x8e44ad,
            security: 0xe67e22,
            moderation: 0x9b59b6
        };
        
        const embed = new EmbedBuilder()
            .setColor(colors[level] || colors.info)
            .setTitle(title)
            .setTimestamp();
        
        if (description) {
            embed.setDescription(description);
        }
        
        return embed;
    }
}

module.exports = LoggerUtils;