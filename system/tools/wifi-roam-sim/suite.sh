#!/bin/bash
# SPDX-License-Identifier: Apache-2.0
# Run every scenario for one variant (packages must already be installed).
v=$1; shift
cd /root/harness
for s in ${@:-hover choose drop six-wpa2 six-sae single g24only multiap}; do
  echo "$(date +%T) $s-$v start"
  python3 run.py $s $v > /root/harness/results/run-$s-$v.log 2>&1 || echo "$s-$v FAILED"
  python3 analyze.py results/$s-$v >> /root/harness/results/metrics-$v.jsonl 2>&1
done
echo "$(date +%T) suite $v done"
