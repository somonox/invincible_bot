#!/usr/bin/env python3
import subprocess
import sys
import os
from pathlib import Path

def install_requirements():
    """Install required packages"""
    try:
        subprocess.run([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"], 
                      check=True, cwd=Path(__file__).parent)
        print("✓ Requirements installed successfully")
    except subprocess.CalledProcessError as e:
        print(f"✗ Failed to install requirements: {e}")
        sys.exit(1)

def create_directories():
    """Create necessary directories"""
    directories = ["logs", "models"]
    for directory in directories:
        Path(directory).mkdir(exist_ok=True)
        print(f"✓ Directory '{directory}' ready")

def check_env_file():
    """Check if .env file exists, create from example if not"""
    env_file = Path(".env")
    env_example = Path(".env.example")
    
    if not env_file.exists() and env_example.exists():
        env_file.write_text(env_example.read_text())
        print("✓ Created .env file from .env.example")
    elif env_file.exists():
        print("✓ .env file exists")
    else:
        print("⚠ No .env or .env.example file found")

def main():
    """Main function to start the server"""
    print("🚀 Starting TETR.IO AI Server...")
    
    # Change to the script directory
    os.chdir(Path(__file__).parent)
    
    # Setup
    install_requirements()
    create_directories()
    check_env_file()
    
    # Start the server
    print("🎯 Launching server...")
    try:
        subprocess.run([sys.executable, "main.py"], check=True)
    except subprocess.CalledProcessError as e:
        print(f"✗ Server failed to start: {e}")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\n🛑 Server stopped by user")

if __name__ == "__main__":
    main()