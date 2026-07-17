#!/usr/bin/env node
// Repin every consumer (skill, README, site) to a release commit's full SHA.
// Usage: npm run pin [-- <sha>]
// Default: the last commit that touched dist/vibe.min.js — the release commit
// by construction. (Not HEAD: docs commits after a release also "contain" the
// dist file, but pinning them makes the URL and the prose disagree.)
const fs = require("fs");
const cp = require("child_process");

const sha = (
  process.argv[2] ||
  cp.execSync("git rev-list -1 HEAD -- dist/vibe.min.js").toString().trim()
).toLowerCase();
if (!/^[0-9a-f]{40}$/.test(sha)) {
  console.error("not a full 40-char commit sha: " + sha);
  process.exit(1);
}
try {
  cp.execSync(`git cat-file -e ${sha}:dist/vibe.min.js`, { stdio: "ignore" });
} catch {
  console.error(`commit ${sha.slice(0, 7)} has no dist/vibe.min.js — pin the release commit, not the docs commit`);
  process.exit(1);
}

const FILES = ["skill/SKILL.md", "skill/SKILL.sepia.md", "skill/SKILL.kip.md",
  "skill/SKILL.noto-animated.md", "skill/SKILL.noto.md", "skill/SKILL.twemoji.md",
  "README.md", "index.html"];
const RE = /vibe-annotation-renderer@[0-9a-f]{40}/g;
let changed = 0;
for (const f of FILES) {
  const before = fs.readFileSync(f, "utf8");
  const after = before.replace(RE, "vibe-annotation-renderer@" + sha);
  if (after !== before) {
    fs.writeFileSync(f, after);
    console.log("pinned " + f);
    changed++;
  }
}
console.log(changed ? `all consumers pinned to ${sha.slice(0, 7)} — commit this, then copy skill/SKILL.md to ~/.claude/skills/vibe-annotations/ (and re-paste on claude.ai)` : "already pinned to " + sha.slice(0, 7));
