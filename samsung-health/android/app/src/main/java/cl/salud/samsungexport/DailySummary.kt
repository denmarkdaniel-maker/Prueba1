package cl.salud.samsungexport

import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.aggregate.AggregateMetric
import androidx.health.connect.client.aggregate.AggregationResult
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.*
import androidx.health.connect.client.request.AggregateGroupByPeriodRequest
import androidx.health.connect.client.time.TimeRangeFilter
import java.time.LocalDate
import java.time.Period
import kotlin.reflect.KClass

/** Un día con sus métricas (null = sin datos ese día). Clave = encabezado de columna. */
class Day(val fecha: LocalDate, val values: Map<String, Double?>) {
    operator fun get(key: String): Double? = values[key]
}

/**
 * Totales y promedios por día calculados por Health Connect. Health Connect elimina
 * los duplicados entre fuentes (teléfono + reloj) según la prioridad de apps, por eso
 * estos totales son los confiables para sumar pasos o calorías.
 */
object DailySummary {
    const val PASOS = "pasos"
    const val DISTANCIA = "distancia_km"
    const val CAL_ACTIVAS = "calorias_activas_kcal"
    const val CAL_TOTALES = "calorias_totales_kcal"
    const val PISOS = "pisos"
    const val FC_PROM = "fc_promedio_lpm"
    const val FC_MIN = "fc_min_lpm"
    const val FC_MAX = "fc_max_lpm"
    const val FC_REPOSO = "fc_reposo_lpm"
    const val SUENO = "sueno_horas"
    const val EJERCICIO = "ejercicio_min"
    const val PESO = "peso_kg"

    class Column<T : Any>(
        val header: String,
        val metric: AggregateMetric<T>,
        type: KClass<out Record>,
        private val toNumber: (T) -> Double,
    ) {
        val permission: String = HealthPermission.getReadPermission(type)
        fun read(result: AggregationResult): Double? = result[metric]?.let(toNumber)
    }

    val COLUMNS: List<Column<*>> = listOf(
        Column(PASOS, StepsRecord.COUNT_TOTAL, StepsRecord::class) { it.toDouble() },
        Column(DISTANCIA, DistanceRecord.DISTANCE_TOTAL, DistanceRecord::class) { it.inKilometers },
        Column(CAL_ACTIVAS, ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL, ActiveCaloriesBurnedRecord::class) {
            it.inKilocalories
        },
        Column(CAL_TOTALES, TotalCaloriesBurnedRecord.ENERGY_TOTAL, TotalCaloriesBurnedRecord::class) { it.inKilocalories },
        Column(PISOS, FloorsClimbedRecord.FLOORS_CLIMBED_TOTAL, FloorsClimbedRecord::class) { it },
        Column(FC_PROM, HeartRateRecord.BPM_AVG, HeartRateRecord::class) { it.toDouble() },
        Column(FC_MIN, HeartRateRecord.BPM_MIN, HeartRateRecord::class) { it.toDouble() },
        Column(FC_MAX, HeartRateRecord.BPM_MAX, HeartRateRecord::class) { it.toDouble() },
        Column(FC_REPOSO, RestingHeartRateRecord.BPM_AVG, RestingHeartRateRecord::class) { it.toDouble() },
        Column(SUENO, SleepSessionRecord.SLEEP_DURATION_TOTAL, SleepSessionRecord::class) { it.seconds / 3600.0 },
        Column(EJERCICIO, ExerciseSessionRecord.EXERCISE_DURATION_TOTAL, ExerciseSessionRecord::class) { it.seconds / 60.0 },
        Column(PESO, WeightRecord.WEIGHT_AVG, WeightRecord::class) { it.inKilograms },
    )

    fun availableColumns(granted: Set<String>) = COLUMNS.filter { it.permission in granted }

    /** Días entre [from] y [toExclusive] que tienen al menos un dato. Consulta por tramos de un año. */
    suspend fun query(
        client: HealthConnectClient,
        columns: List<Column<*>>,
        from: LocalDate,
        toExclusive: LocalDate,
        onError: (String) -> Unit = {},
    ): List<Day> {
        if (columns.isEmpty()) return emptyList()
        val days = mutableListOf<Day>()
        var start = from
        while (start.isBefore(toExclusive)) {
            val end = minOf(start.plusYears(1), toExclusive)
            try {
                val groups = client.aggregateGroupByPeriod(
                    AggregateGroupByPeriodRequest(
                        metrics = columns.map { it.metric }.toSet(),
                        timeRangeFilter = TimeRangeFilter.between(start.atStartOfDay(), end.atStartOfDay()),
                        timeRangeSlicer = Period.ofDays(1),
                    )
                )
                for (g in groups) {
                    val values = columns.associate { it.header to it.read(g.result) }
                    if (values.values.any { it != null }) days += Day(g.startTime.toLocalDate(), values)
                }
            } catch (e: Exception) {
                onError("Resumen $start → $end: ${e.message}")
            }
            start = end
        }
        return days
    }
}
