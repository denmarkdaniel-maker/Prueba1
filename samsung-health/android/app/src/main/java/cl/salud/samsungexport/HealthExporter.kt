package cl.salud.samsungexport

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.aggregate.AggregateMetric
import androidx.health.connect.client.aggregate.AggregationResult
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.*
import androidx.health.connect.client.request.AggregateGroupByPeriodRequest
import androidx.health.connect.client.time.TimeRangeFilter
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.Period
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

    suspend fun exportAll() {
        val granted = client.permissionController.getGrantedPermissions()
        if (HealthPermission.PERMISSION_READ_HEALTH_DATA_HISTORY !in granted) {
            log("⚠ Sin permiso de historial: Health Connect solo entregará los últimos 30 días.")
        }
        exportRecords(granted)
        exportDailySummary(granted)
        log("✔ Listo. Abre los archivos en Excel o cárgalos en Power BI.")
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

    /** Columna del resumen diario: métrica de Health Connect + cómo convertirla a número. */
    private class Column<T : Any>(
        val header: String,
        val metric: AggregateMetric<T>,
        val recordPermission: String,
        private val toNumber: (T) -> Double,
    ) {
        fun read(result: AggregationResult): Double? = result[metric]?.let(toNumber)
    }

    private fun columns(): List<Column<*>> = listOf(
        Column("pasos", StepsRecord.COUNT_TOTAL, perm(StepsRecord::class)) { it.toDouble() },
        Column("distancia_km", DistanceRecord.DISTANCE_TOTAL, perm(DistanceRecord::class)) { it.inKilometers },
        Column("calorias_activas_kcal", ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL, perm(ActiveCaloriesBurnedRecord::class)) {
            it.inKilocalories
        },
        Column("calorias_totales_kcal", TotalCaloriesBurnedRecord.ENERGY_TOTAL, perm(TotalCaloriesBurnedRecord::class)) {
            it.inKilocalories
        },
        Column("pisos", FloorsClimbedRecord.FLOORS_CLIMBED_TOTAL, perm(FloorsClimbedRecord::class)) { it },
        Column("fc_promedio_lpm", HeartRateRecord.BPM_AVG, perm(HeartRateRecord::class)) { it.toDouble() },
        Column("fc_min_lpm", HeartRateRecord.BPM_MIN, perm(HeartRateRecord::class)) { it.toDouble() },
        Column("fc_max_lpm", HeartRateRecord.BPM_MAX, perm(HeartRateRecord::class)) { it.toDouble() },
        Column("fc_reposo_lpm", RestingHeartRateRecord.BPM_AVG, perm(RestingHeartRateRecord::class)) { it.toDouble() },
        Column("sueno_horas", SleepSessionRecord.SLEEP_DURATION_TOTAL, perm(SleepSessionRecord::class)) { it.seconds / 3600.0 },
        Column("ejercicio_min", ExerciseSessionRecord.EXERCISE_DURATION_TOTAL, perm(ExerciseSessionRecord::class)) {
            it.seconds / 60.0
        },
        Column("peso_kg", WeightRecord.WEIGHT_AVG, perm(WeightRecord::class)) { it.inKilograms },
    )

    private fun perm(type: kotlin.reflect.KClass<out Record>) = HealthPermission.getReadPermission(type)

    private suspend fun exportDailySummary(granted: Set<String>) {
        val cols = columns().filter { it.recordPermission in granted }
        if (cols.isEmpty()) return
        CsvOutput(context, "salud_resumen_diario_$stamp.csv").use { csv ->
            csv.writeRow("fecha", *cols.map { it.header }.toTypedArray())
            var days = 0
            val today = LocalDate.now(zone)
            var from = DESDE
            // Se consulta por año para no pedir miles de grupos en una sola llamada
            while (!from.isAfter(today)) {
                val to = minOf(from.plusYears(1), today.plusDays(1))
                try {
                    val groups = client.aggregateGroupByPeriod(
                        AggregateGroupByPeriodRequest(
                            metrics = cols.map { it.metric }.toSet(),
                            timeRangeFilter = TimeRangeFilter.between(from.atStartOfDay(), to.atStartOfDay()),
                            timeRangeSlicer = Period.ofDays(1),
                        )
                    )
                    for (g in groups) {
                        val values = cols.map { it.read(g.result) }
                        if (values.all { it == null }) continue
                        csv.writeRow(g.startTime.toLocalDate(), *values.toTypedArray())
                        days++
                    }
                } catch (e: Exception) {
                    log("✖ Resumen $from → $to: ${e.message}")
                }
                from = to
            }
            log("· Resumen diario: $days días con datos")
            log("Resumen guardado en ${csv.location}")
        }
    }
}
