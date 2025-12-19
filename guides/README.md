# 🎓 Cloud-Based Learning Platform

A production-grade, cloud-native learning platform built with microservices architecture, event-driven design, and AWS infrastructure.

## 📋 Project Status

- ✅ **Phase 1**: AWS Infrastructure (COMPLETED)
- 🚧 **Phase 2**: Microservices & Kafka Layer (IN PROGRESS)
- ⏳ **Phase 3**: Security, Storage & CI/CD (PENDING)

## 🏗️ Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for complete system design.

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Docker & Docker Compose
- AWS CLI configured
- kubectl (for Kubernetes deployment)

### Local Development

```bash
# Clone and setup
git clone <repo-url>
cd cloud-learning-platform

# Start all services
docker-compose up -d

# Create Kafka topics
python scripts/create_topics.py

# Run migrations
cd user-service && alembic upgrade head
```

### Service Endpoints

- **API Gateway**: http://localhost
- **API Docs**: http://localhost/docs
- **User Service**: http://localhost:8000
- **Aggregator**: http://localhost:8080

## 📁 Project Structure

```
cloud-learning-platform/
├── aggregator/              # Backend for Frontend (BFF)
├── user-service/            # Authentication & user management
├── document-service/        # Document processing & notes
├── quiz-service/            # Quiz generation & scoring
├── chat-service/           # Conversational AI
├── tts-service/            # Text-to-Speech
├── stt-service/            # Speech-to-Text
├── notification-service/   # Email/push notifications
├── shared/                 # Shared Python package
├── frontend/               # React application
├── k8s/                    # Kubernetes manifests
├── kafka/                   # Kafka topic configs
├── scripts/                 # Deployment scripts
└── docker/                 # Docker configs
```

## 🧪 Testing

```bash
# Run all tests
pytest

# Test specific service
pytest user-service/tests/
```

## 📚 Documentation

- [Architecture Documentation](./ARCHITECTURE.md)
- [API Documentation](./docs/API.md)
- [Deployment Guide](./docs/DEPLOYMENT.md)

## 🔐 Security

- JWT-based authentication
- IAM roles for service-to-AWS communication
- Encrypted storage (S3, RDS, EBS)
- TLS 1.3 for all communications

## 📊 Monitoring

- Prometheus for metrics
- Grafana for dashboards
- CloudWatch for logs
- Distributed tracing with OpenTelemetry

## 🤝 Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## 📄 License

MIT License

