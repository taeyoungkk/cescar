import uvicorn
import subprocess
import sys
import os

if __name__ == "__main__":
    # Start ROS2 Odom Bridge
    print("[*] Starting MQTT Odom Bridge...")
    bridge_process = subprocess.Popen(
        [sys.executable, "app/services/mqtt_odom_bridge.py"],
        env=os.environ.copy()
    )
    
    try:
        uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
    finally:
        print("\n[*] Shutting down bridge...")
        bridge_process.terminate()
        bridge_process.wait()
