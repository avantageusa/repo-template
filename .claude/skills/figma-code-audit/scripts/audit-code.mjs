#!/usr/bin/env node
// Static scan for Figma-to-code anti-patterns: unbound hex colors, absolute-positioning-as-layout,
// near-duplicate components, and empty spacer tags. Heuristic, not a compiler — see SKILL.md
// for how to read results (especially: absolute positioning and duplicate detection both need a
// human sanity check before being treated as confirmed bugs).
import fs from 'node:fs';
import path from 'node:path';

const CODE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.css']);
const IGNORE_DIRS = new Set(['node_modules', 'dist', 'build', '.git', 'assets']);
const HEX_RE = /#[0-9a-fA-F]{3,4}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{8}\b/g;
const TAG_RE = /<([A-Za-z][\w.]*)[ />]/g;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (CODE_EXT.has(path.extname(entry.name))) out.push(full);
  }
  return out;
}

function isTokenFile(file) {
  return /tokens?\.(ts|js)$/i.test(path.basename(file));
}

function buildTokenMap(files) {
  const map = new Map(); // lowercase hex -> "key"
  for (const file of files.filter(isTokenFile)) {
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(/([A-Za-z0-9_]+)\s*:\s*['"](#[0-9a-fA-F]{3,8})['"]/g)) {
      map.set(m[2].toLowerCase(), m[1]);
    }
  }
  return map;
}

function lineAt(src, index) {
  return src.slice(0, index).split('\n').length;
}

function checkHex(file, src, tokenMap, findings) {
  if (isTokenFile(file)) return;
  for (const m of src.matchAll(HEX_RE)) {
    const hex = m[0].toLowerCase();
    const line = lineAt(src, m.index);
    const known = tokenMap.get(hex);
    if (known) {
      findings.push({
        category: 'unbound-token',
        severity: 'high',
        file, line,
        message: `Raw ${m[0]} duplicates token "${known}" — bind to it instead of typing the hex.`,
      });
    } else {
      findings.push({
        category: 'raw-hex',
        severity: 'low',
        file, line,
        message: `Raw color ${m[0]} isn't in the token file — confirm it's intentional or promote it to a named variable.`,
      });
    }
  }
}

function checkAbsolutePositioning(file, src, findings) {
  const absoluteMatches = [...src.matchAll(/position:\s*['"]?absolute['"]?/g)];
  if (absoluteMatches.length === 0) return;
  const hasFlexOrGrid = /display:\s*['"]?(flex|grid)['"]?/.test(src);
  // The deck's actual failure case is a *repeated* set of siblings each hardcoded to its own
  // left/top (a grid or list built from absolute offsets instead of layout). A `.map(` shortly
  // before a position:absolute is a strong signal of exactly that. Without it, absolute
  // positioning is very often a legitimate small composition — an icon drawn from stacked shapes,
  // a progress-bar fill over its track, a badge floated over a background image — which uses no
  // flex/grid either and is not a bug.
  const mapWindow = 200;
  const isMappedRepeat = absoluteMatches.some((m) => {
    const before = src.slice(Math.max(0, m.index - mapWindow), m.index);
    return /\.map\(/.test(before);
  });
  let severity, message;
  if (isMappedRepeat) {
    severity = 'high';
    message = `${absoluteMatches.length} absolute-positioned element(s), at least one inside a .map() over repeated items — likely a hand-positioned list/grid that won't reflow. Check for an auto-layout/flex equivalent instead.`;
  } else if (hasFlexOrGrid) {
    severity = 'info';
    message = `${absoluteMatches.length} absolute-positioned element(s) alongside flex/grid layout — likely an intentional overlay; confirm none of them stand in for layout that should reflow.`;
  } else {
    severity = 'medium';
    message = `${absoluteMatches.length} absolute-positioned element(s) and no flex/grid layout found in this file — check whether this is a small decorative composition (icon, progress fill, floated badge — fine as-is) or content that should reflow (not fine).`;
  }
  findings.push({ category: 'absolute-position', severity, file, line: lineAt(src, absoluteMatches[0].index), message });
}

function checkEmptyTags(file, src, findings) {
  const patterns = [
    /<(p|div|span)>\s*<\/\1>/g,
    /(<br\s*\/?>\s*){2,}/g,
  ];
  for (const re of patterns) {
    for (const m of src.matchAll(re)) {
      findings.push({
        category: 'empty-spacer',
        severity: 'medium',
        file, line: lineAt(src, m.index),
        message: `Empty tag(s) apparently used for spacing ("${m[0].replace(/\s+/g, ' ').trim()}") — use padding/gap instead.`,
      });
    }
  }
}

function tagSkeleton(src) {
  return [...src.matchAll(TAG_RE)].map((m) => m[1]);
}

function similarity(a, b) {
  if (a.length === 0 || b.length === 0) return 0;
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const lcs = dp[a.length][b.length];
  return lcs / Math.max(a.length, b.length);
}

function checkDuplicateComponents(files, findings) {
  const byDir = new Map();
  for (const file of files) {
    if (!/\.tsx?$|\.jsx?$/.test(file) || isTokenFile(file) || file.endsWith('.figma.ts')) continue;
    const src = fs.readFileSync(file, 'utf8');
    if (!/export default/.test(src)) continue;
    const skeleton = tagSkeleton(src);
    if (skeleton.length < 5) continue; // too small to be meaningful
    const dir = path.dirname(file);
    if (!byDir.has(dir)) byDir.set(dir, []);
    byDir.get(dir).push({ file, skeleton });
  }
  for (const entries of byDir.values()) {
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const score = similarity(entries[i].skeleton, entries[j].skeleton);
        if (score >= 0.85) {
          const pct = Math.round(score * 100);
          findings.push({
            category: 'possible-duplicate',
            severity: 'high',
            file: entries[i].file,
            line: 1,
            message: `Structurally ~${pct}% identical to ${path.relative(process.cwd(), entries[j].file)} — consider one component with instances/props instead of parallel copies.`,
          });
          findings.push({
            category: 'possible-duplicate',
            severity: 'high',
            file: entries[j].file,
            line: 1,
            message: `Structurally ~${pct}% identical to ${path.relative(process.cwd(), entries[i].file)} — consider one component with instances/props instead of parallel copies.`,
          });
        }
      }
    }
  }
}

function main() {
  const target = process.argv[2] || 'src';
  const asJson = process.argv.includes('--json');
  if (!fs.existsSync(target)) {
    console.error(`No such path: ${target}`);
    process.exit(1);
  }
  const files = walk(target);
  const tokenMap = buildTokenMap(files);
  const findings = [];

  for (const file of files) {
    if (path.extname(file) === '.css' || CODE_EXT.has(path.extname(file))) {
      const src = fs.readFileSync(file, 'utf8');
      checkHex(file, src, tokenMap, findings);
      checkAbsolutePositioning(file, src, findings);
      checkEmptyTags(file, src, findings);
    }
  }
  checkDuplicateComponents(files, findings);

  const order = { high: 0, medium: 1, low: 2, info: 3 };
  findings.sort((a, b) => order[a.severity] - order[b.severity] || a.file.localeCompare(b.file));

  if (asJson) {
    console.log(JSON.stringify(findings, null, 2));
    return;
  }

  if (findings.length === 0) {
    console.log(`No anti-patterns found in ${files.length} files under ${target}.`);
    return;
  }

  const bySeverity = { high: [], medium: [], low: [], info: [] };
  for (const f of findings) bySeverity[f.severity].push(f);

  for (const sev of ['high', 'medium', 'low', 'info']) {
    if (bySeverity[sev].length === 0) continue;
    console.log(`\n=== ${sev.toUpperCase()} (${bySeverity[sev].length}) ===`);
    for (const f of bySeverity[sev]) {
      console.log(`${path.relative(process.cwd(), f.file)}:${f.line}  [${f.category}]  ${f.message}`);
    }
  }
  console.log(`\n${findings.length} finding(s) across ${files.length} file(s) scanned.`);
}

main();
