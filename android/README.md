# Samsung Health Bridge

App Android mínima que lee datos de Samsung Health y los envía por POST al
webhook de la sesión de Claude.

La lectura se hace a través de **Health Connect** (la capa de Android que Samsung
Health usa para compartir datos). No necesitas el SDK de Samsung ni registrar la
app en developer.samsung.com.

**Estado:** sin compilar. Se escribió sin Android SDK disponible, así que los
nombres de la API de Health Connect deben confirmarse al primer build.

## Pasos

1. **Activar la sincronización en Samsung Health.** En el celular, Samsung Health
   → configuración → Health Connect, y activar cada tipo de dato que quieras
   enviar (sueño, pasos, ejercicio, frecuencia cardíaca, presión, glucosa,
   SpO2). Health Connect debe estar instalado (en Android 14+ viene integrado).
2. **Desplegar el endpoint** en Google Cloud (ver `server/deploy.sh`). Requiere
   un proyecto, `gcloud` autenticado y un token:

   ```bash
   PROJECT=mi-proyecto BUCKET=mi-bucket INGEST_TOKEN=$(openssl rand -hex 32) ./server/deploy.sh
   ```

3. **Configurar la app** en `android/local.properties` (no se versiona):

   ```properties
   sdk.dir=/ruta/a/Android/Sdk
   claude.webhookUrl=URL_QUE_IMPRIME_deploy.sh
   claude.ingestToken=MISMO_TOKEN_DEL_DEPLOY
   ```

4. Compilar con Android Studio (o `./gradlew assembleDebug` desde `android/`),
   instalar en el celular, abrir la app y pulsar **Enviar a Claude**. La primera
   vez pedirá permisos de lectura en Health Connect.

## Seguridad y privacidad

- El token `claude.ingestToken` es la credencial del endpoint. No lo subas al
  repositorio ni lo compartas. Los datos quedan en tu bucket de GCS.
- Los datos de salud se envían por HTTPS a la sesión. Asegúrate de que el
  consentimiento sea tuyo o de la persona cuyos datos se envían.
- Para leer los datos, Claude consulta `gs://<BUCKET>/samsung-health/latest.json`.
  Si el bucket es privado, Claude necesita acceso a ese bucket (cuenta de servicio
  o `gcloud` autenticado en la sesión).
