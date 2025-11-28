/**
 * Welcome Image Generator
 * 
 * Features:
 * - Modern glassmorphism design
 * - Persian text support
 * - User avatar integration
 * - Dynamic member count
 * - Error resilient
 */

const { createCanvas, loadImage, registerFont } = require('canvas');
const axios = require('axios');
const path = require('path');

// Canvas dimensions - بزرگتر شده
const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;

// رنگ‌بندی‌های متنوع و جذاب
const COLOR_THEMES = [
    {
        name: 'Purple Dream',
        background: { primary: '#0F0A1C', secondary: '#1A1530', tertiary: '#150F1F' },
        accent: { primary: '#7C3AED', secondary: '#A78BFA', glow: 'rgba(124, 58, 237, 0.5)' }
    },
    {
        name: 'Ocean Blue',
        background: { primary: '#0A1628', secondary: '#0F2847', tertiary: '#1A3A5C' },
        accent: { primary: '#00D9FF', secondary: '#00B4D8', glow: 'rgba(0, 217, 255, 0.5)' }
    },
    {
        name: 'Sunset Orange',
        background: { primary: '#1C0F0A', secondary: '#2E1810', tertiary: '#3D2015' },
        accent: { primary: '#FF6B35', secondary: '#FF8C42', glow: 'rgba(255, 107, 53, 0.5)' }
    },
    {
        name: 'Emerald Green',
        background: { primary: '#0A1C14', secondary: '#0F2E20', tertiary: '#14382A' },
        accent: { primary: '#10B981', secondary: '#34D399', glow: 'rgba(16, 185, 129, 0.5)' }
    },
    {
        name: 'Rose Pink',
        background: { primary: '#1C0A14', secondary: '#2E0F20', tertiary: '#3D1429' },
        accent: { primary: '#EC4899', secondary: '#F472B6', glow: 'rgba(236, 72, 153, 0.5)' }
    },
    {
        name: 'Cyber Cyan',
        background: { primary: '#0A1C1C', secondary: '#0F2E2E', tertiary: '#143838' },
        accent: { primary: '#06B6D4', secondary: '#22D3EE', glow: 'rgba(6, 182, 212, 0.5)' }
    },
    {
        name: 'Golden Hour',
        background: { primary: '#1C1A0A', secondary: '#2E2810', tertiary: '#3D3415' },
        accent: { primary: '#F59E0B', secondary: '#FBBF24', glow: 'rgba(245, 158, 11, 0.5)' }
    },
    {
        name: 'Royal Purple',
        background: { primary: '#14091C', secondary: '#220F2E', tertiary: '#2D143D' },
        accent: { primary: '#9333EA', secondary: '#A855F7', glow: 'rgba(147, 51, 234, 0.5)' }
    },
    {
        name: 'Crimson Red',
        background: { primary: '#1C0A0A', secondary: '#2E0F0F', tertiary: '#3D1414' },
        accent: { primary: '#DC2626', secondary: '#EF4444', glow: 'rgba(220, 38, 38, 0.5)' }
    },
    {
        name: 'Lime Green',
        background: { primary: '#0F1C0A', secondary: '#182E0F', tertiary: '#203D14' },
        accent: { primary: '#84CC16', secondary: '#A3E635', glow: 'rgba(132, 204, 22, 0.5)' }
    },
    {
        name: 'Violet Night',
        background: { primary: '#120A1C', secondary: '#1F0F2E', tertiary: '#2A143D' },
        accent: { primary: '#8B5CF6', secondary: '#A78BFA', glow: 'rgba(139, 92, 246, 0.5)' }
    },
    {
        name: 'Aqua Marine',
        background: { primary: '#0A1C18', secondary: '#0F2E28', tertiary: '#143D35' },
        accent: { primary: '#14B8A6', secondary: '#2DD4BF', glow: 'rgba(20, 184, 166, 0.5)' }
    },
    {
        name: 'Magenta Fusion',
        background: { primary: '#1C0A1C', secondary: '#2E0F2E', tertiary: '#3D143D' },
        accent: { primary: '#D946EF', secondary: '#E879F9', glow: 'rgba(217, 70, 239, 0.5)' }
    },
    {
        name: 'Sky Blue',
        background: { primary: '#0A141C', secondary: '#0F1F2E', tertiary: '#142A3D' },
        accent: { primary: '#0EA5E9', secondary: '#38BDF8', glow: 'rgba(14, 165, 233, 0.5)' }
    },
    {
        name: 'Neon Pink',
        background: { primary: '#1C0A18', secondary: '#2E0F28', tertiary: '#3D1435' },
        accent: { primary: '#FF0080', secondary: '#FF3399', glow: 'rgba(255, 0, 128, 0.6)' }
    }
];

