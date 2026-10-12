package cl.salud.samsungexport

import android.content.Context
import android.net.Uri
import androidx.documentfile.provider.DocumentFile
import cl.salud.samsungexport.DailySummary.CAL_ACTIVAS
import cl.salud.samsungexport.DailySummary.DISTANCIA
import cl.salud.samsungexport.DailySummary.EJERCICIO
import cl.salud.samsungexport.DailySummary.ESTRES
import cl.salud.samsungexport.DailySummary.FC_MAX
import cl.salud.samsungexport.DailySummary.FC_MIN
import cl.salud.samsungexport.DailySummary.FC_PROM
import cl.salud.samsungexport.DailySummary.PASOS
import cl.salud.samsungexport.DailySummary.PESO
import cl.salud.samsungexport.DailySummary.SUENO
import java.io.BufferedReader
import java.io.File
import java.io.InputStream
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneOffset
import java.util.zip.ZipInputStream

/**
 * Lee la exportación oficial de Samsung Health ("Descargar datos personales"), que trae
 * TODO el historial, y la resume por día. Acepta la carpeta exportada o un .zip de ella.
 *
 * Formato de cada CSV: línea 1 = metadatos (tipo de dato), línea 2 = encabezados con
 * prefijo "com.samsung.health.xxx.", y las filas suelen traer una coma final de más.
 */
class SamsungImport(private val log: (String) -> Unit = {}) {

    /** Acumulador por día: suma, cantidad, mínimo y máximo. */
    private class Acc {
        var sum = 0.0; var n = 0; var min = Double.MAX_VALUE; var max = -Double.MAX_VALUE
        fun add(v: Double) { sum += v; n++; if (v < min) min = v; if (v > max) max = v }
        val avg get() = sum / n
    }

    private val stepsCombined = HashMap<LocalDate, DoubleArray>() // source_type -2: total sin duplicar
    private val stepsAny = HashMap<LocalDate, DoubleArray>()
    private val heart = HashMap<LocalDate, Acc>()
    private val sleep = HashMap<LocalDate, Acc>()
    private val weight = HashMap<LocalDate, Acc>()
    private val exercise = HashMap<LocalDate, Acc>()
    private val stress = HashMap<LocalDate, Acc>()
    private val offsets = HashMap<String, ZoneOffset>()

    fun importZip(context: Context, uri: Uri): List<Day> {
        val input = context.contentResolver.openInputStream(uri) ?: error("No se pudo abrir el archivo")
        return importZip(input)
    }

    fun importZip(input: InputStream): List<Day> {
        ZipInputStream(input.buffered()).use { zip ->
            while (true) {
                val entry = zip.nextEntry ?: break
                val path = entry.name.replace('\\', '/')
                if (entry.isDirectory || !path.endsWith(".csv", ignoreCase = true)) continue
                if ("/jsons/" in "/$path" || "/files/" in "/$path") continue
                readFile(path.substringAfterLast('/'), zip)
            }
        }
        return build()
    }

    fun importFolder(context: Context, tree: Uri): List<Day> {
        val root = DocumentFile.fromTreeUri(context, tree) ?: error("No se pudo abrir la carpeta")
        fun walk(dir: DocumentFile) {
            for (f in dir.listFiles()) {
                val name = f.name ?: continue
                if (f.isDirectory) {
                    if (name != "jsons" && name != "files") walk(f)
                } else if (name.endsWith(".csv", ignoreCase = true)) {
                    context.contentResolver.openInputStream(f.uri)?.use { readFile(name, it) }
                }
            }
        }
        walk(root)
        return build()
    }

    // ------------------------------------------------------------------ lectura por tabla

    /** com.samsung.shealth.tracker.heart_rate.20240101120000.csv -> tracker.heart_rate */
    private fun shortName(fileName: String): String {
        var name = fileName.removeSuffix(".csv").replace(Regex("\\.\\d{8,14}$"), "")
        for (p in listOf("com.samsung.shealth.", "com.samsung.health.", "com.samsung.")) {
            if (name.startsWith(p)) { name = name.removePrefix(p); break }
        }
        return name
    }

