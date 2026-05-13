#!/bin/bash

# Mira Backup Script
# Backs up PostgreSQL database and workspace data
# Usage: ./scripts/backup.sh [backup_name]

set -e  # Exit on error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_ROOT/backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="${1:-backup_$TIMESTAMP}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================================================="
echo "  Mira Backup Script"
echo "=========================================================================="
echo ""
echo "Backup name: $BACKUP_NAME"
echo "Backup directory: $BACKUP_DIR"
echo ""

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR/$BACKUP_NAME"

# Check if Docker Compose is running
if ! docker-compose -f "$PROJECT_ROOT/docker-compose.yml" ps postgres | grep -q "Up"; then
    echo -e "${RED}Error: PostgreSQL container is not running${NC}"
    echo "Start services with: docker-compose up -d"
    exit 1
fi

# Load environment variables
if [ -f "$PROJECT_ROOT/.env" ]; then
    source "$PROJECT_ROOT/.env"
else
    echo -e "${YELLOW}Warning: .env file not found, using defaults${NC}"
    POSTGRES_USER="${POSTGRES_USER:-mira}"
    POSTGRES_DB="${POSTGRES_DB:-mira}"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 1: Backing up PostgreSQL database"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Backup PostgreSQL database
docker-compose -f "$PROJECT_ROOT/docker-compose.yml" exec -T postgres \
    pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
    --format=custom \
    --compress=9 \
    --no-owner \
    --no-acl \
    > "$BACKUP_DIR/$BACKUP_NAME/database.dump"

if [ $? -eq 0 ]; then
    DB_SIZE=$(du -h "$BACKUP_DIR/$BACKUP_NAME/database.dump" | cut -f1)
    echo -e "${GREEN}✓ Database backup complete ($DB_SIZE)${NC}"
else
    echo -e "${RED}✗ Database backup failed${NC}"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 2: Backing up workspace data"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Backup workspace volume
WORKSPACE_CONTAINER=$(docker-compose -f "$PROJECT_ROOT/docker-compose.yml" ps -q api)
if [ -n "$WORKSPACE_CONTAINER" ]; then
    docker cp "$WORKSPACE_CONTAINER:/workspace" "$BACKUP_DIR/$BACKUP_NAME/workspace"
    if [ $? -eq 0 ]; then
        WORKSPACE_SIZE=$(du -sh "$BACKUP_DIR/$BACKUP_NAME/workspace" | cut -f1)
        echo -e "${GREEN}✓ Workspace backup complete ($WORKSPACE_SIZE)${NC}"
    else
        echo -e "${RED}✗ Workspace backup failed${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠ API container not found, skipping workspace backup${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 3: Creating backup metadata"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Create metadata file
cat > "$BACKUP_DIR/$BACKUP_NAME/metadata.json" <<EOF
{
  "backup_name": "$BACKUP_NAME",
  "timestamp": "$TIMESTAMP",
  "date": "$(date -u +"%Y-%m-%d %H:%M:%S UTC")",
  "postgres_version": "$(docker-compose -f "$PROJECT_ROOT/docker-compose.yml" exec -T postgres psql -U "$POSTGRES_USER" -t -c 'SELECT version();' | head -1 | xargs)",
  "database": "$POSTGRES_DB",
  "user": "$POSTGRES_USER"
}
EOF

echo -e "${GREEN}✓ Metadata created${NC}"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 4: Compressing backup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Compress backup
cd "$BACKUP_DIR"
tar -czf "$BACKUP_NAME.tar.gz" "$BACKUP_NAME"
rm -rf "$BACKUP_NAME"

ARCHIVE_SIZE=$(du -h "$BACKUP_NAME.tar.gz" | cut -f1)
echo -e "${GREEN}✓ Backup compressed ($ARCHIVE_SIZE)${NC}"

echo ""
echo "=========================================================================="
echo "  Backup Complete"
echo "=========================================================================="
echo ""
echo -e "${GREEN}Backup saved to: $BACKUP_DIR/$BACKUP_NAME.tar.gz${NC}"
echo ""
echo "To restore this backup:"
echo "  ./scripts/restore.sh $BACKUP_NAME.tar.gz"
echo ""
