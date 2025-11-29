/**
 * Enhanced Security Manager with Advanced Protection
 * Integrates all security systems with comprehensive logging
 */

const EnhancedRateLimiter = require('./EnhancedRateLimiter');
const EnhancedAntiSpam = require('./AntiSpam'); // Use existing file
const InputValidator = require('./InputValidator');

class EnhancedSecurityManager {
    constructor(options = {}) {
        // Initialize security systems
        this.rateLimiter = new EnhancedRateLimiter();
        this.antiSpam = new EnhancedAntiSpam();
        this.inputValidator = new InputValidator();
        
        // Blacklist and whitelist systems
        this.blacklist = {
            users: new Set(),
            guilds: new Set(),
            ips: new Set(),
            domains: new Set()
        };
        
        this.whitelist = {
            users: new Set(),
            roles: new Set(),
            guilds: new Set()
        };
        
        // Admin system
        this.adminIds = new Set(options.adminIds || []);
        
        // Security event logging
        this.securityLog = [];
        this.maxLogSize = 1000;
        
        // Statistics
        this.stats = {
            totalRequests: 0,
            blockedRequests: 0,
            spamDetected: 0,
            rateLimitBlocks: 0,
            blacklistBlocks: 0,
            inputValidationBlocks: 0,
            startTime: Date.now()
        };
        
        // Configuration
        this.config = {
            enableInputValidation: true,
            enableRateLimiting: true,
            enableAntiSpam: true,
            enableBlacklist: true,
            logSecurityEvents: false, // Disabled to reduce log spam
            autoBanThreshold: 10, // Auto-ban after 10 violations
            quarantineMode: false, // Enable during attacks
            emergencyMode: false  // Enable during severe attacks
        };
        
        // Emergency mode settings
        this.emergencySettings = {
            rateLimitMultiplier: 0.1, // 90% reduction
            antiSpamSensitivity: 2,    // Double sensitivity
            requireAdminApproval: true  // Only admins can use commands
        };
        
        console.log('[EnhancedSecurityManager] Initialized with advanced protection systems');
    }

    /**
     * Check interaction security (comprehensive)
     */
    async checkInteractionSecurity(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guild?.id;
        const commandName = interaction.commandName;
        const now = Date.now();
        
        this.stats.totalRequests++;
        
        // Check emergency mode
        if (this.config.emergencyMode) {
            const emergencyCheck = this.checkEmergencyMode(interaction);
            if (!emergencyCheck.allowed) {
                return emergencyCheck;
            }
        }
        
        // Check whitelist (bypass all checks)
        if (this.isWhitelisted(userId, guildId)) {
            return { allowed: true, reason: 'whitelisted' };
        }
        
        // Check blacklist
        if (this.config.enableBlacklist) {
            const blacklistCheck = this.checkBlacklist(userId, guildId);
            if (!blacklistCheck.allowed) {
                return blacklistCheck;
            }
        }
        
        // Check admin permissions
        if (this.isAdmin(userId)) {
            return { allowed: true, reason: 'admin' };
        }
        
        // Input validation
        if (this.config.enableInputValidation) {
            const inputCheck = this.validateInteractionInput(interaction);
            if (!inputCheck.allowed) {
                return inputCheck;
            }
        }
        
        // Rate limiting
        if (this.config.enableRateLimiting) {
            const rateCheck = this.rateLimiter.checkLimit(interaction);
            if (!rateCheck.allowed) {
                this.stats.rateLimitBlocks++;
                this.logSecurityEvent('RATE_LIMIT', userId, commandName, rateCheck.reason);
                return rateCheck;
            }
        }
        
        // Additional checks for messages
        if (interaction.type === 0) { // Message
            if (this.config.enableAntiSpam) {
                const spamCheck = await this.antiSpam.checkMessage(interaction);
                if (spamCheck.isSpam) {
                    this.stats.spamDetected++;
                    this.logSecurityEvent('SPAM_DETECTED', userId, null, spamCheck.reason);
                    return {
                        allowed: false,
                        reason: 'spam_detected',
                        message: 'Message flagged as spam',
                        details: spamCheck
                    };
                }
            }
        }
        
        return { allowed: true };
    }

