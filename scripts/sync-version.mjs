import { readFileSync, writeFileSync } from "node:fs";
import { readVersion } from "./version.mjs";

const { version } = readVersion();
const file = "theme.yaml";
const source = readFileSync(file, "utf8");
const field = /^  version:[^\r\n]*/gm;
if ([...source.matchAll(field)].length !== 1) {
  throw new Error("theme.yaml 必须包含唯一的 spec.version 字段。");
}
const updated = source.replace(field, `  version: ${version}`);
const packageSource = readFileSync("package.json", "utf8");
const packageJson = JSON.parse(packageSource);
if (packageJson.version !== version) {
  packageJson.version = version;
  writeFileSync(
    "package.json",
    `${JSON.stringify(packageJson, null, 2)}\n`,
    "utf8",
  );
}
if (updated !== source) writeFileSync(file, updated, "utf8");
console.log(`Theme version: ${version}`);
