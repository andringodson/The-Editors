# Model weights

## `realesrgan-x4v3.onnx`

Real-ESRGAN **general x4v3** (`realesr-general-x4v3`), a SRVGGNetCompact
network trained by Xintao Wang et al. for [Real-ESRGAN][real-esrgan]. 4.9 MB,
fixed 128×128 input, 4× RGB output. ONNX export mirrored from
[`tamnvcc/Real-ESRGAN-General-x4v3_float`][mirror].

Licensed **BSD-3-Clause**, as the upstream project is.

### Why this one

Measured against the alternatives on a 128 px tile:

| Model | Weights | Per tile |
| --- | --- | --- |
| **Real-ESRGAN general x4v3** | 4.9 MB | **0.22 s** |
| Real-ESRGAN x4plus | 69 MB | 3.7 s |
| Swin2SR realworld x4 | 52 MB | 5.1 s |

The heavier two are sharper on paper and indistinguishable at normal viewing
sizes, at fifteen to twenty times the wait and ten times the download. This is
also the network Upscayl ships as its default, for the same reason.

### Contract

Input `image`, `float32[1, 3, 128, 128]`, RGB planar, `[0, 1]`.
Output `upscaled_image`, `float32[1, 3, 512, 512]`, same convention, and it
overshoots the range slightly — clamp before writing bytes.

It is committed rather than fetched at build time so that a build can never
depend on a third-party mirror staying up. The ONNX **runtime** beside it in
`public/ort/` is copied from `node_modules` instead — see
`scripts/sync-onnx-runtime.mjs`.

[real-esrgan]: https://github.com/xinntao/Real-ESRGAN
[mirror]: https://huggingface.co/tamnvcc/Real-ESRGAN-General-x4v3_float
