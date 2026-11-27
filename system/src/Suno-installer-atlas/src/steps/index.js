/*
 * Copyright (C) 2026 Project Suno contributors
 * SPDX-License-Identifier: LGPL-2.1-or-later
 *
 * The installer puts Suno on the disk; first-boot setup (Suno-setup) makes it
 * someone's. So Atlas asks only what an installer must: the language and
 * keyboard (its own screens, and the drive passphrase typed at every boot),
 * where to install and whether to lock the drive. The time zone, the account
 * and more apps are asked once, after the first boot, on every device.
 */
import { DestinationStep } from "./Destination.jsx";
import { FinishedStep } from "./Finished.jsx";
import { InstallingStep } from "./Installing.jsx";
import { LanguageStep } from "./Language.jsx";
import { LockStep } from "./Lock.jsx";
import { ReviewStep } from "./Review.jsx";

export const STEPS = [
    { component: LanguageStep, id: "language", name: "Language", title: "What language should Suno speak?" },
    { component: DestinationStep, id: "disk", name: "Where to install", title: "Where should Suno live?" },
    { component: LockStep, id: "encryption", name: "Lock the drive", title: "Should we lock this drive?" },
    { component: ReviewStep, id: "review", name: "Review", title: "Here is what will happen." },
    { component: InstallingStep, id: "installing", name: "Installing", title: "Setting up Suno." },
    { component: FinishedStep, id: "done", name: "Finished", title: "Suno is ready." },
];
