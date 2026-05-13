#!/bin/bash

# Mira Restore Script
# Restores PostgreSQL database and workspace data from backup
# Usage: ./scripts/restore.sh <backup_file.tar.gz>

set -e  # Exit on error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_ROOT/backups}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check arguments
if [ -z "$1" ]; then
    echo -e "${RED}Error: No backup file specified${NC}"
    echo "Usage: $0 <backup_file.tar.gz>"
    echo ""
    echo "Available backups:"
    ls -1 "$BACKUP_DIR"/*.tar.gz 2>/dev/null || echo "  No backups found in $BACKUP_DIR"
    exit 1
fi

BACKUP_FILE="$1"

# If not absolute path, prepend backup directory
if [[ "$BACKUP_FILE" != /* ]]; then
    BACKUP_FILE="$BACKUP_DIR/$BACKUP_FILE"
fi

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}Error: Backup file not found: $BACKUP_FILE${NC}"
    exit 1
fi

echo "=========================================================================="
echo "  Mira Restore Script"
echo "=========================================================================="
echo ""
echo "Backup file: $BACKUP_FILE"
echo ""
echo -e "${YELLOW}WARNING: This will overwrite existing data!${NC}"
echo ""
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Restore cancelled"
    exit 0
fi

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

# Extract backup
TEMP_DIR=$(mktemp -d)
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 1: Extracting backup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

tar -xzf "$BACKUP_FILE" -C "$TEMP_DIR"
BACKUP_NAME=$(ls "$TEMP_DIR")
BACKUP_PATH="$TEMP_DIR/$BACKUP_NAME"

echo -e "${GREEN}✓ Backup extracted${NC}"

# Show metadata
if [ -f "$BACKUP_PATH/metadata.json" ]; then
    echo ""
    echo "Backup metadata:"
    cat "$BACKUP_PATH/metadata.json" | python3 -m json.tool 2>/dev/null || cat "$BACKUP_PATH/metadata.json"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 2: Restoring PostgreSQL database"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Drop and recreate database
echo "Dropping existing database..."
docker-compose -f "$PROJECT_ROOT/docker-compose.yml" exec -T postgres \
    psql -U "$POSTGRES_USER" -d postgres \
    -c "DROP DATABASE IF EXISTS $POSTGRES_DB;" \
    -c "CREATE DATABASE $POSTGRES_DB OWNER $POSTGRES_USER;"

echo "Restoring database from backup..."
docker-compose -f "$PROJECT_ROOT/docker-compose.yml" exec -T postgres \
    pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
    --no-owner \
    --no-acl \
    < "$BACKUP_PATH/database.dump"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Database restored successfully${NC}"
else
    echo -e "${RED}✗ Database restore failed${NC}"
    rm -rf "$TEMP_DIR"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 3: Restoring workspace data"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -d "$BACKUP_PATH/workspace" ]; then
    WORKSPACE_CONTAINER=$(docker-compose -f "$PROJECT_ROOT/docker-compose.yml" ps -q api)

    if [ -n "$WORKSPACE_CONTAINER" ]; then
        # Clear existing workspace
        docker-compose -f "$PROJECT_ROOT/docker-compose.yml" exec -T api \
            sh -c "rm -rf /workspace/* /workspace/.*" 2>/dev/null || true

        # Copy workspace data
        docker cp "$BACKUP_PATH/workspace/." "$WORKSPACE_CONTAINER:/workspace/"

        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ Workspace data restored${NC}"
        else
            echo -e "${RED}✗ Workspace restore failed${NC}"
            rm -rf "$TEMP_DIR"
            exit 1
        fi
    else
        echo -e "${YELLOW}⚠ API container not found, skipping workspace restore${NC}"
    fi
else
    echo -e "${YELLOW}⚠ No workspace data in backup${NC}"
fi

# Cleanup
rm -rf "$TEMP_DIR"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 4: Restarting services"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

docker-compose -f "$PROJECT_ROOT/docker-compose.yml" restart api web

echo -e "${GREEN}✓ Services restarted${NC}"

echo ""
echo "=========================================================================="
echo "  Restore Complete"
echo "=========================================================================="
echo ""
echo -e "${GREEN}Data restored from: $BACKUP_FILE${NC}"
echo ""
echo "Services should be available shortly at:"
echo "  - Web: http://localhost"
echo "  - API: http://localhost:8000"
echo ""
