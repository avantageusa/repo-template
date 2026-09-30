#!/usr/bin/env node
/**
 * PreToolUse companion to notify-permission.js.
 * The Notification event's permission_prompt/idle_prompt matchers don't fire in
 * the VSCode extension (anthropics/claude-code#31285, #16114), so this reuses
 * notify-permission.js's Slack sender on PreToolUse instead: AskUserQuestion /
 * ExitPlanMode prompts, and risky Bash commands (mirrors the sound-hook filter
 * in settings.local.json).
 *
 * Setup in .claude/settings.local.json:
 * {
 *   "hooks": {
 *     "PreToolUse": [
 *       { "matcher": "AskUserQuestion|ExitPlanMode", "hooks": [{ "type": "command", "command": "node ~/.claude/hooks/notify-permission-pretooluse.js" }] },
 *       { "matcher": "Bash", "hooks": [{ "type": "command", "command": "node ~/.claude/hooks/notify-permission-pretooluse.js" }] }
 *     ]
 *   }
 * }
 *
 * Environment: CCH_SLA_WEBHOOK (Slack webhook URL)
 */

const path = require('path');
const { sendSlack } = require(path.join(__dirname, 'notify-permission.js'));

const RISKY_BASH_PATTERN = /\brm\s|sudo|git push|reset --hard|git clean|chmod|chown|\bmv\s|curl|wget|npm install|npm uninstall|yarn add|yarn remove|--force/;

function describeMessage(toolName, toolInput) {
  if (toolName === 'AskUserQuestion') return 'Claude is asking a multiple-choice question';
  if (toolName === 'ExitPlanMode') return 'Claude is requesting plan approval';
  if (toolName === 'Bash') return `Claude wants to run a risky command: ${toolInput?.command || ''}`;
  return null;
}

async function main() {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;

  try {
    const data = JSON.parse(input);
    const { tool_name, tool_input, session_id, cwd } = data;

    if (!['AskUserQuestion', 'ExitPlanMode', 'Bash'].includes(tool_name)) {
      return console.log('{}');
    }
    if (tool_name === 'Bash' && !RISKY_BASH_PATTERN.test(tool_input?.command || '')) {
      return console.log('{}');
    }

    const message = describeMessage(tool_name, tool_input);
    const type = tool_name === 'Bash' ? 'permission_prompt' : 'elicitation_dialog';
    await sendSlack({ message, cwd, session_id }, type);
    console.log('{}');
  } catch {
    console.log('{}');
  }
}

main();
