/**
 * Enhanced Anti-Spam System with Advanced Detection
 * Multiple spam detection algorithms and intelligent filtering
 */

class EnhancedAntiSpam {
    constructor() {
        // User tracking
        this.userMessages = new Map();
        this.userWarnings = new Map();
        this.messageHashes = new Map();
        this.mentionTracking = new Map();
        this.linkTracking = new Map();

        // Configuration
        this.config = {
            // Message spam detection
            maxMessagesPerWindow: 5,
            messageWindow: 10 * 1000, // 10 seconds
            
            // Duplicate detection
            maxDuplicates: 3,
            duplicateWindow: 30 * 1000, // 30 seconds
            similarityThreshold: 0.8, // 80% similarity
            
            // Mention spam
            maxMentionsPerMessage: 5,
            maxMentionsPerWindow: 10,
            mentionWindow: 60 * 1000, // 1 minute
            
            // Link spam
            maxLinksPerMessage: 3,
            maxLinksPerWindow: 5,
            linkWindow: 60 * 1000, // 1 minute
            
            // Character-based spam
            maxMessageLength: 2000,
            capsPercentageThreshold: 70,
            minCapsLength: 10,
            maxEmojisPerMessage: 10,
            
            // Pattern-based spam
            repeatedCharsThreshold: 5, // e.g., "aaaaa"
            repeatedWordsThreshold: 3, // e.g., "hello hello hello"
            
            // Actions
            deleteSpamMessages: true,
            warnUser: true,
            muteDuration: 5 * 60 * 1000, // 5 minutes
            maxWarnings: 3,
            warningResetTime: 10 * 60 * 1000, // 10 minutes
            
            // Advanced detection
            detectZalgo: true,
            detectFakeUnicode: true,
            detectRapidFire: true,
            rapidFireThreshold: 3, // messages in 2 seconds
        };

        // Spam patterns
        this.spamPatterns = {
            zalgo: /[\u0300-\u036F\u0483-\u0489\u1DC0-\u1DF9\u20D0-\u20FF\uFE20-\uFE2F]/g,
            repeatedChars: /(.)\1{4,}/gi,
            repeatedWords: /(\b\w+\b)(?=.*\b\1\b)/gi,
            excessiveEmojis: /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}]/gu,
            fakeUnicode: /[\u{200B}-\u{200D}\u{FEFF}\u{2060}\u{180E}]/gu,
            suspiciousLinks: /(bit\.ly|tinyurl\.com|t\.co|goo\.gl|short\.link)/gi,
            inviteLinks: /(discord\.gg\/|discord\.com\/invite\/|discordapp\.com\/invite\/)/gi,
            phoneNumbers: /(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
            emails: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g
        };

