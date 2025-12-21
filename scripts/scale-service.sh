#!/bin/bash
# ==============================================================================
# Scale THOTH Services
# Usage: ./scale-service.sh <service-name> <replicas>
# Example: ./scale-service.sh document-worker 10
# ==============================================================================

set -e

STACK_NAME="thoth"
SERVICE_NAME=${1}
REPLICAS=${2}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [ -z "$SERVICE_NAME" ] || [ -z "$REPLICAS" ]; then
    echo -e "${RED}✗${NC} Missing arguments!"
    echo ""
    echo "Usage: $0 <service-name> <replicas>"
    echo ""
    echo "Example: $0 document-worker 10"
    echo ""
    echo "Available services:"
    docker stack services "$STACK_NAME" --format "  - {{.Name}} ({{.Replicas}})"
    exit 1
fi

FULL_SERVICE_NAME="${STACK_NAME}_${SERVICE_NAME}"

# Check if service exists
if ! docker service inspect "$FULL_SERVICE_NAME" &> /dev/null; then
    echo -e "${RED}✗${NC} Service $FULL_SERVICE_NAME not found!"
    exit 1
fi

# Get current replicas
CURRENT_REPLICAS=$(docker service inspect "$FULL_SERVICE_NAME" --format '{{.Spec.Mode.Replicated.Replicas}}')

echo -e "${YELLOW}Service:${NC} $FULL_SERVICE_NAME"
echo -e "${YELLOW}Current replicas:${NC} $CURRENT_REPLICAS"
echo -e "${YELLOW}Target replicas:${NC} $REPLICAS"
echo ""

read -p "Proceed with scaling? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo -e "${YELLOW}Scaling cancelled.${NC}"
    exit 0
fi

echo ""
echo -e "${YELLOW}Scaling service...${NC}"
docker service scale "${FULL_SERVICE_NAME}=${REPLICAS}"

echo ""
echo -e "${GREEN}✓${NC} Service scaled to $REPLICAS replicas"
echo ""
echo -e "Monitor: ${YELLOW}watch docker service ps ${FULL_SERVICE_NAME}${NC}"
