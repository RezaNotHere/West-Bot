/**
 * Enhanced Rate Limiter with Advanced Protection
 * Multiple strategies: user, IP, guild, command, global
 */

class EnhancedRateLimiter {
    constructor() {
        // Storage for different rate limit types
        this.userLimits = new Map();      // Per-user limits
        this.ipLimits = new Map();        // Per-IP limits (if available)
        this.guildLimits = new Map();     // Per-guild limits
        this.commandLimits = new Map();   // Per-command limits
        this.globalLimits = [];           // Global request tracking

        // Configuration
        this.config = {
            // User limits
            user: {
                requestsPerMinute: 10,
                requestsPerHour: 100,
                burstLimit: 5,
                punishmentThresholds: {
                    warning: 15,
                    tempBan: 25,
                    permaBan: 50
                }
            },
            
            // Command-specific cooldowns
            commandCooldowns: {
                'mcinfo': 5000,
                'start-giveaway': 30000,
                'end-giveaway': 10000,
                'addbadword': 2000,
                'removebadword': 2000,
                'invites': 10000,
                'rolestats': 5000
            },

            // Global limits
            global: {
                requestsPerMinute: 1000,
                requestsPerHour: 10000
            },

            // Punishment durations (ms)
            punishments: {
                warning: 0,
                tempBan: 10 * 60 * 1000,      // 10 minutes
                permaBan: 24 * 60 * 60 * 1000  // 24 hours
            }
        };

        // Start cleanup interval
        this.startCleanup();
    }

    /**
     * Check rate limit for a request
     */
    checkLimit(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guild?.id;
        const commandName = interaction.commandName;
        const ip = this.getIP(interaction);

        // Check all limit types
        const checks = [
            this.checkUserLimit(userId, commandName),
            this.checkCommandLimit(commandName, userId),
            this.checkGlobalLimit()
        ];

        if (guildId) {
            checks.push(this.checkGuildLimit(guildId));
        }

        if (ip) {
            checks.push(this.checkIPLimit(ip));
        }

        // Find the most restrictive check
        const restrictiveCheck = checks.find(check => !check.allowed) || checks[0];

        // Update statistics
        this.updateStats(userId, restrictiveCheck.allowed);

        return restrictiveCheck;
    }

    /**
     * Check user-specific rate limit
     */
    checkUserLimit(userId, commandName) {
        const now = Date.now();
        let userData = this.userLimits.get(userId);

        if (!userData) {
            userData = {
                requests: [],
                violations: 0,
                lastPunishment: 0,
                punishedUntil: 0
            };
            this.userLimits.set(userId, userData);
        }

        // Clean old requests
        userData.requests = userData.requests.filter(time => now - time < 60 * 1000);

        // Check limits
        if (userData.requests.length >= this.config.user.requestsPerMinute) {
            return this.handleViolation(userId, 'user', 'Too many requests per minute');
        }

        if (userData.requests.length >= this.config.user.burstLimit) {
            return this.handleViolation(userId, 'user', 'Burst limit exceeded');
        }

        // Add current request
        userData.requests.push(now);
        return { allowed: true };
    }

    /**
     * Check command-specific cooldown
     */
    checkCommandLimit(commandName, userId) {
        const cooldown = this.config.commandCooldowns[commandName];
        if (!cooldown) return { allowed: true };

        const key = `${commandName}:${userId}`;
        const lastUsed = this.commandLimits.get(key);

        if (lastUsed && Date.now() - lastUsed < cooldown) {
            const remaining = Math.ceil((cooldown - (Date.now() - lastUsed)) / 1000);
            return {
                allowed: false,
                reason: 'Command cooldown',
                message: `Please wait ${remaining} seconds before using this command again.`
            };
        }

        this.commandLimits.set(key, Date.now());
        return { allowed: true };
    }

    /**
     * Check guild-specific rate limit
     */
    checkGuildLimit(guildId) {
        const now = Date.now();
        let guildData = this.guildLimits.get(guildId);

        if (!guildData) {
            guildData = { requests: [] };
            this.guildLimits.set(guildId, guildData);
        }

        // Clean old requests
        guildData.requests = guildData.requests.filter(time => now - time < 60 * 1000);

        // Check limit (more permissive for guilds)
        if (guildData.requests.length >= 50) {
            return {
                allowed: false,
                reason: 'Guild rate limit',
                message: 'This guild has exceeded the rate limit. Please slow down.'
            };
        }

        guildData.requests.push(now);
        return { allowed: true };
    }

