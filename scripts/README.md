# Mira Scripts

Utility scripts for managing Mira deployment, backups, and operations.

---

## Scripts Overview

### quick-start.sh

**Purpose**: One-command setup and startup for Mira

**Usage**:
```bash
./scripts/quick-start.sh
```

**What it does**:
1. Checks Docker is running
2. Creates `.env` from `.env.example` (if not exists)
3. Generates secure random secrets (JWT secret, PostgreSQL password)
4. Builds Docker images
5. Starts all services
6. Waits for health checks
7. Displays access URLs and helpful commands

**When to use**:
- First time setup
- Quick local development environment
- After fresh git clone

---

### backup.sh

**Purpose**: Create full backup of database and workspace data

**Usage**:
```bash
# Automatic timestamped backup
./scripts/backup.sh

# Named backup
./scripts/backup.sh my_backup_name
```

**What it backs up**:
- PostgreSQL database (pg_dump format, compressed)
- Workspace files (all user data)
- Backup metadata (timestamp, versions, etc.)

**Output**: `backups/backup_YYYYMMDD_HHMMSS.tar.gz`

**Requirements**:
- Docker Compose services must be running
- `.env` file with database credentials

**When to use**:
- Before major updates
- Before database migrations
- Regular automated backups (cron job)
- Before restoring from another backup

---

### restore.sh

**Purpose**: Restore database and workspace from backup

**Usage**:
```bash
# List available backups
ls -lh backups/

# Restore from specific backup
./scripts/restore.sh backups/backup_20240513_120000.tar.gz

# Or just filename if in backups/ directory
./scripts/restore.sh backup_20240513_120000.tar.gz
```

**What it does**:
1. Extracts backup archive
2. Shows backup metadata
3. Asks for confirmation (will overwrite existing data)
4. Drops and recreates database
5. Restores database from dump
6. Restores workspace files
7. Restarts API and web services

**⚠️ Warning**: This will **delete all existing data** and replace with backup

**Requirements**:
- Docker Compose services must be running
- Backup file must exist
- `.env` file with database credentials

**When to use**:
- Disaster recovery
- Migrating to new server
- Reverting after bad migration
- Testing with production data snapshot

---

## Backup Strategy

### Recommended Schedule

**Local Development**:
- Manual backups before major changes

**Staging/Production**:
- **Daily**: Automated backup at 2 AM
  ```bash
  0 2 * * * cd /path/to/mira && ./scripts/backup.sh >> /var/log/mira-backup.log 2>&1
  ```
- **Weekly**: Keep Sunday backups separately
- **Monthly**: Keep first-of-month backups for 12 months

### Retention Policy

```bash
# Keep daily backups for 7 days
find backups/ -name "backup_*.tar.gz" -mtime +7 -delete

# Archive weekly backups
mkdir -p backups/weekly
find backups/ -name "backup_*Sunday*.tar.gz" -mtime -30 -exec mv {} backups/weekly/ \;

# Archive monthly backups
mkdir -p backups/monthly
find backups/ -name "backup_*01_*.tar.gz" -exec mv {} backups/monthly/ \;
```

---

## Backup Contents

### Database Dump
- Format: PostgreSQL custom format (`.dump`)
- Compression: Level 9 (maximum)
- Includes: All tables, data, indexes
- Excludes: Roles, tablespaces (for portability)

### Workspace Files
- Location: `/workspace` in API container
- Contents: User uploads, generated reports, markdown files
- Format: Directory structure preserved

### Metadata
- Backup timestamp
- PostgreSQL version
- Database name and user
- JSON format for machine parsing

### Example Backup Structure
```
backup_20240513_120000/
├── database.dump          # PostgreSQL dump (compressed)
├── workspace/             # Workspace files
│   ├── reports/
│   ├── uploads/
│   └── ...
└── metadata.json          # Backup info
```

---

## Error Handling

### Backup Errors

**PostgreSQL container not running**:
```bash
Error: PostgreSQL container is not running
Solution: docker-compose up -d
```

**Permission denied**:
```bash
Error: Permission denied
Solution: chmod +x scripts/backup.sh
```

