#!/bin/bash

# start_prod.sh - One-click start for Production Environment (Simulation)

echo "🚀 Initializing Production Environment..."

# Function to handle script termination
cleanup() {
    echo ""
    echo "🛑 Stopping all services..."
    kill 0
    exit
}

trap cleanup SIGINT SIGTERM

# Helper function to check and install dependencies
check_and_install() {
    if [ ! -d "node_modules" ]; then
        echo "📦 Installing dependencies for $(pwd)..."
        npm install
    fi
    现在
}

# 1. Build and Start BFF
echo "------------------------------------------------"
echo "🔌 Building and Starting Backend (BFF)..."
cd bff
check_and_install
echo "🗄️  Ensuring database migrations..."
if [ ! -f "prisma/dev.db" ]; then
    npm run db:deploy
    npm run seed
else
    npm run db:deploy
fi
echo "🔨 Building BFF..."
npm run build
echo "▶️  Starting BFF..."
npm start &
cd ..

# 2. Build and Serve Teaching Portal
echo "------------------------------------------------"
echo "🖥️  Building and Starting Teaching Portal..."
cd iai-teaching-portal
check_and_install
echo "🔨 Building Portal..."
npm run build
echo "▶️  Serving Portal..."
# Using vite preview for local production simulation
npm run preview -- --port 4173 &
cd ..

# 3. Build and Serve Student Stats
echo "------------------------------------------------"
echo "📊 Building and Starting Student Stats..."
cd apps/student-stats
check_and_install
echo "🔨 Building Student Stats..."
npm run build
echo "▶️  Serving Student Stats..."
npm run preview -- --port 4174 &
cd ..

# 4. Build and Serve Quiz Grading
echo "------------------------------------------------"
echo "📝 Building and Starting Quiz Grading..."
cd apps/quiz-grading
check_and_install
echo "🔨 Building Quiz Grading..."
npm run build
echo "▶️  Serving Quiz Grading..."
npm run preview -- --port 4175 &
cd ..

# 5. Build and Serve Quiz Builder
echo "------------------------------------------------"
echo "🧩 Building and Starting Quiz Builder..."
cd apps/quiz-builder
check_and_install
echo "🔨 Building Quiz Builder..."
npm run build
echo "▶️  Serving Quiz Builder..."
npm run preview -- --port 4176 &
cd ..

echo "------------------------------------------------"
echo "✅ All services are running in PRODUCTION mode..."
echo "backend: http://localhost:8080"
echo "portal:  http://localhost:4173"
echo "stats:   http://localhost:4174"
echo "grading: http://localhost:4175"
echo "builder: http://localhost:4176"
echo "------------------------------------------------"
echo "Press Ctrl+C to stop all services."

wait
