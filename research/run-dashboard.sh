#!/bin/bash
# One-command launcher for the thesis research dashboard.
# Installs deps if missing, then opens the dashboard in your browser.

set -e
cd "$(dirname "$0")"

# Install deps if streamlit isn't available
if ! python3 -c "import streamlit" 2>/dev/null; then
  echo "Installing dashboard dependencies..."
  pip install --break-system-packages -r requirements.txt
fi

echo ""
echo "📊 Launching Thesis Research Dashboard..."
echo "   Browser will open automatically. Press Ctrl+C to stop."
echo ""

exec python3 -m streamlit run dashboard.py --server.headless false
