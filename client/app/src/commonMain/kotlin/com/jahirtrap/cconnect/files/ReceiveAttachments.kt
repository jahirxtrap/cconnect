package com.jahirtrap.cconnect.files

import androidx.compose.ui.Modifier

/** Lets the composer take files the system hands to it — pasted from the clipboard or dropped by
 *  the keyboard. Android needs the field to declare it, or the system refuses the paste on its own
 *  ("CConnect no admite el pegado de imágenes aquí"); elsewhere the paste listener already covers it. */
expect fun Modifier.receiveAttachments(onFiles: (List<AttachmentFile>) -> Unit): Modifier
