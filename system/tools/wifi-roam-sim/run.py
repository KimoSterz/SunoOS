#!/usr/bin/python3
# SPDX-License-Identifier: Apache-2.0
"""Wi-Fi band selection / roaming harness: mac80211_hwsim + wmediumd + hostapd + NetworkManager.

Radios: 0 = 2.4 GHz ch6 (g6), 1 = 5 GHz ch36 VHT80 (a36), 2 = 6 GHz ch37 HE160 (x37/x37bad),
3 = 5 GHz ch149 VHT80 (a149, second AP), 4 = station (wlan4, managed by NetworkManager).
Signal at the station = wmediumd SNR - 91 dBm; links are symmetric.

usage: run.py SCENARIO VARIANT   (VARIANT is only a label; install the packages first)

Workflow (on a build host, never on its own network): vm/build-rootfs.sh and
vm/prepare-image.sh make a Fedora 44 VM disk, vm/start-vm.sh boots it with user-mode
networking only. In the VM: build wmediumd with wmediumd-snr-reload.patch into
/usr/local/bin, then `vm-variant.sh before|after` and `suite.sh VARIANT`; analyze.py
prints one JSON line of metrics per result directory.
"""
import json, math, os, random, signal, subprocess, sys, time

H = os.path.dirname(os.path.abspath(__file__))
RADIO = {'g6': 0, 'a36': 1, 'x37': 2, 'x37bad': 2, 'a149': 3}
BAND = {'02:00:00:00:00:00': '2.4', '02:00:00:00:01:00': '5', '02:00:00:00:02:00': '6',
        '02:00:00:00:03:00': '5b'}
STA = 'wlan4'
NOISE = -91

# timeline: list of (t, {ap: (mean_dbm, jitter_db) | ('ramp', from, to, seconds)})
SCENARIOS = {
    # The reported network: 5 GHz hovers at the old -65 dBm bgscan threshold, 2.4 GHz is
    # strong, the 6 GHz BSS does not accept the station. A stream runs throughout.
    'hover': dict(aps=['g6', 'a36', 'x37bad'], duration=900, traffic=True, profile='psk',
                  timeline=[(0, {'g6': (-50, 1), 'a36': (-65, 3), 'x37bad': (-68, 2)})]),
    # Idle band choice: 2.4 GHz much stronger, 5 GHz usable. Three fresh connections.
    'choose': dict(aps=['g6', 'a36'], duration=420, traffic=False, profile='psk', reconnects=3,
                   timeline=[(0, {'g6': (-45, 1), 'a36': (-68, 1)})]),
    # 5 GHz really drops under traffic, comes back, then traffic stops.
    'drop': dict(aps=['g6', 'a36'], duration=600, traffic=True, traffic_stop=420, profile='psk',
                 timeline=[(0, {'g6': (-50, 1), 'a36': (-60, 1)}),
                           (90, {'a36': ('ramp', -60, -82, 20)}),
                           (150, {'a36': (-90, 1)}),
                           (300, {'a36': (-60, 1)})]),
    # Working 6 GHz BSS with a WPA2-only profile (PMF disabled: no SAE) and with an SAE profile.
    'six-wpa2': dict(aps=['g6', 'a36', 'x37'], duration=300, traffic=True, profile='wpa2only',
                     timeline=[(0, {'g6': (-50, 1), 'a36': (-62, 2), 'x37': (-60, 2)})]),
    'six-sae': dict(aps=['g6', 'a36', 'x37'], duration=300, traffic=True, profile='sae',
                    timeline=[(0, {'g6': (-50, 1), 'a36': (-62, 2), 'x37': (-60, 2)})]),
    # Single-band network, one BSS, signal hovering at -66 dBm.
    'single': dict(aps=['a36'], duration=300, traffic=True, profile='psk',
                   timeline=[(0, {'a36': (-66, 3)})]),
    # AP with only 2.4 GHz.
    'g24only': dict(aps=['g6'], duration=300, traffic=True, profile='psk',
                    timeline=[(0, {'g6': (-60, 2)})]),
    # Two 5 GHz APs; the station walks from the first to the second under traffic.
    'multiap': dict(aps=['a36', 'a149'], duration=360, traffic=True, profile='psk',
                    timeline=[(0, {'a36': (-55, 1), 'a149': (-85, 1)}),
                              (60, {'a36': ('ramp', -55, -85, 180), 'a149': ('ramp', -85, -55, 180)}),
                              (240, {'a36': (-85, 1), 'a149': (-55, 1)})]),
}


