"""Endpoint que recibe los datos de Samsung Health desde la app Android y los guarda en GCS.

Variables de entorno:
  INGEST_TOKEN  token compartido; la app lo envía como "Authorization: Bearer <token>".
  BUCKET        bucket de GCS donde se guardan los JSON.

Escribe dos objetos por envío:
  samsung-health/<fecha>.json   histórico
  samsung-health/latest.json    último envío (lo que Claude lee)
"""

import hmac
import json
import os
from datetime import datetime, timezone

import functions_framework
from google.cloud import storage

INGEST_TOKEN = os.environ.get("INGEST_TOKEN", "")
BUCKET = os.environ.get("BUCKET", "")


@functions_framework.http
def ingest(request):
    if request.method != "POST":
        return ("method not allowed", 405)

    if not INGEST_TOKEN or not BUCKET:
        return ("server not configured", 500)

    auth = request.headers.get("Authorization", "")
    expected = f"Bearer {INGEST_TOKEN}"
    if not hmac.compare_digest(auth, expected):
        return ("unauthorized", 401)

    payload = request.get_json(silent=True)
    if payload is None:
        return ("invalid json", 400)

    body = json.dumps(payload, ensure_ascii=False)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

    bucket = storage.Client().bucket(BUCKET)
    bucket.blob(f"samsung-health/{stamp}.json").upload_from_string(
        body, content_type="application/json"
    )
    bucket.blob("samsung-health/latest.json").upload_from_string(
        body, content_type="application/json"
    )

    return ({"ok": True, "stored": stamp}, 200)