    private fun readFile(fileName: String, input: InputStream) {
        val handler: ((Table, List<String>) -> Unit) = when (shortName(fileName)) {
            "step_daily_trend" -> ::onSteps
            "tracker.heart_rate", "heart_rate" -> ::onHeart
            "sleep" -> ::onSleep
            "weight" -> ::onWeight
            "exercise" -> ::onExercise
            "stress" -> ::onStress
            else -> return
        }
        val reader = input.bufferedReader(Charsets.UTF_8)
        val meta = readRecord(reader) ?: return
        val datatype = meta.firstOrNull()?.removePrefix("﻿")?.trim().orEmpty()
        val header = readRecord(reader) ?: return
        val table = Table(header.map { cleanColumn(it.trim(), datatype) })
        var rows = 0
        while (true) {
            val row = readRecord(reader) ?: break
            if (row.all { it.isBlank() }) continue
            try { handler(table, row) } catch (_: Exception) { /* fila dañada: se ignora */ }
            rows++
        }
        log("· ${shortName(fileName)}: %,d filas".format(rows))
    }

    private fun cleanColumn(col: String, datatype: String) = when {
        datatype.isNotEmpty() && col.startsWith("$datatype.") -> col.removePrefix("$datatype.")
        col.startsWith("com.samsung.") -> col.substringAfterLast('.')
        else -> col
    }

    private class Table(columns: List<String>) {
        private val index = columns.withIndex().associate { it.value to it.index }
        fun get(row: List<String>, col: String): String? = index[col]?.let { row.getOrNull(it) }?.takeIf { it.isNotBlank() }
        fun num(row: List<String>, col: String): Double? = get(row, col)?.toDoubleOrNull()
    }

    /** Lee un registro CSV respetando comillas (puede abarcar varias líneas). */
    private fun readRecord(r: BufferedReader): List<String>? {
        val fields = ArrayList<String>()
        val sb = StringBuilder()
        var inQuotes = false
        var any = false
        while (true) {
            val c = r.read()
            if (c == -1) {
                if (!any) return null
                fields += sb.toString()
                return fields
            }
            any = true
            val ch = c.toChar()
            if (inQuotes) {
                if (ch == '"') {
                    r.mark(1)
                    if (r.read() == '"'.code) sb.append('"') else { inQuotes = false; r.reset() }
                } else sb.append(ch)
            } else when (ch) {
                '"' -> inQuotes = true
                ',' -> { fields += sb.toString(); sb.setLength(0) }
                '\r' -> Unit
                '\n' -> { fields += sb.toString(); return fields }
                else -> sb.append(ch)
            }
        }
    }

    // ------------------------------------------------------------------ fechas

    /** Fecha UTC de Samsung: "2024-03-09 12:00:00.000" o epoch en milisegundos. */
    private fun parseUtc(s: String?): Instant? {
        if (s == null) return null
        s.toLongOrNull()?.let { return Instant.ofEpochMilli(it) }
        return LocalDateTime.parse(s.trim().replace(' ', 'T')).toInstant(ZoneOffset.UTC)
    }

    /** "UTC-0300" -> -03:00 */
    private fun offset(s: String?): ZoneOffset = if (s == null) ZoneOffset.UTC else offsets.getOrPut(s) {
        val m = Regex("UTC([+-])(\\d{2}):?(\\d{2})").find(s) ?: return@getOrPut ZoneOffset.UTC
        val sign = if (m.groupValues[1] == "-") -1 else 1
        ZoneOffset.ofHoursMinutes(sign * m.groupValues[2].toInt(), sign * m.groupValues[3].toInt())
    }

    private fun localDate(t: Table, row: List<String>, col: String): LocalDate? =
        parseUtc(t.get(row, col))?.atOffset(offset(t.get(row, "time_offset")))?.toLocalDate()

    // ------------------------------------------------------------------ tablas

    private fun onSteps(t: Table, row: List<String>) {
        val day = t.get(row, "day_time")?.toLongOrNull()?.let { Instant.ofEpochMilli(it).atOffset(ZoneOffset.UTC).toLocalDate() } ?: return
        val values = doubleArrayOf(t.num(row, "count") ?: 0.0, t.num(row, "distance") ?: 0.0, t.num(row, "calorie") ?: 0.0)
        val target = if (t.get(row, "source_type") == "-2") stepsCombined else stepsAny
        val prev = target[day]
        // Varias filas el mismo día = varios dispositivos: se queda la mayor, nunca se suman
        if (prev == null || values[0] > prev[0]) target[day] = values
    }

