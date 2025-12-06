// commands.js
// Slash command and message command handlers with enhanced security
const { 
    EmbedBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle,
    ActionRowBuilder,
    MessageFlags,
    PermissionsBitField

} = require('discord.js');

const { db } = require('./database');
const utils = require('./utils');
const InteractionUtils = require('./utils/InteractionUtils');
const config = require('../configManager');
const { ValidationError, PermissionError } = require('./errors/BotError');

// Conditional imports for security modules (may not exist in production)
let InputValidator = null;
let SecurityCommands = null;

try {
    InputValidator = require('./security/InputValidator');
    SecurityCommands = require('./security/SecurityCommands');
} catch (error) {
    console.warn('Security modules not found:', error.message);
}

let logger = null;
let security = null;
let inputValidator = null;
let securityCommands = null;

const setLogger = (l) => { 
    logger = l; 
    if (inputValidator) inputValidator.setLogger(l);
}

const setSecurity = (s) => { 
    security = s; 
    // Initialize input validator only if module exists
    if (InputValidator) {
        inputValidator = new InputValidator();
        if (logger && inputValidator.setLogger) {
            inputValidator.setLogger(logger);
        } else if (!inputValidator.setLogger) {
            console.warn('⚠️ InputValidator.setLogger() method not available');
        }
    }
    
    // Initialize security commands only if module exists
    if (SecurityCommands) {
        securityCommands = new SecurityCommands(security, logger);
    }
}

