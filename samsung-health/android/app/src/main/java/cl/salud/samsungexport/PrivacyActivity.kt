package cl.salud.samsungexport

import android.os.Bundle
import android.widget.ScrollView
import android.widget.TextView
import androidx.activity.ComponentActivity

/** Pantalla obligatoria de Health Connect que explica para qué se usan los datos. */
class PrivacyActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        showScreen(ScrollView(this).apply {
            addView(TextView(this@PrivacyActivity).apply {
                setText(R.string.privacy_text)
                textSize = 16f
                setTextColor(0xFF334155.toInt())
                setPadding(48, 48, 48, 48)
            })
        })
    }
}
