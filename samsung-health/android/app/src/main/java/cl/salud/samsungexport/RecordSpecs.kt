package cl.salud.samsungexport

import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.*
import androidx.health.connect.client.records.metadata.Metadata
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import java.time.Duration
import java.time.Instant
import java.time.ZoneOffset
import kotlin.reflect.KClass

/** Una fila del CSV en formato "largo" (una medición por fila), cómodo para Power BI. */
data class Row(
    val tipo: String,
    val inicio: Instant,
    val fin: Instant?,
    val offset: ZoneOffset?,
    val valor: Double?,
    val unidad: String,
    val detalle: String,
    val meta: Metadata,
)

/**
 * Describe cómo leer un tipo de registro de Health Connect y cómo convertirlo en filas.
 * El genérico queda encerrado aquí para poder recorrer la lista completa de tipos.
 */
class RecordSpec<T : Record>(
    val type: KClass<T>,
    val nombre: String,
    private val toRows: (T) -> List<Row>,
) {
    val permission: String = HealthPermission.getReadPermission(type)

    /** Lee todas las páginas del rango y entrega las filas por página (no acumula todo en memoria). */
    suspend fun export(
        client: HealthConnectClient,
        start: Instant,
        end: Instant,
        onRows: (List<Row>) -> Unit,
    ): Int {
        var token: String? = null
        var total = 0
        do {
            val response = client.readRecords(
                ReadRecordsRequest(
                    recordType = type,
                    timeRangeFilter = TimeRangeFilter.between(start, end),
                    pageSize = 5000,
                    pageToken = token,
                )
            )
            total += response.records.size
            onRows(response.records.flatMap(toRows))
            token = response.pageToken
        } while (token != null)
        return total
    }
}

private fun minutes(a: Instant, b: Instant) = Duration.between(a, b).seconds / 60.0

private val SLEEP_STAGES = mapOf(
    SleepSessionRecord.STAGE_TYPE_UNKNOWN to "Desconocido",
    SleepSessionRecord.STAGE_TYPE_AWAKE to "Despierto",
    SleepSessionRecord.STAGE_TYPE_SLEEPING to "Dormido",
    SleepSessionRecord.STAGE_TYPE_OUT_OF_BED to "Fuera de la cama",
    SleepSessionRecord.STAGE_TYPE_LIGHT to "Ligero",
    SleepSessionRecord.STAGE_TYPE_DEEP to "Profundo",
    SleepSessionRecord.STAGE_TYPE_REM to "REM",
    SleepSessionRecord.STAGE_TYPE_AWAKE_IN_BED to "Despierto en cama",
)

private val EXERCISE_TYPES = mapOf(
    ExerciseSessionRecord.EXERCISE_TYPE_OTHER_WORKOUT to "Otro",
    ExerciseSessionRecord.EXERCISE_TYPE_WALKING to "Caminata",
    ExerciseSessionRecord.EXERCISE_TYPE_RUNNING to "Carrera",
    ExerciseSessionRecord.EXERCISE_TYPE_RUNNING_TREADMILL to "Trotadora",
    ExerciseSessionRecord.EXERCISE_TYPE_BIKING to "Ciclismo",
    ExerciseSessionRecord.EXERCISE_TYPE_BIKING_STATIONARY to "Bicicleta estática",
    ExerciseSessionRecord.EXERCISE_TYPE_HIKING to "Trekking",
    ExerciseSessionRecord.EXERCISE_TYPE_SWIMMING_POOL to "Natación piscina",
    ExerciseSessionRecord.EXERCISE_TYPE_SWIMMING_OPEN_WATER to "Natación aguas abiertas",
    ExerciseSessionRecord.EXERCISE_TYPE_STRENGTH_TRAINING to "Fuerza",
    ExerciseSessionRecord.EXERCISE_TYPE_WEIGHTLIFTING to "Pesas",
    ExerciseSessionRecord.EXERCISE_TYPE_ELLIPTICAL to "Elíptica",
    ExerciseSessionRecord.EXERCISE_TYPE_ROWING_MACHINE to "Remo máquina",
    ExerciseSessionRecord.EXERCISE_TYPE_YOGA to "Yoga",
    ExerciseSessionRecord.EXERCISE_TYPE_PILATES to "Pilates",
    ExerciseSessionRecord.EXERCISE_TYPE_STRETCHING to "Elongación",
    ExerciseSessionRecord.EXERCISE_TYPE_HIGH_INTENSITY_INTERVAL_TRAINING to "HIIT",
    ExerciseSessionRecord.EXERCISE_TYPE_SOCCER to "Fútbol",
    ExerciseSessionRecord.EXERCISE_TYPE_TENNIS to "Tenis",
    ExerciseSessionRecord.EXERCISE_TYPE_STAIR_CLIMBING to "Escaleras",
)

