# VPN Tunnel Monitor - Project Structure

```
vpn-tunnel-monitor/
├── backend/
│   ├── venv/                       # Python virtual environment
│   ├── app.py                      # Flask application & main backend logic
│   └── requirements.txt            # Python dependencies
│
├── frontend/
│   ├── public/
│   │   ├── favicon.ico             # Site favicon
│   │   └── index.html              # HTML template
│   ├── src/
│   │   ├── App.js                  # Main React component with monitoring logic
│   │   ├── App.css                 # Styling for the application
│   │   └── index.js                # React entry point
│   ├── package.json                # Node.js dependencies
│   └── package-lock.json           # Lock file for dependencies
│
├── config/
│   ├── nginx/
│   │   └── default                 # Nginx configuration
│   └── gunicorn.service            # Systemd service file
│
├── screenshots/                    # Screenshots for documentation
│   ├── dashboard.png
│   ├── graph-view.png
│   ├── table-view.png
│   └── tunnel-down-alert.png
│
├── README.md                       # Project documentation
├── SETUP_GUIDE.md                  # Detailed setup instructions
└── LICENSE                         # MIT License
```

## Key Files and Their Purposes

### Backend (Flask)

- **app.py**: The core of the backend service that:
  - Performs ping operations on target IPs
  - Maintains state of ping history
  - Provides API endpoints for the frontend
  - Handles VPN reset functionality through SSH
  - Includes monitoring logic for tunnel failures

### Frontend (React)

- **App.js**: The main React component that:
  - Fetches and displays real-time ping data
  - Manages the UI state and views
  - Handles user interactions
  - Manages the password prompt and SSH reset functionality
  - Provides visual feedback on tunnel status

- **App.css**: Contains all styling for the application, including:
  - Responsive design rules
  - Chart containers
  - Table formats
  - Modal dialogs
  - Alert banners
  - Animation effects

### Configuration

- **nginx/default**: Configures the web server to:
  - Serve the React frontend
  - Proxy API requests to the Flask backend
  - Handle URL routing

- **gunicorn.service**: Systemd service definition to:
  - Run the Flask application with Gunicorn
  - Ensure the service starts on boot
  - Manage process lifecycle
