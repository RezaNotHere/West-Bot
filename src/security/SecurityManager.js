// Central Security Management System with Enhanced Logging
const RateLimiter = require('./RateLimiter');
const AntiSpam = require('./AntiSpam');
const AntiRaid = require('./AntiRaid');

class SecurityManager {
    constructor(options = {}) {
        this.rateLimiter = new RateLimiter();
        this.antiSpam = new AntiSpam();
        this.antiRaid = new AntiRaid();
        
        // Logger instance (set externally)
        this.logger = null;
        
        // Blacklist system
        this.blacklist = {
            users: new Set(),
            guilds: new Set(),
            ips: new Set()
        };
        
        // Whitelist (bypass all checks)
        this.whitelist = {
            users: new Set(),
            roles: new Set()
        };
        
        // Admin IDs (full bypass + control)
        this.adminIds = new Set(options.adminIds || []);
        
        // Security events log
        this.securityLog = [];
        this.maxLogSize = 1000;
        
        // Statistics
        this.stats = {
            totalRequests: 0,
            blockedRequests: 0,
            spamDetected: 0,
            raidsDetected: 0,
            blacklistBlocks: 0,
            rateLimitBlocks: 0,
            startTime: Date.now()
        };
        
        console.log('[SecurityManager] Initialized with all protection systems');
    }
    
    /**
     * Set logger instance
     */
    setLogger(logger) {
        this.logger = logger;
        this.rateLimiter.setLogger(logger);
        this.antiSpam.setLogger(logger);
        this.antiRaid.setLogger(logger);
    }
    
    /**
     * Check interaction security with enhanced logging
     */
    async checkInteraction(interaction) {
        this.stats.totalRequests++;
        
        const userId = interaction.user.id;
        const commandName = interaction.commandName || interaction.customId || 'Unknown';
        const guildId = interaction.guild?.id || 'DM';
        
        // Check if user is admin (bypass all)
        if (this.adminIds.has(userId)) {
            return { allowed: true, reason: 'ADMIN_BYPASS' };
        }
        
        // Check if user is whitelisted
        if (this.whitelist.users.has(userId)) {
            return { allowed: true, reason: 'WHITELISTED' };
        }
        
        // Check if user has whitelisted role
        if (interaction.member) {
            const hasWhitelistedRole = interaction.member.roles.cache.some(role => 
                this.whitelist.roles.has(role.id)
            );
            if (hasWhitelistedRole) {
                return { allowed: true, reason: 'WHITELISTED_ROLE' };
            }
        }
        
        // Check blacklist
        if (this.blacklist.users.has(userId)) {
            this.stats.blacklistBlocks++;
            this.logSecurityEvent('BLACKLIST_BLOCK', userId, commandName, 'User is blacklisted');
            
            if (this.logger) {
                await this.logger.logSecurity('Blacklist Block', 
                    `User ${interaction.user.tag} attempted to use ${commandName}`,
                    {
                        User: `${interaction.user.tag} (${userId})`,
                        Command: commandName,
                        Guild: guildId,
                        Reason: 'User is blacklisted'
                    },
                    'high'
                );
            }
            
            return {
                allowed: false,
                reason: 'BLACKLISTED',
                message: '🚫 You are blacklisted from using this bot.'
            };
        }
        
        if (interaction.guild && this.blacklist.guilds.has(interaction.guild.id)) {
            this.stats.blacklistBlocks++;
            this.logSecurityEvent('BLACKLIST_BLOCK', userId, commandName, 'Guild is blacklisted');
            
            if (this.logger) {
                await this.logger.logSecurity('Guild Blacklist Block',
                    `Guild ${interaction.guild.name} is blacklisted`,
                    {
                        User: `${interaction.user.tag} (${userId})`,
                        Guild: `${interaction.guild.name} (${interaction.guild.id})`,
                        Command: commandName
                    },
                    'high'
                );
            }
            
            return {
                allowed: false,
                reason: 'GUILD_BLACKLISTED',
                message: '🚫 This server is blacklisted from using this bot.'
            };
        }
        
        // Check rate limit
        const rateCheck = this.rateLimiter.checkLimit(userId, commandName);
        if (!rateCheck.allowed) {
            this.stats.blockedRequests++;
            this.stats.rateLimitBlocks++;
            this.logSecurityEvent('RATE_LIMIT', userId, commandName, rateCheck.reason);
            
            if (this.logger) {
                await this.logger.logSecurity('Rate Limit Exceeded',
                    `User ${interaction.user.tag} exceeded rate limit`,
                    {
                        User: `${interaction.user.tag} (${userId})`,
                        Command: commandName,
                        Reason: rateCheck.reason,
                        RetryAfter: `${rateCheck.retryAfter || 0}s`,
                        Guild: guildId
                    },
                    'medium'
                );
            }
            
            return {
                allowed: false,
                reason: rateCheck.reason,
                message: rateCheck.message || '⏱️ Rate limit exceeded. Please wait.',
                retryAfter: rateCheck.retryAfter
            };
        }
        
        return { allowed: true };
    }
    
