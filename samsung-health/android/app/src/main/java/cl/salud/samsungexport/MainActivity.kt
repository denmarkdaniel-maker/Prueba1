package cl.salud.samsungexport

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class MainActivity : ComponentActivity() {

    private lateinit var status: TextView
    private lateinit var btnExport: Button
    private var client: HealthConnectClient? = null

    private val requestPermissions =
        registerForActivityResult(PermissionController.createRequestPermissionResultContract()) { granted ->
            log("Permisos concedidos: ${granted.size} de ${HealthExporter.ALL_PERMISSIONS.size}")
            btnExport.isEnabled = granted.isNotEmpty()
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        buildUi()
        connect()
    }

    private fun buildUi() {
        status = TextView(this).apply { textSize = 14f }
        val btnPermissions = Button(this).apply {
            text = "1. Conceder permisos"
            setOnClickListener { requestPermissions.launch(HealthExporter.ALL_PERMISSIONS) }
        }
        btnExport = Button(this).apply {
            text = "2. Exportar todos mis datos"
            isEnabled = false
            setOnClickListener { export() }
        }
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(40, 40, 40, 40)
            addView(btnPermissions)
            addView(btnExport)
            addView(status)
        }
        setContentView(ScrollView(this).apply { addView(layout) })
    }

    private fun connect() {
        when (HealthConnectClient.getSdkStatus(this)) {
            HealthConnectClient.SDK_AVAILABLE -> {
                val c = HealthConnectClient.getOrCreate(this)
                client = c
                log("Health Connect disponible.")
                lifecycleScope.launch {
                    val granted = c.permissionController.getGrantedPermissions()
                    log("Permisos ya concedidos: ${granted.size} de ${HealthExporter.ALL_PERMISSIONS.size}")
                    btnExport.isEnabled = granted.isNotEmpty()
                }
            }
            HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> {
                log("Debes instalar o actualizar Health Connect desde Play Store.")
                startActivity(
                    Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=com.google.android.apps.healthdata"))
                )
            }
            else -> log("Health Connect no está disponible en este teléfono.")
        }
    }

    private fun export() {
        val c = client ?: return
        btnExport.isEnabled = false
        log("Exportando… (puede tardar varios minutos si hay años de datos)")
        lifecycleScope.launch {
            try {
                withContext(Dispatchers.IO) {
                    HealthExporter(this@MainActivity, c) { msg -> runOnUiThread { log(msg) } }.exportAll()
                }
            } catch (e: Exception) {
                log("✖ Error: ${e.message}")
            } finally {
                btnExport.isEnabled = true
            }
        }
    }

    private fun log(msg: String) {
        status.append(msg + "\n")
    }
}
