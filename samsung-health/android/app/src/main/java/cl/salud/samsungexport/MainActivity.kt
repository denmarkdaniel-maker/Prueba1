package cl.salud.samsungexport

import android.content.Intent
import android.net.Uri
import android.graphics.Typeface
import android.os.Bundle
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

class MainActivity : ComponentActivity() {

    private lateinit var status: TextView
    private lateinit var btnExport: Button
    private lateinit var btnDashboard: Button
    private lateinit var btnShare: Button
    private var exported: List<Uri> = emptyList()
    private var client: HealthConnectClient? = null

    private lateinit var btnHistory: Button

    private val requestPermissions =
        registerForActivityResult(PermissionController.createRequestPermissionResultContract()) { granted ->
            log("Permisos concedidos: ${granted.size} de ${HealthExporter.ALL_PERMISSIONS.size}")
            setReady(granted.isNotEmpty())
        }

    private val pickZip = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) runImport { it.importZip(this, uri) }
    }

    private val pickFolder = registerForActivityResult(ActivityResultContracts.OpenDocumentTree()) { uri ->
        if (uri != null) runImport { it.importFolder(this, uri) }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        buildUi()
        connect()
    }

    private fun buildUi() {
        status = TextView(this).apply { textSize = 14f; setTextColor(0xFF334155.toInt()); setPadding(0, 24, 0, 0) }

        btnHistory = button("Ver análisis del historial importado") { openDashboard(imported = true) }
        btnHistory.isEnabled = ImportedStore.exists(this)
        btnExport = button("2. Exportar CSV de Health Connect") { export() }.apply { isEnabled = false }
        btnDashboard = button("3. Ver análisis de Health Connect") { openDashboard(imported = false) }.apply { isEnabled = false }
        btnShare = button("Compartir CSV (Claude, Excel, Drive…)") { share() }.apply { isEnabled = false }

        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(40, 40, 40, 40)
            addView(screenTitle("Exportar Samsung Health"))

            addView(section("A. Historial completo (recomendado)"))
            addView(hint(
                "1) Samsung Health → ⋮ → Ajustes → Descargar datos personales.\n" +
                    "2) Mis archivos → Download → Samsung Health: mantén presionada la carpeta «samsunghealth_…» → Comprimir.\n" +
                    "3) Importa aquí el .zip (o elige la carpeta directamente)."
            ))
            addView(button("Importar .zip de Samsung Health") { pickZip.launch(arrayOf("application/zip", "application/x-zip-compressed", "application/octet-stream")) })
            addView(button("…o elegir la carpeta exportada") { pickFolder.launch(null) })
            addView(btnHistory)

            addView(section("B. Health Connect (datos recientes)"))
            addView(hint("Samsung Health solo comparte aquí lo que sincroniza desde que activaste la conexión."))
            addView(button("1. Conceder permisos") { requestPermissions.launch(HealthExporter.ALL_PERMISSIONS) })
            addView(btnExport)
            addView(btnDashboard)

            addView(section("Compartir"))
            addView(btnShare)
            addView(status)
        }
        showScreen(ScrollView(this).apply { addView(layout) })
    }

    private fun button(text: String, onClick: () -> Unit) = Button(this).apply {
        this.text = text
        setOnClickListener { onClick() }
    }

    private fun section(text: String) = TextView(this).apply {
        this.text = text
        textSize = 17f
        typeface = Typeface.DEFAULT_BOLD
        setTextColor(0xFF0F172A.toInt())
        setPadding(0, 32, 0, 8)
    }

    private fun hint(text: String) = TextView(this).apply {
        this.text = text
        textSize = 13f
        setTextColor(0xFF64748B.toInt())
        setPadding(0, 0, 0, 8)
    }

    private fun openDashboard(imported: Boolean) {
        startActivity(Intent(this, DashboardActivity::class.java).putExtra(DashboardActivity.EXTRA_IMPORTED, imported))
    }

    /** Lee la exportación, guarda el resumen en la app y en Descargas, y abre el panel. */
    private fun runImport(read: (SamsungImport) -> List<Day>) {
        log("Importando historial de Samsung Health… (puede tardar un par de minutos)")
        lifecycleScope.launch {
            try {
                val (days, csv) = withContext(Dispatchers.IO) {
                    val days = read(SamsungImport { msg -> runOnUiThread { log(msg) } })
                    ImportedStore.save(this@MainActivity, days)
                    val stamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmm"))
                    val csv = CsvOutput(this@MainActivity, "samsung_historial_diario_$stamp.csv").use { out ->
                        out.writeRow("fecha", *ImportedStore.KEYS.toTypedArray())
                        for (d in days) out.writeRow(d.fecha, *ImportedStore.KEYS.map { d[it] }.toTypedArray())
                        out.uri
                    }
                    days to csv
                }
                log("✔ ${days.size} días con datos, del ${days.first().fecha} al ${days.last().fecha}.")
                log("Resumen diario guardado en Descargas/SamsungHealth.")
                exported = listOf(csv)
                btnShare.isEnabled = true
                btnHistory.isEnabled = true
                openDashboard(imported = true)
            } catch (e: Exception) {
                log("✖ ${e.message}")
            }
        }
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
                    setReady(granted.isNotEmpty())
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
                exported = withContext(Dispatchers.IO) {
                    HealthExporter(this@MainActivity, c) { msg -> runOnUiThread { log(msg) } }.exportAll()
                }
                btnShare.isEnabled = exported.isNotEmpty()
            } catch (e: Exception) {
                log("✖ Error: ${e.message}")
            } finally {
                btnExport.isEnabled = true
            }
        }
    }

    private fun setReady(ready: Boolean) {
        btnExport.isEnabled = ready
        btnDashboard.isEnabled = ready
    }

    private fun share() {
        val send = Intent(Intent.ACTION_SEND_MULTIPLE).apply {
            type = "text/csv"
            putParcelableArrayListExtra(Intent.EXTRA_STREAM, ArrayList(exported))
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        startActivity(Intent.createChooser(send, "Enviar datos de salud a…"))
    }

    private fun log(msg: String) {
        status.append(msg + "\n")
    }
}