    /**
     * Validate interaction input
     */
    validateInteractionInput(interaction) {
        const commandName = interaction.commandName;
        
        // Define validation rules for each command
        const validationRules = {
            'mcinfo': {
                username: { type: 'minecraftUsername', required: true }
            },
            'start-giveaway': {
                prize: { type: 'safeText', required: true, maxLength: 100 },
                duration: { type: 'duration', required: true },
                winners: { type: 'numbers', required: true, min: 1, max: 10 }
            },
            'addbadword': {
                word: { type: 'safeText', required: true, maxLength: 50 }
            },
            'invites': {
                user: { type: 'discordId', required: false }
            }
        };
        
        const rules = validationRules[commandName];
        if (!rules) return { allowed: true };
        
        const inputs = {};
        const errors = [];
        
        // Collect inputs from interaction
        Object.entries(rules).forEach(([field, rule]) => {
            if (rule.required) {
                const value = interaction.options.getString(field) || 
                             interaction.options.getInteger(field) || 
                             interaction.options.getUser(field)?.id;
                
                if (value === undefined) {
                    errors.push(`Missing required field: ${field}`);
                    return;
                }
                
                inputs[field] = { value, type: rule.type, options: rule };
            }
        });
        
        // Validate inputs
        if (Object.keys(inputs).length > 0) {
            const validation = this.inputValidator.validateMultiple(inputs);
            
            if (!validation.allValid) {
                const errorMessages = Object.entries(validation.results)
                    .filter(([_, result]) => !result.valid)
                    .map(([field, result]) => `${field}: ${result.errors.join(', ')}`);
                
                this.stats.inputValidationBlocks++;
                this.logSecurityEvent('INPUT_VALIDATION', interaction.user.id, commandName, errorMessages.join('; '));
                
                return {
                    allowed: false,
                    reason: 'input_validation',
                    message: 'Invalid input detected',
                    details: errorMessages
                };
            }
        }
        
        return { allowed: true };
    }

    /**
     * Check blacklist
     */
    checkBlacklist(userId, guildId) {
        if (this.blacklist.users.has(userId)) {
            this.stats.blacklistBlocks++;
            this.logSecurityEvent('BLACKLIST_USER', userId, null, 'User is blacklisted');
            return {
                allowed: false,
                reason: 'blacklisted_user',
                message: 'You are blacklisted from using this bot'
            };
        }
        
        if (guildId && this.blacklist.guilds.has(guildId)) {
            this.stats.blacklistBlocks++;
            this.logSecurityEvent('BLACKLIST_GUILD', userId, guildId, 'Guild is blacklisted');
            return {
                allowed: false,
                reason: 'blacklisted_guild',
                message: 'This guild is blacklisted from using this bot'
            };
        }
        
        return { allowed: true };
    }

    /**
     * Check emergency mode
     */
    checkEmergencyMode(interaction) {
        if (!this.config.emergencyMode) return { allowed: true };
        
        // Only admins can use commands in emergency mode
        if (!this.isAdmin(interaction.user.id)) {
            return {
                allowed: false,
                reason: 'emergency_mode',
                message: 'Bot is in emergency mode - only admins can use commands'
            };
        }
        
        return { allowed: true };
    }

    /**
     * Check if user is admin
     */
    isAdmin(userId) {
        return this.adminIds.has(userId);
    }

    /**
     * Check if user/guild is whitelisted
     */
    isWhitelisted(userId, guildId) {
        return this.whitelist.users.has(userId) || 
               (guildId && this.whitelist.guilds.has(guildId));
    }

    /**
     * Add to blacklist
     */
    addToBlacklist(type, id, reason = 'No reason provided') {
        if (!this.blacklist[type]) return false;
        
        this.blacklist[type].add(id);
        this.logSecurityEvent('BLACKLIST_ADD', 'SYSTEM', null, `Added ${type}: ${id} - ${reason}`);
        
        return true;
    }

    /**
     * Remove from blacklist
     */
    removeFromBlacklist(type, id) {
        if (!this.blacklist[type]) return false;
        
        this.blacklist[type].delete(id);
        this.logSecurityEvent('BLACKLIST_REMOVE', 'SYSTEM', null, `Removed ${type}: ${id}`);
        
        return true;
    }

    /**
     * Add to whitelist
     */
    addToWhitelist(type, id) {
        if (!this.whitelist[type]) return false;
        
        this.whitelist[type].add(id);
        this.logSecurityEvent('WHITELIST_ADD', 'SYSTEM', null, `Added ${type}: ${id}`);
        
        return true;
    }

