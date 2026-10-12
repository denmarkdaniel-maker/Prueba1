package cl.salud.samsungexport

import android.content.ContentValues
import android.content.Context
import android.net.Uri
import android.os.Environment
import android.provider.MediaStore
import java.io.BufferedWriter
import java.math.BigDecimal
import java.math.RoundingMode

/** Archivo CSV (UTF-8 con BOM para que Excel respete tildes) en Descargas/SamsungHealth. */
class CsvOutput(context: Context, fileName: String) : AutoCloseable {
    /** Ruta legible para mostrar al usuario. */
    val location = "Descargas/SamsungHealth/$fileName"
    /** URI para compartir el archivo con otras apps. */
    val uri: Uri
    private val writer: BufferedWriter

    init {
        val values = ContentValues().apply {
            put(MediaStore.MediaColumns.DISPLAY_NAME, fileName)
            put(MediaStore.MediaColumns.MIME_TYPE, "text/csv")
            put(MediaStore.MediaColumns.RELATIVE_PATH, "${Environment.DIRECTORY_DOWNLOADS}/SamsungHealth")
        }
        uri = context.contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
            ?: error("No se pudo crear $fileName en Descargas")
        val stream = context.contentResolver.openOutputStream(uri) ?: error("No se pudo abrir $fileName")
        writer = stream.bufferedWriter(Charsets.UTF_8)
        writer.write("﻿")
    }

    fun writeRow(vararg fields: Any?) {
        writer.write(fields.joinToString(",") { escape(it) })
        writer.write("\r\n")
    }

    override fun close() = writer.close()

    private fun escape(value: Any?): String {
        val text = when (value) {
            null -> ""
            is Double -> if (value.isNaN()) "" else
                BigDecimal(value).setScale(4, RoundingMode.HALF_UP).stripTrailingZeros().toPlainString()
            else -> value.toString()
        }
        return if (text.any { it == ',' || it == '"' || it == '\n' || it == '\r' }) {
            "\"" + text.replace("\"", "\"\"") + "\""
        } else text
    }
}
