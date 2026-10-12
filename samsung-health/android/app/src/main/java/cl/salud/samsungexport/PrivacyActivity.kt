package cl.salud.samsungexport

import android.os.Bundle
import android.widget.TextView
import androidx.activity.ComponentActivity

/** Pantalla obligatoria de Health Connect que explica para qué se usan los datos. */
class PrivacyActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(TextView(this).apply {
            setText(R.string.privacy_text)
            textSize = 16f
            setPadding(48, 48, 48, 48)
        })
    }
}
