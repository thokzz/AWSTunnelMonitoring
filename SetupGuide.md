# Setup Guide

# VPN Tunnel Monitor - Setup Guide

This guide provides detailed step-by-step instructions for setting up the VPN Tunnel Monitor application on an Ubuntu server. 

## Prerequisites

Before beginning, ensure you have:

- Ubuntu server 20.04 LTS or newer
- Sudo access on the server
- Basic knowledge of terminal commands
- Target VPN gateway with SSH access

## 1. Server Preparation

First, update your system and install the required dependencies:

```bash
# Update package lists
sudo apt update

# Upgrade existing packages
sudo apt upgrade -y

# Install required packages
sudo apt install -y python3-venv python3-pip nodejs npm nginx expect
```

## 2. Project Setup

Create the project directory structure:

```bash
# Create main project directory
mkdir -p /scripts/ping-monitor/{backend,frontend}

# Set proper permissions
sudo chown -R $USER:$USER /scripts
```

## 3. Backend Setup

### 3.1. Create Python Environment

```bash
# Navigate to backend directory
cd /scripts/ping-monitor/backend

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Create requirements file
cat > requirements.txt << EOF
Flask==2.0.1
gunicorn==20.1.0
EOF

# Install dependencies
pip install -r requirements.txt
```

### 3.2. Create Backend Application

Create the `app.py` file with the Flask application:

```bash
# Create app.py (copy the contents from the provided code)
nano app.py
```

Paste the contents of the provided `app.py` file, making sure to update:
- `TARGETS` list with your IP addresses
- `SSH_HOST` with your VPN gateway IP
- `SSH_USER` with your SSH username

### 3.3. Set Up Logging

```bash
# Create log file
sudo mkdir -p /var/log
sudo touch /var/log/ping-monitor.log
sudo chown -R $USER:$USER /var/log/ping-monitor.log
```

## 4. Frontend Setup

### 4.1. Create React Project

```bash
# Navigate to frontend directory
cd /scripts/ping-monitor/frontend

# Initialize npm project
npm init -y

# Install dependencies
npm install react react-dom react-scripts chart.js@4.4.8 react-chartjs-2@5.3.0
```

### 4.2. Create Frontend Files

Create the source directory:

```bash
mkdir -p src public
```

Create `public/index.html`:

```bash
cat > public/index.html << EOF
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#000000" />
    <meta name="description" content="VPN Tunnel Monitor" />
    <title>VPN Tunnel Monitor</title>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
  </body>
</html>
EOF
```

Create `src/index.js`:

```bash
# Create index.js
nano src/index.js
```

Paste the contents of the provided `index.js` file.

Create `src/App.css`:

```bash
# Create App.css
nano src/App.css
```

Paste the contents of the provided `App.css` file.

Create `src/App.js`:

```bash
# Create App.js
nano src/App.js
```

Paste the contents of the provided `App.js` file, making sure to update:
- `IP_TAGS` object with your network device names

### 4.3. Configure Package.json

Update the package.json file:

```bash
# Update package.json
nano package.json
```

Make sure it includes:

```json
{
  "name": "ping-monitor",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "chart.js": "^4.4.8",
    "react": "^18.0.0",
    "react-chartjs-2": "^5.3.0",
    "react-dom": "^18.0.0",
    "react-scripts": "^5.0.1"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject"
  },
  "browserslist": {
    "production": [
      ">0.2%",
      "not dead",
      "not op_mini all"
    ],
    "development": [
      "last 1 chrome version",
      "last 1 firefox version",
      "last 1 safari version"
    ]
  }
}
```

### 4.4. Build the Frontend

```bash
# Build the application
npm run build
```

## 5. Server Configuration

### 5.1. Configure Nginx

Create Nginx configuration:

```bash
# Create nginx configuration
sudo nano /etc/nginx/sites-available/ping-monitor
```

Paste the contents of the provided `default` file, making sure to update:
- `server_name` with your server's IP or domain name

Enable the site:

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/ping-monitor /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### 5.2. Configure Gunicorn Service

Create systemd service file:

```bash
# Create service file
sudo nano /etc/systemd/system/ping-monitor.service
```

Paste the contents of the provided `gunicorn.service` file.

Enable and start the service:

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service to start on boot
sudo systemctl enable ping-monitor

# Start the service
sudo systemctl start ping-monitor

# Check status
sudo systemctl status ping-monitor
```

## 6. Testing

Open your web browser and navigate to `http://your-server-ip`. You should see the VPN Tunnel Monitor dashboard.

### 6.1. Checking Logs

If you encounter any issues, check the logs:

```bash
# Backend logs
sudo journalctl -u ping-monitor.service -f

# Application logs
tail -f /var/log/ping-monitor.log

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## 7. Security Considerations

For production use, consider these additional security steps:

### 7.1. Enable HTTPS

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d yourdomain.com

# Certbot will update your Nginx config automatically
```

### 7.2. Firewall Configuration

```bash
# Configure UFW firewall
sudo ufw allow 'Nginx Full'
sudo ufw allow ssh
sudo ufw enable
```

### 7.3. Password Security

The application never stores passwords - they are only used transiently during the SSH session and are cleared from memory afterward. However, for additional security:

- Consider using SSH keys instead of passwords
- Use strong, unique passwords
- Limit SSH access to specific IPs if possible

## 8. Troubleshooting

### Issue: Backend service won't start

**Solution:**
```bash
# Check for Python errors
cd /scripts/ping-monitor/backend
source venv/bin/activate
python app.py
```

### Issue: Frontend shows "Cannot connect to server"

**Solution:**
```bash
# Check if backend is running
sudo systemctl status ping-monitor

# Check API accessibility
curl http://localhost:5000/ping_results
```

### Issue: Pings are not working

**Solution:**
```bash
# Check if ICMP is allowed
sudo ping -c 4 <IP ADDRESS>

# Check privileges for ping
sudo setcap cap_net_raw+ep /bin/ping
```

### Issue: VPN Reset is not working

**Solution:**
```bash
# Check if expect is installed
which expect

# Test SSH connection manually
ssh YOUR_SSH_USER@YOUR_SSH_HOST
```

## 9. Customization

### 9.1. Changing Monitored IPs

Edit `app.py` and update the `TARGETS` list:

```python
TARGETS = ["<IP ADDRESS>", "<IP ADDRESS>", "<IP ADDRESS>"]
```

### 9.2. Changing Reset Commands

Edit the expect script section in `app.py` to modify the commands that are executed during reset.

### 9.3. Customizing the UI

Edit `App.css` to change colors, fonts, and layout.

## 10. Maintenance

### 10.1. Updating the Application

```bash
# Pull latest code
cd /scripts/ping-monitor
git pull

# Rebuild frontend
cd frontend
npm run build

# Restart backend
sudo systemctl restart ping-monitor
```

### 10.2. Backing Up

Backup your configuration:

```bash
# Backup app files
sudo tar -czvf ping-monitor-backup.tar.gz /scripts/ping-monitor

# Backup nginx config
sudo cp /etc/nginx/sites-available/ping-monitor ping-monitor-nginx.backup

# Backup systemd service
sudo cp /etc/systemd/system/ping-monitor.service ping-monitor-service.backup
```
