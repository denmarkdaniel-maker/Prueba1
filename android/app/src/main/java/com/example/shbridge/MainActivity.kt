package com.example.shbridge

import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import org.json.JSONObject

class MainActivity : AppCompatActivity() {

    private lateinit var status: TextView
    private val reader by lazy { SamsungHealthReader(this) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        status = findViewById(R.id.status)
        findViewById<Button>(R.id.btnSync).setOnClickListener { sync() }
    }

    private fun sync() {
        if (BuildConfig.WEBHOOK_URL.isBlank()) {
            status.text = "Falta claude.webhookUrl en local.properties"
            return
        }
        status.text = "Conectando con Samsung Health…"

        reader.readRecentData(days = 7) { result ->
            result.fold(
                onSuccess = { payload -> send(payload) },
                onFailure = { e -> runOnUiThread { status.text = "Error al leer: ${e.message}" } }
            )
        }
    }

    private fun send(payload: JSONObject) {
        WebhookClient.post(BuildConfig.WEBHOOK_URL, payload) { ok, detail ->
            runOnUiThread {
                status.text = if (ok) "Enviado a Claude ✓" else "Falló el envío: $detail"
            }
        }
    }
}
