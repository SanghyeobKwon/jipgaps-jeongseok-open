import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));

async function collect(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collect(path);
    return /\.test\.(?:mjs|ts)$/.test(entry.name) ? [path] : [];
  }));
  return files.flat();
}

const files = (await collect(root)).sort((a, b) => relative(root, a).localeCompare(relative(root, b)));
await Promise.all(files.map((file) => import(pathToFileURL(file).href)));
