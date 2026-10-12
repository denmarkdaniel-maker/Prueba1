package cl.salud.samsungexport

import android.content.Context
import android.net.Uri
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/**
 * Lee Health Connect y genera dos CSV:
 *  - salud_registros_*.csv : todas las mediciones crudas, una por fila (formato largo).
 *  - salud_resumen_diario_*.csv : totales por día calculados por Health Connect,
 *    que ya elimina duplicados entre teléfono y reloj (usar este para sumar pasos/calorías).
 */
class HealthExporter(
    private val context: Context,
    private val client: HealthConnectClient,
    private val log: (String) -> Unit,
) {
    companion object {
        /** Samsung Health (ex S Health) existe desde 2012: se pide todo desde ahí. */
        val DESDE: LocalDate = LocalDate.of(2012, 1, 1)

        val ALL_PERMISSIONS: Set<String> =
            RECORD_SPECS.map { it.permission }.toSet() + HealthPermission.PERMISSION_READ_HEALTH_DATA_HISTORY
    }

    private val zone = ZoneId.systemDefault()
    private val stamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmm"))

    /** Archivos generados en la última exportación (para compartirlos). */
    private val files = mutableListOf<Uri>()

    suspend fun exportAll(): List<Uri> {
        val granted = client.permissionController.getGrantedPermissions()
        if (HealthPermission.PERMISSION_READ_HEALTH_DATA_HISTORY !in granted) {
            log("⚠ Sin permiso de historial: Health Connect solo entregará los últimos 30 días.")
        }
        exportRecords(granted)
        exportDailySummary(granted)
        log("✔ Listo. Toca «Compartir CSV» para enviarlos a Claude, Excel o Drive.")
        return files
    }

    private suspend fun exportRecords(granted: Set<String>) {
        val start = DESDE.atStartOfDay(zone).toInstant()
        val end = Instant.now()
        CsvOutput(context, "salud_registros_$stamp.csv").use { csv ->
            csv.writeRow(
                "tipo", "inicio_utc", "fin_utc", "inicio_local", "fin_local",
                "valor", "unidad", "detalle", "app_origen", "dispositivo", "id_registro",
            )
            for (spec in RECORD_SPECS) {
                if (spec.permission !in granted) {
                    log("· ${spec.nombre}: sin permiso, se omite")
                    continue
                }
                try {
                    val n = spec.export(client, start, end) { rows -> rows.forEach { writeRecordRow(csv, it) } }
                    log("· ${spec.nombre}: $n registros")
                } catch (e: Exception) {
                    log("✖ ${spec.nombre}: ${e.message}")
                }
            }
            files += csv.uri
            log("Registros guardados en ${csv.location}")
        }
    }

    private fun writeRecordRow(csv: CsvOutput, r: Row) {
        fun local(i: Instant?) = i?.let {
            (r.offset?.let { off -> it.atOffset(off).toLocalDateTime() } ?: LocalDateTime.ofInstant(it, zone)).toString()
        }
        val device = r.meta.device?.let { listOfNotNull(it.manufacturer, it.model).joinToString(" ") }
        csv.writeRow(
            r.tipo, r.inicio, r.fin, local(r.inicio), local(r.fin),
            r.valor, r.unidad, r.detalle, r.meta.dataOrigin.packageName, device, r.meta.id,
        )
    }

    private suspend fun exportDailySummary(granted: Set<String>) {
        val cols = DailySummary.availableColumns(granted)
        if (cols.isEmpty()) return
        val days = DailySummary.query(client, cols, DESDE, LocalDate.now(zone).plusDays(1)) { log("✖ $it") }
        CsvOutput(context, "salud_resumen_diario_$stamp.csv").use { csv ->
            csv.writeRow("fecha", *cols.map { it.header }.toTypedArray())
            for (d in days) csv.writeRow(d.fecha, *cols.map { d[it.header] }.toTypedArray())
            files += csv.uri
            log("· Resumen diario: ${days.size} días con datos")
            log("Resumen guardado en ${csv.location}")
        }
    }
}
