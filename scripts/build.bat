@echo off
echo "...Cleaning previous build..."
if exist frontend\static rmdir /s /q frontend\static
if exist backend\static rmdir /s /q backend\static
if exist frontend\node_modules rmdir /s /q frontend\node_modules
if exist frontend\package-lock.json del /q frontend\package-lock.json

echo "...Installing frontend dependencies..."
cd frontend
call npm install --legacy-peer-deps

echo "...Building React app..."
call npm run build

echo "...Copying build to backend static folder..."
cd ..
if not exist backend\static mkdir backend\static
xcopy /e /y frontend\static\* backend\static\

echo "...Build complete! Run 'cd backend && python src/app.py' to start the server."