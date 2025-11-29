// Advanced Rate Limiter with multiple strategies
const configManager = require('../../configManager');

class RateLimiter {
    constructor() {
        // Logger instance (set externally)
        this.logger = null;
        
        // User-based rate limiting
        this.userLimits = new Map();
        // IP-based rate limiting (if available)
        this.ipLimits = new Map();
        // Command-specific limits
        this.commandLimits = new Map();
        // Global limits
        this.globalRequests = [];
        
        const rateLimitConfig = configManager.get('constants.rateLimit');
        const durationConfig = configManager.get('constants.duration');
        
        // Configuration
        this.config = {
            // User limits
            userRequestsPerMinute: rateLimitConfig.USER_REQUESTS_PER_MINUTE,
            userRequestsPerHour: rateLimitConfig.USER_REQUESTS_PER_HOUR,
            userBurstLimit: rateLimitConfig.USER_BURST_LIMIT,
            
            // Command-specific cooldowns (in ms)
            commandCooldowns: {
                'mcinfo': 5000,
                'giveaway': 30000,
                'add_account': 3000,
                'deliver_account': 2000,
            },
            
            // Global limits
            globalRequestsPerMinute: rateLimitConfig.GLOBAL_REQUESTS_PER_MINUTE,
            globalRequestsPerHour: rateLimitConfig.GLOBAL_REQUESTS_PER_HOUR,
            
            // Punishment thresholds
            warningThreshold: rateLimitConfig.WARNING_THRESHOLD,
            tempBanThreshold: rateLimitConfig.TEMP_BAN_THRESHOLD,
            permaBanThreshold: rateLimitConfig.PERM_BAN_THRESHOLD,
            
            // Cleanup interval (ms)
            cleanupInterval: durationConfig.MS_PER_MINUTE,
        };
        
        // Start cleanup
        this.startCleanup();
    }
    
    /**
     * Set logger instance
     */
    setLogger(logger) {
        this.logger = logger;
    }
    
    /**
     * Check if user can execute command
     * @param {string} userId 
     * @param {string} commandName 
     * @returns {Object} { allowed: boolean, reason: string, retryAfter: number }
     */
    checkLimit(userId, commandName = null) {
        const now = Date.now();
        
        // 1. Check global rate limit
        const globalCheck = this.checkGlobalLimit(now);
        if (!globalCheck.allowed) {
            return globalCheck;
        }
        
        // 2. Check user rate limit
        const userCheck = this.checkUserLimit(userId, now);
        if (!userCheck.allowed) {
            return userCheck;
        }
        
        // 3. Check command-specific cooldown
        if (commandName) {
            const commandCheck = this.checkCommandCooldown(userId, commandName, now);
            if (!commandCheck.allowed) {
                return commandCheck;
            }
        }
        
        // 4. Check burst limit
        const burstCheck = this.checkBurstLimit(userId, now);
        if (!burstCheck.allowed) {
            return burstCheck;
        }
        
        // All checks passed - record the request
        this.recordRequest(userId, commandName, now);
        
        return { allowed: true };
    }
    
    checkGlobalLimit(now) {
        // Clean old requests
        this.globalRequests = this.globalRequests.filter(time => now - time < 3600000);
        
        const recentRequests = this.globalRequests.filter(time => now - time < 60000);
        
        if (recentRequests.length >= this.config.globalRequestsPerMinute) {
            return {
                allowed: false,
                reason: 'GLOBAL_RATE_LIMIT',
                message: '⚠️ سرور شلوغه. یکم صبر کن.',
                retryAfter: 60
            };
        }
        
        if (this.globalRequests.length >= this.config.globalRequestsPerHour) {
            return {
                allowed: false,
                reason: 'GLOBAL_HOURLY_LIMIT',
                message: '⚠️ محدودیت ساعتی سرور فعاله. بعدا امتحان کن.',
                retryAfter: 3600
            };
        }
        
        return { allowed: true };
    }
    
    checkUserLimit(userId, now) {
        if (!this.userLimits.has(userId)) {
            this.userLimits.set(userId, {
                requests: [],
                violations: 0,
                lastViolation: 0,
                banned: false,
                banExpires: 0
            });
        }
        
        const userData = this.userLimits.get(userId);
        
        // Check if user is banned
        if (userData.banned) {
            if (now < userData.banExpires) {
                const remainingTime = Math.ceil((userData.banExpires - now) / 1000);
                return {
                    allowed: false,
                    reason: 'USER_BANNED',
                    message: `🚫 شما به دلیل استفاده بیش از حد از دستورات موقتاً مسدود شده‌اید.\n⏱️ زمان باقی‌مانده: ${remainingTime} ثانیه`,
                    retryAfter: remainingTime
                };
            } else {
                // Ban expired
                userData.banned = false;
                userData.violations = 0;
            }
        }
        
        // Clean old requests
        userData.requests = userData.requests.filter(time => now - time < 3600000);
        
        const recentRequests = userData.requests.filter(time => now - time < 60000);
        
        if (recentRequests.length >= this.config.userRequestsPerMinute) {
            this.recordViolation(userId, 'MINUTE_LIMIT');
            return {
                allowed: false,
                reason: 'USER_RATE_LIMIT',
                message: '⏱️ خیلی زیاد دستور فرستادی. ۱ دقیقه صبر کن.',
                retryAfter: 60
            };
        }
        
        if (userData.requests.length >= this.config.userRequestsPerHour) {
            this.recordViolation(userId, 'HOURLY_LIMIT');
            return {
                allowed: false,
                reason: 'USER_HOURLY_LIMIT',
                message: '⚠️ محدودیت ساعتی فعاله. ۱ ساعت صبر کن.',
                retryAfter: 3600
            };
        }
        
        return { allowed: true };
    }
    
