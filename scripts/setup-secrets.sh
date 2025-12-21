#!/bin/bash
# ==============================================================================
# Setup AWS Secrets Manager - Run this after getting AWS access
# ==============================================================================

set -e

ENVIRONMENT=${1:-prod}

echo "🔐 Setting up secrets for environment: $ENVIRONMENT"

# Load environment variables
if [ ! -f ".env.$ENVIRONMENT" ]; then
    echo "❌ Error: .env.$ENVIRONMENT not found!"
    echo "   Please copy .env.$ENVIRONMENT.template and fill in values"
    exit 1
fi

source ".env.$ENVIRONMENT"

# Function to create secret
create_secret() {
    local secret_name=$1
    local secret_value=$2
    
    if aws secretsmanager describe-secret --secret-id "$secret_name" &>/dev/null; then
        echo "⊙ Secret $secret_name already exists - updating"
        aws secretsmanager put-secret-value \
            --secret-id "$secret_name" \
            --secret-string "$secret_value"
    else
        echo "+ Creating secret: $secret_name"
        aws secretsmanager create-secret \
            --name "$secret_name" \
            --secret-string "$secret_value"
    fi
}

echo ""
echo "📝 TODO: Before running this script, ensure these values are set in .env.$ENVIRONMENT:"
echo "  - GROQ_API_KEY (and _2 through _6)"
echo "  - GOOGLE_API_KEY"
echo "  - CHAT_GOOGLE_API_KEY"
echo "  - Database passwords (or we'll generate them)"
echo ""
read -p "Have you filled in the .env.$ENVIRONMENT file? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "❌ Aborted. Please fill in .env.$ENVIRONMENT first."
    exit 1
fi

# Generate JWT secret if not provided
JWT_SECRET=${JWT_SECRET:-$(openssl rand -base64 32)}

echo "Creating secrets in AWS Secrets Manager..."

# JWT Secret
create_secret "thoth/$ENVIRONMENT/jwt_secret" "$JWT_SECRET"

# AWS Credentials (these should use IAM roles in production)
echo "⚠️ Note: For production, use IAM roles instead of access keys"
read -p "Do you want to store AWS credentials as secrets? (yes/no): " store_aws
if [ "$store_aws" == "yes" ]; then
    read -p "AWS Access Key ID: " aws_key
    read -s -p "AWS Secret Access Key: " aws_secret
    echo ""
    create_secret "thoth/$ENVIRONMENT/aws_access_key" "$aws_key"
    create_secret "thoth/$ENVIRONMENT/aws_secret_key" "$aws_secret"
fi

# Database Passwords
create_secret "thoth/$ENVIRONMENT/user_db_password" "${USER_DB_PASSWORD:-$(openssl rand -base64 24)}"
create_secret "thoth/$ENVIRONMENT/document_db_password" "${DOCUMENT_DB_PASSWORD:-$(openssl rand -base64 24)}"
create_secret "thoth/$ENVIRONMENT/notification_db_password" "${NOTIFICATION_DB_PASSWORD:-$(openssl rand -base64 24)}"
create_secret "thoth/$ENVIRONMENT/quiz_db_password" "${QUIZ_DB_PASSWORD:-$(openssl rand -base64 24)}"
create_secret "thoth/$ENVIRONMENT/chat_db_password" "${CHAT_DB_PASSWORD:-$(openssl rand -base64 24)}"

# API Keys
if [ -z "$GROQ_API_KEY" ] || [ "$GROQ_API_KEY" == "YOUR_GROQ_API_KEY_1_HERE" ]; then
    echo "⚠️ Warning: GROQ_API_KEY not set - skipping Groq API keys"
    echo "   Get keys from: https://console.groq.com/keys"
else
    create_secret "thoth/$ENVIRONMENT/groq_api_key_1" "$GROQ_API_KEY"
    create_secret "thoth/$ENVIRONMENT/groq_api_key_2" "${GROQ_API_KEY_2:-$GROQ_API_KEY}"
    create_secret "thoth/$ENVIRONMENT/groq_api_key_3" "${GROQ_API_KEY_3:-$GROQ_API_KEY}"
    create_secret "thoth/$ENVIRONMENT/groq_api_key_4" "${GROQ_API_KEY_4:-$GROQ_API_KEY}"
    create_secret "thoth/$ENVIRONMENT/groq_api_key_5" "${GROQ_API_KEY_5:-$GROQ_API_KEY}"
    create_secret "thoth/$ENVIRONMENT/groq_api_key_6" "${GROQ_API_KEY_6:-$GROQ_API_KEY}"
fi

if [ -z "$GOOGLE_API_KEY" ] || [ "$GOOGLE_API_KEY" == "YOUR_GOOGLE_GEMINI_API_KEY_HERE" ]; then
    echo "⚠️ Warning: GOOGLE_API_KEY not set - skipping Google API keys"
    echo "   Get key from: https://aistudio.google.com/app/apikey"
else
    create_secret "thoth/$ENVIRONMENT/google_api_key" "$GOOGLE_API_KEY"
    create_secret "thoth/$ENVIRONMENT/chat_google_api_key" "${CHAT_GOOGLE_API_KEY:-$GOOGLE_API_KEY}"
fi

echo ""
echo "✅ Secrets setup complete for environment: $ENVIRONMENT"
echo ""
echo "To verify:"
echo "  aws secretsmanager list-secrets --query 'SecretList[?contains(Name, \`thoth/$ENVIRONMENT\`)].Name'"
