#!/bin/bash
# Start both backend and frontend dev servers

echo "🎓 Starting AI Exam Grader..."

# Backend
cd "$(dirname "$0")/backend"
uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!

# Frontend
cd "$(dirname "$0")/frontend"
npm run dev -- --port 5173 &
FRONTEND_PID=$!

echo ""
echo "✅ Backend running at: http://localhost:8000"
echo "✅ Frontend running at: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both servers."

trap "kill $BACKEND_PID $FRONTEND_PID" EXIT
wait