    /**
     * Remove from whitelist
     */
    removeFromWhitelist(type, id) {
        if (!this.whitelist[type]) return false;
        
        this.whitelist[type].delete(id);
        this.logSecurityEvent('WHITELIST_REMOVE', 'SYSTEM', null, `Removed ${type}: ${id}`);
        
        return true;
    }

    /**
     * Toggle emergency mode
     */
    toggleEmergencyMode(enabled, reason = 'Manual activation') {
        this.config.emergencyMode = enabled;
        this.logSecurityEvent('EMERGENCY_MODE', 'SYSTEM', null, `${enabled ? 'ENABLED' : 'DISABLED'} - ${reason}`);
        
        if (enabled) {
            // Apply emergency settings
            // This would modify the rate limiter and anti-spam settings
            console.warn('[SecurityManager] EMERGENCY MODE ACTIVATED - All systems on high alert');
        } else {
            console.log('[SecurityManager] Emergency mode deactivated');
        }
    }

    /**
     * Reset user data
     */
    resetUser(userId) {
        this.rateLimiter.resetUser(userId);
        this.antiSpam.resetUser(userId);
        this.logSecurityEvent('USER_RESET', 'SYSTEM', null, `Reset data for user: ${userId}`);
    }

    /**
     * Get comprehensive statistics
     */
    getStats() {
        const uptime = Date.now() - this.stats.startTime;
        const requestsPerMinute = (this.stats.totalRequests / (uptime / 60000)).toFixed(2);
        const blockRate = ((this.stats.blockedRequests / this.stats.totalRequests) * 100).toFixed(2);
        
        return {
            ...this.stats,
            uptime: uptime,
            requestsPerMinute: parseFloat(requestsPerMinute),
            blockRate: parseFloat(blockRate),
            blacklistSize: {
                users: this.blacklist.users.size,
                guilds: this.blacklist.guilds.size,
                ips: this.blacklist.ips.size
            },
            whitelistSize: {
                users: this.whitelist.users.size,
                guilds: this.whitelist.guilds.size,
                roles: this.whitelist.roles.size
            },
            emergencyMode: this.config.emergencyMode,
            quarantineMode: this.config.quarantineMode
        };
    }

    /**
     * Log security event
     */
    logSecurityEvent(type, userId, commandName, details) {
        const event = {
            type,
            userId,
            commandName,
            details,
            timestamp: Date.now()
        };
        
        this.securityLog.push(event);
        
        // Keep log size manageable
        if (this.securityLog.length > this.maxLogSize) {
            this.securityLog = this.securityLog.slice(-this.maxLogSize);
        }
        
        // Log to console if enabled
        if (this.config.logSecurityEvents) {
            console.warn(`[SECURITY] ${type}: ${details}`, { userId, commandName });
        }
    }

    /**
     * Get recent security events
     */
    getRecentEvents(limit = 50) {
        return this.securityLog.slice(-limit);
    }

    /**
     * Get security report
     */
    getSecurityReport() {
        const now = Date.now();
        const last24h = now - (24 * 60 * 60 * 1000);
        
        const recentEvents = this.securityLog.filter(event => event.timestamp > last24h);
        const eventsByType = {};
        
        recentEvents.forEach(event => {
            eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
        });
        
        return {
            period: 'Last 24 hours',
            totalEvents: recentEvents.length,
            eventsByType,
            topViolators: this.getTopViolators(recentEvents),
            recommendations: this.generateRecommendations(eventsByType)
        };
    }

    /**
     * Get top violators
     */
    getTopViolators(events) {
        const violators = {};
        
        events.forEach(event => {
            if (event.userId && event.userId !== 'SYSTEM') {
                violators[event.userId] = (violators[event.userId] || 0) + 1;
            }
        });
        
        return Object.entries(violators)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([userId, count]) => ({ userId, violations: count }));
    }

    /**
     * Generate security recommendations
     */
    generateRecommendations(eventsByType) {
        const recommendations = [];
        
        if (eventsByType.RATE_LIMIT > 10) {
            recommendations.push('Consider tightening rate limits');
        }
        
        if (eventsByType.SPAM_DETECTED > 5) {
            recommendations.push('Increase anti-spam sensitivity');
        }
        
        if (eventsByType.INPUT_VALIDATION > 3) {
            recommendations.push('Review input validation rules');
        }
        
        if (eventsByType.BLACKLIST_USER > 0) {
            recommendations.push('Monitor blacklisted user activity');
        }
        
        return recommendations;
    }
}

module.exports = EnhancedSecurityManager;
