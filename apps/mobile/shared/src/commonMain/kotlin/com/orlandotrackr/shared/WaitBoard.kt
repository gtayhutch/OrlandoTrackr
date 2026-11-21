package com.orlandotrackr.shared

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
import androidx.compose.material.Card
import androidx.compose.material.MaterialTheme
import androidx.compose.material.Surface
import androidx.compose.material.Text
import androidx.compose.material.darkColors
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

private data class SampleWait(val name: String, val park: String, val minutes: Int?)

private val sampleWaits = listOf(
    SampleWait("Space Mountain", "Walt Disney World", 35),
    SampleWait("Hagrid’s Motorbike Adventure", "Universal Orlando", 40),
    SampleWait("Penguin Trek", "SeaWorld Orlando", 25),
    SampleWait("The Dragon", "LEGOLAND Florida", null),
)

private val waitColors = darkColors(
    primary = Color(0xFF69EBDD),
    background = Color(0xFF071A25),
    surface = Color(0xFF102B38),
    onSurface = Color(0xFFF0FAFB),
)

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
                    Text("OrlandoTrackr", style = MaterialTheme.typography.h4, modifier = Modifier.semantics { heading() })
                    Text("Sample park waits", color = MaterialTheme.colors.primary)
                }
                items(sampleWaits, key = { it.name }) { wait -> WaitCard(wait) }
            }
        }
    }
}

@Composable
private fun WaitCard(wait: SampleWait) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(wait.name, style = MaterialTheme.typography.subtitle1)
                Text(wait.park, style = MaterialTheme.typography.body2)
            }
            Text(wait.minutes?.let { "$it min" } ?: "Unavailable", color = MaterialTheme.colors.primary)
        }
    }
}
