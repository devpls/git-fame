# Performance Notes

Benchmarks from development dogfood sessions on macOS (Apple Silicon).

## node-fame vs git-fame

Repository: store (3,281 tracked files, ~550k total lines, ~500 commits)

| Tool                  | Filter          | Files  | Wall time | Files/sec |
| --------------------- | --------------- | ------ | --------- | --------- |
| git-fame (Python)     | TS/TSX/CSS only | 2,797  | 5m 23s    | ~8.7      |
| node-fame (default)   | excl generated  | ~2,100 | 49s       | ~43       |
| node-fame (all files) | none            | 3,281  | 45s       | ~73       |

~7x faster wall-clock. Streaming parsers + parallel blame via p-limit.

## Correctness

| Metric             | git-fame | node-fame | Delta       |
| ------------------ | -------- | --------- | ----------- |
| Lines (TS/TSX/CSS) | 135,159  | 134,336   | -823 (0.6%) |

Difference from default -w and -M -C in blame.
