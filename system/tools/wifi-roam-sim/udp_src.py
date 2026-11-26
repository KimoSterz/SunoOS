#!/usr/bin/python3
# SPDX-License-Identifier: Apache-2.0
# Constant-rate UDP stream (like a live stream upload); keeps sending through outages.
import socket, sys, time
dst, rate = sys.argv[1], int(sys.argv[2])
size = 1200
pps = rate / 8 / size
s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
payload = b'x' * size
t0 = time.monotonic(); i = 0; errors = 0
while True:
    target = t0 + i / pps
    d = target - time.monotonic()
    if d > 0:
        time.sleep(d)
    try:
        s.sendto(payload, (dst, 5001))
    except OSError:
        errors += 1
    i += 1
    if i % int(pps * 10) == 0:
        print(f'{time.time():.1f} sent={i} errors={errors}', flush=True)
