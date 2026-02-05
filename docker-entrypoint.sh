#!/bin/sh
set -e

# Replace the placeholder with the actual API URL
# Default to http://localhost:8765 if VITE_API_URL is not set
API_URL="${VITE_API_URL:-http://localhost:8765}"

echo "Configuring API URL: $API_URL"

# Find and replace the placeholder in all JS files
find /usr/share/nginx/html -name '*.js' -exec sed -i "s|__VITE_API_URL_PLACEHOLDER__|${API_URL}|g" {} \;

# Execute the main command (nginx)
exec "$@"