def sh(cmd, check=True, **kw):
    return subprocess.run(cmd, shell=True, check=check, text=True, **kw)


def bg(cmd, log):
    return subprocess.Popen(cmd, shell=True, stdout=open(log, 'w'), stderr=subprocess.STDOUT,
                            preexec_fn=os.setsid)


def stop(p):
    if p and p.poll() is None:
        try:
            os.killpg(p.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
        try:
            p.wait(5)
        except subprocess.TimeoutExpired:
            os.killpg(p.pid, signal.SIGKILL)


def teardown():
    sh('nmcli -w 10 con delete test >/dev/null 2>&1', check=False)
    for name in ('hostapd', 'wmediumd', 'dnsmasq', 'udp_sink', 'udp_src'):
        sh(f'pkill -f {name} >/dev/null 2>&1', check=False)
    time.sleep(1)
    sh('ip netns del ap >/dev/null 2>&1', check=False)
    # Stop the Wi-Fi daemons before unloading the radios (setup restarts them).
    sh('systemctl stop NetworkManager wpa_supplicant iwd >/dev/null 2>&1', check=False)
    sh('rmmod mac80211_hwsim >/dev/null 2>&1', check=False)
    time.sleep(1)


class Controller:
    """Signal per AP: Ornstein-Uhlenbeck jitter around the timeline mean, one step per second."""

    def __init__(self, scenario, seed=7):
        self.timeline = scenario['timeline']
        self.aps = scenario['aps']
        self.rng = random.Random(seed)
        self.state = {}
        self.wmediumd_pid = None

    def target(self, ap, t):
        spec = None
        start = 0
        for when, specs in self.timeline:
            if when <= t and ap in specs:
                spec, start = specs[ap], when
        if spec is None:
            return NOISE - 10, 0
        if spec[0] == 'ramp':
            _, a, b, secs = spec
            f = min(1.0, (t - start) / secs)
            return a + (b - a) * f, 0.5
        return spec

    def step(self, t, path='/run/snr'):
        lines = []
        levels = {}
        for ap in self.aps:
            mean, jitter = self.target(ap, t)
            x = self.state.get(ap, mean)
            if jitter:
                theta = 0.2
                sigma = jitter * math.sqrt(2 * theta)
                x = x + theta * (mean - x) + sigma * self.rng.gauss(0, 1)
            else:
                x = mean
            self.state[ap] = x
            levels[ap] = round(x)
            lines.append(f'{RADIO[ap]} 4 {max(0, round(x) - NOISE)}')
        for r in range(4):
            if r not in [RADIO[a] for a in self.aps]:
                lines.append(f'{r} 4 0')
        with open(path + '.tmp', 'w') as f:
            f.write('\n'.join(lines) + '\n')
        os.replace(path + '.tmp', path)
        if self.wmediumd_pid:
            os.kill(self.wmediumd_pid, signal.SIGUSR1)
        return levels


def ap_config(ap):
    common = open(f'{H}/ap/common.inc').read().splitlines()
    if ap == 'x37bad':
        common = [l for l in common if not l.startswith(('sae_password=', 'wpa_passphrase='))]
    return '\n'.join(common + open(f'{H}/ap/{ap}.conf').read().splitlines()) + '\n'


def setup(scenario, out, ctl):
    teardown()
    sh('modprobe mac80211_hwsim radios=5')
    time.sleep(2)
    sh('ip netns add ap')
    for r in range(4):
        phy = open(f'/sys/class/net/wlan{r}/phy80211/name').read().strip()
        sh(f'iw phy {phy} set netns name ap')
    sh('ip -n ap link set lo up; ip -n ap link add br0 type bridge; '
       'ip -n ap addr add 10.77.0.1/24 dev br0; ip -n ap link set br0 up')
    sh('iw reg set CA')
    # Fresh daemons for every scenario: they must not carry interfaces or state from
    # the previous scenario's radios.
    sh(f"systemctl restart {os.environ.get('WIFI_DAEMON', 'wpa_supplicant')} NetworkManager")
    for _ in range(60):
        r = sh('nmcli -t -f DEVICE,STATE dev', check=False, capture_output=True).stdout
        if 'wlan4:disconnected' in r or 'wlan4:unavailable' in r:
            break
        time.sleep(1)
    ctl.step(0)
    env = dict(os.environ, WMEDIUMD_SNR_FILE='/run/snr')
    wm = subprocess.Popen(['/usr/local/bin/wmediumd', '-c', f'{H}/wmediumd.cfg', '-l', '3'],
                          stdout=open(f'{out}/wmediumd.log', 'w'), stderr=subprocess.STDOUT,
                          env=env, preexec_fn=os.setsid)
    ctl.wmediumd_pid = wm.pid
    time.sleep(1)
    procs = [wm]
    for ap in scenario['aps']:
        with open(f'/run/hostapd-{ap}.conf', 'w') as f:
            f.write(ap_config(ap))
        procs.append(bg(f'ip netns exec ap hostapd -t /run/hostapd-{ap}.conf', f'{out}/hostapd-{ap}.log'))
    procs.append(bg('ip netns exec ap dnsmasq --no-daemon --interface=br0 --bind-interfaces '
                    '--dhcp-range=10.77.0.100,10.77.0.200,12h --no-resolv --port=0 --log-dhcp',
                    f'{out}/dnsmasq.log'))
    procs.append(bg(f'ip netns exec ap python3 {H}/udp_sink.py', f'{out}/sink.log'))
    time.sleep(4)
    ctl.step(0)
    time.sleep(1)
    assert wm.poll() is None, 'wmediumd exited'
    return procs


def profile_args(kind):
    base = ('nmcli con add type wifi ifname wlan4 con-name test ssid LumaTest '
            'wifi.cloned-mac-address permanent ipv4.method auto ipv4.never-default yes '
            'ipv6.method disabled connection.autoconnect yes ')
    if kind == 'psk':
        return base + 'wifi-sec.key-mgmt wpa-psk wifi-sec.psk lumatest123'
    if kind == 'wpa2only':
        return base + 'wifi-sec.key-mgmt wpa-psk wifi-sec.psk lumatest123 wifi-sec.pmf disable'
    if kind == 'sae':
        return base + 'wifi-sec.key-mgmt sae wifi-sec.psk lumatest123'
    raise ValueError(kind)


def connect(out, tag):
    t0 = time.monotonic()
    r = sh('nmcli -w 60 con up test', check=False, capture_output=True)
    dt = time.monotonic() - t0
    with open(f'{out}/connect.log', 'a') as f:
        f.write(f'{tag} rc={r.returncode} secs={dt:.2f} {r.stdout.strip()} {r.stderr.strip()}\n')
    return r.returncode == 0, dt


def main():
    name, variant = sys.argv[1], sys.argv[2]
    sc = dict(SCENARIOS[name])
    if os.environ.get('DURATION'):
        sc['duration'] = int(os.environ['DURATION'])
    out = f'{H}/results/{name}-{variant}'
    sh(f'rm -rf {out}; mkdir -p {out}')
    ctl = Controller(sc)
    procs = setup(sc, out, ctl)
    sh("nmcli general logging level INFO domains WIFI,DEVICE,SUPPLICANT >/dev/null 2>&1", check=False)
    sh('busctl set-property fi.w1.wpa_supplicant1 /fi/w1/wpa_supplicant1 fi.w1.wpa_supplicant1 '
       'DebugLevel s debug', check=False)
    sh('busctl set-property fi.w1.wpa_supplicant1 /fi/w1/wpa_supplicant1 fi.w1.wpa_supplicant1 '
       'DebugTimestamp b true', check=False)
    mon = [bg(f'iw event -t -f', f'{out}/iw.log'),
           bg("journalctl -f -n0 -o short-monotonic -u wpa_supplicant -u NetworkManager", f'{out}/journal.log')]
    sh(f'nmcli dev set {STA} managed yes', check=False)
    time.sleep(3)
    sh(f'nmcli dev wifi rescan ifname {STA} >/dev/null 2>&1', check=False)
    time.sleep(16)   # a full hwsim scan (2.4, 5, 6 GHz and S1G channels) takes about 12 s
    sh(profile_args(sc['profile']))
    # Warm-up: NetworkManager picks the bgscan setting from the BSSIDs a profile has been
    # connected to, so connect once through every BSS that accepts the station, like a
    # network that has been used for a while.
    for ap in sc['aps']:
        if ap == 'x37bad' or (ap == 'x37' and sc['profile'] == 'wpa2only'):
            continue
        bssid = f'02:00:00:00:0{RADIO[ap]}:00'
        sh(f'nmcli con modify test 802-11-wireless.bssid {bssid}', check=False)
        r = sh('nmcli -w 60 con up test', check=False, capture_output=True)
        with open(f'{out}/connect.log', 'a') as f:
            f.write(f'warmup {bssid} rc={r.returncode}\n')
        sh('nmcli -w 20 con down test >/dev/null 2>&1', check=False)
        time.sleep(5)
    for _ in range(5):
        if sh('nmcli con modify test 802-11-wireless.bssid ""', check=False).returncode == 0:
            break
        time.sleep(2)
    time.sleep(3)
    connects = []
    for i in range(sc.get('reconnects', 1)):
        if i:
            sh('nmcli -w 20 con down test >/dev/null 2>&1', check=False)
            time.sleep(5)
        ok, dt = connect(out, f'connect{i}')
        connects.append(dt if ok else None)
        time.sleep(2)
        r = sh(f'iw dev {STA} link', check=False, capture_output=True).stdout
        with open(f'{out}/connect.log', 'a') as f:
            f.write(r)
    t_start = time.time()
    with open(f'{out}/start', 'w') as f:
        f.write(f'{t_start}\n')
    traffic = []
    if sc['traffic']:
        traffic.append(bg(f'ping -D -i 0.1 -W 1 10.77.0.1', f'{out}/ping.log'))
        traffic.append(bg(f'python3 {H}/udp_src.py 10.77.0.1 8000000', f'{out}/src.log'))
    levels = open(f'{out}/levels.log', 'w')
    t = 0
    while t < sc['duration']:
        time.sleep(max(0, t_start + t + 1 - time.time()))
        t += 1
        lv = ctl.step(t)
        levels.write(f'{time.time():.1f} {json.dumps(lv)}\n')
        if sc.get('traffic_stop') == t:
            for p in traffic:
                stop(p)
    with open(f'{out}/end', 'w') as f:
        f.write(f'{time.time()}\n')
    for p in traffic + mon:
        stop(p)
    with open(f'{out}/meta.json', 'w') as f:
        json.dump(dict(scenario=name, variant=variant, connects=connects, **{k: v for k, v in sc.items() if k != 'timeline'}), f)
    sh('nmcli -w 10 con down test >/dev/null 2>&1', check=False)
    for p in procs:
        stop(p)
    teardown()
    print(out)


if __name__ == '__main__':
    main()
