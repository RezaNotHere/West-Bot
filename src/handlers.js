// handlers.js
const { db } = require('./database');
const utils = require('./utils');
const { logAction, createTicketChannel } = require('./utils');
const transcript = require('./utils/transcript');
const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionsBitField, MessageFlags, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const config = require('../configManager');

let logger = null;
let security = null;
let configInstance = null;

const setLogger = (l) => { logger = l; }
const setSecurity = (s) => { security = s; }
const setConfig = (c) => { configInstance = c; }

// --- handleButton ---
async function handleButton(interaction, client, env) {
    console.log(`🔘 Button clicked: ${interaction.customId} by ${interaction.user.tag} in channel ${interaction.channel?.name || 'DM'}`);
    
// --- Poll Voting ---
if (interaction.customId.startsWith('poll_vote_')) {
    const optionIndex = parseInt(interaction.customId.split('_')[2]);
    const poll = db.polls.get(interaction.message.id);

    if (!poll || poll.ended) {
        return await safeReply(interaction, { content: '❌ این نظرسنجی به پایان رسیده است.', flags: MessageFlags.Ephemeral });
    }

    if (interaction.customId === 'help_refresh') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
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
        await interaction.editReply({ embeds: [introEmbed], components: [menuRow, linksRow] });
        return;
    }

    if (interaction.customId.startsWith('request_unban_')) {
        const userId = interaction.customId.split('_')[2];
        if (interaction.user.id !== userId) {
            return await interaction.reply({ content: '❌ فقط خودتان می‌توانید درخواست آن‌بن ثبت کنید.', flags: MessageFlags.Ephemeral });
        }

        const appeals = db.moderation.get('server_appeals') || {};
        const existing = appeals[userId];
        const now = Date.now();
        const ONE_HOUR = 60 * 60 * 1000;

        if (existing) {
            if (existing.status === 'pending') {
                return await interaction.reply({ content: '⏳ درخواست قبلی شما در حال بررسی است.', flags: MessageFlags.Ephemeral });
            }
            if (existing.status === 'denied' && (now - (existing.denied_at || 0)) < ONE_HOUR) {
                const remaining = Math.ceil((ONE_HOUR - (now - existing.denied_at)) / (60 * 1000));
                return await interaction.reply({ content: `⏳ لطفاً ${remaining} دقیقه دیگر دوباره تلاش کنید.`, flags: MessageFlags.Ephemeral });
            }
        }

        const modal = new ModalBuilder()
            .setCustomId(`server_unban_modal_${userId}`)
            .setTitle('درخواست آن‌بن سرور')
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('ban_time')
                        .setLabel('ساعت تقریبی بن شدن')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('یکی از موارد: آخرین 1 ساعت | امروز | دیروز | هفته اخیر | نامشخص')
                        .setRequired(true)
                        .setMaxLength(20)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('justification')
                        .setLabel('چرا فکر می‌کنید بن اشتباه بوده؟')
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(true)
                        .setMaxLength(1000)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('prior_warnings')
                        .setLabel('آیا قبلاً اخطار داشتید؟ (بله/خیر/نامشخص)')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(false)
                        .setMaxLength(20)
                )
            );

        await interaction.showModal(modal);
        return;
    }
    // چک کردن رای قبلی کاربر
    const userId = interaction.user.id;
    const previousVoteIndex = poll.voters ? poll.voters[userId] : undefined;

    if (previousVoteIndex !== undefined) {
        if (previousVoteIndex === optionIndex) {
            return await safeReply(interaction, { content: '⚠️ شما قبلاً به این گزینه رای داده‌اید.', flags: MessageFlags.Ephemeral });
        }
        // حذف رای قبلی (تغییر رای)
        poll.options[previousVoteIndex].votes--;
    }

    // ثبت رای جدید
    poll.options[optionIndex].votes++;
    if (!poll.voters) poll.voters = {};
    poll.voters[userId] = optionIndex;

    // آپدیت دیتابیس
    db.polls.set(interaction.message.id, poll);

    // آپدیت امبد (اختیاری: برای اینکه اسپم نشود، هر بار آپدیت نکنیم بهتر است، اما برای نمایش زنده آمار می‌توان آپدیت کرد)
    // در اینجا فقط پیام تایید به کاربر می‌دهیم
    
    await safeReply(interaction, { content: `✅ رای شما برای گزینه **${poll.options[optionIndex].name}** ثبت شد.`, flags: MessageFlags.Ephemeral });
    }
    
    // Handle appeal support ban button
    if (interaction.customId.startsWith('appeal_support_ban_')) {
        const userId = interaction.customId.split('_')[3];
        
        // Check if this user is trying to appeal their own ban
        if (interaction.user.id !== userId) {
            return await interaction.reply({ 
                content: '❌ You can only appeal your own support ban.', 
                flags: MessageFlags.Ephemeral 
            });
        }

        // Check cooldown (1 hour after denial)
        const appeals = db.support.get('appeals') || {};
        const userAppeal = appeals[userId];
        
        if (userAppeal && userAppeal.status === 'denied') {
            const timeSinceDenial = Date.now() - userAppeal.denied_at;
            const oneHour = 60 * 60 * 1000;
            
            if (timeSinceDenial < oneHour) {
                const remainingTime = Math.ceil((oneHour - timeSinceDenial) / (60 * 1000));
                return await interaction.reply({ 
                    content: `❌ You must wait ${remainingTime} more minutes before submitting another appeal.`, 
                    flags: MessageFlags.Ephemeral 
                });
            }
        }

        // Create appeal modal
        const modal = new ModalBuilder()
            .setCustomId(`support_appeal_modal_${userId}`)
            .setTitle('Support Ban Appeal')
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('appeal_reason')
                        .setLabel('Why do you think the ban was made in error?')
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder('Please explain why you believe this ban was a mistake...')
                        .setRequired(true)
                        .setMaxLength(1000)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('additional_info')
                        .setLabel('Additional information (optional)')
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder('Any additional context or information you\'d like to provide...')
                        .setRequired(false)
                        .setMaxLength(500)
                )
            );

        await interaction.showModal(modal);
        return;
    }

    // Handle approve/deny appeal buttons
    if (interaction.customId.startsWith('approve_appeal_') || interaction.customId.startsWith('deny_appeal_')) {
        // Check if user has permission to handle appeals
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
            return await interaction.reply({ 
                content: '❌ You do not have permission to handle appeals.', 
                flags: MessageFlags.Ephemeral 
            });
        }

        const userId = interaction.customId.split('_')[2];
        const action = interaction.customId.split('_')[0]; // 'approve' or 'deny'

        try {
            // Get appeal data
            const appeals = db.support.get('appeals') || {};
            const appeal = appeals[userId];
            
            if (!appeal) {
                return await interaction.reply({ 
                    content: '❌ Appeal not found.', 
                    flags: MessageFlags.Ephemeral 
                });
            }

            // Get the user who submitted the appeal
            const targetUser = await interaction.guild.members.fetch(userId).catch(() => null);
            
            if (action === 'approve') {
                // Remove from support bans
                const supportBans = db.support.get('bans') || [];
                const updatedBans = supportBans.filter(ban => ban.user_id !== userId);
                db.support.set('bans', updatedBans);

                // Update appeal status
                appeal.status = 'approved';
                appeal.approved_at = Date.now();
                appeal.approved_by = interaction.user.id;
                appeals[userId] = appeal;
                db.support.set('appeals', appeals);

                // Create invite link
                const invite = await interaction.guild.invites.create(config.channels.welcome || interaction.guild.systemChannelId, {
                    maxUses: 1,
                    maxAge: 3600, // 1 hour
                    reason: `Support ban appeal approved for ${targetUser?.user?.tag || userId}`
                });

                // Notify user
                if (targetUser) {
                    const approveEmbed = new EmbedBuilder()
                        .setColor('Green')
                        .setTitle('✅ Support Ban Appeal Approved')
                        .setDescription('Your support ban appeal has been approved!')
                        .addFields(
                            { name: '🎉 Welcome Back', value: 'You can now create support tickets again.', inline: true },
                            { name: '🔗 Server Invite', value: `[Click here to rejoin the server](${invite.url})`, inline: true },
                            { name: '👮 Approved by', value: interaction.user.tag, inline: true }
                        )
                        .setFooter({ text: 'This invite link expires in 1 hour' })
                        .setTimestamp();

                    await targetUser.send({ embeds: [approveEmbed] }).catch(() => {
                        console.log(`Could not DM user ${userId} about appeal approval`);
                    });
                }

                // Update original message
                const approvedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                    .setColor('Green')
                    .setTitle('✅ Appeal Approved')
                    .addFields(
                        { name: '👤 Approved by', value: interaction.user.tag, inline: true },
                        { name: '⏰ Approved at', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
                        { name: '🎉 User Unbanned', value: 'User can now create support tickets again', inline: false }
                    );

                await interaction.update({ 
                    embeds: [approvedEmbed], 
                    components: [] // Remove buttons
                });

                // Update ban history
                const banHistory = db.moderation.get('history') || {};
                if (banHistory[userId]) {
                    banHistory[userId].appeals_approved = (banHistory[userId].appeals_approved || 0) + 1;
                    banHistory[userId].last_action = Date.now();
                    banHistory[userId].last_action_by = `${interaction.user.tag} (${interaction.user.id})`;
                    db.moderation.set('history', banHistory);
                }

                if (logger) {
                    await logger.logInfo('Support Appeal Approved', {
                        User: `${targetUser?.user?.tag || userId} (${userId})`,
                        ApprovedBy: `${interaction.user.tag} (${interaction.user.id})`,
                        ApprovedAt: Date.now(),
                        OriginalReason: appeal.reason.substring(0, 100)
                    });
                }

            } else if (action === 'deny') {
                // Update appeal status
                appeal.status = 'denied';
                appeal.denied_at = Date.now();
                appeal.denied_by = interaction.user.id;
                appeals[userId] = appeal;
                db.support.set('appeals', appeals);

                // Notify user
                if (targetUser) {
                    const denyEmbed = new EmbedBuilder()
                        .setColor('Red')
                        .setTitle('❌ Support Ban Appeal Denied')
                        .setDescription('Your support ban appeal has been denied.')
                        .addFields(
                            { name: '⏰ Next Attempt', value: 'You can submit another appeal in 1 hour.', inline: true },
                            { name: '👮 Denied by', value: interaction.user.tag, inline: true },
                            { name: '📝 Reason', value: 'Staff has reviewed your appeal and decided to maintain the ban.', inline: false }
                        )
                        .setFooter({ text: 'Contact server administrators for more information' })
                        .setTimestamp();

                    await targetUser.send({ embeds: [denyEmbed] }).catch(() => {
                        console.log(`Could not DM user ${userId} about appeal denial`);
                    });
                }

                // Update original message
                const deniedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                    .setColor('Red')
                    .setTitle('❌ Appeal Denied')
                    .addFields(
                        { name: '👤 Denied by', value: interaction.user.tag, inline: true },
                        { name: '⏰ Denied at', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
                        { name: '🚫 Ban Maintained', value: 'User remains banned from support tickets', inline: false }
                    );

                await interaction.update({ 
                    embeds: [deniedEmbed], 
                    components: [] // Remove buttons
                });

                // Update ban history
                const banHistory = db.moderation.get('history') || {};
                if (banHistory[userId]) {
                    banHistory[userId].appeals_denied = (banHistory[userId].appeals_denied || 0) + 1;
                    banHistory[userId].last_action = Date.now();
                    banHistory[userId].last_action_by = `${interaction.user.tag} (${interaction.user.id})`;
                    db.moderation.set('history', banHistory);
                }

                if (logger) {
                    await logger.logInfo('Support Appeal Denied', {
                        User: `${targetUser?.user?.tag || userId} (${userId})`,
                        DeniedBy: `${interaction.user.tag} (${interaction.user.id})`,
                        DeniedAt: Date.now(),
                        OriginalReason: appeal.reason.substring(0, 100)
                    });
                }
            }

        } catch (error) {
            console.error('Error handling appeal decision:', error);
            await interaction.reply({ 
                content: '❌ Error processing appeal decision.', 
                flags: MessageFlags.Ephemeral 
            });
        }
        return;
    }

    if (interaction.customId.startsWith('server_unban_approve_') || interaction.customId.startsWith('server_unban_deny_')) {
        if (!interaction.member || !interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
            return await interaction.reply({ content: '❌ شما دسترسی لازم برای مدیریت اپیل را ندارید.', flags: MessageFlags.Ephemeral });
        }

        const parts = interaction.customId.split('_');
        const action = parts[2]; // 'approve' or 'deny'
        const userId = parts[3];

        try {
            const appeals = db.moderation.get('server_appeals') || {};
            const appeal = appeals[userId];
            if (!appeal || appeal.status !== 'pending') {
                return await interaction.reply({ content: '❌ اپیل معتبر یافت نشد یا قبلاً رسیدگی شده است.', flags: MessageFlags.Ephemeral });
            }

            const targetGuild = interaction.guild || interaction.client.guilds.cache.get(config.bot.guildId);
            if (!targetGuild) {
                return await interaction.reply({ content: '❌ گیلد هدف یافت نشد.', flags: MessageFlags.Ephemeral });
            }

            if (action === 'approve') {
                try {
                    await targetGuild.members.unban(userId, 'Unban approved by staff');
                } catch (e) {
                    // Try alternate API
                    try { await targetGuild.bans.remove(userId, 'Unban approved by staff'); } catch {}
                }

                let inviteUrl = 'N/A';
                try {
                    const channel = targetGuild.channels.cache.find(c => c.isTextBased() && c.permissionsFor(targetGuild.members.me).has('CreateInvite'));
                    if (channel) {
                        const invite = await channel.createInvite({ maxUses: 1, maxAge: 86400, reason: `Unban approved for ${userId}` });
                        inviteUrl = invite.url;
                    }
                } catch {}

                const successEmbed = new EmbedBuilder()
                    .setColor('Green')
                    .setTitle('✅ درخواست آن‌بن تایید شد')
                    .setDescription('شما آن‌بن شدید. می‌توانید به سرور بازگردید.')
                    .addFields(
                        { name: '🔗 لینک دعوت', value: inviteUrl !== 'N/A' ? `[ورود به سرور](${inviteUrl})` : 'N/A', inline: false },
                        { name: '🎉 خوش آمدید', value: 'منتظر شما هستیم! قوانین را رعایت کنید.', inline: false }
                    )
                    .setTimestamp();

                try {
                    const userObj = await interaction.client.users.fetch(userId);
                    await userObj.send({ embeds: [successEmbed] }).catch(() => {});
                } catch {}

                const updated = EmbedBuilder.from(interaction.message.embeds[0])
                    .setColor('Green')
                    .setTitle('✅ اپیل تایید شد');
                await interaction.update({ embeds: [updated], components: [] });

                appeals[userId] = { ...appeal, status: 'approved', approved_at: Date.now(), approved_by: interaction.user.id };
                db.moderation.set('server_appeals', appeals);

                if (logger) {
                    await logger.logInfo('Server Unban Appeal Approved', {
                        UserId: userId,
                        ApprovedBy: `${interaction.user.tag} (${interaction.user.id})`,
                        ApprovedAt: Date.now()
                    });
                }
            } else {
                const denyDM = new EmbedBuilder()
                    .setColor('Red')
                    .setTitle('❌ درخواست آن‌بن رد شد')
                    .setDescription('اطلاعات کافی نبود. می‌توانید پس از 1 ساعت دوباره درخواست دهید.')
                    .setTimestamp();
                try {
                    const userObj = await interaction.client.users.fetch(userId);
                    await userObj.send({ embeds: [denyDM] }).catch(() => {});
                } catch {}

                const updated = EmbedBuilder.from(interaction.message.embeds[0])
                    .setColor('Red')
                    .setTitle('❌ اپیل رد شد');
                await interaction.update({ embeds: [updated], components: [] });

                appeals[userId] = { ...appeal, status: 'denied', denied_at: Date.now(), denied_by: interaction.user.id };
                db.moderation.set('server_appeals', appeals);

                if (logger) {
                    await logger.logInfo('Server Unban Appeal Denied', {
                        UserId: userId,
                        DeniedBy: `${interaction.user.tag} (${interaction.user.id})`,
                        DeniedAt: Date.now()
                    });
                }
            }

        } catch (error) {
            console.error('Error handling server unban appeal decision:', error);
            await interaction.reply({ content: '❌ خطا در پردازش تصمیم اپیل.', flags: MessageFlags.Ephemeral });
        }
        return;
    }

    // Handle advertisement buttons
    if (interaction.customId.startsWith('adv_') || interaction.customId.startsWith('advertise_')) {
        return await handleAdvertisementButtons(interaction, client, env);
    }
    
    // Handle name history button
    if (interaction.customId.startsWith('namehistory_')) {
        // Only admin or special role can access
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({ content: 'You do not have permission to use this button.', flags: MessageFlags.Ephemeral });
        }
        const uuid = interaction.customId.replace('namehistory_', '');
        try {
            const nameHistory = await utils.getNameHistory(uuid);
            if (nameHistory && nameHistory.length > 0) {
                const historyEmbed = new EmbedBuilder()
                    .setColor(0x2ecc71)
                    .setTitle('📜 Username History')
                    .setDescription(nameHistory.map((entry, index) =>
                        `${index + 1}. \`${entry.name}\`${entry.changedToAt ? ` - <t:${Math.floor(entry.changedToAt / 1000)}:R>` : ' (Original)'}`
                    ).join('\n'))
                    .setFooter({ text: `UUID: ${uuid}` });
                await interaction.reply({ embeds: [historyEmbed], flags: MessageFlags.Ephemeral });
            } else {
                await interaction.reply({
                    content: '❌ Username history not found.',
                    flags: MessageFlags.Ephemeral
                });
            }
        } catch (error) {
            console.error('Error handling name history button:', error);
            await interaction.reply({
                content: '❌ Error fetching username history',
                flags: MessageFlags.Ephemeral
            });
        }
        return;
    }

    // --- شرکت در گیووای ---
    if (interaction.customId === 'join_giveaway') {
        // فقط اعضای سرور اجازه شرکت دارند
        if (!interaction.member) {
            return interaction.reply({ content: 'You must be a server member to participate.', flags: MessageFlags.Ephemeral });
        }
        // پیدا کردن گیووای فعال بر اساس آیدی پیام
        const giveaway = db.giveaways.get(interaction.message.id);
        if (!giveaway || giveaway.ended) {
            return interaction.reply({ content: 'Active giveaway not found or has ended.', flags: MessageFlags.Ephemeral });
        }
        if (!giveaway.participants) giveaway.participants = [];
        if (giveaway.participants.includes(interaction.user.id)) {
            return interaction.reply({ content: 'You have already joined this giveaway.', flags: MessageFlags.Ephemeral });
        }
        giveaway.participants.push(interaction.user.id);
        db.giveaways.set(interaction.message.id, giveaway);
        // آپدیت شمارنده شرکت‌کننده‌ها در امبد
        try {
            const msg = await interaction.channel.messages.fetch(interaction.message.id).catch(() => null);
            if (msg && msg.embeds && msg.embeds[0]) {
                const oldEmbed = msg.embeds[0];
                let newDesc = oldEmbed.description || '';
                if (newDesc.includes('👥 شرکت‌کننده تا این لحظه:')) {
                    newDesc = newDesc.replace(/👥 شرکت‌کننده تا این لحظه: \*\*\d+ نفر\*\*/, `👥 شرکت‌کننده تا این لحظه: **${giveaway.participants.length} نفر**`);
                } else {
                    newDesc += `\n\n👥 شرکت‌کننده تا این لحظه: **${giveaway.participants.length} نفر**`;
                }
                const newEmbed = EmbedBuilder.from(oldEmbed).setDescription(newDesc);
                await msg.edit({ embeds: [newEmbed], components: msg.components });
            }
        } catch (err) {
            console.error('Error updating giveaway embed:', err);
        }
        await interaction.reply({ content: 'You have successfully joined the giveaway! Good luck! 🎉', flags: MessageFlags.Ephemeral });
        return;
    }
    console.log(`Checking role button for customId='${interaction.customId}' (startsWith 'rolebtn_': ${interaction.customId ? interaction.customId.startsWith('rolebtn_') : false})`);
    // --- Role Button Handler ---
    if (interaction.customId && interaction.customId.startsWith('rolebtn_')) {
        // Users can toggle their own roles (no permission check needed for self-role management)
        const roleId = interaction.customId.split('_')[1];
        const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        if (!member) {
            const errorEmbed = new EmbedBuilder().setColor('Red').setDescription('❌ کاربر یافت نشد.');
            return interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        }
        const role = interaction.guild.roles.cache.get(roleId);
        if (!role) {
            const errorEmbed = new EmbedBuilder().setColor('Red').setDescription('❌ رول مورد نظر یافت نشد.');
            return interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        }
        // Check if bot can manage this role
        if (role.position >= interaction.guild.members.me.roles.highest.position) {
            const errorEmbed = new EmbedBuilder().setColor('Red').setDescription('❌ ربات نمی‌تواند این رول را مدیریت کند.');
            return interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        }
        let action, color, emoji;
        try {
            if (member.roles.cache.has(roleId)) {
                await member.roles.remove(roleId);
                action = '❌ رول برداشته شد';
                color = 'Red';
                emoji = '➖';
            } else {
                await member.roles.add(roleId);
                action = '✅ رول اضافه شد';
                color = 'Green';
                emoji = '➕';
            }
            const embed = new EmbedBuilder().setColor(color).setDescription(`${emoji} ${action}: <@&${roleId}>`);
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        } catch (err) {
            console.error('Error handling role button:', err);
            const errorEmbed = new EmbedBuilder()
                .setColor('Red')
                .setDescription('❌ خطا در مدیریت رول. ممکن است رول بالاتر از رول ربات باشد یا دسترسی لازم وجود نداشته باشد.');
            await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        }
        return;
    }
    const { customId, user, guild, channel } = interaction;
    const BUYER_ROLE_ID = config.roles.buyer;
    const REVIEW_CHANNEL_ID = config.channels.review;


    // Handle different button interactions
    if (customId === 'close_ticket_user') {
        console.log(`🔒 Close ticket button clicked by ${user.tag}`);
        // Check if interaction is already replied/deferred
        if (interaction.replied || interaction.deferred) {
            console.log('⚠️ Interaction already replied/deferred');
            return;
        }

        try {
            // Handle ticket transcript and close logic
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const ticketInfo = db.ticketInfo.get(channel.id);
            if (!ticketInfo) {
                const errorEmbed = new EmbedBuilder()
                    .setColor('Red')
                    .setDescription('❌ This channel is not a ticket or ticket information was not found.');
                return interaction.editReply({ embeds: [errorEmbed] });
            }

            // Get or create "Closed Tickets" category (cached)
            let closedCategory = guild.channels.cache.find(c => c.name === 'Closed Tickets' && c.type === 4);
            if (!closedCategory) {
                closedCategory = await guild.channels.create({
                    name: 'Closed Tickets',
                    type: 4,
                    position: 999
                });
            }

            // Store original category
            const originalParent = channel.parent;

            // Batch operations for better performance
            await Promise.all([
                channel.setParent(closedCategory.id),
                channel.permissionOverwrites.edit(ticketInfo.ownerId, {
                    SendMessages: false,
                    ViewChannel: true,
                    ReadMessageHistory: true
                })
            ]);

            // Send confirmation message
            const closeEmbed = new EmbedBuilder()
                .setColor('#FFA500')
                .setTitle('🔒 تیکت بسته شد')
                .setDescription(`تیکت شما بسته شد و به آرشیو منتقل شد.\n\nاگر نیاز به کمک بیشتری دارید، لطفاً تیکت جدیدی باز کنید.`);

            // Update database and send message in parallel
            await Promise.all([
                channel.send({ embeds: [closeEmbed] }),
                db.ticketInfo.set(channel.id, { 
                    ...ticketInfo, 
                    status: 'closed', 
                    closedBy: user.id, 
                    closedAt: Date.now(),
                    originalCategory: originalParent?.id
                })
            ]);

            // Quick reply to user
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('Green')
                        .setTitle('✅ تیکت با موفقیت بسته شد')
                        .setDescription(`تیکت ${channel.name} با موفقیت بسته شد و به آرشیو منتقل گردید.`)
                        .setTimestamp()
                ]
            });

            // Update buttons after closing ticket
            // Find the ticket creation message (first message with buttons)
            const messages = await channel.messages.fetch({ limit: 100 });
            const originalMessage = messages.find(msg => 
                msg.components.length > 0 && 
                msg.components.some(row => 
                    row.components.some(btn => 
                        btn.customId === 'close_ticket_user' || 
                        btn.customId === 'complete_purchase'
                    )
                )
            );
            
            if (originalMessage) {
                console.log(`🔄 Found ticket creation message: ${originalMessage.id}`);
                
                // All buttons in one row for closed tickets
                const closedTicketButtons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('reopen_ticket')
                        .setLabel('🔓 Open Ticket')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('create_transcript')
                        .setLabel('📋 Create Transcript')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('ticket_delete')
                        .setLabel('🗑️ Delete Ticket')
                        .setStyle(ButtonStyle.Danger)
                );

                await originalMessage.edit({
                    content: originalMessage.content,
                    embeds: originalMessage.embeds,
                    components: [closedTicketButtons]
                });
                
                console.log('✅ Ticket buttons updated successfully after closing');
            } else {
                console.log('❌ Could not find ticket creation message to update buttons');
            }

            // Background logging (non-blocking)
            setImmediate(async () => {
                try {
                    await logAction(guild, `🔒 Ticket ${channel.name} closed by ${user.tag}.`);
                    
                    if (logger) {
                        await logger.logTicket('Closed', user, {
                            TicketChannel: `${channel.name} (${channel.id})`,
                            TicketOwner: `<@${ticketInfo.ownerId}>`,
                            Reason: ticketInfo.reason || 'N/A',
                            ClosedBy: `${user.tag} (${user.id})`
                        });
                    }
                } catch (logError) {
                    console.error('Logging error (non-critical):', logError);
                }
            });
            
        } catch (error) {
            console.error('Error closing ticket:', error);
            
            // Comprehensive error handling for interaction states
            if (!interaction.replied && !interaction.deferred) {
                try {
                    await interaction.reply({
                        content: '❌ خطایی در بستن تیکت رخ داد.',
                        flags: MessageFlags.Ephemeral
                    });
                } catch (replyError) {
                    console.error('Failed to reply to interaction:', replyError);
                }
            } else if (interaction.deferred) {
                try {
                    const errorEmbed = new EmbedBuilder()
                        .setColor('Red')
                        .setDescription('❌ خطایی در بستن تیکت رخ داد.');
                    await interaction.editReply({ embeds: [errorEmbed] });
                } catch (replyErr) {
                    // If edit fails, log it but don't throw
                    if (logger) {
                        await logger.logError(replyErr, 'Ticket Close Reply Error', {
                            CustomId: customId,
                            User: `${user.tag} (${user.id})`
                        });
                    }
                }
            }
            if (logger) {
                await logger.logError(error, 'Ticket Close Error', {
                    CustomId: customId,
                    User: `${user.tag} (${user.id})`,
                    Channel: channel.name
                });
            } else {
                console.error('Error closing ticket:', error);
            }
        }
    }
    else if (customId === 'claim_ticket') {
        console.log(`👋 Claim ticket button clicked by ${user.tag}`);
        // Handle ticket claiming logic
        // Check if interaction is already replied/deferred
        if (interaction.replied || interaction.deferred) {
            console.log('⚠️ Interaction already replied/deferred');
            return;
        }
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const ticketInfo = db.ticketInfo.get(channel.id);
        if (!ticketInfo) {
            const errorEmbed = new EmbedBuilder()
                .setColor('Red')
                .setDescription('❌ اطلاعات تیکت پیدا نشد.');
            return interaction.editReply({ embeds: [errorEmbed] });
        }

        // Quick database update and message send in parallel
        const claimEmbed = new EmbedBuilder()
            .setColor('#9B59B6')
            .setTitle('👤 تیکت تصدی شد')
            .setDescription(`این تیکت توسط <@${user.id}> تصدی شد و اکنون در حال بررسی است.`);

        await Promise.all([
            db.ticketInfo.set(channel.id, { ...ticketInfo, claimedBy: user.id, status: 'claimed' }),
            channel.send({ embeds: [claimEmbed] })
        ]);

        // Disable only claim button when ticket is claimed (other admin buttons stay active for the claimer)
            const messages = await channel.messages.fetch({ limit: 100 });
            const originalMessage = messages.find(msg => 
                msg.components.length > 0 && 
                msg.components.some(row => 
                    row.components.some(btn => 
                        btn.customId === 'close_ticket_user' || 
                        btn.customId === 'complete_purchase'
                    )
                )
            );
            
            if (originalMessage) {
                console.log(`🔄 Found ticket creation message for claim: ${originalMessage.id}`);
                
                // Keep admin buttons active except claim button (so claimer can still use them)
                const updatedAdminButtons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('record_order_admin')
                        .setLabel('📝 Record Order')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(false), // Keep active for claimer
                    new ButtonBuilder()
                        .setCustomId('complete_purchase_admin')
                        .setLabel('✅ Complete Purchase')
                        .setStyle(ButtonStyle.Success)
                        .setDisabled(false), // Keep active for claimer
                    new ButtonBuilder()
                        .setCustomId('claim_ticket')
                        .setLabel('👋 Claim Ticket (Already Claimed)')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true) // Only disable claim button
                );

                await originalMessage.edit({
                    content: originalMessage.content,
                    embeds: originalMessage.embeds,
                    components: [originalMessage.components[0], updatedAdminButtons]
                });
                
                console.log('✅ Only claim button disabled, other admin buttons remain active for claimer');
            } else {
                console.log('❌ Could not find ticket creation message to disable claim button');
            }

        await interaction.editReply({
            embeds: [
                new EmbedBuilder()
                    .setColor('#2ECC71')
                    .setDescription('✅ تیکت با موفقیت تصدی شد.')
                    .setTimestamp()
            ]
        });

        // Background logging (non-blocking)
        setImmediate(async () => {
            try {
                await logAction(guild, `👤 تیکت ${channel.name} توسط ${user.tag} تصدی شد.`);
                
                if (logger) {
                    await logger.logTicket('Claimed', user, {
                        TicketChannel: `${channel.name} (${channel.id})`,
                        ClaimedBy: `${user.tag} (${user.id})`,
                        Owner: `<@${ticketInfo.ownerId}>`
                    });
                }
            } catch (logError) {
                console.error('Logging error (non-critical):', logError);
            }
        });
    }
    else if (customId === 'complete_purchase') {
        console.log(`✅ Complete purchase button clicked by ${user.tag}`);
        // Handle purchase completion - show rating menu
        // Check if interaction is already replied/deferred
        if (interaction.replied || interaction.deferred) {
            console.log('⚠️ Interaction already replied/deferred');
            return;
        }
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const ratingMenu = new StringSelectMenuBuilder()
            .setCustomId('rating_input')
            .setPlaceholder('Select your rating')
            .addOptions(
                new StringSelectMenuOptionBuilder().setLabel('⭐ 1 Star').setValue('1'),
                new StringSelectMenuOptionBuilder().setLabel('⭐⭐ 2 Stars').setValue('2'),
                new StringSelectMenuOptionBuilder().setLabel('⭐⭐⭐ 3 Stars').setValue('3'),
                new StringSelectMenuOptionBuilder().setLabel('⭐⭐⭐⭐ 4 Stars').setValue('4'),
                new StringSelectMenuOptionBuilder().setLabel('⭐⭐⭐⭐⭐ 5 Stars').setValue('5')
            );

        const row = new ActionRowBuilder().addComponents(ratingMenu);

        await interaction.editReply({ content: '✅ خرید تکمیل شد', components: [row] });

        // Background logging (non-blocking)
        setImmediate(async () => {
            try {
                await logAction(guild, `✅ خرید کاربر ${user.tag} در تیکت ${channel.name} تکمیل شد.`);
                
                if (logger) {
                    await logger.logShop('Purchase Completed', user, {
                        Ticket: `${channel.name} (${channel.id})`,
                        User: `${user.tag} (${user.id})`
                    });
                }
            } catch (logError) {
                console.error('Logging error (non-critical):', logError);
            }
        });
    }
    else if (customId === 'complete_purchase_admin') {
        console.log(`✅ Complete purchase (admin) button clicked by ${user.tag}`);
        // Only admins
        if (!interaction.member.permissions.has('Administrator')) {
            const errorEmbed = new EmbedBuilder().setColor('Red').setDescription('شما دسترسی لازم برای این عملیات را ندارید.');
            return interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        }
        const ticketInfo = db.ticketInfo.get(channel.id);
        if (!ticketInfo) {
            const errorEmbed = new EmbedBuilder().setColor('Red').setDescription('اطلاعات تیکت یافت نشد.');
            return interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        }
        const owner = await client.users.fetch(ticketInfo.ownerId).catch(() => null);
        if (!owner) {
            const errorEmbed = new EmbedBuilder().setColor('Red').setDescription('کاربر تیکت یافت نشد.');
            return interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        }
        // DM to ticket owner
        const dmEmbed = new EmbedBuilder()
            .setColor('#9B59B6')
            .setTitle('🎉 سفارش شما تکمیل شد!')
            .setDescription(`خبر خوش! سفارش شما در **${guild.name}** با موفقیت تکمیل و آماده استفاده است. از اعتماد شما نسبت به خدمات ما بی‌نهایت سپاسگزاریم.\n\nکیفیت و رضایت شما مهمترین اولویت ماست. لطفاً **نظر و تجربه خود را از تکمیل خرید حتماً ثبت کنید**. در صورت داشتن هرگونه سؤال، نظر یا مشکل، خوشحال می‌شویم مجدداً در خدمت شما باشیم.`)
            .addFields(
                { name: '🏪 فروشگاه', value: guild.name, inline: true },
                { name: '📅 تاریخ تکمیل', value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: true },
                { name: '👤 کاربر', value: owner.tag, inline: true },
                { name: '📋 وضعیت', value: '✅ تکمیل شده و تحویل داده شده', inline: false },
                { name: '🔄 خدمات بعدی', value: 'برای سفارش‌های جدید می‌توانید مجدداً تیکت باز کنید', inline: false }
            )
            .setThumbnail(guild.iconURL())
            .setFooter({ text: '💎 با تشکر از اعتماد شما - تیم پشتیبانی', iconURL: guild.iconURL() })
            .setTimestamp();
        try {
            await owner.send({ embeds: [dmEmbed] });
        } catch {
            // Ignore DM errors
        }
        // Notify in ticket channel
        const completionEmbed = new EmbedBuilder()
            .setColor('#2ECC71')
            .setTitle('✅ سفارش تکمیل شد')
            .setDescription(`سفارش <@${owner.id}> توسط ${interaction.user} با موفقیت تکمیل و تحویل داده شد.\n\nکاربر اطلاع‌رسانی شده و می‌تواند نظر خود را ثبت کند.`);

        await interaction.reply({ embeds: [completionEmbed] });
        await logAction(guild, `سفارش تیکت ${channel.name} توسط ${interaction.user.tag} تکمیل شد.`);
        
        if (logger) {
            await logger.logModeration('Order Completed (Admin)', interaction.user, owner, {
                Ticket: `${channel.name} (${channel.id})`,
                Customer: `${owner.tag} (${owner.id})`
            });
        }
    }
    else if (customId === 'record_order_admin') {
        console.log(`📝 Record order (admin) button clicked by ${user.tag}`);
        // Only admins can record orders
        if (!interaction.member.permissions.has('Administrator')) {
            const errorEmbed = new EmbedBuilder().setColor('Red').setDescription('شما دسترسی لازم برای این عملیات را ندارید.');
            return interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        }
        const ticketInfo = db.ticketInfo.get(channel.id);
        if (!ticketInfo) {
            const errorEmbed = new EmbedBuilder().setColor('Red').setDescription('اطلاعات تیکت یافت نشد.');
            return interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        }
        const owner = await client.users.fetch(ticketInfo.ownerId).catch(() => null);
        if (!owner) {
            const errorEmbed = new EmbedBuilder().setColor('Red').setDescription('کاربر تیکت یافت نشد.');
            return interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        }
        // DM to ticket owner for order recorded
        const dmEmbed = new EmbedBuilder()
            .setColor('#9B59B6')
            .setTitle('📝 سفارش شما ثبت شد!')
            .setDescription(`سفارش شما در **${guild.name}** با موفقیت ثبت شد و در صف پردازش قرار گرفت. تیم ما در حال آماده‌سازی سفارش شما هستند.\n\nبه زودی اطلاعات بیشتری درباره وضعیت سفارش‌تان دریافت خواهید کرد. لطفاً صبور باشید.`)
            .addFields(
                { name: '🏪 فروشگاه', value: guild.name, inline: true },
                { name: '📅 تاریخ ثبت', value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: true },
                { name: '👤 کاربر', value: owner.tag, inline: true },
                { name: '📋 وضعیت', value: '📝 ثبت شده - در حال پردازش', inline: false },
                { name: '⏱️ زمان تحویل', value: 'اطلاعات دقیق زمان تحویل به زودی ارسال خواهد شد', inline: false }
            )
            .setThumbnail(guild.iconURL())
            .setFooter({ text: '📋 تیم پردازش سفارشات در خدمت شما', iconURL: guild.iconURL() })
            .setTimestamp();
        try {
            await owner.send({ embeds: [dmEmbed] });
        } catch {
            // Ignore DM errors
        }
        // Notify in ticket channel
        const recordEmbed = new EmbedBuilder()
            .setColor('#3498DB')
            .setTitle('📝 سفارش ثبت شد')
            .setDescription(`سفارش <@${owner.id}> توسط ${interaction.user} ثبت شد و در صف پردازش قرار گرفت.\n\nکاربر اطلاع‌رسانی شده و منتظر تکمیل سفارش است.`);

        await interaction.reply({ embeds: [recordEmbed] });
        await logAction(guild, `سفارش تیکت ${channel.name} توسط ${interaction.user.tag} ثبت شد.`);
        
        if (logger) {
            await logger.logModeration('Order Recorded (Admin)', interaction.user, owner, {
                Ticket: `${channel.name} (${channel.id})`,
                Customer: `${owner.tag} (${owner.id})`
            });
        }
    }
    else if (customId === 'transcript_ticket') {
        // Handle ticket transcript generation
        // Check if interaction is already replied/deferred
        if (interaction.replied || interaction.deferred) {
            return;
        }
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            // Generate transcript
            const transcriptFile = await transcript.createTranscriptFile(channel);

            await interaction.editReply({
                content: '📄 Transcript generated',
                files: [transcriptFile]
            });

        } catch (error) {
            console.error('Error generating transcript:', error);
            const errorEmbed = new EmbedBuilder()
                .setColor('Red')
                .setDescription('❌ Error creating transcript. Please try again.');
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
    else if (customId === 'ticket_reopen') {
        // Handle ticket reopening
        if (!interaction.member.permissions.has('ManageChannels')) {
            const errorEmbed = new EmbedBuilder()
                .setColor('Red')
                .setDescription('❌ شما اجازه مدیریت تیکت‌ها را ندارید.');
            return await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        }

        // Check if interaction is already replied/deferred
        if (interaction.replied || interaction.deferred) {
            return;
        }
        
        // Defer reply with error handling
        try {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        } catch (err) {
            // If defer fails, interaction has expired
            console.log('Interaction expired for ticket_reopen');
            return;
        }

        const ticketInfo = db.ticketInfo.get(channel.id);
        if (!ticketInfo) {
            const errorEmbed = new EmbedBuilder()
                .setColor('Red')
                .setDescription('❌ اطلاعات تیکت یافت نشد.');
            return interaction.editReply({ embeds: [errorEmbed] });
        }

        try {
            // Move ticket back to original category if it exists
            if (ticketInfo.originalParentId) {
                const originalCategory = guild.channels.cache.get(ticketInfo.originalParentId);
                if (originalCategory) {
                    await channel.setParent(originalCategory.id);
                }
            }

            // Restore send message permission for ticket owner
            await channel.permissionOverwrites.edit(ticketInfo.ownerId, {
                SendMessages: true,
                ViewChannel: true,
                ReadMessageHistory: true
            });

            // Update ticket status to open
            if (db.ticketInfo && db.ticketInfo.set) {
                db.ticketInfo.set(channel.id, {
                    ...ticketInfo,
                    status: 'open',
                    reopenedBy: user.id,
                    reopenedAt: Date.now()
                });
            }

            // Send reopen message with embed
            const reopenEmbed = new EmbedBuilder()
                .setColor('#3498DB')
                .setTitle('🔓 تیکت باز شد')
                .setDescription(`این تیکت توسط <@${user.id}> باز شد.\n\nاکنون می‌توانید پیام‌های جدید ارسال کنید.`);

            await channel.send({ embeds: [reopenEmbed] });

            // Restore original ticket buttons
            try {
                const messages = await channel.messages.fetch({ limit: 100 });
                const ticketMessage = messages.find(msg =>
                    msg.author.id === client.user.id &&
                    msg.embeds[0]?.title?.includes('تیکت') &&
                    msg.components?.length > 0
                );

                if (ticketMessage) {
                    // Recreate original buttons from config
                    const ticketConfig = config.ticketSystem;

                    const userButtons = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('complete_purchase')
                            .setLabel(ticketConfig.buttons.user.completePurchase.label)
                            .setStyle(ButtonStyle[ticketConfig.buttons.user.completePurchase.style]),
                        new ButtonBuilder()
                            .setCustomId('close_ticket_user')
                            .setLabel(ticketConfig.buttons.user.closeTicket.label)
                            .setStyle(ButtonStyle[ticketConfig.buttons.user.closeTicket.style]),
                        new ButtonBuilder()
                            .setCustomId('claim_ticket')
                            .setLabel(ticketConfig.buttons.admin.claimTicket.label)
                            .setStyle(ButtonStyle[ticketConfig.buttons.admin.claimTicket.style])
                    );

                    const adminButtons = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('record_order_admin')
                            .setLabel(ticketConfig.buttons.admin.recordOrder.label)
                            .setStyle(ButtonStyle[ticketConfig.buttons.admin.recordOrder.style]),
                        new ButtonBuilder()
                            .setCustomId('complete_purchase_admin')
                            .setLabel(ticketConfig.buttons.admin.completePurchase.label)
                            .setStyle(ButtonStyle[ticketConfig.buttons.admin.completePurchase.style])
                    );

                    await ticketMessage.edit({
                        embeds: ticketMessage.embeds,
                        components: [userButtons, adminButtons]
                    });
                }
            } catch (enableError) {
                console.error('Error restoring ticket buttons:', enableError);
            }

            const successEmbed = new EmbedBuilder()
                .setColor('#2ECC71')
                .setDescription('✅ تیکت با موفقیت مجدداً باز شد.');

            await interaction.editReply({ embeds: [successEmbed] });
            await logAction(guild, `🔓 Ticket ${channel.name} reopened by ${user.tag}.`);
            
            if (logger) {
                await logger.logTicket('Reopened', user, {
                    TicketChannel: `${channel.name} (${channel.id})`,
                    ReopenedBy: `${user.tag} (${user.id})`,
                    Owner: `<@${ticketInfo.ownerId}>`
                });
            }

        } catch (error) {
            console.error('Error reopening ticket:', error);
            const errorEmbed = new EmbedBuilder()
                .setColor('Red')
                .setDescription('❌ خطا در باز کردن مجدد تیکت. لطفاً دوباره تلاش کنید.');
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
    else if (customId === 'ticket_delete') {
        // Handle ticket deletion
        if (!interaction.member.permissions.has('ManageChannels')) {
            return await interaction.reply({
                content: '❌ You do not have permission to manage tickets.',
                flags: MessageFlags.Ephemeral
            });
        }

        // Check if interaction is already replied/deferred
        if (interaction.replied || interaction.deferred) {
            return;
        }
        
        // Quick reply first, then process deletion in background
        const processingEmbed = new EmbedBuilder()
            .setColor('Yellow')
            .setDescription('⏳ در حال حذف تیکت...');
        await interaction.reply({ embeds: [processingEmbed], flags: MessageFlags.Ephemeral });

        // Process deletion in background
        setImmediate(async () => {
            try {
                const ticketInfo = db.ticketInfo.get(channel.id);
                if (!ticketInfo) {
                    const errorEmbed = new EmbedBuilder()
                        .setColor('Red')
                        .setDescription('❌ اطلاعات تیکت پیدا نشد.');
                    return interaction.editReply({ embeds: [errorEmbed] });
                }

                // Send final message before deletion
                const deleteEmbed = new EmbedBuilder()
                    .setColor('Red')
                    .setTitle('🗑️ تیکت حذف شد')
                    .setDescription(`تیکت ${channel.name} توسط ${user.tag} حذف شد.`);
                await channel.send({ embeds: [deleteEmbed] });

                // Generate transcript and send to log channel before deletion
                try {
                    const transcriptAttachment = await transcript.createTranscriptFile(channel);
                    
                    // Find log channel (you can configure this channel ID)
                    const logChannelId = config.channels?.log; // or use a specific channel ID
                    if (logChannelId) {
                        const logChannel = guild.channels.cache.get(logChannelId);
                        if (logChannel && logChannel.isTextBased()) {
                            const transcriptLogEmbed = new EmbedBuilder()
                                .setColor('Orange')
                                .setTitle('📋 ترنسکریپت تیکت حذف شده')
                                .setDescription(`تیکت **${channel.name}**  ترنسکریپت شد`)
                                .addFields(
                                    { name: '🗑️ حذف شده توسط', value: `${user.tag}`, inline: true },
                                    { name: '📅 زمان حذف', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
                                    { name: '👤 صاحب تیکت', value: `<@${ticketInfo.ownerId}>`, inline: false }
                                )
                                .setTimestamp();
                            
                            await logChannel.send({
                                embeds: [transcriptLogEmbed],
                                files: [transcriptAttachment]
                            });
                        }
                    }
                } catch (transcriptError) {
                    console.error('Error creating transcript before deletion:', transcriptError);
                    // Continue with deletion even if transcript fails
                }

                // Update interaction BEFORE deleting channel
                try {
                    const successEmbed = new EmbedBuilder()
                        .setColor('Green')
                        .setDescription('✅ تیکت با موفقیت حذف شد.');
                    await interaction.editReply({ embeds: [successEmbed] });
                } catch (interactionError) {
                    console.log('Interaction expired before channel deletion, but continuing...');
                    // Continue with deletion even if interaction fails
                }

                // Delete ticket from database
                db.ticketInfo.delete(channel.id);
                if (db.tickets && db.tickets.has && db.tickets.has(ticketInfo.ownerId)) {
                    db.tickets.delete(ticketInfo.ownerId);
                }

                // Add delay before channel deletion to prevent timeout
                await new Promise(resolve => setTimeout(resolve, 1000));

                // Delete the channel (after interaction is updated)
                await channel.delete('Ticket deleted by admin');

                // Background logging (non-blocking)
                setImmediate(async () => {
                    await logAction(guild, `🗑️ Ticket ${channel.name} deleted by ${user.tag}.`);
                    
                    if (logger) {
                        await logger.logTicket('Deleted', user, {
                            TicketChannel: `${channel.name} (${channel.id})`,
                            TicketOwner: `<@${ticketInfo.ownerId}>`,
                            Reason: ticketInfo.reason || 'N/A'
                        });
                    }
                });

            } catch (error) {
                console.error('Error deleting ticket:', error);
                const errorEmbed = new EmbedBuilder()
                    .setColor('Red')
                    .setDescription('❌ خطا در حذف تیکت. لطفاً دوباره تلاش کنید.');
                await interaction.editReply({ embeds: [errorEmbed] });
            }
        });
    }
    else if (customId === 'complete_purchase') {
        console.log(`✅ Complete purchase button clicked by ${user.tag}`);
        // Check if interaction is already replied/deferred
        if (interaction.replied || interaction.deferred) {
            console.log('⚠️ Interaction already replied/deferred');
            return;
        }
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const ticketInfo = db.ticketInfo.get(channel.id);
            if (!ticketInfo) {
                const errorEmbed = new EmbedBuilder()
                    .setColor('Red')
                    .setDescription('❌ اطلاعات تیکت پیدا نشد.');
                return interaction.editReply({ embeds: [errorEmbed] });
            }

            const completeEmbed = new EmbedBuilder()
                .setColor('Green')
                .setTitle('✅ خرید کامل شد')
                .setDescription(`خرید تیکت توسط ${user.tag} تکمیل شد.`)
                .setTimestamp();

            await Promise.all([
                channel.send({ embeds: [completeEmbed] }),
                db.ticketInfo.set(channel.id, { ...ticketInfo, status: 'completed', completedBy: user.id, completedAt: Date.now() })
            ]);

            const successEmbed = new EmbedBuilder()
                .setColor('Green')
                .setDescription('✅ خرید با موفقیت تکمیل شد.');

            await interaction.editReply({ embeds: [successEmbed] });
            
            // Background logging (non-blocking)
            setImmediate(async () => {
                await logAction(guild, `✅ Purchase completed for ticket ${channel.name} by ${user.tag}.`);
                
                if (logger) {
                    await logger.logTicket('Completed', user, {
                        TicketChannel: `${channel.name} (${channel.id})`,
                        CompletedBy: `${user.tag} (${user.id})`,
                        Owner: `<@${ticketInfo.ownerId}>`
                    });
                }
            });

        } catch (error) {
            console.error('Error completing purchase:', error);
            const errorEmbed = new EmbedBuilder()
                .setColor('Red')
                .setDescription('❌ خطا در تکمیل خرید. لطفاً دوباره تلاش کنید.');
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
    else if (customId === 'create_transcript') {
        console.log(`📋 Create transcript button clicked by ${user.tag}`);
        // Check if interaction is already replied/deferred
        if (interaction.replied || interaction.deferred) {
            console.log('⚠️ Interaction already replied/deferred');
            return;
        }
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            // Generate HTML transcript using the transcript system
            const transcriptAttachment = await transcript.createTranscriptFile(channel);
            
            // Send transcript as attachment
            await interaction.editReply({
                content: '📋 ترنسکریپت ساخته شد',
                files: [transcriptAttachment]
            });

        } catch (error) {
            console.error('Error starting transcript creation:', error);
            const errorEmbed = new EmbedBuilder()
                .setColor('Red')
                .setDescription('❌ خطا در شروع ساخت ترنسکریپت.');
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
    else if (customId === 'reopen_ticket') {
        console.log(`🔓 Reopen ticket button clicked by ${user.tag}`);
        // Check if interaction is already replied/deferred
        if (interaction.replied || interaction.deferred) {
            console.log('⚠️ Interaction already replied/deferred');
            return;
        }
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const ticketInfo = db.ticketInfo.get(channel.id);
        if (!ticketInfo) {
            const errorEmbed = new EmbedBuilder()
                .setColor('Red')
                .setDescription('❌ اطلاعات تیکت پیدا نشد.');
            return interaction.editReply({ embeds: [errorEmbed] });
        }

        try {
            // Quick reply first, then process in background
            const processingEmbed = new EmbedBuilder()
                .setColor('Yellow')
                .setDescription('⏳ در حال باز کردن تیکت...');
            await interaction.editReply({ embeds: [processingEmbed] });

            // Process all operations in parallel for speed
            await Promise.all([
                // Move ticket back to original category
                ticketInfo.originalCategory ? channel.setParent(ticketInfo.originalCategory) : Promise.resolve(),
                
                // Restore permissions for ticket owner
                channel.permissionOverwrites.edit(ticketInfo.ownerId, {
                    SendMessages: true,
                    ViewChannel: true,
                    ReadMessageHistory: true
                }),
                
                // Update ticket info
                db.ticketInfo.set(channel.id, { 
                    ...ticketInfo, 
                    status: 'open', 
                    reopenedBy: user.id, 
                    reopenedAt: Date.now()
                })
            ]);

            // Restore original buttons
            const userButtons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('complete_purchase').setLabel('✅ Complete Purchase').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('close_ticket_user').setLabel('🔒 Close Ticket').setStyle(ButtonStyle.Danger)
            );

            const adminButtons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('record_order_admin').setLabel('📝 Record Order').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('complete_purchase_admin').setLabel('✅ Complete Purchase').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('claim_ticket').setLabel('👋 Claim Ticket').setStyle(ButtonStyle.Secondary)
            );

            // Find the ticket message with reopen/transcript buttons
            const messages = await channel.messages.fetch({ limit: 100 });
            const originalMessage = messages.find(msg => 
                msg.components.length > 0 && 
                msg.components.some(row => 
                    row.components.some(btn => 
                        btn.customId === 'reopen_ticket' || 
                        btn.customId === 'create_transcript'
                    )
                )
            );
            
            if (originalMessage) {
                console.log(`🔄 Found closed ticket message: ${originalMessage.id}`);
                await originalMessage.edit({
                    content: originalMessage.content,
                    embeds: originalMessage.embeds,
                    components: [userButtons, adminButtons]
                });
                
                console.log('✅ Ticket buttons restored successfully after reopening');
            } else {
                console.log('❌ Could not find closed ticket message to restore buttons');
            }

            // Final success message
            const successEmbed = new EmbedBuilder()
                .setColor('Green')
                .setDescription('✅ تیکت با موفقیت مجدداً باز شد.');

            await interaction.editReply({ embeds: [successEmbed] });
            
            // Background logging (non-blocking)
            setImmediate(async () => {
                await logAction(guild, `🔓 Ticket ${channel.name} reopened by ${user.tag}.`);
                
                if (logger) {
                    await logger.logTicket('Reopened', user, {
                        TicketChannel: `${channel.name} (${channel.id})`,
                        ReopenedBy: `${user.tag} (${user.id})`,
                        Owner: `<@${ticketInfo.ownerId}>`
                    });
                }
            });

        } catch (error) {
            console.error('Error reopening ticket:', error);
            const errorEmbed = new EmbedBuilder()
                .setColor('Red')
                .setDescription('❌ خطا در باز کردن مجدد تیکت. لطفاً دوباره تلاش کنید.');
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
    else {
        // Handle unknown button
        // Check if interaction is already replied/deferred
        if (interaction.replied || interaction.deferred) {
            return;
        }
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        console.log(`Unknown button clicked: customId='${interaction.customId}', user='${interaction.user.id}', guild='${interaction.guild.id}'`);
        const errorEmbed = new EmbedBuilder()
            .setColor('Red')
            .setDescription(`❌ دکمه نامشخص: ${customId}`);
        await interaction.editReply({ embeds: [errorEmbed] });
    }
}

// --- handleSelectMenu ---
async function handleSelectMenu(interaction, client, env) {
    const { customId, values, user, guild } = interaction;
    const REVIEW_CHANNEL_ID = config.channels.review;
    const BUYER_ROLE_ID = config.roles.buyer;

    if (customId === 'ticket_select') {
        const reason = values[0];
        const ticketConfig = config.ticketSystem;
        const categoryConfig = ticketConfig.menu.categories.find(cat => cat.value === reason);

        // Check if category requires additional details
        if (categoryConfig && categoryConfig.requiresDetails) {
            const modal = new ModalBuilder()
                .setCustomId(`ticket_details_modal_${reason}`)
                .setTitle(`${categoryConfig.label} - Additional Details`);

            const detailsInput = new TextInputBuilder()
                .setCustomId('ticket_details')
                .setLabel('Please provide additional details')
                .setPlaceholder('Enter any additional information...')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false);

            modal.addComponents(new ActionRowBuilder().addComponents(detailsInput));
            return interaction.showModal(modal);
        }

        if (reason === 'other') {
            const modal = new ModalBuilder().setCustomId('other_reason_modal').setTitle('دلیل دیگر برای باز کردن تیکت');
            const input = new TextInputBuilder().setCustomId('other_reason_input').setLabel('Please write your reason').setStyle(TextInputStyle.Paragraph).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            return interaction.showModal(modal);
        }

        // Check if interaction is already replied/deferred
        if (interaction.replied || interaction.deferred) {
            return;
        }
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        
        // Check if user is banned from support
        const supportBans = db.support.get('bans') || [];
        const activeBan = supportBans.find(ban => ban.user_id === user.id && ban.status === 'active');
        
        if (activeBan) {
            // Check if ban has expired (for temporary bans)
            if (activeBan.expires_at && activeBan.expires_at < Date.now()) {
                // Auto-unban expired temporary ban
                activeBan.status = 'expired';
                activeBan.expired_at = Date.now();
                
                // Update ban in database
                const banIndex = supportBans.findIndex(ban => ban.user_id === user.id);
                if (banIndex !== -1) {
                    supportBans[banIndex] = activeBan;
                    db.support.set('bans', supportBans);
                }
                
                // Log auto-unban
                if (logger) {
                    await logger.logInfo('Auto-Unban', {
                        User: `${user.tag} (${user.id})`,
                        BanDuration: activeBan.duration,
                        ExpiredAt: Date.now()
                    });
                }
                
                // Continue with ticket creation (ban expired)
            } else {
                // User is still banned
                const remainingTime = activeBan.expires_at ? 
                    `<t:${Math.floor(activeBan.expires_at / 1000)}:R>` : 
                    'Permanent';
                
                const bannedEmbed = new EmbedBuilder()
                    .setColor('Red')
                    .setTitle('🚫 Support Access Denied')
                    .setDescription('You are currently banned from creating support tickets.')
                    .addFields(
                        { name: '⏱️ Ban Duration', value: activeBan.duration === 'permanent' ? 'Permanent' : remainingTime, inline: true },
                        { name: '📝 Reason', value: activeBan.reason, inline: true },
                        { name: '📋 Appeal Process', value: 'If you believe this ban was made in error, you can request an appeal by clicking the button below.', inline: false },
                        { name: '⏰ Next Attempt', value: 'You can submit another appeal request in 1 hour if your previous request was denied.', inline: false }
                    )
                    .setFooter({ text: `Banned by ${activeBan.banned_by}` })
                    .setTimestamp();

                // Check if user can appeal (not denied recently)
                const appeals = db.support.get('appeals') || {};
                const userAppeal = appeals[user.id];
                
                let canAppeal = true;
                if (userAppeal && userAppeal.status === 'denied') {
                    const timeSinceDenial = Date.now() - userAppeal.denied_at;
                    const oneHour = 60 * 60 * 1000;
                    canAppeal = timeSinceDenial >= oneHour;
                }

                if (canAppeal) {
                    const appealButton = new ButtonBuilder()
                        .setCustomId(`appeal_support_ban_${user.id}`)
                        .setLabel('Request Appeal')
                        .setStyle(ButtonStyle.Primary);

                    const actionRow = new ActionRowBuilder().addComponents(appealButton);
                    return interaction.editReply({ embeds: [bannedEmbed], components: [actionRow] });
                } else {
                    // Remove appeal button if cooldown active
                    return interaction.editReply({ embeds: [bannedEmbed], components: [] });
                }
            }
        }
        
        if (db.tickets.has(user.id)) {
            const errorEmbed = new EmbedBuilder().setColor('Red').setDescription(`❌ شما از قبل یک تیکت باز دارید: <#${db.tickets.get(user.id)}>`);
            return interaction.editReply({ embeds: [errorEmbed] });
        }
        await createTicketChannel(guild, user, reason);
        const ticketChannelId = db.tickets.get(user.id);
        const successEmbed = new EmbedBuilder()
            .setColor('Green')
            .setDescription(`تیکت شما با موفقیت ساخته شد!\n\nتیکت شما با جزئیات کامل ایجاد شد. برای دسترسی سریع به تیکت، روی لینک زیر کلیک کنید:\n\n[🚀 رفتن به تیکت](https://discord.com/channels/${guild.id}/${ticketChannelId})`);

        await interaction.editReply({ embeds: [successEmbed] });
        
        if (logger) {
            await logger.logTicket('Created', user, {
                TicketChannel: ticketChannelId ? `<#${ticketChannelId}>` : 'N/A',
                Reason: reason,
                Category: reason
            });
        }
    }

    if (customId === 'rating_input') {
        const rating = values[0];
        const modal = new ModalBuilder().setCustomId(`review_comment_modal_${rating}`).setTitle('نظر خود را بنویسید');
        const commentInput = new TextInputBuilder().setCustomId('comment_input').setLabel('Write your comment (optional)').setStyle(TextInputStyle.Paragraph).setRequired(false);
        modal.addComponents(new ActionRowBuilder().addComponents(commentInput));
        await interaction.showModal(modal);
    }

    if (customId === 'help_menu') {
        const section = values[0];
        let embed = new EmbedBuilder().setColor('#34495E').setTimestamp();
        if (section === 'moderation_overview') {
            embed = embed
                .setTitle('🛠️ معرفی دستورات مدیریتی')
                .setDescription('نمای کلی از دستورات مدیریتی بات به همراه مثال‌ها و پارامترها')
                .addFields(
                    { name: 'اخطار', value: '`/warn user:@User reason:"دلیل"`\nپارامترها: `user` اجباری، `reason` اختیاری\nخطاهای رایج: دسترسی ناکافی، کاربر یافت نشد' },
                    { name: 'پاک‌کردن اخطارها', value: '`/clearwarnings user:@User`\nپارامترها: `user` اجباری\nخطاها: دسترسی ناکافی' },
                    { name: 'کیـک', value: '`/kick user:@User reason:"دلیل"`\nپارامترها: `user` اجباری، `reason` اختیاری\nخطاها: عدم امکان کیک نقش بالاتر' },
                    { name: 'بن و آن‌بن', value: '`/ban user:@User reason:"دلیل" deletedays:7`\n`/unban userid:123456789`\nخطاها: دسترسی ناکافی، ID اشتباه، نقش بالاتر' },
                    { name: 'پاک‌سازی پیام‌ها', value: '`/clear amount:50 user:@User`\nپارامترها: `amount` اجباری (1-100)، `user` اختیاری\nخطاها: پیام‌های قدیمی‌تر از ۱۴ روز' }
                );
        } else if (section === 'bot_settings') {
            const tokenStatus = config.bot && config.bot.token && !String(config.bot.token).includes('YOUR_') ? '✅ تنظیم شده' : '❌ تنظیم نشده';
            const clientIdStatus = config.bot && config.bot.clientId && !String(config.bot.clientId).includes('YOUR_') ? '✅ تنظیم شده' : '❌ تنظیم نشده';
            const guildIdStatus = config.bot && config.bot.guildId && !String(config.bot.guildId).includes('YOUR_') ? '✅ تنظیم شده' : '❌ تنظیم نشده';
            embed = embed
                .setTitle('⚙️ راهنمای تنظیمات بات')
                .setDescription('تنظیمات کلیدی در `config.json` و نکات کاربردی')
                .addFields(
                    { name: 'وضعیت اتصال', value: `توکن: ${tokenStatus} | Client ID: ${clientIdStatus} | Guild ID: ${guildIdStatus}` },
                    { name: 'کانال‌ها و نقش‌ها', value: 'مقادیر `channels.*` و `roles.*` را با IDهای صحیح پر کنید. برای ارسال منوی نقش/تیکت از `/sendrolemenu` و `/sendticketmenu` استفاده کنید.' },
                    { name: 'ویژگی‌ها', value: 'فعال‌سازی/غیرفعالسازی فیچرها در `features` (مثلا: `badWords`, `warningSystem`).' },
                    { name: 'به‌روزرسانی اطلاعات', value: 'برای دریافت آخرین وضعیت تنظیمات، از دکمه `Refresh` استفاده کنید.' }
                );
        } else if (section === 'admin_util') {
            embed = embed
                .setTitle('🧰 دستورات کاربردی برای ادمین‌ها')
                .setDescription('دستورات پیشرفته برای مدیریت حرفه‌ای')
                .addFields(
                    { name: 'ارسال پیام سفارشی', value: '`/sendmessage channel:#ch user:@User embed:true color:#2C3E50`\nقابلیت ارسال به کاربر یا کانال، با امبد.' },
                    { name: 'تبلیغ به نقش', value: '`/advertise target_role:@Role color:#E74C3C`\nبا مودال برای متن و دکمه و تصویر.' },
                    { name: 'گیووی', value: '`/start-giveaway channel:#ch duration:1d winners:2 prize:"جایزه"`\n`/end-giveaway messageid:123`' },
                    { name: 'آمار و اطلاعات', value: '`/invites`, `/invites-leaderboard`, `/rolestats`, `/serverinfo`, `/userinfo`' },
                    { name: 'مدیریت تیکت', value: '`/sendticketmenu` برای ایجاد منوی تیکت با دسته‌بندی و دکمه‌ها.' }
                );
        } else if (section === 'security_best') {
            embed = embed
                .setTitle('🛡️ نکات امنیتی و بهترین روش‌ها')
                .setDescription('راهنمای ایمن‌سازی بات و مدیریت سرور')
                .addFields(
                    { name: 'سیستم اخطار 3 مرحله‌ای', value: 'پس از 3 اخطار، بن خودکار. از `/warn` و `maxWarnings` در تنظیمات استفاده کنید.' },
                    { name: 'فیلتر کلمات بد', value: '`/addbadword`, `/removebadword`, `/listbadwords`, `/importbadwords` برای مدیریت لیست.' },
                    { name: 'Rate Limit و Cooldown', value: 'سیستم محدودکننده برای جلوگیری از اسپم دستورات. پیام‌های خطا شامل زمان باقی‌مانده.' },
                    { name: 'Anti-Raid و Blacklist', value: 'تشخیص حملات و محدودسازی خودکار. از دستورات `security status` و `security report` استفاده کنید.' },
                    { name: 'مجوزها', value: 'قبل از عملیات مدیریتی، دسترسی کاربر بررسی می‌شود. از نقش‌های مناسب استفاده کنید.' }
                );
        }

        const docs = {
            readme: (config.docs && config.docs.readmeUrl) || 'https://github.com/RezaNotHere/West-Bot#readme',
            setup: (config.docs && config.docs.setupUrl) || 'https://github.com/RezaNotHere/West-Bot/blob/main/SETUP.md',
            issues: (config.docs && config.docs.issuesUrl) || 'https://github.com/RezaNotHere/West-Bot/issues'
        };
        const linksRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('README').setURL(docs.readme),
            new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('SETUP').setURL(docs.setup),
            new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Issues').setURL(docs.issues),
            new ButtonBuilder().setCustomId('help_refresh').setStyle(ButtonStyle.Secondary).setLabel('Refresh')
        );
        await interaction.update({ embeds: [embed], components: [interaction.message.components[0], linksRow] });
        return;
    }

}

// --- handleModal ---
async function handleModal(interaction, client, env) {
    const { customId, fields, user, guild } = interaction;
    const REVIEW_CHANNEL_ID = config.channels.review;
    const BUYER_ROLE_ID = config.roles.buyer;

    // Defer the interaction if not already replied or deferred
    if (!interaction.replied && !interaction.deferred) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }

    const ensureDefer = async () => {
        if (!interaction.replied && !interaction.deferred) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        }
    };

    // --- support_appeal_modal_ ---
    if (customId.startsWith('support_appeal_modal_')) {
        const userId = customId.split('_')[3];
        
        // Check if this user is submitting their own appeal
        if (user.id !== userId) {
            return await interaction.editReply({ 
                content: '❌ You can only submit your own appeal.', 
                flags: MessageFlags.Ephemeral 
            });
        }

        try {
            const appealReason = fields.getTextInputValue('appeal_reason');
            const additionalInfo = fields.getTextInputValue('additional_info');

            // Get support ban channel from config
            const supportBanChannelId = config.channels.banSupport;
            if (!supportBanChannelId) {
                return await interaction.editReply({ 
                    content: '❌ Support ban channel not configured.', 
                    flags: MessageFlags.Ephemeral 
                });
            }

            const supportBanChannel = guild.channels.cache.get(supportBanChannelId);
            if (!supportBanChannel || !supportBanChannel.isTextBased()) {
                return await interaction.editReply({ 
                    content: '❌ Support ban channel not found or is not a text channel.', 
                    flags: MessageFlags.Ephemeral 
                });
            }

            // Store appeal in database
            const appeals = db.support.get('appeals') || {};
            appeals[userId] = {
                user_id: userId,
                user_tag: user.tag,
                reason: appealReason,
                additional_info: additionalInfo,
                submitted_at: Date.now(),
                status: 'pending'
            };
            db.support.set('appeals', appeals);

            // Create appeal embed for staff review
            const appealEmbed = new EmbedBuilder()
                .setColor('Yellow')
                .setTitle('📝 Support Ban Appeal Request')
                .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                .addFields(
                    { name: '👤 User', value: `${user.tag} (${user.id})`, inline: true },
                    { name: '📅 Submitted', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
                    { name: '📋 Appeal Reason', value: appealReason, inline: false }
                )
                .setTimestamp();

            if (additionalInfo) {
                appealEmbed.addFields({
                    name: 'ℹ️ Additional Information', 
                    value: additionalInfo, 
                    inline: false 
                });
            }

            // Add approval/rejection buttons
            const approveButton = new ButtonBuilder()
                .setCustomId(`approve_appeal_${userId}`)
                .setLabel('✅ Approve Appeal')
                .setStyle(ButtonStyle.Success);

            const denyButton = new ButtonBuilder()
                .setCustomId(`deny_appeal_${userId}`)
                .setLabel('❌ Deny Appeal')
                .setStyle(ButtonStyle.Danger);

            const actionRow = new ActionRowBuilder().addComponents(approveButton, denyButton);

            // Send to support ban channel
            await supportBanChannel.send({ 
                embeds: [appealEmbed], 
                components: [actionRow] 
            });

            // Confirm to user
            const confirmEmbed = new EmbedBuilder()
                .setColor('Green')
                .setTitle('✅ Appeal Submitted')
                .setDescription('Your support ban appeal has been submitted for review.')
                .addFields(
                    { name: '📝 Status', value: 'Pending review by staff', inline: true },
                    { name: '⏱️ Response Time', value: 'Staff will review your appeal shortly', inline: true }
                )
                .setFooter({ text: 'You will be notified of the decision' })
                .setTimestamp();

            await interaction.editReply({ embeds: [confirmEmbed] });

            if (logger) {
                await logger.logInfo('Support Appeal Submitted', {
                    User: `${user.tag} (${user.id})`,
                    AppealReason: appealReason.substring(0, 100),
                    SubmittedAt: Date.now()
                });
            }

        } catch (error) {
            console.error('Error submitting appeal:', error);
            await interaction.editReply({ 
                content: '❌ Error submitting appeal. Please try again later.', 
                flags: MessageFlags.Ephemeral 
            });
        }
        return;
    }

    if (customId.startsWith('server_unban_modal_')) {
        const userId = customId.split('_')[3];
        if (user.id !== userId) {
            return await interaction.editReply({ content: '❌ فقط خودتان می‌توانید درخواست آن‌بن ثبت کنید.', flags: MessageFlags.Ephemeral });
        }

        await ensureDefer();

        const banTime = (fields.getTextInputValue('ban_time') || '').trim();
        const justification = (fields.getTextInputValue('justification') || '').trim();
        const priorWarnings = (fields.getTextInputValue('prior_warnings') || 'نامشخص').trim();

        const allowedTimes = ['آخرین 1 ساعت', 'امروز', 'دیروز', 'هفته اخیر', 'نامشخص'];
        if (!allowedTimes.includes(banTime)) {
            return await interaction.editReply({ content: '❌ مقدار "ساعت تقریبی بن" نامعتبر است. از گزینه‌های پیشنهادی استفاده کنید.', flags: MessageFlags.Ephemeral });
        }
        if (!justification || justification.length < 10) {
            return await interaction.editReply({ content: '❌ لطفاً توضیح کافی برای دلیل اشتباه بودن بن وارد کنید (حداقل 10 کاراکتر).', flags: MessageFlags.Ephemeral });
        }

        const appeals = db.moderation.get('server_appeals') || {};
        appeals[userId] = {
            user_id: userId,
            user_tag: user.tag,
            account_created: user.createdTimestamp,
            ban_time: banTime,
            justification,
            prior_warnings: priorWarnings,
            submitted_at: Date.now(),
            status: 'pending'
        };
        db.moderation.set('server_appeals', appeals);

        const targetGuild = client.guilds.cache.get(config.bot.guildId);
        let banReason = 'N/A';
        try {
            if (targetGuild) {
                const banInfo = await targetGuild.bans.fetch(userId).catch(() => null);
                banReason = banInfo?.reason || 'N/A';
            }
        } catch {}

        const adminChannelId = config.channels.banSupport;
        if (!adminChannelId) {
            return await interaction.editReply({ content: '❌ کانال اپیل ادمین پیکربندی نشده است.', flags: MessageFlags.Ephemeral });
        }
        const adminChannel = targetGuild?.channels?.cache?.get(adminChannelId);
        if (!adminChannel || !adminChannel.isTextBased()) {
            return await interaction.editReply({ content: '❌ کانال اپیل ادمین یافت نشد یا متنی نیست.', flags: MessageFlags.Ephemeral });
        }

        const appealEmbed = new EmbedBuilder()
            .setColor('Yellow')
            .setTitle('📝 درخواست آن‌بن سرور')
            .setThumbnail(user.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '👤 کاربر', value: `${user.tag} (${user.id})`, inline: true },
                { name: '📅 ساخت حساب', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`, inline: true },
                { name: '⏰ زمان تقریبی بن', value: banTime, inline: true },
                { name: '🧾 دلیل بن (ثبت‌شده)', value: banReason || 'N/A', inline: false },
                { name: '📝 توضیحات کاربر', value: justification.substring(0, 1024), inline: false },
                { name: '⚠️ اخطار قبلی', value: priorWarnings || 'نامشخص', inline: true }
            )
            .setTimestamp();

        const approveBtn = new ButtonBuilder()
            .setCustomId(`server_unban_approve_${userId}`)
            .setLabel('✅ تایید')
            .setStyle(ButtonStyle.Success);
        const denyBtn = new ButtonBuilder()
            .setCustomId(`server_unban_deny_${userId}`)
            .setLabel('❌ رد')
            .setStyle(ButtonStyle.Danger);
        const row = new ActionRowBuilder().addComponents(approveBtn, denyBtn);

        await adminChannel.send({ embeds: [appealEmbed], components: [row] });

        await interaction.editReply({
            embeds: [new EmbedBuilder().setColor('Green').setDescription('✅ درخواست شما ثبت شد و توسط ادمین‌ها بررسی می‌شود.')]
        });

        if (logger) {
            await logger.logInfo('Server Unban Appeal Submitted', {
                User: `${user.tag} (${user.id})`,
                BanTime: banTime,
                PriorWarnings: priorWarnings,
                SubmittedAt: Date.now()
            });
        }
        return;
    }

    if (customId === 'add_card_modal') {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return await interaction.editReply({ content: '❌ شما دسترسی لازم برای افزودن کارت را ندارید.', flags: MessageFlags.Ephemeral });
        }

        try {
            const cardNumber = fields.getTextInputValue('card_number');
            const cardHolder = fields.getTextInputValue('card_holder');
            const bankName = fields.getTextInputValue('bank_name');

            // اعتبارسنجی شماره کارت (۱۶ رقم)
            if (!/^\d{16}$/.test(cardNumber)) {
                return await interaction.editReply({ content: '❌ شماره کارت باید دقیقاً ۱۶ رقم باشد.', flags: MessageFlags.Ephemeral });
            }

            // دریافت کارت‌های موجود
            const cards = db.cards.get('all_cards') || [];
            
            // ساخت آبجکت کارت جدید
            const newCard = {
                card_number: cardNumber,
                card_holder: cardHolder,
                bank_name: bankName,
                added_at: Date.now(),
                added_by: `${interaction.user.tag} (${interaction.user.id})`
            };

            cards.push(newCard);
            
            db.cards.set('all_cards', cards);

            const embed = new EmbedBuilder()
                .setColor('Green')
                .setTitle('✅ کارت بانکی اضافه شد')
                .setDescription('کارت با موفقیت در دیتابیس ذخیره شد.')
                .addFields(
                    { name: '🏦 نام بانک', value: bankName, inline: true },
                    { name: '👤 صاحب کارت', value: cardHolder, inline: true },
                    { name: '🔢 شماره کارت', value: `****-****-****-${cardNumber.slice(-4)}`, inline: true },
                    { name: '📊 موجودی کارت‌ها', value: `${cards.length} عدد`, inline: true }
                )
                .setFooter({ text: `اضافه شده توسط ${interaction.user.tag}` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            if (logger) {
                await logger.logInfo('Card Added', {
                    AddedBy: `${interaction.user.tag}`,
                    Bank: bankName,
                    Last4Digits: cardNumber.slice(-4),
                    TotalCards: cards.length
                });
            }

        } catch (error) {
            console.error('Error adding card:', error);
            await interaction.editReply({ content: '❌ خطا در ذخیره کارت در دیتابیس.', flags: MessageFlags.Ephemeral });
        }
        return;
    }

    if (customId.startsWith('review_comment_modal_')) {
        try {

            const rating = customId.split('_')[3];
            const comment = fields.getTextInputValue('comment_input');
            const stars = '⭐'.repeat(parseInt(rating));
            const reviewChannel = guild.channels.cache.get(REVIEW_CHANNEL_ID);

            if (reviewChannel && reviewChannel.isTextBased()) {
                const embed = new EmbedBuilder()
                    .setColor('Gold')
                    .setTitle('⭐ New Review Submitted ⭐')
                    .setAuthor({ name: user.username, iconURL: user.displayAvatarURL() })
                    .addFields({ name: 'Rating', value: stars, inline: true })
                    .setTimestamp();

                if (comment) embed.addFields({ name: 'User Comment', value: comment, inline: false });
                await reviewChannel.send({ embeds: [embed] });
            }

            const successEmbed = new EmbedBuilder().setColor('Green').setDescription('Thank you! Your review and rating have been submitted successfully.');
            await interaction.editReply({ embeds: [successEmbed] });

            if (BUYER_ROLE_ID) {
                const member = await guild.members.fetch(user.id);
                await member.roles.add(BUYER_ROLE_ID);
            }
        } catch (err) {
            // Only edit reply if deferred
            if (interaction.deferred && !interaction.replied) {
                try {
                    await interaction.editReply({ content: '❌ Error submitting review or rating.' });
                } catch (replyErr) {
                    // If editReply fails, log it but don't throw
                    if (logger) {
                        await logger.logError(replyErr, 'Modal Reply Error', {
                            CustomId: customId,
                            User: `${user.tag} (${user.id})`
                        });
                    }
                }
            } else if (!interaction.replied && !interaction.deferred) {
                try {
                    await interaction.reply({ content: '❌ Error submitting review or rating.', flags: MessageFlags.Ephemeral });
                } catch (replyErr) {
                    // If reply fails, log it but don't throw
                    if (logger) {
                        await logger.logError(replyErr, 'Modal Reply Error', {
                            CustomId: customId,
                            User: `${user.tag} (${user.id})`
                        });
                    }
                }
            }
            if (logger) {
                await logger.logError(err, 'Review Modal', {
                    CustomId: customId,
                    User: `${user.tag} (${user.id})`
                });
            } else {
                console.error('Error handling review modal:', err);
            }
        }
        return;
    }

    if (customId.startsWith('ticket_details_modal_')) {
        try {
            // Defer reply immediately to prevent timeout
            if (!interaction.replied && !interaction.deferred) {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});
            }

            const reason = customId.replace('ticket_details_modal_', '');
            const details = fields.getTextInputValue('ticket_details') || '';

            // Check if user already has a ticket
            if (db.tickets && db.tickets.has && db.tickets.has(user.id)) {
                const errorEmbed = new EmbedBuilder().setColor('Red').setDescription(`❌ You already have an open ticket: <#${db.tickets.get(user.id)}>`);
                return interaction.editReply({ embeds: [errorEmbed] });
            }

            // Create ticket channel with details
            await createTicketChannel(guild, user, reason, details);
            const ticketChannelId = (db.tickets && db.tickets.get) ? db.tickets.get(user.id) : null;
            
            const successEmbed = new EmbedBuilder()
                .setColor('Green')
                .setDescription(`تیکت شما با موفقیت ساخته شد!\n\nتیکت شما با جزئیات کامل ایجاد شد. برای دسترسی سریع به تیکت، روی لینک زیر کلیک کنید:\n\n[🚀 رفتن به تیکت](https://discord.com/channels/${guild.id}/${ticketChannelId})`);

            await interaction.editReply({ embeds: [successEmbed] });
            
            if (logger) {
                await logger.logTicket('Created (with details)', user, {
                    TicketChannel: ticketChannelId ? `<#${ticketChannelId}>` : 'N/A',
                    Reason: reason,
                    Category: reason,
                    HasDetails: details ? 'Yes' : 'No'
                });
            }
        } catch (err) {
            // Only edit reply if deferred
            if (interaction.deferred && !interaction.replied) {
                try {
                    await interaction.editReply({ content: '❌ Error creating ticket.' });
                } catch (replyErr) {
                    // If editReply fails, log it but don't throw
                    if (logger) {
                        await logger.logError(replyErr, 'Modal Reply Error', {
                            CustomId: customId,
                            User: `${user.tag} (${user.id})`
                        });
                    }
                }
            } else if (!interaction.replied && !interaction.deferred) {
                try {
                    await interaction.reply({ content: '❌ Error creating ticket.', flags: MessageFlags.Ephemeral });
                } catch (replyErr) {
                    // If reply fails, log it but don't throw
                    if (logger) {
                        await logger.logError(replyErr, 'Modal Reply Error', {
                            CustomId: customId,
                            User: `${user.tag} (${user.id})`
                        });
                    }
                }
            }
            
            if (logger) {
                await logger.logError(err, 'Ticket Details Modal', {
                    CustomId: customId,
                    User: `${user.tag} (${user.id})`,
                    Reason: reason
                });
            }
        }
    }

    if (customId === 'other_reason_modal') {
        try {
            const reason = fields.getTextInputValue('other_reason_input');
            await createTicketChannel(guild, user, 'other', reason);
            const ticketChannelId = (db.tickets && db.tickets.get) ? db.tickets.get(user.id) : null;

            const successEmbed = new EmbedBuilder()
                .setColor('Green')
                .setDescription(`تیکت شما با موفقیت ساخته شد!\n\nتیکت شما با جزئیات کامل ایجاد شد. برای دسترسی سریع به تیکت، روی لینک زیر کلیک کنید:\n\n[🚀 رفتن به تیکت](https://discord.com/channels/${guild.id}/${ticketChannelId})`);

            await interaction.editReply({ embeds: [successEmbed] });

            if (logger) {
                await logger.logTicket('Created (other)', user, {
                    TicketChannel: ticketChannelId ? `<#${ticketChannelId}>` : 'N/A',
                    Reason: reason,
                    Category: 'other'
                });
            }
        } catch (err) {
            // Only edit reply if deferred
            if (interaction.deferred && !interaction.replied) {
                try {
                    await interaction.editReply({ content: '❌ Error creating ticket.' });
                } catch (replyErr) {
                    // If editReply fails, log it but don't throw
                    if (logger) {
                        await logger.logError(replyErr, 'Modal Reply Error', {
                            CustomId: customId,
                            User: `${user.tag} (${user.id})`
                        });
                    }
                }
            }

            if (logger) {
                await logger.logError(err, 'Review Modal', {
                    CustomId: customId,
                    User: `${user.tag} (${user.id})`
                });
            } else {
                console.error('Error handling review modal:', err);
            }
        }
        return;
    }

    if (customId.startsWith('advertise_modal_')) {
        try {
            // Check if interaction is already replied/deferred
            if (interaction.replied || interaction.deferred) {
                return;
            }
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const parts = customId.split('_');
            const targetRoleId = parts[2];
            const color = parts[3] || 'Blue';
            const title = fields.getTextInputValue('advertise_title');
            const message = fields.getTextInputValue('advertise_message');
            const buttonText = fields.getTextInputValue('advertise_button_text');
            const buttonLink = fields.getTextInputValue('advertise_button_link');
            const imageUrl = fields.getTextInputValue('advertise_image_url');

            // Get target role and members
            const targetRole = guild.roles.cache.get(targetRoleId);
            if (!targetRole) {
                return await interaction.editReply({ content: '❌ Target role not found.', flags: MessageFlags.Ephemeral });
            }

            const membersWithRole = guild.members.cache.filter(member => 
                member.roles.cache.has(targetRoleId) && !member.user.bot
            );

            if (membersWithRole.size === 0) {
                return await interaction.editReply({ content: `❌ No members found with role ${targetRole.name}.`, flags: MessageFlags.Ephemeral });
            }

            // Color presets
            const colorMap = {
                Blue: 0x3498db,
                Green: 0x2ecc71,
                Red: 0xe74c3c,
                Yellow: 0xf1c40f,
                Orange: 0xe67e22,
                Purple: 0x9b59b6,
                Grey: 0x95a5a6
            };
            const embedColor = colorMap[color] || colorMap['Blue'];

            // Create advertisement embed
            const embed = new EmbedBuilder()
                .setColor(embedColor)
                .setTitle(`📢 ${title}`)
                .setDescription(message)
                .setFooter({ text: `Advertisement from ${guild.name}` })
                .setTimestamp();

            // Add image if provided
            if (imageUrl && imageUrl.trim()) {
                try {
                    embed.setImage(imageUrl.trim());
                } catch (error) {
                    console.log('Invalid image URL, skipping image:', error.message);
                }
            }

            // Prepare message components
            let components = [];
            
            // Add button if both text and link are provided
            if (buttonText && buttonText.trim() && buttonLink && buttonLink.trim()) {
                const button = new ButtonBuilder()
                    .setLabel(buttonText.trim())
                    .setURL(buttonLink.trim())
                    .setStyle(ButtonStyle.Link);
                
                components = [new ActionRowBuilder().addComponents(button)];
            }

            // Create preview embed
            const previewEmbed = new EmbedBuilder()
                .setColor(embedColor)
                .setTitle(`📢 ${title}`)
                .setDescription(message)
                .setFooter({ text: `Advertisement from ${guild.name}` })
                .setTimestamp();

            // Add image if provided
            if (imageUrl && imageUrl.trim()) {
                try {
                    previewEmbed.setImage(imageUrl.trim());
                } catch (error) {
                    console.log('Invalid image URL, skipping image:', error.message);
                }
            }

            // Create confirmation buttons with shorter customId
            const adData = {
                targetRoleId,
                color,
                title,
                message,
                buttonText,
                buttonLink,
                imageUrl
            };
            
            // Store data temporarily with a unique ID
            const confirmId = `adv_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`;
            
            // Store data in a temporary map (you could use a database for persistence)
            if (!global.tempAdData) global.tempAdData = new Map();
            global.tempAdData.set(confirmId, adData);
            
            const confirmButton = new ButtonBuilder()
                .setCustomId(confirmId)
                .setLabel('Send Advertisement')
                .setStyle(ButtonStyle.Success);

            const editButton = new ButtonBuilder()
                .setCustomId('advertise_edit')
                .setLabel('Edit')
                .setStyle(ButtonStyle.Secondary);

            const cancelButton = new ButtonBuilder()
                .setCustomId('advertise_cancel')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Danger);

            const actionRow = new ActionRowBuilder().addComponents(confirmButton, editButton, cancelButton);

            // Send preview
            await interaction.editReply({ 
                content: `📋 **Advertisement Preview**\n\nThis advertisement will be sent to **${membersWithRole.size}** members with the **${targetRole.name}** role.\n\nPlease confirm to send:`,
                embeds: [previewEmbed],
                components: [actionRow, ...components]
            });
            
            return; // Don't send the actual ads yet

        } catch (err) {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Error sending advertisement.', flags: MessageFlags.Ephemeral });
            } else {
                await interaction.editReply({ content: '❌ Error sending advertisement.', flags: MessageFlags.Ephemeral });
            }
            
            if (logger) {
                await logger.logError(err, 'Advertisement Modal', {
                    CustomId: customId,
                    User: `${user.tag} (${user.id})`
                });
            }
        }
        return;
    }

    if (customId.startsWith('sendmessage_modal_')) {
    // Check if interaction is already replied/deferred
    if (interaction.replied || interaction.deferred) {
        return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        const parts = customId.split('_');
        const targetId = parts[2];
        const useEmbed = parts[3] === 'true';
        const color = parts[4] || 'Blue';
        const text = fields.getTextInputValue('message_text');
        const embedTitle = useEmbed ? (fields.getTextInputValue('embed_title') || null) : null;

        // Color presets
        const colorMap = {
            Blue: 0x3498db,
            Green: 0x2ecc71,
            Red: 0xe74c3c,
            Yellow: 0xf1c40f,
            Orange: 0xe67e22,
            Purple: 0x9b59b6,
            Grey: 0x95a5a6
        };
        const embedColor = colorMap[color] || colorMap['Blue'];

        // Create message content
        let messageContent;
        if (useEmbed) {
            const embed = new EmbedBuilder()
                .setColor(embedColor)
                .setDescription(text)
                .setFooter({ text: `ارسال شده توسط ${interaction.user.tag} از سرور ${guild.name}` })
                .setTimestamp();

            if (embedTitle) {
                embed.setTitle(embedTitle);
            }
            messageContent = { embeds: [embed] };
        } else {
            messageContent = { content: text };
        }

        // Try DM first
        const target = await interaction.client.users.fetch(targetId).catch(() => null);

        if (target) {
            // DM send
            await target.send(messageContent);
            await interaction.editReply({
                content: `✅ Message sent successfully to ${target.tag}.`
            });
            await logAction(guild, `📩 ${interaction.user.tag} پیامی به کاربر ${target.tag} ارسال کرد.`);

            if (logger) {
                await logger.logModeration('Message Sent (DM)', interaction.user, target, {
                    MessageType: useEmbed ? 'Embed' : 'Text',
                    Color: color
                });
            }
        } else {
            // Send to channel
            const channel = await interaction.client.channels.fetch(targetId).catch(() => null);

            if (!channel) {
                throw new Error('مقصد پیام یافت نشد. لطفاً مطمئن شوید که آیدی کاربر یا چنل درست است.');
            }

            await channel.send(messageContent);
            await interaction.editReply({
                content: `✅ Message sent successfully to channel ${channel.name}.`
            });

            await logAction(guild, `📩 ${interaction.user.tag} پیامی در کانال ${channel.name} ارسال کرد.`);

            if (logger) {
                await logger.logModeration('Message Sent (Channel)', interaction.user,
                    { tag: 'System', id: '0' }, {
                        Channel: `${channel.name} (${channel.id})`,
                        MessageType: useEmbed ? 'Embed' : 'Text',
                        Color: color
                    });
            }
        }

    } catch (error) {
        console.error('Error in sendmessage modal:', error);
        await interaction.editReply({
            content: `❌ Error sending message: ${error.message}`
        });
    }
}
}

