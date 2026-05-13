# Mira Servers - Running Status

**Status**: ✅ Both servers are running and ready

---

## 🌐 Access URLs

### Frontend (Web Application)
- **URL**: http://localhost:5174/
- **Alternative**: http://10.0.0.38:5174/ (network access)
- **Status**: ✅ Running on Vite dev server
- **Features**: Login page with authentication enabled

### Backend API
- **URL**: http://localhost:8000
- **Health Check**: http://localhost:8000/health
- **API Docs**: http://localhost:8000/docs (Swagger UI)
- **Status**: ✅ Running with auto-reload enabled

---

## 🔐 Test the Authentication Flow

### 1. Open the Frontend
Open your browser and go to: **http://localhost:5174/**

You should see the **Login Page** with:
- Login form (email + password)
- "Need an account? Register" link

### 2. Register a New User
1. Click "Need an account? Register"
2. Fill in:
   - **Name**: Your name (e.g., "John Doe")
   - **Email**: Any valid email (e.g., "john@example.com")
   - **Password**: At least 8 characters (e.g., "password123")
3. Click "Register"
4. You should be automatically logged in and see the main Mira workspace

### 3. Test Logout
1. Look for the logout option in the UI
2. Click logout
3. You should be redirected back to the login page

### 4. Test Login
1. Use the email and password you registered with
2. Click "Login"
3. You should see the main workspace again

---

## 📊 Server Details

### API Server
```
Process ID: 53280
Command: python -m uvicorn mira_api.main:app --host 0.0.0.0 --port 8000 --reload
Logs: /tmp/mira_api.log
Working Directory: /Users/junxiaoguo/Documents/meredith_project/mira/apps/api
```

**Features Enabled**:
- ✅ Auto-reload on code changes
- ✅ CORS enabled for http://localhost:5173 and http://localhost:5174
- ✅ SQLAlchemy ORM with SQLite database
- ✅ JWT authentication with httpOnly cookies
- ✅ Bcrypt password hashing

### Frontend Dev Server
```
Process ID: 53809
Command: vite --host 0.0.0.0
Port: 5174 (Port 5173 was already in use)
Logs: /tmp/mira_web.log
Working Directory: /Users/junxiaoguo/Documents/meredith_project/mira/apps/web
```

**Features Enabled**:
- ✅ Hot module replacement (HMR)
- ✅ Fast refresh for React components
- ✅ Auth context with React Query
- ✅ Login/Register pages

---

## 🔍 API Endpoints Available

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login existing user
- `POST /auth/logout` - Logout current user
- `GET /auth/me` - Get current user info

### Workspaces (Phase 2 - NEW!)
- `GET /workspaces/me` - Get current user's workspaces
- `POST /workspaces` - Create new workspace
- `GET /workspaces/{workspace_id}` - Get workspace details

### Application
- `GET /state` - Get all app state (workspace-scoped: members, todos, reports, etc.)
- `POST /todos` - Create a new todo (workspace-scoped)
- `PATCH /todos/{id}` - Update a todo (workspace-scoped)
- `DELETE /todos/{id}` - Delete a todo (workspace-scoped)
- `POST /reports/generate` - Generate weekly report
- `POST /reports/archive` - Archive a report
- `POST /imports/text` - Import text content
- `POST /imports/file` - Import file
- `POST /kb/search` - Search knowledge base
- `POST /team-summary/generate` - Generate team summary

---

## 🛠️ Useful Commands

### View API Logs
```bash
tail -f /tmp/mira_api.log
```

### View Frontend Logs
```bash
tail -f /tmp/mira_web.log
```

### Check Server Status
```bash
curl http://localhost:8000/health
```

### Stop Servers
```bash
# Stop API server
pkill -f "uvicorn mira_api.main:app"

# Stop frontend server
pkill -f "vite.*mira"
```

### Restart Servers
```bash
# Restart API
cd /Users/junxiaoguo/Documents/meredith_project/mira/apps/api
python -m uvicorn mira_api.main:app --host 0.0.0.0 --port 8000 --reload

# Restart Frontend
cd /Users/junxiaoguo/Documents/meredith_project/mira/apps/web
npm run dev
```

---

## 🗄️ Database Location

**SQLite Database**:
```
/Users/junxiaoguo/Documents/meredith_project/mira/mira-workspace/mira.sqlite3
```

**Tables**:
- users (authentication)
- refresh_tokens (JWT token management)
- user_members (user-to-member linking)
- members (team members)
- todos, weekly_reports, knowledge_entries
- tags, achievement_events, team_summaries, import_batches

---

## 🐛 Troubleshooting

### "Cannot connect to API"
1. Check if API is running: `curl http://localhost:8000/health`
2. Check API logs: `tail -20 /tmp/mira_api.log`
3. Ensure port 8000 is not blocked

### "Frontend not loading"
1. Check if frontend is running on port 5174: `curl http://localhost:5174/`
2. Check frontend logs: `tail -20 /tmp/mira_web.log`
3. Try accessing http://localhost:5173/ (older server)

### "Login not working"
1. Open browser developer console (F12)
2. Check for errors in Console tab
3. Check Network tab for failed requests
4. Verify cookies are being set in Application tab

### "CORS errors"
1. Ensure API CORS is configured for your frontend URL
2. Check that requests include `credentials: "include"`
3. Verify cookies are allowed in browser

---

## ✅ Everything is Ready!

Your Mira application is now running with full authentication support. Open http://localhost:5174/ in your browser and start testing!

**Test User from Automated Tests**:
- Email: test_1778648515@example.com
- Password: testpassword123

Or create your own account through the register flow.
