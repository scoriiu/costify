#!/bin/bash
set -euo pipefail

REGISTRY="registry.costify.ro"
IMAGE="$REGISTRY/costify"
KUBECONFIG="$HOME/.kube/costify-k3s.yaml"
NAMESPACE="costify"
TAG="${1:-latest}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# NEXT_PUBLIC_* values are baked into the bundle at build time and .env is
# dockerignored, so forward the internal-user list as a build arg.
INTERNAL_EMAILS="$(grep '^NEXT_PUBLIC_INTERNAL_USER_EMAILS=' "$PROJECT_DIR/.env" | cut -d= -f2- | tr -d '"' || true)"

echo "==> Building costify:$TAG for linux/arm64..."
docker buildx build \
  --platform linux/arm64 \
  --build-arg NEXT_PUBLIC_INTERNAL_USER_EMAILS="$INTERNAL_EMAILS" \
  -t "$IMAGE:$TAG" \
  -t "$IMAGE:latest" \
  --push \
  "$PROJECT_DIR"

echo "==> Applying k8s manifests..."
kubectl --kubeconfig="$KUBECONFIG" apply -f "$SCRIPT_DIR/namespace.yaml"
kubectl --kubeconfig="$KUBECONFIG" apply -f "$SCRIPT_DIR/postgres.yaml"
kubectl --kubeconfig="$KUBECONFIG" apply -f "$SCRIPT_DIR/minio.yaml"
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