async function handleSlashCommand(interaction) {
    // --- /mcinfo ---
    if (interaction.commandName === 'mcinfo') {
        await InteractionUtils.deferReply(interaction, false);
        let username = interaction.options.getString("username")?.trim();
        
        // Enhanced input validation only if validator exists
        if (!username) {
            return await InteractionUtils.sendError(interaction, "Username is required.", false);
        }
        
        // Validate username format only if validator exists
        if (inputValidator) {
            const usernameValidation = inputValidator.validate(username, 'minecraftUsername');
            if (!usernameValidation.valid) {
                return await InteractionUtils.sendError(
                    interaction, 
                    `Invalid username format: ${usernameValidation.errors.join(', ')}`, 
                    false
                );
            }
            username = usernameValidation.sanitized;
        }
        
        // Validate config variables
        if (!config.apis || !config.apis.mojang) {
            await InteractionUtils.sendError(interaction, "Mojang API key is not configured.", false);
            return;
        }
        
        try {
            const mojangData = await utils.getMojangData(username);
            if (!mojangData) {
                throw new Error("Minecraft account not found.");
            }
            
            // Additional validation for UUID only if validator exists
            if (inputValidator) {
                const uuidValidation = inputValidator.validate(mojangData.id, 'discordId');
                if (!uuidValidation.valid) {
                    throw new Error("Invalid UUID format received from Mojang API.");
                }
            }
            
            // Generate profile image with validated data
            await utils.sendProfileImageEmbed(interaction, mojangData.id, [], {});
            return;
        } catch (error) {
            if (logger) {
                await logger.logError(error, 'mcinfo Command', {
                    User: `${interaction.user.tag} (${interaction.user.id})`,
                    Username: username,
                    Guild: interaction.guild?.name || 'DM',
                    Channel: interaction.channel?.name || 'DM'
                });
            }
            
            let msg = "Error fetching information.";
            if (error.code === 'ECONNABORTED') msg = "Request timeout.";
            else if (error.response?.status === 429) msg = "Too many requests.";
            else if (error.response?.status === 403) msg = "Invalid API key.";
            else if (error.message.includes('Invalid username')) msg = "Invalid Minecraft username format.";
            
            await InteractionUtils.sendError(interaction, msg, false);
            return;
        }
    }

    // --- /addbadword ---
    if (interaction.commandName === 'addbadword') {
        if (!interaction.member.permissions.has('Administrator')) {
            return await InteractionUtils.sendError(interaction, 'You do not have permission to use this command.');
        }
        
        const word = interaction.options.getString('word');
        
        // Input validation
        if (!word || word.trim().length === 0) {
            return await InteractionUtils.sendError(interaction, 'Word cannot be empty.', true);
        }
        
        let sanitizedWord = word.trim().toLowerCase();
        
        // Validate only if validator exists
        if (inputValidator) {
            const wordValidation = inputValidator.validate(word, 'safeText', { maxLength: 50 });
            if (!wordValidation.valid) {
                return await InteractionUtils.sendError(
                    interaction, 
                    `Invalid word format: ${wordValidation.errors.join(', ')}`, 
                    true
                );
            }
            sanitizedWord = wordValidation.sanitized.toLowerCase();
        }
        
        try {
            const success = await utils.addBadWord(sanitizedWord);
            if (success) {
                await InteractionUtils.sendSuccess(interaction, `Banned word "${sanitizedWord}" has been added.`);
            } else {
                await InteractionUtils.sendError(interaction, 'This word is already banned.', true);
            }
        } catch (error) {
            await InteractionUtils.sendError(interaction, 'Error adding banned word.', true);
        }
        return;
    }

    // --- /removebadword ---
    if (interaction.commandName === 'removebadword') {
        if (!interaction.member.permissions.has('Administrator')) {
            return await InteractionUtils.sendError(interaction, 'You do not have permission to use this command.');
        }
        
        const word = interaction.options.getString('word');
        
        // Input validation
        if (!word || word.trim().length === 0) {
            return await InteractionUtils.sendError(interaction, 'Word cannot be empty.', true);
        }
        
        let sanitizedWord = word.trim().toLowerCase();
        
        // Validate only if validator exists
        if (inputValidator) {
            const wordValidation = inputValidator.validate(word, 'safeText', { maxLength: 50 });
            if (!wordValidation.valid) {
                return await InteractionUtils.sendError(
                    interaction, 
                    `Invalid word format: ${wordValidation.errors.join(', ')}`, 
                    true
                );
            }
            sanitizedWord = wordValidation.sanitized.toLowerCase();
        }
        
        try {
            const success = await utils.removeBadWord(sanitizedWord);
            if (success) {
                await InteractionUtils.sendSuccess(interaction, `Banned word "${sanitizedWord}" has been removed.`);
            } else {
                await InteractionUtils.sendError(interaction, 'This word is not in the banned list.', true);
            }
        } catch (error) {
            await InteractionUtils.sendError(interaction, 'Error removing banned word.', true);
        }
        return;
    }

    // --- /listbadwords ---
    if (interaction.commandName === 'listbadwords') {
        if (!interaction.member.permissions.has('Administrator')) {
            return await InteractionUtils.sendError(interaction, 'You do not have permission to use this command.');
        }
        const list = utils.listBadWords();
        const embed = new EmbedBuilder()
            .setColor('Blue')
            .setTitle('📝 List of Banned Words')
            .setDescription(list.length ? list.join(', ') : 'List is empty.')
            .setTimestamp();
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    // --- /importbadwords ---
    if (interaction.commandName === 'importbadwords') {
        if (!interaction.member.permissions.has('Administrator')) {
            return await InteractionUtils.sendError(interaction, 'You do not have permission to use this command.');
        }
        
        const text = interaction.options.getString('text');
        if (!text) {
            return await InteractionUtils.sendError(interaction, 'Please provide text to import banned words from.');
        }
        
        try {
            // Split text by common separators and clean up
            const words = text.split(/[\s,\n\r\t]+/)
                .map(word => word.toLowerCase().trim())
                .filter(word => word.length > 0);
            
            if (words.length === 0) {
                return await InteractionUtils.sendError(interaction, 'No valid words found in the provided text.');
            }
            
            let addedCount = 0;
            let skippedCount = 0;
            const skippedWords = [];
            
            for (const word of words) {
                const success = await utils.addBadWord(word);
                if (success) {
                    addedCount++;
                } else {
                    skippedCount++;
                    skippedWords.push(word);
                }
            }
            
            const embed = new EmbedBuilder()
                .setColor(addedCount > 0 ? 'Green' : 'Orange')
                .setTitle('📥 Banned Words Import Complete')
                .addFields(
                    { name: '✅ Successfully Added', value: `${addedCount} words`, inline: true },
                    { name: '⏭️ Already Exists', value: `${skippedCount} words`, inline: true },
                    { name: '📊 Total Processed', value: `${words.length} words`, inline: true }
                )
                .setTimestamp();
            
            if (skippedWords.length > 0 && skippedWords.length <= 10) {
                embed.addFields({
                    name: '⏭️ Skipped Words',
                    value: skippedWords.join(', '),
                    inline: false
                });
            } else if (skippedWords.length > 10) {
                embed.addFields({
                    name: '⏭️ Skipped Words (First 10)',
                    value: skippedWords.slice(0, 10).join(', ') + `... and ${skippedWords.length - 10} more`,
                    inline: false
                });
            }
            
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            
            // Log the import action
            if (logger) {
                await logger.logInfo('Banned Words Imported', {
                    Moderator: `${interaction.user.tag} (${interaction.user.id})`,
                    AddedWords: addedCount,
                    SkippedWords: skippedCount,
                    TotalProcessed: words.length
                });
            }
            
        } catch (error) {
            await InteractionUtils.sendError(interaction, 'Error importing banned words.', true);
        }
        return;
    }

    // --- /clearwarnings ---
    if (interaction.commandName === 'clearwarnings') {
        if (!interaction.member.permissions.has('ModerateMembers')) {
            return await InteractionUtils.sendError(interaction, 'You do not have permission to use this command.');
        }
        const user = interaction.options.getUser('user');
        await utils.clearWarnings(user.id);
        await InteractionUtils.sendSuccess(interaction, `Warnings for ${user.tag} have been cleared.`);
        return;
    }

    // --- /invites ---
    if (interaction.commandName === 'invites') {
        await interaction.deferReply();
        const user = interaction.options.getUser('user') || interaction.user;
        try {
            const invites = await interaction.guild.invites.fetch();
            let total = 0, fake = 0, left = 0, normal = 0;
            
            invites.forEach(inv => {
                if (!inv.inviter || inv.inviter.id !== user.id) return;
                total += inv.uses || 0;
                normal += inv.uses || 0;
            });
            
            const embed = new EmbedBuilder()
                .setColor('#f1c40f')
                .setTitle(`📨 ${user.tag}'s Invite Statistics`)
                .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                .addFields(
                    { name: '📥 Total Invites', value: `${total} people`, inline: true },
                    { name: '✅ Real Joins', value: `${normal} people`, inline: true },
                    { name: '❌ Fake Joins', value: `${fake} people`, inline: true },
                    { name: '🚪 Left Server', value: `${left} people`, inline: true }
                )
                .setFooter({ text: 'Use /invites-leaderboard to see the top inviters list' })
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            await InteractionUtils.sendError(interaction, 'Error fetching invite information.', true);
        }
        return;
    }

    // --- /start-giveaway ---
    if (interaction.commandName === 'start-giveaway') {
        const channel = interaction.options.getChannel('channel');
        const durationStr = interaction.options.getString('duration');
        const winners = interaction.options.getInteger('winners');
        const prize = interaction.options.getString('prize');
        
        try {
            // Permission check
            if (!interaction.member.permissions.has('ManageMessages')) {
                throw new PermissionError(
                    'You do not have permission to host giveaways.',
                    'ManageMessages'
                );
            }

            let sanitizedPrize = prize;
            let sanitizedDuration = durationStr;
            let sanitizedWinners = winners;
            
            // Enhanced input validation only if validator exists
            if (inputValidator) {
                const validationResults = {
                    prize: inputValidator.validate(prize, 'safeText', { maxLength: 100 }),
                    duration: inputValidator.validate(durationStr, 'duration'),
                    winners: inputValidator.validate(winners.toString(), 'numbers')
                };

                // Check validation results
                const validationErrors = [];
                Object.entries(validationResults).forEach(([field, result]) => {
                    if (!result.valid) {
                        validationErrors.push(`${field}: ${result.errors.join(', ')}`);
                    }
                });

                if (validationErrors.length > 0) {
                    return await InteractionUtils.sendError(
                        interaction, 
                        `Validation errors: ${validationErrors.join('; ')}`, 
                        true
                    );
                }

                // Use sanitized values
                sanitizedPrize = validationResults.prize.sanitized;
                sanitizedDuration = validationResults.duration.sanitized;
                sanitizedWinners = parseInt(validationResults.winners.sanitized);
            }

            // Additional business logic validation
            if (sanitizedWinners < 1 || sanitizedWinners > 10) {
                return await InteractionUtils.sendError(interaction, "Number of winners must be between 1 and 10.", true);
            }

            const ms = utils.ms;
            const durationMs = ms(sanitizedDuration);
            
            if (!durationMs || durationMs < 30000) {
                return await InteractionUtils.sendError(interaction, "Duration must be at least 30 seconds.", true);
            }

            if (durationMs > 7 * 24 * 60 * 60 * 1000) { // Max 7 days
                return await InteractionUtils.sendError(interaction, "Duration cannot exceed 7 days.", true);
            }

            const endTime = Date.now() + durationMs;
            const embed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle('🎉 Server Giveaway!')
                .setDescription(`Click on 🎉 to participate in the giveaway!\n\n**Prize:** ${sanitizedPrize}\n**Winners:** ${sanitizedWinners}\n**Ends:** <t:${Math.floor(endTime/1000)}:R>\n👤 Host: <@${interaction.user.id}>\n\n👥 Participants so far: **0 people**`)
                .setFooter({ text: 'Click on the button below to participate in the giveaway.' })
                .setTimestamp();
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('join_giveaway').setLabel('Join Giveaway').setStyle(ButtonStyle.Success).setEmoji('🎉')
            );
            const msg = await channel.send({ embeds: [embed], components: [row] });
            
            const giveawayData = {
                channelId: channel.id,
                prize: sanitizedPrize,
                winnerCount: sanitizedWinners,
                endTime,
                ended: false,
                participants: [],
                host: interaction.user.id
            };
            
            db.giveaways.set(msg.id, giveawayData);
            
            await interaction.reply({ content: `Giveaway created successfully! [View](${msg.url})`, flags: MessageFlags.Ephemeral });
            utils.checkGiveaways();
            return;
        } catch (error) {
            if (logger) {
                await logger.logError(error, 'start-giveaway Command', {
                    User: `${interaction.user.tag} (${interaction.user.id})`,
                    Channel: interaction.channel?.name || 'N/A',
                    Prize: prize,
                    Winners: winners,
                    Duration: durationStr,
                    Guild: interaction.guild?.name || 'DM'
                });
            }
            await InteractionUtils.sendError(interaction, 'خطای در ایجاد گیوای.', true);
            return;
        }
    }

    // --- /end-giveaway ---
    if (interaction.commandName === 'end-giveaway') {
        if (!interaction.member.permissions.has('ManageMessages')) {
            return await InteractionUtils.sendError(interaction, 'You do not have permission to end giveaways.');
        }

        const messageId = interaction.options.getString('messageid');
        const giveaway = db.giveaways.get(messageId);

        if (!giveaway) {
            return await InteractionUtils.sendError(interaction, 'Giveaway not found.');
        }

        if (giveaway.ended) {
            return await InteractionUtils.sendError(interaction, 'This giveaway has already ended.');
        }

        await utils.endGiveaway(messageId);
        await InteractionUtils.sendSuccess(interaction, 'Giveaway ended and winners have been selected.');
        return;
    }

    // --- /reroll-giveaway ---
    if (interaction.commandName === 'reroll-giveaway') {
        const messageId = interaction.options.getString('messageid');
        const giveaway = db.giveaways.get(messageId);
        if (!giveaway) {
            return await InteractionUtils.sendError(interaction, 'Giveaway not found.');
        }
        if (!giveaway.ended) {
            return await InteractionUtils.sendError(interaction, 'This giveaway has not ended yet.');
        }

        const channel = interaction.guild.channels.cache.get(giveaway.channelId);
        if (!channel) {
            return await InteractionUtils.sendError(interaction, 'Giveaway channel not found.');
        }
        const message = await channel.messages.fetch(messageId).catch(() => null);
        if (!message) {
            return await InteractionUtils.sendError(interaction, 'Giveaway message not found.');
        }
        const participants = giveaway.participants || [];
        if (participants.length === 0) {
            return await InteractionUtils.sendError(interaction, 'No participants found.');
        }
        const winners = [];
        // ساخت کپی از شرکت‌کنندگان برای جلوگیری از تغییر آرایه اصلی اگر نیاز نیست
        const tempParticipants = [...participants];
        
        for (let i = 0; i < giveaway.winnerCount; i++) {
            if (tempParticipants.length === 0) break;
            const winnerIndex = Math.floor(Math.random() * tempParticipants.length);
            winners.push(tempParticipants.splice(winnerIndex, 1)[0]);
        }
        const rerollEmbed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🎉 Giveaway Rerolled!')
            .setDescription(`New winners:\n${winners.map(w => `<@${w}>`).join(', ')}`)
            .setTimestamp();
        await channel.send({ embeds: [rerollEmbed] });
        await interaction.reply({ content: 'New winners have been selected.', flags: MessageFlags.Ephemeral });
        return;
    }

    // --- /rolestats ---
    if (interaction.commandName === 'rolestats') {
        await interaction.deferReply();
        try {
            const roles = interaction.guild.roles.cache.filter(r => r.id !== interaction.guild.id && !r.managed).sort((a, b) => b.position - a.position);
            let desc = '';
            let total = 0;
            roles.forEach(role => {
                desc += `<@&${role.id}> : **${role.members.size} people**\n`;
                total += role.members.size;
            });
            if (!desc) desc = 'No roles found.';
            const embed = new EmbedBuilder()
                .setColor('#7289da')
                .setTitle('📊 Server Role Member Statistics')
                .setDescription(desc)
                .addFields({ name: '👥 Total members with roles (excluding everyone)', value: `${total} people` })
                .setFooter({ text: 'Use this statistics for better role management.' })
                .setTimestamp();

            if (roles.size > 0) {
                const maxRole = roles.reduce((a, b) => a.members.size > b.members.size ? a : b);
                const minRole = roles.reduce((a, b) => a.members.size < b.members.size ? a : b);
                embed.addFields(
                    { name: '🏆 Most members', value: `<@&${maxRole.id}> (${maxRole.members.size} people)`, inline: true },
                    { name: '🔻 Fewest members', value: `<@&${minRole.id}> (${minRole.members.size} people)`, inline: true }
                );
            }
            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            await InteractionUtils.sendError(interaction, 'Error fetching role statistics.', true);
        }
        return;
    }

    // --- /invites-leaderboard ---
    if (interaction.commandName === 'invites-leaderboard') {
        await interaction.deferReply();
        try {
            const invites = await interaction.guild.invites.fetch();
            const inviteCounts = {};
            invites.forEach(inv => {
                if (!inv.inviter) return;
                if (!inviteCounts[inv.inviter.id]) inviteCounts[inv.inviter.id] = 0;
                inviteCounts[inv.inviter.id] += inv.uses || 0;
            });
            const sorted = Object.entries(inviteCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10);
            let desc = '';
            if (sorted.length === 0) {
                desc = 'No invites have been recorded yet.';
            } else {
                desc = sorted.map(([uid, count], i) => `**${i+1}. <@${uid}>** — ${count} invites`).join('\n');
            }
            const embed = new EmbedBuilder()
                .setColor('#f1c40f')
                .setTitle('🏆 Server Inviters Leaderboard')
                .setDescription(desc)
                .setFooter({ text: 'Invite your friends to the server to appear on this list!' })
                .setTimestamp();

            if (sorted.length > 0 && !sorted.some(([uid]) => uid === interaction.user.id)) {
                const userCount = inviteCounts[interaction.user.id] || 0;
                if (userCount > 0) {
                    const rank = Object.entries(inviteCounts).sort((a, b) => b[1] - a[1]).findIndex(([uid]) => uid === interaction.user.id) + 1;
                    embed.addFields({ name: 'Your Rank', value: `Rank ${rank} with ${userCount} invites` });
                }
            }
            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            await InteractionUtils.sendError(interaction, 'Error fetching invite information.', true);
        }
        return;
    }

    // --- /sentrolemenu ---
    if (interaction.commandName === 'sendrolemenu') {
        if (!interaction.channel || interaction.channel.type !== 0) {
            return await InteractionUtils.sendError(interaction, 'This command can only be used in text channels.');
        }
        if (!interaction.member.permissions.has('ManageRoles')) {
            return await InteractionUtils.sendError(interaction, 'You do not have permission to send the role menu.');
        }
        const roles = [
            { id: config.roles.giveaway, label: '🎉 Events/Giveaways', color: ButtonStyle.Success, emoji: '🎉' },
            { id: config.roles.drop, label: '📦 Drops', color: ButtonStyle.Primary, emoji: '📦' },
            { id: config.roles.update, label: '🔔 Updates', color: ButtonStyle.Danger, emoji: '🔔' }
        ];
        const embed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle('📋 Select Notification Roles')
            .setDescription('Select or remove roles to receive different notifications. Click again to remove the role.\n\n**Roles:**\n🎉 Events/Giveaways\n📦 Drops\n🔔 Updates')
            .setTimestamp();
        const row = new ActionRowBuilder().addComponents(
            ...roles.map(r => new ButtonBuilder().setCustomId(`rolebtn_${r.id}`).setLabel(r.label).setStyle(r.color).setEmoji(r.emoji))
        );
        try {
            await interaction.reply({ embeds: [embed], components: [row] });
        } catch (error) {
            console.error('Error sending role menu:', error);
            await InteractionUtils.sendError(interaction, 'Failed to send role menu. Please check my permissions.');
        }
        return;
    }
    if (interaction.commandName === 'sendticketmenu') {
        if (!interaction.channel || interaction.channel.type !== 0) {
            return await InteractionUtils.sendError(interaction, 'This command can only be used in text channels.');
        }
        if (!interaction.member.permissions.has('ManageChannels')) {
            return await InteractionUtils.sendError(interaction, 'You do not have permission to send the ticket menu.');
        }

        // Get channel from user input
        const targetChannel = interaction.options.getChannel('channel');
        
        if (!targetChannel) {
            return await InteractionUtils.sendError(interaction, 'Please select a channel to send the ticket menu to.');
        }

        if (!targetChannel.isTextBased()) {
            return await InteractionUtils.sendError(interaction, 'Selected channel must be a text channel.');
        }

    const ticketConfig = config.ticketSystem;
    const embed = new EmbedBuilder()
        .setColor(config.colors.primary || '#5865F2')
        .setTitle(ticketConfig.menu.title)
        .setDescription(ticketConfig.menu.description)
        .setImage(interaction.guild.iconURL({ dynamic: true, size: 512 }))
        .setFooter({ text: 'تیم پشتیبانی', iconURL: config.shop?.logo || interaction.guild.iconURL({ dynamic: true }) })
        .setTimestamp();

        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('ticket_select')
                .setPlaceholder(ticketConfig.menu.placeholder)
                .addOptions(ticketConfig.menu.categories)
        );

        try {
            await targetChannel.send({ embeds: [embed], components: [menu] });
            await InteractionUtils.sendSuccess(interaction, `Ticket menu has been successfully sent to ${targetChannel}!`);
        } catch (error) {
            console.error('Error sending ticket menu:', error);
            await InteractionUtils.sendError(interaction, 'Failed to send ticket menu. Please check my permissions.');
        }
        return;
    }

    // --- /warn ---
    if (interaction.commandName === 'warn') {
        if (!interaction.member.permissions.has('ModerateMembers')) {
             return await InteractionUtils.sendError(interaction, 'You do not have permission to warn users.');
        }

        const targetUser = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason specified';
        const maxWarnings = 3;

        try {
            const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
            if (!member) {
                return await InteractionUtils.sendError(interaction, 'User not found in server.');
            }

            if (member.permissions.has('ModerateMembers') || member.permissions.has('Administrator')) {
                return await InteractionUtils.sendError(interaction, 'You cannot warn administrators or moderators.');
            }

            // Use utils.addWarning to maintain consistency (stores as array, returns count)
            const newWarningCount = await utils.addWarning(targetUser.id, reason, interaction.user);

            const dmSent = await utils.sendWarningDM(member, newWarningCount, maxWarnings, reason, interaction.user);

            const responseEmbed = new EmbedBuilder()
                .setColor(newWarningCount >= maxWarnings ? 'Red' : 'Orange')
                .setTitle('⚠️ Warning Issued')
                .setDescription(`User <@${targetUser.id}> has received a warning.`)
                .addFields(
                    { name: 'Reason', value: reason, inline: true },
                    { name: 'Warning Count', value: `${newWarningCount} of ${maxWarnings}`, inline: true },
                    { name: 'DM Sent', value: dmSent ? '✅ Success' : '❌ Failed', inline: true }
                )
                .setFooter({ text: `By ${interaction.user.tag}` })
                .setTimestamp();

            if (newWarningCount >= maxWarnings) {
                if (member.bannable && member.id !== interaction.guild.ownerId) {
                    responseEmbed.addFields({ name: '🔨 Action', value: 'User has been banned due to reaching maximum warnings.', inline: false });

                    try {
                        try {
                            const banEmbed = new EmbedBuilder()
                                .setColor(0xFF0000)
                                .setTitle('Banned from Server')
                                .setDescription('You have been banned from the server for receiving 3 warnings.')
                                .addFields(
                                    { name: '📋 Appeal Process', value: 'If you believe this ban was made in error, you can request an unban by clicking the button below.', inline: false },
                                    { name: '⏰ Next Attempt', value: 'You can submit another appeal request in 1 hour if your previous request was denied.', inline: false }
                                )
                                .setTimestamp();

                            // Check if user can appeal (not denied recently)
                            const appeals = db.moderation.get('server_appeals') || {};
                            const userAppeal = appeals[targetUser.id];

                            let canAppeal = true;
                            if (userAppeal && userAppeal.status === 'denied') {
                                const timeSinceDenial = Date.now() - userAppeal.denied_at;
                                const oneHour = 60 * 60 * 1000;
                                canAppeal = timeSinceDenial >= oneHour;
                            }

                            if (canAppeal) {
                                const appealButton = new ButtonBuilder()
                                    .setCustomId(`request_unban_${targetUser.id}`)
                                    .setLabel('Request Unban')
                                    .setStyle(ButtonStyle.Primary);

                                const actionRow = new ActionRowBuilder().addComponents(appealButton);
                                await targetUser.send({ embeds: [banEmbed], components: [actionRow] });
                            } else {
                                // Remove appeal button if cooldown active
                                await targetUser.send({ embeds: [banEmbed] });
                            }
                        } catch (dmError) {
                            console.error('Failed to send ban DM:', dmError);
                        }
                        await member.ban({ reason: `Received ${maxWarnings} warnings - Last reason: ${reason}` });
                        db.warnings.delete(targetUser.id);
                    } catch (banError) {
                        console.error('Error banning user:', banError);
                        responseEmbed.addFields({ name: '❌ Error', value: 'Error banning user. I may not have sufficient permissions.', inline: false });
                    }
                } else {
                    responseEmbed.addFields({ name: '⚠️ Warning', value: 'User has reached maximum warnings but cannot be banned. Please handle manually.', inline: false });
                    await utils.logAction(interaction.guild, `⚠️ ${targetUser.tag} reached ${maxWarnings} warnings but cannot be banned`);
                    if (logger) {
                        await logger.logWarn('User Reached Max Warnings (Cannot Ban)', {
                            User: `${targetUser.tag} (${targetUser.id})`,
                            Warnings: maxWarnings,
                            Reason: 'User cannot be banned (permissions)',
                            Guild: `${interaction.guild.name} (${interaction.guild.id})`
                        }, 'Moderation');
                    }
                }
            }

            await interaction.reply({ embeds: [responseEmbed] });
            await utils.logAction(interaction.guild, `⚠️ ${interaction.user.tag} warned ${targetUser.tag}: ${reason} (${newWarningCount}/${maxWarnings})`);
            
            if (logger) {
                await logger.logModeration('User Warned', interaction.user, targetUser, {
                    Reason: reason,
                    WarningCount: `${newWarningCount}/${maxWarnings}`,
                    DMSent: dmSent ? 'Yes' : 'No',
                    Guild: `${interaction.guild.name} (${interaction.guild.id})`
                });
            }

        } catch (error) {
            console.error('Error in warn command:', error);
            const errorEmbed = new EmbedBuilder()
                .setColor('Red')
                .setDescription('❌ Error issuing warning. Please try again.');
            if (!interaction.replied) {
                await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
            }
        }
        return;
    }

    // --- /clear ---
    if (interaction.commandName === 'clear') {
        if (!interaction.member.permissions.has('ManageMessages')) {
            const errorEmbed = new EmbedBuilder()
                .setColor('Red')
                .setDescription('❌ You do not have permission to clear messages.');
            return interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        }

        const amount = interaction.options.getInteger('amount');
        const targetUser = interaction.options.getUser('user');

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            let messages;
            if (targetUser) {
                const fetched = await interaction.channel.messages.fetch({ limit: 100 });
                const filteredArray = fetched.filter(msg => msg.author.id === targetUser.id).first(amount);
                messages = new (require('discord.js').Collection)();
                if (filteredArray && filteredArray.length > 0) {
                     filteredArray.forEach(msg => messages.set(msg.id, msg));
                } else {
                    // اگر آرایه خالی بود یا فقط یک آبجکت برگرداند (در نسخه‌های جدیدتر first ممکنه تکی برگردونه)
                    if (filteredArray && !Array.isArray(filteredArray)) messages.set(filteredArray.id, filteredArray);
                }
            } else {
                messages = await interaction.channel.messages.fetch({ limit: amount });
            }

            if (messages.size === 0) {
                const errorEmbed = new EmbedBuilder()
                    .setColor('Red')
                    .setDescription(`❌ ${targetUser ? `No old messages from ${targetUser.tag} found` : 'No messages found to delete'}.`);
                return interaction.editReply({ embeds: [errorEmbed] });
            }

            const deleted = await interaction.channel.bulkDelete(messages, true);
            
            if (deleted.size === 0) {
                const errorEmbed = new EmbedBuilder()
                    .setColor('Orange')
                    .setDescription('⚠️ Messages are too old (over 14 days) and cannot be deleted.');
                return interaction.editReply({ embeds: [errorEmbed] });
            }

            const successEmbed = new EmbedBuilder()
                .setColor('Green')
                .setTitle('🗑️ Messages Cleared')
                .setDescription(`✅ ${deleted.size} message${targetUser ? ` from ${targetUser.tag}` : ''} cleared.`);

            await interaction.editReply({ embeds: [successEmbed] });
            await utils.logAction(interaction.guild, `🗑️ ${interaction.user.tag} cleared ${deleted.size} message${targetUser ? ` from ${targetUser.tag}` : ''} in ${interaction.channel.name}.`);
            
            if (logger) {
                await logger.logModeration('Messages Cleared', interaction.user, 
                    targetUser || { tag: 'All Users', id: '0' }, {
                    Count: deleted.size,
                    Channel: `${interaction.channel.name} (${interaction.channel.id})`,
                    Guild: `${interaction.guild.name} (${interaction.guild.id})`
                });
            }
            
        } catch (error) {
            console.error('Clear command error:', error);
            const errorEmbed = new EmbedBuilder()
                .setColor('Red')
                .setDescription('❌ Error clearing messages. Messages might be too old.');
            await interaction.editReply({ embeds: [errorEmbed] });
        }
        return;
    }

    // --- /userinfo ---
    if (interaction.commandName === 'userinfo') {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const now = Date.now();
        const created = targetUser.createdTimestamp;
        const diffMs = now - created;
        const years = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365));
        let agoText = '';
        if (years > 0) {
            agoText = ` (${years} years ago)`;
        } else {
            const months = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30));
            if (months > 0) agoText = ` (${months} months ago)`;
        }
        try {
            const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
            const embed = new EmbedBuilder()
                .setColor('#3498DB')
                .setTitle(`🔍 ${targetUser.username}'s Information`)
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
                .addFields(
                    { name: '👤 Username', value: targetUser.tag, inline: true },
                    { name: '🆔 User ID', value: targetUser.id, inline: true },
                    { name: '📅 Account Created', value: `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:F>${agoText}`, inline: false }
                );
            if (member) {
                embed.addFields(
                    { name: '📥 Joined Server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>`, inline: false },
                    { name: '🏷️ Roles', value: member.roles.cache.filter(role => role.id !== interaction.guild.id).map(role => `<@&${role.id}>`).join(' ') || 'No roles', inline: false }
                );
                if (member.premiumSince) {
                    embed.addFields({ name: '💎 Nitro Boost Started', value: `<t:${Math.floor(member.premiumSince.getTime() / 1000)}:F>`, inline: false });
                }
            } else {
                embed.addFields({ name: '❌ Status', value: 'User not in server', inline: false });
            }
            embed.setTimestamp();
            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Userinfo command error:', error);
            const errorEmbed = new EmbedBuilder()
                .setColor('Red')
                .setDescription('❌ Error fetching user information.');
            await interaction.reply({ embeds: [errorEmbed] });
        }
        return;
    }

    // --- /kick ---
    if (interaction.commandName === 'kick') {
        if (!interaction.member.permissions.has('KickMembers')) {
            return await InteractionUtils.sendError(interaction, 'You do not have permission to kick users.');
        }

        const targetUser = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason specified';

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const member = await interaction.guild.members.fetch(targetUser.id);
            if (!member) {
                return await InteractionUtils.sendError(interaction, 'User not found in server.', true);
            }

            if (member.permissions.has('KickMembers') || member.permissions.has('Administrator') || member.id === interaction.guild.ownerId) {
                return await InteractionUtils.sendError(interaction, 'You cannot kick administrators, moderators, or the server owner.', true);
            }

            if (!member.kickable) {
                return await InteractionUtils.sendError(interaction, 'This user cannot be kicked. They may have a higher role.', true);
            }

            await member.kick(reason);
            
            const successEmbed = new EmbedBuilder()
                .setColor('Orange')
                .setTitle('🚪 User Kicked')
                .setDescription(`User **${targetUser.tag}** has been successfully kicked.`)
                .addFields(
                    { name: 'Reason', value: reason, inline: true },
                    { name: 'By', value: interaction.user.tag, inline: true }
                );

            await interaction.editReply({ embeds: [successEmbed] });
            await utils.logAction(interaction.guild, `🚪 ${targetUser.tag} was kicked by ${interaction.user.tag}. Reason: ${reason}`);
            
            if (logger) {
                await logger.logModeration('User Kicked', interaction.user, targetUser, {
                    Reason: reason,
                    Guild: `${interaction.guild.name} (${interaction.guild.id})`
                });
            }
            
        } catch (error) {
            console.error('Kick command error:', error);
            const errorEmbed = new EmbedBuilder()
                .setColor('Red')
                .setDescription('❌ Error kicking user.');
            await interaction.editReply({ embeds: [errorEmbed] });
        }
        return;
    }

    // --- /ban ---
    if (interaction.commandName === 'ban') {
        if (!interaction.member.permissions.has('BanMembers')) {
            return await InteractionUtils.sendError(interaction, 'You do not have permission to ban users.');
        }

        const targetUser = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason specified';
        const deleteDays = interaction.options.getInteger('deletedays') || 0;

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

            if (member && (member.permissions.has('BanMembers') || member.permissions.has('Administrator') || member.id === interaction.guild.ownerId)) {
                const errorEmbed = new EmbedBuilder()
                    .setColor('Red')
                    .setDescription('❌ You cannot ban administrators, moderators, or the server owner.');
                return interaction.editReply({ embeds: [errorEmbed] });
            }

            if (member && !member.bannable) {
                const errorEmbed = new EmbedBuilder()
                    .setColor('Red')
                    .setDescription('❌ This user cannot be banned. They may have a higher role.');
                return interaction.editReply({ embeds: [errorEmbed] });
            }

            await interaction.guild.members.ban(targetUser.id, {
                reason: reason,
                deleteMessageSeconds: deleteDays * 86400
            });

            // Send DM to banned user with appeal button
            try {
                const banEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('Banned from Server')
                    .setDescription(`You have been banned from **${interaction.guild.name}** for: **${reason}**`)
                    .addFields(
                        { name: '📋 Appeal Process', value: 'If you believe this ban was made in error, you can request an unban by clicking the button below.', inline: false },
                        { name: '⏰ Next Attempt', value: 'You can submit another appeal request in 1 hour if your previous request was denied.', inline: false }
                    )
                    .setTimestamp();

                // Check if user can appeal (not denied recently)
                const appeals = db.moderation.get('server_appeals') || {};
                const userAppeal = appeals[targetUser.id];

                let canAppeal = true;
                if (userAppeal && userAppeal.status === 'denied') {
                    const timeSinceDenial = Date.now() - userAppeal.denied_at;
                    const oneHour = 60 * 60 * 1000;
                    canAppeal = timeSinceDenial >= oneHour;
                }

                if (canAppeal) {
                    const appealButton = new ButtonBuilder()
                        .setCustomId(`request_unban_${targetUser.id}`)
                        .setLabel('Request Unban')
                        .setStyle(ButtonStyle.Primary);

                    const actionRow = new ActionRowBuilder().addComponents(appealButton);
                    await targetUser.send({ embeds: [banEmbed], components: [actionRow] });
                } else {
                    // Remove appeal button if cooldown active
                    await targetUser.send({ embeds: [banEmbed] });
                }
            } catch (dmError) {
                console.error('Failed to send ban DM:', dmError);
            }

            const successEmbed = new EmbedBuilder()
                .setColor('Red')
                .setTitle('🔨 User Banned')
                .setDescription(`User **${targetUser.tag}** has been successfully banned.`)
                .addFields(
                    { name: 'Reason', value: reason, inline: true },
                    { name: 'By', value: interaction.user.tag, inline: true },
                    { name: 'Messages Deleted', value: `${deleteDays} days`, inline: true }
                );

            await interaction.editReply({ embeds: [successEmbed] });
            await utils.logAction(interaction.guild, `🔨 ${targetUser.tag} was banned by ${interaction.user.tag}. Reason: ${reason}`);

            if (logger) {
                await logger.logModeration('User Banned', interaction.user, targetUser, {
                    Reason: reason,
                    DeleteDays: deleteDays,
                    Guild: `${interaction.guild.name} (${interaction.guild.id})`
                });
            }

        } catch (error) {
            console.error('Ban command error:', error);
            const errorEmbed = new EmbedBuilder()
                .setColor('Red')
                .setDescription('❌ Error banning user.');
            await interaction.editReply({ embeds: [errorEmbed] });
        }
        return;
    }

    // --- /unban ---
    if (interaction.commandName === 'unban') {
        if (!interaction.member.permissions.has('BanMembers')) {
            return await InteractionUtils.sendError(interaction, 'You do not have permission to unban users.');
        }

        const userId = interaction.options.getString('userid');
        const reason = interaction.options.getString('reason') || 'No reason specified';

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const banList = await interaction.guild.bans.fetch();
            const bannedUser = banList.get(userId);
            
            if (!bannedUser) {
                return await InteractionUtils.sendError(interaction, 'This user is not banned or the ID is incorrect.', true);
            }

            await interaction.guild.members.unban(userId, reason);

            const successEmbed = new EmbedBuilder()
                .setColor('Green')
                .setTitle('✅ User Unbanned')
                .setDescription(`User **${bannedUser.user.tag}** has been unbanned.`)
                .addFields(
                    { name: 'Reason', value: reason, inline: true },
                    { name: 'By', value: interaction.user.tag, inline: true }
                );

            await interaction.editReply({ embeds: [successEmbed] });
            await utils.logAction(interaction.guild, `✅ ${bannedUser.user.tag} was unbanned by ${interaction.user.tag}. Reason: ${reason}`);
            
            if (logger) {
                await logger.logModeration('User Unbanned', interaction.user, bannedUser.user, {
                    Reason: reason,
                    Guild: `${interaction.guild.name} (${interaction.guild.id})`
                });
            }
            
        } catch (error) {
            console.error('Unban command error:', error);
            const errorEmbed = new EmbedBuilder()
                .setColor('Red')
                .setDescription('❌ Error unbanning user. Please check my permissions.');
            await interaction.editReply({ embeds: [errorEmbed] });
        }
        return;
    }

    // --- /security ---
    if (interaction.commandName === 'security') {
        if (!securityCommands) {
            return await InteractionUtils.sendError(interaction, 'Security system is not available in this environment. Security modules are not installed.', true);
        }
        return await securityCommands.handleSecurityCommand(interaction);
    }