// رنگ‌های ثابت برای glass و text
const GLASS_COLORS = {
    background: 'rgba(0, 0, 0, 0.6)',
    border: 'rgba(255, 255, 255, 0.15)',
    borderHighlight: 'rgba(255, 255, 255, 0.3)',
    shadow: 'rgba(0, 0, 0, 0.9)'
};

const TEXT_COLORS = {
    primary: '#FFFFFF',
    secondary: '#E0E0E0',
    tertiary: '#A0A0A0'
};

// شمارنده برای انتخاب تم به ترتیب
let themeIndex = 0;

/**
 * انتخاب تم رنگی به ترتیب (چرخشی)
 */
function getNextTheme() {
    const theme = COLOR_THEMES[themeIndex];
    themeIndex = (themeIndex + 1) % COLOR_THEMES.length; // چرخش به ابتدا بعد از آخرین تم
    return theme;
}

/**
 * Creates a beautiful gradient background
 */
function createBackground(ctx, width, height, theme) {
    // Base gradient
    const baseGradient = ctx.createLinearGradient(0, 0, width, height);
    baseGradient.addColorStop(0, theme.background.primary);
    baseGradient.addColorStop(0.5, theme.background.secondary);
    baseGradient.addColorStop(1, theme.background.tertiary);
    ctx.fillStyle = baseGradient;
    ctx.fillRect(0, 0, width, height);

    // Glow effect
    const glowGradient = ctx.createRadialGradient(
        width / 2, -150, 0,
        width / 2, -150, 900
    );
    glowGradient.addColorStop(0, theme.accent.glow);
    glowGradient.addColorStop(0.5, 'rgba(88, 65, 154, 0.2)');
    glowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glowGradient;
    ctx.fillRect(0, 0, width, height);

    // Noise pattern
    for (let x = 0; x < width; x += 4) {
        for (let y = 0; y < height; y += 4) {
            if (Math.random() > 0.995) {
                ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.06})`;
                ctx.fillRect(x, y, 2, 2);
            }
        }
    }

    // Scanlines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.lineWidth = 1;
    for (let y = 0; y < height; y += 4) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }
}

/**
 * Draws a glassmorphism card
 */
function drawGlassCard(ctx, x, y, width, height, borderRadius = 20) {
    // Shadow
    ctx.shadowColor = GLASS_COLORS.shadow;
    ctx.shadowBlur = 30;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 10;

    // Card background
    ctx.fillStyle = GLASS_COLORS.background;
    roundRect(ctx, x, y, width, height, borderRadius);
    ctx.fill();

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Border
    ctx.strokeStyle = GLASS_COLORS.border;
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, width, height, borderRadius);
    ctx.stroke();

    // Top border highlight
    const gradient = ctx.createLinearGradient(x, y, x + width, y);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
    gradient.addColorStop(0.5, GLASS_COLORS.borderHighlight);
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + borderRadius, y + 1);
    ctx.lineTo(x + width - borderRadius, y + 1);
    ctx.stroke();
}

/**
 * Helper function to draw rounded rectangles
 */
function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

/**
 * Draws a circular avatar with glow effect
 */
async function drawAvatar(ctx, avatarUrl, x, y, size, theme) {
    try {
        // Download avatar
        const response = await axios.get(avatarUrl, {
            responseType: 'arraybuffer',
            timeout: 5000
        });
        const buffer = Buffer.from(response.data);
        const avatar = await loadImage(buffer);

        // Draw glow
        ctx.shadowColor = theme.accent.primary;
        ctx.shadowBlur = 30;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // Draw outer ring
        ctx.beginPath();
        ctx.arc(x, y, size / 2 + 8, 0, Math.PI * 2);
        ctx.strokeStyle = theme.accent.primary;
        ctx.lineWidth = 6;
        ctx.stroke();

        // Reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

        // Clip to circle
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, size / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        // Draw avatar
        ctx.drawImage(avatar, x - size / 2, y - size / 2, size, size);
        ctx.restore();

    } catch (error) {
        console.error('Error loading avatar:', error);
        // Draw fallback circle
        ctx.fillStyle = theme.accent.primary;
        ctx.beginPath();
        ctx.arc(x, y, size / 2, 0, Math.PI * 2);
        ctx.fill();

        // Draw user icon
        ctx.fillStyle = TEXT_COLORS.primary;
        ctx.font = `${size / 2}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('👤', x, y);
    }
}

