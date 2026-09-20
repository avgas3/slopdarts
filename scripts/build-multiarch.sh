#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/build-multiarch.sh <image:tag> [--push]
# Example: ./scripts/build-multiarch.sh mattmunin/slopdarts:1.0.0 --push

IMAGE=${1:-}
if [ -z "$IMAGE" ]; then
  echo "Usage: $0 <image:tag> [--push]"
  exit 2
fi

PUSH=false
if [ "${2:-}" = "--push" ]; then
  PUSH=true
fi

PLATFORMS="linux/amd64,linux/arm64"

# Ensure buildx builder exists
if ! docker buildx inspect multiarch >/dev/null 2>&1; then
  docker buildx create --use --name multiarch
fi

if [ "$PUSH" = true ]; then
  docker buildx build --platform "$PLATFORMS" -t "$IMAGE" --push .
else
  # For local testing of a single platform, use --load for the current host
  docker buildx build --platform "$PLATFORMS" -t "$IMAGE" --load .
fi

echo "Built $IMAGE (platforms: $PLATFORMS)"
