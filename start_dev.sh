#!/bin/bash

# start_dev.sh - One-click start for Development Environment

echo "🚀 Initializing Development Environment..."

# Function to handle script termination
cleanup() {
    echo ""
    echo "🛑 Stopping all services..."
    # Kill all child processes in the same process group
    kill 0
    exit
}

# Trap SIGINT (Ctrl+C) and SIGTERM
trap cleanup SIGINT SIGTERM

# Helper function to check and install dependencies
check_and_install() {
    if [ ! -d "node_modules" ]; then
        echo "📦 Installing dependencies for $(pwd)..."
        npm install
    fi
}

# 1. Start BFF (Backend)
echo "------------------------------------------------"
echo "🔌 Starting Backend (BFF)..."
cd bff
check_and_install
# Run in background
npm run dev &
cd ..

# 2. Start Teaching Portal (Frontend)
echo "------------------------------------------------"
echo "🖥️  Starting Teaching Portal..."
cd iai-teaching-portal
check_and_install
npm run dev &
cd ..

# 3. Start Student Stats (Frontend)
echo "------------------------------------------------"
echo "📊 Starting Student Stats..."
cd apps/student-stats
check_and_install
npm run dev &
cd ..

# 4. Start Quiz Grading (Frontend)
echo "------------------------------------------------"
echo "📝 Starting Quiz Grading..."
cd apps/quiz-grading
check_and_install
npm run dev -- --port 5175 &
cd ..

# 5. Start Quiz Builder (Frontend)
echo "------------------------------------------------"
echo "🧩 Starting Quiz Builder..."
cd apps/quiz-builder
check_and_install
npm run dev -- --port 5176 &
cd ..

echo "------------------------------------------------"
echo "✅ All services are starting..."
echo "backend: http://localhost:8080 (usually)"
echo "portal:  http://localhost:5173 (usually)"
echo "stats:   http://localhost:5174 (usually, check output)"
echo "grading: http://localhost:5175 (usually)"
echo "builder: http://localhost:5176 (usually)"
echo "------------------------------------------------"
echo "Press Ctrl+C to stop all services."

# Wait for all background processes
wait
