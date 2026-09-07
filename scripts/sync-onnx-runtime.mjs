/**
 * Copy the ONNX Runtime WebAssembly binary out of node_modules and into
 * `public/ort/`, where the upscaler loads it from.
 *
 * onnxruntime-web fetches this file from a CDN by default. Serving it ourselves
 * keeps `connect-src 'self'` — the header that carries this site's promise that
 * files stay on the device — and lets the tool work offline once cached.
 *
 * It is copied rather than committed because it is 27 MB of build output that
 * must match the installed package version exactly. Run by `predev` and
 * `prebuild`, so there is no state in which the app is served without it.
 */

import { copyFile, mkdir, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const destination = join(root, "public", "ort");

/*
 * The JSEP build carries the WebGPU backend and still runs on plain
 * WebAssembly when there is no adapter, so one variant covers both paths. It is
 * the one `import "onnxruntime-web"` asks for — the `/webgpu` entry point wants
 * the asyncify build instead, and picking the wrong pair fails at runtime with
 * "no available backend found", never at build time. Both files are needed: the
 * "bundle" build still fetches its loader separately.
 */
const FILES = [
  "ort-wasm-simd-threaded.jsep.mjs",
  "ort-wasm-simd-threaded.jsep.wasm",
];

await mkdir(destination, { recursive: true });

for (const file of FILES) {
  await copyFile(require.resolve(`onnxruntime-web/${file}`), join(destination, file));
  const { size } = await stat(join(destination, file));
  console.log(
    `onnxruntime: ${file} → public/ort/ (${(size / 1024 / 1024).toFixed(1)} MB)`,
  );
}
