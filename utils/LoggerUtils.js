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
     * اضافه کردن فیلدها به امبد
     * @param {Object} embed - امبد دیسکورد
     * @param {Object} fields - فیلدها
     */
    addFieldsToEmbed(embed, fields = {}) {
        Object.entries(fields).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                const stringValue = typeof value === 'string' 
                    ? value 
                    : '```json\n' + JSON.stringify(value, null, 2) + '\n```';
                
                if (stringValue.length > 1024) {
                    const chunks = stringValue.match(/.{1,1024}/g) || [];
                    chunks.forEach((chunk, index) => {
                        embed.addFields({ 
                            name: index === 0 ? key : '\u200b', 
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
}

module.exports = LoggerUtils;