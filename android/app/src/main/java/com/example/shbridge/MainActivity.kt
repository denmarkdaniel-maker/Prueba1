package com.example.shbridge

import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class MainActivity : AppCompatActivity() {

    private lateinit var status: TextView
    private val reader by lazy { HealthConnectReader(this) }

    private val requestPermissions = registerForActivityResult(
        PermissionController.createRequestPermissionResultContract()
    ) { granted ->
        if (granted.containsAll(reader.permissions)) sync()
        else status.text = "Faltan permisos de lectura en Health Connect"
    }

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
        if (reader.availability() != HealthConnectClient.SDK_AVAILABLE) {
            status.text = "Health Connect no está disponible en este celular"
            return
        }

        lifecycleScope.launch {
            try {
                if (!reader.grantedPermissions().containsAll(reader.permissions)) {
                    requestPermissions.launch(reader.permissions)
                    return@launch
                }

                status.text = "Leyendo Samsung Health…"
                val payload = withContext(Dispatchers.IO) { reader.readRecent(days = 7) }

                status.text = "Enviando a Claude…"
                WebhookClient.post(BuildConfig.WEBHOOK_URL, payload) { ok, detail ->
                    runOnUiThread {
                        status.text = if (ok) "Enviado a Claude ✓" else "Falló el envío: $detail"
                    }
                }
            } catch (e: Exception) {
                status.text = "Error al leer: ${e.message}"
            }
        }
    }
}