    checkCommandCooldown(userId, commandName, now) {
        const cooldown = this.config.commandCooldowns[commandName];
        if (!cooldown) return { allowed: true };
        
        const key = `${userId}:${commandName}`;
        
        if (this.commandLimits.has(key)) {
            const lastUse = this.commandLimits.get(key);
            const timePassed = now - lastUse;
            
            if (timePassed < cooldown) {
                const remaining = Math.ceil((cooldown - timePassed) / 1000);
                return {
                    allowed: false,
                    reason: 'COMMAND_COOLDOWN',
                    message: `⏳ این دستور کولداونه. ${remaining} ثانیه صبر کن.`,
                    retryAfter: remaining
                };
            }
        }
        
        return { allowed: true };
    }
    
    checkBurstLimit(userId, now) {
        const userData = this.userLimits.get(userId);
        const burstWindow = 2000; // 2 seconds
        
        const burstRequests = userData.requests.filter(time => now - time < burstWindow);
        
        if (burstRequests.length >= this.config.userBurstLimit) {
            this.recordViolation(userId, 'BURST_LIMIT');
            return {
                allowed: false,
                reason: 'BURST_LIMIT',
                message: '🚨 خیلی سریع دستور می‌فرستی! آرومتر باش.',
                retryAfter: 5
            };
        }
        
        return { allowed: true };
    }
    
    recordRequest(userId, commandName, now) {
        // Record global request
        this.globalRequests.push(now);
        
        // Record user request
        const userData = this.userLimits.get(userId);
        userData.requests.push(now);
        
        // Record command usage
        if (commandName) {
            const key = `${userId}:${commandName}`;
            this.commandLimits.set(key, now);
        }
    }
    
    recordViolation(userId, type) {
        const userData = this.userLimits.get(userId);
        userData.violations++;
        userData.lastViolation = Date.now();
        
        console.warn(`[RateLimiter] User ${userId} violated ${type}. Total violations: ${userData.violations}`);
        
        // Apply punishment based on violations
        if (userData.violations >= this.config.permaBanThreshold) {
            // Permanent ban (24 hours)
            userData.banned = true;
            userData.banExpires = Date.now() + 86400000;
            console.error(`[RateLimiter] User ${userId} PERMANENTLY BANNED (24h) - ${userData.violations} violations`);
        } else if (userData.violations >= this.config.tempBanThreshold) {
            // Temporary ban (10 minutes)
            userData.banned = true;
            userData.banExpires = Date.now() + 600000;
            console.warn(`[RateLimiter] User ${userId} TEMP BANNED (10min) - ${userData.violations} violations`);
        } else if (userData.violations >= this.config.warningThreshold) {
            console.warn(`[RateLimiter] User ${userId} WARNING LEVEL - ${userData.violations} violations`);
        }
    }
    
    // Reset user limits (for admin use)
    resetUser(userId) {
        if (this.userLimits.has(userId)) {
            this.userLimits.delete(userId);
            
            // Clean command limits for this user
            for (const [key, _] of this.commandLimits) {
                if (key.startsWith(`${userId}:`)) {
                    this.commandLimits.delete(key);
                }
            }
            
            return true;
        }
        return false;
    }
    
    // Get user stats
    getUserStats(userId) {
        if (!this.userLimits.has(userId)) {
            return null;
        }
        
        const userData = this.userLimits.get(userId);
        const now = Date.now();
        
        return {
            totalRequests: userData.requests.length,
            recentRequests: userData.requests.filter(time => now - time < 60000).length,
            violations: userData.violations,
            banned: userData.banned,
            banExpiresIn: userData.banned ? Math.ceil((userData.banExpires - now) / 1000) : 0
        };
    }
    
    startCleanup() {
        this.cleanupInterval = setInterval(() => {
            const now = Date.now();
            
            this.globalRequests = this.globalRequests.filter(time => now - time < 3600000);
            
            for (const [userId, userData] of this.userLimits) {
                userData.requests = userData.requests.filter(time => now - time < 3600000);
                
                if (userData.violations > 0 && now - userData.lastViolation > 3600000) {
                    userData.violations = Math.max(0, userData.violations - 1);
                }
                
                if (userData.requests.length === 0 && userData.violations === 0 && !userData.banned) {
                    this.userLimits.delete(userId);
                }
            }
            
            for (const [key, time] of this.commandLimits) {
                const commandName = key.split(':')[1];
                const cooldown = this.config.commandCooldowns[commandName] || 5000;
                
                if (now - time > cooldown * 2) {
                    this.commandLimits.delete(key);
                }
            }
            
            console.log(`[RateLimiter] Cleanup: ${this.userLimits.size} users, ${this.commandLimits.size} command entries`);
        }, this.config.cleanupInterval);
    }
    
    stopCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
    }
}

module.exports = RateLimiter;