    /**
     * Check global rate limit
     */
    checkGlobalLimit() {
        const now = Date.now();

        // Clean old requests
        this.globalLimits = this.globalLimits.filter(time => now - time < 60 * 1000);

        if (this.globalLimits.length >= this.config.global.requestsPerMinute) {
            return {
                allowed: false,
                reason: 'Global rate limit',
                message: 'Bot is experiencing high traffic. Please try again later.'
            };
        }

        this.globalLimits.push(now);
        return { allowed: true };
    }

    /**
     * Check IP-specific rate limit
     */
    checkIPLimit(ip) {
        const now = Date.now();
        let ipData = this.ipLimits.get(ip);

        if (!ipData) {
            ipData = { requests: [] };
            this.ipLimits.set(ip, ipData);
        }

        // Clean old requests
        ipData.requests = ipData.requests.filter(time => now - time < 60 * 1000);

        if (ipData.requests.length >= 20) {
            return {
                allowed: false,
                reason: 'IP rate limit',
                message: 'Too many requests from this IP address.'
            };
        }

        ipData.requests.push(now);
        return { allowed: true };
    }

    /**
     * Handle violations and apply punishments
     */
    handleViolation(userId, type, reason) {
        const userData = this.userLimits.get(userId);
        if (!userData) return { allowed: false, reason };

        userData.violations++;
        const now = Date.now();

        // Check if user is currently punished
        if (now < userData.punishedUntil) {
            const remaining = Math.ceil((userData.punishedUntil - now) / 1000 / 60);
            return {
                allowed: false,
                reason: 'Punishment active',
                message: `You are temporarily banned for ${remaining} minutes.`
            };
        }

        // Determine punishment level
        const thresholds = this.config.user.punishmentThresholds;
        let punishment = null;

        if (userData.violations >= thresholds.permaBan) {
            punishment = 'permaBan';
            userData.punishedUntil = now + this.config.punishments.permaBan;
        } else if (userData.violations >= thresholds.tempBan) {
            punishment = 'tempBan';
            userData.punishedUntil = now + this.config.punishments.tempBan;
        } else if (userData.violations >= thresholds.warning) {
            punishment = 'warning';
        }

        if (punishment) {
            return {
                allowed: false,
                reason: 'Rate limit violation',
                message: this.getPunishmentMessage(punishment, userData.violations)
            };
        }

        return {
            allowed: false,
            reason: 'Rate limit',
            message: 'Rate limit exceeded. Please slow down.'
        };
    }

    /**
     * Get punishment message
     */
    getPunishmentMessage(punishment, violations) {
        const messages = {
            warning: `⚠️ Warning: You have exceeded the rate limit (${violations} violations). Please slow down.`,
            tempBan: `🚫 You have been temporarily banned for rate limit violations (${violations} violations).`,
            permaBan: `🚫 You have been permanently banned for excessive rate limit violations (${violations} violations).`
        };
        return messages[punishment] || 'Rate limit exceeded.';
    }

    /**
     * Get IP from interaction (if available)
     */
    getIP(interaction) {
        // Note: Discord doesn't provide IP directly for privacy reasons
        // This would need to be implemented at the proxy/websocket level
        return null;
    }

    /**
     * Update statistics
     */
    updateStats(userId, allowed) {
        // Reduced logging - only log blocks, not all requests
        if (!allowed && Math.random() < 0.1) { // Log only 10% of blocks
            console.warn(`[RateLimiter] User ${userId} blocked`);
        }
    }

    /**
     * Reset user data
     */
    resetUser(userId) {
        this.userLimits.delete(userId);
        
        // Clean command limits for this user
        for (const key of this.commandLimits.keys()) {
            if (key.endsWith(`:${userId}`)) {
                this.commandLimits.delete(key);
            }
        }
    }

    /**
     * Get user statistics
     */
    getUserStats(userId) {
        const userData = this.userLimits.get(userId);
        return userData || { requests: [], violations: 0 };
    }

    /**
     * Start cleanup interval
     */
    startCleanup() {
        setInterval(() => {
            const now = Date.now();
            const oneHour = 60 * 60 * 1000;

            // Clean old data
            this.userLimits.forEach((data, userId) => {
                data.requests = data.requests.filter(time => now - time < oneHour);
                if (data.requests.length === 0 && now > data.punishedUntil) {
                    this.userLimits.delete(userId);
                }
            });

            this.globalLimits = this.globalLimits.filter(time => now - time < oneHour);
            
            // Clean command limits older than 1 hour
            for (const [key, time] of this.commandLimits.entries()) {
                if (now - time > oneHour) {
                    this.commandLimits.delete(key);
                }
            }
        }, 5 * 60 * 1000); // Run every 5 minutes
    }
}

module.exports = EnhancedRateLimiter;
