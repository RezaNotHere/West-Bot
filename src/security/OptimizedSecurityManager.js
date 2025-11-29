/**
 * Optimized Security Manager - High Performance Version
 * Minimal logging, maximum speed, essential protection only
 */

const EnhancedRateLimiter = require('./EnhancedRateLimiter');
const AntiSpam = require('./AntiSpam'); // Use existing lightweight version
const InputValidator = require('./InputValidator');

class OptimizedSecurityManager {
    constructor(options = {}) {
        // Initialize only essential security systems
        this.rateLimiter = new EnhancedRateLimiter();
        this.antiSpam = new AntiSpam();
        this.inputValidator = new InputValidator();
        
        // Simple blacklist system
        this.blacklist = {
            users: new Set(),
            guilds: new Set()
        };
        
        // Admin system
        this.adminIds = new Set(options.adminIds || []);
        
        // Minimal statistics (for performance)
        this.stats = {
            totalRequests: 0,
            blockedRequests: 0,
            startTime: Date.now()
        };
        
        // Optimized configuration
        this.config = {
            enableInputValidation: true,
            enableRateLimiting: true,
            enableAntiSpam: true,
            enableBlacklist: true,
            logSecurityEvents: false, // NO LOGGING for performance
            emergencyMode: false
        };
        
        console.log('[OptimizedSecurityManager] High-performance security initialized');
    }

    /**
     * Fast interaction security check
     */
    async checkInteractionSecurity(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guild?.id;
        const commandName = interaction.commandName;
        
        this.stats.totalRequests++;
        
        // Quick whitelist check (bypass all)
        if (this.adminIds.has(userId)) {
            return { allowed: true, reason: 'admin' };
        }
        
        // Quick blacklist check
        if (this.blacklist.users.has(userId) || this.blacklist.guilds.has(guildId)) {
            this.stats.blockedRequests++;
            return {
                allowed: false,
                reason: 'blacklisted',
                message: 'Access denied'
            };
        }
        
        // Input validation (only for commands that need it)
        if (this.config.enableInputValidation && this.needsValidation(commandName)) {
            const inputCheck = this.validateInteractionInput(interaction);
            if (!inputCheck.allowed) {
                this.stats.blockedRequests++;
                return inputCheck;
            }
        }
        
        // Rate limiting (only for expensive commands)
        if (this.config.enableRateLimiting && this.needsRateLimit(commandName)) {
            const rateCheck = this.rateLimiter.checkLimit(interaction);
            if (!rateCheck.allowed) {
                this.stats.blockedRequests++;
                return rateCheck;
            }
        }
        
        return { allowed: true };
    }

    /**
     * Check if command needs validation
     */
    needsValidation(commandName) {
        const commandsNeedingValidation = [
            'mcinfo',
            'start-giveaway',
            'addbadword',
            'removebadword'
        ];
        return commandsNeedingValidation.includes(commandName);
    }

    /**
     * Check if command needs rate limiting
     */
    needsRateLimit(commandName) {
        const commandsNeedingRateLimit = [
            'mcinfo',
            'start-giveaway',
            'invites'
        ];
        return commandsNeedingRateLimit.includes(commandName);
    }

    /**
     * Fast input validation
     */
    validateInteractionInput(interaction) {
        const commandName = interaction.commandName;
        
        // Only validate specific commands
        if (commandName === 'mcinfo') {
            const username = interaction.options.getString("username")?.trim();
            if (!username) {
                return {
                    allowed: false,
                    reason: 'input_validation',
                    message: 'Username is required'
                };
            }
            
            const validation = this.inputValidator.validate(username, 'minecraftUsername');
            if (!validation.valid) {
                return {
                    allowed: false,
                    reason: 'input_validation',
                    message: 'Invalid username format'
                };
            }
        }
        
        return { allowed: true };
    }

    /**
     * Fast message spam check
     */
    async checkMessageSpam(message) {
        if (!this.config.enableAntiSpam) return { isSpam: false };
        
        // Use existing anti-spam but without logging
        return await this.antiSpam.checkMessage(message);
    }

    /**
     * Simple blacklist management
     */
    addToBlacklist(type, id) {
        if (this.blacklist[type]) {
            this.blacklist[type].add(id);
            return true;
        }
        return false;
    }

    removeFromBlacklist(type, id) {
        if (this.blacklist[type]) {
            this.blacklist[type].delete(id);
            return true;
        }
        return false;
    }

    /**
     * Check if user is admin
     */
    isAdmin(userId) {
        return this.adminIds.has(userId);
    }

    /**
     * Toggle emergency mode
     */
    toggleEmergencyMode(enabled) {
        this.config.emergencyMode = enabled;
        console.log(`[SecurityManager] Emergency mode ${enabled ? 'ENABLED' : 'DISABLED'}`);
    }

    /**
     * Get simple stats
     */
    getStats() {
        const uptime = Date.now() - this.stats.startTime;
        const requestsPerMinute = (this.stats.totalRequests / (uptime / 60000)).toFixed(2);
        
        return {
            totalRequests: this.stats.totalRequests,
            blockedRequests: this.stats.blockedRequests,
            blockRate: this.stats.totalRequests > 0 
                ? ((this.stats.blockedRequests / this.stats.totalRequests) * 100).toFixed(2)
                : 0,
            requestsPerMinute: parseFloat(requestsPerMinute),
            uptime,
            blacklistSize: {
                users: this.blacklist.users.size,
                guilds: this.blacklist.guilds.size
            },
            emergencyMode: this.config.emergencyMode
        };
    }

    /**
     * Reset user data
     */
    resetUser(userId) {
        this.rateLimiter.resetUser(userId);
        this.antiSpam.resetUser(userId);
    }
}

module.exports = OptimizedSecurityManager;
