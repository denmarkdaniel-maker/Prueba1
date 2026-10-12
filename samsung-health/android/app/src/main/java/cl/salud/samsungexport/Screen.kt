package cl.salud.samsungexport

import android.graphics.Color
import android.graphics.Typeface
import android.view.View
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

const val BACKGROUND = 0xFFF8FAFC.toInt()

/**
 * Desde Android 15 las apps se dibujan bajo la barra de estado y la de navegación.
 * Se deja un margen del tamaño de esas barras para que nada quede tapado.
 */
fun ComponentActivity.showScreen(root: View) {
    enableEdgeToEdge(
        statusBarStyle = SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT),
        navigationBarStyle = SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT),
    )
    root.setBackgroundColor(BACKGROUND)
    ViewCompat.setOnApplyWindowInsetsListener(root) { v, insets ->
        val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
        v.setPadding(bars.left, bars.top, bars.right, bars.bottom)
        insets
    }
    setContentView(root)
}

fun ComponentActivity.screenTitle(text: String) = TextView(this).apply {
    this.text = text
    textSize = 22f
    typeface = Typeface.DEFAULT_BOLD
    setTextColor(0xFF0F172A.toInt())
    setPadding(0, 0, 0, (12 * resources.displayMetrics.density).toInt())
}
