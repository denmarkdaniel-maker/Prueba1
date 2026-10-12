# Conexión con Samsung Health

Samsung Health **no tiene una API en la nube**: los datos viven en el teléfono (y en la
nube privada de Samsung, sin acceso para terceros). Por eso la conexión se hace desde el
propio celular, por una de estas dos rutas:

| | Ruta A: App Android + Health Connect | Ruta B: Exportación de Samsung Health + Python |
|---|---|---|
| Qué es | App propia que lee Health Connect, donde Samsung Health sincroniza sus datos | Archivo oficial "Descargar datos personales" de Samsung Health, limpiado con Python |
| Datos | Pasos, distancia, calorías, pisos, FC, FC en reposo, VFC, SpO2, sueño (con etapas), ejercicio, peso y composición corporal, presión, glucosa, temperatura, hidratación, nutrición, VO2 máx | **Todo** lo que guarda Samsung Health, incluido estrés, puntaje de sueño y datos que no pasan a Health Connect |
| Historial | Completo, si concedes el permiso de historial (si no, solo 30 días) | Completo |
| Repetible | Sí, un toque cada vez que quieras actualizar | Manual (se pide la descarga cada vez) |
| Salida | 2 CSV en `Descargas/SamsungHealth` | CSV limpios + Excel + resumen diario |

Las dos rutas terminan en archivos que se cargan en Power BI con las consultas de [`powerbi/`](powerbi).

---

## Todo desde el celular (sin PC)

1. **Samsung Health → ⋮ → Ajustes → Health Connect** → activa todos los datos.
2. **Descargar la app** (se compila sola en GitHub cada vez que cambia el código):
   en el navegador del celular, con tu sesión de GitHub iniciada, abre
   `https://github.com/denmarkdaniel-maker/Prueba1/actions/workflows/samsung-health-apk.yml`,
   entra a la última ejecución con ✅ y toca **SamsungHealthExport** (abajo, en *Artifacts*).
   Se descarga un .zip: ábrelo con **Mis archivos**, extrae `SamsungHealthExport.apk` y tócalo.
   Android pedirá permitir "instalar apps desconocidas" para Mis archivos: acéptalo.
   > Para actualizar a una versión nueva, desinstala la anterior primero (tus datos no se pierden:
   > viven en Samsung Health / Health Connect).
3. Abre **Exportar Samsung Health**:
   1. **Conceder permisos** → *Permitir todo* + *Acceder a datos anteriores*.
   2. **Ver mi análisis** → panel en el teléfono: KPIs del periodo (7, 30, 90 días o 1 año) comparados
      con el periodo anterior, gráficos de pasos, sueño, FC en reposo, peso y ejercicio,
      patrón por día de la semana y hallazgos automáticos.
   3. **Exportar todos mis datos** → CSV completos en *Descargas/SamsungHealth*.
   4. **Compartir CSV** → envíalos a la app de Claude para un análisis más profundo, a Excel móvil o a Drive.

---

## Paso previo: activar la sincronización con Health Connect (Ruta A)

1. En el celular abre **Samsung Health → ⋮ → Ajustes → Health Connect**.
2. Activa el acceso y marca **todos** los tipos de datos para que Samsung Health los *escriba* en Health Connect.
3. En Android 14 o superior Health Connect ya viene en el sistema (Ajustes → Seguridad y privacidad → Health Connect).
   En Android 10–13 instala "Health Connect" desde Play Store.

## Ruta A — App Android (`android/`)

Requisitos: Android Studio (Ladybug o más nuevo) y el celular con **depuración USB** activada
(Ajustes → Acerca del teléfono → Información de software → tocar 7 veces "Número de compilación";
luego Opciones de desarrollador → Depuración USB).

1. Abre la carpeta `samsung-health/android` en Android Studio y deja que sincronice Gradle.
2. Conecta el celular por USB y presiona **Run ▶**.
3. En la app:
   1. **Conceder permisos** → en la pantalla de Health Connect elige *Permitir todo*, y acepta
      también *"Acceder a datos anteriores"* (es el permiso de historial; sin él solo verás 30 días).
   2. **Exportar todos mis datos** → espera el mensaje "✔ Listo".
