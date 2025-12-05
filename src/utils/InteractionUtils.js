const { EmbedBuilder, MessageFlags } = require('discord.js');

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

        try {
            if (interaction.replied) {
                // If we've already replied to the interaction, use followUp
                return await interaction.followUp({ ...options, ephemeral: true });
            } else if (interaction.deferred) {
                // If we've deferred but not replied, edit the deferred reply
                return await interaction.editReply(options);
            } else {
                // If we haven't done anything with the interaction yet, reply normally
                return await interaction.reply(options);
            }
        } catch (error) {
            // Ignore unknown interaction errors as they're not actionable
            if (error.code !== 10062) {
                console.error('Failed to send error response:', error);
            }
        }
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
        
        try {
            if (interaction.replied) {
                // If we've already replied to the interaction, use followUp
                return await interaction.followUp({ ...options, ephemeral: true });
            } else if (interaction.deferred) {
                // If we've deferred but not replied, edit the deferred reply
                return await interaction.editReply(options);
            } else {
                // If we haven't done anything with the interaction yet, reply normally
                return await interaction.reply(options);
            }
        } catch (error) {
            // Ignore unknown interaction errors as they're not actionable
            if (error.code !== 10062) {
                console.error('Failed to send success response:', error);
            }
        }
    }

    /**
     * Defer the reply with proper options
     * @param {CommandInteraction} interaction The interaction to defer
     * @param {boolean} [ephemeral=false] Whether the response should be ephemeral
     */
    static async deferReply(interaction, ephemeral = false) {
        try {
            // Only defer if we haven't already responded
            if (!interaction.replied && !interaction.deferred) {
                await interaction.deferReply({ 
                    flags: ephemeral ? MessageFlags.Ephemeral : undefined 
                });
                return true;
            }
            return false;
        } catch (error) {
            // Ignore unknown interaction errors as they're not actionable
            if (error.code !== 10062) {
                console.error('Failed to defer reply:', error);
            }
            return false;
        }
    }
}

module.exports = InteractionUtils;