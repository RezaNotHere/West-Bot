// Advanced Anti-Raid Protection
const configManager = require('../../configManager');

class AntiRaid {
    constructor() {
        // Logger instance (set externally)
        this.logger = null;
        
        this.joinTracking = new Map();
        this.raidSuspects = new Set();
        this.serverLockdown = new Map();
        
        const antiRaidConfig = configManager.get('constants.antiRaid');
        this.config = {
            // Join rate detection
            maxJoinsPerMinute: antiRaidConfig.MAX_JOINS_PER_MINUTE,
            maxJoinsPerHour: antiRaidConfig.MAX_JOINS_PER_HOUR,
            suspiciousJoinWindow: antiRaidConfig.SUSPICIOUS_JOIN_WINDOW,
            suspiciousJoinCount: antiRaidConfig.SUSPICIOUS_JOIN_COUNT,
            
            // New account detection
            newAccountThreshold: antiRaidConfig.NEW_ACCOUNT_THRESHOLD,
            newAccountMaxJoins: antiRaidConfig.NEW_ACCOUNT_MAX_JOINS,
            
            // Username similarity detection
            similarityThreshold: antiRaidConfig.SIMILARITY_THRESHOLD,
            checkSimilarityWindow: antiRaidConfig.SIMILARITY_CHECK_WINDOW,
            
            // Actions
            autoKickSuspicious: true,
            autoBanOnConfirmedRaid: false,
            lockdownDuration: antiRaidConfig.LOCKDOWN_DURATION,
            notifyAdmins: true,
            
            // Verification
            requireVerificationOnRaid: true,
            verificationRole: null, // Set via setVerificationRole()
        };
    }
    
    /**
     * Set logger instance
     */
    setLogger(logger) {
        this.logger = logger;
    }
    
    /**
     * Check member join for raid patterns
     * @param {GuildMember} member 
     * @returns {Object} { isRaid: boolean, reason: string, action: string }
     */
    async checkMemberJoin(member) {
        const guildId = member.guild.id;
        const userId = member.user.id;
        const now = Date.now();
        
        // Initialize guild tracking
        if (!this.joinTracking.has(guildId)) {
            this.joinTracking.set(guildId, []);
        }
        
        const guildJoins = this.joinTracking.get(guildId);
        
        // Add current join
        guildJoins.push({
            userId: userId,
            username: member.user.username,
            tag: member.user.tag,
            accountCreated: member.user.createdTimestamp,
            joinedAt: now,
            avatar: member.user.avatar
        });
        
        // Check if server is in lockdown
        if (this.serverLockdown.has(guildId)) {
            const lockdown = this.serverLockdown.get(guildId);
            if (now < lockdown.until) {
                console.warn(`[AntiRaid] Server ${guildId} in LOCKDOWN - Auto-kicking ${member.user.tag}`);
                
                try {
                    await member.send('⚠️ سرور فعلا Lockdown هست بخاطر Raid. بعدا امتحان کن.').catch(() => {});
                    await member.kick('Server Lockdown - Auto Protection');
                } catch (err) {
                    console.error('[AntiRaid] Failed to kick during lockdown:', err.message);
                }
                
                return {
                    isRaid: true,
                    reason: 'SERVER_LOCKDOWN',
                    action: 'KICKED'
                };
            } else {
                // Lockdown expired
                this.serverLockdown.delete(guildId);
                console.log(`[AntiRaid] Lockdown expired for server ${guildId}`);
            }
        }
        
        // 1. Check join rate
        const joinRateCheck = this.checkJoinRate(guildId, now);
        if (joinRateCheck.isRaid) {
            return await this.handleRaid(member, joinRateCheck);
        }
        
        // 2. Check new account
        const newAccountCheck = this.checkNewAccount(member, guildId, now);
        if (newAccountCheck.suspicious) {
            console.warn(`[AntiRaid] Suspicious new account: ${member.user.tag} (${newAccountCheck.reason})`);
            this.raidSuspects.add(userId);
        }
        
        // 3. Check username similarity
        const similarityCheck = this.checkUsernameSimilarity(member, guildId, now);
        if (similarityCheck.suspicious) {
            console.warn(`[AntiRaid] Suspicious username pattern: ${member.user.tag} (${similarityCheck.reason})`);
            this.raidSuspects.add(userId);
        }
        
        // 4. Check no avatar
        const avatarCheck = this.checkAvatar(member);
        if (avatarCheck.suspicious) {
            this.raidSuspects.add(userId);
        }
        
        // If multiple red flags, take action
        const suspicionLevel = [
            newAccountCheck.suspicious,
            similarityCheck.suspicious,
            avatarCheck.suspicious
        ].filter(Boolean).length;
        
        if (suspicionLevel >= 2) {
            console.warn(`[AntiRaid] High suspicion level (${suspicionLevel}/3) for ${member.user.tag}`);
            
            if (this.config.autoKickSuspicious) {
                try {
                    await member.send('⚠️ بخاطر فعالیت مشکوک از سرور حذف شدی. اگه اشتباهه با ادمین حرف بزن.').catch(() => {});
                    await member.kick('Anti-Raid: Suspicious Activity');
                    
                    return {
                        isRaid: true,
                        reason: 'SUSPICIOUS_ACCOUNT',
                        action: 'KICKED',
                        suspicionLevel: suspicionLevel
                    };
                } catch (err) {
                    console.error('[AntiRaid] Failed to kick suspicious user:', err.message);
                }
            }
        }
        
        return { isRaid: false };
    }
    
