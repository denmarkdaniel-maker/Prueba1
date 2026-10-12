import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// La URL del webhook es una credencial: se lee de local.properties (no versionado).
val localProps = Properties().apply {
    val f = rootProject.file("local.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}
val webhookUrl: String = localProps.getProperty("claude.webhookUrl", "")
val ingestToken: String = localProps.getProperty("claude.ingestToken", "")

android {
    namespace = "com.example.shbridge"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.example.shbridge"
        minSdk = 29
        targetSdk = 34
        versionCode = 1
        versionName = "0.1.0"

        buildConfigField("String", "WEBHOOK_URL", "\"$webhookUrl\"")
        buildConfigField("String", "INGEST_TOKEN", "\"$ingestToken\"")
    }

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    // Health Connect: lectura de datos que Samsung Health sincroniza.
    implementation("androidx.health.connect:connect-client:1.1.0-alpha07")

    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.activity:activity-ktx:1.9.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.3")
}
