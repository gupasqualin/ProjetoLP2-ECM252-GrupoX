#!/usr/bin/env bash
# Executa a solucao computacional no Kubernetes.
# Uso: ./kubernetes/up.sh [up|status|down]

set -euo pipefail

cd "$(dirname "$0")/.."

ACAO="${1:-up}"
NAMESPACE="valuation"
MANIFESTO="kubernetes/backend.yaml"

if ! command -v kubectl >/dev/null 2>&1; then
  echo "kubectl nao encontrado. Instale o kubectl e configure um cluster Kubernetes."
  exit 1
fi

case "$ACAO" in
  up)
    echo "Aplicando os manifests Kubernetes..."
    echo "A imagem valuation-backend:1.0.0 deve existir no ambiente do cluster."
    kubectl apply -f "$MANIFESTO"
    echo
    echo "Recursos criados. Estado atual:"
    kubectl get pods,services -n "$NAMESPACE"
    ;;

  status)
    kubectl get deployments,pods,services -n "$NAMESPACE"
    ;;

  down)
    echo "Removendo o namespace e os recursos da aplicacao..."
    kubectl delete namespace "$NAMESPACE"
    ;;

  *)
    echo "Uso: ./kubernetes/up.sh [up|status|down]"
    exit 1
    ;;
esac
