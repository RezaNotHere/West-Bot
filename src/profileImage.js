const Jimp = require('jimp');
const { createCanvas, loadImage } = require('canvas');
const axios = require('axios');
const path = require('path');

// Minecraft rank colors
const RANK_COLORS = {
    'MVP+': { primary: '#55FFFF', shadow: '#3EC6C6' },
    'MVP++': { primary: '#FF55FF', shadow: '#C646C6' },
    'MVP': { primary: '#55FFFF', shadow: '#3EC6C6' },
    'VIP+': { primary: '#55FF55', shadow: '#4ACC4A' },
    'VIP': { primary: '#55FF55', shadow: '#4ACC4A' },
    'Default': { primary: '#AAAAAA', shadow: '#8A8A8A' }
};

// Glass card styling
const GLASS_CARD = {
    background: 'rgba(0, 0, 0, 0.5)',
    border: 'rgba(255, 255, 255, 0.1)',
    shadowColor: 'rgba(0, 0, 0, 0.8)',
    blur: 10,
    borderRadius: 12
};

/**
 * Creates a glowing background effect
 */
function createGlowingBackground(ctx, width, height) {
    // Base gradient
    const baseGradient = ctx.createLinearGradient(0, 0, width, height);
    baseGradient.addColorStop(0, '#150F1F');
    baseGradient.addColorStop(0.7, '#1F1836');
    baseGradient.addColorStop(1, '#191428');
    ctx.fillStyle = baseGradient;
    ctx.fillRect(0, 0, width, height);

    // Top glow effect
    const glowGradient = ctx.createRadialGradient(
        width / 2, -100, 0,
        width / 2, -100, 800
    );
    glowGradient.addColorStop(0, 'rgba(88, 65, 154, 0.3)');
    glowGradient.addColorStop(1, 'rgba(88, 65, 154, 0)');
    ctx.fillStyle = glowGradient;
    ctx.fillRect(0, 0, width, height);

    // Subtle noise pattern
    for (let x = 0; x < width; x += 2) {
        for (let y = 0; y < height; y += 2) {
            if (Math.random() > 0.996) {
                ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.04})`;
                ctx.fillRect(x, y, 2, 2);
            }
        }
    }
}

/**
 * Creates a glass card effect
 */
function drawGlassCard(ctx, x, y, width, height, options = {}) {
    const settings = { ...GLASS_CARD, ...options };
    
    // Card shadow
    ctx.save();
    ctx.shadowColor = settings.shadowColor;
    ctx.shadowBlur = settings.blur;
    ctx.fillStyle = settings.background;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, settings.borderRadius);
    ctx.fill();

    // Card border
    ctx.strokeStyle = settings.border;
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Inner light effect
    const gradient = ctx.createLinearGradient(x, y, x, y + height);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.restore();
}

/**
 * Create a modern Hypixel stats image
 * @param {Object} options - The options for creating the profile image
 * @param {string} options.uuid - The player's UUID
 * @param {string} options.username - The player's username
 * @param {string} options.rank - The player's rank
 * @param {Object} options.stats - The player's statistics
 * @param {string[]} [options.capeUrls] - URLs of player's capes
 * @param {Object} options.guildInfo - The player's guild information
 * @throws {Error} If required parameters are missing or invalid
 */
async function createProfileImage({ 
    uuid, 
    username, 
    rank = '', 
    capeUrls = [],
    stats = {
        achievementPoints: 0,
        karma: 0,
        questsCompleted: 0,
        ranksGifted: 0,
        level: 0
    }, 
    guildInfo = {
        name: 'None',
        level: 0,
        members: 0,
        joined: 'Never'
    } 
}) {
    try {
        if (!uuid) throw new Error('UUID is required');
        if (!username) username = 'Unknown';

        // Canvas setup
        const WIDTH = 1100;
        const HEIGHT = 480;
        const canvas = createCanvas(WIDTH, HEIGHT);
        const ctx = canvas.getContext('2d');
        ctx.textBaseline = 'middle';  // Better text alignment

        // Create background
        createGlowingBackground(ctx, WIDTH, HEIGHT);

        // Draw title
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText('Hypixel Stats', WIDTH / 2, 45);

        // Draw stat cards
        const CARD_MARGIN = 20;
        const CARD_WIDTH = 380;
        const CARD_HEIGHT = 200;
        const CARDS_X = WIDTH - CARD_WIDTH - 30; // Right side of the image
        
        // GENERAL card
        drawGlassCard(ctx, CARDS_X, 70, CARD_WIDTH, CARD_HEIGHT);
        ctx.font = 'bold 24px Arial';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'left';
        ctx.fillText('GENERAL', CARDS_X + 20, 100);

        // Add general stats
        ctx.font = '20px Arial';
        let yPos = 135;
        const statSpacing = 30;
        const statPairs = [
            ['Achievement Points', stats.achievementPoints || '0'],
            ['Karma', (stats.karma || 0).toLocaleString()],
            ['Quests Completed', stats.questsCompleted || '0'],
            ['Ranks Gifted', stats.ranksGifted || '0']
        ];

        statPairs.forEach(([label, value]) => {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.fillText(label, CARDS_X + 20, yPos);
            ctx.fillStyle = '#FFFFFF';
            ctx.textAlign = 'right';
            ctx.fillText(value, CARDS_X + CARD_WIDTH - 20, yPos);
            ctx.textAlign = 'left';
            yPos += statSpacing;
        });

        // GUILD card
        drawGlassCard(ctx, CARDS_X, 290, CARD_WIDTH, CARD_HEIGHT);
        ctx.font = 'bold 24px Arial';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText('GUILD', CARDS_X + 20, 320);

        // Add guild stats
        yPos = 355;
        const guildPairs = [
            ['Name', guildInfo.name || 'None'],
            ['Level', guildInfo.level || '0'],
            ['Members', guildInfo.members || '0'],
            ['Joined', guildInfo.joined || 'Never']
        ];

        guildPairs.forEach(([label, value]) => {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.fillText(label, CARDS_X + 20, yPos);
            ctx.fillStyle = '#FFFFFF';
            ctx.textAlign = 'right';
            ctx.fillText(value, CARDS_X + CARD_WIDTH - 20, yPos);
            ctx.textAlign = 'left';
            yPos += statSpacing;
        });

        // Player skin with proper proportions
        const SKIN_SIZE = {
            height: 340,
            width: 340 * 0.8  // Maintain proper player model proportions
        };
        const skinUrl = `https://crafatar.com/renders/body/${uuid}?overlay=true&scale=10`;
        const skinImage = await loadImage(skinUrl);

        // Calculate position to align skin properly
        const skinX = 50;  // Left padding
        const skinY = HEIGHT - SKIN_SIZE.height + 20;  // Bottom aligned with some padding
        
        // Validate skin image dimensions
        if (!skinImage.width || !skinImage.height) {
            throw new Error('Invalid skin image dimensions');
        }

        // Draw the skin with proper dimensions and error handling
        try {
            ctx.drawImage(
                skinImage,
                skinX,
                skinY,
                SKIN_SIZE.width,
                SKIN_SIZE.height
            );

            // Draw cape if available
            if (capeUrls && capeUrls.length > 0) {
                try {
                    const capeImage = await loadImage(capeUrls[0]);
                    const CAPE_SIZE = {
                        width: SKIN_SIZE.width * 0.6,
                        height: SKIN_SIZE.height * 0.4
                    };
                    ctx.drawImage(
                        capeImage,
                        skinX + SKIN_SIZE.width * 0.2, // Center the cape
                        skinY + SKIN_SIZE.height * 0.2,
                        CAPE_SIZE.width,
                        CAPE_SIZE.height
                    );
                } catch (capeErr) {
                    console.warn('Failed to load cape:', capeErr.message);
                    // Continue without cape - non-critical error
                }
            }

            // Return buffer directly from canvas without Jimp conversion
            return canvas.toBuffer('image/png');
        } catch (drawErr) {
            throw new Error(`Failed to render player model: ${drawErr.message}`);
        }
    } catch (err) {
        console.error('Error creating profile image:', err);
        throw err;
    }
}

module.exports = { createProfileImage };