// --- /poll ---
    if (interaction.commandName === 'poll') {
        // بررسی دسترسی
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            return await InteractionUtils.sendError(interaction, 'شما دسترسی لازم برای ایجاد نظرسنجی را ندارید.');
        }

        const question = interaction.options.getString('question');
        const optionsString = interaction.options.getString('options');
        const durationStr = interaction.options.getString('duration');
        const channel = interaction.options.getChannel('channel') || interaction.channel;

        // پردازش گزینه‌ها (جدا کردن با |)
        const optionsList = optionsString.split('|').map(opt => opt.trim()).filter(opt => opt.length > 0);
        
        if (optionsList.length < 2) {
            return await InteractionUtils.sendError(interaction, 'لطفا حداقل ۲ گزینه وارد کنید (گزینه‌ها را با | جدا کنید).', true);
        }
        if (optionsList.length > 5) {
            return await InteractionUtils.sendError(interaction, 'حداکثر ۵ گزینه مجاز است.', true);
        }

        // پردازش زمان
        const ms = utils.ms(durationStr);
        if (!ms || ms < 60000) { // حداقل 1 دقیقه
            return await InteractionUtils.sendError(interaction, 'فرمت زمان نامعتبر است یا کمتر از ۱ دقیقه است. (مثال صحیح: 1h, 30m)', true);
        }

        const endTime = Date.now() + ms;
        const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];

        // آماده‌سازی گزینه‌ها برای ذخیره و نمایش
        const pollOptions = optionsList.map((opt, index) => ({
            name: opt,
            votes: 0,
            emoji: emojis[index]
        }));

        // ساخت متن پیام نظرسنجی
        const description = pollOptions.map((opt, i) => `${emojis[i]} **${opt.name}**`).join('\n\n');

        const embed = new EmbedBuilder()
            .setColor('#3498DB')
            .setTitle(`📊 نظرسنجی: ${question}`)
            .setDescription(description + `\n\n⏱️ پایان: <t:${Math.floor(endTime / 1000)}:R>`)
            .setFooter({ text: `ایجاد شده توسط ${interaction.user.tag}` })
            .setTimestamp();

        // ساخت دکمه‌های رأی‌گیری
        const row = new ActionRowBuilder();
        pollOptions.forEach((opt, index) => {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`poll_vote_${index}`)
                    .setEmoji(opt.emoji)
                    .setStyle(ButtonStyle.Secondary)
            );
        });

        try {
            const msg = await channel.send({ embeds: [embed], components: [row] });
            
            // ذخیره در دیتابیس
            db.polls.set(msg.id, {
                channelId: channel.id,
                messageId: msg.id,
                question: question,
                options: pollOptions,
                endTime: endTime,
                ended: false,
                voters: {} 
            });

            await InteractionUtils.sendSuccess(interaction, `نظرسنجی با موفقیت در ${channel} ایجاد شد.`);
            
            // فعال‌سازی تایمر چک کردن نظرسنجی‌ها
            utils.checkPolls(); 

        } catch (error) {
            console.error(error);
            await InteractionUtils.sendError(interaction, 'خطا در ارسال نظرسنجی.', true);
        }
        return;
    }

    // --- /send_account ---
    if (interaction.commandName === 'send_account') {
        // بررسی دسترسی ادمین
        if (!interaction.member.permissions.has('Administrator')) {
            return await InteractionUtils.sendError(interaction, 'شما دسترسی لازم برای ارسال اطلاعات اکانت را ندارید.');
        }

        const mail = interaction.options.getString('mail');
        const recovery = interaction.options.getString('recovery_code');
        const accNum = interaction.options.getString('account_num');
        const user = interaction.options.getString('username') || 'N/A';
        const pass = interaction.options.getString('password') || 'N/A';

        const embed = new EmbedBuilder()
            .setColor('Green')
            .setTitle('🛍️ اطلاعات اکانت خریداری شده')
            .addFields(
                { name: '📧 ایمیل', value: `\`${mail}\``, inline: true },
                { name: '🔑 کد بازیابی', value: `\`${recovery}\``, inline: true },
                { name: '🔢 شماره اکانت', value: `\`${accNum}\``, inline: true },
                { name: '👤 نام کاربری', value: `\`${user}\``, inline: true },
                { name: '🔒 رمز عبور', value: `\`||${pass}||\``, inline: true }
            )
            .setFooter({ text: 'از خرید شما متشکریم!' })
            .setTimestamp();

        // ارسال پیام (معمولاً در تیکت استفاده می‌شود)
        await interaction.reply({ embeds: [embed] });
        return;
    }

    // --- /serverinfo ---
    if (interaction.commandName === 'serverinfo') {
        await interaction.deferReply();

        try {
            const guild = interaction.guild;
            const owner = await guild.fetchOwner();
            const channels = guild.channels.cache;
            const roles = guild.roles.cache;
            
            const embed = new EmbedBuilder()
                .setColor('#3498DB')
                .setTitle(`🏰 Server Information - ${guild.name}`)
                .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }))
                .addFields(
                    { name: '👑 Server Owner', value: owner.user.tag, inline: true },
                    { name: '🆔 Server ID', value: guild.id, inline: true },
                    { name: '📅 Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`, inline: false },
                    { name: '👥 Members', value: guild.memberCount.toString(), inline: true },
                    { name: '🤖 Bots', value: guild.members.cache.filter(member => member.user.bot).size.toString(), inline: true },
                    { name: '💬 Total Channels', value: channels.size.toString(), inline: true },
                    { name: '📝 Text Channels', value: channels.filter(ch => ch.type === 0).size.toString(), inline: true },
                    { name: '🔊 Voice Channels', value: channels.filter(ch => ch.type === 2).size.toString(), inline: true },
                    { name: '📋 Categories', value: channels.filter(ch => ch.type === 4).size.toString(), inline: true },
                    { name: '🏷️ Roles', value: roles.size.toString(), inline: true },
                    { name: '😀 Emojis', value: guild.emojis.cache.size.toString(), inline: true },
                    { name: '🔒 Verification Level', value: guild.verificationLevel.toString(), inline: true }
                )
                .setTimestamp();

            if (guild.banner) {
                embed.setImage(guild.bannerURL({ dynamic: true, size: 1024 }));
            }

            await interaction.editReply({ embeds: [embed] });
            
        } catch (error) {
            console.error('Serverinfo command error:', error);
            const errorEmbed = new EmbedBuilder()
                .setColor('Red')
                .setDescription('❌ Error fetching server information.');
            await interaction.editReply({ embeds: [errorEmbed] });
        }
        return;
    }

    // --- /advertise ---
    if (interaction.commandName === 'advertise') {
        if (!interaction.member.permissions.has('ManageMessages')) {
            return await InteractionUtils.sendError(interaction, 'You do not have permission to send advertisements.');
        }
        
        const targetRole = interaction.options.getRole('target_role');
        const color = interaction.options.getString('color') || 'Blue';
        
        if (!targetRole) {
            return await InteractionUtils.sendError(interaction, 'Target role is required.', true);
        }
        
        // Get all members with the target role
        const membersWithRole = interaction.guild.members.cache.filter(member => 
            member.roles.cache.has(targetRole.id) && !member.user.bot
        );
        
        if (membersWithRole.size === 0) {
            return await InteractionUtils.sendError(interaction, `No members found with role ${targetRole.name}.`, true);
        }
        
        // Create modal for advertisement message
        const modal = new ModalBuilder()
            .setCustomId(`advertise_modal_${targetRole.id}_${color}`)
            .setTitle(`Send Advertisement to ${targetRole.name}`)
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('advertise_title')
                        .setLabel('Advertisement Title')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('Enter your advertisement title...')
                        .setRequired(true)
                        .setMaxLength(256)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('advertise_message')
                        .setLabel('Advertisement Message')
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder('Enter your advertisement message...')
                        .setRequired(true)
                        .setMaxLength(2000)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('advertise_button_text')
                        .setLabel('Button Text (Optional)')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('e.g., Visit Shop, Learn More...')
                        .setRequired(false)
                        .setMaxLength(80)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('advertise_button_link')
                        .setLabel('Button Link (Optional)')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('https://example.com')
                        .setRequired(false)
                        .setMaxLength(500)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('advertise_image_url')
                        .setLabel('Image URL (Optional)')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('https://example.com/image.jpg')
                        .setRequired(false)
                        .setMaxLength(500)
                )
            );
        
        await interaction.showModal(modal);
        return;
    }

    // --- /add_card ---
