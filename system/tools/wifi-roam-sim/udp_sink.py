#!/usr/bin/python3
# SPDX-License-Identifier: Apache-2.0
# Count received UDP stream bytes per 100 ms (wall clock); one line per non-empty bucket.
import socket, sys, time
s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
s.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, 4 << 20)
s.bind(('10.77.0.1', 5001))
s.settimeout(0.1)
bucket, n, b = None, 0, 0
while True:
    try:
        data = s.recv(2048)
        now = time.time()
    except socket.timeout:
        now = time.time(); data = None
    k = int(now * 10)
    if bucket is not None and k != bucket and n:
        print(f'{bucket / 10:.1f} {n} {b}', flush=True)
        n, b = 0, 0
    bucket = k
    if data:
        n += 1; b += len(data)
