package com.jahirtrap.cconnect.files

private val MARKDOWN_EXTENSIONS = setOf("md", "markdown")

private val TEXT_APPLICATION_MIMES = setOf(
    "application/json", "application/xml", "application/javascript", "application/typescript",
    "application/x-sh", "application/x-yaml", "application/yaml", "application/toml",
    "application/sql", "application/x-bat",
)
private val TEXT_FALLBACK_EXTENSIONS = setOf(
    "kt", "kts", "gradle", "toml", "ini", "cfg", "conf", "properties", "env", "yml", "yaml",
    "ts", "tsx", "jsx", "rs", "go", "ps1", "diff", "patch", "log", "lock",
)

private val VIDEO_EXTENSIONS = setOf("mp4", "webm", "ogv", "mov", "m4v", "mkv")

expect fun guessMimeType(filename: String): String?

enum class PreviewKind { Image, Markdown, Html, Text, Video, None }

fun previewKindOf(filename: String): PreviewKind {
    val name = filename.substringBefore('?').substringBefore('#')
    val extension = name.substringAfterLast('.', "").lowercase()
    if (extension in MARKDOWN_EXTENSIONS) return PreviewKind.Markdown
    val mime = guessMimeType(name)
    return when {
        mime == "text/html" -> PreviewKind.Html
        mime?.startsWith("image/") == true -> PreviewKind.Image
        mime?.startsWith("video/") == true -> PreviewKind.Video
        mime?.startsWith("text/") == true -> PreviewKind.Text
        mime in TEXT_APPLICATION_MIMES -> PreviewKind.Text
        extension in VIDEO_EXTENSIONS -> PreviewKind.Video
        extension in TEXT_FALLBACK_EXTENSIONS -> PreviewKind.Text
        else -> PreviewKind.None
    }
}

fun isVideo(filename: String): Boolean = previewKindOf(filename) == PreviewKind.Video

fun isPreviewable(filename: String): Boolean = previewKindOf(filename) != PreviewKind.None
