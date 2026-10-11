import { execFileSync, spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { readVersion } from "./version.mjs";

const { tag, version, prerelease } = readVersion();
const git = (...args) =>
  execFileSync("git", args, {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  }).trim();
git("rev-parse", "--verify", "HEAD");

const shallow = git("rev-parse", "--is-shallow-repository");
if (shallow !== "false") {
  throw new Error("生成发布说明需要完整 Git 历史，请先获取全部提交和标签。");
}
const previousResult = spawnSync(
  "git",
  ["describe", "--tags", "--abbrev=0", "--match", "v[0-9]*", "HEAD^"],
  { encoding: "utf8" },
);
if (previousResult.error) throw previousResult.error;
const previous =
  previousResult.status === 0 ? previousResult.stdout.trim() : null;
const range = previous ? `${previous}..HEAD` : "HEAD";
const commits = git("log", "--reverse", "--format=%H%x00%s", range)
  .split("\n")
  .filter(Boolean)
  .map((line) => {
    const [hash, subject] = line.split("\0");
    return { hash, subject };
  })
  .filter(({ subject }) =>
    /^(?:feat|fix|perf|style)(?:\([^()]+\))?!?:\s*\S/.test(subject),
  );
const repository = process.env.GITHUB_REPOSITORY;
const server = process.env.GITHUB_SERVER_URL || "https://github.com";
const url = repository ? `${server}/${repository}` : null;
const escape = (text) => text.replace(/[\\`*_{}\[\]<>()!#|~]/g, "\\$&");
const lines = [
  "# 1. 更新记录",
  "",
  previous
    ? `以下内容自动整理自 ${escape(previous)} 至 ${escape(tag)} 的 feat、fix、perf、style 类型提交。`
    : "首次发布，以下内容自动整理自全部历史中的 feat、fix、perf、style 类型提交。",
  "",
  ...commits.map(({ hash, subject }) => {
    const ref = url
      ? `[${hash.slice(0, 7)}](${url}/commit/${hash})`
      : `\`${hash.slice(0, 7)}\``;
    return `- ${escape(subject)} (${ref})`;
  }),
];
if (!commits.length)
  lines.push("此版本没有 feat、fix、perf 或 style 类型的更新。");
if (previous && url) {
  lines.push(
    "",
    `[完整差异](${url}/compare/${encodeURIComponent(previous)}...${encodeURIComponent(tag)})`,
  );
}
lines.push(
  "",
  "# 2. 安装",
  "",
  `下载附件 \`halo-theme-margin-${version}.zip\`，在 Halo 后台「外观 → 主题」上传安装或更新。`,
  "",
  "请使用主题 ZIP 附件，GitHub 自动生成的 Source code 压缩包不作为安装包。",
  "",
);
mkdirSync("work", { recursive: true });
writeFileSync("work/release-notes.md", lines.join("\n"), "utf8");
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `version=${version}\nprerelease=${prerelease}\nasset=dist/halo-theme-margin-${version}.zip\n`,
  );
}
console.log(
  `发布说明已生成：${commits.length} 条提交，${previous || "首次发布"} → ${tag}`,
);