/**
 * Draws text with shadow for better readability
 */
function drawTextWithShadow(ctx, text, x, y, color = TEXT_COLORS.primary) {
    // Shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    // Text
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
}

/**
 * Draws server logo in corner
 */
async function drawServerLogo(ctx, x, y, size) {
    try {
        const logoPath = path.join(__dirname, '..', 'assets', 'server-logo.png');
        const logo = await loadImage(logoPath);
        
        // Draw with slight transparency
        ctx.globalAlpha = 0.9;
        ctx.drawImage(logo, x, y, size, size);
        ctx.globalAlpha = 1.0;
    } catch (error) {
        console.error('Error loading server logo:', error);
        // اگر لوگو پیدا نشد، چیزی نمایش نده
    }
}

/**
 * Main function to generate welcome image
 * @param {Object} member - Discord guild member
 * @returns {Buffer} - PNG image buffer
 */
async function generateWelcomeImage(member) {
    try {
        // انتخاب تم رنگی به ترتیب
        const theme = getNextTheme();
        console.log(`🎨 Selected theme #${themeIndex}: ${theme.name}`);

        // Create canvas
        const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
        const ctx = canvas.getContext('2d');

        // Draw background
        createBackground(ctx, CANVAS_WIDTH, CANVAS_HEIGHT, theme);

        // Draw glass card - بزرگتر شده
        const cardX = 150;
        const cardY = 150;
        const cardWidth = CANVAS_WIDTH - 300;
        const cardHeight = CANVAS_HEIGHT - 300;
        drawGlassCard(ctx, cardX, cardY, cardWidth, cardHeight, 35);

        // Draw avatar - بزرگتر شده
        const avatarSize = 320;
        const avatarX = cardX + 250;
        const avatarY = cardY + cardHeight / 2;
        const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 1024 });
        await drawAvatar(ctx, avatarUrl, avatarX, avatarY, avatarSize, theme);

        // Text positioning
        const textStartX = avatarX + avatarSize / 2 + 120;
        const textCenterY = cardY + cardHeight / 2;

        // Welcome text (large) - بزرگتر شده با فونت بهتر
        ctx.font = 'bold 110px "Segoe UI", Tahoma, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        drawTextWithShadow(ctx, '!خوش آمدید', textStartX + 900, textCenterY - 120, TEXT_COLORS.primary);

        // Username (medium) - بزرگتر شده با فونت بهتر
        const username = member.user.username;
        ctx.font = 'bold 80px "Segoe UI", Tahoma, sans-serif';
        drawTextWithShadow(ctx, username, textStartX + 900, textCenterY + 10, theme.accent.secondary);

        // Member count (small) - بزرگتر شده با فونت بهتر
        const memberCount = member.guild.memberCount;
        ctx.font = '55px "Segoe UI", Tahoma, sans-serif';
        const memberText = `شما عضو ${memberCount} ام هستید`;
        drawTextWithShadow(ctx, memberText, textStartX + 900, textCenterY + 130, TEXT_COLORS.tertiary);

        // Decorative elements - بزرگتر شده
        // Top-left corner decoration
        ctx.strokeStyle = theme.accent.primary;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(cardX + 40, cardY + 100);
        ctx.lineTo(cardX + 40, cardY + 40);
        ctx.lineTo(cardX + 100, cardY + 40);
        ctx.stroke();

        // Bottom-right corner decoration
        ctx.beginPath();
        ctx.moveTo(cardX + cardWidth - 100, cardY + cardHeight - 40);
        ctx.lineTo(cardX + cardWidth - 40, cardY + cardHeight - 40);
        ctx.lineTo(cardX + cardWidth - 40, cardY + cardHeight - 100);
        ctx.stroke();

        // Draw server logo in top-right corner - بیشتر به گوشه
        const logoSize = 150;
        const logoX = cardX + cardWidth - logoSize - 25;
        const logoY = cardY + 25;
        await drawServerLogo(ctx, logoX, logoY, logoSize);

        // Return PNG buffer
        return canvas.toBuffer('image/png');

    } catch (error) {
        console.error('Error generating welcome image:', error);
        throw error;
    }
}

module.exports = {
    generateWelcomeImage
};
