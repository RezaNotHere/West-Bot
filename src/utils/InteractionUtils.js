const { EmbedBuilder, MessageFlags } = require('discord.js');

// Safe interaction reply helper
async function safeReply(interaction, options) {
    try {
        if (interaction.replied || interaction.deferred) {
            return await interaction.followUp(options);
        } else {
            return await interaction.reply(options);
        }
    } catch (error) {
        if (error.code === 10062) {
            console.warn('⚠️ Interaction expired or already handled:', error.message);
        } else {
            console.error('❌ Interaction reply failed:', error);
        }
        return null;
    }
}

class InteractionUtils {
    /**
     * Send an error response
     * @param {CommandInteraction} interaction The interaction to reply to
     * @param {string} message The error message
     * @param {boolean} [edit=false] Whether to edit instead of reply
     */
    static async sendError(interaction, message, edit = false) {
        const errorEmbed = new EmbedBuilder()
            .setColor('#E74C3C') // قرمز زیبا
            .setTitle('⛔️ خطا')
            .setDescription(`**${message}**\n\n> لطفاً دوباره تلاش کنید یا با پشتیبانی ارتباط بگیرید.`)
            .setFooter({ text: 'در صورت تکرار مشکل، به ادمین اطلاع دهید.' });

        const options = { embeds: [errorEmbed], flags: MessageFlags.Ephemeral };

        return await safeReply(interaction, options);
    }

    /**
     * Send a success response
     * @param {CommandInteraction} interaction The interaction to reply to
     * @param {string} message The success message
     * @param {boolean} [ephemeral=true] Whether the message should be ephemeral
     * @param {boolean} [edit=false] Whether to edit instead of reply
     */
    static async sendSuccess(interaction, message, ephemeral = true, edit = false) {
        const successEmbed = new EmbedBuilder()
            .setColor('Green')
            .setDescription(`✅ ${message}`);
        
        const options = { embeds: [successEmbed], flags: ephemeral ? MessageFlags.Ephemeral : undefined };
        
        return await safeReply(interaction, options);
    }

    /**
     * Defer the reply with proper options
     * @param {CommandInteraction} interaction The interaction to defer
     * @param {boolean} [ephemeral=false] Whether the response should be ephemeral
     */
    static async deferReply(interaction, ephemeral = false) {
        try {
            await interaction.deferReply({ flags: ephemeral ? MessageFlags.Ephemeral : undefined });
        } catch (error) {
            if (error.code === 10062) {
                console.warn('⚠️ Interaction expired while deferring:', error.message);
            } else {
                console.error('Failed to defer reply:', error);
            }
        }
    }
}

module.exports = InteractionUtils;