    private fun onHeart(t: Table, row: List<String>) {
        val bpm = t.num(row, "heart_rate") ?: return
        if (bpm <= 0) return
        heart.getOrPut(localDate(t, row, "start_time") ?: return) { Acc() }.add(bpm)
    }

    private fun onSleep(t: Table, row: List<String>) {
        val start = parseUtc(t.get(row, "start_time")) ?: return
        val end = parseUtc(t.get(row, "end_time")) ?: return
        val hours = (end.epochSecond - start.epochSecond) / 3600.0
        if (hours <= 0 || hours > 24) return
        // La noche cuenta para el día en que despiertas
        val day = end.atOffset(offset(t.get(row, "time_offset"))).toLocalDate()
        sleep.getOrPut(day) { Acc() }.add(hours)
    }

    private fun onWeight(t: Table, row: List<String>) {
        val kg = t.num(row, "weight") ?: return
        weight.getOrPut(localDate(t, row, "start_time") ?: return) { Acc() }.add(kg)
    }

    private fun onExercise(t: Table, row: List<String>) {
        val ms = t.num(row, "duration") ?: return
        exercise.getOrPut(localDate(t, row, "start_time") ?: return) { Acc() }.add(ms / 60000.0)
    }

    private fun onStress(t: Table, row: List<String>) {
        val score = t.num(row, "score") ?: return
        stress.getOrPut(localDate(t, row, "start_time") ?: return) { Acc() }.add(score)
    }

    // ------------------------------------------------------------------ resultado

    private fun build(): List<Day> {
        val steps = stepsCombined.ifEmpty { stepsAny }
        val dates = (steps.keys + heart.keys + sleep.keys + weight.keys + exercise.keys + stress.keys).toSortedSet()
        if (dates.isEmpty()) error("No encontré datos. ¿Elegiste la carpeta «samsunghealth_…» o su .zip?")
        return dates.map { d ->
            Day(d, mapOf(
                PASOS to steps[d]?.get(0),
                DISTANCIA to steps[d]?.get(1)?.div(1000),
                CAL_ACTIVAS to steps[d]?.get(2),
                FC_PROM to heart[d]?.avg,
                FC_MIN to heart[d]?.min,
                FC_MAX to heart[d]?.max,
                SUENO to sleep[d]?.sum,
                PESO to weight[d]?.avg,
                EJERCICIO to exercise[d]?.sum,
                ESTRES to stress[d]?.avg,
            ))
        }
    }
}

/** Guarda el historial importado dentro de la app para reabrir el panel sin volver a importar. */
object ImportedStore {
    private const val FILE = "historial_samsung.csv"
    val KEYS = listOf(PASOS, DISTANCIA, CAL_ACTIVAS, FC_PROM, FC_MIN, FC_MAX, SUENO, PESO, EJERCICIO, ESTRES)

    fun exists(context: Context) = File(context.filesDir, FILE).exists()

    fun save(context: Context, days: List<Day>) {
        File(context.filesDir, FILE).bufferedWriter().use { w ->
            w.write((listOf("fecha") + KEYS).joinToString(",")); w.newLine()
            for (d in days) {
                w.write((listOf(d.fecha.toString()) + KEYS.map { k -> d[k]?.toString().orEmpty() }).joinToString(","))
                w.newLine()
            }
        }
    }

    fun load(context: Context): List<Day> {
        val file = File(context.filesDir, FILE)
        if (!file.exists()) return emptyList()
        val lines = file.readLines()
        val header = lines.first().split(",")
        return lines.drop(1).filter { it.isNotBlank() }.map { line ->
            val cells = line.split(",")
            Day(LocalDate.parse(cells[0]), header.drop(1).withIndex().associate { (i, k) -> k to cells.getOrNull(i + 1)?.toDoubleOrNull() })
        }
    }
}
