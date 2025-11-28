// Advanced Anti-Spam System
const configManager = require('../../configManager');

class AntiSpam {
    constructor() {
        this.userMessages = new Map();
        this.spamPatterns = new Map();
        this.warnings = new Map();
        
        const antiSpamConfig = configManager.get('constants.antiSpam');
        this.config = {
            // Message spam detection
            maxMessagesPerWindow: antiSpamConfig.MAX_MESSAGES_PER_WINDOW,
            messageWindow: antiSpamConfig.MESSAGE_WINDOW,
            
            // Duplicate detection
            maxDuplicates: antiSpamConfig.MAX_DUPLICATES,
            duplicateWindow: antiSpamConfig.DUPLICATE_WINDOW,
            
            // Mention spam
            maxMentionsPerMessage: antiSpamConfig.MAX_MENTIONS_PER_MESSAGE,
            maxMentionsPerWindow: antiSpamConfig.MAX_MENTIONS_PER_WINDOW,
            mentionWindow: antiSpamConfig.MENTION_WINDOW,
            
            // Link spam
            maxLinksPerMessage: antiSpamConfig.MAX_LINKS_PER_MESSAGE,
            maxLinksPerWindow: antiSpamConfig.MAX_LINKS_PER_WINDOW,
            linkWindow: antiSpamConfig.LINK_WINDOW,
            
            // Caps lock spam
            capsPercentageThreshold: antiSpamConfig.CAPS_PERCENTAGE_THRESHOLD,
            minCapsLength: antiSpamConfig.MIN_CAPS_LENGTH,
            
            // Emoji spam
            maxEmojisPerMessage: antiSpamConfig.MAX_EMOJIS_PER_MESSAGE,
            
            // Actions
            muteOnViolation: true,
            muteDuration: antiSpamConfig.MUTE_DURATION,
            deleteSpamMessages: true,
            
            // Warnings before action
            maxWarnings: antiSpamConfig.MAX_WARNINGS,
            warningResetTime: antiSpamConfig.WARNING_RESET_TIME,
        };
        
        // Start cleanup
        this.startCleanup();
    }
    
    /**
     * Check if message is spam
     * @param {Message} message 
     * @returns {Object} { isSpam: boolean, reason: string, action: string }
     */
    async checkMessage(message) {
        // Ignore bots and system messages
        if (message.author.bot || message.system) {
            return { isSpam: false };
        }
        
        // Ignore admins
        if (message.member && message.member.permissions.has('Administrator')) {
            return { isSpam: false };
        }
        
        const userId = message.author.id;
        const content = message.content;
        const now = Date.now();
        
        // Initialize user data
        if (!this.userMessages.has(userId)) {
            this.userMessages.set(userId, []);
        }
        
        const userHistory = this.userMessages.get(userId);
        
        // Add current message
        userHistory.push({
            content: content,
            timestamp: now,
            messageId: message.id,
            channelId: message.channel.id
        });
        
        // 1. Check message frequency
        const frequencyCheck = this.checkMessageFrequency(userId, now);
        if (frequencyCheck.isSpam) {
            return await this.handleSpam(message, frequencyCheck);
        }
        
        // 2. Check duplicate messages
        const duplicateCheck = this.checkDuplicates(userId, content, now);
        if (duplicateCheck.isSpam) {
            return await this.handleSpam(message, duplicateCheck);
        }
        
        // 3. Check mention spam
        const mentionCheck = this.checkMentionSpam(message, userId, now);
        if (mentionCheck.isSpam) {
            return await this.handleSpam(message, mentionCheck);
        }
        
        // 4. Check link spam
        const linkCheck = this.checkLinkSpam(content, userId, now);
        if (linkCheck.isSpam) {
            return await this.handleSpam(message, linkCheck);
        }
        
        // 5. Check caps spam
        const capsCheck = this.checkCapsSpam(content);
        if (capsCheck.isSpam) {
            return await this.handleSpam(message, capsCheck);
        }
        
        // 6. Check emoji spam
        const emojiCheck = this.checkEmojiSpam(content);
        if (emojiCheck.isSpam) {
            return await this.handleSpam(message, emojiCheck);
        }
        
        return { isSpam: false };
    }
    
    checkMessageFrequency(userId, now) {
        const userHistory = this.userMessages.get(userId);
        const recentMessages = userHistory.filter(msg => now - msg.timestamp < this.config.messageWindow);
        
        if (recentMessages.length > this.config.maxMessagesPerWindow) {
            return {
                isSpam: true,
                reason: 'MESSAGE_FLOOD',
                severity: 'HIGH',
                details: `${recentMessages.length} پیام در ${this.config.messageWindow / 1000} ثانیه`
            };
        }
        
        return { isSpam: false };
    }
    
