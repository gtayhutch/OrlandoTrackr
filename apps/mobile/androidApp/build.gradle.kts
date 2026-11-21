plugins {
    id("com.android.application")
}

android {
    namespace = "com.orlandotrackr.app"
    compileSdk = 37

    defaultConfig {
        applicationId = "com.orlandotrackr.app"
        minSdk = 26
        targetSdk = 37
        versionCode = 1
        versionName = "0.1.0"
    }
}

dependencies {
    implementation("androidx.activity:activity:1.13.0")
    implementation(project(":shared"))
}
