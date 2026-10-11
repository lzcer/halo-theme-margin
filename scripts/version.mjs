import { readFileSync } from "node:fs";

export function readVersion() {
  const releaseTag = process.env.RELEASE_TAG;
  if (releaseTag !== undefined && !releaseTag.startsWith("v")) {
    throw new Error("发布标签必须以 v 开头，例如 v0.1.10。");
  }
  const version =
    releaseTag !== undefined
      ? releaseTag.slice(1)
      : JSON.parse(readFileSync("package.json", "utf8")).version;
  if (
    typeof version !== "string" ||
    !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(
      version,
    )
  ) {
    throw new Error("版本号必须符合 SemVer，例如 0.1.10 或 0.1.10-rc.1。");
  }
  const prerelease = version.split("+")[0].split("-").slice(1).join("-");
  if (prerelease.split(".").some((part) => /^0\d+$/.test(part))) {
    throw new Error("预发布版本的纯数字标识不能有前导零。");
  }
  return { version, tag: `v${version}`, prerelease: Boolean(prerelease) };
}
