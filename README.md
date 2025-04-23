# AWS VPN Tunnel Monitor via Palo Alto Firewall Appliance

## Overview

VPN Tunnel Monitor is a real-time monitoring dashboard for AWS VPN tunnels. It provides instant visibility into tunnel health and allows for automated recovery processes when issues are detected.

This was developed with **zero prior coding experience** by leveraging AI tools like ChatGPT 4.0 and Claude 3.7 Sonnet to assist with the code generation and architecture design.

## Key Features

- **Real-time Monitoring**: Continuously pings critical network endpoints and displays latency metrics
- **Automated Recovery**: Automatically detects VPN tunnel failures and provides recovery options
- **Dual-view Interface**: Choose between graph or table visualization for monitoring data
- **SSH Command Execution**: Securely execute recovery commands on VPN gateway
- **Responsive Design**: Works on both desktop and mobile devices

## 🌐 AWS Tunnel Monitoring Screenshots

### 🧱 Architectural Diagram
![Architectural Diagram](https://github.com/thokzz/AWSTunnelMonitoring/blob/main/Assets/AWSTunnel%20Architechtural%20Diagram.png?raw=true)

### 🔁 Flow Diagram
![Flow Diagram](https://github.com/thokzz/AWSTunnelMonitoring/blob/main/Assets/AWSTunnel%20Flow%20Diagram.png?raw=true)

### 📊 Graph View
![Graph View](https://github.com/thokzz/AWSTunnelMonitoring/blob/main/Assets/AWSTunnelMonitoring%20Graph%20View.png?raw=true)

### 🧪 Send Command to Firewall
![Send Command](https://github.com/thokzz/AWSTunnelMonitoring/blob/main/Assets/AWSTunnelMonitoring%20Send%20Command%20to%20Firewall.png?raw=true)

### 📋 Table View
![Table View](https://github.com/thokzz/AWSTunnelMonitoring/blob/main/Assets/AWSTunnelMonitoring%20Table%20View.png?raw=true)


## Tech Stack

- **Backend**: Python with Flask
- **Frontend**: React with Chart.js
- **Server**: Nginx and Gunicorn
- **Monitoring**: Subprocess for ping operations
- **Authentication**: Secure password handling for SSH operations

## Screenshots

### Graph View
![Graph View](screenshots/graph-view.png)

### Table View
![Table View](screenshots/table-view.png)

### Alert System
![Alert System](screenshots/tunnel-down-alert.png)

## Installation Guide

### Prerequisites

- Ubuntu server (20.04 LTS or newer recommended)
- Node.js 18+
- Python 3.8+
- Nginx
- Git

### Backend Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/vpn-tunnel-monitor.git
cd vpn-tunnel-monitor
```

2. Set up the Python virtual environment:
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install flask gunicorn
```

3. Configure the monitoring targets:
   - Edit `app.py` and update the `TARGETS` list with your IP addresses
   - Update `SSH_HOST` to your VPN gateway IP

4. Create a log directory:
```bash
sudo mkdir -p /var/log
sudo touch /var/log/ping-monitor.log
sudo chown -R $USER:$USER /var/log/ping-monitor.log
```

5. Install the expect utility (required for SSH command execution):
```bash
sudo apt-get update
sudo apt-get install expect
```

### Frontend Setup

1. Install Node.js dependencies:
```bash
cd ../frontend
npm install
```

2. Build the React application:
```bash
npm run build
```

3. Configure the IP display names:
   - Edit `App.js` and update the `IP_TAGS` object to match your network device names

### Server Configuration

1. Configure Nginx:
```bash
sudo cp config/nginx/default /etc/nginx/sites-available/ping-monitor
sudo ln -s /etc/nginx/sites-available/ping-monitor /etc/nginx/sites-enabled/
sudo systemctl restart nginx
```

2. Set up Gunicorn as a service:
```bash
sudo cp config/gunicorn.service /etc/systemd/system/ping-monitor.service
sudo systemctl daemon-reload
sudo systemctl start ping-monitor
sudo systemctl enable ping-monitor
```

## Security Considerations

- The application requires SSH access to the VPN gateway for recovery operations
- Passwords are never stored, only used transiently during recovery operations
- All password inputs are cleared from memory after use
- HTTPS is recommended for production deployment

## Usage Instructions

1. Access the dashboard at `http://your-server-ip`
2. Monitor VPN tunnel health in real-time
3. If tunnels go down:
   - An alert will appear with a "Recover Now" button
   - Enter the SSH credentials when prompted
   - The application will automatically execute recovery commands
4. Use the "Reset VPN Tunnels" button for manual recovery if needed
5. Toggle between Graph and Table views as preferred

## Customization

- **Monitoring Targets**: Edit the `TARGETS` array in `app.py`
- **Visual Theme**: Modify colors and styles in `App.css`
- **Recovery Commands**: Update the expect script in `reset_vpn_tunnels()` function
- **Alert Thresholds**: Adjust `FAILURE_THRESHOLD` in `app.py`

## Development Notes

This project was built by someone with no prior coding experience, leveraging AI code generation tools. The development process involved:

1. Defining the project requirements
2. Using ChatGPT 4.0 and Claude 3.7 Sonnet to generate initial code
3. Testing and refining the application
4. Deploying to a production environment

The AI assistants helped with:
- Architecture decisions
- Code generation
- Debugging
- Best practices implementation

## License

MIT License

## Acknowledgements

- ChatGPT 4.0 and Claude 3.7 Sonnet for code generation assistance
- Chart.js for visualization components
- React and Flask communities for excellent documentation
