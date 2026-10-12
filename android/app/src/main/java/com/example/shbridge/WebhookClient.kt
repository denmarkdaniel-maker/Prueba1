package com.example.shbridge

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

object WebhookClient {

    /**
     * Envía el payload como JSON por POST. Corre en un hilo propio.
     * onDone(ok, detalle) se invoca desde ese hilo; el llamador debe volver al hilo de UI.
     */
    fun post(url: String, body: JSONObject, onDone: (Boolean, String) -> Unit) {
        thread(name = "webhook-post") {
            try {
                val conn = (URL(url).openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    doOutput = true
                    connectTimeout = 15_000
                    readTimeout = 30_000
                    setRequestProperty("Content-Type", "application/json; charset=utf-8")
                }
                conn.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }

                val code = conn.responseCode
                conn.disconnect()
                if (code in 200..299) onDone(true, "HTTP $code")
                else onDone(false, "HTTP $code")
            } catch (e: Exception) {
                onDone(false, e.message ?: e.javaClass.simpleName)
            }
        }
    }
}
