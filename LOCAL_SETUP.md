# ScanBell - Local Development Setup

## Prerequisites

Before you begin, ensure you have the following installed on your machine:

- **Node.js** (v16 or higher) - [Download here](https://nodejs.org/)
- **Python** (v3.8 or higher) - [Download here](https://www.python.org/)
- **MongoDB** (v4.4 or higher) - [Download here](https://www.mongodb.com/try/download/community)
- **Yarn** package manager - Install with: `npm install -g yarn`

## Step 1: Download the Project

If you're on Emergent platform, download your project files to your local machine.

```bash
# Create a project directory
mkdir scanbell-app
cd scanbell-app

# Copy all files from the platform to this directory
```

## Step 2: Install MongoDB

### On macOS (using Homebrew):
```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

### On Windows:
1. Download MongoDB Community Server installer
2. Run the installer and follow the setup wizard
3. Start MongoDB service from Services or run: `net start MongoDB`

### On Linux (Ubuntu/Debian):
```bash
sudo apt-get install mongodb
sudo systemctl start mongodb
sudo systemctl enable mongodb
```

### Verify MongoDB is running:
```bash
mongosh
# or
mongo
```

## Step 3: Backend Setup

### Navigate to backend directory:
```bash
cd backend
```

### Create a virtual environment (recommended):
```bash
# On macOS/Linux:
python3 -m venv venv
source venv/bin/activate

# On Windows:
python -m venv venv
venv\Scripts\activate
```

### Install Python dependencies:
```bash
pip install -r requirements.txt
```

### Configure environment variables:
Create a `.env` file in the `backend` directory:

```bash
# backend/.env
MONGO_URL=mongodb://localhost:27017
DB_NAME=scanbell_db
CORS_ORIGINS=http://localhost:3000
```

### Start the backend server:
```bash
# Make sure you're in the backend directory
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

The backend should now be running at `http://localhost:8001`

## Step 4: Frontend Setup

Open a **new terminal window/tab** (keep backend running).

### Navigate to frontend directory:
```bash
cd frontend
```

### Install Node dependencies:
```bash
yarn install
```

### Configure environment variables:
Create a `.env` file in the `frontend` directory:

```bash
# frontend/.env
REACT_APP_BACKEND_URL=http://localhost:8001
PORT=3000
```

### Start the frontend development server:
```bash
yarn start
```

The frontend should automatically open in your browser at `http://localhost:3000`

## Step 5: Access the Application

1. **Frontend**: http://localhost:3000
2. **Backend API**: http://localhost:8001
3. **API Docs**: http://localhost:8001/docs (FastAPI automatic documentation)

## Troubleshooting

### MongoDB Connection Issues
```bash
# Check if MongoDB is running
# On macOS/Linux:
ps aux | grep mongod

# On Windows:
tasklist | findstr mongod

# If not running, start it:
# macOS: brew services start mongodb-community
# Windows: net start MongoDB
# Linux: sudo systemctl start mongodb
```

### Port Already in Use
If port 8001 or 3000 is already in use:

**Backend (port 8001):**
```bash
# Find and kill the process using port 8001
# On macOS/Linux:
lsof -ti:8001 | xargs kill -9

# On Windows:
netstat -ano | findstr :8001
taskkill /PID <PID_NUMBER> /F
```

**Frontend (port 3000):**
```bash
# On macOS/Linux:
lsof -ti:3000 | xargs kill -9

# On Windows:
netstat -ano | findstr :3000
taskkill /PID <PID_NUMBER> /F
```

### Python Module Not Found
```bash
# Ensure virtual environment is activated
# Then reinstall dependencies
pip install -r requirements.txt
```

### Node Module Errors
```bash
# Delete node_modules and reinstall
rm -rf node_modules yarn.lock
yarn install
```

## Authentication Setup for Local Development

⚠️ **Important**: The current authentication system uses Emergent's OAuth service. For local development, you have two options:

### Option 1: Mock Authentication (Recommended for Local Dev)
You'll need to modify the backend to bypass authentication temporarily. Contact support or modify the `get_current_user` function in `backend/server.py`.

### Option 2: Use Emergent OAuth
Keep the current authentication but you'll need to:
1. Be connected to the internet
2. Still use Emergent's OAuth service
3. Cookies might have CORS issues - you may need to adjust cookie settings

## Project Structure
```
scanbell-app/
├── backend/
│   ├── server.py           # Main FastAPI application
│   ├── requirements.txt    # Python dependencies
│   └── .env               # Backend environment variables
├── frontend/
│   ├── src/
│   │   ├── App.js         # Main React application
│   │   └── components/    # UI components
│   ├── package.json       # Node dependencies
│   └── .env              # Frontend environment variables
└── README.md
```

## Development Tips

### Hot Reload
Both servers support hot reload:
- **Backend**: Changes to Python files automatically reload
- **Frontend**: Changes to React files automatically refresh browser

### Database Access
View your MongoDB data:
```bash
mongosh
use scanbell_db
db.users.find()
db.call_history.find()
```

### View Logs
- Backend logs appear in the terminal where you ran `uvicorn`
- Frontend logs appear in browser console (F12)

## Stopping the Servers

### Backend:
Press `Ctrl + C` in the backend terminal

### Frontend:
Press `Ctrl + C` in the frontend terminal

### MongoDB:
```bash
# macOS:
brew services stop mongodb-community

# Windows:
net stop MongoDB

# Linux:
sudo systemctl stop mongodb
```

## Need Help?

- Check the browser console (F12) for frontend errors
- Check the terminal output for backend errors
- Verify MongoDB is running: `mongosh` or `mongo`
- Ensure all environment variables are set correctly

---

Happy coding! 🚀
