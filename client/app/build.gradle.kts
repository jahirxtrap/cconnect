import org.jetbrains.compose.desktop.application.dsl.TargetFormat

plugins {
    alias(libs.plugins.kotlin.multiplatform)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.compose.multiplatform)
    alias(libs.plugins.android.library)
}

val appVersionName = "1.4.1"
val supportedServerRange = ">=1.4.0"

val lwjglVersion = libs.versions.lwjgl.get()
val lwjglNatives = run {
    val name = System.getProperty("os.name").lowercase()
    val arch = System.getProperty("os.arch").lowercase()
    val arm = arch.contains("aarch64") || arch.contains("arm")
    when {
        name.contains("win") -> "natives-windows"
        name.contains("mac") || name.contains("darwin") -> if (arm) "natives-macos-arm64" else "natives-macos"
        else -> if (arm) "natives-linux-arm64" else "natives-linux"
    }
}

val generateBuildConfig by tasks.registering {
    val outDir = layout.buildDirectory.dir("generated/buildConfig/kotlin")
    val versionName = appVersionName
    val supported = supportedServerRange
    outputs.dir(outDir)
    doLast {
        val pkg = outDir.get().asFile.resolve("com/jahirtrap/cconnect")
        pkg.mkdirs()
        pkg.resolve("BuildConfig.kt").writeText(
            """
            package com.jahirtrap.cconnect

            object BuildConfig {
                const val VERSION_NAME = "$versionName"
                const val SUPPORTED_SERVER = "$supported"
            }
            """.trimIndent() + "\n"
        )
    }
}

kotlin {
    jvmToolchain(21)

    jvm("desktop")

    @OptIn(org.jetbrains.kotlin.gradle.ExperimentalWasmDsl::class)
    wasmJs {
        browser {
            commonWebpackConfig {
                outputFileName = "cconnect.js"
            }
        }
        binaries.executable()
    }

    androidTarget {
        compilerOptions {
            jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_11)
        }
    }

    sourceSets {
        val commonMain by getting {
            kotlin.srcDir(generateBuildConfig)

            dependencies {
                implementation(compose.runtime)
                implementation(compose.foundation)
                implementation(compose.ui)
                implementation(compose.components.resources)
                implementation(libs.material3)
                implementation(libs.coil.compose)
                implementation(libs.coil.svg)
                implementation(libs.icons.lucide)
                implementation(libs.icons.font.awesome.brands)
                implementation(libs.lifecycle.viewmodel.compose)
                implementation(libs.kotlinx.coroutines.core)
                implementation(libs.kotlinx.serialization.json)
                implementation(libs.jetbrains.markdown)
            }
        }
        val jvmSharedMain by creating {
            dependsOn(commonMain)
            dependencies {
                implementation(libs.sshj)
                implementation(libs.bouncycastle)
            }
        }
        val desktopMain by getting {
            dependsOn(jvmSharedMain)
            dependencies {
                implementation(compose.desktop.currentOs)
                implementation(libs.kotlinx.coroutines.swing)

                implementation(libs.okhttp)
                implementation(libs.coil.network.okhttp)

                implementation(libs.sshj)
                implementation(libs.bouncycastle)

                implementation(libs.lwjgl.core)
                implementation(libs.lwjgl.tinyfd)
                implementation(libs.jna)
                implementation(libs.jna.platform)
                runtimeOnly("org.lwjgl:lwjgl:$lwjglVersion:$lwjglNatives")
                runtimeOnly("org.lwjgl:lwjgl-tinyfd:$lwjglVersion:$lwjglNatives")
            }
        }
        val wasmJsMain by getting {
            dependencies {
                implementation(libs.ktor.client.core)
                implementation(libs.ktor.client.js)
                implementation(libs.coil.network.ktor3)
                implementation(libs.kotlinx.browser)
            }
        }
        val androidMain by getting {
            dependsOn(jvmSharedMain)
            dependencies {
                implementation(libs.androidx.activity.compose)
                implementation(libs.androidx.core.ktx)
                implementation(libs.androidx.appcompat)
                implementation(libs.androidx.lifecycle.process)
                implementation(libs.androidx.lifecycle.runtime.ktx)
                implementation(libs.okhttp)
                implementation(libs.coil.network.okhttp)
                implementation(libs.androidx.security.crypto)
                implementation(libs.play.code.scanner)
            }
        }
    }
}

android {
    namespace = "com.jahirtrap.cconnect.shared"
    compileSdk = 37

    defaultConfig {
        minSdk = 26
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
}

compose.resources {
    publicResClass = true
    packageOfResClass = "com.jahirtrap.cconnect.resources"
    generateResClass = always
}

compose.desktop {
    application {
        mainClass = "com.jahirtrap.cconnect.MainKt"
        jvmArgs += listOf("--add-opens", "java.desktop/sun.awt.X11=ALL-UNNAMED")

        nativeDistributions {
            targetFormats(TargetFormat.Msi, TargetFormat.Exe, TargetFormat.Deb, TargetFormat.Rpm, TargetFormat.Dmg)
            modules("jdk.unsupported")
            packageName = "CConnect"
            packageVersion = appVersionName
            description = "CConnect"
            vendor = "jahirtrap"
            windows {
                iconFile.set(project.file("icons/cconnect.ico"))
                menuGroup = "CConnect"
                shortcut = true
                dirChooser = true
                perUserInstall = true
                upgradeUuid = "8f2a6c41-3b7e-4d59-9a1c-2e5f7b0d4c83"
            }
            linux {
                iconFile.set(project.file("icons/cconnect.png"))
            }
            macOS {
                iconFile.set(project.file("icons/cconnect.icns"))
            }
        }
    }
}
