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
    // AAR del Samsung Health Data SDK, descargado manualmente desde developer.samsung.com
    // y copiado en android/app/libs/ (ver android/README.md).
    implementation(fileTree(mapOf("dir" to "libs", "include" to listOf("*.aar"))))

    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
}
