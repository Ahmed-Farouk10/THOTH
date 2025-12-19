#!/bin/bash
# Tag and push Docker images with version numbers
# Usage: ./tag_and_push.sh [version] [registry_url]
# Example: ./tag_and_push.sh v1.0.0 123456789012.dkr.ecr.us-east-1.amazonaws.com

set -e

VERSION=${1:-latest}
REGISTRY_URL=${2:-""}

if [ -z "$REGISTRY_URL" ]; then
    echo "Usage: $0 [version] [registry_url]"
    echo "Example: $0 v1.0.0 123456789012.dkr.ecr.us-east-1.amazonaws.com"
    exit 1
fi

SERVICES=(
    "user-service"
    "aggregator"
    "document-service"
    "document-worker"
    "quiz-service"
    "quiz-worker"
    "chat-service"
    "chat-worker"
    "notification-service"
    "tts-service"
    "stt-service"
)

echo "Tagging and pushing images with version: $VERSION"
echo "Registry: $REGISTRY_URL"
echo ""

for service in "${SERVICES[@]}"; do
    local_image="cloud-${service}"
    remote_image="${REGISTRY_URL}/${service}:${VERSION}"
    latest_image="${REGISTRY_URL}/${service}:latest"
    
    echo "Processing $service..."
    
    # Tag with version
    docker tag "$local_image" "$remote_image"
    echo "  ✅ Tagged: $remote_image"
    
    # Also tag as latest
    docker tag "$local_image" "$latest_image"
    echo "  ✅ Tagged: $latest_image"
    
    # Push version tag
    docker push "$remote_image"
    echo "  ✅ Pushed: $remote_image"
    
    # Push latest tag
    docker push "$latest_image"
    echo "  ✅ Pushed: $latest_image"
    
    echo ""
done

echo "✅ All images tagged and pushed successfully!"
echo ""
echo "Images available at:"
for service in "${SERVICES[@]}"; do
    echo "  - ${REGISTRY_URL}/${service}:${VERSION}"
    echo "  - ${REGISTRY_URL}/${service}:latest"
done

