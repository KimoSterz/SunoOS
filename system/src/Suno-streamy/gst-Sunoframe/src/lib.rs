// SPDX-License-Identifier: MPL-2.0
//! GStreamer plugin `Sunovideofx`: Suno's own video effects.
//!
//! * `Sunoframe`: one composited layer in one GL pass (rounded corners,
//!   stroke, drop shadow, crop and opacity), for `glvideomixer` scenes.

pub mod geometry;
mod Sunoframe;

pub use Sunoframe::SunoFrame;

fn plugin_init(plugin: &gst::Plugin) -> Result<(), gst::glib::BoolError> {
    Sunoframe::register(plugin)
}

gst::plugin_define!(
    Sunovideofx,
    env!("CARGO_PKG_DESCRIPTION"),
    plugin_init,
    env!("CARGO_PKG_VERSION"),
    "MPL",
    "gst-Sunoframe",
    "Suno",
    "https://github.com/SimplyLuma/luma"
);