    checkDuplicates(userId, content, now) {
        if (!content || content.length < 3) return { isSpam: false };
        
        const userHistory = this.userMessages.get(userId);
        const recentMessages = userHistory.filter(msg => now - msg.timestamp < this.config.duplicateWindow);
        
        const duplicates = recentMessages.filter(msg => 
            msg.content.toLowerCase().trim() === content.toLowerCase().trim()
        );
        
        if (duplicates.length >= this.config.maxDuplicates) {
            return {
                isSpam: true,
                reason: 'DUPLICATE_MESSAGES',
                severity: 'MEDIUM',
                details: `${duplicates.length} پیام تکراری`
            };
        }
        
        return { isSpam: false };
    }
    
    checkMentionSpam(message, userId, now) {
        const mentions = message.mentions.users.size + message.mentions.roles.size;
        
        // Check mentions in single message
        if (mentions > this.config.maxMentionsPerMessage) {
            return {
                isSpam: true,
                reason: 'MENTION_SPAM',
                severity: 'HIGH',
                details: `${mentions} منشن در یک پیام`
            };
        }
        
        // Check mentions in time window
        const userHistory = this.userMessages.get(userId);
        const recentMessages = userHistory.filter(msg => now - msg.timestamp < this.config.mentionWindow);
        
        // We don't have mention data in history, so we estimate based on @ symbols
        const totalMentions = recentMessages.reduce((sum, msg) => {
            return sum + (msg.content.match(/@/g) || []).length;
        }, 0) + mentions;
        
        if (totalMentions > this.config.maxMentionsPerWindow) {
            return {
                isSpam: true,
                reason: 'MENTION_FLOOD',
                severity: 'HIGH',
                details: `${totalMentions} منشن در ${this.config.mentionWindow / 1000} ثانیه`
            };
        }
        
        return { isSpam: false };
    }
    
    checkLinkSpam(content, userId, now) {
        // Detect links
        const linkRegex = /(https?:\/\/[^\s]+)/gi;
        const links = content.match(linkRegex) || [];
        
        if (links.length > this.config.maxLinksPerMessage) {
            return {
                isSpam: true,
                reason: 'LINK_SPAM',
                severity: 'MEDIUM',
                details: `${links.length} لینک در یک پیام`
            };
        }
        
        // Check links in time window
        const userHistory = this.userMessages.get(userId);
        const recentMessages = userHistory.filter(msg => now - msg.timestamp < this.config.linkWindow);
        
        const totalLinks = recentMessages.reduce((sum, msg) => {
            const msgLinks = (msg.content.match(linkRegex) || []).length;
            return sum + msgLinks;
        }, 0) + links.length;
        
        if (totalLinks > this.config.maxLinksPerWindow) {
            return {
                isSpam: true,
                reason: 'LINK_FLOOD',
                severity: 'MEDIUM',
                details: `${totalLinks} لینک در ${this.config.linkWindow / 1000} ثانیه`
            };
        }
        
        return { isSpam: false };
    }
    
    checkCapsSpam(content) {
        if (content.length < this.config.minCapsLength) {
            return { isSpam: false };
        }
        
        const letters = content.replace(/[^a-zA-Z]/g, '');
        if (letters.length === 0) return { isSpam: false };
        
        const caps = content.replace(/[^A-Z]/g, '');
        const capsPercentage = (caps.length / letters.length) * 100;
        
        if (capsPercentage >= this.config.capsPercentageThreshold) {
            return {
                isSpam: true,
                reason: 'CAPS_SPAM',
                severity: 'LOW',
                details: `${Math.round(capsPercentage)}% حروف بزرگ`
            };
        }
        
        return { isSpam: false };
    }
    
    checkEmojiSpam(content) {
        // Detect emojis (Unicode and Discord custom)
        const emojiRegex = /(\p{Emoji}|<a?:\w+:\d+>)/gu;
        const emojis = content.match(emojiRegex) || [];
        
        if (emojis.length > this.config.maxEmojisPerMessage) {
            return {
                isSpam: true,
                reason: 'EMOJI_SPAM',
                severity: 'LOW',
                details: `${emojis.length} ایموجی در یک پیام`
            };
        }
        
        return { isSpam: false };
    }
    
