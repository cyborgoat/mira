#!/bin/bash

# Mira Quick Start Script
# Sets up and starts Mira with Docker Compose

set -e  # Exit on error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "=========================================================================="
echo "  Mira Quick Start"
echo "=========================================================================="
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running${NC}"
    echo "Please start Docker Desktop and try again"
    exit 1
fi

# Check if docker-compose exists
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Error: docker-compose not found${NC}"
    echo "Please install docker-compose: https://docs.docker.com/compose/install/"
    exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 1: Environment Configuration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if .env exists
if [ ! -f "$PROJECT_ROOT/.env" ]; then
    echo ".env file not found. Creating from template..."
    cp "$PROJECT_ROOT/.env.example" "$PROJECT_ROOT/.env"

    # Generate JWT secret
    JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || cat /dev/urandom | LC_ALL=C tr -dc 'a-zA-Z0-9' | fold -w 64 | head -n 1)

    # Generate PostgreSQL password
    POSTGRES_PASSWORD=$(openssl rand -hex 16 2>/dev/null || cat /dev/urandom | LC_ALL=C tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)

    # Update .env file
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/changeme_generate_with_openssl_rand_hex_32/$JWT_SECRET/" "$PROJECT_ROOT/.env"
        sed -i '' "s/changeme_secure_password_here/$POSTGRES_PASSWORD/" "$PROJECT_ROOT/.env"
    else
        # Linux
        sed -i "s/changeme_generate_with_openssl_rand_hex_32/$JWT_SECRET/" "$PROJECT_ROOT/.env"
        sed -i "s/changeme_secure_password_here/$POSTGRES_PASSWORD/" "$PROJECT_ROOT/.env"
    fi

    echo -e "${GREEN}✓ .env file created with secure random secrets${NC}"
else
    echo -e "${GREEN}✓ .env file already exists${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 2: Building Docker Images"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd "$PROJECT_ROOT"
docker-compose build

echo -e "${GREEN}✓ Docker images built${NC}"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 3: Starting Services"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

docker-compose up -d

echo ""
echo "Waiting for services to be healthy..."
echo "(This may take 30-60 seconds for first start)"

# Wait for API health check
MAX_WAIT=60
WAIT_COUNT=0
while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
    if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
        break
    fi
    echo -n "."
    sleep 2
    WAIT_COUNT=$((WAIT_COUNT + 2))
done

echo ""

if [ $WAIT_COUNT -ge $MAX_WAIT ]; then
    echo -e "${YELLOW}⚠ Services started but health check timed out${NC}"
    echo "Check logs with: docker-compose logs"
else
    echo -e "${GREEN}✓ All services are healthy${NC}"
fi

echo ""
echo "=========================================================================="
echo "  Mira is Ready!"
echo "=========================================================================="
echo ""
echo -e "${GREEN}✓ Web Interface:${NC}  http://localhost"
echo -e "${GREEN}✓ API Server:${NC}     http://localhost:8000"
echo -e "${GREEN}✓ API Docs:${NC}       http://localhost:8000/docs"
echo ""
echo "Useful commands:"
echo "  - View logs:       docker-compose logs -f"
echo "  - Stop services:   docker-compose down"
echo "  - Restart:         docker-compose restart"
echo "  - Backup data:     ./scripts/backup.sh"
echo "  - Restore data:    ./scripts/restore.sh <backup.tar.gz>"
echo ""
echo "First time setup:"
echo "  1. Open http://localhost in your browser"
echo "  2. Register a new account"
echo "  3. Start using Mira!"
echo ""
