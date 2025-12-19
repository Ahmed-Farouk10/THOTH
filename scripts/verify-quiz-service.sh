#!/bin/bash
# Quiz Service Verification Script

echo "=========================================="
echo "Quiz Service Structure Verification"
echo "=========================================="

# Check file structure
echo ""
echo "📂 Checking file structure..."
MISSING_FILES=0

check_file() {
    if [ -f "$1" ]; then
        echo "  ✅ $1"
    else
        echo "  ❌ MISSING: $1"
        MISSING_FILES=$((MISSING_FILES + 1))
    fi
}

check_file "platform/quiz-service/Dockerfile"
check_file "platform/quiz-service/requirements.txt"
check_file "platform/quiz-service/src/__init__.py"
check_file "platform/quiz-service/src/main.py"
check_file "platform/quiz-service/src/worker.py"
check_file "platform/quiz-service/src/database.py"
check_file "platform/quiz-service/src/models.py"
check_file "platform/quiz-service/src/schemas.py"
check_file "platform/quiz-service/src/services/__init__.py"
check_file "platform/quiz-service/src/services/kafka_service.py"
check_file "platform/quiz-service/src/services/s3_service.py"
check_file "platform/quiz-service/src/services/ai_service.py"

if [ $MISSING_FILES -eq 0 ]; then
    echo ""
    echo "✅ All required files present!"
else
    echo ""
    echo "❌ Missing $MISSING_FILES file(s)"
    exit 1
fi

# Check requirements.txt for lightweight deps
echo ""
echo "📦 Checking requirements.txt..."
if grep -q "langchain" platform/quiz-service/requirements.txt; then
    echo "  ⚠️  WARNING: LangChain found in requirements.txt (should be removed)"
else
    echo "  ✅ No LangChain dependencies (lightweight)"
fi

if grep -q "httpx" platform/quiz-service/requirements.txt; then
    echo "  ✅ httpx found (correct)"
else
    echo "  ❌ httpx not found in requirements.txt"
fi

# Check docker-compose.yml
echo ""
echo "🐳 Checking docker-compose.yml..."
if grep -q "quiz-service:" docker-compose.yml; then
    echo "  ✅ quiz-service found in docker-compose.yml"
else
    echo "  ❌ quiz-service not found in docker-compose.yml"
fi

if grep -q "quiz-worker:" docker-compose.yml; then
    echo "  ✅ quiz-worker found in docker-compose.yml"
else
    echo "  ❌ quiz-worker not found in docker-compose.yml"
fi

# Check environment variables
echo ""
echo "🔐 Checking environment variables..."
if [ -f ".env" ]; then
    if grep -q "HUGGINGFACE_API_KEY" .env; then
        echo "  ✅ HUGGINGFACE_API_KEY found in .env"
    else
        echo "  ⚠️  WARNING: HUGGINGFACE_API_KEY not found in .env"
    fi
else
    echo "  ⚠️  .env file not found (will use environment variables from docker-compose.yml)"
fi

echo ""
echo "=========================================="
echo "Verification Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Ensure HUGGINGFACE_API_KEY is set (in .env or environment)"
echo "2. Build: docker-compose build quiz-service quiz-worker"
echo "3. Start: docker-compose up -d quiz-service quiz-worker"
echo "4. Check logs: docker-compose logs -f quiz-worker"
echo ""

