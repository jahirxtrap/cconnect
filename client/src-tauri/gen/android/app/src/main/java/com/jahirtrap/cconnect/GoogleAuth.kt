package com.jahirtrap.cconnect

import android.app.Activity
import android.content.Intent
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.IntentSenderRequest
import com.google.android.gms.auth.api.identity.AuthorizationRequest
import com.google.android.gms.auth.api.identity.Identity
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.common.api.Scope
import org.json.JSONObject

class GoogleAuth(
    private val activity: Activity,
    private val view: () -> WebView?,
    private val consent: () -> ActivityResultLauncher<IntentSenderRequest>,
) {
    companion object {
        const val DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file"
    }

    @JavascriptInterface
    fun isAvailable(): Boolean =
        GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(activity) == ConnectionResult.SUCCESS

    @JavascriptInterface
    fun authorize(interactive: Boolean) {
        val request = AuthorizationRequest.builder()
            .setRequestedScopes(listOf(Scope(DRIVE_SCOPE)))
            .build()
        Identity.getAuthorizationClient(activity)
            .authorize(request)
            .addOnSuccessListener { result ->
                val pending = result.pendingIntent
                if (!result.hasResolution() || pending == null) {
                    answer(result.accessToken)
                } else if (interactive) {
                    consent().launch(IntentSenderRequest.Builder(pending.intentSender).build())
                } else {
                    answer(null)
                }
            }
            .addOnFailureListener { answer(null) }
    }

    fun onConsent(data: Intent?) {
        val token = runCatching {
            Identity.getAuthorizationClient(activity).getAuthorizationResultFromIntent(data).accessToken
        }.getOrNull()
        answer(token)
    }

    private fun answer(token: String?) {
        val target = view() ?: return
        target.post {
            target.evaluateJavascript(
                "window.__cconnectGoogleToken && window.__cconnectGoogleToken(${JSONObject.quote(token ?: "")})",
                null,
            )
        }
    }
}
