# 👤 User Service

## Purpose
Handles user authentication, registration, and JWT token management.

## Responsibilities (SRP - Single Responsibility)
- User registration and login
- Password hashing and verification
- JWT token generation and validation
- User profile management

## Architecture Layers

```
FastAPI Routes (Controller)
    ↓
UserService (Business Logic)
    ↓
UserRepository (Data Access)
    ↓
PostgreSQL Database
```

## API Endpoints

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and get JWT token
- `GET /api/auth/verify` - Verify JWT token (used by Aggregator)
- `GET /api/users/{user_id}` - Get user profile
- `PUT /api/users/{user_id}` - Update user profile

## Database Schema

See `alembic/versions/` for migration files.

## Environment Variables

```bash
DB_HOST=user-db
DB_PORT=5432
DB_NAME=user_management
DB_USER=platformadmin
DB_PASSWORD=platformpass
SECRET_KEY=your-secret-key-change-in-production
SERVICE_NAME=user-service
LOG_LEVEL=INFO
KAFKA_BROKERS=kafka:9092
```

## Kafka Events

**Produces:**
- `user.created.v1` - When a new user registers

**Consumes:**
- None (this is a foundational service)

## Testing

```bash
# Run tests
pytest user-service/tests/

# Run with coverage
pytest --cov=user-service user-service/tests/
```

