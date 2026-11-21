package com.orlandotrackr.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import com.orlandotrackr.shared.waitBoardView

/** Hosts the shared wait board within the Android activity. */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(waitBoardView(this))
    }
}
