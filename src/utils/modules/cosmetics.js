const COLOR_PRESETS = {
    DEFAULT: "#006400" // Dark Green
};

/**
 * Create an embed for displaying player cosmetics
 * @param {string} username - Minecraft username
 * @param {string} uuid - Minecraft UUID
 * @param {string[]} cosmeticCapes - Array of cape descriptions
 * @param {string[]} cosmetics - Array of cosmetic descriptions
 * @param {number} page - Current page number
 * @param {any} EmbedBuilder - Discord.js EmbedBuilder class
 * @returns {any} Discord embed object
 */
function createCosmeticEmbed(username, uuid, cosmeticCapes, cosmetics, page, EmbedBuilder) {
    const start = page * 5;
    const end = start + 5;
    const capesPage = cosmeticCapes.slice(start, end);
    const cosmeticsPage = cosmetics.slice(start, end);

    const embed = new EmbedBuilder()
        .setColor(COLOR_PRESETS.DEFAULT)
        .setTitle(`🎮 پروفایل ماینکرفت ${username}`)
        .setImage(`https://mc-heads.net/minecraft/profile/${username}`)
        .setThumbnail(`https://mc-heads.net/head/${uuid}/left`)
        .setTimestamp();

    embed.addFields({ 
        name: "🎭 نمای کامل کاراکتر", 
        value: `[مشاهده رندر HD](https://mc-heads.net/body/${uuid}/left)`,
        inline: true 
    });

    if (capesPage.length > 0) {
        embed.addFields({ 
            name: "🧥 کیپ‌های فعال", 
            value: `[مشاهده کیپ‌ها در NameMC](https://namemc.com/profile/${uuid})`,
            inline: true 
        });
    }
    
    if (cosmeticsPage.length > 0) {
        embed.addFields({ 
            name: "🎨 مدل اسکین", 
            value: cosmeticsPage.join('\n'), 
            inline: true 
        });
    }

    embed.addFields({ 
        name: "🔍 لینک‌های مفید", 
        value: `[NameMC](https://namemc.com/profile/${uuid}) | [Skin History](https://namemc.com/profile/${uuid}/skin) | [Cape Viewer](https://mc-heads.net/cape/${uuid})`, 
        inline: false 
    });

    return embed;
}

/**
 * Get the descriptive name for a cape type based on its URL
 * @param {string} capeUrl - URL of the cape
 * @returns {string} Descriptive name of the cape type
 */
function getCapeTypeName(capeUrl) {
    if (capeUrl.includes('minecraft.net')) {
        if (capeUrl.includes('migrator')) return '🌟 کیپ مهاجرت موجانگ';
        if (capeUrl.includes('scrolls')) return '📜 کیپ Scrolls';
        if (capeUrl.includes('translator')) return '🌍 کیپ مترجم موجانگ';
        if (capeUrl.includes('cobalt')) return '💠 کیپ Cobalt';
        if (capeUrl.includes('mojang')) return '⭐ کیپ کارمند موجانگ';
        if (capeUrl.includes('minecon')) {
            const year = capeUrl.match(/201[0-9]/);
            return `🎪 کیپ MineCon ${year ? year[0] : ''}`;
        }
        return '🌟 کیپ رسمی موجانگ';
    }
    if (capeUrl.includes('optifine')) return '🎭 کیپ OptiFine';
    return '🧥 کیپ ناشناخته';
}

module.exports = {
    createCosmeticEmbed,
    getCapeTypeName,
    COLOR_PRESETS
};