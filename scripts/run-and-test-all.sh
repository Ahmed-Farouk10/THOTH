#!/bin/bash
# Comprehensive script to run and test all services
# Works on Linux, Mac, and Windows (Git Bash/WSL)

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
MAX_WAIT_TIME=120  # Maximum seconds to wait for services
HEALTH_CHECK_INTERVAL=5  # Seconds between health checks
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Service URLs
API_GATEWAY_URL="http://localhost"
USER_SERVICE_URL="http://localhost:8000"
AGGREGATOR_URL="http://localhost:8080"
DOCUMENT_SERVICE_URL="http://localhost:8002"
NOTIFICATION_SERVICE_URL="http://localhost:8003"
QUIZ_SERVICE_URL="http://localhost:8004"

# Helper functions
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

print_step() {
    echo -e "${BLUE}▶ $1${NC}"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check if service is healthy
check_health() {
    local url=$1
    local service_name=$2
    
    if command_exists curl; then
        curl -sf "$url/health" > /dev/null 2>&1
    elif command_exists wget; then
        wget -q --spider "$url/health" > /dev/null 2>&1
    else
        print_error "Neither curl nor wget found. Cannot check health."
        return 1
    fi
}

# Wait for service to be healthy
wait_for_service() {
    local url=$1
    local service_name=$2
    local elapsed=0
    
    print_info "Waiting for $service_name to be healthy..."
    
    while [ $elapsed -lt $MAX_WAIT_TIME ]; do
        if check_health "$url" "$service_name"; then
            print_success "$service_name is healthy"
            return 0
        fi
        
        sleep $HEALTH_CHECK_INTERVAL
        elapsed=$((elapsed + HEALTH_CHECK_INTERVAL))
        echo -n "."
    done
    
    echo ""
    print_error "$service_name failed to become healthy within ${MAX_WAIT_TIME}s"
    return 1
}

# Wait for Kafka to be ready
wait_for_kafka() {
    print_info "Waiting for Kafka to be ready..."
    local elapsed=0
    
    while [ $elapsed -lt $MAX_WAIT_TIME ]; do
        if docker-compose exec -T kafka kafka-broker-api-versions --bootstrap-server localhost:9092 > /dev/null 2>&1; then
            print_success "Kafka is ready"
            return 0
        fi
        
        sleep $HEALTH_CHECK_INTERVAL
        elapsed=$((elapsed + HEALTH_CHECK_INTERVAL))
        echo -n "."
    done
    
    echo ""
    print_error "Kafka failed to become ready within ${MAX_WAIT_TIME}s"
    return 1
}

# Wait for database to be ready
wait_for_database() {
    local db_name=$1
    local user=$2
    print_info "Waiting for $db_name to be ready..."
    local elapsed=0
    
    while [ $elapsed -lt $MAX_WAIT_TIME ]; do
        if docker-compose exec -T "$db_name" pg_isready -U "$user" > /dev/null 2>&1; then
            print_success "$db_name is ready"
            return 0
        fi
        
        sleep $HEALTH_CHECK_INTERVAL
        elapsed=$((elapsed + HEALTH_CHECK_INTERVAL))
        echo -n "."
    done
    
    echo ""
    print_error "$db_name failed to become ready within ${MAX_WAIT_TIME}s"
    return 1
}

# Test service endpoint
test_endpoint() {
    local method=$1
    local url=$2
    local expected_status=$3
    local description=$4
    local data=$5
    
    print_step "Testing: $description"
    
    local status_code
    if [ "$method" = "GET" ]; then
        if command_exists curl; then
            status_code=$(curl -s -o /dev/null -w "%{http_code}" "$url")
        elif command_exists wget; then
            status_code=$(wget --spider -S "$url" 2>&1 | grep "HTTP/" | awk '{print $2}' | head -1)
        fi
    elif [ "$method" = "POST" ]; then
        if command_exists curl; then
            if [ -n "$data" ]; then
                status_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$url" \
                    -H "Content-Type: application/json" \
                    -d "$data")
            else
                status_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$url")
            fi
        elif command_exists wget; then
            print_info "POST requests require curl (wget not supported)"
            return 1
        fi
    fi
    
    if [ "$status_code" = "$expected_status" ]; then
        print_success "$description (Status: $status_code)"
        return 0
    else
        print_error "$description (Expected: $expected_status, Got: $status_code)"
        return 1
    fi
}

# Main execution
main() {
    print_header "Cloud Learning Platform - Service Runner & Tester"
    
    # Check prerequisites
    print_header "Checking Prerequisites"
    
    if ! command_exists docker; then
        print_error "Docker is not installed or not in PATH"
        exit 1
    fi
    print_success "Docker found"
    
    if ! command_exists docker-compose; then
        print_error "Docker Compose is not installed or not in PATH"
        exit 1
    fi
    print_success "Docker Compose found"
    
    if ! command_exists curl && ! command_exists wget; then
        print_error "Neither curl nor wget found. Please install one of them."
        exit 1
    fi
    print_success "HTTP client found ($(command_exists curl && echo 'curl' || echo 'wget'))"
    
    # Navigate to project root
    cd "$PROJECT_ROOT"
    print_info "Working directory: $PROJECT_ROOT"
    
    # Stop existing containers
    print_header "Stopping Existing Containers"
    docker-compose down > /dev/null 2>&1 || true
    print_success "Stopped existing containers"
    
    # Build and start services
    print_header "Building and Starting Services"
    print_info "This may take a few minutes on first run..."
    
    # Enable BuildKit for faster builds
    export DOCKER_BUILDKIT=1
    export COMPOSE_DOCKER_CLI_BUILD=1
    
    docker-compose up -d --build
    print_success "Services started"
    
    # Wait for infrastructure services
    print_header "Waiting for Infrastructure Services"
    
    wait_for_kafka || exit 1
    
    wait_for_database "user-db" "platformadmin" || exit 1
    wait_for_database "document-db" "postgres" || exit 1
    wait_for_database "notification-db" "postgres" || exit 1
    wait_for_database "quiz-db" "postgres" || exit 1
    
    # Run migrations
    print_header "Running Database Migrations"
    print_info "Running user-service migrations..."
    docker-compose exec -T user-service alembic upgrade head > /dev/null 2>&1 || \
        print_info "Migrations may have already run"
    print_success "Migrations completed"
    
    # Create Kafka topics
    print_header "Creating Kafka Topics"
    if docker-compose exec -T aggregator python /app/scripts/create_topics.py 2>/dev/null; then
        print_success "Kafka topics created"
    else
        print_info "Topics may already exist or aggregator not ready yet"
        # Try direct Kafka command as fallback
        sleep 5
        docker-compose exec -T kafka kafka-topics --create --if-not-exists \
            --bootstrap-server localhost:9092 \
            --topic document.uploaded \
            --partitions 6 \
            --replication-factor 1 > /dev/null 2>&1 || true
    fi
    
    # Wait for application services
    print_header "Waiting for Application Services"
    
    wait_for_service "$USER_SERVICE_URL" "User Service" || exit 1
    wait_for_service "$AGGREGATOR_URL" "Aggregator" || exit 1
    wait_for_service "$DOCUMENT_SERVICE_URL" "Document Service" || exit 1
    wait_for_service "$NOTIFICATION_SERVICE_URL" "Notification Service" || exit 1
    wait_for_service "$QUIZ_SERVICE_URL" "Quiz Service" || exit 1
    
    # Test services
    print_header "Testing Services"
    
    local test_results=0
    local total_tests=0
    
    # Test User Service
    print_info "Testing User Service..."
    test_endpoint "GET" "$USER_SERVICE_URL/health" "200" "User Service Health" && ((test_results++)) || true
    ((total_tests++))
    
    # Test Aggregator
    print_info "Testing Aggregator..."
    test_endpoint "GET" "$AGGREGATOR_URL/health" "200" "Aggregator Health" && ((test_results++)) || true
    ((total_tests++))
    
    # Test Document Service
    print_info "Testing Document Service..."
    test_endpoint "GET" "$DOCUMENT_SERVICE_URL/health" "200" "Document Service Health" && ((test_results++)) || true
    ((total_tests++))
    
    # Test Notification Service
    print_info "Testing Notification Service..."
    test_endpoint "GET" "$NOTIFICATION_SERVICE_URL/health" "200" "Notification Service Health" && ((test_results++)) || true
    ((total_tests++))
    
    # Test Quiz Service
    print_info "Testing Quiz Service..."
    test_endpoint "GET" "$QUIZ_SERVICE_URL/health" "200" "Quiz Service Health" && ((test_results++)) || true
    ((total_tests++))
    
    # Test API Gateway
    print_info "Testing API Gateway..."
    if command_exists curl; then
        if curl -sf "$API_GATEWAY_URL/health" > /dev/null 2>&1; then
            print_success "API Gateway Health (Status: 200)"
            ((test_results++))
        else
            print_error "API Gateway Health (Not responding)"
        fi
    fi
    ((total_tests++))
    
    # Summary
    print_header "Test Summary"
    echo -e "Tests Passed: ${GREEN}$test_results${NC}/${total_tests}"
    
    if [ $test_results -eq $total_tests ]; then
        print_success "All services are healthy and responding!"
    else
        print_error "Some services failed health checks"
        print_info "Check logs with: docker-compose logs [service-name]"
    fi
    
    # Service information
    print_header "Service Information"
    echo -e "API Gateway:     ${BLUE}$API_GATEWAY_URL${NC}"
    echo -e "User Service:    ${BLUE}$USER_SERVICE_URL${NC}"
    echo -e "Aggregator:      ${BLUE}$AGGREGATOR_URL${NC}"
    echo -e "Document Svc:    ${BLUE}$DOCUMENT_SERVICE_URL${NC}"
    echo -e "Notification:    ${BLUE}$NOTIFICATION_SERVICE_URL${NC}"
    echo -e "Quiz Service:    ${BLUE}$QUIZ_SERVICE_URL${NC}"
    echo ""
    echo -e "View logs:       ${YELLOW}docker-compose logs -f [service-name]${NC}"
    echo -e "Stop all:         ${YELLOW}docker-compose down${NC}"
    echo -e "Restart service: ${YELLOW}docker-compose restart [service-name]${NC}"
    
    print_header "Done"
    
    if [ $test_results -eq $total_tests ]; then
        exit 0
    else
        exit 1
    fi
}

# Run main function
main "$@"

