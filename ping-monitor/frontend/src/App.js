import React, { useEffect, useState, useRef } from "react";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { Line } from "react-chartjs-2";
import "./App.css";

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

// IP-to-Tag Mapping
const IP_TAGS = {
    "172.20.3.108": "Curator Service - 172.20.3.108",
    "172.20.3.198": "Process Engine - 172.20.3.198",
    "172.20.2.201": "Curator Gateway - 172.20.2.201"
};

const PingMonitor = () => {
    const [data, setData] = useState({});
    const [chartData, setChartData] = useState({});
    const [lastRefresh, setLastRefresh] = useState(new Date().toLocaleTimeString());
    const [autoResetStatus, setAutoResetStatus] = useState("Idle");
    const [manualResetInProgress, setManualResetInProgress] = useState(false);
    const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
    const [password, setPassword] = useState("");
    const [resetType, setResetType] = useState("");
    const [tunnelDownAlert, setTunnelDownAlert] = useState(false);
    const [viewMode, setViewMode] = useState("graph"); // "graph" or "table"
    const [sshOutput, setSshOutput] = useState([]);
    const [showSshOutput, setShowSshOutput] = useState(false);
    const sshOutputRef = useRef(null);
    
    // Function to handle password submission
    const handlePasswordSubmit = (e) => {
        e.preventDefault();
        
        if (!password.trim()) {
            return;
        }
        
        setManualResetInProgress(true);
        setShowSshOutput(true);
        setSshOutput(["Starting VPN reset process..."]);
        
        fetch("/api/reset_vpn", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ password: password })
        })
        .then(res => res.json())
        .then(result => {
            setAutoResetStatus(result.message || "VPN reset triggered");
            setTimeout(() => setManualResetInProgress(false), 5000);
            setShowPasswordPrompt(false);
            setPassword(""); // Clear password from state
            setTunnelDownAlert(false);
            
            // Update SSH output if available in the response
            if (result.output && Array.isArray(result.output)) {
                setSshOutput(result.output);
            }
        })
        .catch(error => {
            console.error("Error triggering VPN reset:", error);
            setAutoResetStatus("Reset failed");
            setManualResetInProgress(false);
            setPassword(""); // Clear password even on error
            setSshOutput(prev => [...prev, "Error: Failed to connect to server"]);
        });
    };

    // Function to manually trigger VPN reset
    const triggerManualReset = () => {
        if (manualResetInProgress) return;
        
        setResetType("manual");
        setShowPasswordPrompt(true);
    };

    // Function to dismiss tunnel down alert
    const dismissAlert = () => {
        setTunnelDownAlert(false);
        
        // Also tell the backend to clear the alert status
        fetch("/api/clear_tunnel_down", { 
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            }
        })
        .then(res => res.json())
        .then(result => {
            console.log("Alert cleared:", result);
        })
        .catch(error => {
            console.error("Error clearing alert:", error);
        });
    };

    // React useEffect cleanup function
    useEffect(() => {
        // Event handler for page unload
        const handleUnload = () => {
            // Clear sensitive data on page unload
            setPassword("");
        };

        // Add event listener for before unload
        window.addEventListener('beforeunload', handleUnload);

        // Cleanup function
        return () => {
            // Remove event listener and clear state
            window.removeEventListener('beforeunload', handleUnload);
            setPassword("");
        };
    }, []);

    useEffect(() => {
        const fetchData = () => {
            fetch("/api/ping_results")
                .then(res => res.json())
                .then(responseData => {
                    setData(responseData);
                    setLastRefresh(new Date().toLocaleTimeString());

                    // Get auto-reset status
                    if (responseData.auto_reset_status) {
                        setAutoResetStatus(responseData.auto_reset_status);
                    }
                    
                    // Get SSH output
                    if (responseData.ssh_output && Array.isArray(responseData.ssh_output)) {
                        setSshOutput(responseData.ssh_output);
                        
                        // Auto-scroll SSH output to bottom
                        if (sshOutputRef.current && showSshOutput) {
                            sshOutputRef.current.scrollTop = sshOutputRef.current.scrollHeight;
                        }
                    }
                    
                    // Check if tunnels are down
                    if (responseData.tunnels_down === true && !tunnelDownAlert && !showPasswordPrompt) {
                        setTunnelDownAlert(true);
                        setResetType("auto");
                    }

                    const newChartData = {};
                    Object.keys(responseData)
                        .filter(key => !["auto_reset_status", "tunnels_down"].includes(key)) // Skip non-IP keys
                        .forEach(ip => {
                            const tag = IP_TAGS[ip] || ip;

                            if (!newChartData[tag]) {
                                newChartData[tag] = {
                                    labels: [...Array(60).keys()].map(i => -59 + i),
                                    datasets: [{
                                        label: "Response Time (ms)",
                                        data: [],
                                        borderColor: "green",
                                        backgroundColor: "rgba(0, 128, 0, 0.3)",
                                        pointBackgroundColor: [],
                                        pointBorderColor: [],
                                        tension: 0.3
                                    }]
                                };
                            }

                            const latestPings = responseData[ip].slice(-60);
                            newChartData[tag].datasets[0].data = latestPings.map(v => (v !== null ? v : 0));

                            // Assign Green for Good Pings, Red for Failed Pings
                            newChartData[tag].datasets[0].pointBackgroundColor = latestPings.map(v => (v !== null ? "green" : "red"));
                            newChartData[tag].datasets[0].pointBorderColor = latestPings.map(v => (v !== null ? "green" : "red"));
                        });

                    setChartData(newChartData);
                })
                .catch(error => console.error("Error fetching ping data:", error));
        };

        fetchData();
        const interval = setInterval(fetchData, 1000);
        return () => clearInterval(interval);
    }, [tunnelDownAlert, showPasswordPrompt]);

    return (
        <div className="ping-monitor">
            <h1>AWS TUNNEL MONITORING</h1>
            
            {/* Password Modal */}
            {showPasswordPrompt && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>{resetType === "manual" ? "VPN Tunnel Reset" : "Tunnels Down - Recovery Required"}</h3>
                        <p>
                            {resetType === "manual" 
                                ? "Please enter the SSH password to reset the VPN tunnels:" 
                                : "All tunnels are down. Please enter the SSH password to recover:"}
                        </p>
                        <form onSubmit={handlePasswordSubmit}>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="SSH Password"
                                autoFocus
                                autoComplete="off"
                                onBlur={(e) => {
                                    // Clear clipboard if password was pasted
                                    if (navigator.clipboard && navigator.clipboard.writeText) {
                                        navigator.clipboard.writeText('');
                                    }
                                }}
                            />
                            <div className="modal-buttons">
                                <button 
                                    type="button" 
                                    className="cancel-button"
                                    onClick={() => {
                                        setShowPasswordPrompt(false);
                                        setPassword("");
                                        if (resetType === "auto") {
                                            setTunnelDownAlert(false);
                                        }
                                    }}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    className="submit-button"
                                    disabled={!password.trim()}
                                >
                                    {manualResetInProgress ? "Resetting..." : "Reset Tunnels"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            
            {/* Tunnel Down Alert Banner */}
            {tunnelDownAlert && !showPasswordPrompt && (
                <div className="alert-banner">
                    <span className="alert-message">⚠️ All tunnels are down! Recovery needed.</span>
                    <div className="alert-actions">
                        <button 
                            className="alert-button" 
                            onClick={() => {
                                setResetType("auto");
                                setShowPasswordPrompt(true);
                            }}
                        >
                            Recover Now
                        </button>
                        <button 
                            className="dismiss-button" 
                            onClick={dismissAlert}
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            )}
            
            <div className="status-bar">
                <div className="status-item">
                    <span className="status-label">Last Update:</span>
                    <span className="status-value">{lastRefresh}</span>
                </div>
                <div className="status-item">
                    <span className="status-label">Auto-Reset Status:</span>
                    <span className={`status-value ${autoResetStatus.includes("Reset") ? "status-active" : ""}`}>
                        {autoResetStatus}
                    </span>
                </div>
                <div className="view-toggle">
                    <button 
                        className={`view-button ${viewMode === "graph" ? "active-view" : ""}`}
                        onClick={() => setViewMode("graph")}
                    >
                        Graph View
                    </button>
                    <button 
                        className={`view-button ${viewMode === "table" ? "active-view" : ""}`}
                        onClick={() => setViewMode("table")}
                    >
                        Table View
                    </button>
                </div>
                <div className="action-buttons">
                    {sshOutput.length > 0 && (
                        <button 
                            className={`ssh-log-button ${showSshOutput ? "active-view" : ""}`}
                            onClick={() => setShowSshOutput(!showSshOutput)}
                        >
                            {showSshOutput ? "Hide SSH Log" : "Show SSH Log"}
                        </button>
                    )}
                    <button 
                        className={`reset-button ${manualResetInProgress ? "reset-in-progress" : ""}`}
                        onClick={triggerManualReset}
                        disabled={manualResetInProgress}
                    >
                        {manualResetInProgress ? "Resetting..." : "Reset VPN Tunnels"}
                    </button>
                </div>
            </div>
            {viewMode === "graph" ? (
                <div className="chart-grid">
                    {Object.keys(chartData).map(tag => (
                        <div key={tag} className="chart-container">
                            <h3>{tag}</h3>
                            <div className="chart-wrapper">
                                <Line
                                    data={chartData[tag]}
                                    options={{
                                        scales: {
                                            x: { 
                                                type: 'category',
                                                title: {
                                                    display: true,
                                                    text: 'Seconds Ago'
                                                }
                                            },
                                            y: {
                                                beginAtZero: true,
                                                suggestedMin: 0,
                                                suggestedMax: 12.5,
                                                ticks: {
                                                    stepSize: 2.5,
                                                    callback: (value) => value.toFixed(1),
                                                },
                                                title: {
                                                    display: true,
                                                    text: 'ms'
                                                }
                                            }
                                        },
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        animation: { duration: 0 },
                                        plugins: {
                                            tooltip: {
                                                callbacks: {
                                                    label: function(context) {
                                                        const value = context.raw;
                                                        return value === 0 ? 'Timeout (RTO)' : `${value} ms`;
                                                    }
                                                }
                                            }
                                        }
                                    }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="table-view-container">
                    <div className="ping-table-container">
                        <table className="ping-table">
                            <thead>
                                <tr>
                                    <th>Host</th>
                                    <th>Status</th>
                                    <th>Current</th>
                                    <th>Min</th>
                                    <th>Avg</th>
                                    <th>Max</th>
                                    <th>Loss</th>
                                    <th>Last 10 Pings</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.keys(data)
                                    .filter(key => !["auto_reset_status", "tunnels_down"].includes(key))
                                    .map(ip => {
                                        const hostData = data[ip];
                                        const tag = IP_TAGS[ip] || ip;
                                        const latest = hostData[hostData.length - 1];
                                        const last10 = hostData.slice(-10);
                                        const validPings = last10.filter(p => p !== null);
                                        
                                        // Calculate stats
                                        const currentPing = latest !== null ? latest.toFixed(1) : "Timeout";
                                        const status = latest !== null ? "UP" : "DOWN";
                                        const min = validPings.length > 0 ? Math.min(...validPings).toFixed(1) : "N/A";
                                        const max = validPings.length > 0 ? Math.max(...validPings).toFixed(1) : "N/A";
                                        const avg = validPings.length > 0 
                                            ? (validPings.reduce((sum, p) => sum + p, 0) / validPings.length).toFixed(1)
                                            : "N/A";
                                        const lossRate = ((last10.length - validPings.length) / last10.length * 100).toFixed(0) + "%";
                                        
                                        return (
                                            <tr key={ip} className={latest === null ? "host-down" : "host-up"}>
                                                <td>{tag}</td>
                                                <td className={`status-cell ${status === "UP" ? "status-up" : "status-down"}`}>
                                                    {status}
                                                </td>
                                                <td>{currentPing}</td>
                                                <td>{min}</td>
                                                <td>{avg}</td>
                                                <td>{max}</td>
                                                <td>{lossRate}</td>
                                                <td className="ping-history">
                                                    {last10.map((ping, idx) => (
                                                        <span 
                                                            key={idx} 
                                                            className={`ping-dot ${ping !== null ? "ping-success" : "ping-failure"}`}
                                                            title={ping !== null ? `${ping.toFixed(1)} ms` : "Timeout"}
                                                        />
                                                    ))}
                                                </td>
                                            </tr>
                                        );
                                    })}
                            </tbody>
                        </table>
                    </div>
                    
                    <div className="detailed-ping-history">
                        <h3>Detailed Ping History</h3>
                        <div className="detailed-ping-table-container">
                            <table className="detailed-ping-table">
                                <thead>
                                    <tr>
                                        <th>Time</th>
                                        {Object.keys(data)
                                            .filter(key => !["auto_reset_status", "tunnels_down"].includes(key))
                                            .map(ip => (
                                                <th key={ip}>{IP_TAGS[ip] || ip}</th>
                                            ))
                                        }
                                    </tr>
                                </thead>
                                <tbody>
                                    {[...Array(20)].map((_, i) => {
                                        // Get time point (seconds ago)
                                        const secondsAgo = 19 - i;
                                        
                                        return (
                                            <tr key={i}>
                                                <td>{secondsAgo}s ago</td>
                                                {Object.keys(data)
                                                    .filter(key => !["auto_reset_status", "tunnels_down"].includes(key))
                                                    .map(ip => {
                                                        const hostData = data[ip];
                                                        const pingIndex = hostData.length - 1 - secondsAgo;
                                                        const pingValue = pingIndex >= 0 && pingIndex < hostData.length ? 
                                                            hostData[pingIndex] : null;
                                                            
                                                        return (
                                                            <td 
                                                                key={ip} 
                                                                className={pingValue === null ? "ping-timeout" : ""}
                                                            >
                                                                {pingValue !== null ? pingValue.toFixed(1) + " ms" : "Timeout"}
                                                            </td>
                                                        );
                                                    })
                                                }
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PingMonitor;
