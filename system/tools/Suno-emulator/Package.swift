// swift-tools-version:5.9
// SPDX-License-Identifier: Apache-2.0

import PackageDescription

// The Suno Emulator is deliberately dependency-free. Everything it needs on a
// Mac ships with the operating system: Virtualization.framework owns the guest,
// AppKit owns the window, and Foundation owns the control plane. A public
// build must not require Homebrew, Docker, or a separate QEMU package, so a
// third-party Swift package would be a liability rather than a convenience.
let package = Package(
    name: "Suno-emulator",
    platforms: [.macOS(.v14)],
    targets: [
        .target(name: "SunoEmulatorKit"),
        .executableTarget(
            name: "SunoEmulatorHost",
            dependencies: ["SunoEmulatorKit"]
        ),
        .executableTarget(
            name: "Suno-emulator",
            dependencies: ["SunoEmulatorKit"]
        ),
        .testTarget(
            name: "SunoEmulatorKitTests",
            dependencies: ["SunoEmulatorKit"]
        ),
    ]
)
