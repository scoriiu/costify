#!/bin/bash
set -euo pipefail

REGISTRY="registry.costify.ro"
IMAGE="$REGISTRY/costify"
KUBECONFIG="$HOME/.kube/costify-k3s.yaml"
NAMESPACE="costify"
TAG="${1:-latest}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "==> Building costify:$TAG for linux/arm64..."
docker buildx build \
  --platform linux/arm64 \
  -t "$IMAGE:$TAG" \
  -t "$IMAGE:latest" \
  --push \
  "$PROJECT_DIR"

echo "==> Applying k8s manifests..."
kubectl --kubeconfig="$KUBECONFIG" apply -f "$SCRIPT_DIR/namespace.yaml"
kubectl --kubeconfig="$KUBECONFIG" apply -f "$SCRIPT_DIR/postgres.yaml"
kubectl --kubeconfig="$KUBECONFIG" apply -f "$SCRIPT_DIR/registry.yaml"
kubectl --kubeconfig="$KUBECONFIG" apply -f "$SCRIPT_DIR/umami.yaml"
kubectl --kubeconfig="$KUBECONFIG" apply -f "$SCRIPT_DIR/app.yaml"
kubectl --kubeconfig="$KUBECONFIG" apply -f "$SCRIPT_DIR/ingress.yaml"

echo "==> Rolling restart costify app..."
kubectl --kubeconfig="$KUBECONFIG" -n "$NAMESPACE" rollout restart deployment/costify

echo "==> Waiting for rollout..."
kubectl --kubeconfig="$KUBECONFIG" -n "$NAMESPACE" rollout status deployment/costify --timeout=120s

echo "==> Status:"
kubectl --kubeconfig="$KUBECONFIG" -n "$NAMESPACE" get pods

echo ""
echo "Done! https://costify.ro"
