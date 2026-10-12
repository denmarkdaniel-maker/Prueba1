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
2. **Configurar la URL del webhook** en `android/local.properties` (no se versiona):

   ```properties
   sdk.dir=/ruta/a/Android/Sdk
   claude.webhookUrl=URL_DEL_WEBHOOK
   ```

3. Compilar con Android Studio (o `./gradlew assembleDebug` desde `android/`),
   instalar en el celular, abrir la app y pulsar **Enviar a Claude**. La primera
   vez pedirá permisos de lectura en Health Connect.

## Seguridad y privacidad

- La URL del webhook funciona como credencial: cualquiera que la tenga puede
  enviar mensajes a la sesión. No la subas al repositorio ni la compartas.
- Los datos de salud se envían por HTTPS a la sesión. Asegúrate de que el
  consentimiento sea tuyo o de la persona cuyos datos se envían.
- El webhook expira cuando termina la sesión de Claude. Para volver a sincronizar
  hay que crear uno nuevo y actualizar `local.properties`.
