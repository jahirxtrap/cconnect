import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.compose.multiplatform)
}

val appVersionName = "1.4.0"
val appVersionCode = 29

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_11)
    }
}

android {
    namespace = "com.jahirtrap.cconnect"
    compileSdk = 37

    defaultConfig {
        applicationId = "com.jahirtrap.cconnect"
        minSdk = 26
        targetSdk = 36
        versionCode = appVersionCode
        versionName = appVersionName
    }

    val keystorePropsFile = rootProject.file("key.properties")
    val keystoreProps = if (keystorePropsFile.exists()) {
        Properties().apply { keystorePropsFile.inputStream().use { load(it) } }
    } else null

    if (keystoreProps != null) {
        signingConfigs {
            create("release") {
                storeFile = rootProject.file(keystoreProps["storeFile"] as String)
                storePassword = keystoreProps["storePassword"] as String
                keyAlias = keystoreProps["keyAlias"] as String
                keyPassword = keystoreProps["keyPassword"] as String
            }
        }
    }

    buildTypes {
        getByName("release") {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            if (keystoreProps != null) signingConfig = signingConfigs.getByName("release")
            applicationVariants.all {
                outputs.all {
                    (this as com.android.build.gradle.internal.api.BaseVariantOutputImpl).outputFileName =
                        "CConnect-$appVersionName.apk"
                }
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
}

dependencies {
    implementation(project(":app"))
    implementation(compose.runtime)
    implementation(compose.foundation)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.appcompat)
}
