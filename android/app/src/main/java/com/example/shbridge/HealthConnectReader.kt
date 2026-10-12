package com.example.shbridge

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.BloodGlucoseRecord
import androidx.health.connect.client.records.BloodPressureRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.OxygenSaturationRecord
import androidx.health.connect.client.records.Record
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import org.json.JSONArray
import org.json.JSONObject
import java.time.Duration
import java.time.Instant

/**
 * Lee datos de Samsung Health a través de Health Connect.
 *
 * Requisito en el celular: en Samsung Health, activar la sincronización con
 * Health Connect para cada tipo de dato que se quiera leer.
 */
class HealthConnectReader(private val context: Context) {

    val permissions: Set<String> = setOf(
        HealthPermission.getReadPermission(SleepSessionRecord::class),
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(ExerciseSessionRecord::class),
        HealthPermission.getReadPermission(HeartRateRecord::class),
        HealthPermission.getReadPermission(BloodPressureRecord::class),
        HealthPermission.getReadPermission(BloodGlucoseRecord::class),
        HealthPermission.getReadPermission(OxygenSaturationRecord::class),
    )

    private val client by lazy { HealthConnectClient.getOrCreate(context) }

    fun availability(): Int = HealthConnectClient.getSdkStatus(context)

    suspend fun grantedPermissions(): Set<String> = client.permissionController.getGrantedPermissions()

    suspend fun readRecent(days: Int): JSONObject {
        val end = Instant.now()
        val start = end.minus(Duration.ofDays(days.toLong()))
        val range = TimeRangeFilter.between(start, end)

        val records = JSONObject()
            .put("sleep", JSONArray(readAll<SleepSessionRecord>(range).map { sleepToJson(it) }))
            .put("steps", JSONArray(readAll<StepsRecord>(range).map { stepsToJson(it) }))
            .put("exercise", JSONArray(readAll<ExerciseSessionRecord>(range).map { exerciseToJson(it) }))
            .put("heartRate", JSONArray(readAll<HeartRateRecord>(range).map { heartRateToJson(it) }))
            .put("bloodPressure", JSONArray(readAll<BloodPressureRecord>(range).map { bloodPressureToJson(it) }))
            .put("bloodGlucose", JSONArray(readAll<BloodGlucoseRecord>(range).map { bloodGlucoseToJson(it) }))
            .put("oxygenSaturation", JSONArray(readAll<OxygenSaturationRecord>(range).map { oxygenToJson(it) }))

        return JSONObject()
            .put("source", "samsung_health_via_health_connect")
            .put("fetchedAt", end.toString())
            .put("rangeDays", days)
            .put("records", records)
    }

    // Pagina todos los registros del tipo T dentro del rango.
    private suspend inline fun <reified T : Record> readAll(range: TimeRangeFilter): List<T> {
        val out = mutableListOf<T>()
        var pageToken: String? = null
        do {
            val response = client.readRecords(
                ReadRecordsRequest(recordType = T::class, timeRangeFilter = range, pageToken = pageToken)
            )
            out += response.records
            pageToken = response.pageToken
        } while (pageToken != null)
        return out
    }

    private fun sleepToJson(r: SleepSessionRecord) = JSONObject()
        .put("start", r.startTime.toString())
        .put("end", r.endTime.toString())
        .put("title", r.title ?: "")
        .put("stages", JSONArray(r.stages.map {
            JSONObject()
                .put("stage", it.stage)
                .put("start", it.startTime.toString())
                .put("end", it.endTime.toString())
        }))

    private fun stepsToJson(r: StepsRecord) = JSONObject()
        .put("start", r.startTime.toString())
        .put("end", r.endTime.toString())
        .put("count", r.count)

    private fun exerciseToJson(r: ExerciseSessionRecord) = JSONObject()
        .put("start", r.startTime.toString())
        .put("end", r.endTime.toString())
        .put("exerciseType", r.exerciseType)
        .put("title", r.title ?: "")

    private fun heartRateToJson(r: HeartRateRecord) = JSONObject()
        .put("start", r.startTime.toString())
        .put("end", r.endTime.toString())
        .put("samples", JSONArray(r.samples.map {
            JSONObject().put("time", it.time.toString()).put("bpm", it.beatsPerMinute)
        }))

    private fun bloodPressureToJson(r: BloodPressureRecord) = JSONObject()
        .put("time", r.time.toString())
        .put("systolicMmHg", r.systolic.inMillimetersOfMercury)
        .put("diastolicMmHg", r.diastolic.inMillimetersOfMercury)

    private fun bloodGlucoseToJson(r: BloodGlucoseRecord) = JSONObject()
        .put("time", r.time.toString())
        .put("mmolPerL", r.level.inMillimolesPerLiter)

    private fun oxygenToJson(r: OxygenSaturationRecord) = JSONObject()
        .put("time", r.time.toString())
        .put("percent", r.percentage.value)
}
