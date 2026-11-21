package com.orlandotrackr.shared

import androidx.compose.ui.window.ComposeUIViewController
import platform.UIKit.UIViewController

/** Creates the shared wait board controller for the iOS application. */
fun waitBoardViewController(): UIViewController = ComposeUIViewController { WaitBoard() }