    checkJoinRate(guildId, now) {
        const guildJoins = this.joinTracking.get(guildId);
        
        // Check recent joins
        const recentJoins = guildJoins.filter(join => now - join.joinedAt < 60000);
        const veryRecentJoins = guildJoins.filter(join => now - join.joinedAt < this.config.suspiciousJoinWindow);
        
        if (veryRecentJoins.length >= this.config.suspiciousJoinCount) {
            return {
                isRaid: true,
                reason: 'MASS_JOIN',
                severity: 'CRITICAL',
                details: `${veryRecentJoins.length} عضو در ${this.config.suspiciousJoinWindow / 1000} ثانیه`
            };
        }
        
        if (recentJoins.length >= this.config.maxJoinsPerMinute) {
            return {
                isRaid: true,
                reason: 'HIGH_JOIN_RATE',
                severity: 'HIGH',
                details: `${recentJoins.length} عضو در 1 دقیقه`
            };
        }
        
        const hourlyJoins = guildJoins.filter(join => now - join.joinedAt < 3600000);
        if (hourlyJoins.length >= this.config.maxJoinsPerHour) {
            return {
                isRaid: true,
                reason: 'SUSTAINED_JOIN_RATE',
                severity: 'MEDIUM',
                details: `${hourlyJoins.length} عضو در 1 ساعت`
            };
        }
        
        return { isRaid: false };
    }
    
    checkNewAccount(member, guildId, now) {
        const accountAge = now - member.user.createdTimestamp;
        
        if (accountAge < this.config.newAccountThreshold) {
            const guildJoins = this.joinTracking.get(guildId);
            const recentNewAccounts = guildJoins.filter(join => 
                now - join.joinedAt < 60000 && 
                now - join.accountCreated < this.config.newAccountThreshold
            );
            
            if (recentNewAccounts.length >= this.config.newAccountMaxJoins) {
                return {
                    suspicious: true,
                    reason: `حساب جدید (${Math.ceil(accountAge / 86400000)} روز) - ${recentNewAccounts.length} حساب جدید اخیر`
                };
            }
            
            return {
                suspicious: true,
                reason: `حساب جدید (${Math.ceil(accountAge / 86400000)} روز)`
            };
        }
        
        return { suspicious: false };
    }
    
    checkUsernameSimilarity(member, guildId, now) {
        const guildJoins = this.joinTracking.get(guildId);
        const recentJoins = guildJoins.filter(join => now - join.joinedAt < this.config.checkSimilarityWindow);
        
        if (recentJoins.length < 2) return { suspicious: false };
        
        const username = member.user.username.toLowerCase();
        
        // Check for similar usernames
        let similarCount = 0;
        for (const join of recentJoins) {
            if (join.userId === member.user.id) continue;
            
            const similarity = this.calculateSimilarity(username, join.username.toLowerCase());
            if (similarity >= this.config.similarityThreshold) {
                similarCount++;
            }
        }
        
        if (similarCount >= 2) {
            return {
                suspicious: true,
                reason: `${similarCount} نام کاربری مشابه در ${this.config.checkSimilarityWindow / 1000} ثانیه اخیر`
            };
        }
        
        // Check for pattern-based usernames (e.g., user1, user2, user3)
        const hasPattern = /^[a-z]+\d+$/i.test(username) || /^[a-z]{5,10}$/i.test(username);
        if (hasPattern) {
            const patternMatches = recentJoins.filter(join => {
                const jname = join.username.toLowerCase();
                return /^[a-z]+\d+$/i.test(jname) || /^[a-z]{5,10}$/i.test(jname);
            });
            
            if (patternMatches.length >= 3) {
                return {
                    suspicious: true,
                    reason: `الگوی نام کاربری مشکوک (${patternMatches.length} مورد)`
                };
            }
        }
        
        return { suspicious: false };
    }
    
    checkAvatar(member) {
        if (!member.user.avatar) {
            return {
                suspicious: true,
                reason: 'بدون آواتار'
            };
        }
        
        return { suspicious: false };
    }
    
