/**
 * Professional Profile Image Generator - AAA Quality
 * 
 * Features:
 * - Cinema-grade glassmorphism
 * - Dynamic particle systems
 * - Advanced gradient overlays
 * - Professional typography
 * - Hexagon pattern backgrounds
 * - Stat bars with animations
 * - 3D depth effects
 * - Professional color grading
 */

const { createCanvas, loadImage, registerFont } = require('canvas');

// Professional color palettes based on rank
const RANK_PALETTES = {
    'MVP++': {
        primary: '#FFD700',
        secondary: '#FF6B9D',
        accent: '#FFA500',
        glow: 'rgba(255, 215, 0, 0.6)',
        particles: ['#FFD700', '#FF6B9D', '#FFA500'],
        gradient: ['#FFD700', '#FF8C00', '#FF6B9D']
    },
    'MVP+': {
        primary: '#00F5FF',
        secondary: '#00CED1',
        accent: '#1E90FF',
        glow: 'rgba(0, 245, 255, 0.5)',
        particles: ['#00F5FF', '#00CED1', '#1E90FF'],
        gradient: ['#00F5FF', '#00CED1', '#4169E1']
    },
    'MVP': {
        primary: '#00E5FF',
        secondary: '#0080FF',
        accent: '#0040FF',
        glow: 'rgba(0, 229, 255, 0.5)',
        particles: ['#00E5FF', '#0080FF', '#0040FF'],
        gradient: ['#00E5FF', '#0080FF', '#0040FF']
    },
    'VIP+': {
        primary: '#00FF7F',
        secondary: '#32CD32',
        accent: '#00FA9A',
        glow: 'rgba(0, 255, 127, 0.5)',
        particles: ['#00FF7F', '#32CD32', '#00FA9A'],
        gradient: ['#00FF7F', '#32CD32', '#00FA9A']
    },
    'VIP': {
        primary: '#7FFF00',
        secondary: '#90EE90',
        accent: '#98FB98',
        glow: 'rgba(127, 255, 0, 0.4)',
        particles: ['#7FFF00', '#90EE90', '#98FB98'],
        gradient: ['#7FFF00', '#90EE90', '#98FB98']
    },
    'YOUTUBER': {
        primary: '#FF0000',
        secondary: '#DC143C',
        accent: '#FF1493',
        glow: 'rgba(255, 0, 0, 0.6)',
        particles: ['#FF0000', '#DC143C', '#FF1493'],
        gradient: ['#FF0000', '#DC143C', '#FF1493']
    },
    'ADMIN': {
        primary: '#FF0000',
        secondary: '#8B0000',
        accent: '#DC143C',
        glow: 'rgba(255, 0, 0, 0.6)',
        particles: ['#FF0000', '#8B0000', '#DC143C'],
        gradient: ['#FF0000', '#8B0000', '#DC143C']
    },
    'Default': {
        primary: '#B0B0B0',
        secondary: '#808080',
        accent: '#A9A9A9',
        glow: 'rgba(176, 176, 176, 0.4)',
        particles: ['#B0B0B0', '#808080', '#A9A9A9'],
        gradient: ['#B0B0B0', '#808080', '#696969']
    }
};

// Canvas dimensions - Increased height for better proportions
const WIDTH = 1400;
const HEIGHT = 700;

/**
 * Create hexagon pattern background
 */
function drawHexagonPattern(ctx, width, height, palette) {
    const hexSize = 30;
    const rows = Math.ceil(height / (hexSize * 1.5)) + 1;
    const cols = Math.ceil(width / (hexSize * Math.sqrt(3))) + 1;
    
    ctx.save();
    ctx.globalAlpha = 0.03;
    
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const x = col * hexSize * Math.sqrt(3) + (row % 2) * hexSize * Math.sqrt(3) / 2;
            const y = row * hexSize * 1.5;
            
            drawHexagon(ctx, x, y, hexSize, palette.primary);
        }
    }
    
    ctx.restore();
}

/**
 * Draw a hexagon
 */
function drawHexagon(ctx, x, y, size, color) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        const px = x + size * Math.cos(angle);
        const py = y + size * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.stroke();
}

