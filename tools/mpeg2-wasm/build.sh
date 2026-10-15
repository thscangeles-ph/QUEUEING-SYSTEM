#!/usr/bin/env bash
# Builds public/dicom-lib/mpeg2dec.mjs and mpeg2dec.wasm: FFmpeg's MPEG-1/2 video decoder and MPEG program stream,
# transport stream and raw video demuxers, compiled to WebAssembly for the DICOM Viewer.
#
# Needs Emscripten (emcc on PATH, e.g. `source emsdk/emsdk_env.sh` after `./emsdk install 3.1.74 && ./emsdk activate 3.1.74`),
# git and make. FFmpeg is fetched into tools/mpeg2-wasm/build/. The result is LGPL-2.1-or-later (FFmpeg built without
# GPL parts); rebuilding with another FFmpeg version or other options only needs this script and mpeg2dec.c.
set -euo pipefail

FFMPEG_TAG="${FFMPEG_TAG:-n7.1.2}"
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$HERE/../../public/dicom-lib"
WORK="$HERE/build"
SRC="$WORK/ffmpeg-$FFMPEG_TAG"

command -v emcc >/dev/null || { echo "emcc not found: activate Emscripten first" >&2; exit 1; }
mkdir -p "$WORK"
[ -d "$SRC" ] || git clone --depth 1 -b "$FFMPEG_TAG" https://github.com/FFmpeg/FFmpeg.git "$SRC"

cd "$SRC"
if [ ! -f "$WORK/.configured-$FFMPEG_TAG" ]; then
  emconfigure ./configure \
    --cc=emcc --cxx=em++ --ar=emar --ranlib=emranlib --nm=emnm \
    --target-os=none --arch=x86_32 --enable-cross-compile \
    --disable-asm --disable-x86asm --disable-inline-asm --disable-runtime-cpudetect \
    --disable-autodetect --disable-everything --disable-programs --disable-doc --disable-debug --disable-stripping \
    --disable-network --disable-pthreads --disable-w32threads --disable-os2threads \
    --disable-avdevice --disable-swresample --disable-swscale --disable-postproc --disable-avfilter \
    --enable-decoder=mpeg1video,mpeg2video --enable-parser=mpegvideo \
    --enable-demuxer=mpegps,mpegts,mpegvideo \
    --extra-cflags="-O3" --extra-ldflags="-O3"
  touch "$WORK/.configured-$FFMPEG_TAG"
fi
emmake make -j"$(nproc)" libavformat/libavformat.a libavcodec/libavcodec.a libavutil/libavutil.a

emcc -O3 "$HERE/mpeg2dec.c" -I"$SRC" \
  libavformat/libavformat.a libavcodec/libavcodec.a libavutil/libavutil.a \
  -o "$OUT/mpeg2dec.mjs" \
  -sMODULARIZE=1 -sEXPORT_ES6=1 -sENVIRONMENT=worker -sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=33554432 \
  -sFILESYSTEM=0 -sEXPORTED_FUNCTIONS=_malloc,_free -sEXPORTED_RUNTIME_METHODS=HEAPU8
echo "Built $OUT/mpeg2dec.mjs and mpeg2dec.wasm"
ls -la "$OUT/mpeg2dec.mjs" "$OUT/mpeg2dec.wasm"
