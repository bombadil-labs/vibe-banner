// Load the BROWSER bundle exactly as the Builder does, and compare its assembler's output to
// the CLI's. If these ever differ again, this is the check that says so.
const fs = require("fs");
const cwd = process.cwd();
const G = require(cwd + "/scripts/gen-skills.js");

const win = {};
const src = fs.readFileSync(cwd + "/assets/skill-base.js", "utf8");
new Function("window", src)(win);
const P = win.SKILL_PIECES;

let fails = 0;
const cases = [
  ["sepia / tidepool / all moods", "sepia", { scene: "tidepool" }],
  ["motes / night / core moods", "motes", { scene: "night", moods: G.PIECES.CORE_MOODS }],
  ["kip / glade / five moods", "kip", { scene: "glade", moods: ["neutral", "content", "laugh", "solemn", "working"] }],
  ["drollery / study / cadence", "drollery", { scene: "study", cadence: "every_n", every: 4 }],
  ["kaomoji / no scene", "kaomoji", {}]
];
cases.forEach(([label, face, opts]) => {
  const cli = G.assemble(face, opts);
  const browser = P.ASSEMBLE(face, Object.assign({ name: "vibe-banner" }, opts), P);
  const same = cli === browser;
  if (!same) {
    fails++;
    for (let i = 0; i < Math.max(cli.length, browser.length); i++) {
      if (cli[i] !== browser[i]) {
        console.log("    first divergence at " + i + ":");
        console.log("      cli:     " + JSON.stringify(cli.slice(i - 40, i + 60)));
        console.log("      browser: " + JSON.stringify(browser.slice(i - 40, i + 60)));
        break;
      }
    }
  }
  console.log("  " + (same ? "ok  " : "FAIL") + "  " + label + "  (" + cli.length + " chars)");
});
console.log(fails ? "\n  " + fails + " MISMATCH" : "\n  the Builder and the CLI produce identical skills");
process.exit(fails ? 1 : 0);
