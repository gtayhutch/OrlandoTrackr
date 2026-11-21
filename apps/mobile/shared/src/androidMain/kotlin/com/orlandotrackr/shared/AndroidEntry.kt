package com.orlandotrackr.shared

import android.content.Context
import android.view.View
import androidx.compose.ui.platform.ComposeView

/** Creates the shared wait board view for the Android activity. */
fun waitBoardView(context: Context): View = ComposeView(context).apply {
    setContent { WaitBoard() }
}
