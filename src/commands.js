// commands.js
// Slash command and message command handlers
const { 
    EmbedBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle,
    ActionRowBuilder
} = require('discord.js');

const { db } = require('./database');
const utils = require('./utils');
const InteractionUtils = require('./utils/InteractionUtils');
const config = require('../configManager');
const { ValidationError, PermissionError } = require('./errors/BotError');

let logger = null;
let security = null;

const setLogger = (l) => { logger = l; }
const setSecurity = (s) => { security = s; }

async function handleSlashCommand(interaction) {
    // --- /mcinfo ---
    if (interaction.commandName === 'mcinfo') {
        await InteractionUtils.deferReply(interaction, true);
        const username = interaction.options.getString("username")?.trim();
        // Validate config variables
        if (!config.apis || !config.apis.mojang) {
            await InteractionUtils.sendError(interaction, "Mojang API key is not configured.", true);
            return;
        }
        try {
            const mojangData = await utils.getMojangData(username, logger);
            if (!mojangData) {
                throw new Error("Minecraft account not found.");
            }
            // Centralized cape list
            const minecraftCapes = [
                { label: 'Migrator Cape', value: 'migrator' },
                { label: 'Vanilla Cape', value: 'vanilla' },
                { label: 'Pan Cape', value: 'pan' },
                { label: 'Common Cape', value: 'common' },
                { label: 'MineCon 2011 Cape', value: 'minecon2011' },
                { label: 'MineCon 2012 Cape', value: 'minecon2012' },
                { label: 'MineCon 2013 Cape', value: 'minecon2013' },
                { label: 'MineCon 2015 Cape', value: 'minecon2015' },
                { label: 'MineCon 2016 Cape', value: 'minecon2016' },
                { label: 'Mojang Cape (Old)', value: 'mojangOld' },
                { label: 'Mojang Studios Cape', value: 'mojangStudios' },
                { label: 'Translator Cape', value: 'translator' },
                { label: 'Mojira Moderator Cape', value: 'mojiraMod' },
                { label: 'Cobalt Cape', value: 'cobalt' }
            ];
            const capeEmbed = new EmbedBuilder()
                .setColor(0x00b894)
                .setTitle('🎮 Select Account Capes')
                .setDescription('Please select the desired capes. After selection, the profile image will be created with those capes.')
                .setFooter({ text: 'Minecraft Cape Selector'})
                .setTimestamp();
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('select_capes')
                .setPlaceholder('Select Capes (Multiple selection allowed)')
                .setMinValues(0)
                .setMaxValues(minecraftCapes.length)
                .addOptions(minecraftCapes);
            const row = new ActionRowBuilder().addComponents(selectMenu);
            await interaction.editReply({
                embeds: [capeEmbed],
                components: [row],
                ephemeral: true
            });
            return;
        } catch (error) {
            if (logger) {
                logger.logCommandError(error, 'mcinfo', interaction);
            }
            let msg = "Error fetching information.";
            if (error.code === 'ECONNABORTED') msg = "Request timeout.";
            else if (error.response?.status === 429) msg = "Too many requests.";
            else if (error.response?.status === 403) msg = "Invalid API key.";
            await InteractionUtils.sendError(interaction, msg, true);
            return;
        }
    }

    // --- /addbadword ---
    if (interaction.commandName === 'addbadword') {
        if (!interaction.member.permissions.has('Administrator')) {
            return await InteractionUtils.sendError(interaction, 'You do not have permission to use this command.');
        }
        const word = interaction.options.getString('word');
        utils.addBadWord(word);
        await InteractionUtils.sendSuccess(interaction, `Banned word "${word}" has been added.`);
        return;
    }

    // --- /removebadword ---
    if (interaction.commandName === 'removebadword') {
        if (!interaction.member.permissions.has('Administrator')) {
            return await InteractionUtils.sendError(interaction, 'You do not have permission to use this command.');
        }
        const word = interaction.options.getString('word');
        utils.removeBadWord(word);
        await InteractionUtils.sendSuccess(interaction, `Banned word "${word}" has been removed.`);
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
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
    }

    // --- /clearwarnings ---
    if (interaction.commandName === 'clearwarnings') {
        if (!interaction.member.permissions.has('ModerateMembers')) {
            return await InteractionUtils.sendError(interaction, 'You do not have permission to use this command.');
        }
        const user = interaction.options.getUser('user');
        utils.clearWarnings(user.id);
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
            console.error('Invites details error:', error);
            await InteractionUtils.sendError(interaction, 'خطا در دریافت اطلاعات دعوت‌ها.', true);
        }
        return;
    }

    // --- /start-giveaway ---
    if (interaction.commandName === 'start-giveaway') {
        try {
            if (!interaction.member.permissions.has('ManageMessages')) {
                throw new PermissionError(
                    'You do not have permission to host giveaways.',
                    'ManageMessages'
                );
            }

            const channel = interaction.options.getChannel('channel');
            const durationStr = interaction.options.getString('duration');
            const winners = interaction.options.getInteger('winners');
            const prize = interaction.options.getString('prize');

            if (!/^\d+[smhd]$/.test(durationStr)) {
                throw new ValidationError(
                    'Invalid duration format. Example: 1h or 30m or 2d',
                    'duration'
                );
            }

            if (winners < 1) {
                throw new ValidationError(
                    'Number of winners must be at least 1.',
                    'winners'
                );
            }

            const ms = utils.ms;
            const durationMs = ms(durationStr);
            
            if (!durationMs || durationMs < 10000) {
                return await InteractionUtils.sendError(interaction, 'Duration must be at least 10 seconds.');
            }
            const endTime = Date.now() + durationMs;
            const embed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle('🎉 Server Giveaway!')
                .setDescription(`Click 🎉 to join the giveaway!\n\n**Prize:** ${prize}\n**Winners:** ${winners}\n**Ends:** <t:${Math.floor(endTime/1000)}:R>\n👤 Host: <@${interaction.user.id}>\n\n👥 Participants so far: **0 people**`)
                .setFooter({ text: 'Click the button below to join the giveaway.' })
                .setTimestamp();
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('join_giveaway').setLabel('Join Giveaway').setStyle(ButtonStyle.Success).setEmoji('🎉')
            );
            const msg = await channel.send({ embeds: [embed], components: [row] });
            
            db.giveaways.set(msg.id, {
                channelId: channel.id,
                prize,
                winnerCount: winners,
                endTime,
                ended: false,
                participants: [],
                host: interaction.user.id
            });
            await interaction.reply({ content: `Giveaway created successfully! [View](${msg.url})`, ephemeral: true });
            require('./utils').checkGiveaways();
            return;
        } catch (error) {
            if (logger) {
                logger.logCommandError(error, 'start-giveaway', interaction);
            }
            await InteractionUtils.sendError(interaction, 'Error creating giveaway.', true);
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
        await interaction.reply({ content: 'New winners have been selected.', ephemeral: true });
        return;
    }

    // --- Join Giveaway (Button Interaction) ---
    if (interaction.customId === 'join_giveaway') {
        const giveaway = db.giveaways.find(g => g.channelId === interaction.channel.id && !g.ended);
        if (!giveaway) {
            return await InteractionUtils.sendError(interaction, 'Active giveaway not found.');
        }
        if (!giveaway.participants) giveaway.participants = [];
        if (giveaway.participants.includes(interaction.user.id)) {
            return await InteractionUtils.sendError(interaction, 'You have already joined this giveaway.');
        }
        giveaway.participants.push(interaction.user.id);
        db.giveaways.set(interaction.message.id, giveaway);

        const msg = await interaction.channel.messages.fetch(interaction.message.id).catch(() => null);
        if (msg && msg.embeds && msg.embeds[0]) {
            const oldEmbed = msg.embeds[0];
            let newDesc = oldEmbed.description || '';
            if (newDesc.includes('👥 Participants so far:')) {
                newDesc = newDesc.replace(/👥 Participants so far: \*\*\d+ people\*\*/, `👥 Participants so far: **${giveaway.participants.length} people**`);
            } else {
                newDesc += `\n\n👥 Participants so far: **${giveaway.participants.length} people**`;
            }
            const newEmbed = EmbedBuilder.from(oldEmbed).setDescription(newDesc);
            await msg.edit({ embeds: [newEmbed], components: msg.components });
        }
        await InteractionUtils.sendSuccess(interaction, 'You have successfully joined the giveaway! Good luck! 🎉');
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
            console.error('Role stats error:', error);
            await InteractionUtils.sendError(interaction, 'خطا در دریافت آمار رول‌ها.', true);
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
            console.error('Invites leaderboard error:', error);
            await InteractionUtils.sendError(interaction, 'خطا در دریافت اطلاعات دعوت‌ها.', true);
        }
        return;
    }

    // --- /sentrolemenu ---
    if (interaction.commandName === 'sentrolemenu') {
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
            .setFooter({ text: 'Click the respective button to enable/disable each role.' })
            .setTimestamp();
        const row = new ActionRowBuilder().addComponents(
            ...roles.map(r => new ButtonBuilder().setCustomId(`rolebtn_${r.id}`).setLabel(r.label).setStyle(r.color).setEmoji(r.emoji))
        );
        try {
            await interaction.reply({ embeds: [embed], components: [row] });
        } catch (error) {
            console.error(`Error sending sentrolemenu message: ${error.message}`);
        }
        return;
    }

    // --- /sendticketmenu ---
    if (interaction.commandName === 'sendticketmenu') {
        if (!interaction.channel || interaction.channel.type !== 0) {
            return await InteractionUtils.sendError(interaction, 'This command can only be used in text channels.');
        }
        if (!interaction.member.permissions.has('ManageChannels')) {
            return await InteractionUtils.sendError(interaction, 'You do not have permission to send the ticket menu.');
        }

        const ticketConfig = config.ticketSystem;
        const embed = new EmbedBuilder()
            .setColor(config.colors.primary || '#5865F2')
            .setTitle(ticketConfig.menu.title)
            .setDescription(ticketConfig.menu.description)
            .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL({ dynamic: true }) })
            .setTimestamp();

        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('ticket_select')
                .setPlaceholder(ticketConfig.menu.placeholder)
                .addOptions(ticketConfig.menu.categories)
        );
        await interaction.reply({ embeds: [embed], components: [menu] });
        return;
    }

    // --- /warn ---
    // (این بخش در کد اصلی شکسته بود و اصلاح شد)
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

            const currentWarnings = db.warnings.get(targetUser.id) || 0;
            const newWarningCount = currentWarnings + 1;
            
            db.warnings.set(targetUser.id, newWarningCount);

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
                                .setDescription('You have been banned from the server for receiving 3 warnings. Contact an admin for more information.')
                                .setTimestamp();
                            await targetUser.send({ embeds: [banEmbed] });
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
                }
            }

            await interaction.reply({ embeds: [responseEmbed] });
            await utils.logAction(interaction.guild, `⚠️ ${interaction.user.tag} warned ${targetUser.tag}: ${reason} (${newWarningCount}/${maxWarnings})`);

        } catch (error) {
            console.error('Error in warn command:', error);
            const errorEmbed = new EmbedBuilder()
                .setColor('Red')
                .setDescription('❌ Error issuing warning. Please try again.');
            if (!interaction.replied) {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
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
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        const amount = interaction.options.getInteger('amount');
        const targetUser = interaction.options.getUser('user');

        await interaction.deferReply({ ephemeral: true });

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

        await interaction.deferReply({ ephemeral: true });

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

        await interaction.deferReply({ ephemeral: true });

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

        await interaction.deferReply({ ephemeral: true });

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
            
        } catch (error) {
            console.error('Unban command error:', error);
            const errorEmbed = new EmbedBuilder()
                .setColor('Red')
                .setDescription('❌ Error unbanning user. Please check the user ID.');
            await interaction.editReply({ embeds: [errorEmbed] });
        }
        return;
    }

    // --- /serverinfo ---
    if (interaction.commandName === 'serverinfo') {
        await interaction.deferReply();

        try {
            const { guild } = interaction;
            await guild.fetch();
            
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
            logger.logCommandError(new Error(`Text command not found: ${commandName}`), 'text_command', {
                command: commandName,
                args: args,
                user: message.author.tag
            });
        }

    } catch (error) {
        console.error('Error handling text command:', error);
        if (logger) {
            logger.logCommandError(error, 'text_command', {
                command: commandName,
                args: args
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