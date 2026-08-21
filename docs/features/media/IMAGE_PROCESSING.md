# Image Processing

V1 has tested JPEG, PNG and WebP input support. AVIF and HEIC/HEIF input are deliberately not claimed. Sharp/libvips uses strict decode errors, a 40 MP input pixel limit, 12,000 px per-axis limit, auto-orientation, resize without enlargement and WebP output. Re-encoding without `withMetadata` strips EXIF, GPS, device and timestamp metadata.

| Variant   | Bounding box | WebP quality |
| --------- | -----------: | -----------: |
| Thumbnail |    320 × 320 |           76 |
| Feed      |  1280 × 1280 |           80 |
| Full      |  2560 × 2560 |           82 |

Animated/multi-frame and unsupported inputs are rejected rather than silently claimed. AVIF output is deferred because its CPU/latency benefit has not yet been measured at the initial scale.
