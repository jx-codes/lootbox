#!/bin/bash

# Lootbox - Easy Installation Script
# Usage: curl -fsSL https://raw.githubusercontent.com/jx-codes/lootbox/main/install.sh | bash

set -e

echo "🔧 Installing Lootbox..."

# Check if deno is installed
if ! command -v deno &> /dev/null; then
    echo "❌ Deno is required but not installed."
    echo "📥 Install Deno first: https://deno.com/"
    exit 1
fi

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo "❌ Git is required but not installed."
    exit 1
fi

# Create temp directory
TEMP_DIR=$(mktemp -d)
echo "📂 Using temp directory: $TEMP_DIR"

# Clone repository
echo "📥 Cloning repository..."
git clone https://github.com/jx-codes/mcp-rpc-runtime.git "$TEMP_DIR"

# Navigate to project directory
cd "$TEMP_DIR"

# Install dependencies
echo "📦 Installing dependencies..."
deno install
cd ui && deno install && cd ..

# Compile the project
echo "🏗️  Compiling executables..."
deno task compile

# Install globally to ~/.deno/bin (no sudo needed)
echo "🌍 Installing globally..."
mkdir -p "$HOME/.deno/bin"
cp lootbox-runtime "$HOME/.deno/bin/"
cp lootbox "$HOME/.deno/bin/"

# Add to PATH if needed
if [[ ":$PATH:" != *":$HOME/.deno/bin:"* ]]; then
    echo "📋 Adding ~/.deno/bin to PATH..."
    echo 'export PATH="$HOME/.deno/bin:$PATH"' >> "$HOME/.bashrc"
    echo 'export PATH="$HOME/.deno/bin:$PATH"' >> "$HOME/.zshrc" 2>/dev/null || true
fi

# Cleanup
echo "🧹 Cleaning up..."
rm -rf "$TEMP_DIR"

echo "✅ Lootbox installed successfully!"
echo "🚀 You can now use 'lootbox-runtime' and 'lootbox' commands anywhere."
echo ""
echo "📍 Installed to:"
echo "   - \$HOME/.deno/bin/lootbox-runtime"
echo "   - \$HOME/.deno/bin/lootbox"
echo "   (These should be in your PATH automatically)"
echo ""
echo "Usage examples:"
echo "  # Start the runtime server:"
echo "  lootbox-runtime --rpc-dir ./my-functions --port 8080"
echo ""
echo "  # Execute RPC functions directly:"
echo "  lootbox --config ./lootbox.config.json --function myFunction"
echo ""
echo "Next steps:"
echo "1. Create your RPC functions directory"
echo "2. Start the runtime: lootbox-runtime --rpc-dir ./functions --port 8080"
echo "   OR execute directly: lootbox --config config.json --function yourFunction"
echo "3. Configure your MCP bridge to connect to this runtime"
echo ""
echo "For more help, see: https://github.com/jx-codes/lootbox#readme"