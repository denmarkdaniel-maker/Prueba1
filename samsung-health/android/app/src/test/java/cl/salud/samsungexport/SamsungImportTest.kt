package cl.salud.samsungexport

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.time.LocalDate
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

/** Exportación sintética que imita el formato real de Samsung Health (mismo caso que el test de Python). */
class SamsungImportTest {

    private val files = mapOf(
        "com.samsung.shealth.step_daily_trend.20240310120000.csv" to
            "com.samsung.shealth.step_daily_trend,6315003,3\n" +
            "binning_data,update_time,create_time,source_pkg_name,source_type,count,speed,distance,calorie,deviceuuid,pkg_name,datauuid,day_time\n" +
            ",2024-03-09 23:00:00.000,2024-03-09 23:00:00.000,com.sec.android.app.shealth,-2,8500,1.2,6200.5,310.2,abc,com.sec.android.app.shealth,u1,1709942400000,\n" +
            ",2024-03-09 23:00:00.000,2024-03-09 23:00:00.000,com.sec.android.app.shealth,0,7000,1.2,5000,250,abc,com.sec.android.app.shealth,u2,1709942400000,\n" +
            ",2024-03-10 23:00:00.000,2024-03-10 23:00:00.000,com.sec.android.app.shealth,-2,10200,1.3,7400,400,abc,com.sec.android.app.shealth,u3,1710028800000,\n",
        "com.samsung.shealth.tracker.heart_rate.20240310120000.csv" to
            "com.samsung.health.heart_rate,6313009,3\n" +
            "source,tag_id,com.samsung.health.heart_rate.start_time,com.samsung.health.heart_rate.time_offset," +
            "com.samsung.health.heart_rate.heart_rate,com.samsung.health.heart_rate.comment,com.samsung.health.heart_rate.datauuid\n" +
            "0,21313,2024-03-09 12:00:00.000,UTC-0300,65,,h1,\n" +
            "0,21313,2024-03-09 14:30:00.000,UTC-0300,85,\"nota, con coma\",h2,\n" +
            // 02:00 UTC del 10 = 23:00 local del 9
            "0,21313,2024-03-10 02:00:00.000,UTC-0300,55,,h3,\n",
        "com.samsung.shealth.sleep.20240310120000.csv" to
            "com.samsung.shealth.sleep,6312002,4\n" +
            "original_efficiency,start_time,end_time,time_offset,datauuid\n" +
            "90,2024-03-10 02:30:00.000,2024-03-10 10:00:00.000,UTC-0300,s1,\n",
        "com.samsung.health.weight.20240310120000.csv" to
            "com.samsung.health.weight,6313007,2\n" +
            "start_time,weight,body_fat,time_offset,datauuid\n" +
            "2024-03-10 11:00:00.000,82.4,22.1,UTC-0300,w1,\n",
        "com.samsung.shealth.exercise.20240310120000.csv" to
            "com.samsung.shealth.exercise,6312003,5\n" +
            "com.samsung.health.exercise.start_time,com.samsung.health.exercise.duration,com.samsung.health.exercise.time_offset\n" +
            "2024-03-10 21:00:00.000,1800000,UTC-0300,\n",
        "com.samsung.shealth.stress.20240310120000.csv" to
            "com.samsung.shealth.stress,6312003,1\n" +
            "start_time,end_time,score,time_offset,datauuid\n" +
            "2024-03-10 13:00:00.000,2024-03-10 13:01:00.000,40,UTC-0300,x1,\n" +
            "2024-03-10 15:00:00.000,2024-03-10 15:01:00.000,60,UTC-0300,x2,\n",
        "jsons/com.samsung.shealth.stress/0/ignorar.csv" to "no,es,una,tabla\n",
    )

    private fun zip(): ByteArrayInputStream {
        val bytes = ByteArrayOutputStream()
        ZipOutputStream(bytes).use { z ->
            for ((name, text) in files) {
                z.putNextEntry(ZipEntry("samsunghealth_usuario_20240310120000/$name"))
                z.write(text.toByteArray())
                z.closeEntry()
            }
        }
        return ByteArrayInputStream(bytes.toByteArray())
    }

    @Test
    fun resumenDiarioDesdeZip() {
        val days = SamsungImport().importZip(zip()).associateBy { it.fecha }
        val d9 = days.getValue(LocalDate.of(2024, 3, 9))
        val d10 = days.getValue(LocalDate.of(2024, 3, 10))

        // Pasos: solo el total combinado (source_type -2), sin sumar teléfono + reloj
        assertEquals(8500.0, d9[DailySummary.PASOS]!!, 0.0)
        assertEquals(10200.0, d10[DailySummary.PASOS]!!, 0.0)
        assertEquals(6.2005, d9[DailySummary.DISTANCIA]!!, 1e-6)
        // FC del día 9 incluye la medición de las 23:00 locales
        assertEquals(55.0, d9[DailySummary.FC_MIN]!!, 0.0)
        assertEquals(85.0, d9[DailySummary.FC_MAX]!!, 0.0)
        assertEquals(68.333, d9[DailySummary.FC_PROM]!!, 1e-3)
        assertEquals(7.5, d10[DailySummary.SUENO]!!, 1e-9)
        assertEquals(82.4, d10[DailySummary.PESO]!!, 1e-9)
        assertEquals(30.0, d10[DailySummary.EJERCICIO]!!, 1e-9)
        assertEquals(50.0, d10[DailySummary.ESTRES]!!, 1e-9)
        assertNull(d9[DailySummary.SUENO])
        assertEquals(2, days.size)
    }
}
