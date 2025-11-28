const { EmbedBuilder, WebhookClient } = require('discord.js');

class LoggerUtils {
    constructor(config) {
        this.webhookClient = config.errorWebhookUrl ? new WebhookClient({ url: config.errorWebhookUrl }) : null;
        this.debug = config.debug || false;
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
}

module.exports = LoggerUtils;