    /**
     * Check message security with enhanced logging
     */
    async checkMessage(message) {
        // Ignore bots
        if (message.author.bot) {
            return { allowed: true };
        }
        
        const userId = message.author.id;
        const guildId = message.guild?.id || 'DM';
        
        // Check if user is admin (bypass spam check)
        if (this.adminIds.has(userId)) {
            return { allowed: true, reason: 'ADMIN_BYPASS' };
        }
        
        // Check if user is whitelisted
        if (this.whitelist.users.has(userId)) {
            return { allowed: true, reason: 'WHITELISTED' };
        }
        
        // Check blacklist
        if (this.blacklist.users.has(userId)) {
            try {
                await message.delete();
                
                if (this.logger) {
                    await this.logger.logSecurity('Blacklisted Message Deleted',
                        `Deleted message from blacklisted user ${message.author.tag}`,
                        {
                            User: `${message.author.tag} (${userId})`,
                            Channel: `${message.channel.name} (${message.channel.id})`,
                            Guild: guildId,
                            Content: message.content.substring(0, 100)
                        },
                        'high'
                    );
                }
            } catch (err) {
                console.error('[SecurityManager] Failed to delete blacklisted user message:', err.message);
            }
            
            return {
                allowed: false,
                reason: 'BLACKLISTED',
                action: 'DELETED'
            };
        }
        
        // Check spam
        const spamCheck = await this.antiSpam.checkMessage(message);
        if (spamCheck.isSpam) {
            this.stats.spamDetected++;
            this.logSecurityEvent('SPAM_DETECTED', userId, null, `${spamCheck.reason} - ${spamCheck.action}`);
            
            if (this.logger) {
                await this.logger.logSecurity('Spam Detected',
                    `Spam detected from ${message.author.tag}`,
                    {
                        User: `${message.author.tag} (${userId})`,
                        Reason: spamCheck.reason,
                        Severity: spamCheck.severity,
                        Action: spamCheck.action,
                        Channel: `${message.channel.name} (${message.channel.id})`,
                        Guild: guildId,
                        Warnings: spamCheck.warnings || 0
                    },
                    spamCheck.severity === 'HIGH' ? 'high' : 'medium'
                );
            }
            
            return {
                allowed: false,
                reason: spamCheck.reason,
                severity: spamCheck.severity,
                action: spamCheck.action
            };
        }
        
        return { allowed: true };
    }
    
    /**
     * Check member join security with enhanced logging
     */
    async checkMemberJoin(member) {
        const userId = member.user.id;
        const guildId = member.guild.id;
        
        // Check blacklist
        if (this.blacklist.users.has(userId)) {
            try {
                await member.kick('Blacklisted user');
                
                if (this.logger) {
                    await this.logger.logSecurity('Blacklisted User Kicked',
                        `Kicked blacklisted user ${member.user.tag} on join`,
                        {
                            User: `${member.user.tag} (${userId})`,
                            Guild: `${member.guild.name} (${guildId})`,
                            AccountAge: `${Math.floor((Date.now() - member.user.createdTimestamp) / 86400000)} days`
                        },
                        'high'
                    );
                }
            } catch (err) {
                console.error('[SecurityManager] Failed to kick blacklisted user:', err.message);
            }
            
            return {
                allowed: false,
                reason: 'BLACKLISTED',
                action: 'KICKED'
            };
        }
        
        // Check raid
        const raidCheck = await this.antiRaid.checkMemberJoin(member);
        if (raidCheck.isRaid) {
            this.stats.raidsDetected++;
            this.logSecurityEvent('RAID_DETECTED', userId, null, `${raidCheck.reason} - ${raidCheck.action}`);
            
            if (this.logger) {
                await this.logger.logSecurity('Raid Detected',
                    `Raid detected in ${member.guild.name}`,
                    {
                        User: `${member.user.tag} (${userId})`,
                        Guild: `${member.guild.name} (${guildId})`,
                        Reason: raidCheck.reason,
                        Severity: raidCheck.severity,
                        Action: raidCheck.action,
                        Lockdown: raidCheck.lockdown ? 'Enabled' : 'Not Enabled'
                    },
                    raidCheck.severity === 'CRITICAL' ? 'critical' : 'high'
                );
            }
            
            return {
                allowed: false,
                reason: raidCheck.reason,
                severity: raidCheck.severity,
                action: raidCheck.action
            };
        }
        
        return { allowed: true };
    }
    
    // Blacklist management with logging
    addToBlacklist(type, id, reason = '') {
        if (!['user', 'guild', 'ip'].includes(type)) {
            return false;
        }
        
        this.blacklist[type + 's'].add(id);
        this.logSecurityEvent('BLACKLIST_ADD', 'SYSTEM', null, `Added ${type}: ${id} - ${reason}`);
        
        if (this.logger) {
            this.logger.logSecurity('Blacklist Added',
                `${type} ${id} added to blacklist`,
                { Type: type, ID: id, Reason: reason || 'No reason provided' },
                'high'
            );
        }
        
        console.log(`[SecurityManager] Added to blacklist: ${type} ${id}`);
        return true;
    }
    
