#!/bin/bash
set -e

if [ -d "static" ]; then
  echo "=== static/ already exists, skipping frontend build ==="
else
  echo "=== Building frontend ==="
  cd frontend
  npm install
  npm run build
  cd ..
  cp -r frontend/dist static
  echo "=== Frontend built ==="
fi
