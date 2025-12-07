#!/bin/bash

# Setup script for HyperSignal POC project
# Creates necessary directories and files for the project to run

set -e

echo "🚀 Setting up HyperSignal POC environment..."

# Create backend directories
echo "📁 Creating backend directories..."
mkdir -p backend/app/models
mkdir -p backend/app/routers
mkdir -p backend/app/services
mkdir -p backend/app/utils
mkdir -p backend/logs
mkdir -p backend/uploads

# Create frontend directories
echo "📁 Creating frontend directories..."
mkdir -p frontend/src/components
mkdir -p frontend/src/services
mkdir -p frontend/src/types
mkdir -p frontend/src/config
mkdir -p frontend/src/assets
mkdir -p frontend/public

# Create logs directory
echo "📁 Creating logs directory..."
mkdir -p logs

# Create .gitkeep files to preserve empty directories
echo "📄 Creating .gitkeep files..."
touch backend/uploads/.gitkeep
touch backend/logs/.gitkeep
touch logs/.gitkeep

# Set execute permissions on scripts
echo "🔧 Setting execute permissions on scripts..."
chmod +x start.sh
chmod +x stop.sh
chmod +x remove.sh

# Create .env file if it doesn't exist
if [ ! -f backend/.env ]; then
    echo "📄 Creating backend/.env file..."
    cat > backend/.env << 'EOF'
# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key-here

# MongoDB Configuration
MONGO_URL=mongodb://mongodb:27017
MONGO_DB_NAME=hypersignal

# Backend Configuration
BACKEND_PORT=8000
LOG_LEVEL=INFO
EOF
    echo "⚠️  Please update backend/.env with your actual OpenAI API key"
fi

# Create .env file for frontend if needed
if [ ! -f frontend/.env ]; then
    echo "📄 Creating frontend/.env file..."
    cat > frontend/.env << 'EOF'
VITE_API_URL=http://localhost:8000
EOF
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Update backend/.env with your OpenAI API key"
echo "  2. Install backend dependencies: cd backend && source venv/bin/activate && pip install -r requirements.txt"
echo "  3. Install frontend dependencies: cd frontend && npm install"
echo "  4. Start the application: ./start.sh"
echo ""
