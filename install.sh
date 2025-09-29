#!/bin/bash

# MCP RPC Runtime - Easy Installation Script
# Usage: curl -fsSL https://raw.githubusercontent.com/jx-codes/mcp-rpc-runtime/main/install.sh | bash

set -e

echo "🔧 Installing MCP RPC Runtime..."

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

# Compile the project
echo "🏗️  Compiling project..."
deno compile --allow-all -o mcp-rpc-runtime src/main.ts

# Install globally to ~/.deno/bin (no sudo needed)
echo "🌍 Installing globally..."
mkdir -p "$HOME/.deno/bin"
cp mcp-rpc-runtime "$HOME/.deno/bin/"

# Add to PATH if needed
if [[ ":$PATH:" != *":$HOME/.deno/bin:"* ]]; then
    echo "📋 Adding ~/.deno/bin to PATH..."
    echo 'export PATH="$HOME/.deno/bin:$PATH"' >> "$HOME/.bashrc"
    echo 'export PATH="$HOME/.deno/bin:$PATH"' >> "$HOME/.zshrc" 2>/dev/null || true
fi

# Cleanup
echo "🧹 Cleaning up..."
rm -rf "$TEMP_DIR"

echo "✅ MCP RPC Runtime installed successfully!"
echo "🚀 You can now use 'mcp-rpc-runtime' command anywhere."
echo ""
echo "📍 Installed to: \$HOME/.deno/bin/mcp-rpc-runtime"
echo "   (This should be in your PATH automatically)"
echo ""
echo "Usage examples:"
echo "  mcp-rpc-runtime --rpc-dir ./my-functions --port 8080"
echo "  mcp-rpc-runtime -r ~/.rpc -p 3000"
echo ""
echo "Next steps:"
echo "1. Create your RPC functions directory"
echo "2. Start the runtime: mcp-rpc-runtime --rpc-dir ./functions --port 8080"
echo "3. Configure your MCP bridge to connect to this runtime"
echo ""
echo "For more help, see: https://github.com/jx-codes/mcp-rpc-runtime#readme"