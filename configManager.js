const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, 'config.json');

let config;
try {
  const raw = fs.readFileSync(configPath, 'utf8');
  config = JSON.parse(raw);
} catch (error) {
  console.error('\n❌ Failed to load config.json');
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error(error.message);
  console.error('Make sure config.json exists and is valid JSON.');
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  process.exit(1);
}

function validateConfig() {
  const placeholders = [
    'YOUR_BOT_TOKEN_HERE',
    'YOUR_CLIENT_ID_HERE',
    'YOUR_GUILD_ID_HERE',
    'YOUR_32_CHAR_ENCRYPTION_KEY_HERE'
  ];

  const configString = JSON.stringify(config);
  const hasMissingConfig = placeholders.some((placeholder) =>
    configString.includes(placeholder)
  );

  if (hasMissingConfig) {
    console.error('\n❌ CONFIGURATION ERROR');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('Please fill in all configuration values in config.json!\n');
    console.error('  • YOUR_BOT_TOKEN_HERE → Your Discord bot token');
    console.error('  • YOUR_CLIENT_ID_HERE → Your bot client ID');
    console.error('  • YOUR_GUILD_ID_HERE → Your server/guild ID');
    console.error('  • YOUR_32_CHAR_ENCRYPTION_KEY_HERE → Encryption key\n');
    console.error('📖 Setup Instructions: Read SETUP.md');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    process.exit(1);
  }

  console.log('\n✅ Configuration validated successfully!\n');
  return true;
}

function get(path) {
  return path.split('.').reduce((obj, key) => (obj ? obj[key] : undefined), config);
}

function set(path, value) {
  const keys = path.split('.');
  const lastKey = keys.pop();
  const target = keys.reduce((current, key) => {
    if (!current[key]) current[key] = {};
    return current[key];
  }, config);
  target[lastKey] = value;
}

function isFeatureEnabled(feature) {
  return !!(config.features && config.features[feature] === true);
}

function printConfig() {
  console.log('\n📋 Configuration Summary:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(
    `Bot Token: ${
      config.bot.token && !String(config.bot.token).includes('YOUR_')
        ? '✅ Set'
        : '❌ Missing'
    }`
  );
  console.log(
    `Client ID: ${
      config.bot.clientId && !String(config.bot.clientId).includes('YOUR_')
        ? '✅ Set'
        : '❌ Missing'
    }`
  );
  console.log(
    `Guild ID: ${
      config.bot.guildId && !String(config.bot.guildId).includes('YOUR_')
        ? '✅ Set'
        : '❌ Missing'
    }`
  );
  console.log(`Environment: ${config.server.environment}`);
  console.log(`Debug Mode: ${config.server.debug ? '✅ Enabled' : '❌ Disabled'}`);
  console.log('\n✨ Enabled Features:');
  if (config.features) {
    Object.entries(config.features).forEach(([key, value]) => {
      console.log(`  ${value ? '✅' : '❌'} ${key}`);
    });
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

module.exports = config;
module.exports.validateConfig = validateConfig;
module.exports.get = get;
module.exports.set = set;
module.exports.isFeatureEnabled = isFeatureEnabled;
module.exports.printConfig = printConfig;