4. Los archivos quedan en **Descargas/SamsungHealth** del teléfono:
   - `salud_registros_AAAAMMDD_HHMM.csv` — cada medición en una fila
     (`tipo, inicio_utc, fin_utc, inicio_local, fin_local, valor, unidad, detalle, app_origen, dispositivo, id_registro`).
   - `salud_resumen_diario_AAAAMMDD_HHMM.csv` — una fila por día con pasos, distancia, calorías,
     pisos, FC prom/mín/máx, FC en reposo, horas de sueño, minutos de ejercicio y peso.
5. Pásalos al PC (USB, Google Drive, correo) y cárgalos en Power BI.

> **Importante para el análisis:** no sumes los `Pasos` de `salud_registros` si usas reloj + teléfono:
> ambos registran los mismos pasos. Usa `salud_resumen_diario`, donde Health Connect ya eliminó los
> duplicados según la prioridad de fuentes. Filtra `app_origen = com.sec.android.app.shealth` si
> quieres solo lo que vino de Samsung Health.

Estructura del código:

| Archivo | Qué hace |
|---|---|
| `RecordSpecs.kt` | Lista de los 28 tipos de datos que se leen y cómo cada uno se convierte en filas. Para agregar un tipo: una línea aquí + su permiso en `AndroidManifest.xml` |
| `HealthExporter.kt` | Lee página por página desde 2012 y arma el resumen diario por año con la agregación de Health Connect |
| `CsvOutput.kt` | Escribe CSV UTF-8 (con BOM para Excel) en Descargas (requiere Android 10+) |
| `MainActivity.kt` | Pantalla principal: permisos, exportar, análisis, compartir |
| `DailySummary.kt` | Totales diarios sin duplicados (los usan el CSV de resumen y el panel) |
| `DashboardActivity.kt` / `ChartView.kt` | Panel de análisis en el teléfono con KPIs, gráficos y hallazgos |
| `PrivacyActivity.kt` | Pantalla de privacidad que Health Connect exige para conceder permisos |

## Ruta B — Exportación completa + Python (`python/`)

1. En el celular: **Samsung Health → ⋮ → Ajustes → Descargar datos personales** (en algunas
   versiones: *Ajustes → Datos personales → Descargar*). Inicia sesión con tu cuenta Samsung.
2. Se genera la carpeta `Samsung Health/samsunghealth_<usuario>_<fecha>` en la memoria interna.
   Cópiala al PC (o comprímela en .zip).
3. En el PC:

   ```bash
   cd samsung-health/python
   pip install -r requirements.txt
   python samsung_health_export.py "C:\ruta\samsunghealth_usuario_20261012" salida --excel
   ```

4. En `salida/` queda:
   - `resumen_diario.csv` — pasos (total combinado de todos los dispositivos, sin duplicar), distancia,
     calorías, FC prom/mín/máx, horas de sueño (asignadas al día en que despiertas), peso, minutos y
     sesiones de ejercicio, estrés promedio.
   - `catalogo.csv` — todas las tablas exportadas con filas y rango de fechas.
   - `tablas/*.csv` — cada tipo de dato limpio: sin el prefijo `com.samsung.health...` en las columnas,
     con fechas convertidas y columnas `*_local` en tu hora local (según `time_offset`).
   - `SamsungHealth.xlsx` — lo mismo en Excel (las tablas de más de 1.048.575 filas solo quedan en CSV).

Pruebas: `python -m unittest discover -s tests`

## Power BI (`powerbi/`)

- `ResumenDiario.pq` — consulta para cualquiera de los dos resúmenes diarios (agrega año, mes y día de la semana).
- `Registros_HealthConnect.pq` — consulta para el CSV de registros de la app.
- `Medidas.dax` — medidas de ejemplo: promedio de pasos, % de días ≥ 10.000 pasos, sueño promedio,
  media móvil de 7 días, último peso.

Pega cada `.pq` en *Transformar datos → Nueva consulta → Consulta en blanco → Editor avanzado* y cambia la ruta.

## Privacidad

Nada sale del teléfono ni del PC: la app no tiene permiso de internet y el script trabaja solo con
archivos locales. **No subas los CSV con tus datos de salud a este repositorio** (el `.gitignore` de
esta carpeta ya excluye las salidas típicas).
