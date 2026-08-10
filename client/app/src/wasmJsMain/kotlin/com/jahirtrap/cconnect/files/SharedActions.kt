package com.jahirtrap.cconnect.files

import com.jahirtrap.cconnect.data.remote.Backend

actual suspend fun downloadShared(url: String, filename: String): Boolean {
    val header = Backend.authHeaders.firstOrNull()
    browserDownload(url, filename, header?.first ?: "", header?.second ?: "")
    return true
}

actual suspend fun saveSharedAs(url: String, filename: String): Boolean {
    val header = Backend.authHeaders.firstOrNull()
    browserSaveAs(url, filename, header?.first ?: "", header?.second ?: "")
    return true
}

actual suspend fun openSharedExternally(url: String, filename: String): Boolean {
    copyToClipboard(url)
    return true
}

actual suspend fun openSharedInBrowser(url: String, filename: String): Boolean {
    val header = Backend.authHeaders.firstOrNull()
    openInNewTab(url, header?.first ?: "", header?.second ?: "")
    return true
}

actual suspend fun saveAllShared(items: List<Pair<String, String>>): Boolean {
    items.forEach { (url, name) -> downloadShared(url, name) }
    return true
}

actual suspend fun openAllSharedExternally(items: List<Pair<String, String>>): Boolean {
    copyToClipboard(items.joinToString("\n") { it.first })
    return true
}

private fun copyToClipboard(text: String) {
    js("{ if (navigator.clipboard) navigator.clipboard.writeText(text); }")
}

actual suspend fun saveTextToDownloads(filename: String, text: String): Boolean {
    downloadText(filename, text)
    return true
}

actual suspend fun saveTextAs(filename: String, text: String): Boolean {
    saveTextPicker(filename, text)
    return true
}

actual suspend fun shareText(filename: String, text: String): Boolean {
    copyToClipboard(text)
    return true
}

private fun downloadText(filename: String, text: String) {
    js(
        """{
        const blob = new Blob([text], { type: 'text/markdown' });
        const objUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objUrl; a.download = filename;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(objUrl);
    }"""
    )
}

private fun saveTextPicker(filename: String, text: String) {
    js(
        """{
        (async function() {
          try {
            const blob = new Blob([text], { type: 'text/markdown' });
            if (window.showSaveFilePicker) {
              const handle = await window.showSaveFilePicker({ suggestedName: filename });
              const w = await handle.createWritable();
              await w.write(blob); await w.close();
            } else {
              const objUrl = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = objUrl; a.download = filename;
              document.body.appendChild(a); a.click(); a.remove();
              URL.revokeObjectURL(objUrl);
            }
          } catch (e) {}
        })();
    }"""
    )
}

private fun browserSaveAs(url: String, filename: String, headerName: String, headerValue: String) {
    js(
        """{
        const headers = headerName ? { [headerName]: headerValue } : {};
        (async function() {
          try {
            const resp = await fetch(url, { headers: headers });
            const blob = await resp.blob();
            if (window.showSaveFilePicker) {
              const handle = await window.showSaveFilePicker({ suggestedName: filename });
              const w = await handle.createWritable();
              await w.write(blob);
              await w.close();
            } else {
              const objUrl = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = objUrl; a.download = filename;
              document.body.appendChild(a); a.click(); a.remove();
              URL.revokeObjectURL(objUrl);
            }
          } catch (e) {}
        })();
    }"""
    )
}

private fun browserDownload(url: String, filename: String, headerName: String, headerValue: String) {
    js(
        """{
        const headers = headerName ? { [headerName]: headerValue } : {};
        fetch(url, { headers: headers })
          .then(function(r) { return r.blob(); })
          .then(function(b) {
            const objUrl = URL.createObjectURL(b);
            const a = document.createElement('a');
            a.href = objUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(objUrl);
          });
    }"""
    )
}

private fun openInNewTab(url: String, headerName: String, headerValue: String) {
    js(
        """{
        const headers = headerName ? { [headerName]: headerValue } : {};
        fetch(url, { headers: headers })
          .then(function(r) { return r.blob(); })
          .then(function(b) { window.open(URL.createObjectURL(b), '_blank'); });
    }"""
    )
}
