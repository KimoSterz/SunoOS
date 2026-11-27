project('Suno-vitals', version: '0.1.0', meson_version: '>= 1.3.0')
python = import('python').find_installation('python3')
python.install_sources('Suno_vitals/__init__.py', 'Suno_vitals/agents.py', 'Suno_vitals/battery_cli.py',
                       'Suno_vitals/cli.py', 'Suno_vitals/crashes.py', 'Suno_vitals/detectors.py',
                       'Suno_vitals/power.py', 'Suno_vitals/memory_feedback.py',
                       'Suno_vitals/memory_policy.py', 'Suno_vitals/names.py',
                       'Suno_vitals/sampler.py', 'Suno_vitals/service.py', 'Suno_vitals/session_bus.py',
                       'Suno_vitals/store.py',
                       subdir: 'Suno_vitals')
install_data('data/Suno-vitals.service', install_dir: get_option('prefix') / 'lib/systemd/user')
install_data('data/Suno-vitals-daemon.in', install_dir: get_option('libexecdir'), rename: 'Suno-vitals',
             install_mode: 'rwxr-xr-x')
install_data('data/Suno-vitals.in', install_dir: get_option('bindir'), rename: 'Suno-vitals',
             install_mode: 'rwxr-xr-x')

# Energy counters (ADR-026 §8): system-wide, packaged as Suno-vitals-energy.
# RAPL is root-only since CVE-2020-8694; this publishes ten-second averages,
# which carry no side channel, where a person's session can read them.
install_data('energy/Suno-vitals-energy', install_dir: get_option('libexecdir'),
             install_mode: 'rwxr-xr-x')
install_data('energy/Suno-vitals-energy.service',
             install_dir: get_option('prefix') / 'lib/systemd/system')

# Power guard (ADR-046 §5): system-wide, packaged as Suno-vitals-power-guard.
# Steps Performance down to Balanced on battery and puts the person's choice
# back when power returns, through the power-profiles D-Bus API only.
install_data('power-guard/Suno-vitals-power-guard', install_dir: get_option('libexecdir'),
             install_mode: 'rwxr-xr-x')
install_data('power-guard/Suno-vitals-power-guard.service',
             install_dir: get_option('prefix') / 'lib/systemd/system')

# Charger mode: system-wide, packaged as Suno-vitals-charger. A boot the
# bootloader started for a charger (androidboot.mode=charger) gets
# Suno-charger.target instead of the session.
install_data('charger/Suno-charger', install_dir: get_option('libexecdir'), install_mode: 'rwxr-xr-x')
install_data('charger/Suno-charger-generator', install_dir: get_option('prefix') / 'lib/systemd/system-generators',
             install_mode: 'rwxr-xr-x')
install_data('charger/Suno-charger.target', 'charger/Suno-charger.service',
             install_dir: get_option('prefix') / 'lib/systemd/system')

# Crash evidence (ADR-026 §6): system-wide, packaged as Suno-vitals-crash-evidence.
prefix_lib = get_option('prefix') / 'lib'
install_data('crash-evidence/Suno-crash-evidence', install_dir: get_option('libexecdir'),
             install_mode: 'rwxr-xr-x')
install_data('crash-evidence/Suno-crash-evidence-intel', install_dir: get_option('libexecdir'),
             install_mode: 'rwxr-xr-x')
install_data('crash-evidence/Suno-crash-evidence.service', install_dir: prefix_lib / 'systemd/system')
install_data('crash-evidence/Suno-crash-evidence.catalog', install_dir: prefix_lib / 'systemd/catalog')
install_data('crash-evidence/60-Suno-crash-evidence-journald.conf', install_dir: prefix_lib / 'systemd/journald.conf.d',
             rename: '60-Suno-crash-evidence.conf')
install_data('crash-evidence/60-Suno-crash-evidence-sysctl.conf', install_dir: prefix_lib / 'sysctl.d',
             rename: '60-Suno-crash-evidence.conf')
install_data('crash-evidence/60-Suno-crash-evidence-kargs.toml', install_dir: prefix_lib / 'bootc/kargs.d',
             rename: '60-Suno-crash-evidence.toml')

# Memory guard (ADR-026 §7): system-wide, packaged as Suno-vitals-memory-guard.
foreach slice : ['app.slice', 'Suno-background.slice']
  install_data('memory-guard/60-Suno-oomd-swap.conf', install_dir: prefix_lib / 'systemd/user' / (slice + '.d'))
endforeach
install_data('memory-guard/60-Suno-zram-zstd.conf', install_dir: prefix_lib / 'systemd/zram-generator.conf.d')
install_data('memory-guard/60-Suno-compositor-memory.conf',
             install_dir: prefix_lib / 'systemd/user/org.gnome.Shell@.service.d')
# A soft per-app ceiling (MemoryHigh) for app scopes, app services and the
# containers universal packages run in.
foreach unit : ['app-.scope', 'libpod-.scope']
  install_data('memory-guard/40-Suno-app-memory.conf', install_dir: prefix_lib / 'systemd/user' / (unit + '.d'))
endforeach
install_data('memory-guard/40-Suno-app-memory-service.conf', install_dir: prefix_lib / 'systemd/user/app-.service.d',
             rename: '40-Suno-app-memory.conf')
install_data('memory-guard/60-Suno-memory.sysctl', install_dir: prefix_lib / 'sysctl.d', rename: '60-Suno-memory.conf')
install_data('memory-guard/Suno_oomd.cil', install_dir: get_option('datadir') / 'selinux/packages')