    async handleSpam(message, spamCheck) {
        const userId = message.author.id;
        
        // Record warning
        if (!this.warnings.has(userId)) {
            this.warnings.set(userId, {
                count: 0,
                lastWarning: Date.now(),
                violations: []
            });
        }
        
        const userWarnings = this.warnings.get(userId);
        userWarnings.count++;
        userWarnings.lastWarning = Date.now();
        userWarnings.violations.push({
            reason: spamCheck.reason,
            severity: spamCheck.severity,
            timestamp: Date.now(),
            channelId: message.channel.id
        });
        
        console.warn(`[AntiSpam] User ${userId} (${message.author.tag}) - ${spamCheck.reason}: ${spamCheck.details}`);
        
        // Delete spam message
        if (this.config.deleteSpamMessages) {
            try {
                await message.delete();
            } catch (err) {
                console.error('[AntiSpam] Failed to delete message:', err.message);
            }
        }
        
        // Send warning
        let warningMessage = `⚠️ ${message.author}, اسپم نکن!\n**دلیل:** ${this.getReasonText(spamCheck.reason)}`;
        
        if (userWarnings.count >= this.config.maxWarnings) {
            // Apply mute
            if (this.config.muteOnViolation && message.member) {
                try {
                    await message.member.timeout(this.config.muteDuration, `Anti-Spam: ${spamCheck.reason}`);
                    warningMessage = `🚫 ${message.author} به دلیل spam مکرر برای ${this.config.muteDuration / 60000} دقیقه Timeout شد!`;
                    console.warn(`[AntiSpam] User ${userId} MUTED for ${this.config.muteDuration / 60000} minutes`);
                } catch (err) {
                    console.error('[AntiSpam] Failed to timeout user:', err.message);
                }
            }
        } else {
            warningMessage += `\n⚡ هشدار ${userWarnings.count}/${this.config.maxWarnings}`;
        }
        
        try {
            const warningMsg = await message.channel.send(warningMessage);
            setTimeout(() => warningMsg.delete().catch(() => {}), 10000);
        } catch (err) {
            console.error('[AntiSpam] Failed to send warning:', err.message);
        }
        
        return {
            isSpam: true,
            reason: spamCheck.reason,
            severity: spamCheck.severity,
            action: userWarnings.count >= this.config.maxWarnings ? 'MUTED' : 'WARNING',
            warnings: userWarnings.count
        };
    }
    
    getReasonText(reason) {
        const reasons = {
            'MESSAGE_FLOOD': 'ارسال پیام‌های متوالی بیش از حد',
            'DUPLICATE_MESSAGES': 'ارسال پیام‌های تکراری',
            'MENTION_SPAM': 'منشن کردن بیش از حد',
            'MENTION_FLOOD': 'منشن کردن مکرر',
            'LINK_SPAM': 'ارسال لینک‌های زیاد',
            'LINK_FLOOD': 'ارسال مکرر لینک',
            'CAPS_SPAM': 'استفاده بیش از حد از حروف بزرگ',
            'EMOJI_SPAM': 'استفاده بیش از حد از ایموجی'
        };
        
        return reasons[reason] || 'رفتار مشکوک';
    }
    
    // Reset user warnings
    resetUser(userId) {
        this.userMessages.delete(userId);
        this.warnings.delete(userId);
        return true;
    }
    
    // Get user stats
    getUserStats(userId) {
        const messages = this.userMessages.get(userId) || [];
        const warnings = this.warnings.get(userId);
        
        return {
            totalMessages: messages.length,
            recentMessages: messages.filter(msg => Date.now() - msg.timestamp < 60000).length,
            warnings: warnings ? warnings.count : 0,
            violations: warnings ? warnings.violations : []
        };
    }
    
    startCleanup() {
        this.cleanupInterval = setInterval(() => {
            const now = Date.now();
            
            for (const [userId, messages] of this.userMessages) {
                const filtered = messages.filter(msg => now - msg.timestamp < 3600000);
                
                if (filtered.length === 0) {
                    this.userMessages.delete(userId);
                } else {
                    this.userMessages.set(userId, filtered);
                }
            }
            
            for (const [userId, data] of this.warnings) {
                if (now - data.lastWarning > this.config.warningResetTime) {
                    data.count = Math.max(0, data.count - 1);
                    data.violations = data.violations.filter(v => now - v.timestamp < this.config.warningResetTime);
                    
                    if (data.count === 0 && data.violations.length === 0) {
                        this.warnings.delete(userId);
                    }
                }
            }
            
            console.log(`[AntiSpam] Cleanup: ${this.userMessages.size} users tracked, ${this.warnings.size} users with warnings`);
        }, 60000);
    }
    
    stopCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
    }
}

module.exports = AntiSpam;
