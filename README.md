# 🤖 Advanced Discord Bot - West Bot v3.0.1

<div align="center">

![Discord.js](https://img.shields.io/badge/discord.js-v14-blue?logo=discord&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-v16+-green?logo=node.js&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-yellow)
![Status](https://img.shields.io/badge/Status-Active-brightgreen)
![Version](https://img.shields.io/badge/Version-3.0.1-blue)

**A professional, feature-rich Discord bot with advanced auto-moderation, 3-strike warning system, and comprehensive server management.**

[English](#english) • [فارسی](#فارسی)

</div>

---

## 🚀 What's New in v3.0.1

### ✅ Help Command Stability & UX
- Fixed `/help` handler scope so it always responds
- Ephemeral guide with interactive menu and quick links (README/SETUP/Issues)
- Help sections: moderation overview, bot settings, admin utilities, security best practices

### 📊 Polls Command
- Added `/poll` with `question`, `options` (pipe-separated), `duration`, optional `channel`
- Interactive vote buttons with emojis and end-time display
- Persistent poll storage and duplicate vote prevention

### 🔧 Internal Improvements
- Safer command processing and clearer error messaging for help flow
- Command registration refreshed to include `/help`

---

## 🚀 What's New in v3.0.0 - AUTO-MODERATION REVOLUTION

### ⚠️ 3-Strike Warning System
- **Smart Warning Tracking**: Persistent warnings with automatic escalation
- **Auto-Ban System**: 3 warnings = automatic ban with permission checks
- **Warning Count Display**: Users see their warning count (1/3, 2/3, 3/3)
- **Support Notifications**: Auto-ban alerts sent to support channel
- **DM Warnings**: Beautiful embed warnings sent to users
- **Color-Coded Warnings**: Yellow (1st), Orange (2nd), Red (3rd)

### 🚫 Enhanced Bad Words Detection
- **Database Integration**: Bad words stored in persistent Enmap database
- **Auto-Loading**: Words automatically loaded on bot startup
- **Multiple Fallback Methods**: 3 different iteration methods for compatibility
- **Real-time Updates**: Add/remove words instantly without restart
- **Import Commands**: Bulk import from text with `/importbadwords`

### 🛡️ Smart Permission Management
- **Permission Checks**: Bot verifies permissions before taking actions
- **Graceful Fallbacks**: No crashes when permissions missing
- **Admin Notifications**: Support team notified of permission issues
- **Safe Operations**: All moderation actions wrapped in safety checks

### 🧹 Simplified Startup
- **Clean Console**: Minimal, fast startup without complex animations
- **Error-Free**: Reduced startup errors with better error handling
- **Quick Loading**: Faster bot initialization with essential setup only
- **Professional Output**: Clean, readable startup messages

### 🔧 Technical Improvements
- **Enmap Database**: Persistent storage with automatic disk sync
- **Better Error Handling**: Comprehensive try-catch blocks throughout
- **Optimized Performance**: Reduced CPU usage and memory footprint
- **Enhanced Logging**: Better error tracking and debugging information

---

## English

### Overview

**West Bot v3.0.1** is a comprehensive Discord bot engineered for professional communities with advanced auto-moderation capabilities:

✨ **Advanced Auto-Moderation** - 3-strike warning system with auto-ban and smart permission handling  
🚫 **Bad Words Filter** - Database-driven detection with real-time updates and bulk import  
🎫 **Professional Ticket System** - Streamlined support, purchases, and inquiries management  
🎁 **Giveaway Management** - Automated giveaway hosting with real-time participant tracking  
📊 **Detailed Analytics** - Invite tracking, role statistics, and member insights  
🆘 **Interactive Help** - `/help` command with guided sections and quick links  
🎮 **Minecraft Integration** - Beautiful profile rendering with Hypixel statistics  
🔐 **Enterprise Security** - AES-256-GCM encrypted database with anti-spam protection  
📝 **Professional Logging** - Comprehensive audit trails and error reporting  
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
8. [Auto-Moderation System](#auto-moderation-system)
9. [Ticket System](#ticket-system)
10. [Database & Encryption](#database--encryption)
11. [Project Structure](#project-structure)
12. [Troubleshooting](#troubleshooting)
13. [Persian Guide (راهنمای فارسی)](#فارسی)

---

## Quick Start

### 1️⃣ Prerequisites
- Node.js v16+ (LTS recommended)
- npm or yarn
- Discord Bot Token
- Required Discord Intents enabled

### 2️⃣ Installation
```bash
git clone https://github.com/RezaNotHere/West-Bot.git
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

### ⚠️ 3-Strike Auto-Moderation System (NEW v3.0.0)
- **Smart Warning Tracking**: Persistent storage with automatic escalation
- **Auto-Ban on 3 Strikes**: Automatic ban after 3 warnings with permission checks
- **Warning Count Display**: Users see their warning count (1/3, 2/3, 3/3)
- **Support Notifications**: Auto-ban alerts sent to support/log channel
- **DM Warning System**: Beautiful color-coded embed warnings
- **Permission Safe**: Checks permissions before taking moderation actions

### 🚫 Enhanced Bad Words Filter (NEW v3.0.0)
- **Database Storage**: Persistent bad words in Enmap database
- **Auto-Loading**: Words automatically loaded on bot startup
- **Multiple Fallback Methods**: 3 different iteration methods for compatibility
- **Real-time Management**: Add/remove words instantly with commands
- **Bulk Import**: `/importbadwords` for mass word addition
- **Smart Detection**: Fast in-memory Set for performance

### 🛡️ Moderation & Safety
- **Comprehensive Commands**: `/warn`, `/clear`, `/kick`, `/ban`, `/unban`
- **Warning System**: Persistent storage with configurable thresholds
- **Auto-moderation**: Spam detection and automatic actions
- **Clearwarnings**: Reset user warnings with admin command
- **Permission Checks**: Safe operations with graceful fallbacks

### 🎫 Ticket System
- **Interactive Menu**: `/sendticketmenu` for easy ticket creation
- **Multiple Categories**: Buy, Support, Reward, Other (fully customizable)
- **Additional Details Form**: Optional modal for users to provide extra information
- **Admin Controls**: Claim, record, and complete tickets
- **Auto-closing**: Inactive ticket management
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

### 📊 Polls
- **Create Polls**: Interactive voting with buttons and emojis
- **Configurable Duration**: Human-readable time (`1h`, `30m`, `2d`)
- **Persistent Storage**: Polls tracked to prevent duplicate votes

### 🆘 Help Guide
- **Interactive Menu**: `/help` shows a multi-section guide
- **Direct Links**: Quick access to README, SETUP, and Issues
- **Profile Rendering**: Beautiful profile images with capes and skins
- **Hypixel Stats**: Detailed game statistics and rankings
- **Name History**: Track username changes
- **Cape Detection**: Identify official, OptiFine, and special capes
- **Customizable Styles**: Multiple rendering options

### 💾 Database & Encryption
- **Enmap-based**: Persistent, file-based storage with automatic disk sync
- **AES-256-GCM**: Military-grade encryption for sensitive data
- **Auto-cleanup**: Expired entry removal
- **Secure Collections**: Separate encrypted storage for passwords, tokens, etc.

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

## Running the Bot

```bash
node index.js
```

**Expected Output:**
```
🤖 West Bot is Online!
📊 Logged in as: WestBot!#0442
🚀 Serving 1 servers
📚 Loading banned words from database...
✅ Loaded 123 banned words from database
✅ Commands updated!
🎯 Bot is ready to serve!
```

---

## Commands Reference

### ⚠️ Auto-Moderation Commands (NEW v3.0.0)

| Command | Usage | Permission | Description |
|---|---|---|---|
| `/addbadword` | `/addbadword <word>` | Administrator | Add word to filter |
| `/removebadword` | `/removebadword <word>` | Administrator | Remove word from filter |
| `/listbadwords` | `/listbadwords` | Administrator | View all filtered words |
| `/importbadwords` | `/importbadwords <text>` | Administrator | Bulk import words |
| `/clearwarnings` | `/clearwarnings <user>` | Moderate Members | Reset user warnings |

### 🛡️ Moderation Commands

| Command | Usage | Permission | Description |
|---|---|---|---|
| `/warn` | `/warn <user> <reason>` | Moderate Members | Issue a warning to user |
| `/clear` | `/clear <amount> [user]` | Manage Messages | Delete messages |
| `/kick` | `/kick <user> <reason>` | Kick Members | Remove user from server |
| `/ban` | `/ban <user> <reason> [days]` | Ban Members | Ban user permanently |
| `/unban` | `/unban <userid> <reason>` | Ban Members | Unban user |

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

### 📊 Poll Commands

| Command | Usage | Permission | Description |
|---|---|---|---|
| `/poll` | `/poll question:"..." options:"A|B|C" duration:"1h" [channel]` | Manage Messages | Create interactive poll |

### 🆘 Help Command

| Command | Usage | Permission | Description |
|---|---|---|---|
| `/help` | `/help` | - | Interactive guide with sections and links |

| Command | Usage | Permission | Description |
|---|---|---|---|
| `/mcinfo` | `/mcinfo <username> [price] [show_stats]` | - | Minecraft profile & stats |

---

## Auto-Moderation System (NEW v3.0.0)

### 🎯 How It Works

1. **User Sends Message**: Bot analyzes message for bad words
2. **Bad Word Detected**: Message is deleted automatically
3. **Warning Added**: User receives warning (1/3, 2/3, or 3/3)
4. **DM Sent**: User gets warning embed with their warning count
5. **Support Notified**: Staff can see warning activity in logs
6. **Auto-Ban**: After 3 warnings, user is automatically banned

### ⚠️ Warning System Flow

#### **First Warning (1/3)**
```
⚠️ Warning: Inappropriate Language

Your message was deleted for containing inappropriate language.

📝 Rule Violation: Use of prohibited words is not allowed.
⚡ Action Taken: Message deleted automatically
⚠️ Warning Count: 1/3 (3 warnings = ban)
🔔 Reminder: Repeated violations will result in a ban.
```

#### **Second Warning (2/3)**
```
⚠️ Warning: Inappropriate Language (Orange color)

Your message was deleted for containing inappropriate language.

📝 Rule Violation: Use of prohibited words is not allowed.
⚡ Action Taken: Message deleted automatically
⚠️ Warning Count: 2/3 (3 warnings = ban)
🔔 Reminder: One more warning will result in a ban.
```

#### **Third Warning (3/3) - Auto-Ban**
```
🔨 USER AUTO-BANNED (Red embed to support)

User has been automatically banned after 3 warnings.

👤 Banned User: User#1234 (123456789)
⚠️ Warning Count: 3/3
📝 Reason: Inappropriate language (bad words)
🔧 Action: Auto-ban (3 warnings reached)
📅 Date: Today at 3:15 PM
```

### 🚫 Bad Words Management

#### **Database Integration**
- **Persistent Storage**: Words saved in `./data/bannedWords.json`
- **Auto-Loading**: Automatically loaded on bot startup
- **Real-time Updates**: Add/remove words without restart
- **Bulk Import**: Mass import with `/importbadwords`

#### **Import Example**
```bash
/importbadwords text: "bad,words,here, inappropriate,language"
```

### 🛡️ Safety Features

#### **Permission Checks**
- **Ban Verification**: Bot checks BanMembers permission before banning
- **Graceful Fallback**: No crashes when permissions missing
- **Admin Notifications**: Support team notified of permission issues

#### **Error Handling**
- **Multiple Iteration Methods**: 3 fallback methods for database compatibility
- **Clean Console**: Simplified startup with minimal errors
- **Comprehensive Logging**: Better error tracking and debugging

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

## Database & Encryption

### Storage
- **Type**: Enmap (file-based) with automatic disk persistence
- **Location**: `./data` directory
- **Format**: JSON with encryption for sensitive collections

### Encryption
- **Algorithm**: AES-256-GCM
- **Key Size**: 256-bit (64-character hex)
- **Authentication**: Built-in GCM authentication
- **Collections**: Separate encrypted storage for sensitive data

### Collections
- `bannedWords` - Filtered words (persistent)
- `warnings` - User warnings (encrypted)
- `tickets` - Ticket information (encrypted)
- `giveaways` - Giveaway data
- `polls` - Poll data

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
│   ├── utils.js                  # Utility functions with loadBadWords()
│   ├── database.js               # Enmap collections with persistence
│   ├── encryption.js             # AES-256-GCM encryption
│   ├── constants.js              # System constants
│   ├── commandLogger.js          # Command audit logging
│   ├── spamDetection.js          # Spam detection system
│   │
│   ├── security/
│   │   ├── OptimizedSecurityManager.js  # High-performance security coordinator
│   │   ├── EnhancedSecurityManager.js   # Full-featured security manager
│   │   ├── EnhancedRateLimiter.js       # Advanced rate limiting
│   │   ├── EnhancedAntiSpam.js          # Advanced anti-spam
│   │   ├── InputValidator.js            # Input validation system
│   │   ├── SecurityCommands.js         # Security management commands
│   │   └── ... (other security modules)
│   │
│   ├── utils/
│   │   └── LoggerUtils.js        # Error logging system
│   │
│   └── errors/
│       └── BotError.js           # Custom error classes
│
└── data/                         # Database files (auto-created)
    ├── bannedWords.json          # Bad words database
    ├── warnings.json             # User warnings
    └── ...                       # Other collections
```

---

## Troubleshooting

### Bot Won't Start
**Problem**: `Error: Invalid token`
**Solution**: Check `config.json` for correct bot token

**Problem**: `Error: Cannot find module 'enmap'`
**Solution**: Run `npm install enmap` to install missing dependency

### Bad Words Not Working
**Problem**: Bad words not being detected
**Solution**: 
1. Check console for "Loaded X banned words" message
2. Use `/listbadwords` to verify words are loaded
3. Add words with `/addbadword` or `/importbadwords`

### Auto-Ban Not Working
**Problem**: Users not being banned after 3 warnings
**Solution**:
1. Verify bot has BanMembers permission
2. Check support channel for permission error messages
3. Ensure guild ID is correct in config

### Database Errors
**Problem**: `Error: db.bannedWords is not iterable`
**Solution**: This is normal on first startup - bot will retry with fallback methods

### Permission Issues
**Problem**: `Missing Permissions` errors
**Solution**: 
1. Give bot BanMembers permission in server settings
2. Check bot role has proper permissions
3. Verify channel permissions for logging

---

## فارسی

### 🌍 راهنمای فارسی

#### معرفی v3.0.1
**West Bot v3.0.1** یک ربات دیسکورد حرفه‌ای با سیستم خودکار مدیریتی پیشرفته است:

#### ویژگی‌های جدید v3.0.1
- ✅ **رفع مشکل دستور /help**: نمایش منوی راهنما و لینک‌های سریع به صورت اپهمرال
- 📊 **افزودن دستور نظرسنجی**: `/poll` با گزینه‌های جداشده با `|` و مدت‌زمان قابل تنظیم
- 🔧 **بهبود داخلی**: هندلرها و لاگ‌ها پایدارتر و خواناتر

#### ویژگی‌های جدید v3.0.0
- ⚠️ **سیستم 3 اخطاری**: هشدار خودکار با بن بعد از 3 اخطار
- 🚫 **فیلتر کلمات بد**: ذخیره در دیتابیس با لود خودکار
- 🛡️ **چک مجوزها**: بررسی دسترسی قبل از عملیات مدیریتی
- 🧹 **استارتاپ ساده**: راه‌اندازی سریع و بدون خطا

#### ویژگی‌های اصلی
- 🎫 سیستم تیکت پیشرفته
- 🎁 مدیریت گیووی خودکار
- 📊 آمار و آنالیتیکس
- 🎮 ابزارهای ماینکرفت
- 🔐 رمزنگاری AES-256-GCM
- 📝 لاگینگ حرفه‌ای

#### نصب سریع
```bash
git clone https://github.com/RezaNotHere/West-Bot.git
cd West-Bot
npm install
cp config.example.json config.json
# ویرایش config.json
node index.js
```

#### دستورات اصلی v3.0.1
- **مدیریت کلمات بد**: `/addbadword`, `/removebadword`, `/listbadwords`, `/importbadwords`
- **سیستم اخطار**: `/warn`, `/clearwarnings`
- **مدیریت**: `/kick`, `/ban`, `/clear`
- **تیکت**: `/sendticketmenu`
- **گیووی**: `/start-giveaway`, `/end-giveaway`
- **آمار**: `/invites`, `/rolestats`, `/serverinfo`
- **ماینکرفت**: `/mcinfo`
- **نظرسنجی**: `/poll`
- **راهنما**: `/help`

#### سیستم خودکار مدیریتی
1. **کاربر فوش می‌دهد**: پیام حذف می‌شود
2. **اخطار داده می‌شود**: کاربر DM اخطار دریافت می‌کند (1/3, 2/3, 3/3)
3. **3 اخطار = بن**: کاربر اتوماتیک بن می‌شود
4. **اطلاع به تیم پشتیبانی**: گزارش بن به کانال support ارسال می‌شود

#### تنظیمات
تمام تنظیمات در `config.json`:
- توکن و شناسه‌های بات
- شناسه‌های چنل و رول
- کلیدهای API
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

**Made with ❤️ for Discord communities - Advanced Auto-Moderation Edition v3.0.1**
