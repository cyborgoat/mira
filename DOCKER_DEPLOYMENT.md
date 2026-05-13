# Mira Docker Deployment Guide

Complete guide for deploying Mira using Docker and Docker Compose.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Prerequisites](#prerequisites)
- [Configuration](#configuration)
- [Building Images](#building-images)
- [Running Services](#running-services)
- [Backup and Restore](#backup-and-restore)
- [Production Deployment](#production-deployment)
- [Monitoring and Logs](#monitoring-and-logs)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

For local development or testing:

```bash
# 1. Run the quick-start script
./scripts/quick-start.sh

# 2. Open your browser
# Web: http://localhost
# API: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

The quick-start script will:
- Create `.env` file with secure random secrets
- Build Docker images
- Start all services (PostgreSQL, API, Web)
- Run database migrations
- Wait for services to be healthy

---

## Prerequisites

### Required Software

- **Docker**: 20.10+ ([Install Docker](https://docs.docker.com/get-docker/))
- **Docker Compose**: 2.0+ (usually included with Docker Desktop)

### Verify Installation

```bash
docker --version          # Should show 20.10+
docker-compose --version  # Should show 2.0+
docker info              # Should connect successfully
```

### System Requirements

**Minimum**:
- CPU: 2 cores
- RAM: 4 GB
- Disk: 10 GB

**Recommended**:
- CPU: 4 cores
- RAM: 8 GB
- Disk: 20 GB (with backups)

---

## Configuration

### Environment Variables

Copy the example environment file and customize:

```bash
cp .env.example .env
```

### Required Variables

Edit `.env` and set these **required** variables:

```bash
# PostgreSQL Password (REQUIRED)
POSTGRES_PASSWORD=your_secure_password_here

# JWT Secret (REQUIRED) - Generate with: openssl rand -hex 32
MIRA_JWT_SECRET=your_jwt_secret_here
```

### Generate Secure Secrets

```bash
# Generate JWT secret
openssl rand -hex 32

# Generate PostgreSQL password
openssl rand -hex 16
```

### Optional Configuration

```bash
# Database
POSTGRES_USER=mira              # Database user (default: mira)
POSTGRES_DB=mira                # Database name (default: mira)
POSTGRES_PORT=5432              # PostgreSQL port (default: 5432)

# JWT Token Expiry
MIRA_JWT_ACCESS_EXPIRY=900      # Access token: 15 minutes
MIRA_JWT_REFRESH_EXPIRY=604800  # Refresh token: 7 days

# CORS Origins (comma-separated)
MIRA_CORS_ORIGINS=http://localhost,http://localhost:80

# Ports
API_PORT=8000                   # API server port
WEB_PORT=80                     # Web server port

# Application
MIRA_DEBUG=false                # Debug mode (true for development)
MIRA_MAX_UPLOAD_BYTES=2097152   # Max upload: 2MB
MIRA_DEFAULT_LANGUAGE=en        # Default language
```

### Security Best Practices

1. ✅ **Never commit `.env` to git** - Already in `.gitignore`
2. ✅ **Use strong passwords** - Minimum 16 characters, random
3. ✅ **Rotate secrets regularly** - Every 90 days for production
4. ✅ **Use secrets manager in production** - AWS Secrets Manager, Azure Key Vault, etc.
5. ✅ **Update CORS origins** - Set to your actual domain in production

---

## Building Images

### Build All Images

```bash
docker-compose build
```

### Build Specific Service

```bash
docker-compose build api   # Build API only
docker-compose build web   # Build web frontend only
```

### Build Without Cache

```bash
docker-compose build --no-cache
```

### Build with Progress

```bash
docker-compose build --progress=plain
```

---

## Running Services

### Start All Services

```bash
# Start in detached mode (background)
docker-compose up -d

# Start with logs visible
docker-compose up
```

### Service Startup Order

Docker Compose handles dependencies automatically:

1. **PostgreSQL** starts first
2. **API** waits for PostgreSQL health check, then runs migrations
3. **Web** waits for API health check

### Check Service Status

```bash
docker-compose ps
```

Expected output:
```
NAME           COMMAND                  SERVICE    STATUS      PORTS
mira-api       "uvicorn mira_api.ma…"   api        Up (healthy) 0.0.0.0:8000->8000/tcp
mira-postgres  "docker-entrypoint.s…"   postgres   Up (healthy) 0.0.0.0:5432->5432/tcp
mira-web       "nginx -g 'daemon of…"   web        Up (healthy) 0.0.0.0:80->80/tcp
```

### Access Services

- **Web Interface**: http://localhost
- **API Server**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs
- **PostgreSQL**: localhost:5432

### Stop Services

```bash
# Stop services (keep data)
docker-compose stop

# Stop and remove containers (keep data)
docker-compose down

# Stop and remove containers + volumes (DELETE DATA)
docker-compose down -v
```

### Restart Services

```bash
# Restart all services
docker-compose restart

# Restart specific service
docker-compose restart api
docker-compose restart web
docker-compose restart postgres
```

---

## Backup and Restore

### Create Backup

Backup both database and workspace data:

```bash
./scripts/backup.sh
```

Optional: Specify backup name:

```bash
./scripts/backup.sh my_backup_name
```

Backups are saved to `./backups/` directory:
- `backup_YYYYMMDD_HHMMSS.tar.gz` (default naming)
- Contains: PostgreSQL dump + workspace files + metadata

### List Backups

```bash
ls -lh backups/
```

### Restore from Backup

⚠️ **Warning**: This will overwrite existing data!

```bash
./scripts/restore.sh backups/backup_20240513_120000.tar.gz
```

The script will:
1. Extract backup
2. Drop and recreate database
3. Restore database from dump
4. Restore workspace files
5. Restart services

### Automated Backups

Set up cron job for daily backups:

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * cd /path/to/mira && ./scripts/backup.sh >> /var/log/mira-backup.log 2>&1
```

### Backup Retention Policy

Recommended retention:
- **Daily backups**: Keep 7 days
- **Weekly backups**: Keep 4 weeks
- **Monthly backups**: Keep 12 months

---

## Production Deployment

### Pre-Deployment Checklist

- [ ] Set strong `POSTGRES_PASSWORD` in `.env`
- [ ] Set secure `MIRA_JWT_SECRET` in `.env` (generate with `openssl rand -hex 32`)
- [ ] Update `MIRA_CORS_ORIGINS` to production domain
- [ ] Set `MIRA_DEBUG=false`
- [ ] Configure SSL/TLS (reverse proxy recommended)
- [ ] Set up automated backups
- [ ] Configure monitoring and alerts
- [ ] Test backup and restore procedures

### SSL/TLS Configuration

For production, use a reverse proxy (Nginx, Traefik, Caddy) to handle SSL:

**Example with Caddy** (automatic HTTPS):

```caddyfile
# Caddyfile
yourdomain.com {
    reverse_proxy web:80
}

api.yourdomain.com {
    reverse_proxy api:8000
}
```

**Example with Nginx**:

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Resource Limits

Add resource limits to `docker-compose.yml` for production:

```yaml
services:
  postgres:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G

  api:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 1G

  web:
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 256M
```

### Environment-Specific Configurations

Create environment-specific compose files:

```bash
# docker-compose.prod.yml
version: '3.9'

services:
  api:
    restart: always
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  web:
    restart: always
```

Run with production config:

```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Database Connection Pooling

Connection pooling is pre-configured in the API:
- **Pool size**: 20 connections
- **Max overflow**: 10 additional connections
- **Pre-ping**: Enabled (validates connections before use)

Adjust in `apps/api/mira_api/database.py` if needed based on load.

### Scaling

Scale API horizontally:

```bash
# Run 3 API instances behind a load balancer
docker-compose up -d --scale api=3
```

**Note**: Requires load balancer configuration (Nginx, HAProxy, etc.)

---

## Monitoring and Logs

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api
docker-compose logs -f web
docker-compose logs -f postgres

# Last 100 lines
docker-compose logs --tail=100 api

# Since timestamp
docker-compose logs --since 2024-05-13T10:00:00 api
```

### Health Checks

All services have health checks configured:

```bash
# Check health status
docker-compose ps

# Test API health endpoint
curl http://localhost:8000/health
```

Expected response:
```json
{
  "status": "ok",
  "database": "ok",
  "version": "0.1.0"
}
```

### Database Monitoring

```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U mira -d mira

# Check active connections
SELECT COUNT(*) FROM pg_stat_activity WHERE datname = 'mira';

# View connection details
SELECT pid, usename, application_name, client_addr, state, query
FROM pg_stat_activity
WHERE datname = 'mira';

# Check database size
SELECT pg_size_pretty(pg_database_size('mira'));
```

### Container Resource Usage

```bash
# Real-time stats
docker stats

# One-time snapshot
docker stats --no-stream
```

### Disk Usage

```bash
# Check Docker disk usage
docker system df

# Check volume sizes
docker volume ls
docker volume inspect mira_postgres-data
```

---

## Troubleshooting

### Services Won't Start

**Problem**: `docker-compose up` fails

**Solutions**:
1. Check Docker daemon is running:
   ```bash
   docker info
   ```

2. Check `.env` file exists and has required variables:
   ```bash
   cat .env | grep -E "(POSTGRES_PASSWORD|MIRA_JWT_SECRET)"
   ```

3. Check port conflicts:
   ```bash
   # Check if ports 80, 8000, 5432 are in use
   lsof -i :80
   lsof -i :8000
   lsof -i :5432
   ```

4. Check logs for specific error:
   ```bash
   docker-compose logs
   ```

### PostgreSQL Connection Failed

**Problem**: API can't connect to database

**Solutions**:
1. Check PostgreSQL is healthy:
   ```bash
   docker-compose ps postgres
   ```

2. Check PostgreSQL logs:
   ```bash
   docker-compose logs postgres
   ```

3. Verify credentials in `.env`

4. Test connection manually:
   ```bash
   docker-compose exec postgres psql -U mira -d mira -c "SELECT 1"
   ```

### Migration Errors

**Problem**: Alembic migrations fail

**Solutions**:
1. Check current migration status:
   ```bash
   docker-compose exec api alembic current
   ```

2. View migration history:
   ```bash
   docker-compose exec api alembic history
   ```

3. Reset to specific revision:
   ```bash
   docker-compose exec api alembic downgrade <revision>
   docker-compose exec api alembic upgrade head
   ```

4. For fresh start (⚠️ deletes data):
   ```bash
   docker-compose down -v
   docker-compose up -d
   ```

### Web Interface Not Loading

**Problem**: Browser shows error or blank page

**Solutions**:
1. Check web container is running:
   ```bash
   docker-compose ps web
   ```

2. Check Nginx logs:
   ```bash
   docker-compose logs web
   ```

3. Check API is accessible:
   ```bash
   curl http://localhost:8000/health
   ```

4. Clear browser cache and reload

5. Check browser console for errors (F12)

### High Memory Usage

**Problem**: Docker using too much RAM

**Solutions**:
1. Check container resource usage:
   ```bash
   docker stats
   ```

2. Add resource limits (see Production Deployment section)

3. Reduce PostgreSQL `shared_buffers` (default is tuned for 2GB RAM)

4. Scale down if running multiple replicas:
   ```bash
   docker-compose up -d --scale api=1
   ```

### Disk Space Issues

**Problem**: Running out of disk space

**Solutions**:
1. Check Docker disk usage:
   ```bash
   docker system df
   ```

2. Remove unused images and containers:
   ```bash
   docker system prune -a
   ```

3. Remove old backups:
   ```bash
   find backups/ -name "*.tar.gz" -mtime +30 -delete
   ```

4. Check application logs aren't filling disk:
   ```bash
   docker-compose logs --tail=10
   ```

### Can't Access from External Network

**Problem**: Services only accessible from localhost

**Solutions**:
1. Check firewall rules allow ports 80, 8000

2. Update `docker-compose.yml` ports to bind to all interfaces:
   ```yaml
   ports:
     - "0.0.0.0:80:80"
     - "0.0.0.0:8000:8000"
   ```

3. Update `MIRA_CORS_ORIGINS` in `.env` to include external domain

4. For cloud deployment, check security group rules

---

## Useful Commands Reference

### Docker Compose

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# Restart services
docker-compose restart

# View logs
docker-compose logs -f

# Check status
docker-compose ps

# Build images
docker-compose build

# Pull latest images
docker-compose pull

# Execute command in container
docker-compose exec api <command>
docker-compose exec postgres psql -U mira -d mira
```

### Database

```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U mira -d mira

# Backup database
docker-compose exec postgres pg_dump -U mira -d mira > backup.sql

# Restore database
docker-compose exec -T postgres psql -U mira -d mira < backup.sql

# Check database size
docker-compose exec postgres psql -U mira -d mira -c "SELECT pg_size_pretty(pg_database_size('mira'))"
```

### Migrations

```bash
# Check current migration
docker-compose exec api alembic current

# View migration history
docker-compose exec api alembic history

# Upgrade to latest
docker-compose exec api alembic upgrade head

# Downgrade one revision
docker-compose exec api alembic downgrade -1

# Create new migration
docker-compose exec api alembic revision --autogenerate -m "description"
```

### Cleanup

```bash
# Remove stopped containers
docker-compose rm

# Remove volumes (⚠️ deletes data)
docker-compose down -v

# Prune system
docker system prune -a
```

---

## PostgreSQL Without Docker

For environments where Docker is not available, install PostgreSQL directly.

### macOS (Homebrew)

```bash
brew install postgresql@16
brew services start postgresql@16
```

### Ubuntu / Debian

```bash
sudo apt update && sudo apt install postgresql-16 postgresql-contrib
sudo systemctl start postgresql
```

### Create Database and User

```bash
psql postgres
```

```sql
CREATE USER mira WITH PASSWORD 'your_secure_password_here';
CREATE DATABASE mira OWNER mira;
GRANT ALL PRIVILEGES ON DATABASE mira TO mira;
\q
```

### Configure and Run Migrations

```bash
export MIRA_DATABASE_URL="postgresql://mira:your_secure_password_here@localhost:5432/mira"
cd apps/api
alembic upgrade head
```

Start the API as usual:

```bash
npm run dev:api
```

---

## Support and Resources

- **Documentation**: [Project README](./README.md)
- **Quickstart (local dev)**: [quickstart.md](./quickstart.md)
- **Testing Guide**: [TESTING.md](./TESTING.md)
- **Docker Documentation**: https://docs.docker.com/
- **Docker Compose Reference**: https://docs.docker.com/compose/compose-file/

---

**Last Updated**: 2026-05-14
**Mira Version**: 0.1.0
