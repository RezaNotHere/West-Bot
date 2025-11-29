const { AttachmentBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createTranscript } = require('discord-html-transcripts');
const fs = require('fs');
const path = require('path');

class TicketTranscript {
    constructor() {
        this.transcriptsDir = path.join(process.cwd(), 'transcripts');
        this.ensureTranscriptsDir();
    }

    ensureTranscriptsDir() {
        if (!fs.existsSync(this.transcriptsDir)) {
            fs.mkdirSync(this.transcriptsDir, { recursive: true });
        }
    }

    async generateHTML(ticketChannel) {
        try {
            // Create HTML transcript
            const transcript = await createTranscript(ticketChannel, {
                limit: -1, // All messages
                returnType: 'string',
                filename: `transcript-${ticketChannel.id}.html`,
                saveImages: true,
                poweredBy: false,
                footerText: 'Transcribed with {number} messages • {time}',
                footer: true,
                hydrate: true
            });

            // Save to file
            const fileName = `transcript-${ticketChannel.id}-${Date.now()}.html`;
            const filePath = path.join(this.transcriptsDir, fileName);
            
            fs.writeFileSync(filePath, transcript, 'utf8');
            return filePath;
            
        } catch (error) {
            console.error('Error generating HTML transcript:', error);
            throw new Error('Error creating HTML transcript for ticket');
        }
    }

    async createTranscriptFile(ticketChannel) {
        try {
            const filePath = await this.generateHTML(ticketChannel);
            return new AttachmentBuilder(filePath, { 
                name: `transcript-${ticketChannel.id}.html`,
                description: `Transcript for ticket ${ticketChannel.name}`
            });
        } catch (error) {
            console.error('Error creating transcript file:', error);
            throw error;
        }
    }

    createTicketCloseEmbed(ticketId, ticketOwner, closedBy) {
        // Normalize owner mention: accept user object or raw ID
        const ownerMention = typeof ticketOwner === 'string' ? `<@${ticketOwner}>` : (ticketOwner?.id ? `<@${ticketOwner.id}>` : String(ticketOwner));
        return new EmbedBuilder()
            .setColor('#ff6b6b')
            .setTitle('🔒 Ticket Closed')
            .setDescription('This ticket has been closed. You can reopen it or delete it.')
            .addFields(
                { name: 'Closed by', value: closedBy.toString(), inline: true },
                { name: 'Ticket ID', value: ticketId, inline: true },
                { name: 'Ticket Owner', value: ownerMention, inline: true }
            )
            .setTimestamp();
    }

    createTicketActionRow() {
        return new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('ticket_reopen')
                .setLabel('Reopen Ticket')
                .setStyle(ButtonStyle.Success)
                .setEmoji('🔓'),
            new ButtonBuilder()
                .setCustomId('ticket_delete')
                .setLabel('Delete Ticket')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🗑️'),
            new ButtonBuilder()
                .setCustomId('transcript_ticket')
                .setLabel('Transcript')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('📄')
        );
    }

    createTicketOpenActionRow() {
        return new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('ticket_close')
                .setLabel('Close Ticket')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🔒'),
            new ButtonBuilder()
                .setCustomId('transcript_ticket')
                .setLabel('Transcript')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('📄')
        );
    }

    // Cleanup old transcripts
    cleanupOldTranscripts(maxAge = 7 * 24 * 60 * 60 * 1000) {
        try {
            if (!fs.existsSync(this.transcriptsDir)) return;
            
            const files = fs.readdirSync(this.transcriptsDir);
            const now = Date.now();
            
            files.forEach(file => {
                const filePath = path.join(this.transcriptsDir, file);
                const stats = fs.statSync(filePath);
                
                if (now - stats.birthtimeMs > maxAge) {
                    fs.unlinkSync(filePath);
                }
            });
        } catch (error) {
            console.error('Error cleaning up transcripts:', error);
        }
    }
}

module.exports = new TicketTranscript();