if (interaction.commandName === 'add_card') {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return await InteractionUtils.sendError(interaction, 'You do not have permission to add cards.');
        }

        const modal = new ModalBuilder()
            .setCustomId('add_card_modal')
            .setTitle('افزودن کارت بانکی')
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('card_number')
                        .setLabel('شماره کارت')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('شماره کارت ۱۶ رقمی')
                        .setRequired(true)
                        .setMaxLength(16)
                        .setMinLength(16)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('card_holder')
                        .setLabel('نام صاحب کارت')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('نام و نام خانوادگی')
                        .setRequired(true)
                        .setMaxLength(50)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('bank_name')
                        .setLabel('نام بانک')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('مثال: بانک ملت')
                        .setRequired(true)
                        .setMaxLength(30)
                )
            );

        await interaction.showModal(modal);
        return;
    }

    // --- /list_cards ---
 if (interaction.commandName === 'list_cards') {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return await InteractionUtils.sendError(interaction, 'You do not have permission to view cards.');
        }

        const cards = db.cards.get('all_cards') || [];
        
        if (cards.length === 0) {
            const embed = new EmbedBuilder()
                .setColor('Yellow')
                .setTitle('💳 کارت‌های بانکی')
                .setDescription('هیچ کارتی در دیتابیس موجود نیست.')
                .setTimestamp();
            
            return await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        const embed = new EmbedBuilder()
            .setColor('Blue')
            .setTitle(`💳 لیست کارت‌های بانکی (${cards.length} عدد)`)
            .setTimestamp();

        cards.forEach((card, index) => {
            const maskedNumber = `${card.card_number.slice(0, 4)}-****-****-${card.card_number.slice(-4)}`;
            embed.addFields({
                name: `کارت #${index + 1} - ${card.bank_name}`,
                value: `**صاحب کارت:** ${card.card_holder}\n**شماره:** ${maskedNumber}\n**ثبت:** <t:${Math.floor(card.added_at / 1000)}:R>`,
                inline: false
            });
        });

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

 if (interaction.commandName === 'send_card') {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return await InteractionUtils.sendError(interaction, 'You do not have permission to send cards.');
        }

        const user = interaction.options.getUser('user');
        const channel = interaction.options.getChannel('channel');
        
        if (!user && !channel) {
            return await InteractionUtils.sendError(interaction, 'لطفا کاربر یا کانال مقصد را انتخاب کنید.');
        }

        if (user && channel) {
            return await InteractionUtils.sendError(interaction, 'فقط یکی از گزینه‌های کاربر یا کانال را انتخاب کنید.');
        }

        const cards = db.cards.get('all_cards') || [];
        
        if (cards.length === 0) {
            return await InteractionUtils.sendError(interaction, 'هیچ کارتی در دیتابیس موجود نیست.');
        }

        // برداشتن اولین کارت
        const card = cards[0];
        
        // حذف کارت از دیتابیس
        db.cards.set('all_cards', cards.slice(1));

        try {
            const cardEmbed = new EmbedBuilder()
                .setColor('Green')
                .setTitle('💳 اطلاعات کارت جهت واریز')
                .setDescription('لطفاً مبلغ مورد نظر را به شماره کارت زیر واریز کنید.')
                .addFields(
                    { name: '🏦 نام بانک', value: card.bank_name, inline: true },
                    { name: '👤 صاحب کارت', value: card.card_holder, inline: true },
                    { name: '🔢 شماره کارت', value: `\`${card.card_number}\``, inline: false }
                )
                .setFooter({ text: 'این کارت یک‌بار مصرف بود و از سیستم حذف شد.' })
                .setTimestamp();

            let targetName;
            let targetType;

            if (user) {
                await user.send({ embeds: [cardEmbed] });
                targetName = user.tag;
                targetType = 'DM';
            } else if (channel) {
                await channel.send({ embeds: [cardEmbed] });
                targetName = `#${channel.name}`;
                targetType = 'Channel';
            }

            const confirmEmbed = new EmbedBuilder()
                .setColor('Green')
                .setTitle('✅ کارت ارسال شد')
                .setDescription(`اطلاعات کارت با موفقیت برای ${targetName} ارسال شد.`)
                .addFields(
                    { name: 'بانک', value: card.bank_name, inline: true },
                    { name: 'باقیمانده کارت‌ها', value: `${cards.length - 1}`, inline: true }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [confirmEmbed] });

            if (logger) {
                await logger.logInfo('Card Sent', {
                    Sender: `${interaction.user.tag}`,
                    Target: targetName,
                    Bank: card.bank_name,
                    Remaining: cards.length - 1
                });
            }

        } catch (error) {
            // برگرداندن کارت در صورت خطا
            db.cards.set('all_cards', cards);
            await InteractionUtils.sendError(interaction, `خطا در ارسال کارت: ${error.message}`);
        }

        return;
    }


    // --- /sendmessage ---
    if (interaction.commandName === 'sendmessage') {
        const channel = interaction.options.getChannel('channel');
        const user = interaction.options.getUser('user');
        const useEmbed = interaction.options.getBoolean('embed') || false;
        const color = interaction.options.getString('color') || 'Blue';

        if (channel && user) {
            return await InteractionUtils.sendError(interaction, 'Cannot select both channel and user at the same time. Choose only one.');
        }

        if (!channel && !user) {
            return await InteractionUtils.sendError(interaction, 'Must select at least one channel or user.');
        }

        const targetId = channel ? channel.id : (user ? user.id : interaction.user.id);
        const modal = new ModalBuilder()
            .setCustomId(`sendmessage_modal_${targetId}_${useEmbed}_${color}`)
            .setTitle('Send Custom Message');

        if (useEmbed) {
            const titleInput = new TextInputBuilder()
                .setCustomId('embed_title')
                .setLabel('Embed Title (Optional)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Write your embed title here...')
                .setRequired(false)
                .setMaxLength(256);

            const textInput = new TextInputBuilder()
                .setCustomId('message_text')
                .setLabel('Message Text')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Write your message text here...')
                .setRequired(true)
                .setMaxLength(2000);

            modal.addComponents(
                new ActionRowBuilder().addComponents(titleInput),
                new ActionRowBuilder().addComponents(textInput)
            );
        } else {
            const textInput = new TextInputBuilder()
                .setCustomId('message_text')
                .setLabel('Message Text')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Write your message text here...')
                .setRequired(true)
                .setMaxLength(2000);
            modal.addComponents(new ActionRowBuilder().addComponents(textInput));
        }
        await interaction.showModal(modal);
        return;
    }

    // --- /help ---
    if (interaction.commandName === 'help') {
        try {
            await InteractionUtils.deferReply(interaction, true);

            const docs = {
                readme: (config.docs && config.docs.readmeUrl) || 'https://github.com/RezaNotHere/West-Bot#readme',
                setup: (config.docs && config.docs.setupUrl) || 'https://github.com/RezaNotHere/West-Bot/blob/main/SETUP.md',
                issues: (config.docs && config.docs.issuesUrl) || 'https://github.com/RezaNotHere/West-Bot/issues'
            };

            const introEmbed = new EmbedBuilder()
                .setColor('#2C3E50')
                .setTitle('راهنمای کامل مدیریت بات')
                .setDescription('برای دسترسی سریع، از منوی زیر بخش مورد نظر را انتخاب کنید.')
                .addFields(
                    { name: 'بخش‌ها', value: '• معرفی دستورات مدیریتی\n• راهنمای تنظیمات بات\n• دستورات کاربردی برای ادمین‌ها\n• نکات امنیتی و بهترین روش‌ها' },
                    { name: 'نمونه‌های سریع', value: 'مثال‌ها:\n`/warn user:@User reason:"اسپم"`\n`/clear amount:50`\n`/start-giveaway channel:#announcements duration:1d winners:2 prize:"Nitro"`' }
                )
                .setFooter({ text: 'برای نمایش جزئیات هر بخش، از منوی انتخاب استفاده کنید' })
                .setTimestamp();

            const menu = new StringSelectMenuBuilder()
                .setCustomId('help_menu')
                .setPlaceholder('یک بخش را انتخاب کنید')
                .addOptions(
                    { label: 'معرفی دستورات مدیریتی', value: 'moderation_overview', emoji: '🛠️' },
                    { label: 'راهنمای تنظیمات بات', value: 'bot_settings', emoji: '⚙️' },
                    { label: 'دستورات کاربردی برای ادمین‌ها', value: 'admin_util', emoji: '🧰' },
                    { label: 'نکات امنیتی و بهترین روش‌ها', value: 'security_best', emoji: '🛡️' }
                );

            const linksRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('README').setURL(docs.readme),
                new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('SETUP').setURL(docs.setup),
                new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Issues').setURL(docs.issues),
                new ButtonBuilder().setCustomId('help_refresh').setStyle(ButtonStyle.Secondary).setLabel('Refresh')
            );

            const menuRow = new ActionRowBuilder().addComponents(menu);
            const payload = { embeds: [introEmbed], components: [menuRow, linksRow] };

            if (interaction.deferred || interaction.replied) {
                await interaction.editReply(payload);
            } else {
                await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
            }
            return;
        } catch (error) {
            await InteractionUtils.sendError(interaction, 'خطا در اجرای دستور راهنما.', true);
            return;
        }
    }

    // --- /poll ---
