#!/bin/sh
set -e

# Generate runtime config from environment variables.
# If VITE_API_URL is empty or unset, the UI uses same-origin requests (recommended
# when the reverse proxy serves both UI and API on the same domain).
API_URL="${VITE_API_URL:-}"

if [ -n "$API_URL" ]; then
  echo "Configuring API URL: $API_URL"
else
  echo "No VITE_API_URL set — using same-origin requests"
fi

cat > /usr/share/nginx/html/config.js <<EOF
window.__FOLD_CONFIG__ = {
  apiUrl: "${API_URL}"
};
EOF

# Execute the main command (nginx)
exec "$@"
