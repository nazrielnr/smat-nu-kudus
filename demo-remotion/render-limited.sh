#!/bin/bash
# Render per potongan dengan batas memori (cgroup 6 GB) lalu sambung dengan ffmpeg.
cd "$(dirname "$0")"
rm -f out/p?.mp4 out/demo.mp4
i=1
for r in 0-2969 2970-5939 5940-8912; do
  echo "== potongan $i ($r)"
  systemd-run --user --scope -q -p MemoryMax=6G -p MemorySwapMax=0 \
    npx remotion render src/index.ts Demo out/p$i.mp4 --frames=$r --codec=h264 --crf=18 --audio-codec=aac --concurrency=2 || { echo GAGAL $i; exit 1; }
  i=$((i+1))
done
printf "file 'p1.mp4'\nfile 'p2.mp4'\nfile 'p3.mp4'\n" > out/list.txt
ffmpeg -y -v error -f concat -safe 0 -i out/list.txt -c copy out/demo.mp4 && echo SELESAI
