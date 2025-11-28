/**
 * خطای پایه برای برنامه
 */
class BotError extends Error {
    constructor(message, code = 'BOT_ERROR') {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
    }
}

/**
 * خطای مربوط به دیتابیس
 */
class DatabaseError extends BotError {
    constructor(message, operation) {
        super(message, 'DATABASE_ERROR');
        this.operation = operation;
    }
}

/**
 * خطای مربوط به دسترسی‌ها
 */
class PermissionError extends BotError {
    constructor(message, requiredPermission) {
        super(message, 'PERMISSION_ERROR');
        this.requiredPermission = requiredPermission;
    }
}

/**
 * خطای مربوط به API های خارجی
 */
class ApiError extends BotError {
    constructor(message, service, statusCode) {
        super(message, 'API_ERROR');
        this.service = service;
        this.statusCode = statusCode;
    }
}

/**
 * خطای مربوط به داده‌های نامعتبر
 */
class ValidationError extends BotError {
    constructor(message, field) {
        super(message, 'VALIDATION_ERROR');
        this.field = field;
    }
}

/**
 * خطای مربوط به عدم یافتن منابع
 */
class NotFoundError extends BotError {
    constructor(message, resource) {
        super(message, 'NOT_FOUND');
        this.resource = resource;
    }
}

/**
 * خطای مربوط به زمان‌بندی عملیات
 */
class TimingError extends BotError {
    constructor(message, operation) {
        super(message, 'TIMING_ERROR');
        this.operation = operation;
    }
}

/**
 * خطای مربوط به تعامل با کاربر
 */
class InteractionError extends BotError {
    constructor(message, interactionType) {
        super(message, 'INTERACTION_ERROR');
        this.interactionType = interactionType;
    }
}

module.exports = {
    BotError,
    DatabaseError,
    PermissionError,
    ApiError,
    ValidationError,
    NotFoundError,
    TimingError,
    InteractionError
};