from flask import Flask, jsonify, request
import subprocess
import threading
import time
import os
import tempfile
import datetime
import logging
from functools import wraps

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("/var/log/ping-monitor.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("ping-monitor")

app = Flask(__name__)

# List of machines to monitor
TARGETS = ["172.20.3.108", "172.20.3.198", "172.20.2.201"]
ping_results = {host: [] for host in TARGETS}
ping_results["auto_reset_status"] = "Monitoring"
ping_results["tunnels_down"] = False

# VPN Reset configuration
SSH_HOST = "10.0.0.254"
SSH_USER = "admin"
FAILURE_THRESHOLD = 5  # Number of consecutive failures to trigger reset
last_reset_time = None
reset_in_progress = False
reset_lock = threading.Lock()

def reset_vpn_tunnels(password):
    """Execute VPN tunnel reset commands via SSH using provided password"""
    global reset_in_progress, last_reset_time
    
    if reset_in_progress:
        return {"status": "already_running", "message": "Reset already in progress"}
    
    with reset_lock:
        reset_in_progress = True
        ping_results["auto_reset_status"] = "Resetting tunnels..."
        last_reset_time = datetime.datetime.now()
        script_path = None
        
        try:
            # Create temporary expect script that captures all output
            fd, script_path = tempfile.mkstemp(suffix='.exp')
            try:
                with os.fdopen(fd, 'w') as f:
                    f.write(f"""#!/usr/bin/expect -f
log_user 1
set timeout 60
set output ""
proc capture {{}} {{
    global output
    append output $expect_out(buffer)
    exp_continue
}}

spawn ssh {SSH_USER}@{SSH_HOST}
expect {{
    "yes/no" {{
        send "yes\\r"
        exp_continue
    }}
    "({SSH_USER}@{SSH_HOST}) Password:" {{
        puts ">>> Sending password..."
        send "{password}\\r"
        capture
    }}
    "password:" {{
        puts ">>> Sending password..."
        send "{password}\\r"
        capture
    }}
    timeout {{
        puts ">>> Connection timeout"
        exit 1
    }}
    eof {{
        puts ">>> Connection failed"
        exit 1
    }}
}}

# Wait for shell prompt and additional time to ensure connection is stable
expect {{
    "#" {{
        puts ">>> Connected! Waiting 30 seconds before sending commands..."
        capture
    }}
    ">" {{
        puts ">>> Connected! Waiting 30 seconds before sending commands..."
        capture
    }}
    "\\$" {{
        puts ">>> Connected! Waiting 30 seconds before sending commands..."
        capture
    }}
    timeout {{
        puts ">>> Shell prompt timeout"
        exit 1
    }}
}}

sleep 30
puts ">>> Executing first VPN test command..."
send "test vpn ipsec-sa tunnel AWS_TUNNEL:AMS\\r"
expect {{
    "#" {{
        puts ">>> First command completed"
        capture
    }}
    ">" {{
        puts ">>> First command completed"
        capture
    }}
    "\\$" {{
        puts ">>> First command completed"
        capture
    }}
    timeout {{
        puts ">>> Command timeout"
        exit 1
    }}
}}

puts ">>> Executing second VPN test command..."
send "test vpn ipsec-sa tunnel ipsec-vpn-0babe461b23975201-0\\r"
expect {{
    "#" {{
        puts ">>> Second command completed"
        capture
    }}
    ">" {{
        puts ">>> Second command completed"
        capture
    }}
    "\\$" {{
        puts ">>> Second command completed"
        capture
    }}
    timeout {{
        puts ">>> Command timeout"
        exit 1
    }}
}}

puts ">>> Exiting SSH session..."
send "exit\\r"
expect eof

puts $output
""")
                os.chmod(script_path, 0o700)  # Make executable for current user only
                
                # Track command output
                ping_results["ssh_output"] = ["Starting SSH connection..."]
                
                # Execute the expect script
                process = subprocess.Popen(
                    ["/usr/bin/expect", script_path],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    bufsize=1  # Line buffered
                )
                
                # Process output in real-time
                ssh_output = []
                for line in iter(process.stdout.readline, ''):
                    if line.strip():
                        ssh_output.append(line.strip())
                        # Keep the ssh_output reasonably sized (last 50 lines)
                        if len(ssh_output) > 50:
                            ssh_output.pop(0)
                        ping_results["ssh_output"] = ssh_output
                
                # Get final return code
                return_code = process.wait()
                
                # Add final status line
                if return_code == 0:
                    ssh_output.append("VPN reset completed successfully.")
                else:
                    stderr_output = process.stderr.read()
                    ssh_output.append(f"VPN reset failed with exit code {return_code}")
                    if stderr_output:
                        ssh_output.append(f"Error: {stderr_output.strip()}")
                
                ping_results["ssh_output"] = ssh_output
                
                if return_code == 0:
                    success_message = f"VPN reset successful at {last_reset_time.strftime('%H:%M:%S')}"
                    logger.info(success_message)
                    ping_results["auto_reset_status"] = success_message
                    ping_results["tunnels_down"] = False
                    
                    # Clear SSH output after 2 minutes
                    def clear_ssh_output():
                        time.sleep(120)
                        ping_results["ssh_output"] = []
                    
                    threading.Thread(target=clear_ssh_output, daemon=True).start()
                    
                    return {"status": "success", "message": success_message, "output": ssh_output}
                else:
                    error_message = f"VPN reset failed with exit code {return_code}"
                    logger.error(error_message)
                    ping_results["auto_reset_status"] = "Reset failed"
                    return {"status": "error", "message": error_message, "output": ssh_output}
            finally:
                # Securely delete the temporary script that contains the password
                if script_path and os.path.exists(script_path):
                    # First overwrite the file with zeros to ensure the password can't be recovered
                    try:
                        with open(script_path, 'w') as f:
                            f.write('\0' * 1024)  # Overwrite with null bytes
                        # Then remove the file
                        os.remove(script_path)
                    except Exception as e:
                        logger.error(f"Failed to securely remove temporary script: {e}")
                
        except Exception as e:
            error_message = f"Error during VPN reset: {str(e)}"
            logger.error(error_message)
            ping_results["auto_reset_status"] = "Reset error"
            ping_results["ssh_output"] = [f"Error: {str(e)}"]
            return {"status": "error", "message": error_message, "output": [f"Error: {str(e)}"]}
        finally:
            # Clear password variable by overwriting it
            password = '0' * len(password)
            password = None
            
            reset_in_progress = False
            
            # After 60 seconds, reset the status message back to monitoring
            def reset_status():
                time.sleep(60)
                if not reset_in_progress:
                    ping_results["auto_reset_status"] = "Monitoring"
            
            threading.Thread(target=reset_status, daemon=True).start()

def check_failed_pings():
    """Check if all targets have failed pings for FAILURE_THRESHOLD consecutive seconds"""
    # Don't check again if we've already determined tunnels are down
    if ping_results["tunnels_down"]:
        return False
        
    # Don't reset if we've reset in the last 5 minutes
    if last_reset_time and (datetime.datetime.now() - last_reset_time).total_seconds() < 300:
        return False
        
    for host in TARGETS:
        # Need at least FAILURE_THRESHOLD pings to check
        if len(ping_results[host]) < FAILURE_THRESHOLD:
            return False
            
        # Check last FAILURE_THRESHOLD pings
        recent_pings = ping_results[host][-FAILURE_THRESHOLD:]
        failed_pings = [ping for ping in recent_pings if ping is None]
        
        # If any host has fewer failures than threshold, don't mark tunnels as down
        if len(failed_pings) < FAILURE_THRESHOLD:
            return False
            
    # All hosts have failed for FAILURE_THRESHOLD consecutive pings
    logger.warning(f"All tunnels failed for {FAILURE_THRESHOLD} consecutive seconds. Marking tunnels as down.")
    ping_results["tunnels_down"] = True
    ping_results["auto_reset_status"] = "Tunnels Down - Recovery Needed"
    return True

def ping_host(host):
    """Continuously pings the host and updates the results list."""
    while True:
        try:
            response = subprocess.run(
                ["ping", "-c", "1", "-W", "1", host],  # 1 second timeout
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )

            latency = None
            if response.returncode == 0:
                for line in response.stdout.split("\n"):
                    if "time=" in line:
                        latency = float(line.split("time=")[-1].split(" ")[0])
                        break

            if latency is not None:
                ping_results[host].append(latency)
            else:
                ping_results[host].append(None)

            if len(ping_results[host]) > 300:  # Store 5 minutes of data
                ping_results[host].pop(0)

        except Exception as e:
            logger.error(f"Error pinging {host}: {e}")
            ping_results[host].append(None)

        # After updating ping results, check if tunnels are down
        check_failed_pings()
            
        time.sleep(1)

@app.route('/ping_results', methods=['GET'])
def get_ping_results():
    return jsonify(ping_results)

@app.route('/clear_tunnel_down', methods=['POST'])
def clear_tunnel_down():
    """API endpoint to manually clear the tunnels_down flag"""
    try:
        ping_results["tunnels_down"] = False
        ping_results["auto_reset_status"] = "Monitoring"
        return jsonify({"status": "success", "message": "Alert cleared"})
    except Exception as e:
        logger.error(f"Error clearing tunnel down status: {str(e)}")
        return jsonify({"status": "error", "message": "Server error occurred"}), 500

# Ensure ping threads run even under Gunicorn
for host in TARGETS:
    threading.Thread(target=ping_host, args=(host,), daemon=True).start()

if __name__ == '__main__':
    app.run(debug=False, host='0.0.0.0', port=5000)
