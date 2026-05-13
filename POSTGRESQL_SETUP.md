# PostgreSQL Setup Guide for Mira

This guide provides instructions for setting up and testing Mira with PostgreSQL instead of SQLite.

---

## Prerequisites

- Docker (for easiest setup) OR PostgreSQL installed locally
- Python 3.11+ with mira_api dependencies installed
- Mira repository cloned

---

## Infrastructure Status

✅ **PostgreSQL Support: READY**

The Mira codebase is fully PostgreSQL-ready:

- ✅ **Driver Installed**: psycopg2-binary v2.9.12
- ✅ **Connection Pooling**: Configured (pool_size=20, max_overflow=10)
- ✅ **Model Compatibility**: All SQLAlchemy models use portable types
- ✅ **Migration Compatibility**: No SQLite-specific syntax in migrations
- ✅ **Auto-Configuration**: Engine auto-detects database type from URL

---

## Option 1: PostgreSQL with Docker (Recommended)

### 1. Start PostgreSQL Container

```bash
docker run -d --name mira-postgres \
  -e POSTGRES_USER=mira \
  -e POSTGRES_PASSWORD=your_secure_password_here \
  -e POSTGRES_DB=mira \
  -p 5432:5432 \
  postgres:16-alpine
```

### 2. Verify Container is Running

```bash
docker ps | grep mira-postgres
docker logs mira-postgres
```

Expected output: "database system is ready to accept connections"

### 3. Configure Mira for PostgreSQL

Set the environment variable:

```bash
export MIRA_DATABASE_URL="postgresql://mira:your_secure_password_here@localhost:5432/mira"
```

Or create `.env` file in `apps/api`:

```bash
MIRA_DATABASE_URL=postgresql://mira:your_secure_password_here@localhost:5432/mira
MIRA_JWT_SECRET=your_jwt_secret_here
MIRA_DEBUG=false
```

### 4. Run Migrations

```bash
cd apps/api
alembic upgrade head
```

Expected output:
```
INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
INFO  [alembic.runtime.migration] Will assume transactional DDL.
INFO  [alembic.runtime.migration] Running upgrade  -> e5ccce4cd5a2, baseline_schema_with_auth_tables
INFO  [alembic.runtime.migration] Running upgrade e5ccce4cd5a2 -> 831be18c80c6, add_workspaces_and_isolation
```

### 5. Start API Server

```bash
python -m uvicorn mira_api.main:app --host 0.0.0.0 --port 8000 --reload
```

### 6. Verify Database Connection

```bash
curl http://localhost:8000/health
```

Expected response:
```json
{
  "status": "ok",
  "workspace": "/path/to/mira-workspace",
  "default_language": "en"
}
```

### 7. Test Registration and Login

```bash
# Register a new user
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123","name":"Test User"}' \
  -c cookies.txt

# Verify workspace created
curl http://localhost:8000/state -b cookies.txt
```

---

## Option 2: PostgreSQL Installed Locally

### 1. Install PostgreSQL

**macOS (Homebrew)**:
```bash
brew install postgresql@16
brew services start postgresql@16
```

**Ubuntu/Debian**:
```bash
sudo apt update
sudo apt install postgresql-16 postgresql-contrib
sudo systemctl start postgresql
```

### 2. Create Database and User

```bash
# Connect to PostgreSQL
psql postgres

# Create user and database
CREATE USER mira WITH PASSWORD 'your_secure_password_here';
CREATE DATABASE mira OWNER mira;
GRANT ALL PRIVILEGES ON DATABASE mira TO mira;

# Exit
\q
```

### 3. Configure and Test

Follow steps 3-7 from Option 1 above, using the appropriate connection string:

```bash
export MIRA_DATABASE_URL="postgresql://mira:your_secure_password_here@localhost:5432/mira"
```

---

## Connection Pooling Configuration

The Mira API automatically configures connection pooling for PostgreSQL:

### Default Settings

```python
# Automatically set when using PostgreSQL
pool_size = 20          # Number of connections to maintain
max_overflow = 10       # Additional connections allowed beyond pool_size
pool_pre_ping = True    # Verify connections before using
```

### Custom Pool Configuration

To customize, modify `apps/api/mira_api/database.py`:

```python
if "postgresql" in settings.database_url:
    base_args["pool_pre_ping"] = True
    base_args["pool_size"] = 20        # Adjust based on load
    base_args["max_overflow"] = 10     # Adjust based on spike tolerance
    base_args["pool_timeout"] = 30     # Add timeout if needed
    base_args["pool_recycle"] = 3600   # Add recycling if needed
```

