/**
 * Advanced Input Validation System
 * Protects against XSS, SQL Injection, Command Injection, and more
 */

class InputValidator {
    constructor() {
        // Dangerous patterns
        this.dangerousPatterns = {
            xss: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
            jsInjection: /javascript:/gi,
            dataUri: /data:/gi,
            sqlInjection: /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)|(--|\/\*|\*\/|;|'|")/gi,
            commandInjection: /[;&|`$(){}[\]]/gi,
            pathTraversal: /\.\.[\/\\]/gi,
            htmlTags: /<[^>]*>/gi,
            unicodeExploits: /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202f\ufeff\ufff0-\uffff]/g
        };

        // Allowed character sets
        this.allowedPatterns = {
            minecraftUsername: /^[a-zA-Z0-9_]{1,16}$/,
            discordId: /^\d{17,19}$/,
            safeText: /^[^\u0000-\u001f\u007f-\u009f<>]+$/,
            numbers: /^\d+$/,
            safeString: /^[a-zA-Z0-9\s\-_.]+$/,
            duration: /^\d+[smhd]$/,
            hexColor: /^#[0-9A-Fa-f]{6}$/
        };

        // Length limits
        this.limits = {
            username: { min: 1, max: 16 },
            prize: { min: 1, max: 100 },
            reason: { min: 1, max: 500 },
            message: { min: 1, max: 2000 },
            title: { min: 1, max: 256 },
            description: { min: 1, max: 1000 }
        };
        
        this.logger = null;
    }
    
    setLogger(logger) {
        this.logger = logger;
        return this;
    }

    /**
     * Validate and sanitize input
     */
    validate(input, type, options = {}) {
        const result = {
            valid: true,
            sanitized: input,
            errors: [],
            warnings: []
        };

        // Convert to string
        if (typeof input !== 'string') {
            input = String(input);
        }

        // Trim whitespace
        input = input.trim();
        result.sanitized = input;

        // Check for dangerous patterns
        this.checkDangerousPatterns(input, result);

        // Apply type-specific validation
        this.validateByType(input, type, result, options);

        // Apply length limits
        this.validateLength(input, type, result);

        // Sanitize based on type
        result.sanitized = this.sanitize(input, type);

        return result;
    }

    /**
     * Check for dangerous patterns
     */
    checkDangerousPatterns(input, result) {
        Object.entries(this.dangerousPatterns).forEach(([type, pattern]) => {
            if (pattern.test(input)) {
                result.valid = false;
                result.errors.push(`Dangerous ${type} pattern detected`);
                result.warnings.push(`Removed potentially harmful content`);
            }
        });
    }

    /**
     * Type-specific validation
     */
    validateByType(input, type, result, options) {
        switch (type) {
            case 'minecraftUsername':
                if (!this.allowedPatterns.minecraftUsername.test(input)) {
                    result.valid = false;
                    result.errors.push('Invalid Minecraft username format (1-16 chars, letters, numbers, underscore only)');
                }
                break;

            case 'discordId':
                if (!this.allowedPatterns.discordId.test(input)) {
                    result.valid = false;
                    result.errors.push('Invalid Discord ID format');
                }
                break;

            case 'duration':
                if (!this.allowedPatterns.duration.test(input)) {
                    result.valid = false;
                    result.errors.push('Invalid duration format. Use: 1h, 30m, 2d, etc.');
                }
                break;

            case 'safeText':
                if (!this.allowedPatterns.safeText.test(input)) {
                    result.valid = false;
                    result.errors.push('Text contains invalid characters');
                }
                break;

            case 'numbers':
                if (!this.allowedPatterns.numbers.test(input)) {
                    result.valid = false;
                    result.errors.push('Only numbers are allowed');
                }
                break;

            case 'hexColor':
                if (!this.allowedPatterns.hexColor.test(input)) {
                    result.valid = false;
                    result.errors.push('Invalid hex color format (#RRGGBB)');
                }
                break;
        }
    }

    /**
     * Validate length limits
     */
    validateLength(input, type, result) {
        const limits = this.limits[type];
        if (!limits) return;

        if (limits.min && input.length < limits.min) {
            result.valid = false;
            result.errors.push(`Minimum length is ${limits.min} characters`);
        }

        if (limits.max && input.length > limits.max) {
            result.errors.push(`Maximum length is ${limits.max} characters (truncated)`);
            result.sanitized = input.substring(0, limits.max);
        }
    }

    /**
     * Sanitize input
     */
    sanitize(input, type) {
        let sanitized = input;

        // Remove dangerous patterns
        Object.values(this.dangerousPatterns).forEach(pattern => {
            sanitized = sanitized.replace(pattern, '');
        });

        // Remove excessive whitespace
        sanitized = sanitized.replace(/\s+/g, ' ').trim();

        // Type-specific sanitization
        switch (type) {
            case 'minecraftUsername':
                // Keep only valid characters
                sanitized = sanitized.replace(/[^a-zA-Z0-9_]/g, '');
                break;

            case 'safeText':
                // Remove HTML tags and dangerous chars
                sanitized = sanitized.replace(this.dangerousPatterns.htmlTags, '');
                break;

            case 'numbers':
                // Keep only numbers
                sanitized = sanitized.replace(/[^0-9]/g, '');
                break;
        }

        return sanitized;
    }

    /**
     * Quick validation for common cases
     */
    quickValidate(input, type) {
        const result = this.validate(input, type);
        return result.valid ? result.sanitized : null;
    }

    /**
     * Validate multiple inputs
     */
    validateMultiple(inputs) {
        const results = {};
        let allValid = true;

        Object.entries(inputs).forEach(([key, config]) => {
            const result = this.validate(config.value, config.type, config.options);
            results[key] = result;
            if (!result.valid) allValid = false;
        });

        return { allValid, results };
    }
}

module.exports = InputValidator;
