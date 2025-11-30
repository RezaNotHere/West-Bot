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
    
    // Handle advertisement buttons
    if (interaction.customId.startsWith('advertise_')) {
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
            const messages = await channel.messages.fetch({ limit: 10 });
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
                        .setLabel('🔓 باز کردن تیکت')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('create_transcript')
                        .setLabel('📋 ساخت ترنسکریپت')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('ticket_delete')
                        .setLabel('🗑️ حذف تیکت')
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
            const messages = await channel.messages.fetch({ limit: 10 });
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
            .setPlaceholder('امتیاز خود را انتخاب کنید')
            .addOptions(
                new StringSelectMenuOptionBuilder().setLabel('⭐ 1 ستاره').setValue('1'),
                new StringSelectMenuOptionBuilder().setLabel('⭐⭐ 2 ستاره').setValue('2'),
                new StringSelectMenuOptionBuilder().setLabel('⭐⭐⭐ 3 ستاره').setValue('3'),
                new StringSelectMenuOptionBuilder().setLabel('⭐⭐⭐⭐ 4 ستاره').setValue('4'),
                new StringSelectMenuOptionBuilder().setLabel('⭐⭐⭐⭐⭐ 5 ستاره').setValue('5')
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
                const messages = await channel.messages.fetch({ limit: 20 });
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
            const messages = await channel.messages.fetch({ limit: 10 });
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
            const input = new TextInputBuilder().setCustomId('other_reason_input').setLabel('لطفا دلیل خود را بنویسید').setStyle(TextInputStyle.Paragraph).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            return interaction.showModal(modal);
        }

        // Check if interaction is already replied/deferred
        if (interaction.replied || interaction.deferred) {
            return;
        }
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
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
        const commentInput = new TextInputBuilder().setCustomId('comment_input').setLabel('نظر خود را بنویسید (اختیاری)').setStyle(TextInputStyle.Paragraph).setRequired(false);
        modal.addComponents(new ActionRowBuilder().addComponents(commentInput));
        await interaction.showModal(modal);
    }

}

// --- handleModal ---
async function handleModal(interaction, client, env) {
    const { customId, fields, user, guild } = interaction;
    const REVIEW_CHANNEL_ID = config.channels.review;
    const BUYER_ROLE_ID = config.roles.buyer;

    if (customId.startsWith('review_comment_modal_')) {
        try {
            // Check if interaction is already replied/deferred
            if (interaction.replied || interaction.deferred) {
                return;
            }

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
            await interaction.reply({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });

            if (BUYER_ROLE_ID) {
                const member = await guild.members.fetch(user.id);
                await member.roles.add(BUYER_ROLE_ID);
            }
        } catch (err) {
            // Only reply if not already replied
            if (!interaction.replied && !interaction.deferred) {
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
            await createTicketChannel(guild, user, reason, null, details);
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
            // Check if interaction is already replied/deferred
            if (interaction.replied || interaction.deferred) {
                return;
            }
            
            const reason = fields.getTextInputValue('other_reason_input');
            await createTicketChannel(guild, user, 'other', reason);
            const ticketChannelId = (db.tickets && db.tickets.get) ? db.tickets.get(user.id) : null;
            
            const successEmbed = new EmbedBuilder()
                .setColor('Green')
                .setDescription(`تیکت شما با موفقیت ساخته شد!\n\nتیکت شما با جزئیات کامل ایجاد شد. برای دسترسی سریع به تیکت، روی لینک زیر کلیک کنید:\n\n[🚀 رفتن به تیکت](https://discord.com/channels/${guild.id}/${ticketChannelId})`);

            await interaction.reply({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });
            
            if (logger) {
                await logger.logTicket('Created (other)', user, {
                    TicketChannel: ticketChannelId ? `<#${ticketChannelId}>` : 'N/A',
                    Reason: reason,
                    Category: 'other'
                });
            }
        } catch (err) {
            // Only reply if not already replied
            if (!interaction.replied && !interaction.deferred) {
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
            const confirmId = `advertise_confirm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Store data in a temporary map (you could use a database for persistence)
            if (!global.tempAdData) global.tempAdData = new Map();
            global.tempAdData.set(confirmId, adData);
            
            const confirmButton = new ButtonBuilder()
                .setCustomId(confirmId)
                .setLabel('✅ Send Advertisement')
                .setStyle(ButtonStyle.Success);

            const editButton = new ButtonBuilder()
                .setCustomId('advertise_cancel')
                .setLabel('✏️ Edit')
                .setStyle(ButtonStyle.Secondary);

            const cancelButton = new ButtonBuilder()
                .setCustomId('advertise_cancel')
                .setLabel('❌ Cancel')
                .setStyle(ButtonStyle.Danger);

            const actionRow = new ActionRowBuilder().addComponents(confirmButton, editButton, cancelButton);

            // Send preview
            await interaction.editReply({ 
                content: `📋 **Advertisement Preview**\n\nThis advertisement will be sent to **${membersWithRole.size}** members with the **${targetRole.name}** role.\n\nPlease review and confirm:`,
                embeds: [previewEmbed],
                components: [actionRow, ...components]
            });
            
            return; // Don't send the actual ads yet

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

            await interaction.editReply({ embeds: [resultEmbed] }); // Remove ephemeral flag

            if (logger) {
                await logger.logInfo('Advertisement Sent', {
                    Sender: `${interaction.user.tag} (${interaction.user.id})`,
                    TargetRole: targetRole.name,
                    SuccessCount: successCount,
                    FailCount: failCount,
                    TotalTargeted: membersWithRole.size,
                    Guild: guild.name
                });
            }

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
        await interaction.update({
            content: '✏️ Please run the /advertise command again to edit your advertisement.',
            embeds: [],
            components: []
        });
        return;
    }
    
    if (customId.startsWith('advertise_confirm_')) {
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
