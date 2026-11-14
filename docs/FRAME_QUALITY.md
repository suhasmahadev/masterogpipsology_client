# Frame Quality Guide (P7)

**Current state:** `public/assets/{crypto,forex,stock_market,opportunity}/ezgif-frame-001..240.jpg` (1920×1080 baseline JPEG, ~35 KB median, visible blocking/banding).

**Output:** NEW folders under `D:\mop-frames` → `public\assets-hq\...`. **Originals are never overwritten.**

**Frame count:** 240 per sequence. If RIFE (480) is adopted later, update `TOTAL_FRAMES`, `*_FRAMES` constants, and `PINNED` last-index values in the frame-sequence components.

---

## Tools (Windows)

Install via Scoop or official releases:

```powershell
# Option 1: Scoop
scoop install ffmpeg libwebp libavif

# Option 2: Manual
# - FFmpeg: https://ffmpeg.org/download.html
# - libwebp: https://developers.google.com/speed/webp/download
# - libavif: https://github.com/AOMediaCodec/libavif/releases
# - Real-ESRGAN: https://github.com/xinntao/Real-ESRGAN/releases (zip includes models)
# - RIFE: https://github.com/nihui/rife-ncnn-vulkan/releases

# Verify installation
ffmpeg -version
cwebp -version
avifenc --version
realesrgan-ncnn-vulkan.exe -h
rife-ncnn-vulkan.exe -h
```

**GUI alternative:** Topaz Video AI (Proteus/Iris model, 1x or 2x, export PNG sequence).

---

## Commands (PowerShell)

```powershell
$names = 'crypto','forex','stock_market','opportunity'
$root  = 'D:\mop-frames'                          # Scratch workspace, NOT inside public\
New-Item -ItemType Directory -Force "$root" | Out-Null
```

### A. Re-extract from source video at full quality

Place source videos at `$root\src\<name>.mp4`. Outputs exactly 240 frames as lossless PNG masters.

```powershell
foreach ($n in $names) {
  $src = "$root\src\$n.mp4"; $out = "$root\01-master\$n"
  New-Item -ItemType Directory -Force $out | Out-Null
  $dur = [double](ffprobe -v error -show_entries format=duration -of csv=p=0 $src)
  $fps = 240 / $dur
  ffmpeg -hide_banner -i $src `
    -vf "fps=$fps,scale=1920:1080:flags=lanczos+accurate_rnd+full_chroma_int,format=rgb24" `
    -frames:v 240 -start_number 1 "$out\frame-%03d.png"
}
```

### B. If no source video: clean existing JPEGs to PNG masters

Deblock, denoise, and deband the baseline JPEG exports.

```powershell
foreach ($n in $names) {
  $out = "$root\01-master\$n"
  New-Item -ItemType Directory -Force $out | Out-Null
  ffmpeg -hide_banner -start_number 1 -i "public\assets\$n\ezgif-frame-%03d.jpg" `
    -vf "deblock=filter=strong:block=8,hqdn3d=1.2:1.2:4:4,deband=1thr=0.015:2thr=0.015:3thr=0.015:range=18:blur=1,format=rgb24" `
    -start_number 1 "$out\frame-%03d.png"
}
```

### C. Light denoise/deband on masters (path A only, optional)

Only if the source video itself is noisy.

```powershell
foreach ($n in $names) {
  $in = "$root\01-master\$n"; $out = "$root\02-clean\$n"
  New-Item -ItemType Directory -Force $out | Out-Null
  ffmpeg -hide_banner -start_number 1 -i "$in\frame-%03d.png" `
    -vf "hqdn3d=1.0:1.0:3:3,deband=1thr=0.012:2thr=0.012:3thr=0.012:range=16:blur=1" `
    -start_number 1 "$out\frame-%03d.png"
}
# If skipped, use 01-master as the next step's input.
```

### D. AI upscale (Real-ESRGAN) to remove JPEG mush and recover detail

**Option 1: Fast CG-friendly (x2 recommended)**

```powershell
foreach ($n in $names) {
  $in = "$root\02-clean\$n"; $out = "$root\03-x2\$n"
  New-Item -ItemType Directory -Force $out | Out-Null
  realesrgan-ncnn-vulkan.exe -i $in -o $out -n realesr-animevideov3 -s 2 -f png -t 256 -j 2:2:2
}
```

**Option 2: Higher quality photoreal (x4, ~60 MB per PNG, ~15 GB total for 240 frames per sequence)**

```powershell
# realesrgan-ncnn-vulkan.exe -i "$root\02-clean\$n" -o "$root\03-x4\$n" -n realesrgan-x4plus -s 4 -f png -t 200
```

