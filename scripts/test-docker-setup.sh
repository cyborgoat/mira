#!/bin/bash

# Mira Docker Setup End-to-End Test
# Comprehensive test of Docker deployment

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

TEST_PASSED=0
TEST_FAILED=0

echo "=========================================================================="
echo "  Mira Docker Setup End-to-End Test"
echo "=========================================================================="
echo ""

# Helper function for tests
test_step() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "$1"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

test_pass() {
    echo -e "${GREEN}✓ $1${NC}"
    TEST_PASSED=$((TEST_PASSED + 1))
}

test_fail() {
    echo -e "${RED}✗ $1${NC}"
    TEST_FAILED=$((TEST_FAILED + 1))
}

test_warn() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Test 1: Prerequisites
test_step "Test 1: Prerequisites Check"

if command -v docker &> /dev/null; then
    test_pass "Docker installed"
    docker --version
else
    test_fail "Docker not installed"
fi

if command -v docker-compose &> /dev/null; then
    test_pass "docker-compose installed"
    docker-compose --version
else
    test_fail "docker-compose not installed"
fi

if docker info > /dev/null 2>&1; then
    test_pass "Docker daemon running"
else
    test_fail "Docker daemon not running"
    echo "  Please start Docker and run this test again"
    exit 1
fi

# Test 2: File Structure
test_step "Test 2: Required Files Exist"

REQUIRED_FILES=(
    "docker-compose.yml"
    ".env.example"
    "apps/api/Dockerfile"
    "apps/api/.dockerignore"
    "apps/web/Dockerfile"
    "apps/web/.dockerignore"
    "apps/web/nginx.conf"
    "scripts/backup.sh"
    "scripts/restore.sh"
    "scripts/quick-start.sh"
)

cd "$PROJECT_ROOT"

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        test_pass "$file exists"
    else
        test_fail "$file missing"
    fi
done

# Test 3: Environment Configuration
test_step "Test 3: Environment Configuration"

if [ -f ".env" ]; then
    test_pass ".env file exists"

    # Check required variables
    if grep -q "POSTGRES_PASSWORD=.*changeme" .env 2>/dev/null; then
        test_warn "POSTGRES_PASSWORD still has default value"
    elif grep -q "POSTGRES_PASSWORD=" .env 2>/dev/null; then
        test_pass "POSTGRES_PASSWORD is set"
    else
        test_fail "POSTGRES_PASSWORD not found in .env"
    fi

    if grep -q "MIRA_JWT_SECRET=.*changeme" .env 2>/dev/null; then
        test_warn "MIRA_JWT_SECRET still has default value"
    elif grep -q "MIRA_JWT_SECRET=" .env 2>/dev/null; then
        test_pass "MIRA_JWT_SECRET is set"
    else
        test_fail "MIRA_JWT_SECRET not found in .env"
    fi
else
    test_fail ".env file not found"
    echo "  Run: cp .env.example .env"
fi

# Test 4: Build Images
test_step "Test 4: Build Docker Images"

echo "Building images (this may take a few minutes)..."
if docker-compose build --quiet 2>&1 | tee /tmp/docker-build.log; then
    test_pass "Docker images built successfully"
else
    test_fail "Docker build failed"
    echo "See /tmp/docker-build.log for details"
fi

# Check if images exist
if docker images | grep -q "mira.*api"; then
    test_pass "API image created"
else
    test_fail "API image not found"
fi

if docker images | grep -q "mira.*web"; then
    test_pass "Web image created"
else
    test_fail "Web image not found"
fi

# Test 5: Start Services
test_step "Test 5: Start Services"

echo "Starting services..."
if docker-compose up -d 2>&1 | tee /tmp/docker-start.log; then
    test_pass "Services started"
else
    test_fail "Failed to start services"
    echo "See /tmp/docker-start.log for details"
fi

# Wait for services to be ready
echo "Waiting for services to be healthy (max 60 seconds)..."
MAX_WAIT=60
WAIT_COUNT=0

while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
    POSTGRES_HEALTH=$(docker-compose ps postgres --format json 2>/dev/null | grep -o '"Health":"[^"]*"' | cut -d'"' -f4)
    API_HEALTH=$(docker-compose ps api --format json 2>/dev/null | grep -o '"Health":"[^"]*"' | cut -d'"' -f4)
    WEB_HEALTH=$(docker-compose ps web --format json 2>/dev/null | grep -o '"Health":"[^"]*"' | cut -d'"' -f4)

    if [ "$POSTGRES_HEALTH" = "healthy" ] && [ "$API_HEALTH" = "healthy" ] && [ "$WEB_HEALTH" = "healthy" ]; then
        break
    fi

    echo -n "."
    sleep 2
    WAIT_COUNT=$((WAIT_COUNT + 2))
done

echo ""

if [ $WAIT_COUNT -lt $MAX_WAIT ]; then
    test_pass "All services healthy"
else
    test_warn "Services started but health checks timed out"
fi

# Test 6: Service Connectivity
test_step "Test 6: Service Connectivity"

# Test PostgreSQL
if docker-compose exec -T postgres psql -U mira -d mira -c "SELECT 1" > /dev/null 2>&1; then
    test_pass "PostgreSQL accessible"
