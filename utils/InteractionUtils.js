const { EmbedBuilder } = require('discord.js');

class InteractionUtils {
    /**
     * Send an error response
     * @param {CommandInteraction} interaction The interaction to reply to
     * @param {string} message The error message
     * @param {boolean} [edit=false] Whether to edit instead of reply
     */
    static async sendError(interaction, message, edit = false) {
        const errorEmbed = new EmbedBuilder()
            .setColor('Red')
            .setDescription(`❌ ${message}`);
        
        const options = { embeds: [errorEmbed], ephemeral: true };
        
        try {
            if (edit && interaction.deferred) {
                await interaction.editReply(options);
            } else {
                await interaction.reply(options);
            }
        } catch (error) {
            console.error('Failed to send error response:', error);
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
        
        const options = { embeds: [successEmbed], ephemeral };
        
        try {
            if (edit && interaction.deferred) {
                await interaction.editReply(options);
            } else {
                await interaction.reply(options);
            }
        } catch (error) {
            console.error('Failed to send success response:', error);
        }
    }

    /**
     * Defer the reply with proper options
     * @param {CommandInteraction} interaction The interaction to defer
     * @param {boolean} [ephemeral=false] Whether the response should be ephemeral
     */
    static async deferReply(interaction, ephemeral = false) {
        try {
            await interaction.deferReply({ ephemeral });
        } catch (error) {
            console.error('Failed to defer reply:', error);
        }
    }
}

module.exports = InteractionUtils;