        // Start cleanup
        this.startCleanup();
    }

    /**
     * Check message for spam
     */
    async checkMessage(message) {
        const userId = message.author.id;
        const content = message.content;
        const now = Date.now();

        // Initialize user data
        this.initUserData(userId);

        const userData = this.userMessages.get(userId);
        const checks = [];

        // Run all spam checks
        checks.push(this.checkMessageFrequency(userId, content, now));
        checks.push(this.checkDuplicateMessages(userId, content, now));
        checks.push(this.checkMentionSpam(userId, message, now));
        checks.push(this.checkLinkSpam(userId, content, now));
        checks.push(this.checkCharacterSpam(content));
        checks.push(this.checkPatternSpam(content));
        checks.push(this.checkAdvancedSpam(content));

        // Find the most severe violation
        const violation = checks.find(check => check.isSpam) || { isSpam: false };

        if (violation.isSpam) {
            await this.handleSpam(message, userId, violation);
        }

        // Track message
        userData.messages.push({
            content: content,
            timestamp: now,
            hash: this.hashMessage(content)
        });

        return violation;
    }

    /**
     * Initialize user data
     */
    initUserData(userId) {
        if (!this.userMessages.has(userId)) {
            this.userMessages.set(userId, {
                messages: [],
                lastMessageTime: 0,
                rapidFireCount: 0
            });
        }

        if (!this.userWarnings.has(userId)) {
            this.userWarnings.set(userId, {
                count: 0,
                lastWarning: 0,
                lastMute: 0
            });
        }
    }

    /**
     * Check message frequency
     */
    checkMessageFrequency(userId, content, now) {
        const userData = this.userMessages.get(userId);
        
        // Clean old messages
        userData.messages = userData.messages.filter(
            msg => now - msg.timestamp < this.config.messageWindow
        );

        // Check rapid fire
        if (this.config.detectRapidFire) {
            const recentMessages = userData.messages.filter(
                msg => now - msg.timestamp < 2000 // 2 seconds
            );

            if (recentMessages.length >= this.config.rapidFireThreshold) {
                return {
                    isSpam: true,
                    type: 'rapid_fire',
                    reason: 'Sending messages too quickly',
                    severity: 'high'
                };
            }
        }

        // Check general frequency
        if (userData.messages.length >= this.config.maxMessagesPerWindow) {
            return {
                isSpam: true,
                type: 'frequency',
                reason: 'Too many messages in short time',
                severity: 'medium'
            };
        }

        return { isSpam: false };
    }

    /**
     * Check duplicate messages
     */
    checkDuplicateMessages(userId, content, now) {
        const userData = this.userMessages.get(userId);
        const messageHash = this.hashMessage(content);

        // Find similar messages
        const similarMessages = userData.messages.filter(msg => {
            const timeDiff = now - msg.timestamp;
            const similarity = this.calculateSimilarity(content, msg.content);
            return timeDiff < this.config.duplicateWindow && similarity > this.config.similarityThreshold;
        });

        if (similarMessages.length >= this.config.maxDuplicates) {
            return {
                isSpam: true,
                type: 'duplicate',
                reason: 'Sending similar messages repeatedly',
                severity: 'medium'
            };
        }

        return { isSpam: false };
    }

    /**
     * Check mention spam
     */
    checkMentionSpam(userId, message, now) {
        const mentions = message.mentions.users.size + message.mentions.roles.size;
        
        // Initialize mention tracking
        if (!this.mentionTracking.has(userId)) {
            this.mentionTracking.set(userId, []);
        }

        const mentionData = this.mentionTracking.get(userId);
        
        // Clean old mentions
        mentionData.filter(time => now - time < this.config.mentionWindow);

        // Add current mentions
        for (let i = 0; i < mentions; i++) {
            mentionData.push(now);
        }

        // Check per-message limit
        if (mentions > this.config.maxMentionsPerMessage) {
            return {
                isSpam: true,
                type: 'mention_spam',
                reason: 'Too many mentions in one message',
                severity: 'high'
            };
        }

        // Check window limit
        if (mentionData.length > this.config.maxMentionsPerWindow) {
            return {
                isSpam: true,
                type: 'mention_spam_window',
                reason: 'Too many mentions in time window',
                severity: 'medium'
            };
        }

        return { isSpam: false };
    }

    /**
     * Check link spam
     */
    checkLinkSpam(userId, content, now) {
        const links = content.match(/https?:\/\/[^\s]+/gi) || [];
        
        // Initialize link tracking
        if (!this.linkTracking.has(userId)) {
            this.linkTracking.set(userId, []);
        }

        const linkData = this.linkTracking.get(userId);
        
        // Clean old links
        linkData.filter(time => now - time < this.config.linkWindow);

        // Add current links
        for (let i = 0; i < links.length; i++) {
            linkData.push(now);
        }

        // Check per-message limit
        if (links.length > this.config.maxLinksPerMessage) {
            return {
                isSpam: true,
                type: 'link_spam',
                reason: 'Too many links in one message',
                severity: 'medium'
            };
        }

        // Check window limit
        if (linkData.length > this.config.maxLinksPerWindow) {
            return {
                isSpam: true,
                type: 'link_spam_window',
                reason: 'Too many links in time window',
                severity: 'medium'
            };
        }

        // Check for suspicious links
        if (this.spamPatterns.suspiciousLinks.test(content)) {
            return {
                isSpam: true,
                type: 'suspicious_links',
                reason: 'Suspicious short links detected',
                severity: 'high'
            };
        }

        return { isSpam: false };
    }

    /**
     * Check character-based spam
     */
    checkCharacterSpam(content) {
        const violations = [];

        // Check message length
        if (content.length > this.config.maxMessageLength) {
            violations.push('Message too long');
        }

        // Check caps lock
        if (content.length >= this.config.minCapsLength) {
            const capsCount = (content.match(/[A-Z]/g) || []).length;
            const capsPercentage = (capsCount / content.length) * 100;
            
            if (capsPercentage > this.config.capsPercentageThreshold) {
                violations.push('Excessive caps lock');
            }
        }

        // Check emoji spam
        const emojis = (content.match(this.spamPatterns.excessiveEmojis) || []).length;
        if (emojis > this.config.maxEmojisPerMessage) {
            violations.push('Too many emojis');
        }

        if (violations.length > 0) {
            return {
                isSpam: true,
                type: 'character_spam',
                reason: violations.join(', '),
                severity: 'low'
            };
        }

        return { isSpam: false };
    }

    /**
     * Check pattern-based spam
     */
    checkPatternSpam(content) {
        const violations = [];

        // Check repeated characters
        if (this.spamPatterns.repeatedChars.test(content)) {
            violations.push('Repeated characters');
        }

        // Check repeated words
        if (this.spamPatterns.repeatedWords.test(content)) {
            violations.push('Repeated words');
        }

        // Check for invite links (if not allowed)
        if (this.spamPatterns.inviteLinks.test(content)) {
            violations.push('Discord invite links');
        }

        // Check for personal information
        if (this.spamPatterns.phoneNumbers.test(content)) {
            violations.push('Phone numbers');
        }

        if (this.spamPatterns.emails.test(content)) {
            violations.push('Email addresses');
        }

        if (violations.length > 0) {
            return {
                isSpam: true,
                type: 'pattern_spam',
                reason: violations.join(', '),
                severity: 'medium'
            };
        }

        return { isSpam: false };
    }

    /**
     * Check advanced spam techniques
     */
    checkAdvancedSpam(content) {
        const violations = [];

        // Check zalgo text
        if (this.config.detectZalgo && this.spamPatterns.zalgo.test(content)) {
            violations.push('Zalgo text');
        }

        // Check fake unicode
        if (this.config.detectFakeUnicode && this.spamPatterns.fakeUnicode.test(content)) {
            violations.push('Hidden unicode characters');
        }

        if (violations.length > 0) {
            return {
                isSpam: true,
                type: 'advanced_spam',
                reason: violations.join(', '),
                severity: 'high'
            };
        }

        return { isSpam: false };
    }

    /**
     * Handle spam detection
     */
    async handleSpam(message, userId, violation) {
        const warningData = this.userWarnings.get(userId);
        const now = Date.now();

        // Delete message if configured
        if (this.config.deleteSpamMessages) {
            try {
                await message.delete();
            } catch (err) {
                // Silent error - no logging for spam deletions
            }
        }

        // Update warnings
        warningData.count++;
        warningData.lastWarning = now;

        // Determine action based on warning count
        if (warningData.count >= this.config.maxWarnings) {
            // Mute user
            if (now - warningData.lastMute < this.config.muteDuration) {
                try {
                    await message.member.timeout(this.config.muteDuration, `Anti-Spam: ${violation.reason}`);
                    warningData.lastMute = now;
                    warningData.count = 0; // Reset warnings after mute
                } catch (err) {
                    // Silent error - no logging for mute failures
                }
            }
        } else if (this.config.warnUser) { // Always send warning DM
            // Send warning
            try {
                await message.author.send(
                    `⚠️ Warning: Your message was flagged as spam (${violation.reason}).
                    Warning ${warningData.count}/${this.config.maxWarnings}`
                );
            } catch (err) {
                // Silent error - user has DMs disabled
            }
        }
    }

    /**
     * Calculate message similarity
     */
    calculateSimilarity(str1, str2) {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) return 1.0;
        
        const editDistance = this.levenshteinDistance(longer, shorter);
        return (longer.length - editDistance) / longer.length;
    }

    /**
     * Calculate Levenshtein distance
     */
    levenshteinDistance(str1, str2) {
        const matrix = [];
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        return matrix[str2.length][str1.length];
    }

    /**
     * Hash message for duplicate detection
     */
    hashMessage(content) {
        // Simple hash - could be improved with better algorithm
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash;
    }

    /**
     * Reset user data
     */
    resetUser(userId) {
        this.userMessages.delete(userId);
        this.userWarnings.delete(userId);
        this.mentionTracking.delete(userId);
        this.linkTracking.delete(userId);
    }

    /**
     * Get user statistics
     */
    getUserStats(userId) {
        return {
            messages: this.userMessages.get(userId)?.messages || [],
            warnings: this.userWarnings.get(userId)?.count || 0,
            mentions: this.mentionTracking.get(userId)?.length || 0,
            links: this.linkTracking.get(userId)?.length || 0
        };
    }

    /**
     * Start cleanup interval
     */
    startCleanup() {
        setInterval(() => {
            const now = Date.now();
            const oneHour = 60 * 60 * 1000;

            // Clean old data
            this.userMessages.forEach((data, userId) => {
                data.messages = data.messages.filter(msg => now - msg.timestamp < oneHour);
                if (data.messages.length === 0) {
                    this.userMessages.delete(userId);
                }
            });

            this.userWarnings.forEach((data, userId) => {
                if (now - data.lastWarning > this.config.warningResetTime) {
                    data.count = 0;
                }
                if (now - data.lastWarning > oneHour) {
                    this.userWarnings.delete(userId);
                }
            });
        }, 5 * 60 * 1000); // Run every 5 minutes
    }
}

module.exports = EnhancedAntiSpam;
