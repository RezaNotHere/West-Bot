# West Bot - Setup Guide

## Prerequisites

- **Node.js** v16 or higher (LTS recommended)
- **npm** (comes with Node.js)
- **Discord Bot Token** from [Discord Developer Portal](https://discord.com/developers/applications)
- **Discord Server** where you have admin permissions

## Step 1: Clone the Repository

```bash
git clone https://github.com/RezaNotHere/West-Bot.git
cd West-Bot
```

## Step 2: Install Dependencies

```bash
npm install
```

This will install all required packages including:
- discord.js v14
- enmap (for database)
- crypto (for encryption)

## Step 3: Create Configuration File

```bash
cp config.example.json config.json
```

## Step 4: Get Required IDs and Tokens

### 4.1 Bot Token
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name
3. Go to "Bot" section and click "Add Bot"
4. Under TOKEN, click "Copy" to copy your bot token
5. Paste it in `config.json` as `bot.token`

### 4.2 Client ID
1. In the same application page, go to "General Information"
2. Copy the "Application ID"
3. Paste it in `config.json` as `bot.clientId`

### 4.3 Guild ID (Server ID)
1. In your Discord server, enable Developer Mode:
   - User Settings → Advanced → Developer Mode (toggle ON)
2. Right-click your server name and select "Copy Server ID"
3. Paste it in `config.json` as `bot.guildId`

### 4.4 Channel IDs
1. Enable Developer Mode (see above)
2. Right-click each channel and select "Copy Channel ID"
3. Paste them in `config.json`:
   - `channels.welcome` - Welcome channel
   - `channels.log` - Logging channel
   - `channels.review` - Review/rating channel
   - `channels.roleMenu` - Role selection channel
   - `channels.banSupport` - Ban appeals channel
   - `channels.closedTicketsCategory` - Closed tickets category

### 4.5 Role IDs
1. Enable Developer Mode
2. Go to Server Settings → Roles
3. Right-click each role and select "Copy Role ID"
4. Paste them in `config.json`:
   - `roles.giveaway` - Giveaway notification role
   - `roles.drop` - Drop notification role
   - `roles.update` - Update notification role
   - `roles.ticketAccess` - Ticket support staff role
   - `roles.shop` - Shop staff role
   - `roles.buyer` - Buyer role (auto-assigned after purchase)

### 4.6 Webhook URL (Optional but Recommended)
1. Go to a channel where you want error logs
2. Channel Settings → Webhooks → Create Webhook
3. Copy the webhook URL
4. Paste it in `config.json` as `channels.errorWebhook`

### 4.7 Encryption Key
Generate a 64-character hex encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output and paste it in `config.json` as `database.encryptionKey`

## Step 5: Configure Bot Settings

Edit `config.json` and customize:

```json
{
  "bot": {
    "token": "YOUR_BOT_TOKEN_HERE",
    "clientId": "YOUR_CLIENT_ID_HERE",
    "guildId": "YOUR_GUILD_ID_HERE",
    "prefix": "!",
    "status": {
      "activities": [
        {
          "text": "your Server!",
          "type": "LISTENING"
        }
      ]
    }
  }
}
```

## Step 6: Invite Bot to Server

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your application
3. Go to OAuth2 → URL Generator
4. Select scopes: `bot`
5. Select permissions:
   - Manage Channels
   - Manage Roles
   - Kick Members
   - Ban Members
   - Send Messages
   - Manage Messages
   - Embed Links
   - Read Message History
   - Mention @everyone
6. Copy the generated URL and open it in your browser
7. Select your server and authorize

## Step 7: Run the Bot

```bash
node index.js
```

You should see:
```
✨ Logged in as YourBotName#0000
🤖 Bot is ready!
```

## Step 8: Test the Bot

In your Discord server, try:
```
/help
```

The bot should respond with available commands.

## Configuration Options

### Ticket System
Enable/disable categories and customize messages in `config.json`:

```json
"ticketSystem": {
  "categoryName": "Tickets",
  "menu": {
    "categories": [
      {
        "label": "🛒 Purchase",
        "value": "buy",
        "requiresDetails": true
      }
    ]
  }
}
```

### Security Settings
Adjust security parameters:

```json
"security": {
  "maxWarnings": 3,
  "antiSpam": {
    "messageLimit": 5,
    "timeWindow": 5000
  }
}
```

### Features
Enable/disable features:

```json
"features": {
  "ticketSystem": true,
  "giveawaySystem": true,
  "badWordsFilter": true,
  "autoModeration": true
}
```

## Troubleshooting

### Bot doesn't respond to commands
- Check that bot token is correct in `config.json`
- Ensure bot has proper permissions in the server
- Check that the bot is online in Discord

### Bot crashes on startup
- Check `config.json` for syntax errors (use JSON validator)
- Ensure all required IDs are filled in
- Check that Node.js version is v16+

### Commands not working
- Ensure slash commands are registered (bot does this automatically)
- Wait 1-2 minutes for Discord to sync commands
- Try restarting the bot

### Ticket system not working
- Verify `channels.closedTicketsCategory` exists
- Check that `roles.ticketAccess` role exists
- Ensure bot has permission to create channels

## Getting Help

- Check [README.md](README.md) for feature documentation
- See [TICKET_DETAILS_SYSTEM.md](TICKET_DETAILS_SYSTEM.md) for ticket system details
- Open an issue on GitHub for bugs

## Next Steps

1. Configure all required channels and roles
2. Customize ticket categories in `config.json`
3. Set up logging webhook for error tracking
4. Test all features in a test channel
5. Deploy to production server

## Security Tips

⚠️ **IMPORTANT:**
- Never share your bot token
- Never commit `config.json` to version control
- Keep your encryption key secret
- Regularly update Node.js and dependencies
- Use strong passwords for sensitive accounts

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the documentation files
3. Open an issue on GitHub
4. Contact the developer

---

**Happy botting! 🎉**
