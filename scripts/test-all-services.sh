#!/bin/bash
# Test all services after they're running
# Usage: ./scripts/test-all-services.sh

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Service URLs
USER_SERVICE_URL="http://localhost:8000"
AGGREGATOR_URL="http://localhost:8080"
DOCUMENT_SERVICE_URL="http://localhost:8002"
NOTIFICATION_SERVICE_URL="http://localhost:8003"
QUIZ_SERVICE_URL="http://localhost:8004"
API_GATEWAY_URL="http://localhost"

print_header() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

test_health() {
    local url=$1
    local name=$2
    
    if curl -sf "$url/health" > /dev/null 2>&1; then
        local response=$(curl -sf "$url/health")
        print_success "$name: $response"
        return 0
    else
        print_error "$name: Not responding"
        return 1
    fi
}

test_endpoint() {
    local method=$1
    local url=$2
    local name=$3
    local data=$4
    
    if [ "$method" = "GET" ]; then
        if curl -sf "$url" > /dev/null 2>&1; then
            print_success "$name"
            return 0
        else
            print_error "$name"
            return 1
        fi
    elif [ "$method" = "POST" ]; then
        if [ -n "$data" ]; then
            if curl -sf -X POST "$url" -H "Content-Type: application/json" -d "$data" > /dev/null 2>&1; then
                print_success "$name"
                return 0
            else
                print_error "$name"
                return 1
            fi
        else
            if curl -sf -X POST "$url" > /dev/null 2>&1; then
                print_success "$name"
                return 0
            else
                print_error "$name"
                return 1
            fi
        fi
    fi
}

main() {
    print_header "Testing All Services"
    
    local passed=0
    local total=0
    
    # Health checks
    print_info "Health Checks:"
    test_health "$USER_SERVICE_URL" "User Service" && ((passed++)) || true
    ((total++))
    
    test_health "$AGGREGATOR_URL" "Aggregator" && ((passed++)) || true
    ((total++))
    
    test_health "$DOCUMENT_SERVICE_URL" "Document Service" && ((passed++)) || true
    ((total++))
    
    test_health "$NOTIFICATION_SERVICE_URL" "Notification Service" && ((passed++)) || true
    ((total++))
    
    test_health "$QUIZ_SERVICE_URL" "Quiz Service" && ((passed++)) || true
    ((total++))
    
    # API Gateway
    if curl -sf "$API_GATEWAY_URL/health" > /dev/null 2>&1; then
        print_success "API Gateway: OK"
        ((passed++))
    else
        print_error "API Gateway: Not responding"
    fi
    ((total++))
    
    # Summary
    print_header "Results"
    echo -e "Passed: ${GREEN}$passed${NC}/${total}"
    
    if [ $passed -eq $total ]; then
        print_success "All services are healthy!"
        exit 0
    else
        print_error "Some services failed"
        exit 1
    fi
}

main "$@"

