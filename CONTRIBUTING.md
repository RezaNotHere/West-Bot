# Contributing to West Bot

Thank you for your interest in contributing to West Bot! This document provides guidelines and instructions for contributing.

## Code of Conduct

- Be respectful and professional
- Provide constructive feedback
- Help others learn and grow
- Report issues responsibly

## How to Contribute

### 1. Reporting Bugs

**Before submitting a bug report:**
- Check if the bug has already been reported
- Verify the bug exists in the latest version
- Gather as much information as possible

**When submitting a bug report, include:**
- Clear description of the issue
- Steps to reproduce
- Expected behavior
- Actual behavior
- Your environment (Node.js version, OS, etc.)
- Error messages or logs
- Screenshots if applicable

### 2. Suggesting Features

**Before suggesting a feature:**
- Check if it has already been suggested
- Consider if it aligns with the bot's purpose
- Think about implementation complexity

**When suggesting a feature, include:**
- Clear description of the feature
- Use cases and benefits
- Possible implementation approach
- Examples of how it would work

### 3. Submitting Code Changes

#### Fork and Clone
```bash
# Fork the repository on GitHub
# Clone your fork
git clone https://github.com/YOUR_USERNAME/West-Bot.git
cd West-Bot
```

#### Create a Branch
```bash
# Create a feature branch
git checkout -b feature/your-feature-name

# Or for bug fixes
git checkout -b fix/bug-description
```

#### Make Changes
- Follow the existing code style
- Write clear, descriptive commit messages
- Keep commits focused and atomic
- Add comments for complex logic
- Update documentation as needed

#### Commit Guidelines
```bash
# Good commit message
git commit -m "Add ticket details form system"

# Include description if needed
git commit -m "Fix: Ticket close message ordering

- Move close message to end of ticket
- Update database cleanup logic
- Add error handling for edge cases"
```

#### Push and Create Pull Request
```bash
# Push your branch
git push origin feature/your-feature-name

# Create a pull request on GitHub
# Provide clear description of changes
# Reference any related issues
```

## Code Style Guide

### JavaScript/Node.js

#### Naming Conventions
```javascript
// Constants
const MAX_WARNINGS = 3;
const TICKET_ACCESS_ROLE_ID = config.roles.ticketAccess;

// Functions
async function createTicketChannel(guild, user, reason) {
  // Implementation
}

// Variables
let ticketCount = 0;
const userWarnings = new Map();

// Classes
class SecurityManager {
  // Implementation
}
```

#### Formatting
```javascript
// Use 4 spaces for indentation
// Use semicolons
// Use const by default, let when needed, avoid var

// Good
const config = require('./configManager');
const { EmbedBuilder } = require('discord.js');

async function handleCommand(interaction) {
    try {
        // Implementation
    } catch (error) {
        console.error('Error:', error);
    }
}

// Bad
var config = require('./configManager')
let { EmbedBuilder } = require('discord.js')

function handleCommand(interaction){
    // Missing error handling
}
```

#### Comments
```javascript
// Use comments for complex logic
// Explain WHY, not WHAT

// Good
// Check if user already has an active ticket to prevent duplicates
if (db.tickets.has(user.id)) {
    return interaction.reply({ content: 'You already have an active ticket' });
}

// Bad
// Check if user has ticket
if (db.tickets.has(user.id)) {
    // return error
    return interaction.reply({ content: 'Error' });
}
```

### JSON Configuration

```json
{
  "section": {
    "_comment": "Descriptive comment about this section",
    "setting": "value",
    "_setting_help": "Explanation of what this setting does"
  }
}
```

## Testing

Before submitting a pull request:

1. **Test locally**
   ```bash
   node index.js
   ```

2. **Test all affected features**
   - Create tickets
   - Run commands
   - Check logging
   - Verify database operations

3. **Check for errors**
   - No console errors
   - No unhandled rejections
   - Proper error messages

4. **Test edge cases**
   - Empty inputs
   - Very long inputs
   - Special characters
   - Concurrent operations

## Documentation

### Update Documentation When:
- Adding new features
- Changing existing functionality
- Fixing bugs that affect usage
- Adding new configuration options

### Documentation Files:
- **README.md** - Main documentation
- **SETUP.md** - Setup and installation guide
- **CHANGELOG.md** - Version history
- **Code comments** - Inline documentation

### Documentation Style:
```markdown
## Feature Name

Brief description of the feature.

### How It Works
Explain the functionality.

### Configuration
```json
{
  "setting": "value"
}
```

### Example
Show how to use it.

### Troubleshooting
Common issues and solutions.
```

## Pull Request Process

1. **Before submitting:**
   - Update documentation
   - Add/update comments
   - Test thoroughly
   - Check for console errors

2. **Pull request description:**
   ```markdown
   ## Description
   Brief description of changes

   ## Type of Change
   - [ ] Bug fix
   - [ ] New feature
   - [ ] Documentation update
   - [ ] Performance improvement

   ## Related Issues
   Fixes #123

   ## Testing
   Describe how you tested this

   ## Checklist
   - [ ] Code follows style guidelines
   - [ ] Documentation updated
   - [ ] No new warnings generated
   - [ ] Tests pass locally
   ```

3. **Review process:**
   - Code review by maintainers
   - Feedback and suggestions
   - Requested changes
   - Approval and merge

## Development Setup

### Prerequisites
- Node.js v16+
- npm or yarn
- Git
- Text editor (VS Code recommended)

### Setup
```bash
# Clone repository
git clone https://github.com/RezaNotHere/West-Bot.git
cd West-Bot

# Install dependencies
npm install

# Create config file
cp config.example.json config.json

# Edit config.json with test values
# Run the bot
node index.js
```

## Project Structure

```
West-Bot/
├── src/
│   ├── commands.js          # Slash commands
│   ├── handlers.js          # Button/modal handlers
│   ├── handlers/            # Handler modules
│   ├── utils.js             # Utility functions
│   ├── database.js          # Database management
│   ├── events.js            # Event handlers
│   └── security/            # Security modules
├── config.json              # Configuration (ignored in git)
├── config.example.json      # Configuration template
├── index.js                 # Bot entry point
├── README.md                # Main documentation
├── SETUP.md                 # Setup guide
├── CHANGELOG.md             # Version history
└── package.json             # Dependencies
```

## Common Tasks

### Adding a New Command

1. Add command definition in `src/commands.js`
2. Add command handler in `src/handlers.js`
3. Update documentation in README.md
4. Test the command

### Adding a New Feature

1. Create feature in appropriate file
2. Add configuration options to `config.json`
3. Add documentation
4. Update CHANGELOG.md
5. Test thoroughly

### Fixing a Bug

1. Create a test case that reproduces the bug
2. Fix the bug
3. Verify the test passes
4. Update CHANGELOG.md
5. Submit pull request

## Getting Help

- Check existing issues and discussions
- Review documentation
- Ask in pull request comments
- Contact maintainers

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Recognition

Contributors will be recognized in:
- CHANGELOG.md
- GitHub contributors page
- Project documentation

---

Thank you for contributing to West Bot! 🎉

**Happy coding!**
