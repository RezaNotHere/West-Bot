/**
 * CacheManager - سیستم مدیریت cache با TTL اتوماتیک
 * 
 * ویژگی‌ها:
 * - TTL (Time To Live) اتوماتیک
 * - پاکسازی خودکار
 * - آمارگیری (hit rate)
 * - کاهش فوری زمان پاسخ‌دهی
 */

const configManager = require('../../configManager');

class CacheManager {
    constructor() {
        this.cache = new Map();
        this.ttls = new Map();
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0
        };
        
        const cacheConfig = configManager.get('constants.cache');
        
        // پاکسازی خودکار
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, cacheConfig.CLEANUP_INTERVAL);
        
        console.log('✅ CacheManager initialized');
    }
    
    /**
     * دریافت مقدار از cache
     * @param {string} key - کلید
     * @returns {*} مقدار یا null
     */
    get(key) {
        // چک کردن expiration
        if (this.ttls.has(key)) {
            const expirationTime = this.ttls.get(key);
            if (Date.now() > expirationTime) {
                this.delete(key);
                this.stats.misses++;
                return null;
            }
        }
        
        if (this.cache.has(key)) {
            this.stats.hits++;
            return this.cache.get(key);
        }
        
        this.stats.misses++;
        return null;
    }
    
    /**
     * ذخیره مقدار در cache
     * @param {string} key - کلید
     * @param {*} value - مقدار
     * @param {number} ttl - زمان انقضا به میلی‌ثانیه (پیش‌فرض: 5 دقیقه)
     * @returns {boolean} موفقیت
     */
    set(key, value, ttl = 300000) {
        this.cache.set(key, value);
        
        if (ttl > 0) {
            this.ttls.set(key, Date.now() + ttl);
        }
        
        this.stats.sets++;
        return true;
    }
    
    /**
     * حذف یک کلید
     * @param {string} key - کلید
     * @returns {boolean} موفقیت
     */
    delete(key) {
        const deleted = this.cache.delete(key);
        this.ttls.delete(key);
        
        if (deleted) {
            this.stats.deletes++;
        }
        
        return deleted;
    }
    
    /**
     * پاک کردن تمام cache
     */
    flush() {
        const size = this.cache.size;
        this.cache.clear();
        this.ttls.clear();
        console.log(`🧹 Cache flushed: ${size} items removed`);
    }
    
    /**
     * چک کردن وجود کلید
     * @param {string} key - کلید
     * @returns {boolean}
     */
    has(key) {
        // چک expiration
        if (this.ttls.has(key)) {
            const expirationTime = this.ttls.get(key);
            if (Date.now() > expirationTime) {
                this.delete(key);
                return false;
            }
        }
        
        return this.cache.has(key);
    }
    
    /**
     * دریافت تمام کلیدها
     * @returns {Array<string>}
     */
    keys() {
        // فقط کلیدهای معتبر
        const validKeys = [];
        for (const key of this.cache.keys()) {
            if (this.has(key)) {
                validKeys.push(key);
            }
        }
        return validKeys;
    }
    
    /**
     * تعداد آیتم‌ها
     * @returns {number}
     */
    size() {
        return this.cache.size;
    }
    
    /**
     * پاکسازی آیتم‌های منقضی شده
     */
    cleanup() {
        const now = Date.now();
        let cleaned = 0;
        
        for (const [key, expirationTime] of this.ttls.entries()) {
            if (now > expirationTime) {
                this.delete(key);
                cleaned++;
            }
        }
        
        if (cleaned > 0) {
            console.log(`🧹 Cache cleanup: ${cleaned} expired items removed`);
        }
    }
    
    /**
     * دریافت آمار cache
     * @returns {Object} آمار
     */
    getStats() {
        const total = this.stats.hits + this.stats.misses;
        const hitRate = total > 0 ? (this.stats.hits / total * 100).toFixed(2) : 0;
        
        return {
            hits: this.stats.hits,
            misses: this.stats.misses,
            sets: this.stats.sets,
            deletes: this.stats.deletes,
            hitRate: `${hitRate}%`,
            size: this.cache.size,
            memory: this.estimateMemory()
        };
    }
    
    /**
     * تخمین حافظه استفاده شده (تقریبی)
     * @returns {string}
     */
    estimateMemory() {
        let bytes = 0;
        
        for (const [key, value] of this.cache.entries()) {
            bytes += key.length * 2; // UTF-16
            bytes += JSON.stringify(value).length * 2;
        }
        
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }
    
    /**
     * ریست کردن آمار
     */
    resetStats() {
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0
        };
    }
    
    /**
     * بستن و cleanup منابع
     */
    destroy() {
        clearInterval(this.cleanupInterval);
        this.flush();
        console.log('❌ CacheManager destroyed');
    }
}

// Export به صورت singleton
module.exports = new CacheManager();
