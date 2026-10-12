package cl.salud.samsungexport

import android.content.Context
import android.graphics.Canvas
import android.graphics.DashPathEffect
import android.graphics.Paint
import android.graphics.Path
import android.view.View
import kotlin.math.max

/** Gráfico simple de barras o línea dibujado a mano (sin librerías externas). */
class ChartView(
    context: Context,
    private val title: String,
    private val points: List<Pair<String, Double?>>,
    private val line: Boolean = false,
    private val goal: Double? = null,
    private val color: Int = 0xFF2563EB.toInt(),
    private val format: (Double) -> String = { "%,.0f".format(it) },
) : View(context) {

    private val dp = resources.displayMetrics.density
    private val text = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFF475569.toInt(); textSize = 11 * dp }
    private val titlePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0xFF0F172A.toInt(); textSize = 15 * dp; isFakeBoldText = true
    }
    private val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = this@ChartView.color }
    private val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = this@ChartView.color; style = Paint.Style.STROKE; strokeWidth = 2.5f * dp
    }
    private val goalPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0xFF16A34A.toInt(); style = Paint.Style.STROKE; strokeWidth = 1.5f * dp
        pathEffect = DashPathEffect(floatArrayOf(8 * dp, 6 * dp), 0f)
    }
    private val grid = Paint().apply { color = 0xFFE2E8F0.toInt(); strokeWidth = 1 * dp }

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        setMeasuredDimension(MeasureSpec.getSize(widthMeasureSpec), (220 * dp).toInt())
    }

    override fun onDraw(canvas: Canvas) {
        val left = 44 * dp
        val right = width - 8 * dp
        val top = 40 * dp
        val bottom = height - 22 * dp
        canvas.drawText(title, 0f, 18 * dp, titlePaint)

        val values = points.mapNotNull { it.second }
        if (values.isEmpty()) {
            canvas.drawText("Sin datos en este periodo", left, (top + bottom) / 2, text)
            return
        }
        // Las líneas (peso, FC) usan un eje que no parte en cero para que se vea la variación
        val rawMax = max(values.max(), goal ?: 0.0)
        val rawMin = if (line) values.min() else 0.0
        val pad = if (line) max((rawMax - rawMin) * 0.15, 1.0) else 0.0
        val vMax = rawMax * (if (line) 1.0 else 1.1) + pad
        val vMin = if (line) rawMin - pad else 0.0
        fun y(v: Double) = (bottom - (v - vMin) / (vMax - vMin) * (bottom - top)).toFloat()

        for (v in listOf(vMin, (vMin + vMax) / 2, vMax)) {
            canvas.drawLine(left, y(v), right, y(v), grid)
            canvas.drawText(format(v), 0f, y(v) + 4 * dp, text)
        }

        val n = points.size
        val slot = (right - left) / n
        if (line) {
            val path = Path()
            var started = false
            points.forEachIndexed { i, (_, v) ->
                if (v == null) return@forEachIndexed
                val x = left + slot * i + slot / 2
                if (!started) path.moveTo(x, y(v)) else path.lineTo(x, y(v))
                started = true
                canvas.drawCircle(x, y(v), 2.5f * dp, fill)
            }
            canvas.drawPath(path, stroke)
        } else {
            val barW = max(slot * 0.7f, 1f)
            points.forEachIndexed { i, (_, v) ->
                if (v == null) return@forEachIndexed
                val x = left + slot * i + (slot - barW) / 2
                fill.alpha = if (goal != null && v < goal) 150 else 255
                canvas.drawRect(x, y(v), x + barW, bottom, fill)
            }
            fill.alpha = 255
        }
        goal?.let {
            val path = Path().apply { moveTo(left, y(it)); lineTo(right, y(it)) }
            canvas.drawPath(path, goalPaint)
        }

        // Etiquetas del eje X: primera, del medio y última (o todas si son pocas)
        val idx = if (n <= 7) points.indices.toList() else listOf(0, n / 2, n - 1)
        for (i in idx) {
            val label = points[i].first
            val x = left + slot * i + slot / 2 - text.measureText(label) / 2
            canvas.drawText(label, x.coerceIn(left, right - text.measureText(label)), height - 4 * dp, text)
        }
    }
}