**Disk space**:
```bash
Error: No space left on device
Solution: Clean up old backups or increase disk space
```

### Restore Errors

**Backup file not found**:
```bash
Error: Backup file not found
Solution: Check path, ensure backup exists
```

**Database connection failed**:
```bash
Error: Could not connect to database
Solution: Check services are running, verify .env credentials
```

**Version mismatch warning**:
```
Warning: Backup PostgreSQL version differs from current
Solution: Usually safe to proceed, but test carefully
```

---

## Advanced Usage

### Backup to Remote Storage

**AWS S3**:
```bash
# After backup, upload to S3
./scripts/backup.sh
aws s3 cp backups/backup_*.tar.gz s3://my-bucket/mira-backups/
```

**Rsync to remote server**:
```bash
# After backup, sync to remote
./scripts/backup.sh
rsync -avz backups/ user@remote:/backups/mira/
```

### Automated Backup with Notification

```bash
#!/bin/bash
# backup-with-notify.sh

./scripts/backup.sh
if [ $? -eq 0 ]; then
    echo "Backup successful" | mail -s "Mira Backup OK" admin@example.com
else
    echo "Backup FAILED" | mail -s "Mira Backup FAILED" admin@example.com
fi
```

### Restore to Different Environment

```bash
# Restore production backup to staging
./scripts/restore.sh production_backup.tar.gz

# Update environment-specific settings
docker-compose exec api python -c "
from mira_api.database import SessionLocal
from mira_api.config import settings
# Update any environment-specific data
"
```

### Partial Restore (Database Only)

```bash
# Extract backup
tar -xzf backups/backup_20240513_120000.tar.gz

# Restore only database
docker-compose exec -T postgres pg_restore -U mira -d mira \
    --no-owner --no-acl < backup_20240513_120000/database.dump
```

---

## Testing Scripts

### Test Backup

```bash
# Create test data
curl -X POST http://localhost:8000/auth/register \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"testpass123","name":"Test User"}'

# Create backup
./scripts/backup.sh test_backup

# Verify backup exists
ls -lh backups/test_backup.tar.gz
```

### Test Restore

```bash
# Create backup first
./scripts/backup.sh before_test

# Make some changes (add/delete data)

# Restore original state
./scripts/restore.sh backups/before_test.tar.gz

# Verify data is restored
curl http://localhost:8000/state
```

---

## Security Considerations

1. **Backup Storage**:
   - Store backups securely (encrypted at rest)
   - Restrict access to backup files (contains all user data)
   - Use separate storage location (not same server)

2. **Credentials in Backups**:
   - Database dumps don't include passwords (hashed only)
   - `.env` file NOT included in backups
   - Workspace files may contain sensitive data

3. **Backup Encryption**:
   ```bash
   # Encrypt backup
   gpg --encrypt --recipient admin@example.com backups/backup.tar.gz

   # Decrypt backup
   gpg --decrypt backups/backup.tar.gz.gpg > backup.tar.gz
   ```

4. **Access Control**:
   ```bash
   # Restrict backup directory permissions
   chmod 700 backups/
   chmod 600 backups/*.tar.gz
   ```

---

## Troubleshooting

### "Command not found"

Make scripts executable:
```bash
chmod +x scripts/*.sh
```

### "Docker daemon not running"

Start Docker:
```bash
# macOS
open -a Docker

# Linux
sudo systemctl start docker
```

### "No space left on device"

Clean up old backups:
```bash
# Remove backups older than 30 days
find backups/ -name "*.tar.gz" -mtime +30 -delete

# Or manually delete
rm backups/old_backup_*.tar.gz
```

### Backup is too large

- Exclude unnecessary workspace files
- Compress manually with higher ratio:
  ```bash
  tar -czf backup.tar.gz backup/ --use-compress-program="gzip -9"
  ```
- Clean up old data before backup

---

## Contributing

When adding new scripts:
1. Add shebang: `#!/bin/bash`
2. Include description comment block
3. Use `set -e` for error handling
4. Add usage instructions
5. Make executable: `chmod +x`
6. Document here in README

---

**Last Updated**: 2026-05-13
