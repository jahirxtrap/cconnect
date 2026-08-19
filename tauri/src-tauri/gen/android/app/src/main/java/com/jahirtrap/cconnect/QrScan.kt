package com.jahirtrap.cconnect

import android.app.Activity
import android.webkit.WebView
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.common.moduleinstall.ModuleInstall
import com.google.android.gms.common.moduleinstall.ModuleInstallRequest
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning
import org.json.JSONObject

class QrScan(private val activity: Activity, private val webView: () -> WebView?) {

    fun available(): Boolean = runCatching {
        GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(activity) == ConnectionResult.SUCCESS
    }.getOrDefault(false)

    fun scan() {
        runCatching {
            val options = GmsBarcodeScannerOptions.Builder()
                .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
                .build()
            val scanner = GmsBarcodeScanning.getClient(activity, options)
            fun launch() {
                scanner.startScan()
                    .addOnSuccessListener { deliver(it.rawValue) }
                    .addOnCanceledListener { deliver(null) }
                    .addOnFailureListener { deliver(null) }
            }
            val moduleInstall = ModuleInstall.getClient(activity)
            moduleInstall.areModulesAvailable(scanner)
                .addOnSuccessListener { response ->
                    if (response.areModulesAvailable()) {
                        launch()
                    } else {
                        moduleInstall.installModules(ModuleInstallRequest.newBuilder().addApi(scanner).build())
                            .addOnSuccessListener { launch() }
                            .addOnFailureListener { deliver(null) }
                    }
                }
                .addOnFailureListener { launch() }
        }.onFailure { deliver(null) }
    }

    private fun deliver(raw: String?) {
        val payload = if (raw == null) "null" else JSONObject.quote(raw)
        activity.runOnUiThread {
            webView()?.evaluateJavascript("window.__cconnectQrResult && window.__cconnectQrResult($payload)", null)
        }
    }
}