/**
 * Create professional gradient background
 */
function createProBackground(ctx, width, height, palette) {
    // Base dark gradient
    const baseGradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width);
    baseGradient.addColorStop(0, '#0a0a15');
    baseGradient.addColorStop(0.5, '#14141f');
    baseGradient.addColorStop(1, '#1a1a2e');
    ctx.fillStyle = baseGradient;
    ctx.fillRect(0, 0, width, height);
    
    // Animated gradient overlay
    const overlayGradient = ctx.createLinearGradient(0, 0, width, height);
    overlayGradient.addColorStop(0, `${palette.gradient[0]}15`);
    overlayGradient.addColorStop(0.5, `${palette.gradient[1]}10`);
    overlayGradient.addColorStop(1, `${palette.gradient[2]}15`);
    ctx.fillStyle = overlayGradient;
    ctx.fillRect(0, 0, width, height);
    
    // Hexagon pattern
    drawHexagonPattern(ctx, width, height, palette);
    
    // Top glow
    const topGlow = ctx.createRadialGradient(width / 2, 0, 0, width / 2, 0, height);
    topGlow.addColorStop(0, palette.glow);
    topGlow.addColorStop(0.3, `${palette.primary}20`);
    topGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = topGlow;
    ctx.fillRect(0, 0, width, height);
    
    // Particle effect
    drawParticles(ctx, width, height, palette);
}

/**
 * Draw floating particles
 */
function drawParticles(ctx, width, height, palette) {
    ctx.save();
    for (let i = 0; i < 50; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const size = Math.random() * 3 + 1;
        const color = palette.particles[Math.floor(Math.random() * palette.particles.length)];
        const alpha = Math.random() * 0.5 + 0.1;
        
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fillStyle = color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
        ctx.fill();
        
        // Add glow
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, size * 3);
        gradient.addColorStop(0, color + '40');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.fillRect(x - size * 3, y - size * 3, size * 6, size * 6);
    }
    ctx.restore();
}

/**
 * Draw professional glass card with optional header
 */
function drawProCard(ctx, x, y, width, height, palette, options = {}) {
    const { 
        borderWidth = 2, 
        glowIntensity = 0.8,
        headerText = null,
        headerIcon = null
    } = options;
    
    ctx.save();
    
    // Outer glow
    ctx.shadowColor = palette.glow;
    ctx.shadowBlur = 20 * glowIntensity;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    
    // Card background with gradient
    const cardGradient = ctx.createLinearGradient(x, y, x, y + height);
    cardGradient.addColorStop(0, 'rgba(20, 20, 35, 0.85)');
    cardGradient.addColorStop(1, 'rgba(10, 10, 20, 0.90)');
    ctx.fillStyle = cardGradient;
    
    const radius = 20;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    ctx.fill();
    
    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    
    // Gradient border
    const borderGradient = ctx.createLinearGradient(x, y, x + width, y + height);
    borderGradient.addColorStop(0, palette.primary);
    borderGradient.addColorStop(0.5, palette.secondary);
    borderGradient.addColorStop(1, palette.accent);
    ctx.strokeStyle = borderGradient;
    ctx.lineWidth = borderWidth;
    ctx.stroke();
    
    // Inner highlight
    ctx.strokeStyle = `${palette.primary}40`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 2, width - 4, height - 4, radius - 2);
    ctx.stroke();
    
    // Shine effect
    const shineGradient = ctx.createLinearGradient(x, y, x, y + height / 3);
    shineGradient.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
    shineGradient.addColorStop(1, 'transparent');
    ctx.fillStyle = shineGradient;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    ctx.fill();
    
    ctx.restore();
}

/**
 * Format large numbers with K/M suffix
 */
function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

/**
 * Draw gradient divider line
 */
function drawDivider(ctx, x, y, width, palette) {
    ctx.save();
    const gradient = ctx.createLinearGradient(x, y, x + width, y);
    gradient.addColorStop(0, 'transparent');
    gradient.addColorStop(0.1, palette.primary + '60');
    gradient.addColorStop(0.5, palette.secondary);
    gradient.addColorStop(0.9, palette.accent + '60');
    gradient.addColorStop(1, 'transparent');
    
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + width, y);
    ctx.stroke();
    
    // Glow effect
    ctx.shadowColor = palette.primary;
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.restore();
}

