/* Depot's world beyond the app catalogue (24 Oct 2026): the screens Suno runs on, the person's own devices (Suno
   Connect), where each app runs, the Looks and Tweaks, Today's stories and the person's own submissions.
   catalogue.js stays the list of apps; this file adds what the device-first Depot needs. */
(() => {
const D = window.DEPOT_DATA; if (!D) return;

/* The five kinds of screen, in the order a strip shows them. */
D.forms = [
  { id: 'desktop', name: 'Desktop', icon: 'monitor' },
  { id: 'tablet', name: 'Tablet', icon: 'tablet' },
  { id: 'phone', name: 'Phone', icon: 'smartphone' },
  { id: 'tv', name: 'TV', icon: 'tv' },
  { id: 'home', name: 'Home', icon: 'house' },
];

/* The person's devices, from Suno Connect. Which one is "this" depends on where Depot is open (depot.js). */
D.devices = [
  { id: 'xps', name: 'XPS 14', form: 'desktop', note: 'Desktop' },
  { id: 'x1', name: 'ThinkPad X1', form: 'tablet', note: 'Tablet' },
  { id: 'fp6', name: 'Fairphone 6', form: 'phone', note: 'Phone' },
  { id: 'tv', name: 'Living room', form: 'tv', note: 'TV · off, installs when it wakes' },
  { id: 'home', name: 'Kitchen', form: 'home', note: 'Home display' },
];

/* Where each app runs. Anything not listed runs on desktop and tablet. */
const ALL = ['desktop', 'tablet', 'phone', 'tv', 'home'], PC = ['desktop', 'tablet'], MOB = ['desktop', 'tablet', 'phone'];
D.runs = {
  tide: ALL, photos: ['desktop', 'tablet', 'phone', 'tv'], youtube: ['desktop', 'tablet', 'phone', 'tv'], weather: ALL, clock: ALL,
  calendar: ['desktop', 'tablet', 'phone', 'home'], messages: MOB, notes: MOB, contacts: MOB, charlie: MOB, filer: MOB, viola: MOB,
  maps: MOB, camera: ['tablet', 'phone'], memos: MOB, tasks: ['desktop', 'tablet', 'phone', 'home'], leaf: MOB, viewer: MOB, ari: ALL,
  calc: MOB, tipsplit: MOB, vault: MOB, write: MOB, grid: PC, stage: ['desktop', 'tablet', 'tv'], term: PC, canvas: PC, session: PC,
  darkroom: PC, reel: PC, disks: ['desktop'], monitor: ['desktop'], valet: MOB,
  spotify: ALL, vlc: ['desktop', 'tablet', 'phone', 'tv'], kodi: ['desktop', 'tv'], steam: ['desktop', 'tv'], moonlight: ['desktop', 'tablet', 'phone', 'tv'],
  signal: MOB, telegram: MOB, discord: MOB, bitwarden: MOB, nextcloud: MOB, obsidian: MOB, firefox: MOB, zoom: MOB,
  blender: ['desktop'], obs: ['desktop'], kdenlive: ['desktop'], audacity: ['desktop'], godot: ['desktop'], vscodium: ['desktop'], nvtop: ['desktop'],
};
/* What is already installed where (Suno Connect knows). Suno's own apps are on every device they run on. */
D.installed = {
  xps: [],
  x1: [],
  fp6: [],
  tv: [],
  home: [],
};
/* Matched: an app kept on every device it runs on, now and when a device joins. */
D.matched = [];

/* Trust: one seal per item. Suno made it; a verified developer whose build Suno reviewed; or the community,
   signed but not reviewed. Every kind runs in its own space; what it can reach is always listed. */
D.seals = {
  suno: { name: 'Suno', icon: 'badge-check', line: 'Made by Suno' },
  verified: { name: 'Verified', icon: 'shield-check', line: 'Developer verified, build reviewed by Suno' },
  community: { name: 'Community', icon: 'users', line: 'Signed by its maker, not reviewed by Suno' },
};

/* Looks change how Suno looks. Trying one changes this window for a moment; keeping it changes every device you pick. */
D.looks = [
  { id: 'ember', name: 'Ember', by: 'Suno', seal: 'suno', kind: 'Wallpaper', art: '../wallpapers/ember.png', hue: 30, line: 'A slow coal glow that warms the whole shell', n: 18200, runs: ALL },
  { id: 'fog', name: 'Blue Fog', by: 'Suno', seal: 'suno', kind: 'Wallpaper', art: '../wallpapers/blue-fog.png', hue: 230, line: 'Cool, quiet and easy on tired eyes', n: 15400, runs: ALL },
  { id: 'dink', name: 'D-Ink', by: 'Suno', seal: 'suno', kind: 'Appearance', hue: 60, ink: true, line: 'Paper and ink, three line weights, nothing tinted. Made for e-paper, lovely anywhere', n: 9100, runs: ['desktop', 'tablet', 'phone'] },
  { id: 'meadow', name: 'Meadow', by: 'Suno', seal: 'suno', kind: 'Wallpaper', art: '../wallpapers/meadow.png', hue: 120, line: 'Morning grass for the light appearance', n: 12800, runs: ALL },
  { id: 'prism', name: 'Prism', by: 'Suno', seal: 'suno', kind: 'Wallpaper', art: '../wallpapers/prism.png', hue: 290, line: 'The colour Suno started with', n: 22100, runs: ALL },
  { id: 'studio-night', name: 'Studio Night', by: 'Ines Duarte', seal: 'verified', kind: 'Theme', art: '../wallpapers/suno-creatives.png', hue: 330, line: 'A deep plum appearance with a matching wallpaper and accent', n: 4300, runs: MOB },
  { id: 'pebble', name: 'Pebble', by: 'Kai Mori', seal: 'verified', kind: 'Icons', hue: 200, swatch: ['#9fb8c9', '#d8c3a5', '#a8b8a0', '#c9a6a6'], line: 'Every app icon as a smooth river stone', n: 6100, runs: MOB },
  { id: 'softkeys', name: 'Soft Keys', by: 'Suno', seal: 'suno', kind: 'Sounds', hue: 160, line: 'Gentle clicks, chimes and alerts recorded on wood', n: 3900, runs: ALL },
  { id: 'atkinson', name: 'Atkinson Hyperlegible', by: 'Braille Institute', seal: 'verified', kind: 'Font', hue: 40, line: 'A typeface drawn for low vision, set as the system font', n: 2800, runs: ['desktop', 'tablet', 'phone', 'tv'] },
  { id: 'pointer-dusk', name: 'Dusk Pointers', by: 'tinkerbird', seal: 'community', kind: 'Cursor', hue: 260, line: 'Rounded pointers with a soft shadow, in six sizes', n: 1700, runs: ['desktop', 'tablet'] },
];

/* Tweaks change how Suno works. Each lists the parts of the system it touches; turning it off puts them back
   exactly as they were, because Suno keeps the previous system beside the changed one. */
D.tweaks = [
  { id: 'battery-care', name: 'Battery Care', by: 'Suno', seal: 'suno', kind: 'Hardware', icon: 'power', hue: 140, line: 'Stops charging at 80% while you are plugged in all day', changes: ['Charging'], runs: ['desktop', 'tablet', 'phone'], n: 14900, on: ['xps'] },
  { id: 'android', name: 'Android Apps', by: 'Suno', seal: 'suno', kind: 'System', icon: 'smartphone', hue: 100, line: 'Run Android apps in a window, beside your Suno apps', changes: ['A system service', 'App list'], restart: true, runs: MOB, n: 21300 },
  { id: 'hot-corners', name: 'Hot Corners', by: 'Mara Lind', seal: 'verified', kind: 'Windows', icon: 'mouse-pointer-2', hue: 210, line: 'Push the pointer into a corner to show windows, the desktop or Now', changes: ['Shelf', 'Windows'], runs: ['desktop', 'tablet'], n: 8800, on: ['xps'] },
  { id: 'peek', name: 'Three-finger Peek', by: 'Suno', seal: 'suno', kind: 'Gestures', icon: 'layers', hue: 260, line: 'Rest three fingers on the touchpad to see under every window', changes: ['Touchpad'], runs: ['desktop', 'tablet'], n: 7600 },
  { id: 'compose', name: 'Compose Key', by: 'Suno', seal: 'suno', kind: 'Keyboard', icon: 'keyboard', hue: 30, line: 'Caps Lock becomes Compose: type é, ñ, — and → in two keys', changes: ['Keyboard'], runs: ['desktop', 'tablet'], n: 5200 },
  { id: 'lock-now', name: 'Now Playing on Lock', by: 'Oren Vale', seal: 'verified', kind: 'Lock screen', icon: 'lock', hue: 330, line: 'Big album art and controls on the lock screen while music plays', changes: ['Lock screen'], runs: ['tablet', 'phone'], n: 6400 },
  { id: 'pihole', name: 'Pi-hole Tile', by: 'netgnome', seal: 'community', kind: 'Quick Options', icon: 'shield', hue: 0, line: 'Pause your Pi-hole for five minutes from Quick Options', changes: ['Quick Options'], runs: MOB, n: 2100 },
  { id: 'studio-tiles', name: 'Studio Layouts', by: 'tilewright', seal: 'community', kind: 'Windows', icon: 'app-window', hue: 190, line: 'Tiling layouts for wide monitors: 3 columns, focus and stage', changes: ['Windows', 'Tiling'], runs: ['desktop'], n: 3300 },
  { id: 'seconds', name: 'Seconds in the Shelf', by: 'Suno', seal: 'suno', kind: 'Shelf', icon: 'clock', hue: 220, line: 'The Shelf clock shows seconds', changes: ['Shelf'], runs: ['desktop', 'tablet'], n: 4100 },
];

/* Today: Suno's editors, one story each, in this order. */
D.today = [
  { kind: 'everywhere', kick: 'One library, every screen', title: 'Tide follows you from desk to sofa', blurb: 'Start an album at your desk, keep it going on your phone, finish it on the TV. One library, no subscriptions.', app: 'tide', art: '../social-suno/photos/pet-sounds.webp', hue: 25 },
  { kind: 'look', kick: 'Look of the week', look: 'ember' },
  { kind: 'tweak', kick: 'Tweak of the week', tweak: 'battery-care', blurb: 'Laptops that live on a charger wear their battery out fastest. Battery Care holds it at 80% until you unplug.' },
  { kind: 'switch', kick: 'Coming from Windows or a Mac', title: 'Type the name you know' },
  { kind: 'screen', kick: 'For the living room', title: 'Made for your TV', form: 'tv' },
  { kind: 'row', kick: 'Fresh this week', title: 'New and updated', items: [['app', 'krita'], ['look', 'studio-night'], ['tweak', 'hot-corners'], ['app', 'godot'], ['look', 'pebble'], ['tweak', 'lock-now'], ['app', 'obsidian']] },
  { kind: 'screen', kick: 'In the kitchen', title: 'Glanceable, from across the room', form: 'home' },
];

/* What the person has made and sent in. */
D.mine = [
  { kind: 'tweak', name: 'Kitchen Timer Tile', icon: 'clock', hue: 30, state: 'review', step: 2, note: 'Suno is reviewing it. Usually two days.' },
  { kind: 'look', name: 'Studio Morning', icon: 'image', hue: 45, state: 'live', note: '1.2k installs · 4.8 ★' },
  { kind: 'app', name: 'Recipe Box', icon: 'package', hue: 150, state: 'changes', note: 'Asks for your whole Home folder. Ask for Documents only and send it again.' },
];

/* Updates waiting, per device (Suno Connect). Each app update lists what changed in the release notes' words. */
D.pending = [];
/* Done recently, newest first: [app or 'suno', what, when, device]. Suno itself can always go back one version. */
D.done = [['suno', 'SunoOS 0.1 · nightly October 16', 'Oct 16', 'All devices']];
D.auto = { apps: true, suno: 'overnight', matched: true };
})();