    removeFromBlacklist(type, id) {
        if (!['user', 'guild', 'ip'].includes(type)) {
            return false;
        }
        
        const removed = this.blacklist[type + 's'].delete(id);
        if (removed) {
            this.logSecurityEvent('BLACKLIST_REMOVE', 'SYSTEM', null, `Removed ${type}: ${id}`);
            
            if (this.logger) {
                this.logger.logSecurity('Blacklist Removed',
                    `${type} ${id} removed from blacklist`,
                    { Type: type, ID: id },
                    'medium'
                );
            }
            
            console.log(`[SecurityManager] Removed from blacklist: ${type} ${id}`);
        }
        return removed;
    }
    
    isBlacklisted(type, id) {
        if (!['user', 'guild', 'ip'].includes(type)) {
            return false;
        }
        return this.blacklist[type + 's'].has(id);
    }
    
    // Whitelist management
    addToWhitelist(type, id) {
        if (!['user', 'role'].includes(type)) {
            return false;
        }
        
        this.whitelist[type + 's'].add(id);
        console.log(`[SecurityManager] Added to whitelist: ${type} ${id}`);
        return true;
    }
    
    removeFromWhitelist(type, id) {
        if (!['user', 'role'].includes(type)) {
            return false;
        }
        
        const removed = this.whitelist[type + 's'].delete(id);
        if (removed) {
            console.log(`[SecurityManager] Removed from whitelist: ${type} ${id}`);
        }
        return removed;
    }
    
    // Admin management
    addAdmin(userId) {
        this.adminIds.add(userId);
        console.log(`[SecurityManager] Added admin: ${userId}`);
        return true;
    }
    
    removeAdmin(userId) {
        const removed = this.adminIds.delete(userId);
        if (removed) {
            console.log(`[SecurityManager] Removed admin: ${userId}`);
        }
        return removed;
    }
    
    isAdmin(userId) {
        return this.adminIds.has(userId);
    }
    
    // Reset user in all systems
    resetUser(userId) {
        this.rateLimiter.resetUser(userId);
        this.antiSpam.resetUser(userId);
        console.log(`[SecurityManager] Reset all data for user: ${userId}`);
        return true;
    }
    
    // Get comprehensive stats
    getStats() {
        const uptime = Date.now() - this.stats.startTime;
        
        return {
            ...this.stats,
            uptime: uptime,
            uptimeFormatted: this.formatUptime(uptime),
            successRate: this.stats.totalRequests > 0 
                ? ((this.stats.totalRequests - this.stats.blockedRequests) / this.stats.totalRequests * 100).toFixed(2) + '%'
                : '100%',
            blacklist: {
                users: this.blacklist.users.size,
                guilds: this.blacklist.guilds.size,
                ips: this.blacklist.ips.size
            },
            whitelist: {
                users: this.whitelist.users.size,
                roles: this.whitelist.roles.size
            },
            admins: this.adminIds.size
        };
    }
    
    // Get user stats across all systems
    getUserStats(userId) {
        return {
            rateLimiter: this.rateLimiter.getUserStats(userId),
            antiSpam: this.antiSpam.getUserStats(userId),
            blacklisted: this.blacklist.users.has(userId),
            whitelisted: this.whitelist.users.has(userId),
            isAdmin: this.adminIds.has(userId)
        };
    }
    
    // Get guild stats
    getGuildStats(guildId) {
        return {
            antiRaid: this.antiRaid.getGuildStats(guildId),
            blacklisted: this.blacklist.guilds.has(guildId),
            lockdown: this.antiRaid.isInLockdown(guildId)
        };
    }
    
    // Security event logging
    logSecurityEvent(type, userId, commandName, details) {
        const event = {
            type: type,
            userId: userId,
            commandName: commandName,
            details: details,
            timestamp: Date.now()
        };
        
        this.securityLog.push(event);
        
        // Trim log if too large
        if (this.securityLog.length > this.maxLogSize) {
            this.securityLog = this.securityLog.slice(-this.maxLogSize);
        }
    }
    
    // Get recent security events
    getRecentEvents(limit = 50, type = null) {
        let events = this.securityLog.slice(-limit);
        
        if (type) {
            events = events.filter(e => e.type === type);
        }
        
        return events.reverse();
    }
    
    // Lockdown control
    enableLockdown(guildId, duration = null) {
        return this.antiRaid.enableLockdown(guildId, duration);
    }
    
    disableLockdown(guildId) {
        return this.antiRaid.disableLockdown(guildId);
    }
    
    // Helper: Format uptime
    formatUptime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) return `${days}d ${hours % 24}h`;
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    }
}

module.exports = SecurityManager;
