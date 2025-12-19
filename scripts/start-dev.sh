#!/bin/bash
# Development Environment Startup Script

set -e  # Exit on error

echo " Starting Cloud Learning Platform Development Environment..."

# Create necessary directories
mkdir -p logs/nginx

# Stop any running containers
echo " Stopping existing containers..."
docker-compose down

# Build and start all services
echo " Building and starting services..."
docker-compose up -d --build

# Wait for services to be healthy
echo " Waiting for services to be ready..."
sleep 10

# Wait for Kafka to be ready
echo " Waiting for Kafka..."
until docker-compose exec -T kafka kafka-broker-api-versions --bootstrap-server localhost:9092 > /dev/null 2>&1; do
    echo "   Kafka not ready yet, waiting..."
    sleep 2
done

# Wait for database to be ready
echo " Waiting for database..."
until docker-compose exec -T user-db pg_isready -U platformadmin > /dev/null 2>&1; do
    echo "   Database not ready yet, waiting..."
    sleep 2
done

# Run database migrations
echo " Running database migrations..."
docker-compose exec -T user-service alembic upgrade head || echo "   Migrations may have already run"

# Create Kafka topics
echo " Creating Kafka topics..."
docker-compose exec -T kafka kafka-topics --create --if-not-exists \
    --bootstrap-server localhost:9092 \
    --topic document.uploaded \
    --partitions 6 \
    --replication-factor 1 || echo "   Topic may already exist"

docker-compose exec -T kafka kafka-topics --create --if-not-exists \
    --bootstrap-server localhost:9092 \
    --topic document.processed \
    --partitions 6 \
    --replication-factor 1 || echo "   Topic may already exist"

# Or use Python script
echo " Creating all Kafka topics (Python script)..."
docker-compose exec -T aggregator python /app/scripts/create_topics.py || echo "   Topics may already exist"

echo ""
echo " Development environment is ready!"
echo ""
echo " Services:"
echo "   - API Gateway: http://localhost"
echo "   - API Docs: http://localhost/docs"
echo "   - User Service: http://localhost:8000"
echo "   - Aggregator: http://localhost:8080"
echo ""
echo " Kafka:"
echo "   - Broker: localhost:9092"
echo "   - Topics: Use 'docker-compose exec kafka kafka-topics --list --bootstrap-server localhost:9092'"
echo ""
echo "Useful commands:"
echo "   - View logs: docker-compose logs -f [service-name]"
echo "   - Stop all: docker-compose down"
echo "   - Restart service: docker-compose restart [service-name]"