**Topaz note:** Topaz Video AI (Proteus/Iris) is a paid GUI alternative that may produce better results for film/photorealism; point it at `01-master\$n`, set upscale to 1x or 2x, output PNG sequence, and use the result as `03-x2` input.

---

### E. Optional: RIFE 2× frame interpolation

Doubles frame count (240 → 480). **Only if you also update the code** (`lib/frame-sequence/sources.ts` constants `TOTAL_FRAMES`, `*_FRAMES`, and `PINNED` indices).

```powershell
foreach ($n in $names) {
  $in = "$root\03-x2\$n"; $out = "$root\04-rife\$n"
  New-Item -ItemType Directory -Force $out | Out-Null
  rife-ncnn-vulkan.exe -i $in -o $out -m rife-v4.6 -n 480 -f "frame-%03d.png"
}
# Use $root\04-rife as the next step's input instead of 03-x2.
```

---

### F. Encode delivery sets: WebP and AVIF at quality 80–85

Creates two resolution sets (1920×1080 and 1080×608) in both WebP and AVIF formats.

```powershell
$enc = "$root\03-x2"          # or 04-rife if you interpolated

foreach ($n in $names) {
  foreach ($w in 1920,1080) {
    $h = [int]([math]::Round($w * 9 / 16 / 2) * 2)   # 1080 or 608
    
    # Resize to target dimensions
    $pngTmp = "$root\05-sized\$n\$w"
    New-Item -ItemType Directory -Force $pngTmp | Out-Null
    ffmpeg -hide_banner -start_number 1 -i "$enc\$n\frame-%03d.png" `
      -vf "scale=${w}:${h}:flags=lanczos" -start_number 1 "$pngTmp\frame-%03d.png"
    
    # WebP q82 (primary)
    $webp = "public\assets-hq\$n\$w"
    New-Item -ItemType Directory -Force $webp | Out-Null
    Get-ChildItem "$pngTmp\*.png" | ForEach-Object {
      cwebp -quiet -q 82 -m 6 -sharp_yuv -af -mt $_.FullName `
        -o (Join-Path $webp ($_.BaseName + '.webp'))
    }
    
    # AVIF q80 (optional, not wired yet)
    $avif = "public\assets-hq-avif\$n\$w"
    New-Item -ItemType Directory -Force $avif | Out-Null
    Get-ChildItem "$pngTmp\*.png" | ForEach-Object {
      avifenc -q 80 -s 6 -j all -d 8 -y 420 $_.FullName `
        (Join-Path $avif ($_.BaseName + '.avif')) | Out-Null
    }
  }
}
```

---

## Verification

Each `public\assets-hq\<name>\1920` should contain exactly 240 WebP files, typically 40–90 KB each.

```powershell
# Check file count for one sequence
(Get-ChildItem public\assets-hq\crypto\1920\*.webp).Count  # Should be 240

# Quick file size spot-check
(Get-ChildItem public\assets-hq\crypto\1920\*.webp | Measure-Object -Property Length -Sum).Sum / 1MB  # ~10–20 MB total
```

If using x4 upscaling, step F's `scale=` already downsamples from 7680 px; no other changes needed.

---

## Code wiring

Frame URLs, tiers and the JPEG fallback live in `lib/frame-sequence/sources.ts`. The sets are `/frames/v1/<seq>/{1280,p1080}/NNN.webp` (generated by `corepack pnpm frames`, committed). `full` desktop tier keeps the original JPEGs in `public/assets/`.

For frame count changes (RIFE), update `FRAMES_PER_SEQ`, `*_FRAMES` and `PINNED` in `CryptoMarketScroll.tsx` and `ForexMarketScroll.tsx`, then regenerate into a new versioned folder.

---

**Cache-busting rule:** files under /assets, /frames, /textures and /hero are immutable for one year (`next.config.ts` headers). Never replace a file in place: write a new folder (e.g. /frames/v2) and bump FRAME_SET_VERSION.

---

## Summary

1. **Install tools** (ffmpeg, libwebp, libavif, Real-ESRGAN, optionally RIFE).
2. **Extract/clean:** Run A (if you have source videos) or B (if not).
3. **Denoise (optional):** Run C if the masters are noisy.
4. **Upscale:** Run D (x2 recommended) or use Topaz.
5. **Interpolate (optional):** Run E only if updating frame counts in code.
6. **Encode:** Run F to generate WebP and AVIF sets.
7. **Verify:** Check file counts and sizes.
8. **Activate:** Create `sources.ts` and flip `FRAME_FORMAT` to `'webp'`.