// Las interfaces IntervalRecord / InstantaneousRecord son internas en Health Connect,
// por eso los helpers reciben los campos y no el registro.
private fun interval(
    tipo: String, start: Instant, end: Instant, offset: ZoneOffset?, meta: Metadata,
    valor: Double?, unidad: String, detalle: String = "",
) = Row(tipo, start, end, offset, valor, unidad, detalle, meta)

private fun instant(
    tipo: String, time: Instant, offset: ZoneOffset?, meta: Metadata,
    valor: Double?, unidad: String, detalle: String = "",
) = Row(tipo, time, null, offset, valor, unidad, detalle, meta)

/** Todos los tipos que se exportan. Agregar uno nuevo = agregar una línea aquí y su permiso en el Manifest. */
val RECORD_SPECS: List<RecordSpec<*>> = listOf(
    // Actividad
    RecordSpec(StepsRecord::class, "Pasos") { listOf(interval("Pasos", it.startTime, it.endTime, it.startZoneOffset, it.metadata, it.count.toDouble(), "pasos")) },
    RecordSpec(DistanceRecord::class, "Distancia") { listOf(interval("Distancia", it.startTime, it.endTime, it.startZoneOffset, it.metadata, it.distance.inMeters, "m")) },
    RecordSpec(ActiveCaloriesBurnedRecord::class, "Calorías activas") {
        listOf(interval("Calorías activas", it.startTime, it.endTime, it.startZoneOffset, it.metadata, it.energy.inKilocalories, "kcal"))
    },
    RecordSpec(TotalCaloriesBurnedRecord::class, "Calorías totales") {
        listOf(interval("Calorías totales", it.startTime, it.endTime, it.startZoneOffset, it.metadata, it.energy.inKilocalories, "kcal"))
    },
    RecordSpec(FloorsClimbedRecord::class, "Pisos") { listOf(interval("Pisos", it.startTime, it.endTime, it.startZoneOffset, it.metadata, it.floors, "pisos")) },
    RecordSpec(ElevationGainedRecord::class, "Desnivel") { listOf(interval("Desnivel", it.startTime, it.endTime, it.startZoneOffset, it.metadata, it.elevation.inMeters, "m")) },
    RecordSpec(ExerciseSessionRecord::class, "Ejercicio") {
        val tipo = EXERCISE_TYPES[it.exerciseType] ?: "Tipo ${it.exerciseType}"
        listOf(interval("Ejercicio", it.startTime, it.endTime, it.startZoneOffset, it.metadata, minutes(it.startTime, it.endTime), "min",
            listOfNotNull(tipo, it.title).joinToString(" | ")))
    },
    RecordSpec(SpeedRecord::class, "Velocidad") { r ->
        r.samples.map { Row("Velocidad", it.time, null, r.startZoneOffset, it.speed.inMetersPerSecond, "m/s", "", r.metadata) }
    },
    RecordSpec(PowerRecord::class, "Potencia") { r ->
        r.samples.map { Row("Potencia", it.time, null, r.startZoneOffset, it.power.inWatts, "W", "", r.metadata) }
    },
    RecordSpec(Vo2MaxRecord::class, "VO2 máx") {
        listOf(instant("VO2 máx", it.time, it.zoneOffset, it.metadata, it.vo2MillilitersPerMinuteKilogram, "ml/kg/min"))
    },

    // Corazón y signos vitales
    RecordSpec(HeartRateRecord::class, "Frecuencia cardíaca") { r ->
        r.samples.map { Row("Frecuencia cardíaca", it.time, null, r.startZoneOffset, it.beatsPerMinute.toDouble(), "lpm", "", r.metadata) }
    },
    RecordSpec(RestingHeartRateRecord::class, "FC en reposo") {
        listOf(instant("FC en reposo", it.time, it.zoneOffset, it.metadata, it.beatsPerMinute.toDouble(), "lpm"))
    },
    RecordSpec(HeartRateVariabilityRmssdRecord::class, "VFC (RMSSD)") {
        listOf(instant("VFC (RMSSD)", it.time, it.zoneOffset, it.metadata, it.heartRateVariabilityMillis, "ms"))
    },
    RecordSpec(OxygenSaturationRecord::class, "SpO2") { listOf(instant("SpO2", it.time, it.zoneOffset, it.metadata, it.percentage.value, "%")) },
    RecordSpec(RespiratoryRateRecord::class, "Frecuencia respiratoria") {
        listOf(instant("Frecuencia respiratoria", it.time, it.zoneOffset, it.metadata, it.rate, "rpm"))
    },
    RecordSpec(BloodPressureRecord::class, "Presión arterial") {
        listOf(
            instant("Presión sistólica", it.time, it.zoneOffset, it.metadata, it.systolic.inMillimetersOfMercury, "mmHg"),
            instant("Presión diastólica", it.time, it.zoneOffset, it.metadata, it.diastolic.inMillimetersOfMercury, "mmHg"),
        )
    },
    RecordSpec(BloodGlucoseRecord::class, "Glucosa") {
        listOf(instant("Glucosa", it.time, it.zoneOffset, it.metadata, it.level.inMilligramsPerDeciliter, "mg/dL"))
    },
    RecordSpec(BodyTemperatureRecord::class, "Temperatura corporal") {
        listOf(instant("Temperatura corporal", it.time, it.zoneOffset, it.metadata, it.temperature.inCelsius, "°C"))
    },

    // Sueño: una fila por sesión + una fila por etapa
    RecordSpec(SleepSessionRecord::class, "Sueño") { r ->
        listOf(interval("Sueño", r.startTime, r.endTime, r.startZoneOffset, r.metadata, minutes(r.startTime, r.endTime) / 60.0, "h", r.title ?: "")) +
            r.stages.map {
                Row("Sueño - etapa", it.startTime, it.endTime, r.startZoneOffset,
                    minutes(it.startTime, it.endTime), "min", SLEEP_STAGES[it.stage] ?: "Etapa ${it.stage}", r.metadata)
            }
    },

    // Composición corporal
    RecordSpec(WeightRecord::class, "Peso") { listOf(instant("Peso", it.time, it.zoneOffset, it.metadata, it.weight.inKilograms, "kg")) },
    RecordSpec(HeightRecord::class, "Estatura") { listOf(instant("Estatura", it.time, it.zoneOffset, it.metadata, it.height.inMeters, "m")) },
    RecordSpec(BodyFatRecord::class, "Grasa corporal") { listOf(instant("Grasa corporal", it.time, it.zoneOffset, it.metadata, it.percentage.value, "%")) },
    RecordSpec(LeanBodyMassRecord::class, "Masa magra") { listOf(instant("Masa magra", it.time, it.zoneOffset, it.metadata, it.mass.inKilograms, "kg")) },
    RecordSpec(BoneMassRecord::class, "Masa ósea") { listOf(instant("Masa ósea", it.time, it.zoneOffset, it.metadata, it.mass.inKilograms, "kg")) },
    RecordSpec(BodyWaterMassRecord::class, "Agua corporal") { listOf(instant("Agua corporal", it.time, it.zoneOffset, it.metadata, it.mass.inKilograms, "kg")) },
    RecordSpec(BasalMetabolicRateRecord::class, "Metabolismo basal") {
        listOf(instant("Metabolismo basal", it.time, it.zoneOffset, it.metadata, it.basalMetabolicRate.inKilocaloriesPerDay, "kcal/día"))
    },

    // Nutrición
    RecordSpec(HydrationRecord::class, "Hidratación") { listOf(interval("Hidratación", it.startTime, it.endTime, it.startZoneOffset, it.metadata, it.volume.inLiters, "L")) },
    RecordSpec(NutritionRecord::class, "Nutrición") {
        val macros = listOfNotNull(
            it.name,
            it.protein?.let { p -> "proteína %.1f g".format(java.util.Locale.ROOT, p.inGrams) },
            it.totalCarbohydrate?.let { c -> "carbohidratos %.1f g".format(java.util.Locale.ROOT, c.inGrams) },
            it.totalFat?.let { f -> "grasa %.1f g".format(java.util.Locale.ROOT, f.inGrams) },
        ).joinToString(" | ")
        listOf(interval("Nutrición", it.startTime, it.endTime, it.startZoneOffset, it.metadata, it.energy?.inKilocalories, "kcal", macros))
    },
)