    calculateSimilarity(str1, str2) {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) return 1.0;
        
        const editDistance = this.levenshteinDistance(longer, shorter);
        return (longer.length - editDistance) / longer.length;
    }
    
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
    
    async handleRaid(member, raidCheck) {
        const guildId = member.guild.id;
        
        console.error(`[AntiRaid] RAID DETECTED in ${member.guild.name}: ${raidCheck.reason} - ${raidCheck.details}`);
        
        // Enable lockdown
        if (!this.serverLockdown.has(guildId)) {
            this.serverLockdown.set(guildId, {
                startedAt: Date.now(),
                until: Date.now() + this.config.lockdownDuration,
                reason: raidCheck.reason
            });
            
            console.error(`[AntiRaid] LOCKDOWN ENABLED for ${this.config.lockdownDuration / 60000} minutes`);
        }
        
        // Kick the current user
        try {
            await member.send('⚠️ سرور تحت Raid هست و حذف شدی. بعدا امتحان کن.').catch(() => {});
            await member.kick(`Anti-Raid: ${raidCheck.reason}`);
        } catch (err) {
            console.error('[AntiRaid] Failed to kick raider:', err.message);
        }
        
        // Notify admins
        if (this.config.notifyAdmins) {
            await this.notifyAdmins(member.guild, raidCheck);
        }
        
        return {
            isRaid: true,
            reason: raidCheck.reason,
            severity: raidCheck.severity,
            action: 'KICKED',
            lockdown: true
        };
    }
    
    async notifyAdmins(guild, raidCheck) {
        try {
            // Find a channel to send notification
            const channels = guild.channels.cache.filter(ch => 
                ch.type === 0 && // Text channel
                ch.permissionsFor(guild.members.me).has('SendMessages')
            );
            
            const notifyChannel = channels.first();
            if (!notifyChannel) return;
            
            const { EmbedBuilder } = require('discord.js');
            
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('🚨 هشدار: حمله Raid شناسایی شد!')
                .setDescription(`سیستم Anti-Raid به طور خودکار فعال شده است.`)
                .addFields(
                    { name: '⚠️ دلیل', value: raidCheck.reason, inline: true },
                    { name: '📊 جزئیات', value: raidCheck.details, inline: true },
                    { name: '🔒 وضعیت', value: 'Lockdown فعال شد', inline: true }
                )
                .setTimestamp()
                .setFooter({ text: 'Anti-Raid System' });
            
            await notifyChannel.send({ 
                content: '@here',
                embeds: [embed] 
            });
        } catch (err) {
            console.error('[AntiRaid] Failed to notify admins:', err.message);
        }
    }
    
    // Manual lockdown control
    enableLockdown(guildId, duration = null) {
        const lockdownDuration = duration || this.config.lockdownDuration;
        this.serverLockdown.set(guildId, {
            startedAt: Date.now(),
            until: Date.now() + lockdownDuration,
            reason: 'MANUAL'
        });
        
        console.log(`[AntiRaid] Manual lockdown enabled for ${guildId}`);
        return true;
    }
    
    disableLockdown(guildId) {
        if (this.serverLockdown.has(guildId)) {
            this.serverLockdown.delete(guildId);
            console.log(`[AntiRaid] Lockdown disabled for ${guildId}`);
            return true;
        }
        return false;
    }
    
    isInLockdown(guildId) {
        if (!this.serverLockdown.has(guildId)) return false;
        
        const lockdown = this.serverLockdown.get(guildId);
        if (Date.now() >= lockdown.until) {
            this.serverLockdown.delete(guildId);
            return false;
        }
        
        return true;
    }
    
    // Get stats
    getGuildStats(guildId) {
        const joins = this.joinTracking.get(guildId) || [];
        const now = Date.now();
        
        return {
            totalJoins: joins.length,
            recentJoins: joins.filter(j => now - j.joinedAt < 60000).length,
            hourlyJoins: joins.filter(j => now - j.joinedAt < 3600000).length,
            newAccounts: joins.filter(j => now - j.accountCreated < this.config.newAccountThreshold).length,
            lockdown: this.isInLockdown(guildId)
        };
    }
    
    // Cleanup
    cleanup() {
        const now = Date.now();
        
        for (const [guildId, joins] of this.joinTracking) {
            const filtered = joins.filter(join => now - join.joinedAt < 3600000);
            
            if (filtered.length === 0) {
                this.joinTracking.delete(guildId);
            } else {
                this.joinTracking.set(guildId, filtered);
            }
        }
        
        // Clean raid suspects
        this.raidSuspects.clear();
        
        console.log(`[AntiRaid] Cleanup: ${this.joinTracking.size} guilds tracked`);
    }
}

module.exports = AntiRaid;
