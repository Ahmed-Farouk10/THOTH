#!/bin/bash
# ==============================================================================
# Health Check Script for THOTH Stack
# Usage: ./health-check.sh
# ==============================================================================

set -e

STACK_NAME="thoth"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        THOTH Stack Health Check                           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if stack exists
if ! docker stack ps "$STACK_NAME" &> /dev/null; then
    echo -e "${RED}✗${NC} Stack $STACK_NAME is not deployed!"
    exit 1
fi

echo -e "${GREEN}✓${NC} Stack $STACK_NAME is deployed"
echo ""

# Get all services
SERVICES=$(docker stack services "$STACK_NAME" --format "{{.Name}}")

echo -e "${YELLOW}Service Health Status:${NC}"
echo ""

TOTAL=0
HEALTHY=0
UNHEALTHY=0

for service in $SERVICES; do
    TOTAL=$((TOTAL + 1))
    
    # Get replicas
    REPLICAS=$(docker service ls --filter "name=$service" --format "{{.Replicas}}")
    
    # Parse replicas (format: running/desired)
    RUNNING=$(echo "$REPLICAS" | cut -d'/' -f1)
    DESIRED=$(echo "$REPLICAS" | cut -d'/' -f2)
    
    # Check if service is healthy
    if [ "$RUNNING" == "$DESIRED" ] && [ "$RUNNING" != "0" ]; then
        echo -e "  ${GREEN}✓${NC} ${service}: ${REPLICAS}"
        HEALTHY=$((HEALTHY + 1))
    else
        echo -e "  ${RED}✗${NC} ${service}: ${REPLICAS}"
        UNHEALTHY=$((UNHEALTHY + 1))
        
        # Show failed tasks
        echo -e "    ${YELLOW}Failed tasks:${NC}"
        docker service ps "$service" --filter "desired-state=running" --format "      - {{.Name}}: {{.CurrentState}}" | head -n 3
    fi
done

echo ""
echo -e "${YELLOW}Summary:${NC}"
echo -e "  Total services: $TOTAL"
echo -e "  ${GREEN}Healthy: $HEALTHY${NC}"
echo -e "  ${RED}Unhealthy: $UNHEALTHY${NC}"
echo ""

# Check node status
echo -e "${YELLOW}Cluster Nodes:${NC}"
docker node ls
echo ""

# Show resource usage
echo -e "${YELLOW}Resource Usage:${NC}"
echo ""
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" | head -n 20

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Health Check Complete                                     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"

if [ $UNHEALTHY -gt 0 ]; then
    exit 1
fi