/**
 * Draw text with professional effects
 */
function drawProText(ctx, text, x, y, options = {}) {
    const {
        size = 20,
        weight = 'normal',
        color = '#FFFFFF',
        align = 'left',
        shadowBlur = 8,
        glow = true,
        glowColor = null
    } = options;
    
    ctx.save();
    ctx.font = `${weight} ${size}px 'Segoe UI', Arial, sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    
    // Glow effect
    if (glow) {
        ctx.shadowColor = glowColor || color;
        ctx.shadowBlur = shadowBlur;
        ctx.fillStyle = color;
        ctx.fillText(text, x, y);
        ctx.shadowBlur = shadowBlur * 1.5;
        ctx.fillText(text, x, y);
    }
    
    // Main text
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    
    ctx.restore();
}

/**
 * Draw circular progress ring (professional style)
 */
function drawCircularProgress(ctx, x, y, radius, value, maxValue, palette, label = '') {
    const percentage = Math.min(value / maxValue, 1);
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + (2 * Math.PI * percentage);
    
    ctx.save();
    
    // Background circle
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 8;
    ctx.stroke();
    
    // Progress arc with gradient
    if (percentage > 0) {
        const gradient = ctx.createLinearGradient(x - radius, y, x + radius, y);
        gradient.addColorStop(0, palette.primary);
        gradient.addColorStop(0.5, palette.secondary);
        gradient.addColorStop(1, palette.accent);
        
        ctx.beginPath();
        ctx.arc(x, y, radius, startAngle, endAngle);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.shadowColor = palette.primary;
        ctx.shadowBlur = 15;
        ctx.stroke();
    }
    
    // Center text - value
    ctx.shadowBlur = 0;
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = palette.primary;
    ctx.fillText(formatNumber(value), x, y - 8);
    
    // Label below
    ctx.font = '12px Arial';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillText(label, x, y + 12);
    
    ctx.restore();
}

/**
 * Draw stat bar with animation effect and percentage
 */
function drawStatBar(ctx, x, y, width, height, value, maxValue, palette, showPercentage = true) {
    const percentage = Math.min(value / maxValue, 1);
    
    // Bar background with depth
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, height / 2);
    ctx.fill();
    ctx.restore();
    
    // Inner border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Bar fill with animated gradient
    if (percentage > 0) {
        const barGradient = ctx.createLinearGradient(x, y, x + width, y);
        barGradient.addColorStop(0, palette.primary);
        barGradient.addColorStop(0.3, palette.secondary);
        barGradient.addColorStop(0.7, palette.accent);
        barGradient.addColorStop(1, palette.primary);
        
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(x, y, width * percentage, height, height / 2);
        ctx.fillStyle = barGradient;
        ctx.fill();
        
        // Outer glow
        ctx.shadowColor = palette.primary;
        ctx.shadowBlur = 20;
        ctx.fill();
        
        // Inner shine
        const shineGradient = ctx.createLinearGradient(x, y, x, y + height);
        shineGradient.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
        shineGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.2)');
        shineGradient.addColorStop(1, 'transparent');
        ctx.shadowBlur = 0;
        ctx.fillStyle = shineGradient;
        ctx.fill();
        ctx.restore();
    }
    
    // Percentage text with better styling
    if (showPercentage) {
        ctx.save();
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const textColor = percentage > 0.3 ? '#FFFFFF' : palette.primary;
        ctx.fillStyle = textColor;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetY = 1;
        ctx.fillText(`${Math.floor(percentage * 100)}%`, x + width / 2, y + height / 2);
        ctx.restore();
    }
}

/**
 * Create professional Hypixel profile image
 */
async function createProfileImage({
    uuid,
    username,
    rank = 'Default',
    stats = {},
    guildInfo = {},
    capeUrls = [],
    gameStats = {}
}) {
    // Validation
    if (!uuid) throw new Error('UUID is required');
    if (!username) username = 'Unknown';
    
    // Normalize data
    const normalizedStats = {
        achievementPoints: stats.achievementPoints || 0,
        karma: stats.karma || 0,
        networkLevel: stats.networkLevel || 0,
        questsCompleted: stats.questsCompleted || 0,
        ranksGifted: stats.ranksGifted || 0
    };
    
    const normalizedGuild = {
        name: guildInfo.name || 'None',
        level: guildInfo.level || 0,
        members: guildInfo.members || 0
    };
    
    // Normalize game stats
    const normalizedGameStats = {
        bedwars: gameStats.bedwars || { wins: 0, finalKills: 0, level: 0 },
        skywars: gameStats.skywars || { wins: 0, kills: 0, level: 0 },
        duels: gameStats.duels || { wins: 0, losses: 0 }
    };
    
    // Determine rank palette
    let paletteKey = 'Default';
    const rankUpper = (rank || '').toUpperCase();
    if (rankUpper.includes('MVP++')) paletteKey = 'MVP++';
    else if (rankUpper.includes('MVP+')) paletteKey = 'MVP+';
    else if (rankUpper.includes('MVP')) paletteKey = 'MVP';
    else if (rankUpper.includes('VIP+')) paletteKey = 'VIP+';
    else if (rankUpper.includes('VIP')) paletteKey = 'VIP';
    else if (rankUpper.includes('YOUTUBER')) paletteKey = 'YOUTUBER';
    else if (rankUpper.includes('ADMIN') || rankUpper.includes('OWNER')) paletteKey = 'ADMIN';
    
    const palette = RANK_PALETTES[paletteKey];
    
    try {
        // Create canvas
        const canvas = createCanvas(WIDTH, HEIGHT);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Background
        createProBackground(ctx, WIDTH, HEIGHT, palette);
        
        // Main title with mega effect
        const titleGradient = ctx.createLinearGradient(WIDTH / 2 - 200, 50, WIDTH / 2 + 200, 50);
        palette.gradient.forEach((color, i) => {
            titleGradient.addColorStop(i / (palette.gradient.length - 1), color);
        });
        
        drawProText(ctx, 'HYPIXEL', WIDTH / 2, 50, {
            size: 56,
            weight: '900',
            color: titleGradient,
            align: 'center',
            shadowBlur: 20,
            glow: true,
            glowColor: palette.primary
        });
        
        drawProText(ctx, 'PLAYER STATISTICS', WIDTH / 2, 95, {
            size: 22,
            weight: '600',
            color: palette.secondary,
            align: 'center',
            shadowBlur: 12
        });
        
        // Username badge
        const badgeWidth = username.length * 20 + 60;
        const badgeX = (WIDTH - badgeWidth) / 2;
        drawProCard(ctx, badgeX, 120, badgeWidth, 50, palette, { glowIntensity: 1.2 });
        
        drawProText(ctx, username.toUpperCase(), WIDTH / 2, 145, {
            size: 28,
            weight: '800',
            color: palette.primary,
            align: 'center',
            shadowBlur: 15,
            glow: true
        });
        
        // Rank badge if not default
        if (rank !== 'Default' && rank !== 'پیش‌فرض') {
            const rankBadgeWidth = rank.length * 10 + 30;
            const rankBadgeX = WIDTH / 2 - rankBadgeWidth / 2;
            
            // Small rank badge
            ctx.save();
            ctx.fillStyle = palette.primary + '20';
            ctx.beginPath();
            ctx.roundRect(rankBadgeX, 175, rankBadgeWidth, 24, 12);
            ctx.fill();
            
            ctx.strokeStyle = palette.primary + '60';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.restore();
            
            drawProText(ctx, rank, WIDTH / 2, 187, {
                size: 14,
                weight: '700',
                color: palette.primary,
                align: 'center',
                glow: true,
                shadowBlur: 6
            });
        }
        
        // Cape indicator if available
        if (capeUrls && capeUrls.length > 0) {
            const capeX = WIDTH / 2 + badgeWidth / 2 + 15;
            drawProText(ctx, '[CAPE]', capeX, 145, {
                size: 14,
                weight: '600',
                color: palette.accent,
                shadowBlur: 6,
                glow: true
            });
        }
        
        // Left panel - Player skin (taller panel)
        const skinPanelX = 40;
        const skinPanelY = 220;
        const skinPanelW = 380;
        const skinPanelH = 440; // Increased from 340
        
        drawProCard(ctx, skinPanelX, skinPanelY, skinPanelW, skinPanelH, palette);
        
        // Load and draw skin with proper aspect ratio
        let skinImage = null;
        try {
            const skinUrl = `https://crafatar.com/renders/body/${uuid}?overlay=true&scale=10`;
            skinImage = await loadImage(skinUrl).catch(async () => {
                return await loadImage(`https://mc-heads.net/body/${uuid}`);
            });
            
            if (skinImage && skinImage.width && skinImage.height) {
                // Calculate proper dimensions maintaining aspect ratio
                const maxWidth = skinPanelW - 60;
                const maxHeight = skinPanelH - 60;
                
                let skinWidth = skinImage.width;
                let skinHeight = skinImage.height;
                
                // Scale to fit within panel while maintaining aspect ratio
                const widthRatio = maxWidth / skinWidth;
                const heightRatio = maxHeight / skinHeight;
                const scale = Math.min(widthRatio, heightRatio);
                
                skinWidth = skinWidth * scale;
                skinHeight = skinHeight * scale;
                
                // Center the skin in the panel
                const skinX = skinPanelX + (skinPanelW - skinWidth) / 2;
                const skinY = skinPanelY + (skinPanelH - skinHeight) / 2;
                
                // Glow behind skin (reduced brightness)
                ctx.save();
                ctx.shadowColor = palette.glow;
                ctx.shadowBlur = 15;
                ctx.globalAlpha = 0.85;
                ctx.drawImage(skinImage, skinX, skinY, skinWidth, skinHeight);
                ctx.restore();
            }
        } catch (err) {
            console.warn('[ProImage] Skin load failed:', err.message);
        }
        
        // Player name label under skin
        const labelY = skinPanelY + skinPanelH - 35;
        drawProText(ctx, username.toUpperCase(), skinPanelX + skinPanelW / 2, labelY, {
            size: 20,
            weight: '700',
            color: palette.primary,
            align: 'center',
            glow: true,
            shadowBlur: 10
        });
        
        // UUID below name (shortened and more visible)
        const shortUuid = uuid.substring(0, 8);
        drawProText(ctx, shortUuid, skinPanelX + skinPanelW / 2, labelY + 25, {
            size: 14,
            weight: '500',
            color: 'rgba(255, 255, 255, 0.6)',
            align: 'center',
            glow: false,
            shadowBlur: 4
        });
        
        // Right panel - Stats (taller panel to match skin panel)
        const statsPanelX = 450;
        const statsPanelY = 220;
        const statsPanelW = 910;
        const statsPanelH = 440; // Increased from 340 to match skin panel
        
        drawProCard(ctx, statsPanelX, statsPanelY, statsPanelW, statsPanelH, palette);
        
        // Left Column - General Statistics
        const leftColX = statsPanelX + 30;
        const colWidth = 420;
        
        drawProText(ctx, 'GENERAL STATISTICS', leftColX, statsPanelY + 30, {
            size: 20,
            weight: '700',
            color: palette.primary,
            glow: false,
            shadowBlur: 2
        });
        
        // Network Level with bar
        const levelY = statsPanelY + 70;
        drawProText(ctx, `Network Level: ${normalizedStats.networkLevel}`, leftColX, levelY, {
            size: 18,
            weight: '600',
            color: 'rgba(255, 255, 255, 0.7)'
        });
        drawStatBar(ctx, leftColX, levelY + 20, colWidth - 30, 12, normalizedStats.networkLevel, 300, palette);
        
        // Achievement Points with bar
        const achY = statsPanelY + 120;
        drawProText(ctx, `Achievement Points: ${formatNumber(normalizedStats.achievementPoints)}`, leftColX, achY, {
            size: 18,
            weight: '600',
            color: 'rgba(255, 255, 255, 0.7)'
        });
        drawStatBar(ctx, leftColX, achY + 20, colWidth - 30, 12, normalizedStats.achievementPoints, 50000, palette);
        
        // Karma with bar
        const karmaY = statsPanelY + 170;
        drawProText(ctx, `Karma: ${formatNumber(normalizedStats.karma)}`, leftColX, karmaY, {
            size: 18,
            weight: '600',
            color: 'rgba(255, 255, 255, 0.7)'
        });
        drawStatBar(ctx, leftColX, karmaY + 20, colWidth - 30, 12, normalizedStats.karma, 1000000, palette);
        
        // Right Column - Quick Stats
        const rightColX = leftColX + colWidth + 20;
        
        drawProText(ctx, 'QUICK STATS', rightColX, statsPanelY + 30, {
            size: 20,
            weight: '700',
            color: palette.primary,
            glow: false,
            shadowBlur: 2
        });
        
        const quickStats = [
            ['Quests', normalizedStats.questsCompleted],
            ['Ranks Gifted', normalizedStats.ranksGifted],
            ['Guild', normalizedGuild.name.length > 12 ? normalizedGuild.name.substring(0, 10) + '..' : normalizedGuild.name],
            ['Guild Level', normalizedGuild.level],
            ['Members', normalizedGuild.members]
        ];
        
        let qy = statsPanelY + 70;
        quickStats.forEach(([label, value]) => {
            drawProText(ctx, label, rightColX, qy, {
                size: 18,
                weight: '600',
                color: 'rgba(255, 255, 255, 0.6)'
            });
            drawProText(ctx, String(value), rightColX + 200, qy, {
                size: 18,
                weight: '700',
                color: palette.accent,
                align: 'right',
                glow: false
            });
            qy += 28;
        });
        
        // Vertical divider between columns
        ctx.save();
        ctx.strokeStyle = palette.primary + '40';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(leftColX + colWidth + 10, statsPanelY + 20);
        ctx.lineTo(leftColX + colWidth + 10, statsPanelY + 220);
        ctx.stroke();
        ctx.restore();
        
        // Divider before game stats
        drawDivider(ctx, statsPanelX + 20, statsPanelY + 240, statsPanelW - 40, palette);
        
        // Determine top game
        const gameScores = {
            bedwars: normalizedGameStats.bedwars.wins + normalizedGameStats.bedwars.finalKills,
            skywars: normalizedGameStats.skywars.wins + normalizedGameStats.skywars.kills,
            duels: normalizedGameStats.duels.wins
        };
        const topGame = Object.keys(gameScores).reduce((a, b) => gameScores[a] > gameScores[b] ? a : b);
        const gameNames = { bedwars: 'BedWars', skywars: 'SkyWars', duels: 'Duels' };
        
        // Top Game Badge
        if (gameScores[topGame] > 0) {
            const badgeX = statsPanelX + statsPanelW - 170;
            const badgeY = statsPanelY + 260;
            
            // Badge background
            ctx.save();
            ctx.fillStyle = palette.accent + '30';
            ctx.beginPath();
            ctx.roundRect(badgeX, badgeY, 140, 26, 13);
            ctx.fill();
            ctx.strokeStyle = palette.accent + '80';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
            
            drawProText(ctx, `TOP: ${gameNames[topGame]}`, badgeX + 70, badgeY + 13, {
                size: 12,
                weight: '700',
                color: palette.accent,
                align: 'center',
                glow: true,
                shadowBlur: 4
            });
        }
        
        // Game Stats Section
        drawProText(ctx, 'GAME STATISTICS', statsPanelX + 30, statsPanelY + 260, {
            size: 20,
            weight: '700',
            color: palette.primary,
            glow: true,
            shadowBlur: 4
        });
        
        const gameY = statsPanelY + 295;
        const gameSpacing = 145;
        
        // BedWars
        const isBedwarsTop = topGame === 'bedwars';
        drawProText(ctx, `BedWars${isBedwarsTop ? ' *' : ''}`, statsPanelX + 30, gameY, {
            size: 16,
            weight: '600',
            color: isBedwarsTop ? palette.accent : palette.secondary
        });
        drawProText(ctx, `Wins: ${formatNumber(normalizedGameStats.bedwars.wins)}`, statsPanelX + 30, gameY + 20, {
            size: 14,
            color: 'rgba(255, 255, 255, 0.8)'
        });
        drawProText(ctx, `FK: ${formatNumber(normalizedGameStats.bedwars.finalKills)}`, statsPanelX + 30, gameY + 38, {
            size: 14,
            color: 'rgba(255, 255, 255, 0.8)'
        });
        drawProText(ctx, `Level: ${normalizedGameStats.bedwars.level}`, statsPanelX + 30, gameY + 56, {
            size: 14,
            color: palette.accent
        });
        
        // SkyWars
        const isSkywarsTop = topGame === 'skywars';
        drawProText(ctx, `SkyWars${isSkywarsTop ? ' *' : ''}`, statsPanelX + 30 + gameSpacing, gameY, {
            size: 16,
            weight: '600',
            color: isSkywarsTop ? palette.accent : palette.secondary
        });
        drawProText(ctx, `Wins: ${formatNumber(normalizedGameStats.skywars.wins)}`, statsPanelX + 30 + gameSpacing, gameY + 20, {
            size: 14,
            color: 'rgba(255, 255, 255, 0.8)'
        });
        drawProText(ctx, `Kills: ${formatNumber(normalizedGameStats.skywars.kills)}`, statsPanelX + 30 + gameSpacing, gameY + 38, {
            size: 14,
            color: 'rgba(255, 255, 255, 0.8)'
        });
        drawProText(ctx, `Level: ${normalizedGameStats.skywars.level}`, statsPanelX + 30 + gameSpacing, gameY + 56, {
            size: 14,
            color: palette.accent
        });
        
        // Duels
        const isDuelsTop = topGame === 'duels';
        drawProText(ctx, `Duels${isDuelsTop ? ' *' : ''}`, statsPanelX + 30 + gameSpacing * 2, gameY, {
            size: 16,
            weight: '600',
            color: isDuelsTop ? palette.accent : palette.secondary
        });
        drawProText(ctx, `Wins: ${formatNumber(normalizedGameStats.duels.wins)}`, statsPanelX + 30 + gameSpacing * 2, gameY + 20, {
            size: 14,
            color: 'rgba(255, 255, 255, 0.8)'
        });
        drawProText(ctx, `Losses: ${formatNumber(normalizedGameStats.duels.losses)}`, statsPanelX + 30 + gameSpacing * 2, gameY + 38, {
            size: 14,
            color: 'rgba(255, 255, 255, 0.8)'
        });
        const wlRatio = normalizedGameStats.duels.losses > 0 
            ? (normalizedGameStats.duels.wins / normalizedGameStats.duels.losses).toFixed(2) 
            : normalizedGameStats.duels.wins;
        drawProText(ctx, `W/L: ${wlRatio}`, statsPanelX + 30 + gameSpacing * 2, gameY + 56, {
            size: 14,
            color: palette.accent
        });
        
        // Footer watermark
        drawProText(ctx, 'Generated by West Bot', WIDTH / 2, HEIGHT - 25, {
            size: 13,
            weight: '400',
            color: 'rgba(255, 255, 255, 0.35)',
            align: 'center',
            glow: false
        });
        
        // Decorative corner elements
        ctx.save();
        ctx.strokeStyle = palette.primary + '60';
        ctx.lineWidth = 2;
        [
            [20, 20], [WIDTH - 20, 20],
            [20, HEIGHT - 20], [WIDTH - 20, HEIGHT - 20]
        ].forEach(([x, y]) => {
            const size = 15;
            ctx.beginPath();
            if (x < WIDTH / 2) {
                ctx.moveTo(x, y + size);
                ctx.lineTo(x, y);
                ctx.lineTo(x + size, y);
            } else {
                ctx.moveTo(x - size, y);
                ctx.lineTo(x, y);
                ctx.lineTo(x, y + size);
            }
            ctx.stroke();
        });
        ctx.restore();
        
        return canvas.toBuffer('image/png');
        
    } catch (err) {
        console.error('[ProImage] Error:', err.message);
        throw new Error(`Failed to create professional profile image: ${err.message}`);
    }
}

module.exports = { createProfileImage };
