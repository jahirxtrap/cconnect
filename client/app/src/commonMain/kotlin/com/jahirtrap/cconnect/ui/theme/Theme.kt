package com.jahirtrap.cconnect.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3ExpressiveApi
import androidx.compose.material3.MaterialExpressiveTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.MotionScheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.jahirtrap.cconnect.data.remote.Backend
import com.jahirtrap.cconnect.resources.Res
import com.jahirtrap.cconnect.ui.ProvideIsTouch
import com.jahirtrap.cconnect.resources.cconnect_color_bold
import com.jahirtrap.cconnect.resources.cconnect_color_regular
import com.jahirtrap.cconnect.resources.cconnect_flat_bold
import com.jahirtrap.cconnect.resources.cconnect_flat_regular
import org.jetbrains.compose.resources.Font

enum class ThemeMode { SYSTEM, LIGHT, DARK }

fun themeModeOf(value: String): ThemeMode = when (value) {
    "light" -> ThemeMode.LIGHT
    "dark" -> ThemeMode.DARK
    else -> ThemeMode.SYSTEM
}

@Composable
fun dynamicAccent(themeMode: String): Color = systemAccent() ?: MaterialTheme.colorScheme.primary

@OptIn(ExperimentalMaterial3ExpressiveApi::class)
@Composable
fun CConnectTheme(
    themeMode: ThemeMode = ThemeMode.SYSTEM,
    dynamicColor: Boolean = true,
    accent: Color = accentAt(4),
    environmentAccent: Int? = Backend.accentIndex,
    fontStyle: String = "flat",
    content: @Composable () -> Unit,
) {
    val dark = when (themeMode) {
        ThemeMode.LIGHT -> false
        ThemeMode.DARK -> true
        ThemeMode.SYSTEM -> isSystemInDarkTheme()
    }

    ApplySystemBarsAppearance(dark)

    // The accent is the ONLY color: from the palette.
    // The background/surfaces stay flat black/white regardless.
    // The active environment overrides both the picked accent and the system one.
    val accentColor = when {
        environmentAccent == DYNAMIC_ACCENT -> systemAccent() ?: accent
        environmentAccent != null -> accentAt(environmentAccent)
        dynamicColor -> systemAccent() ?: accent
        else -> accent
    }

    val base = if (dark) darkColorScheme() else lightColorScheme()
    val tokens = tokensFor(dark)

    val colorScheme = base.copy(
        primary = accentColor,
        onPrimary = tokens.onAccent,
        secondary = accentColor,
        tertiary = accentColor,
        background = tokens.background,
        onBackground = tokens.onBackground,
        surface = tokens.surface,
        onSurface = tokens.onBackground,
        surfaceVariant = tokens.surfaceVariant,
        onSurfaceVariant = tokens.onSurfaceVariant,
        surfaceContainer = tokens.surface,
        surfaceContainerHigh = tokens.surfaceVariant,
        surfaceContainerHighest = tokens.surfaceVariant,
        surfaceContainerLow = tokens.background,
        surfaceContainerLowest = tokens.background,
        outline = tokens.outline,
        outlineVariant = tokens.outlineVariant,
        error = tokens.error,
        scrim = Color(0x99000000),
    )

    MaterialExpressiveTheme(
        colorScheme = colorScheme,
        motionScheme = MotionScheme.standard(),
        shapes = AppShapes,
        typography = AppTypography.withFamily(appFontFamily(fontStyle)),
    ) {
        CompositionLocalProvider(
            LocalPalette provides paletteFor(dark),
            LocalMonoFontFamily provides appMonoFontFamily(fontStyle),
        ) {
            ProvideIsTouch(content)
        }
    }
}

private val AppShapes = Shapes(
    extraSmall = RoundedCornerShape(Radius.xs),
    small = RoundedCornerShape(Radius.sm),
    medium = RoundedCornerShape(Radius.md),
    large = RoundedCornerShape(Radius.lg),
    extraLarge = RoundedCornerShape(Radius.xl),
)

private val AppTypography: Typography = Typography().run {
    copy(
        displayLarge = displayLarge.flatten(40, 48, FontWeight.SemiBold),
        displayMedium = displayMedium.flatten(32, 40, FontWeight.SemiBold),
        displaySmall = displaySmall.flatten(28, 36, FontWeight.SemiBold),
        headlineLarge = headlineLarge.flatten(24, 32, FontWeight.SemiBold),
        headlineMedium = headlineMedium.flatten(22, 30, FontWeight.SemiBold),
        headlineSmall = headlineSmall.flatten(20, 28, FontWeight.SemiBold),
        titleLarge = titleLarge.flatten(17, 24, FontWeight.SemiBold),
        titleMedium = titleMedium.flatten(15, 20, FontWeight.SemiBold),
        titleSmall = titleSmall.flatten(14, 20, FontWeight.SemiBold),
        bodyLarge = bodyLarge.flatten(16, 24, FontWeight.Normal),
        bodyMedium = bodyMedium.flatten(14, 20, FontWeight.Normal),
        bodySmall = bodySmall.flatten(12, 16, FontWeight.Normal),
        labelLarge = labelLarge.flatten(14, 20, FontWeight.SemiBold),
        labelMedium = labelMedium.flatten(12, 16, FontWeight.SemiBold),
        labelSmall = labelSmall.flatten(11, 16, FontWeight.SemiBold),
    )
}

private fun TextStyle.flatten(size: Int, height: Int, weight: FontWeight) =
    copy(fontSize = size.sp, lineHeight = height.sp, fontWeight = weight, letterSpacing = 0.sp)

@Composable
fun appFontFamily(fontStyle: String): FontFamily {
    if (fontStyle != "flat" && fontStyle != "color") return FontFamily.Default
    val color = fontStyle == "color"
    return FontFamily(
        Font(if (color) Res.font.cconnect_color_regular else Res.font.cconnect_flat_regular, FontWeight.Normal),
        Font(if (color) Res.font.cconnect_color_bold else Res.font.cconnect_flat_bold, FontWeight.Bold),
    )
}

private fun Typography.withFamily(family: FontFamily): Typography = copy(
    displayLarge = displayLarge.copy(fontFamily = family),
    displayMedium = displayMedium.copy(fontFamily = family),
    displaySmall = displaySmall.copy(fontFamily = family),
    headlineLarge = headlineLarge.copy(fontFamily = family),
    headlineMedium = headlineMedium.copy(fontFamily = family),
    headlineSmall = headlineSmall.copy(fontFamily = family),
    titleLarge = titleLarge.copy(fontFamily = family),
    titleMedium = titleMedium.copy(fontFamily = family),
    titleSmall = titleSmall.copy(fontFamily = family),
    bodyLarge = bodyLarge.copy(fontFamily = family),
    bodyMedium = bodyMedium.copy(fontFamily = family),
    bodySmall = bodySmall.copy(fontFamily = family),
    labelLarge = labelLarge.copy(fontFamily = family),
    labelMedium = labelMedium.copy(fontFamily = family),
    labelSmall = labelSmall.copy(fontFamily = family),
)