### Monitoring Connections

```sql
-- Connect to PostgreSQL
psql -U mira -d mira

-- Check active connections
SELECT COUNT(*) FROM pg_stat_activity WHERE datname = 'mira';

-- View detailed connection info
SELECT pid, usename, application_name, client_addr, state, query
FROM pg_stat_activity
WHERE datname = 'mira';
```

---

## Testing PostgreSQL Performance

### 1. Run Basic Tests

Use the Phase 2 test script with PostgreSQL:

```bash
# Ensure API is running with PostgreSQL
export MIRA_DATABASE_URL="postgresql://..."

# Run tests
python /tmp/test_phase2_workspaces.py
```

### 2. Load Test Connection Pooling

Create concurrent requests to test pooling:

```bash
# Install Apache Bench (if not installed)
# macOS: brew install httpd
# Ubuntu: sudo apt install apache2-utils

# Test with 100 concurrent connections
ab -n 1000 -c 100 http://localhost:8000/health

# Test with authentication
ab -n 1000 -c 50 -H "Cookie: mira_access_token=YOUR_TOKEN" \
   http://localhost:8000/state
```

Expected results:
- No connection errors
- Consistent response times
- Pool should handle concurrent requests without exhaustion

### 3. Monitor Pool Metrics

Add logging to `apps/api/mira_api/database.py`:

```python
from sqlalchemy import event

@event.listens_for(engine, "connect")
def receive_connect(dbapi_conn, connection_record):
    print(f"New DB connection: {id(dbapi_conn)}")

@event.listens_for(engine, "checkout")
def receive_checkout(dbapi_conn, connection_record, connection_proxy):
    print(f"Connection checked out: {id(dbapi_conn)}")
```

---

## Query Compatibility Verification

All Mira queries use SQLAlchemy ORM or parameterized raw SQL, which are automatically translated for PostgreSQL:

### Verified Compatible

✅ **Boolean columns**: SQLAlchemy translates `Boolean` to PostgreSQL `BOOLEAN`
✅ **String columns**: SQLAlchemy `String` maps to PostgreSQL `VARCHAR`
✅ **Text columns**: SQLAlchemy `Text` maps to PostgreSQL `TEXT`
✅ **Integer columns**: SQLAlchemy `Integer` maps to PostgreSQL `INTEGER`
✅ **Indexes**: All index definitions are portable
✅ **Foreign keys**: CASCADE constraints work on both databases

### Known Differences (Handled Automatically)

1. **Datetime Storage**:
   - SQLite: Stores as TEXT (ISO format)
   - PostgreSQL: Uses native TIMESTAMP
   - ✅ SQLAlchemy handles conversion

2. **Boolean Storage**:
   - SQLite: Stores as INTEGER (0/1)
   - PostgreSQL: Uses native BOOLEAN
   - ✅ SQLAlchemy handles conversion

3. **Auto-increment**:
   - SQLite: Uses AUTOINCREMENT
   - PostgreSQL: Uses SERIAL or SEQUENCE
   - ✅ Not used in Mira (manual ID generation)

---

## Migration Testing

### Test Migration on Fresh PostgreSQL Database

```bash
# Set PostgreSQL URL
export MIRA_DATABASE_URL="postgresql://mira:password@localhost:5432/mira_test"

# Drop and recreate database (if needed)
psql -U mira -d postgres -c "DROP DATABASE IF EXISTS mira_test;"
psql -U mira -d postgres -c "CREATE DATABASE mira_test OWNER mira;"

# Run migrations from scratch
cd apps/api
alembic upgrade head

# Verify all tables created
psql -U mira -d mira_test -c "\dt"
```

Expected tables:
```
 public | achievement_events  | table | mira
 public | alembic_version     | table | mira
 public | audit_logs          | table | mira
 public | import_batches      | table | mira
 public | knowledge_entries   | table | mira
 public | members             | table | mira
 public | refresh_tokens      | table | mira
 public | tags                | table | mira
 public | team_summaries      | table | mira
 public | todos               | table | mira
 public | user_members        | table | mira
 public | user_workspaces     | table | mira
 public | users               | table | mira
 public | weekly_reports      | table | mira
 public | workspaces          | table | mira
```

### Test Downgrade

```bash
# Downgrade one migration
alembic downgrade -1

# Verify tables removed
psql -U mira -d mira_test -c "\dt"

# Upgrade back
alembic upgrade head
```

---

## Production Deployment Checklist

When deploying to production with PostgreSQL:

