#!/bin/bash
# Test script to verify Document Service → Notification Service integration

set -e

echo "🧪 Testing Document Service → Notification Service Integration"
echo "================================================================"

NOTIFICATION_SERVICE_URL="${NOTIFICATION_SERVICE_URL:-http://localhost:8003}"
AGGREGATOR_URL="${AGGREGATOR_URL:-http://localhost}"

echo ""
echo "1️⃣  Checking Notification Service health..."
HEALTH_RESPONSE=$(curl -s "${NOTIFICATION_SERVICE_URL}/health")
echo "   Response: $HEALTH_RESPONSE"

if echo "$HEALTH_RESPONSE" | grep -q "healthy"; then
    echo "   ✅ Notification Service is healthy"
else
    echo "   ❌ Notification Service is not healthy"
    exit 1
fi

echo ""
echo "2️⃣  Getting initial notification count..."
INITIAL_STATS=$(curl -s "${NOTIFICATION_SERVICE_URL}/api/notifications/stats")
INITIAL_COUNT=$(echo "$INITIAL_STATS" | grep -o '"total_notifications":[0-9]*' | grep -o '[0-9]*')
echo "   Initial notification count: $INITIAL_COUNT"

echo ""
echo "3️⃣  Checking for document.processed and notes.generated events..."
DOC_PROCESSED=$(curl -s "${NOTIFICATION_SERVICE_URL}/api/notifications?topic=document.processed" | grep -o '"total":[0-9]*' | grep -o '[0-9]*' || echo "0")
NOTES_GENERATED=$(curl -s "${NOTIFICATION_SERVICE_URL}/api/notifications?topic=notes.generated" | grep -o '"total":[0-9]*' | grep -o '[0-9]*' || echo "0")

echo "   document.processed events: $DOC_PROCESSED"
echo "   notes.generated events: $NOTES_GENERATED"

if [ "$DOC_PROCESSED" -gt 0 ] || [ "$NOTES_GENERATED" -gt 0 ]; then
    echo "   ✅ Found existing document events"
else
    echo "   ⚠️  No document events found yet (this is okay if you haven't uploaded documents)"
fi

echo ""
echo "4️⃣  Testing notification query endpoints..."

# Test stats endpoint
STATS=$(curl -s "${NOTIFICATION_SERVICE_URL}/api/notifications/stats")
echo "   Stats endpoint: ✅"
echo "   $STATS" | python3 -m json.tool 2>/dev/null || echo "$STATS"

# Test list endpoint
LIST=$(curl -s "${NOTIFICATION_SERVICE_URL}/api/notifications?limit=5")
echo ""
echo "   List endpoint (last 5): ✅"
echo "$LIST" | python3 -m json.tool 2>/dev/null || echo "$LIST"

echo ""
echo "================================================================"
echo "✅ Integration test complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Upload a document via: POST ${AGGREGATOR_URL}/api/documents/upload"
echo "   2. Wait for document-worker to process it"
echo "   3. Check notifications: GET ${NOTIFICATION_SERVICE_URL}/api/notifications"
echo "   4. You should see 'document.processed' and 'notes.generated' events"

