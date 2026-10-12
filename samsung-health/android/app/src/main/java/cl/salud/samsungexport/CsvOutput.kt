package cl.salud.samsungexport

import android.content.ContentValues
import android.content.Context
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import java.io.BufferedWriter
import java.io.File
import java.io.OutputStream
import java.math.BigDecimal
import java.math.RoundingMode

/** Archivo CSV (UTF-8 con BOM para que Excel respete tildes) en Descargas/SamsungHealth. */
class CsvOutput(context: Context, fileName: String) : AutoCloseable {
    /** Ruta legible para mostrar al usuario. */
    val location: String
    private val writer: BufferedWriter

    init {
        val stream: OutputStream
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val values = ContentValues().apply {
                put(MediaStore.MediaColumns.DISPLAY_NAME, fileName)
                put(MediaStore.MediaColumns.MIME_TYPE, "text/csv")
                put(MediaStore.MediaColumns.RELATIVE_PATH, "${Environment.DIRECTORY_DOWNLOADS}/SamsungHealth")
            }
            val uri = context.contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                ?: error("No se pudo crear $fileName en Descargas")
            stream = context.contentResolver.openOutputStream(uri) ?: error("No se pudo abrir $fileName")
            location = "Descargas/SamsungHealth/$fileName"
        } else {
            // Android 8-9: carpeta propia de la app (visible por USB en Android/data/...)
            val file = File(context.getExternalFilesDir(null), fileName)
            stream = file.outputStream()
            location = file.absolutePath
        }
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
