package cl.salud.samsungexport

import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.health.connect.client.HealthConnectClient
import androidx.lifecycle.lifecycleScope
import cl.salud.samsungexport.DailySummary.CAL_ACTIVAS
import cl.salud.samsungexport.DailySummary.DISTANCIA
import cl.salud.samsungexport.DailySummary.EJERCICIO
import cl.salud.samsungexport.DailySummary.FC_REPOSO
import cl.salud.samsungexport.DailySummary.PASOS
import cl.salud.samsungexport.DailySummary.PESO
import cl.salud.samsungexport.DailySummary.SUENO
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

/** Panel de análisis en el teléfono: KPIs del periodo vs periodo anterior, gráficos y hallazgos. */
class DashboardActivity : ComponentActivity() {

    private val es = Locale("es", "CL")
    private val dayLabel = DateTimeFormatter.ofPattern("d MMM", es)
    private lateinit var content: LinearLayout
    private var periodDays = 30

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        content = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(16), dp(16), dp(16), dp(32)) }
        showScreen(ScrollView(this).apply { addView(content) })
        load()
    }

    private fun load() {
        content.removeAllViews()
        content.addView(screenTitle("Mi análisis de salud"))
        content.addView(periodSelector())
        content.addView(label("Cargando…", 14f))
        lifecycleScope.launch {
            val client = HealthConnectClient.getOrCreate(this@DashboardActivity)
            val result = runCatching {
                withContext(Dispatchers.IO) {
                    val cols = DailySummary.availableColumns(client.permissionController.getGrantedPermissions())
                    val today = LocalDate.now()
                    // Se trae el doble del periodo para comparar con el periodo anterior
                    DailySummary.query(client, cols, today.minusDays(2L * periodDays - 1), today.plusDays(1))
                }
            }
            content.removeViews(2, content.childCount - 2)
            result.onSuccess { render(it) }.onFailure { content.addView(label("✖ ${it.message}", 14f)) }
        }
    }

    private fun render(all: List<Day>) {
        val today = LocalDate.now()
        val startCur = today.minusDays(periodDays - 1L)
        val byDate = all.associateBy { it.fecha }
        val cur = all.filter { !it.fecha.isBefore(startCur) }
        val prev = all.filter { it.fecha.isBefore(startCur) }
        val dates = (0 until periodDays).map { startCur.plusDays(it.toLong()) }
        fun series(key: String) = dates.map { dayLabel.format(it) to byDate[it]?.get(key) }

        content.addView(label("Últimos $periodDays días vs los $periodDays anteriores", 13f, 0xFF64748B.toInt()))

        val kpis = listOf(
            Kpi("Pasos / día", avg(cur, PASOS), avg(prev, PASOS), "%,.0f", higherIsBetter = true),
            Kpi("Sueño / noche", avg(cur, SUENO), avg(prev, SUENO), "%.1f h", higherIsBetter = true),
            Kpi("FC en reposo", avg(cur, FC_REPOSO), avg(prev, FC_REPOSO), "%.0f lpm", higherIsBetter = false),
            Kpi("Ejercicio total", sum(cur, EJERCICIO), sum(prev, EJERCICIO), "%,.0f min", higherIsBetter = true),
            Kpi("Distancia total", sum(cur, DISTANCIA), sum(prev, DISTANCIA), "%,.1f km", higherIsBetter = true),
            Kpi("Cal. activas / día", avg(cur, CAL_ACTIVAS), avg(prev, CAL_ACTIVAS), "%,.0f kcal", higherIsBetter = true),
            Kpi("Peso (último)", last(cur, PESO), last(prev, PESO), "%.1f kg", higherIsBetter = null),
            Kpi("Días ≥ 10.000 pasos", count(cur, PASOS) { it >= 10_000 }, count(prev, PASOS) { it >= 10_000 }, "%.0f", true),
        )
        kpis.chunked(2).forEach { pair ->
            content.addView(LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                pair.forEach { addView(kpiCard(it), LinearLayout.LayoutParams(0, -2, 1f).apply { setMargins(dp(4), dp(4), dp(4), dp(4)) }) }
            })
        }

        content.addView(section("Hallazgos"))
        content.addView(label(insights(cur), 14f))

        chart(ChartView(this, "Pasos por día", series(PASOS), goal = 10_000.0))
        chart(ChartView(this, "Horas de sueño", series(SUENO), goal = 7.0, color = 0xFF7C3AED.toInt(), format = { "%.1f".format(it) }))
        chart(ChartView(this, "FC en reposo (lpm)", series(FC_REPOSO), line = true, color = 0xFFDC2626.toInt()))
        chart(ChartView(this, "Peso (kg)", series(PESO), line = true, color = 0xFF0891B2.toInt(), format = { "%.1f".format(it) }))
        chart(ChartView(this, "Minutos de ejercicio", series(EJERCICIO), color = 0xFFEA580C.toInt()))
        val weekday = DayOfWeek.values().map { dow ->
            dow.getDisplayName(TextStyle.SHORT, es) to avg(cur.filter { it.fecha.dayOfWeek == dow }, PASOS)
        }
        chart(ChartView(this, "Pasos promedio por día de la semana", weekday, color = 0xFF059669.toInt()))
    }

    // ------------------------------------------------------------------ cálculos

    private class Kpi(
        val title: String, val value: Double?, val previous: Double?, val fmt: String, val higherIsBetter: Boolean?,
    )

    private fun values(days: List<Day>, key: String) = days.mapNotNull { it[key] }
    private fun avg(days: List<Day>, key: String) = values(days, key).takeIf { it.isNotEmpty() }?.average()
    private fun sum(days: List<Day>, key: String) = values(days, key).takeIf { it.isNotEmpty() }?.sum()
    private fun last(days: List<Day>, key: String) = days.lastOrNull { it[key] != null }?.get(key)
    private fun count(days: List<Day>, key: String, cond: (Double) -> Boolean) =
        values(days, key).takeIf { it.isNotEmpty() }?.count(cond)?.toDouble()

    private fun insights(cur: List<Day>): String {
        val lines = mutableListOf<String>()
        cur.filter { it[PASOS] != null }.let { d ->
            if (d.isNotEmpty()) {
                val best = d.maxBy { it[PASOS]!! }
                val worst = d.minBy { it[PASOS]!! }
                lines += "• Día más activo: ${dayLabel.format(best.fecha)} con %,.0f pasos.".format(best[PASOS])
                lines += "• Día menos activo: ${dayLabel.format(worst.fecha)} con %,.0f pasos.".format(worst[PASOS])
                val wk = d.filter { it.fecha.dayOfWeek.value <= 5 }.mapNotNull { it[PASOS] }
                val we = d.filter { it.fecha.dayOfWeek.value > 5 }.mapNotNull { it[PASOS] }
                if (wk.isNotEmpty() && we.isNotEmpty()) {
                    lines += "• Promedio lunes-viernes %,.0f vs fin de semana %,.0f pasos.".format(wk.average(), we.average())
                }
            }
        }
        values(cur, SUENO).let { s ->
            if (s.isNotEmpty()) {
                val short = s.count { it < 6 }
                lines += "• Noches con menos de 6 h de sueño: $short de ${s.size}."
            }
        }
        cur.filter { it[PESO] != null }.let { w ->
            if (w.size >= 2) {
                val delta = w.last()[PESO]!! - w.first()[PESO]!!
                lines += "• Peso: %+.1f kg entre ${dayLabel.format(w.first().fecha)} y ${dayLabel.format(w.last().fecha)}.".format(delta)
            }
        }
        if (lines.isEmpty()) lines += "Sin datos suficientes en este periodo. Revisa que Samsung Health esté sincronizando con Health Connect."
        return lines.joinToString("\n")
    }

    // ------------------------------------------------------------------ vistas

    private fun periodSelector() = LinearLayout(this).apply {
        orientation = LinearLayout.HORIZONTAL
        listOf(7, 30, 90, 365).forEach { d ->
            addView(Button(this@DashboardActivity).apply {
                text = if (d == 365) "1 año" else "$d d"
                isEnabled = d != periodDays
                setOnClickListener { periodDays = d; load() }
            }, LinearLayout.LayoutParams(0, -2, 1f))
        }
    }

    private fun kpiCard(k: Kpi): View = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(12), dp(10), dp(12), dp(10))
        background = GradientDrawable().apply { setColor(0xFFFFFFFF.toInt()); cornerRadius = dp(12).toFloat(); setStroke(dp(1), 0xFFE2E8F0.toInt()) }
        addView(label(k.title, 12f, 0xFF64748B.toInt()))
        addView(label(k.value?.let { k.fmt.format(es, it) } ?: "—", 20f, 0xFF0F172A.toInt(), bold = true))
        val delta = if (k.value != null && k.previous != null && k.previous != 0.0) (k.value - k.previous) / k.previous * 100 else null
        val color = when {
            delta == null || k.higherIsBetter == null || kotlin.math.abs(delta) < 1 -> 0xFF64748B.toInt()
            (delta > 0) == k.higherIsBetter -> 0xFF16A34A.toInt()
            else -> 0xFFDC2626.toInt()
        }
        addView(label(delta?.let { "%+.0f%% vs anterior".format(it) } ?: "sin comparación", 12f, color))
    }

    private fun chart(v: ChartView) {
        content.addView(v, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(24) })
    }

    private fun section(t: String) = label(t, 16f, 0xFF0F172A.toInt(), bold = true).apply { setPadding(0, dp(20), 0, dp(6)) }

    private fun label(t: String, size: Float, color: Int = 0xFF334155.toInt(), bold: Boolean = false) = TextView(this).apply {
        text = t
        textSize = size
        setTextColor(color)
        if (bold) typeface = Typeface.DEFAULT_BOLD
        gravity = Gravity.START
    }

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()
}
