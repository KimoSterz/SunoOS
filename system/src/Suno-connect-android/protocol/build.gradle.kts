import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.kotlin.jvm)
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

kotlin {
    compilerOptions { jvmTarget.set(JvmTarget.JVM_17) }
}

dependencies {
    implementation(libs.bcpkix)
    testImplementation(libs.junit)
}

tasks.test {
    // The interoperability test drives the Python daemon; it is skipped unless configured.
    systemProperty("Suno.interop.python", System.getenv("SUNO_INTEROP_PYTHON") ?: "")
    systemProperty("Suno.interop.source", System.getenv("SUNO_INTEROP_SOURCE") ?: "")
}
