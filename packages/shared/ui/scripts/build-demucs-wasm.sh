#!/bin/bash
#
# Build Demucs WASM Module
#
# This script builds the demucs.cpp library for WebAssembly using Emscripten.
# The output can be hosted on your CDN for client-side audio source separation.
#
# Prerequisites:
# 1. Install Emscripten SDK: https://emscripten.org/docs/getting_started/downloads.html
# 2. Clone demucs.cpp: git clone https://github.com/sevagh/demucs.cpp.git
#
# Usage:
#   ./build-demucs-wasm.sh [path-to-demucs.cpp]
#
# Output:
#   - dist/demucs/demucs.wasm - The WebAssembly module
#   - dist/demucs/demucs.js - JavaScript loader (optional, we use our own)
#   - dist/demucs/htdemucs.ggml - Model weights (must be downloaded separately)
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEMUCS_CPP_PATH="${1:-$PROJECT_ROOT/../../../demucs.cpp}"
OUTPUT_DIR="$PROJECT_ROOT/public/demucs"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Demucs WASM Build Script ===${NC}"
echo ""

# Check for Emscripten
if ! command -v emcmake &> /dev/null; then
    echo -e "${RED}Error: Emscripten not found${NC}"
    echo "Please install the Emscripten SDK:"
    echo "  git clone https://github.com/emscripten-core/emsdk.git"
    echo "  cd emsdk"
    echo "  ./emsdk install latest"
    echo "  ./emsdk activate latest"
    echo "  source ./emsdk_env.sh"
    exit 1
fi

# Check for demucs.cpp source
if [ ! -d "$DEMUCS_CPP_PATH" ]; then
    echo -e "${YELLOW}Cloning demucs.cpp...${NC}"
    git clone https://github.com/sevagh/demucs.cpp.git "$DEMUCS_CPP_PATH"
fi

if [ ! -f "$DEMUCS_CPP_PATH/src_wasm/CMakeLists.txt" ]; then
    echo -e "${RED}Error: demucs.cpp source not found at $DEMUCS_CPP_PATH${NC}"
    echo "Please provide the path to demucs.cpp as an argument:"
    echo "  $0 /path/to/demucs.cpp"
    exit 1
fi

echo -e "${GREEN}Building WASM module...${NC}"
echo "Source: $DEMUCS_CPP_PATH"
echo "Output: $OUTPUT_DIR"
echo ""

# Create build directory
BUILD_DIR="$DEMUCS_CPP_PATH/build-wasm"
mkdir -p "$BUILD_DIR"
cd "$BUILD_DIR"

# Configure with Emscripten CMake
echo -e "${YELLOW}Configuring CMake with Emscripten...${NC}"
emcmake cmake ../src_wasm \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_CXX_FLAGS="-O3 -ffast-math -msimd128 -msse4.2 -flto"

# Build
echo -e "${YELLOW}Compiling...${NC}"
emmake make -j$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Copy WASM files
echo -e "${YELLOW}Copying output files...${NC}"
if [ -f "demucs.wasm" ]; then
    cp demucs.wasm "$OUTPUT_DIR/"
    echo "  ✓ demucs.wasm ($(du -h demucs.wasm | cut -f1))"
fi

if [ -f "demucs.js" ]; then
    cp demucs.js "$OUTPUT_DIR/"
    echo "  ✓ demucs.js"
fi

echo ""
echo -e "${GREEN}=== Build Complete ===${NC}"
echo ""
echo "WASM module built successfully!"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo ""
echo "1. Download model weights:"
echo "   curl -L -o $OUTPUT_DIR/htdemucs.ggml \\"
echo "     https://github.com/sevagh/freemusicdemixer.com/releases/download/v1.0.0/htdemucs.ggml"
echo ""
echo "   # Or for 6-stem model:"
echo "   curl -L -o $OUTPUT_DIR/htdemucs_6s.ggml \\"
echo "     https://github.com/sevagh/freemusicdemixer.com/releases/download/v1.0.0/htdemucs_6s.ggml"
echo ""
echo "2. Update CDN URL in demucs-wasm-loader.ts:"
echo "   const WASM_CDN_BASE = 'https://your-cdn.com/demucs';"
echo ""
echo "3. Deploy files to your CDN:"
echo "   - $OUTPUT_DIR/demucs.wasm"
echo "   - $OUTPUT_DIR/htdemucs.ggml (81MB)"
echo "   - $OUTPUT_DIR/htdemucs_6s.ggml (53MB, optional)"
echo ""
echo "4. Ensure CORS headers are set:"
echo "   Access-Control-Allow-Origin: *"
echo "   Cross-Origin-Embedder-Policy: require-corp"
echo "   Cross-Origin-Opener-Policy: same-origin"
echo ""
