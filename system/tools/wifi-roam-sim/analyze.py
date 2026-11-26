#!/usr/bin/python3
# SPDX-License-Identifier: Apache-2.0
"""Metrics for one harness result directory (or several): prints JSON lines and a table."""
import json, os, re, sys

BAND = {'02:00:00:00:00:00': '2.4', '02:00:00:00:01:00': '5', '02:00:00:00:02:00': '6',
        '02:00:00:00:03:00': '5b'}


def analyze(d):
    meta = json.load(open(f'{d}/meta.json'))
    t0 = float(open(f'{d}/start').read())
    t1 = float(open(f'{d}/end').read())
    dur = t1 - t0
    hops, scans, disc, bands, attempts6, failures = [], 0, 0, [], 0, 0
    current = None
    for line in open(f'{d}/iw.log', errors='replace'):
        m = re.match(r'([\d.]+): (\S+) \(phy #\d+\): (.*)', line)
        if not m or m.group(2) != 'wlan4':
            continue
        ts, what = float(m.group(1)), m.group(3)
        c = re.match(r'connected to ([0-9a-f:]{17})', what)
        if c:
            b = BAND.get(c.group(1), '?')
            if ts >= t0 and ts <= t1:
                hops.append((round(ts - t0, 1), current, b))
                bands.append((ts, b))
            elif ts < t0:
                bands = [(t0, b)]
            current = b
        if ts < t0 or ts > t1:
            continue
        if what.startswith('scan started'):
            scans += 1
        elif what.startswith('disconnected'):
            disc += 1
        elif re.match(r'auth 02:00:00:00:04:00 -> 02:00:00:00:02:00', what) or \
                re.match(r'auth: 02:00:00:00:02:00', what):
            attempts6 += 1
    share = {}
    for i, (ts, b) in enumerate(bands):
        end = bands[i + 1][0] if i + 1 < len(bands) else t1
        share[b] = share.get(b, 0) + max(0, end - max(ts, t0))
    share = {b: round(100 * s / dur) for b, s in share.items()}
    res = dict(scenario=meta['scenario'], variant=meta['variant'], secs=round(dur),
               connect_secs=meta['connects'], hops=len(hops),
               hops_per_hour=round(len(hops) * 3600 / dur, 1), hop_list=hops,
               disconnects=disc, scans=scans, scans_per_hour=round(scans * 3600 / dur, 1),
               band_share_pct=share)
    # Time to connect, from NetworkManager's log: activation start -> associated (stage 2
    # done) and -> activated (after DHCP). The measured activations are the last ones.
    try:
        acts, cur = [], None
        for line in open(f'{d}/journal.log', errors='replace'):
            m = re.search(r'NetworkManager\[\d+\]: <\w+>\s+\[([\d.]+)\] device \(wlan4\): (.*)', line)
            if not m:
                continue
            ts, what = float(m.group(1)), m.group(2)
            if what.startswith('Activation: starting connection'):
                cur = {'start': ts}
                acts.append(cur)
            elif cur and 'Stage 2 of 5 (Device Configure) successful' in what and 'assoc' not in cur:
                cur['assoc'] = round(ts - cur['start'], 1)
            elif cur and what.startswith('Activation: successful'):
                cur['up'] = round(ts - cur['start'], 1)
            elif cur and what.startswith('Activation: failed'):
                cur['up'] = None
        n = len(meta['connects'])
        res['assoc_secs'] = [a.get('assoc') for a in acts[-n:]]
        res['activated_secs'] = [a.get('up') for a in acts[-n:]]
    except OSError:
        pass
    # 6 GHz authentication attempts, from the wpa_supplicant journal
    try:
        j = open(f'{d}/journal.log', errors='replace').read()
        res['auth_attempts_6ghz'] = len(re.findall(r'SME: Trying to authenticate with 02:00:00:00:02:00', j))
        res['roam_skips'] = len(re.findall(r'CTRL-EVENT-SKIP-ROAM', j))
        res['roam_dos'] = len(re.findall(r'CTRL-EVENT-DO-ROAM', j))
    except OSError:
        pass
    if meta.get('traffic'):
        ts = []
        for line in open(f'{d}/ping.log', errors='replace'):
            m = re.match(r'\[([\d.]+)\] \d+ bytes from', line)
            if m:
                ts.append(float(m.group(1)))
        tend = t0 + (meta.get('traffic_stop') or dur)
        ts = [t for t in ts if t0 <= t <= tend]
        stall = 0.0
        prev = t0
        for t in ts + [tend]:
            if t - prev > 0.5:
                stall += t - prev - 0.1
            prev = t
        res['ping_replies_pct'] = round(100 * len(ts) / max(1, (tend - t0) * 10), 1)
        res['stall_secs'] = round(stall, 1)
        stop = meta.get('traffic_stop') or dur
        total = 0
        buckets = {}
        for line in open(f'{d}/sink.log'):
            p = line.split()
            if len(p) == 3 and t0 <= float(p[0]) <= t0 + stop:
                total += int(p[2])
                buckets[int(float(p[0]))] = buckets.get(int(float(p[0])), 0) + int(p[2])
        res['stream_mbps'] = round(total * 8 / stop / 1e6, 2)
        # Stream stall: gaps of 0.5 s or more between received 100 ms buckets, split by
        # whether they overlap a scan (hwsim scans every channel and is off channel far
        # longer than real hardware) or not (roams, failed roams, reconnects).
        times = sorted(float(l.split()[0]) for l in open(f'{d}/sink.log')
                       if len(l.split()) == 3 and t0 <= float(l.split()[0]) <= t0 + stop)
        scans_win, start = [], None
        for line in open(f'{d}/iw.log', errors='replace'):
            m = re.match(r'([\d.]+): wlan4 \(phy #\d+\): scan (started|finished|aborted)', line)
            if m:
                if m.group(2) == 'started':
                    start = float(m.group(1))
                elif start:
                    scans_win.append((start, float(m.group(1)) + 1)); start = None
        link_events = []
        for line in open(f'{d}/iw.log', errors='replace'):
            m = re.match(r'([\d.]+): wlan4 \(phy #\d+\): (connected|disconnected|auth|assoc|deauth|disassoc)', line)
            if m:
                link_events.append(float(m.group(1)))
        st_link = st_scan = st_other = 0.0
        prev = t0
        for t in times + [t0 + stop]:
            gap = t - prev
            if gap >= 0.5:
                if any(prev - 1 <= e <= t for e in link_events):
                    st_link += gap - 0.1
                elif any(a < t and b > prev for a, b in scans_win):
                    st_scan += gap - 0.1
                else:
                    st_other += gap - 0.1
            prev = t
        res['stream_stall_secs'] = round(st_link + st_scan + st_other, 1)
        res['stream_stall_link_secs'] = round(st_link, 1)
        res['stream_stall_scan_secs'] = round(st_scan, 1)
        res['stream_stall_other_secs'] = round(st_other, 1)
        expected = 8e6 / 8
        res['stream_bad_secs'] = sum(1 for s in range(int(t0), int(t0 + stop))
                                     if buckets.get(s, 0) < 0.5 * expected)
    return res


if __name__ == '__main__':
    rows = [analyze(d) for d in sys.argv[1:]]
    for r in rows:
        print(json.dumps(r))
