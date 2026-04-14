#!/bin/bash

# NexaStory Build Script
# This script builds NexaStory for the current platform

set -e

echo "🚀 NexaStory Build Script"
echo "========================="

# Detect OS
OS="$(uname -s)"
case "$OS" in
    Linux*)     MACHINE="Linux";;
    Darwin*)    MACHINE="Mac";;
    CYGWIN*)    MACHINE="Cygwin";;
    MINGW*)     MACHINE="MinGw";;
    *)          MACHINE="Unknown";;
esac

echo "📦 Detected OS: $MACHINE"

# Detect CPU features
detect_cpu_features() {
    if command -v lscpu &> /dev/null; then
        FLAGS=$(lscpu | grep -oE '(avx512[a-z]*|avx2|avx[^2]|sse[0-9_]*)' | head -1)
        echo "🔍 Detected CPU feature: $FLAGS"
    fi
}

# Install dependencies
install_deps() {
    echo "📦 Installing dependencies..."
    
    if [ "$MACHINE" == "Mac" ]; then
        brew install node || true
    elif [ "$MACHINE" == "Linux" ]; then
        sudo apt-get update
        sudo apt-get install -y \
            libgtk-3-dev \
            libwebkit2gtk-4.1-dev \
            libappindicator3-dev \
            librsvg2-dev \
            patchelf \
            libasound2-dev \
            || true
    fi
    
    # Install bun if not present
    if ! command -v bun &> /dev/null; then
        echo "Installing bun..."
        curl -fsSL https://bun.sh/install | bash
        export PATH="$HOME/.bun/bin:$PATH"
    fi
    
    bun install
}

# Build function
build() {
    local FEATURES="$1"
    echo "🔨 Building with features: $FEATURES"
    
    # Detect best feature
    if [ -z "$FEATURES" ]; then
        if [ "$MACHINE" == "Mac" ]; then
            FEATURES="llama-metal"
        else
            FEATURES="llama-native"
        fi
    fi
    
    bun run tauri build --release --features $FEATURES
}

# Main
detect_cpu_features

# Check for command line arguments
case "$1" in
    install)
        install_deps
        ;;
    build)
        build "$2"
        ;;
    dev)
        bun run tauri dev
        ;;
    cuda)
        build "llama-cuda"
        ;;
    metal)
        build "llama-metal"
        ;;
    vulkan)
        build "llama-vulkan"
        ;;
    avx2)
        export RUSTFLAGS="-C target-cpu=native -C target-feature=+avx2,+fma"
        build "llama-native"
        ;;
    avx512)
        export RUSTFLAGS="-C target-cpu=native -C target-feature=+avx512f,+avx512dq,+avx512vl"
        build "llama-native"
        ;;
    *)
        echo "Usage: $0 {install|build|dev|cuda|metal|vulkan|avx2|avx512}"
        echo ""
        echo "Commands:"
        echo "  install  - Install all dependencies"
        echo "  build    - Build for current platform"
        echo "  dev      - Start development server"
        echo "  cuda     - Build with CUDA support"
        echo "  metal    - Build with Metal support (macOS)"
        echo "  vulkan   - Build with Vulkan support"
        echo "  avx2     - Build with AVX2 optimization"
        echo "  avx512   - Build with AVX-512 optimization"
        exit 1
        ;;
esac

echo "✅ Done!"
