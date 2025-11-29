# 🤖 Advanced Discord Bot - West Bot

<div align="center">

![Discord.js](https://img.shields.io/badge/discord.js-v14-blue?logo=discord&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-v16+-green?logo=node.js&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-yellow)
![Status](https://img.shields.io/badge/Status-Active-brightgreen)

**A professional, feature-rich Discord bot for advanced server management, ticketing, giveaways, and Minecraft utilities.**

[English](#english) • [فارسی](#فارسی)

</div>

---

## English

### Overview

**West Bot** is a comprehensive Discord bot engineered for professional and large-scale communities. It provides:

✨ **Advanced Moderation** - Complete suite of moderation tools with persistent warnings and automated actions  
🎫 **Professional Ticket System** - Streamlined support, purchases, and inquiries management  
🎁 **Giveaway Management** - Automated giveaway hosting with real-time participant tracking  
📊 **Detailed Analytics** - Invite tracking, role statistics, and member insights  
🎮 **Minecraft Integration** - Beautiful profile rendering with Hypixel statistics  
🔐 **Enterprise Security** - AES-256-GCM encrypted database with anti-spam, anti-raid protection  
📝 **Professional Logging** - Comprehensive audit trails and error reporting via webhooks  
⚙️ **Centralized Configuration** - Single `config.json` file for all server-specific settings  

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Features](#features)
3. [Requirements](#requirements)
4. [Installation](#installation)
5. [Configuration Guide](#configuration-guide)
6. [Running the Bot](#running-the-bot)
7. [Commands Reference](#commands-reference)
8. [Ticket System](#ticket-system)
9. [Security Features](#security-features)
10. [Database & Encryption](#database--encryption)
11. [Logging System](#logging-system)
12. [Project Structure](#project-structure)
13. [Troubleshooting](#troubleshooting)
14. [Contributing](#contributing)
15. [Persian Guide (راهنمای فارسی)](#فارسی)

---

## Quick Start

### 1️⃣ Prerequisites
- Node.js v16+ (LTS recommended)
- npm or yarn
- Discord Bot Token
- Required Discord Intents enabled

### 2️⃣ Installation
```bash
git clone https://github.com/YOUR_USERNAME/West-Bot.git
cd West-Bot
npm install
```

### 3️⃣ Configuration
```bash
cp config.example.json config.json
# Edit config.json with your settings
```

### 4️⃣ Run
```bash
node index.js
```

---

## Features

### 🛡️ Moderation & Safety
- **Comprehensive Commands**: `/warn`, `/clear`, `/kick`, `/ban`, `/unban`
- **Bad Words Filter**: Automated detection with DM notifications
- **Warning System**: Persistent storage with configurable thresholds
- **Auto-moderation**: Spam detection and automatic actions
- **Clearwarnings**: Reset user warnings with admin command

### 🎫 Ticket System
- **Interactive Menu**: `/sendticketmenu` for easy ticket creation
- **Multiple Categories**: Buy, Support, Reward, Other (fully customizable)
- **Additional Details Form**: Optional modal for users to provide extra information
- **Admin Controls**: Claim, record, and complete tickets
- **Auto-closing**: Inactive ticket management
- **Fully Configurable**: All messages, buttons, and categories via `config.json`
- **Professional Formatting**: Clean welcome messages with form data displayed

### 🎁 Giveaway System
- **Start/End/Reroll**: Full giveaway lifecycle management
- **Real-time Counter**: Live participant tracking
- **Automated Winners**: Random selection with DM notifications
- **Flexible Duration**: Support for various time formats (1h, 30m, 2d)

### 📊 Analytics & Statistics
- **Invite Tracking**: `/invites` - User invite statistics
- **Leaderboards**: `/invites-leaderboard` - Top inviters ranking
- **Role Stats**: `/rolestats` - Member count per role
- **Server Info**: `/serverinfo` - Detailed server statistics
- **User Info**: `/userinfo` - Comprehensive user profiles

### 🎮 Minecraft Integration
- **Profile Rendering**: Beautiful profile images with capes and skins
- **Hypixel Stats**: Detailed game statistics and rankings
- **Name History**: Track username changes
- **Cape Detection**: Identify official, OptiFine, and special capes
- **Customizable Styles**: Multiple rendering options

### 🔐 Enterprise Security
- **Rate Limiting**: Prevent command spam and abuse
- **Anti-Spam**: Message flooding, duplicate, mention, and link detection
- **Anti-Raid**: Join pattern analysis and server lockdown
- **Blacklist/Whitelist**: User, guild, and role-based access control
- **Configurable Thresholds**: All security parameters in `config.json`

### 💾 Database & Encryption
- **Enmap-based**: Persistent, file-based storage
- **AES-256-GCM**: Military-grade encryption for sensitive data
- **Auto-cleanup**: Expired entry removal
- **Secure Collections**: Separate encrypted storage for passwords, tokens, etc.

### 📝 Logging & Monitoring
- **Webhook Reporting**: Error logs sent to Discord webhook
- **Command Auditing**: Every interaction logged to designated channel
- **Structured Errors**: Custom error classes for detailed reporting
- **Debug Mode**: Configurable logging levels

---

## Requirements

| Requirement | Version | Notes |
|---|---|---|
| **Node.js** | v16+ | LTS recommended |
| **npm** | Latest | Included with Node.js |
| **Discord Bot Token** | - | From Discord Developer Portal |
| **Discord Intents** | - | Guilds, Guild Members, Guild Messages, Message Content, Guild Message Reactions, Guild Presences |

---

## Installation

### Step 1: Clone Repository
```bash
git clone <repository-url>
cd <project-directory>
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Create Configuration
```bash
cp config.example.json config.json
```

### Step 4: Edit Configuration
Open `config.json` and fill in all required fields:
- Bot token and IDs
- Channel and role IDs
- API keys
- Encryption key (64-character hex string)

### Step 5: Run Bot
```bash
node index.js
```

---

## Configuration Guide

### Bot Settings
```json
{
  "bot": {
    "token": "YOUR_BOT_TOKEN",
    "clientId": "YOUR_CLIENT_ID",
    "guildId": "YOUR_GUILD_ID",
    "prefix": "!",
    "status": {
      "activities": [
        { "text": "your Server", "type": "LISTENING" }
      ]
    }
  }
}
```

### Channel Configuration
```json
{
  "channels": {
    "welcome": "CHANNEL_ID",
    "log": "CHANNEL_ID",
    "errorWebhook": "WEBHOOK_URL",
    "review": "CHANNEL_ID",
    "roleMenu": "CHANNEL_ID"
  }
}
```

### Role Configuration
```json
{
  "roles": {
    "giveaway": "ROLE_ID",
    "drop": "ROLE_ID",
    "update": "ROLE_ID",
    "ticketAccess": "ROLE_ID",
    "shop": "ROLE_ID",
    "buyer": "ROLE_ID"
  }
}
```

### Security Settings
All security parameters are configurable in `config.json`:
- Rate limiting thresholds
- Anti-spam detection levels
- Anti-raid sensitivity
- Warning system thresholds

### Ticket System Configuration
```json
{
  "ticketSystem": {
    "categoryName": "Tickets",
    "channelNameTemplate": "ticket-{username}",
    "menu": {
      "title": "Support Ticket",
      "categories": [
        {
          "label": "🛒 Purchase",
          "value": "buy",
          "description": "For purchase inquiries or order follow-ups",
          "detailedDescription": "Do you need more information about your purchase?",
          "requiresDetails": true
        },
        {
          "label": "🛠️ Support",
          "value": "support",
          "description": "Report an issue or get help",
          "detailedDescription": "Do you need technical support or assistance?",
          "requiresDetails": true
        },
        {
          "label": "🎁 Claim Reward",
          "value": "reward",
          "description": "Request prizes or gifts",
          "detailedDescription": "Do you need help claiming your reward?",
          "requiresDetails": true
        },
        {
          "label": "❓ Other",
          "value": "other",
          "description": "For any other requests",
          "detailedDescription": "Do you need additional assistance?",
          "requiresDetails": false
        }
      ]
    }
  }
}
```

---

## Running the Bot

```bash
node index.js
```

**Expected Output:**
```
✅ Configuration loaded successfully
✅ Database initialized
✅ Bot connected to Discord
✅ Slash commands registered
```

---

## Commands Reference

### 🛡️ Moderation Commands

| Command | Usage | Permission | Description |
|---|---|---|---|
| `/warn` | `/warn <user> <reason>` | Moderate Members | Issue a warning to user |
| `/clear` | `/clear <amount> [user]` | Manage Messages | Delete messages |
| `/kick` | `/kick <user> <reason>` | Kick Members | Remove user from server |
| `/ban` | `/ban <user> <reason> [days]` | Ban Members | Ban user permanently |
| `/unban` | `/unban <userid> <reason>` | Ban Members | Unban user |
| `/addbadword` | `/addbadword <word>` | Administrator | Add to filter |
| `/removebadword` | `/removebadword <word>` | Administrator | Remove from filter |
| `/listbadwords` | `/listbadwords` | Administrator | View all filtered words |
| `/clearwarnings` | `/clearwarnings <user>` | Moderate Members | Reset user warnings |

### 🎫 Ticket Commands

| Command | Usage | Permission | Description |
|---|---|---|---|
| `/sendticketmenu` | `/sendticketmenu` | Manage Channels | Deploy ticket creation menu |

**Ticket Buttons:**
- **Close Ticket** - User can close their ticket
- **Claim Ticket** - Admin can claim ticket
- **Record Order** - Admin can record order
- **Complete Order** - Admin can mark as complete

### 🎁 Giveaway Commands

| Command | Usage | Permission | Description |
|---|---|---|---|
| `/start-giveaway` | `/start-giveaway <channel> <duration> <winners> <prize>` | Manage Messages | Start new giveaway |
| `/end-giveaway` | `/end-giveaway <messageid>` | Manage Messages | End giveaway early |
| `/reroll-giveaway` | `/reroll-giveaway <messageid>` | Manage Messages | Select new winners |

### 📊 Analytics Commands

| Command | Usage | Permission | Description |
|---|---|---|---|
| `/invites` | `/invites <user>` | Manage Guild | Show user invite stats |
| `/invites-leaderboard` | `/invites-leaderboard` | Manage Guild | Top inviters ranking |
| `/rolestats` | `/rolestats` | Manage Roles | Member count per role |
| `/serverinfo` | `/serverinfo` | - | Server statistics |
| `/userinfo` | `/userinfo [user]` | - | User profile info |

### 🎮 Minecraft Commands

| Command | Usage | Permission | Description |
|---|---|---|---|
| `/mcinfo` | `/mcinfo <username> [price] [show_stats]` | - | Minecraft profile & stats |

### 🎨 Utility Commands

| Command | Usage | Permission | Description |
|---|---|---|---|
| `/sendrolemenu` | `/sendrolemenu` | Manage Roles | Deploy role selection menu |
| `/sendmessage` | `/sendmessage <channel\|user> [embed] [color]` | Administrator | Send custom message |

---

## Ticket System

### How It Works

1. **User initiates**: Clicks `/sendticketmenu` to see ticket categories
2. **User selects**: Chooses reason (Buy, Support, Reward, Other)
3. **Ticket created**: Private channel with user and staff
4. **Staff manages**: Can claim, record, and complete tickets
5. **Auto-close**: Inactive tickets close automatically

### Customization

All ticket messages, buttons, and categories are fully customizable in `config.json`:

```json
{
  "ticketSystem": {
    "menu": {
      "title": "Custom Title",
      "description": "Custom Description",
      "categories": [
        { "label": "Custom", "value": "custom_value", "description": "..." }
      ]
    },
    "buttons": {
      "user": {
        "closeTicket": { "label": "Custom Label", "style": "Danger" }
      }
    }
  }
}
```

---

## Security Features

### Rate Limiting
- Per-user request limits
- Per-command cooldowns
- Global rate limits
- Configurable thresholds

### Anti-Spam
- Message flooding detection
- Duplicate message detection
- Mention spam detection
- Link spam detection
- Caps lock detection
- Emoji spam detection

### Anti-Raid
- Join rate monitoring
- New account detection
- Username similarity analysis
- Automatic server lockdown
- Configurable sensitivity

### Access Control
- User blacklist/whitelist
- Guild blacklist/whitelist
- Role-based whitelist
- Admin bypass

---

## Database & Encryption

### Storage
- **Type**: Enmap (file-based)
- **Location**: `./data` directory
- **Format**: JSON with encryption

### Encryption
- **Algorithm**: AES-256-GCM
- **Key Size**: 256-bit (64-character hex)
- **Authentication**: Built-in GCM authentication
- **Collections**: Separate encrypted storage for sensitive data

### Collections
- `tickets` - Ticket information
- `warnings` - User warnings
- `giveaways` - Giveaway data
- `polls` - Poll data
- `badWords` - Filtered words
- `accounts` - Encrypted account data

---

## Logging System

### Command Logging
Every slash command interaction is logged to the configured log channel with:
- User information
- Command name and options
- Timestamp
- Execution status

### Error Logging
Errors are sent to the configured webhook with:
- Error message and stack trace
- Context information
- Timestamp
- Severity level

### Debug Mode
Enable debug logging in `config.json`:
```json
{
  "logging": {
    "level": "debug"
  }
}
```

---

## Project Structure

```
.
├── index.js                      # Entry point
├── config.json                   # Configuration (DO NOT COMMIT)
├── config.example.json           # Configuration template
├── configManager.js              # Config loader & validator
├── package.json                  # Dependencies
│
├── src/
│   ├── commands.js               # Slash command handlers
│   ├── handlers.js               # Button, modal, select handlers
│   ├── events.js                 # Discord event handlers
│   ├── utils.js                  # Utility functions
│   ├── database.js               # Enmap collections
│   ├── encryption.js             # AES-256-GCM encryption
│   ├── constants.js              # System constants
│   ├── commandLogger.js          # Command audit logging
│   │
│   ├── security/
│   │   ├── SecurityManager.js    # Central security coordinator
│   │   ├── RateLimiter.js        # Rate limiting
│   │   ├── AntiSpam.js           # Spam detection
│   │   └── AntiRaid.js           # Raid detection
│   │
│   ├── cache/
│   │   └── CacheManager.js       # Caching system
│   │
│   ├── errors/
│   │   └── BotError.js           # Custom error classes
│   │
│   └── utils/
│       ├── LoggerUtils.js        # Error logging
│       ├── InteractionUtils.js   # Interaction helpers
│       └── modules/
│           ├── hypixel.js        # Hypixel API
│           ├── mojang.js         # Mojang API
│           └── warnings.js       # Warning system
│
└── data/                         # Database files (auto-created)
```

---

## Troubleshooting

### Bot Won't Start
**Problem**: `Error: Invalid token`
**Solution**: Check `config.json` for correct bot token

**Problem**: `Error: Cannot find module`
**Solution**: Run `npm install` to install dependencies

### Commands Not Showing
**Problem**: Slash commands not appearing
**Solution**: 
1. Ensure bot has `applications.commands` scope
2. Check `guildId` in config
3. Restart bot after configuration changes

### Database Errors
**Problem**: `Error: Encryption key must be 64 characters`
**Solution**: Generate valid key: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### Ticket System Issues
**Problem**: Tickets not creating
**Solution**:
1. Verify `ticketAccess` role exists
2. Check channel permissions
3. Ensure bot has `MANAGE_CHANNELS` permission

### Security Lockdown
**Problem**: Server locked down by anti-raid
**Solution**: Whitelist trusted users in `config.json` security settings

---

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

## فارسی

### 🌍 راهنمای فارسی

#### معرفی
**West Bot** یک ربات دیسکورد حرفه‌ای برای مدیریت سرور، تیکت، گیووی، و ابزارهای ماینکرفت است.

#### ویژگی‌های اصلی
- 🛡️ مدیریت قوی با سیستم هشدار
- 🎫 سیستم تیکت پیشرفته
- 🎁 مدیریت گیووی خودکار
- 📊 آمار و آنالیتیکس
- 🎮 ابزارهای ماینکرفت
- 🔐 رمزنگاری AES-256-GCM
- 📝 لاگینگ حرفه‌ای

#### نصب سریع
```bash
git clone https://github.com/YOUR_USERNAME/West-Bot.git
cd West-Bot
npm install
cp config.example.json config.json
# ویرایش config.json
node index.js
```

#### دستورات اصلی
- **مدیریت**: `/warn`, `/kick`, `/ban`, `/clear`
- **تیکت**: `/sendticketmenu`
- **گیووی**: `/start-giveaway`, `/end-giveaway`
- **آمار**: `/invites`, `/rolestats`, `/serverinfo`
- **ماینکرفت**: `/mcinfo`

#### تنظیمات
تمام تنظیمات در `config.json`:
- توکن و شناسه‌های بات
- شناسه‌های چنل و رول
- کلیدهای API
- پارامترهای امنیتی
- پیام‌های سیستم تیکت

#### پشتیبانی
برای مشکلات یا سؤالات، یک issue ایجاد کنید یا تماس بگیرید.

---

## License

This project is licensed under the **MIT License** - see [LICENSE](LICENSE) file for details.

---

## Support & Contact

- **Issues**: Report bugs via GitHub Issues
- **Discussions**: Join our Discord community
- **Documentation**: See CONFIG_GUIDE.md for detailed settings

---

**Made with ❤️ for Discord communities**
