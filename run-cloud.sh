#!/bin/bash

# Load environment variables from .env file if it exists
if [ -f .env ]; then
    echo "Loading environment variables from .env..."
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "ERROR: .env file not found. Please create it at the root."
    exit 1
fi

# Execute standard orchestrator
./run-platform.sh restart "$@"
