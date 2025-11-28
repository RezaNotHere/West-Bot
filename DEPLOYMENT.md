# West Bot - Deployment Guide

This guide covers deploying West Bot to production environments.

## Deployment Options

### Option 1: Local Server / VPS

#### Requirements
- Linux server (Ubuntu 20.04+ recommended)
- Node.js v16+
- SSH access
- Domain name (optional)

#### Steps

1. **Connect to Server**
```bash
ssh user@your-server-ip
```

2. **Install Node.js**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

3. **Clone Repository**
```bash
cd /opt
sudo git clone https://github.com/RezaNotHere/West-Bot.git
cd West-Bot
sudo chown -R $USER:$USER .
```

4. **Install Dependencies**
```bash
npm install
```

5. **Configure Bot**
```bash
cp config.example.json config.json
# Edit config.json with your settings
nano config.json
```

6. **Setup PM2 (Process Manager)**
```bash
npm install -g pm2
pm2 start index.js --name "west-bot"
pm2 startup
pm2 save
```

7. **Verify Bot is Running**
```bash
pm2 logs west-bot
```

#### Monitoring
```bash
# Check status
pm2 status

# View logs
pm2 logs west-bot

# Restart bot
pm2 restart west-bot

# Stop bot
pm2 stop west-bot
```

### Option 2: Docker

#### Dockerfile
Create a `Dockerfile` in the project root:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy bot files
COPY . .

# Run bot
CMD ["node", "index.js"]
```

#### Docker Compose
Create a `docker-compose.yml`:

```yaml
version: '3.8'

services:
  west-bot:
    build: .
    container_name: west-bot
    restart: always
    volumes:
      - ./config.json:/app/config.json
      - ./data:/app/data
    environment:
      - NODE_ENV=production
```

#### Deploy with Docker
```bash
# Build image
docker build -t west-bot .

# Run container
docker run -d --name west-bot -v $(pwd)/config.json:/app/config.json -v $(pwd)/data:/app/data west-bot

# Or use Docker Compose
docker-compose up -d
```

### Option 3: Heroku (Free tier deprecated, but alternative platforms)

#### Using Railway.app
1. Connect GitHub account to Railway
2. Select West-Bot repository
3. Add environment variables
4. Deploy

#### Using Render.com
1. Connect GitHub account
2. Create new Web Service
3. Select West-Bot repository
4. Configure environment
5. Deploy

### Option 4: Replit

1. Fork repository on GitHub
2. Import to Replit
3. Create `.env` file with configuration
4. Run `npm install`
5. Click "Run"
6. Use Replit's Always On feature (paid)

## Production Configuration

### Environment Variables

Create a `.env` file (if using environment variables instead of config.json):

```env
BOT_TOKEN=your_token_here
CLIENT_ID=your_client_id
GUILD_ID=your_guild_id
ENCRYPTION_KEY=your_encryption_key
NODE_ENV=production
```

### Security Best Practices

1. **Never commit sensitive data**
   - Use `.gitignore` for `config.json`
   - Use environment variables for secrets
   - Rotate tokens regularly

2. **Use strong encryption**
   - Generate strong encryption key
   - Store securely
   - Never share

3. **Enable logging**
   - Set up error webhook
   - Monitor logs regularly
   - Archive old logs

4. **Regular backups**
   - Backup database regularly
   - Store backups securely
   - Test restore procedures

5. **Keep dependencies updated**
   ```bash
   npm update
   npm audit fix
   ```

## Monitoring & Maintenance

### Health Checks

Monitor bot status:
```bash
# Check if bot is online
# Use Discord to verify bot is responding to commands
# Check logs for errors
```

### Log Management

View logs:
```bash
# PM2
pm2 logs west-bot

# Docker
docker logs west-bot

# Systemd
journalctl -u west-bot -f
```

### Database Maintenance

```bash
# Backup database
cp -r data/ data.backup.$(date +%Y%m%d)

# Check database integrity
# Monitor data/ directory size
```

### Performance Monitoring

Monitor resource usage:
```bash
# CPU and Memory
top
# or
htop

# Disk space
df -h

# Network
netstat -an
```

## Troubleshooting

### Bot Won't Start
1. Check Node.js version: `node --version`
2. Check dependencies: `npm install`
3. Verify config.json syntax
4. Check logs for errors

### Bot Crashes
1. Check error logs
2. Verify Discord token is valid
3. Check for memory leaks
4. Monitor resource usage

### Commands Not Working
1. Verify bot has permissions
2. Check slash commands are registered
3. Wait for Discord to sync commands
4. Restart bot

### Database Issues
1. Check data/ directory exists
2. Verify write permissions
3. Check disk space
4. Restore from backup if needed

## Scaling

### For Large Servers

1. **Optimize database**
   - Archive old data
   - Clean up expired entries
   - Monitor database size

2. **Optimize code**
   - Cache frequently accessed data
   - Reduce database queries
   - Use efficient algorithms

3. **Distribute load**
   - Use multiple bot instances (sharding)
   - Load balance requests
   - Separate concerns

4. **Monitor performance**
   - Track response times
   - Monitor error rates
   - Analyze logs

## Updating Bot

### Update Procedure

1. **Backup current installation**
```bash
cp -r /opt/West-Bot /opt/West-Bot.backup
```

2. **Pull latest changes**
```bash
cd /opt/West-Bot
git pull origin main
```

3. **Install new dependencies**
```bash
npm install
```

4. **Restart bot**
```bash
pm2 restart west-bot
```

5. **Verify update**
```bash
pm2 logs west-bot
```

### Rollback if Needed
```bash
# Stop bot
pm2 stop west-bot

# Restore backup
rm -rf /opt/West-Bot
cp -r /opt/West-Bot.backup /opt/West-Bot

# Restart
pm2 start west-bot
```

## Disaster Recovery

### Database Backup

```bash
# Daily backup script
#!/bin/bash
BACKUP_DIR="/backups/west-bot"
mkdir -p $BACKUP_DIR
cp -r /opt/West-Bot/data $BACKUP_DIR/data.$(date +%Y%m%d)
# Keep only last 30 days
find $BACKUP_DIR -type d -mtime +30 -exec rm -rf {} \;
```

### Configuration Backup

```bash
# Backup config
cp /opt/West-Bot/config.json /backups/west-bot/config.json.$(date +%Y%m%d)
```

### Recovery Procedure

1. Stop the bot
2. Restore database from backup
3. Verify data integrity
4. Restart bot
5. Test functionality

## Support

For deployment issues:
- Check logs for error messages
- Review troubleshooting section
- Open GitHub issue with details
- Include environment information

---

**Happy deploying! 🚀**