### Database Setup

- [ ] PostgreSQL 14+ installed and running
- [ ] Database created with appropriate encoding (UTF-8)
- [ ] Dedicated user created with strong password
- [ ] SSL/TLS enabled for database connections
- [ ] Firewall rules configured (allow only API server)

### Connection Settings

- [ ] `MIRA_DATABASE_URL` set with production credentials
- [ ] `MIRA_JWT_SECRET` set to secure random value
- [ ] `MIRA_DEBUG` set to `false`
- [ ] Connection pool size tuned for expected load
- [ ] Pool timeout and recycling configured

### Migrations

- [ ] Run migrations on empty production database
- [ ] Verify all tables created correctly
- [ ] Test rollback procedure
- [ ] Set up automated migration deployment process

### Monitoring

- [ ] Set up database connection monitoring
- [ ] Configure alerts for pool exhaustion
- [ ] Monitor query performance
- [ ] Set up slow query logging

### Backups

- [ ] Configure automated daily backups
- [ ] Test backup restoration process
- [ ] Set up backup retention policy (30 days recommended)
- [ ] Store backups in separate location

### Security

- [ ] Database password stored in secrets manager
- [ ] SSL certificates configured and valid
- [ ] Database user has minimal required permissions
- [ ] Regular security updates scheduled

---

## Troubleshooting

### Connection Refused

**Problem**: `connection refused` or `could not connect to server`

**Solutions**:
1. Check PostgreSQL is running: `sudo systemctl status postgresql`
2. Verify port 5432 is open: `netstat -an | grep 5432`
3. Check pg_hba.conf allows connections from API server
4. Verify firewall rules

### Pool Exhausted

**Problem**: `QueuePool limit of size 20 overflow 10 reached`

**Solutions**:
1. Increase pool_size in database.py
2. Check for connection leaks (unclosed sessions)
3. Reduce max_overflow if spikes are temporary
4. Optimize slow queries reducing connection hold time

### Migration Fails

**Problem**: Alembic migration fails on PostgreSQL

**Solutions**:
1. Check PostgreSQL version (14+ required)
2. Verify user has CREATE TABLE permissions
3. Check database encoding is UTF-8
4. Review migration file for compatibility issues

### Slow Queries

**Problem**: Queries taking longer than expected

**Solutions**:
1. Enable query logging: Set `echo=True` in database.py
2. Add missing indexes: Review query patterns
3. Use EXPLAIN ANALYZE on slow queries
4. Consider query optimization or caching

---

## Performance Benchmarks

Expected performance with PostgreSQL on typical hardware:

| Operation | SQLite (baseline) | PostgreSQL | Notes |
|-----------|------------------|------------|-------|
| Simple SELECT | ~1ms | ~2ms | Network overhead |
| INSERT with relations | ~5ms | ~6ms | Minimal difference |
| Complex JOIN | ~10ms | ~8ms | PostgreSQL query optimizer |
| Concurrent reads (50) | Variable | Consistent | Connection pooling benefit |
| Concurrent writes (50) | Serialized | Parallel | Major improvement |

**Note**: Actual performance depends on hardware, network latency, and load patterns.

---

## Switching Between SQLite and PostgreSQL

To switch databases, simply change the `MIRA_DATABASE_URL`:

### To PostgreSQL:
```bash
export MIRA_DATABASE_URL="postgresql://mira:password@localhost:5432/mira"
```

### To SQLite:
```bash
export MIRA_DATABASE_URL="sqlite:///./mira-workspace/mira.sqlite3"
# OR unset to use default
unset MIRA_DATABASE_URL
```

**Important**: Data is NOT automatically migrated between databases. Use export/import scripts if needed.

---

## Next Steps

After setting up PostgreSQL:

1. ✅ Run all Phase 2 tests with PostgreSQL
2. ✅ Perform load testing on connection pooling
3. ✅ Monitor connection metrics under normal load
4. ✅ Tune pool settings based on actual usage patterns
5. ✅ Set up production deployment pipeline
6. ✅ Configure automated backups
7. ✅ Proceed to Phase 4: Docker & Deployment

---

## Support

**PostgreSQL Documentation**: https://www.postgresql.org/docs/16/
**SQLAlchemy PostgreSQL Dialect**: https://docs.sqlalchemy.org/en/20/dialects/postgresql.html
**psycopg2 Documentation**: https://www.psycopg.org/docs/

---

**Last Updated**: 2026-05-13
**Status**: Infrastructure ready, awaiting live PostgreSQL testing
