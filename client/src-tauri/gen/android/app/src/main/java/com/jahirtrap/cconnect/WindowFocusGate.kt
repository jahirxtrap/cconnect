package com.jahirtrap.cconnect

object WindowFocusGate {
  @Volatile var resumed = false
  private var delivered = false

  @JvmStatic
  fun allows(hasWindowFocus: Boolean): Boolean {
    val allowed = if (hasWindowFocus) !delivered else !resumed
    if (allowed) delivered = hasWindowFocus
    return allowed
  }
}
