# Samsung Health Bridge

App Android mínima que lee datos de Samsung Health en el celular y los envía por
POST al webhook de la sesión de Claude.

**Estado:** esqueleto sin compilar. La conexión HTTP al webhook está implementada;
las llamadas al Samsung Health Data SDK en `SamsungHealthReader.kt` están marcadas
`VERIFICAR` y lanzan `UnsupportedOperationException` hasta completarse.

## Pasos

1. **Registrar la app en Samsung.** Crear cuenta en developer.samsung.com/health,
   registrar el paquete `com.example.shbridge` y la firma (SHA-256 del keystore).
   Samsung exige este registro para leer datos.
2. **Descargar el AAR** del Samsung Health Data SDK y copiarlo a
   `android/app/libs/`. El nombre debe terminar en `.aar`.
3. **Completar `SamsungHealthReader.kt`** siguiendo la documentación de la
   versión descargada (cada punto `VERIFICAR`).
4. **Configurar la URL del webhook** en `android/local.properties` (no se versiona):

   ```properties
   sdk.dir=/ruta/a/Android/Sdk
   claude.webhookUrl=URL_DEL_WEBHOOK
   ```

5. Compilar con Android Studio (o `./gradlew assembleDebug` desde `android/`),
   instalar en el celular y pulsar **Enviar a Claude**.

## Seguridad y privacidad

- La URL del webhook funciona como credencial: cualquiera que la tenga puede
  enviar mensajes a la sesión. No la subas al repositorio ni la compartas.
- Los datos de salud se envían en texto plano por HTTPS a la sesión. Revisa que
  el consentimiento sea tuyo o de la persona cuyos datos se envían.
- El webhook expira cuando termina la sesión de Claude. Para volver a sincronizar
  hay que crear uno nuevo y actualizar `local.properties`.