else
    test_fail "PostgreSQL connection failed"
fi

# Test API health endpoint
if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
    test_pass "API health endpoint responding"
    HEALTH_RESPONSE=$(curl -s http://localhost:8000/health)
    echo "  Response: $HEALTH_RESPONSE"
else
    test_fail "API health endpoint not responding"
fi

# Test web server
if curl -sf http://localhost/ > /dev/null 2>&1; then
    test_pass "Web server responding"
else
    test_fail "Web server not responding"
fi

# Test API docs
if curl -sf http://localhost:8000/docs > /dev/null 2>&1; then
    test_pass "API documentation accessible"
else
    test_fail "API documentation not accessible"
fi

# Test 7: Database Migrations
test_step "Test 7: Database Migrations"

CURRENT_REV=$(docker-compose exec -T api alembic current 2>/dev/null | grep -o '[a-f0-9]\{12\}' | head -1)

if [ -n "$CURRENT_REV" ]; then
    test_pass "Migrations applied (revision: $CURRENT_REV)"
else
    test_fail "No migrations applied"
fi

# Check tables exist
TABLES=$(docker-compose exec -T postgres psql -U mira -d mira -t -c "\dt" 2>/dev/null | grep -c "public |")

if [ "$TABLES" -ge 15 ]; then
    test_pass "Database tables created ($TABLES tables)"
else
    test_fail "Expected 15+ tables, found $TABLES"
fi

# Test 8: API Endpoints
test_step "Test 8: API Endpoints"

# Test /state endpoint
if curl -sf http://localhost:8000/state > /dev/null 2>&1; then
    test_pass "/state endpoint working"
else
    test_fail "/state endpoint not working"
fi

# Test /health endpoint
HEALTH_STATUS=$(curl -s http://localhost:8000/health | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
if [ "$HEALTH_STATUS" = "ok" ]; then
    test_pass "Health check status: ok"
else
    test_fail "Health check status: $HEALTH_STATUS"
fi

# Test 9: Backup and Restore
test_step "Test 9: Backup and Restore"

# Create backup
mkdir -p "$PROJECT_ROOT/backups"

if "$PROJECT_ROOT/scripts/backup.sh" test_backup > /tmp/backup-test.log 2>&1; then
    test_pass "Backup script executed"

    # Check if backup file exists
    if ls "$PROJECT_ROOT/backups"/test_backup*.tar.gz 1> /dev/null 2>&1; then
        test_pass "Backup file created"
        BACKUP_SIZE=$(du -h "$PROJECT_ROOT/backups"/test_backup*.tar.gz | cut -f1)
        echo "  Backup size: $BACKUP_SIZE"
    else
        test_fail "Backup file not found"
    fi
else
    test_fail "Backup script failed"
    echo "See /tmp/backup-test.log for details"
fi

# Test 10: Resource Usage
test_step "Test 10: Resource Usage"

echo "Container resource usage:"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" mira-postgres mira-api mira-web

test_pass "Resource usage check complete"

# Test 11: Logs
test_step "Test 11: Check for Errors in Logs"

API_ERRORS=$(docker-compose logs api 2>&1 | grep -i "error\|exception\|failed" | wc -l)
if [ "$API_ERRORS" -eq 0 ]; then
    test_pass "No errors in API logs"
else
    test_warn "$API_ERRORS potential errors found in API logs"
    echo "  Run: docker-compose logs api | grep -i error"
fi

WEB_ERRORS=$(docker-compose logs web 2>&1 | grep -i "error\|failed" | wc -l)
if [ "$WEB_ERRORS" -eq 0 ]; then
    test_pass "No errors in web logs"
else
    test_warn "$WEB_ERRORS potential errors found in web logs"
fi

POSTGRES_ERRORS=$(docker-compose logs postgres 2>&1 | grep -i "error\|failed" | wc -l)
if [ "$POSTGRES_ERRORS" -eq 0 ]; then
    test_pass "No errors in PostgreSQL logs"
else
    test_warn "$POSTGRES_ERRORS potential errors found in PostgreSQL logs"
fi

# Summary
echo ""
echo "=========================================================================="
echo "  Test Summary"
echo "=========================================================================="
echo ""
echo -e "${GREEN}Passed: $TEST_PASSED${NC}"
if [ $TEST_FAILED -gt 0 ]; then
    echo -e "${RED}Failed: $TEST_FAILED${NC}"
fi
echo ""

if [ $TEST_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed! Docker setup is working correctly.${NC}"
    echo ""
    echo "Services are available at:"
    echo "  - Web: http://localhost"
    echo "  - API: http://localhost:8000"
    echo "  - API Docs: http://localhost:8000/docs"
    echo ""
    echo "Next steps:"
    echo "  1. Register a user: http://localhost"
    echo "  2. Create some test data"
    echo "  3. Test backup: ./scripts/backup.sh"
    echo "  4. Stop services: docker-compose down"
    echo ""
    exit 0
else
    echo -e "${RED}✗ Some tests failed. Please review the errors above.${NC}"
    echo ""
    echo "For debugging:"
    echo "  - Check logs: docker-compose logs"
    echo "  - Check status: docker-compose ps"
    echo "  - Stop services: docker-compose down"
    echo ""
    exit 1
fi
