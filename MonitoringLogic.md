# VPN Tunnel Monitor - Monitoring and Alert Logic

This document explains the detailed monitoring logic that drives the VPN Tunnel Monitor application.

## Ping Process

The core monitoring functionality is based on ICMP ping requests to critical network endpoints. Here's how the ping process works:

1. **Continuous Monitoring**: The application pings each target IP address every second
2. **History Tracking**: Up to 300 ping results (5 minutes of data) are stored in memory for each target
3. **Status Calculation**: Each ping result is either:
   - A numeric value (milliseconds) for successful pings
   - `null` for timeouts or failures

## Alert Logic

The alert system follows these rules:

1. **Failure Detection**:
   - Each target is monitored independently
   - If a ping fails, it's recorded as `null` in the history

2. **Tunnel Down Determination**:
   - The system checks if ALL monitored targets have failed for the specified number of consecutive pings
   - Default threshold is 5 consecutive failures
   - This helps avoid false alarms from temporary network blips

3. **Alert Activation**:
   - When all tunnels are determined to be down, the `tunnels_down` flag is set to `true`
   - This triggers the visual alert banner in the UI
   - The status message changes to "Tunnels Down - Recovery Needed"

4. **Alert Dampening**:
   - After a reset, the system won't trigger another alert for 5 minutes
   - This prevents alert storms during recovery periods

## Recovery Logic

The recovery process involves these steps:

1. **Initiation**:
   - Either automatic (from alert) or manual (from button press)
   - Password prompt appears for SSH credentials

2. **Execution**:
   - Secure expect script is generated with the provided password
   - SSH connection is established to the VPN gateway
   - Two test commands are executed to reset the tunnels:
     - `test vpn ipsec-sa tunnel AWS_TUNNEL:AMS`
     - `test vpn ipsec-sa tunnel ipsec-vpn-0babe461b23975201-0`

3. **Security Measures**:
   - Password is only held in memory during the operation
   - Temporary script file is overwritten with null bytes before deletion
   - Password variable is overwritten and set to null after use

4. **Result Handling**:
   - Success/failure status is returned to the frontend
   - SSH command output is displayed in the SSH log panel
   - Status message is updated with the result
   - After 60 seconds, status message returns to "Monitoring"

## Visual Indicators

The application provides several visual indicators:

1. **Chart Colors**:
   - Green points: Successful pings
   - Red points: Failed pings
   - The line drops to zero when a ping fails

2. **Table View**:
   - Success/failure dots for recent pings
   - Color-coded rows (red background for down hosts)
   - Status column shows "UP" or "DOWN"
   - Loss percentage calculation

3. **Alert Banner**:
   - Pulsing red animation when tunnels are down
   - Action buttons for recovery or dismissal

## Configuration Parameters

Key parameters that control the monitoring logic:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `TARGETS` | List of IPs | IP addresses to monitor |
| `FAILURE_THRESHOLD` | 5 | Consecutive failures to trigger alert |
| `SSH_HOST` | 10.0.0.254 | VPN gateway IP address |
| `SSH_USER` | admin | SSH username for VPN gateway |
| Ping polling interval | 1 second | How often ping checks run |
| UI refresh rate | 1 second | How often UI fetches new data |
| History retention | 300 entries | How many ping results are stored (5 minutes) |
| Reset cooldown | 300 seconds | Minimum time between auto-resets |

## Extending the Monitoring Logic

The monitoring logic can be extended in several ways:

1. **Additional Metrics**:
   - Packet loss calculation over longer periods
   - Jitter (variation in ping times)
   - Moving averages for trend analysis

2. **Smarter Alerting**:
   - Time-of-day based thresholds
   - Gradual degradation detection
   - Pattern recognition for cyclical issues

3. **Enhanced Recovery**:
   - Multi-stage recovery procedures
   - Different actions based on failure patterns
   - Automated root cause analysis

## Implementation Notes

Understanding the core monitoring code:

```python
def ping_host(host):
    """Continuously pings the host and updates the results list."""
    while True:
        try:
            response = subprocess.run(
                ["ping", "-c", "1", "-W", "1", host],  # 1 ping with 1 second timeout
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
                ping_results[host].append(None)  # Store None for failed pings

            if len(ping_results[host]) > 300:  # Store 5 minutes of history
                ping_results[host].pop(0)  # Remove oldest entry (FIFO)

        except Exception as e:
            logger.error(f"Error pinging {host}: {e}")
            ping_results[host].append(None)  # Store None for errors

        # After updating ping results, check if tunnels are down
        check_failed_pings()
            
        time.sleep(1)  # Wait 1 second before next ping
```

This function runs in a separate thread for each target IP, continuously pinging and storing results.
