#!/usr/bin/env bash
# Despliega el endpoint de ingesta como Cloud Function (2nd gen).
#
# Uso:
#   PROJECT=mi-proyecto BUCKET=mi-bucket INGEST_TOKEN=... ./deploy.sh
#
# Genera un token con: openssl rand -hex 32
# El token va en local.properties del celular como claude.ingestToken.
set -euo pipefail

: "${PROJECT:?define PROJECT}"
: "${BUCKET:?define BUCKET}"
: "${INGEST_TOKEN:?define INGEST_TOKEN}"
REGION="${REGION:-us-central1}"
FUNCTION="${FUNCTION:-samsung-health-ingest}"

cd "$(dirname "$0")"

gcloud services enable cloudfunctions.googleapis.com run.googleapis.com \
  artifactregistry.googleapis.com storage.googleapis.com --project "$PROJECT"

gsutil mb -p "$PROJECT" -l "$REGION" "gs://$BUCKET" 2>/dev/null || true

gcloud functions deploy "$FUNCTION" \
  --gen2 \
  --project "$PROJECT" \
  --region "$REGION" \
  --runtime python312 \
  --entry-point ingest \
  --source . \
  --trigger-http \
  --allow-unauthenticated \
  --set-env-vars "BUCKET=$BUCKET,INGEST_TOKEN=$INGEST_TOKEN"

echo "Listo. URL:"
gcloud functions describe "$FUNCTION" --gen2 --project "$PROJECT" --region "$REGION" \
  --format='value(serviceConfig.uri)'
