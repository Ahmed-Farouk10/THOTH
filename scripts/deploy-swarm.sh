#!/bin/bash
# ==============================================================================
# Deploy THOTH Stack to Docker Swarm
# Usage: ./deploy-swarm.sh [environment] [image-tag]
# Example: ./deploy-swarm.sh prod v1.2.3
# ==============================================================================

set -e

# Configuration
ENVIRONMENT=${1:-prod}
IMAGE_TAG=${2:-latest}
STACK_NAME="thoth"
COMPOSE_FILE="docker-compose.prod.yml"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║        THOTH Docker Swarm Deployment Script               ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Environment:${NC} $ENVIRONMENT"
echo -e "${YELLOW}Image Tag:${NC} $IMAGE_TAG"
echo -e "${YELLOW}Stack Name:${NC} $STACK_NAME"
echo ""

# Load environment variables
if [ -f ".env.${ENVIRONMENT}" ]; then
    echo -e "${GREEN}✓${NC} Loading environment variables from .env.${ENVIRONMENT}"
    set -a
    source ".env.${ENVIRONMENT}"
    set +a
else
    echo -e "${RED}✗${NC} Environment file .env.${ENVIRONMENT} not found!"
    echo "   Create it from .env.${ENVIRONMENT}.template"
    exit 1
fi

# Export IMAGE_TAG
export IMAGE_TAG

# Check if Swarm is initialized
if ! docker info | grep -q "Swarm: active"; then
    echo -e "${RED}✗${NC} Docker Swarm is not initialized!"
    echo "   Run: docker swarm init"
    exit 1
fi

echo -e "${GREEN}✓${NC} Docker Swarm is active"

# Create/Update secrets from AWS Secrets Manager
echo ""
echo -e "${YELLOW}Syncing secrets from AWS Secrets Manager...${NC}"

SECRETS=(
    "jwt_secret"
    "aws_access_key"
    "aws_secret_key"
    "user_db_password"
    "document_db_password"
    "notification_db_password"
    "quiz_db_password"
    "chat_db_password"
    "groq_api_key_1"
    "groq_api_key_2"
    "groq_api_key_3"
    "groq_api_key_4"
    "groq_api_key_5"
    "groq_api_key_6"
    "google_api_key"
    "chat_google_api_key"
)

for secret in "${SECRETS[@]}"; do
    # Check if secret exists in Swarm
    if docker secret inspect "$secret" &> /dev/null; then
        echo -e "${YELLOW}⊙${NC} Secret $secret already exists (skipping)"
    else
        echo -e "${GREEN}+${NC} Creating secret: $secret"
        # Fetch from AWS Secrets Manager
        aws secretsmanager get-secret-value \
            --secret-id "thoth/${ENVIRONMENT}/${secret}" \
            --query 'SecretString' \
            --output text | \
            docker secret create "$secret" -
    fi
done

# Create/Update Nginx config
echo ""
echo -e "${YELLOW}Updating Nginx configuration...${NC}"
if docker config inspect nginx_config &> /dev/null; then
    echo -e "${YELLOW}⊙${NC} Config nginx_config already exists"
    echo "   To update, remove with: docker config rm nginx_config"
else
    echo -e "${GREEN}+${NC} Creating config: nginx_config"
    docker config create nginx_config nginx/nginx.conf
fi

# Label nodes (if not already labeled)
echo ""
echo -e "${YELLOW}Checking node labels...${NC}"

# Label nodes for Kafka (optional, adjust as needed)
MANAGER_NODES=$(docker node ls --filter "role=manager" -q)
for node in $MANAGER_NODES; do
    docker node update --label-add kafka=true "$node" 2>/dev/null || true
done

# Label high-compute workers
WORKER_NODES=$(docker node ls --filter "role=worker" -q | head -n 3)
for node in $WORKER_NODES; do
    docker node update --label-add compute=high "$node" 2>/dev/null || true
done

echo -e "${GREEN}✓${NC} Node labels configured"

# Deploy the stack
echo ""
echo -e "${YELLOW}Deploying stack: ${STACK_NAME}...${NC}"
docker stack deploy \
    --compose-file "$COMPOSE_FILE" \
    --with-registry-auth \
    "$STACK_NAME"

echo ""
echo -e "${GREEN}✓${NC} Stack deployment initiated"

# Wait for services to start
echo ""
echo -e "${YELLOW}Waiting for services to start...${NC}"
sleep 10

# Show stack status
echo ""
echo -e "${YELLOW}Stack Services:${NC}"
docker stack services "$STACK_NAME"

echo ""
echo -e "${YELLOW}Service Logs (recent):${NC}"
echo "   View logs: docker service logs ${STACK_NAME}_<service-name>"
echo "   Example: docker service logs ${STACK_NAME}_user-service"

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Deployment Complete!                                      ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Monitor deployment: ${YELLOW}watch docker stack ps ${STACK_NAME}${NC}"
echo -e "View services: ${YELLOW}docker stack services ${STACK_NAME}${NC}"
echo -e "Remove stack: ${YELLOW}docker stack rm ${STACK_NAME}${NC}"
echo ""
