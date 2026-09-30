#!/usr/bin/env node
/**
 * Protect Secrets - PreToolUse Hook for Read|Edit|Write|Bash
 * Prevents reading, modifying, or exfiltrating sensitive files.
 * Logs to: ~/.claude/hooks-logs/
 *
 * SAFETY_LEVEL: 'critical' | 'high' | 'strict'
 *   critical - SSH keys, AWS creds, .env files only
 *   high     - + secrets files, env dumps, exfiltration attempts
 *   strict   - + database configs, any config that might contain secrets
 *
 * Setup in .claude/settings.json:
 * {
 *   "hooks": {
 *     "PreToolUse": [{
 *       "matcher": "Read|Edit|Write|Bash",
 *       "hooks": [{ "type": "command", "command": "node /path/to/protect-secrets.js" }]
 *     }]
 *   }
 * }
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

const SAFETY_LEVEL = "high";

// Files explicitly safe to access (templates, examples)
const ALLOWLIST = [
  /\.env\.example$/i,
  /\.env\.sample$/i,
  /\.env\.template$/i,
  /\.env\.schema$/i,
  /\.env\.defaults$/i,
  /env\.example$/i,
  /example\.env$/i,
];

// Sensitive file patterns for Read, Edit, Write tools
const SENSITIVE_FILES = [
  // CRITICAL
  {
    level: "critical",
    id: "env-file",
    regex: /(?:^|\/)\.env(?:\.[^/]*)?$/,
    reason: ".env file contains secrets",
  },
  {
    level: "critical",
    id: "envrc",
    regex: /(?:^|\/)\.envrc$/,
    reason: ".envrc (direnv) contains secrets",
  },
  {
    level: "critical",
    id: "ssh-private-key",
    regex: /(?:^|\/)\.ssh\/id_[^/]+$/,
    reason: "SSH private key",
  },
  {
    level: "critical",
    id: "ssh-private-key-2",
    regex: /(?:^|\/)(id_rsa|id_ed25519|id_ecdsa|id_dsa)$/,
    reason: "SSH private key",
  },
  {
    level: "critical",
    id: "ssh-authorized",
    regex: /(?:^|\/)\.ssh\/authorized_keys$/,
    reason: "SSH authorized_keys",
  },
  {
    level: "critical",
    id: "aws-credentials",
    regex: /(?:^|\/)\.aws\/credentials$/,
    reason: "AWS credentials file",
  },
  {
    level: "critical",
    id: "aws-config",
    regex: /(?:^|\/)\.aws\/config$/,
    reason: "AWS config may contain secrets",
  },
  {
    level: "critical",
    id: "kube-config",
    regex: /(?:^|\/)\.kube\/config$/,
    reason: "Kubernetes config contains credentials",
  },
  {
    level: "critical",
    id: "pem-key",
    regex: /\.pem$/i,
    reason: "PEM key file",
  },
  { level: "critical", id: "key-file", regex: /\.key$/i, reason: "Key file" },
  {
    level: "critical",
    id: "p12-key",
    regex: /\.(p12|pfx)$/i,
    reason: "PKCS12 key file",
  },

  // HIGH
  {
    level: "high",
    id: "credentials-json",
    regex: /(?:^|\/)credentials\.json$/i,
    reason: "Credentials file",
  },
  {
    level: "high",
    id: "secrets-file",
    regex: /(?:^|\/)(secrets?|credentials?)\.(json|ya?ml|toml)$/i,
    reason: "Secrets configuration file",
  },
  {
    level: "high",
    id: "service-account",
    regex: /service[_-]?account.*\.json$/i,
    reason: "GCP service account key",
  },
  {
    level: "high",
    id: "gcloud-creds",
    regex: /(?:^|\/)\.config\/gcloud\/.*(credentials|tokens)/i,
    reason: "GCloud credentials",
  },
  {
    level: "high",
    id: "azure-creds",
    regex: /(?:^|\/)\.azure\/(credentials|accessTokens)/i,
    reason: "Azure credentials",
  },
  {
    level: "high",
    id: "docker-config",
    regex: /(?:^|\/)\.docker\/config\.json$/,
    reason: "Docker config may contain registry auth",
  },
  {
    level: "high",
    id: "netrc",
    regex: /(?:^|\/)\.netrc$/,
    reason: ".netrc contains credentials",
  },
  {
    level: "high",
    id: "npmrc",
    regex: /(?:^|\/)\.npmrc$/,
    reason: ".npmrc may contain auth tokens",
  },
  {
    level: "high",
    id: "pypirc",
    regex: /(?:^|\/)\.pypirc$/,
    reason: ".pypirc contains PyPI credentials",
  },
  {
    level: "high",
    id: "gem-creds",
    regex: /(?:^|\/)\.gem\/credentials$/,
    reason: "RubyGems credentials",
  },
  {
    level: "high",
    id: "vault-token",
    regex: /(?:^|\/)(\.vault-token|vault-token)$/,
    reason: "Vault token file",
  },
  {
    level: "high",
    id: "keystore",
    regex: /\.(keystore|jks)$/i,
    reason: "Java keystore",
  },
  {
    level: "high",
    id: "htpasswd",
    regex: /(?:^|\/)\.?htpasswd$/,
    reason: "htpasswd contains hashed passwords",
  },
  {
    level: "high",
    id: "pgpass",
    regex: /(?:^|\/)\.pgpass$/,
    reason: "PostgreSQL password file",
  },
  {
    level: "high",
    id: "my-cnf",
    regex: /(?:^|\/)\.my\.cnf$/,
    reason: "MySQL config may contain password",
  },

  // STRICT
  {
    level: "strict",
    id: "database-config",
    regex: /(?:^|\/)(?:config\/)?database\.(json|ya?ml)$/i,
    reason: "Database config may contain passwords",
  },
  {
    level: "strict",
    id: "ssh-known-hosts",
    regex: /(?:^|\/)\.ssh\/known_hosts$/,
    reason: "SSH known_hosts reveals infrastructure",
  },
  {
    level: "strict",
    id: "gitconfig",
    regex: /(?:^|\/)\.gitconfig$/,
    reason: ".gitconfig may contain credentials",
  },
  {
    level: "strict",
    id: "curlrc",
    regex: /(?:^|\/)\.curlrc$/,
    reason: ".curlrc may contain auth",
  },
];

// Bash patterns that expose or exfiltrate secrets
const BASH_PATTERNS = [
  // CRITICAL
  {
    level: "critical",
    id: "cat-env",
    regex: /\b(cat|less|head|tail|more|bat|view)\s+[^|;]*\.env\b/i,
    reason: "Reading .env file exposes secrets",
  },
  {
    level: "critical",
    id: "cat-ssh-key",
    regex:
      /\b(cat|less|head|tail|more|bat)\s+[^|;]*(id_rsa|id_ed25519|id_ecdsa|id_dsa|\.pem|\.key)\b/i,
    reason: "Reading private key",
  },
  {
    level: "critical",
    id: "cat-aws-creds",
    regex: /\b(cat|less|head|tail|more)\s+[^|;]*\.aws\/credentials/i,
    reason: "Reading AWS credentials",
  },

  // HIGH - Environment exposure
  {
    level: "high",
    id: "env-dump",
    regex: /\bprintenv\b|(?:^|[;&|]\s*)env\s*(?:$|[;&|])/,
    reason: "Environment dump may expose secrets",
  },
  {
    level: "high",
    id: "echo-secret-var",
    regex:
      /\becho\b[^;|&]*\$\{?[A-Za-z_]*(?:SECRET|KEY|TOKEN|PASSWORD|PASSW|CREDENTIAL|API_KEY|AUTH|PRIVATE)[A-Za-z_]*\}?/i,
    reason: "Echoing secret variable",
  },
  {
    level: "high",
    id: "printf-secret-var",
    regex:
      /\bprintf\b[^;|&]*\$\{?[A-Za-z_]*(?:SECRET|KEY|TOKEN|PASSWORD|CREDENTIAL|API_KEY|AUTH|PRIVATE)[A-Za-z_]*\}?/i,
    reason: "Printing secret variable",
  },
  {
    level: "high",
    id: "cat-secrets-file",
    regex:
      /\b(cat|less|head|tail|more)\s+[^|;]*(credentials?|secrets?)\.(json|ya?ml|toml)/i,
    reason: "Reading secrets file",
  },
  {
    level: "high",
    id: "cat-netrc",
    regex: /\b(cat|less|head|tail|more)\s+[^|;]*\.netrc/i,
    reason: "Reading .netrc credentials",
  },
  {
    level: "high",
    id: "source-env",
    regex:
      /\bsource\s+[^|;]*\.env\b|(?:^|[;&|]\s*)\.\s+[^|;]*\.env\b|^\.\s+[^|;]*\.env\b/i,
    reason: "Sourcing .env loads secrets",
  },
  {
    level: "high",
    id: "export-cat-env",
    regex: /export\s+.*\$\(cat\s+[^)]*\.env/i,
    reason: "Exporting secrets from .env",
  },

  // HIGH - Exfiltration
  {
    level: "high",
    id: "curl-upload-env",
    regex:
      /\bcurl\b[^;|&]*(-d\s*@|-F\s*[^=]+=@|--data[^=]*=@)[^;|&]*(\.env|credentials|secrets|id_rsa|\.pem|\.key)/i,
    reason: "Uploading secrets via curl",
  },
  {
    level: "high",
    id: "curl-post-secrets",
    regex: /\bcurl\b[^;|&]*-X\s*POST[^;|&]*[^;|&]*(\.env|credentials|secrets)/i,
    reason: "POSTing secrets via curl",
  },
  {
    level: "high",
    id: "wget-post-secrets",
    regex: /\bwget\b[^;|&]*--post-file[^;|&]*(\.env|credentials|secrets)/i,
    reason: "POSTing secrets via wget",
  },
  {
    level: "high",
    id: "scp-secrets",
    regex:
      /\bscp\b[^;|&]*(\.env|credentials|secrets|id_rsa|\.pem|\.key)[^;|&]+:/i,
    reason: "Copying secrets via scp",
  },
  {
    level: "high",
    id: "rsync-secrets",
    regex: /\brsync\b[^;|&]*(\.env|credentials|secrets|id_rsa)[^;|&]+:/i,
    reason: "Syncing secrets via rsync",
  },
  {
    level: "high",
    id: "nc-secrets",
    regex: /\bnc\b[^;|&]*<[^;|&]*(\.env|credentials|secrets|id_rsa)/i,
    reason: "Exfiltrating secrets via netcat",
  },

  // HIGH - Copy/move/delete secrets
  {
    level: "high",
    id: "cp-env",
    regex: /\bcp\b[^;|&]*\.env\b/i,
    reason: "Copying .env file",
  },
  {
    level: "high",
    id: "cp-ssh-key",
    regex: /\bcp\b[^;|&]*(id_rsa|id_ed25519|\.pem|\.key)\b/i,
    reason: "Copying private key",
  },
  {
    level: "high",
    id: "mv-env",
    regex: /\bmv\b[^;|&]*\.env\b/i,
    reason: "Moving .env file",
  },
  {
    level: "high",
    id: "rm-ssh-key",
    regex: /\brm\b[^;|&]*(id_rsa|id_ed25519|id_ecdsa|authorized_keys)/i,
    reason: "Deleting SSH key",
  },
  {
    level: "high",
    id: "rm-env",
    regex: /\brm\b.*\.env\b/i,
    reason: "Deleting .env file",
  },
  {
    level: "high",
    id: "rm-aws-creds",
    regex: /\brm\b[^;|&]*\.aws\/credentials/i,
    reason: "Deleting AWS credentials",
  },
  {
    level: "high",
    id: "truncate-secrets",
    regex: /\btruncate\b.*\.(env|pem|key)\b|(?:^|[;&|]\s*)>\s*\.env\b/i,
    reason: "Truncating secrets file",
  },

  // HIGH - Process environ
  {
    level: "high",
    id: "proc-environ",
    regex: /\/proc\/[^/]*\/environ/,
    reason: "Reading process environment",
  },
  {
    level: "high",
    id: "xargs-cat-env",
    regex: /xargs.*cat|\.env.*xargs/i,
    reason: "Reading .env via xargs",
  },
  {
    level: "high",
    id: "find-exec-cat-env",
    regex: /find\b.*\.env.*-exec|find\b.*-exec.*(cat|less)/i,
    reason: "Finding and reading .env files",
  },

  // STRICT
  {
    level: "strict",
    id: "grep-password",
    regex:
      /\bgrep\b[^|;]*(-r|--recursive)[^|;]*(password|secret|api.?key|token|credential)/i,
    reason: "Grep for secrets may expose them",
  },
  {
    level: "strict",
    id: "base64-secrets",
    regex: /\bbase64\b[^|;]*(\.env|credentials|secrets|id_rsa|\.pem)/i,
    reason: "Base64 encoding secrets",
  },
];

const LEVELS = { critical: 1, high: 2, strict: 3 };
const EMOJIS = { critical: "🔐", high: "🛡️", strict: "⚠️" };
const LOG_DIR = path.join(os.homedir(), ".claude", "hooks-logs");

function log(data) {
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
    const file = path.join(
      LOG_DIR,
      `${new Date().toISOString().slice(0, 10)}.jsonl`,
    );
    fs.appendFileSync(
      file,
      JSON.stringify({
        ts: new Date().toISOString(),
        hook: "protect-secrets",
        ...data,
      }) + "\n",
    );
  } catch {}
}

function isAllowlisted(filePath) {
  return filePath && ALLOWLIST.some((p) => p.test(filePath));
}

function checkFilePath(filePath, safetyLevel = SAFETY_LEVEL) {
  if (!filePath || isAllowlisted(filePath))
    return { blocked: false, pattern: null };
  const threshold = LEVELS[safetyLevel] || 2;
  for (const p of SENSITIVE_FILES) {
    if (LEVELS[p.level] <= threshold && p.regex.test(filePath)) {
      return { blocked: true, pattern: p };
    }
  }
  return { blocked: false, pattern: null };
}

// A heredoc body fed to cat/tee is file content (a doc, a commit or PR message),
// not a command. Scanning it blocked writing a ticket that merely quotes a .env
// read (ENGR-6882). The body is skipped only when it provably cannot run; any
// doubt keeps it scanned:
// - the delimiter is quoted, so the body gets no $(...) / `...` expansion;
// - it is a real heredoc (`<<`, not a `<<<` here-string) and its terminator is found;
// - nothing on the opener line pipes it on, uses backticks or names an interpreter;
// - if it sits inside $(...), that substitution is a double-quoted argument after
//   a command word (`git commit -m "$(cat <<'EOF'`), never the command itself.
const HEREDOC_OPENER =
  /(?<!<)<<-?(?!<)\s*(?:'([^'\n]+)'|"([^"\n]+)")/;
const HEREDOC_DATA_SINKS = new Set(["cat", "tee"]);
const HEREDOC_EXECUTORS =
  /\b(bash|sh|zsh|dash|ksh|fish|eval|source|exec|xargs|ssh|python\d*(\.\d+)?|node|ruby|perl|osascript)\b/;
const QUOTED_SUBSTITUTION_ARGUMENT = /^\s*\S+\s+(?:\S+\s+)*[^\s"]*"$/;

function substitutionIsQuotedArgument(beforeSubstitution) {
  const segment = beforeSubstitution.split(/[;&|]/).pop();
  return QUOTED_SUBSTITUTION_ARGUMENT.test(segment);
}

const countOf = (text, char) => text.split(char).length - 1;

// The opener must be plain shell syntax on a single logical line. A `#` before it may
// make it a comment, unbalanced quotes may make it quoted text, and a trailing
// backslash continues the command (a `| sh` could follow). Any of these → not sure → scan.
function openerIsLexicallyPlain(line, beforeOpener, substitutionStart) {
  if (beforeOpener.includes("#") || /\\\s*$/.test(line)) return false;
  if (substitutionStart === -1) {
    return countOf(beforeOpener, "'") % 2 === 0 && countOf(beforeOpener, '"') % 2 === 0;
  }
  const outside = beforeOpener.slice(0, substitutionStart);
  const inside = beforeOpener.slice(substitutionStart + 2);
  const quotesInside = countOf(inside, "'") + countOf(inside, '"');
  return countOf(outside, "'") % 2 === 0 && countOf(outside, '"') % 2 === 1 && quotesInside === 0;
}

function heredocIsData(line, opener) {
  const afterOpener = line.slice(opener.index + opener[0].length);
  if (HEREDOC_EXECUTORS.test(line) || line.includes("`") || afterOpener.includes("|")) {
    return false;
  }
  const beforeOpener = line.slice(0, opener.index);
  const substitutionStart = beforeOpener.lastIndexOf("$(");
  if (!openerIsLexicallyPlain(line, beforeOpener, substitutionStart)) return false;
  const sinkSegment =
    substitutionStart === -1
      ? beforeOpener.split(/[;&|]/).pop()
      : beforeOpener.slice(substitutionStart + 2);
  if (substitutionStart !== -1 && !substitutionIsQuotedArgument(beforeOpener.slice(0, substitutionStart))) {
    return false;
  }
  if (sinkSegment.includes("(")) return false;
  const sinkCommand = sinkSegment.trim().split(/\s+/)[0];
  return HEREDOC_DATA_SINKS.has(sinkCommand);
}

function stripDataHeredocBodies(cmd) {
  const kept = [];
  let terminator = null;
  let skipped = [];
  for (const line of cmd.split("\n")) {
    if (terminator !== null) {
      if (line.trim() === terminator) {
        terminator = null;
        skipped = [];
        kept.push(line);
      } else {
        skipped.push(line);
      }
      continue;
    }
    kept.push(line);
    const opener = HEREDOC_OPENER.exec(line);
    if (opener && heredocIsData(line, opener)) terminator = opener[1] ?? opener[2];
  }
  // Never found the terminator: not confident it was a heredoc, so scan it all.
  if (terminator !== null) kept.push(...skipped);
  return kept.join("\n");
}

function checkBashCommand(cmd, safetyLevel = SAFETY_LEVEL) {
  if (!cmd) return { blocked: false, pattern: null };
  for (const allow of ALLOWLIST) {
    if (allow.test(cmd)) return { blocked: false, pattern: null };
  }
  const threshold = LEVELS[safetyLevel] || 2;
  const scanned = stripDataHeredocBodies(cmd);
  for (const p of BASH_PATTERNS) {
    if (LEVELS[p.level] <= threshold && p.regex.test(scanned)) {
      return { blocked: true, pattern: p };
    }
  }
  return { blocked: false, pattern: null };
}

function check(toolName, toolInput, safetyLevel = SAFETY_LEVEL) {
  if (["Read", "Edit", "Write"].includes(toolName)) {
    return checkFilePath(toolInput?.file_path, safetyLevel);
  }
  if (toolName === "Bash") {
    return checkBashCommand(toolInput?.command, safetyLevel);
  }
  return { blocked: false, pattern: null };
}

async function main() {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;

  try {
    const data = JSON.parse(input);
    const { tool_name, tool_input, session_id, cwd, permission_mode } = data;

    if (!["Read", "Edit", "Write", "Bash"].includes(tool_name)) {
      return console.log("{}");
    }

    const result = check(tool_name, tool_input);

    if (result.blocked) {
      const p = result.pattern;
      const target =
        tool_input?.file_path || tool_input?.command?.slice(0, 100);
      log({
        level: "BLOCKED",
        id: p.id,
        priority: p.level,
        tool: tool_name,
        target,
        session_id,
        cwd,
        permission_mode,
      });

      const action = {
        Read: "read",
        Edit: "modify",
        Write: "write to",
        Bash: "execute",
      }[tool_name];
      return console.log(
        JSON.stringify({
          hookSpecificOutput: {
            hookEventName: "PreToolUse",
            permissionDecision: "deny",
            permissionDecisionReason: `${EMOJIS[p.level]} [${p.id}] Cannot ${action}: ${p.reason}`,
          },
        }),
      );
    }
    console.log("{}");
  } catch (e) {
    log({ level: "ERROR", error: e.message });
    console.log("{}");
  }
}

if (require.main === module) {
  main();
} else {
  module.exports = {
    SENSITIVE_FILES,
    BASH_PATTERNS,
    ALLOWLIST,
    LEVELS,
    SAFETY_LEVEL,
    check,
    checkFilePath,
    checkBashCommand,
    stripDataHeredocBodies,
    isAllowlisted,
  };
}
