plugins {
    id("org.jetbrains.kotlin.multiplatform")
    id("com.android.kotlin.multiplatform.library")
    id("org.jetbrains.compose")
    id("org.jetbrains.kotlin.plugin.compose")
}

kotlin {
    android {
        namespace = "com.orlandotrackr.shared"
        compileSdk = 37
        minSdk = 26
    }
    listOf(iosArm64(), iosSimulatorArm64()).forEach { target ->
        target.binaries.framework {
            baseName = "OrlandoTrackrShared"
            isStatic = true
        }
    }

    sourceSets.commonMain.dependencies {
        implementation("org.jetbrains.compose.foundation:foundation:1.12.2")
        implementation("org.jetbrains.compose.material:material:1.12.2")
        implementation("org.jetbrains.compose.ui:ui:1.12.2")
    }
}
