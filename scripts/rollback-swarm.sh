#!/bin/bash
# ==============================================================================
# Rollback THOTH Stack to Previous Version
# Usage: ./rollback-swarm.sh [service-name]
# Example: ./rollback-swarm.sh user-service
# ==============================================================================

set -e

STACK_NAME="thoth"
SERVICE_NAME=${1}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║        THOTH Stack Rollback Script                        ║${NC}"
echo -e "${YELLOW}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

if [ -z "$SERVICE_NAME" ]; then
    echo -e "${RED}✗${NC} Service name required!"
    echo ""
    echo "Usage: $0 <service-name>"
    echo ""
    echo "Available services:"
    docker stack services "$STACK_NAME" --format "  - {{.Name}}"
    exit 1
fi

FULL_SERVICE_NAME="${STACK_NAME}_${SERVICE_NAME}"

# Check if service exists
if ! docker service inspect "$FULL_SERVICE_NAME" &> /dev/null; then
    echo -e "${RED}✗${NC} Service $FULL_SERVICE_NAME not found!"
    echo ""
    echo "Available services:"
    docker stack services "$STACK_NAME" --format "  - {{.Name}}"
    exit 1
fi

echo -e "${YELLOW}Service:${NC} $FULL_SERVICE_NAME"
echo ""
echo -e "${YELLOW}Current image:${NC}"
docker service inspect "$FULL_SERVICE_NAME" --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}'
echo ""

read -p "Are you sure you want to rollback this service? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo -e "${YELLOW}Rollback cancelled.${NC}"
    exit 0
fi

echo ""
echo -e "${YELLOW}Rolling back service...${NC}"
docker service rollback "$FULL_SERVICE_NAME"

echo ""
echo -e "${GREEN}✓${NC} Rollback initiated for $FULL_SERVICE_NAME"
echo ""
echo -e "Monitor rollback: ${YELLOW}watch docker service ps ${FULL_SERVICE_NAME}${NC}"
