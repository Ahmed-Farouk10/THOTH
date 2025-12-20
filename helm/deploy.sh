#!/bin/bash
# Deploy Cloud5 Platform to Kubernetes
# Usage: ./deploy.sh [namespace] [release-name]

set -e

NAMESPACE=${1:-cloud5-prod}
RELEASE_NAME=${2:-cloud5}

echo "🚀 Deploying Cloud5 Platform"
echo "Namespace: $NAMESPACE"
echo "Release: $RELEASE_NAME"
echo ""

# Create namespace if it doesn't exist
echo "📦 Creating namespace..."
kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

# Update Helm dependencies
echo "📥 Updating Helm dependencies..."
cd helm/cloud5-platform
helm dependency update
cd ../..

# Install/Upgrade the platform
echo "🎯 Installing Cloud5 platform..."
helm upgrade --install $RELEASE_NAME ./helm/cloud5-platform \
  --namespace $NAMESPACE \
  --timeout 15m \
  --wait \
  --atomic \
  --create-namespace

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 Check deployment status:"
echo "  kubectl get pods -n $NAMESPACE"
echo "  kubectl get svc -n $NAMESPACE"
echo ""
echo "🔍 Get Aggregator LoadBalancer URL:"
echo "  kubectl get svc aggregator -n $NAMESPACE"
