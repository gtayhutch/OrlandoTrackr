package com.orlandotrackr.shared

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.Card
import androidx.compose.material.MaterialTheme
import androidx.compose.material.Surface
import androidx.compose.material.Text
import androidx.compose.material.lightColors
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

private data class SampleWait(val name: String, val park: String, val minutes: Int?)

private val sampleWaits = listOf(
    SampleWait("Space Mountain", "Walt Disney World", 35),
    SampleWait("Hagrid’s Motorbike Adventure", "Universal Orlando", 68),
    SampleWait("Penguin Trek", "SeaWorld Orlando", 25),
    SampleWait("The Dragon", "LEGOLAND Florida", null),
)

private val waitColors = lightColors(
    primary = Color(0xFF244F55),
    secondary = Color(0xFFA44830),
    background = Color(0xFFF7F2E8),
    onBackground = Color(0xFF192A33),
    surface = Color.White,
    onSurface = Color(0xFF192A33),
)
private val MUTED_TEXT = Color(0xFF4F5F65)
private val CARD_OUTLINE = Color(0xFFD9D2C5)
private const val SHORT_WAIT_LIMIT_MINUTES = 30
private const val LONG_WAIT_START_MINUTES = 60

private enum class WaitBand(val label: String, val ink: Color, val fill: Color) {
    SHORT("Short wait", Color(0xFF285740), Color(0xFFE1EBDD)),
    MODERATE("Moderate wait", Color(0xFF694A13), Color(0xFFF3E8CA)),
    LONG("Long wait", Color(0xFF843D32), Color(0xFFF3E2DB)),
    UNAVAILABLE("Unavailable", Color(0xFF50565A), Color(0xFFECE9E3)),
}

private fun waitBand(minutes: Int?): WaitBand = when {
    minutes == null -> WaitBand.UNAVAILABLE
    minutes < SHORT_WAIT_LIMIT_MINUTES -> WaitBand.SHORT
    minutes < LONG_WAIT_START_MINUTES -> WaitBand.MODERATE
    else -> WaitBand.LONG
}

/** Renders the shared fixture board used to verify native rendering. */
@Composable
internal fun WaitBoard() {
    MaterialTheme(colors = waitColors) {
        Surface(color = MaterialTheme.colors.background, modifier = Modifier.fillMaxSize()) {
            LazyColumn(
                modifier = Modifier.windowInsetsPadding(WindowInsets.safeDrawing).padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                item {
                    Text(
                        "OrlandoTrackr",
                        style = MaterialTheme.typography.h4,
                        color = MaterialTheme.colors.primary,
                        modifier = Modifier.semantics { heading() },
                    )
                    Text("Sample park waits", color = MaterialTheme.colors.secondary)
                }
                items(sampleWaits, key = { it.name }) { wait -> WaitCard(wait) }
            }
        }
    }
}

@Composable
private fun WaitCard(wait: SampleWait) {
    val band = waitBand(wait.minutes)
    Card(
        modifier = Modifier.fillMaxWidth(),
        border = BorderStroke(1.dp, CARD_OUTLINE),
        elevation = 0.dp,
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(wait.name, style = MaterialTheme.typography.subtitle1)
                Text(wait.park, style = MaterialTheme.typography.body2, color = MUTED_TEXT)
            }
            Column(
                horizontalAlignment = Alignment.End,
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                if (wait.minutes != null) {
                    Text("${wait.minutes} min", style = MaterialTheme.typography.subtitle1)
                }
                Text(
                    band.label,
                    color = band.ink,
                    style = MaterialTheme.typography.caption,
                    modifier = Modifier.background(band.fill, RoundedCornerShape(4.dp))
                        .padding(horizontal = 6.dp, vertical = 3.dp),
                )
            }
        }
    }
}