if (interaction.commandName === 'poll') {
    // بررسی دسترسی
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
        return await InteractionUtils.sendError(interaction, 'شما دسترسی لازم برای ایجاد نظرسنجی را ندارید.');
    }

    const question = interaction.options.getString('question');
    const optionsString = interaction.options.getString('options');
    const durationStr = interaction.options.getString('duration');
    const channel = interaction.options.getChannel('channel') || interaction.channel;

    // پردازش گزینه‌ها
    const optionsList = optionsString.split('|').map(opt => opt.trim()).filter(opt => opt.length > 0);
    
    if (optionsList.length < 2) {
        return await InteractionUtils.sendError(interaction, 'لطفا حداقل ۲ گزینه وارد کنید (با | جدا کنید).', true);
    }
    if (optionsList.length > 5) {
        return await InteractionUtils.sendError(interaction, 'حداکثر ۵ گزینه مجاز است.', true);
    }

    // پردازش زمان
    const ms = utils.ms(durationStr);
    if (!ms || ms < 60000) { // حداقل 1 دقیقه
        return await InteractionUtils.sendError(interaction, 'فرمت زمان نامعتبر است یا کمتر از ۱ دقیقه است. (مثال: 1h)', true);
    }

    const endTime = Date.now() + ms;
    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];

    // ساخت گزینه‌ها برای دیتابیس و نمایش
    const pollOptions = optionsList.map((opt, index) => ({
        name: opt,
        votes: 0,
        emoji: emojis[index]
    }));

    // ساخت متن امبد
    const description = pollOptions.map((opt, i) => `${emojis[i]} **${opt.name}**`).join('\n\n');

    const embed = new EmbedBuilder()
        .setColor('#3498DB')
        .setTitle(`📊 نظرسنجی: ${question}`)
        .setDescription(description + `\n\n⏱️ پایان: <t:${Math.floor(endTime / 1000)}:R>`)
        .setFooter({ text: `ایجاد شده توسط ${interaction.user.tag}` })
        .setTimestamp();

    // ساخت دکمه‌ها
    const row = new ActionRowBuilder();
    pollOptions.forEach((opt, index) => {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`poll_vote_${index}`)
                .setEmoji(opt.emoji)
                .setStyle(ButtonStyle.Secondary)
        );
    });

    try {
        const msg = await channel.send({ embeds: [embed], components: [row] });
        
        // ذخیره در دیتابیس
        db.polls.set(msg.id, {
            channelId: channel.id,
            messageId: msg.id,
            question: question,
            options: pollOptions,
            endTime: endTime,
            ended: false,
            voters: {} // برای جلوگیری از رای تکراری: { userId: optionIndex }
        });

        await InteractionUtils.sendSuccess(interaction, `نظرسنجی با موفقیت در ${channel} ایجاد شد.`);
        
        // اطمینان از اینکه تایمر چک کردن نظرسنجی‌ها فعال است
        utils.checkPolls(); 

    } catch (error) {
        console.error(error);
        await InteractionUtils.sendError(interaction, 'خطا در ارسال نظرسنجی.', true);
    }
}

}

