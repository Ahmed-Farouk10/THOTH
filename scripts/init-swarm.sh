#!/bin/bash
# ==============================================================================
# Initialize Docker Swarm Cluster on AWS EC2
# Run this after Terraform creates the infrastructure
# ==============================================================================

set -e

ENVIRONMENT=${1:-prod}

echo "🐳 Initializing Docker Swarm for environment: $ENVIRONMENT"

# Check if terraform outputs exist
if [ ! -f ".terraform-outputs.json" ]; then
    echo "❌ Error: .terraform-outputs.json not found!"
    echo "   Run: cd terraform/environments/$ENVIRONMENT && terraform output -json > ../../../.terraform-outputs.json"
    exit 1
fi

# Extract manager IPs
MANAGER_IPS=$(cat .terraform-outputs.json | jq -r '.swarm_manager_ips.value[]')
MANAGER_ARRAY=($MANAGER_IPS)
PRIMARY_MANAGER=${MANAGER_ARRAY[0]}

echo "Found ${#MANAGER_ARRAY[@]} manager nodes"
echo "Primary manager: $PRIMARY_MANAGER"

# SSH key
SSH_KEY=${SSH_KEY:-~/.ssh/id_rsa}
if [ ! -f "$SSH_KEY" ]; then
    echo "❌ Error: SSH key not found at $SSH_KEY"
    echo "   Set SSH_KEY environment variable or generate key: ssh-keygen -t rsa -b 4096"
    exit 1
fi

echo "Using SSH key: $SSH_KEY"

# Initialize Swarm on primary manager
echo ""
echo "📡 Initializing Swarm on primary manager: $PRIMARY_MANAGER"
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no ec2-user@$PRIMARY_MANAGER << 'EOF'
    # Check if already initialized
    if docker info | grep -q "Swarm: active"; then
        echo "⊙ Swarm already initialized"
        docker node ls
    else
        echo "+ Initializing Swarm"
        MANAGER_IP=$(hostname -i)
        docker swarm init --advertise-addr $MANAGER_IP
        
        # Label this node
        docker node update --label-add kafka=true $(docker node ls -q)
    fi
EOF

# Get join tokens
echo ""
echo "📋 Getting join tokens..."
MANAGER_TOKEN=$(ssh -i "$SSH_KEY" ec2-user@$PRIMARY_MANAGER "docker swarm join-token manager -q")
WORKER_TOKEN=$(ssh -i "$SSH_KEY" ec2-user@$PRIMARY_MANAGER "docker swarm join-token worker -q")
SWARM_IP=$(ssh -i "$SSH_KEY" ec2-user@$PRIMARY_MANAGER "hostname -i")

echo "Manager token: ${MANAGER_TOKEN:0:20}..."
echo "Worker token: ${WORKER_TOKEN:0:20}..."

# Join other managers
echo ""
echo "👥 Joining other manager nodes..."
for i in "${!MANAGER_ARRAY[@]}"; do
    if [ $i -eq 0 ]; then
        continue  # Skip primary manager
    fi
    
    MANAGER_IP=${MANAGER_ARRAY[$i]}
    echo "Joining manager $((i+1)): $MANAGER_IP"
    
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no ec2-user@$MANAGER_IP << EOF
        if docker info | grep -q "Swarm: active"; then
            echo "⊙ Already part of swarm"
        else
            docker swarm join --token $MANAGER_TOKEN $SWARM_IP:2377
        fi
EOF
    
    # Label for Kafka
    ssh -i "$SSH_KEY" ec2-user@$PRIMARY_MANAGER << EOF
        NODE_ID=\$(docker node ls --filter "role=manager" --format "{{.Hostname}} {{.ID}}" | grep "$MANAGER_IP" | awk '{print \$2}')
        if [ -n "\$NODE_ID" ]; then
            docker node update --label-add kafka=true \$NODE_ID
        fi
EOF
done

# Join worker nodes
echo ""
echo "👷 Joining worker nodes..."
WORKER_IPS=$(cat .terraform-outputs.json | jq -r '.swarm_worker_ips.value[]?' 2>/dev/null || echo "")

if [ -n "$WORKER_IPS" ]; then
    WORKER_ARRAY=($WORKER_IPS)
    
    for i in "${!WORKER_ARRAY[@]}"; do
        WORKER_IP=${WORKER_ARRAY[$i]}
        echo "Joining worker $((i+1)): $WORKER_IP"
        
        ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no ec2-user@$WORKER_IP << EOF
            if docker info | grep -q "Swarm: active"; then
                echo "⊙ Already part of swarm"
            else
                docker swarm join --token $WORKER_TOKEN $SWARM_IP:2377
            fi
EOF
        
        # Label first 3 workers as high-compute
        if [ $i -lt 3 ]; then
            ssh -i "$SSH_KEY" ec2-user@$PRIMARY_MANAGER << EOF
                NODE_ID=\$(docker node ls --filter "role=worker" --format "{{.Hostname}} {{.ID}}" | grep "$WORKER_IP" | awk '{print \$2}')
                if [ -n "\$NODE_ID" ]; then
                    docker node update --label-add compute=high \$NODE_ID
                fi
EOF
        fi
    done
else
    echo "⚠️ No worker nodes found in Terraform outputs"
fi

# Verify cluster
echo ""
echo "✅ Swarm cluster initialized!"
echo ""
echo "Cluster status:"
ssh -i "$SSH_KEY" ec2-user@$PRIMARY_MANAGER "docker node ls"

echo ""
echo "Next steps:"
echo "  1. Run: ./scripts/setup-secrets.sh $ENVIRONMENT"
echo "  2. Run: ./scripts/deploy-swarm.sh $ENVIRONMENT"