// --- handleAdvertisementButtons ---
async function handleAdvertisementButtons(interaction, client, env) {
    const { customId, user, guild } = interaction;
    
    if (customId === 'advertise_cancel') {
        await interaction.update({
            content: '❌ Advertisement cancelled.',
            embeds: [],
            components: []
        });
        return;
    }
    
    if (customId === 'advertise_edit') {
        // Find the most recent advertisement data for this user
        let adData = null;
        let confirmId = null;
        
        if (global.tempAdData) {
            for (const [id, data] of global.tempAdData.entries()) {
                // This is a simple approach - you could store user ID with the data for better matching
                adData = data;
                confirmId = id;
                break;
            }
        }
        
        if (!adData) {
            await interaction.update({
                content: '❌ No advertisement data found to edit. Please run the /advertise command again.',
                embeds: [],
                components: []
            });
            return;
        }
        
        // Create a new modal with the existing data
        const modal = new ModalBuilder()
            .setCustomId(`advertise_modal_${adData.targetRoleId}_${adData.color}`)
            .setTitle(`Edit Advertisement for ${guild.roles.cache.get(adData.targetRoleId)?.name || 'Unknown Role'}`)
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('advertise_title')
                        .setLabel('Advertisement Title')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('Enter your advertisement title...')
                        .setRequired(true)
                        .setMaxLength(256)
                        .setValue(adData.title || '')
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('advertise_message')
                        .setLabel('Advertisement Message')
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder('Enter your advertisement message...')
                        .setRequired(true)
                        .setMaxLength(2000)
                        .setValue(adData.message || '')
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('advertise_button_text')
                        .setLabel('Button Text (Optional)')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('e.g., Visit Shop, Learn More...')
                        .setRequired(false)
                        .setMaxLength(80)
                        .setValue(adData.buttonText || '')
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('advertise_button_link')
                        .setLabel('Button Link (Optional)')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('https://example.com')
                        .setRequired(false)
                        .setMaxLength(500)
                        .setValue(adData.buttonLink || '')
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('advertise_image_url')
                        .setLabel('Image URL (Optional)')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('https://example.com/image.jpg')
                        .setRequired(false)
                        .setMaxLength(500)
                        .setValue(adData.imageUrl || '')
                )
            );
        
        await interaction.showModal(modal);
        return;
    }
    
    if (customId.startsWith('adv_')) {
        try {
            await interaction.deferUpdate();
            
            // Get data from temporary storage
            const adData = global.tempAdData?.get(customId);
            if (!adData) {
                return await interaction.editReply({ content: '❌ Advertisement data expired. Please try again.' });
            }
            
            const { targetRoleId, color, title, message, buttonText, buttonLink, imageUrl } = adData;
            
            // Clean up temporary data
            global.tempAdData.delete(customId);
            
            // Get target role and members
            const targetRole = guild.roles.cache.get(targetRoleId);
            if (!targetRole) {
                return await interaction.editReply({ content: '❌ Target role not found.' });
            }
            
            const membersWithRole = guild.members.cache.filter(member => 
                member.roles.cache.has(targetRoleId) && !member.user.bot
            );
            
            if (membersWithRole.size === 0) {
                return await interaction.editReply({ content: `❌ No members found with role ${targetRole.name}.` });
            }
            
            // Color presets
            const colorMap = {
                Blue: 0x3498db,
                Green: 0x2ecc71,
                Red: 0xe74c3c,
                Yellow: 0xf1c40f,
                Orange: 0xe67e22,
                Purple: 0x9b59b6,
                Grey: 0x95a5a6
            };
            const embedColor = colorMap[color] || colorMap['Blue'];
            
            // Create advertisement embed
            const embed = new EmbedBuilder()
                .setColor(embedColor)
                .setTitle(`📢 ${title}`)
                .setDescription(message)
                .setFooter({ text: `Advertisement from ${guild.name}` })
                .setTimestamp();
            
            // Add image if provided
            if (imageUrl && imageUrl.trim()) {
                try {
                    embed.setImage(imageUrl.trim());
                } catch (error) {
                    console.log('Invalid image URL, skipping image:', error.message);
                }
            }
            
            // Prepare message components
            let components = [];
            
            // Add button if both text and link are provided
            if (buttonText && buttonText.trim() && buttonLink && buttonLink.trim()) {
                const button = new ButtonBuilder()
                    .setLabel(buttonText.trim())
                    .setURL(buttonLink.trim())
                    .setStyle(ButtonStyle.Link);
                
                components = [new ActionRowBuilder().addComponents(button)];
            }
            
            let successCount = 0;
            let failCount = 0;
            
            // Send advertisement to all members with the role
            for (const member of membersWithRole.values()) {
                try {
                    await member.send({ 
                        embeds: [embed],
                        components: components
                    });
                    successCount++;
                } catch (error) {
                    failCount++;
                    console.log(`Failed to send advertisement to ${member.user.tag}:`, error.message);
                }
            }
            
            const resultEmbed = new EmbedBuilder()
                .setColor(successCount > 0 ? 'Green' : 'Red')
                .setTitle('📊 Advertisement Results')
                .setDescription(`Advertisement sent to **${targetRole.name}** role members!`)
                .addFields(
                    { name: '✅ Successfully Sent', value: `${successCount} members`, inline: true },
                    { name: '❌ Failed', value: `${failCount} members`, inline: true },
                    { name: '👥 Total Targeted', value: `${membersWithRole.size} members`, inline: true }
                )
                .setTimestamp();
            
            await interaction.editReply({ 
                content: `✅ **Advertisement Successfully Sent!**\n\nYour advertisement has been sent to **${targetRole.name}** role members.`,
                embeds: [resultEmbed],
                components: []
            });
            
            if (logger) {
                await logger.logInfo('Advertisement Sent', {
                    Sender: `${user.tag} (${user.id})`,
                    TargetRole: targetRole.name,
                    SuccessCount: successCount,
                    FailCount: failCount,
                    TotalTargeted: membersWithRole.size,
                    Guild: guild.name
                });
            }
            
        } catch (error) {
            console.error('Error sending advertisement:', error);
            await interaction.editReply({ 
                content: '❌ Error sending advertisement.',
                embeds: [],
                components: []
            });
        }
        return;
    }
}

module.exports = {
    handleButton,
    handleSelectMenu,
    handleModal,
    handleModalSubmit: handleModal, // Alias for compatibility
    handleAdvertisementButtons,
    setLogger,
    setSecurity,
    setConfig
};