async function handleTextCommand(message, commandName, args) {
    // Basic text command handler - most functionality is now in slash commands
    try {
        const config = require('../configManager');

        // Simple help command
        if (commandName === 'help') {
            const embed = new EmbedBuilder()
                .setColor('#3498DB')
                .setTitle('🤖 Bot Help')
                .setDescription('This bot now uses slash commands! Try typing `/` to see available commands.')
                .addFields(
                    { name: '📋 Available Commands', value: 'Use `/` to browse all slash commands', inline: false }
                )
                .setFooter({ text: 'Prefix commands are deprecated, please use slash commands instead.' })
                .setTimestamp();

            await message.reply({ embeds: [embed] });
            return;
        }

        // For any other text command, suggest using slash commands
        const embed = new EmbedBuilder()
            .setColor('Orange')
            .setTitle('⚠️ Command Not Found')
            .setDescription(`The command \`${config.bot.prefix}${commandName}\` was not found.`)
            .addFields(
                { name: '💡 Try Slash Commands', value: 'Most commands are now available as slash commands. Type `/` to see them!', inline: false }
            )
            .setFooter({ text: 'Text commands are deprecated in favor of slash commands.' })
            .setTimestamp();

        await message.reply({ embeds: [embed] });

        // Log the command attempt
        if (logger) {
            await logger.logWarn('Text Command Not Found', {
                Command: commandName,
                Args: args.join(' '),
                User: `${message.author.tag} (${message.author.id})`,
                Channel: `${message.channel.name} (${message.channel.id})`,
                Guild: `${message.guild?.name} (${message.guild?.id})` || 'DM'
            }, 'Command');
        }

    } catch (error) {
        console.error('Error handling text command:', error);
        if (logger) {
            await logger.logError(error, 'Text Command Handler', {
                Command: commandName,
                Args: args.join(' '),
                User: `${message.author.tag} (${message.author.id})`,
                Channel: `${message.channel.name} (${message.channel.id})`,
                Guild: `${message.guild?.name} (${message.guild?.id})` || 'DM'
            });
        }

        try {
            await message.reply('❌ An error occurred while processing your command.');
        } catch (replyError) {
            console.error('Failed to send error reply:', replyError);
        }
    }
}

module.exports = {
    handleSlashCommand,
    handleTextCommand,
    setLogger,
    setSecurity
};
