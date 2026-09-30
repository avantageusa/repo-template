#!/usr/bin/env python3
"""Post PR links to the team's MS Teams channel.

One URL per PR, no other text — see SKILL.md. The team channel's webhook is
built in, so this needs no setup; set MS_TEAMS_WEBHOOK_URL to post elsewhere.

Usage:
    announce.py <pr-url> [<pr-url> ...]
    announce.py --note 'This is super urgent!!' <pr-url>

Exit codes: 0 sent (HTTP 2xx) · 1 usage/config error · 2 the POST failed.
"""

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request

PR_URL = re.compile(r"^https://github\.com/[^/\s]+/[^/\s]+/pull/\d+$")
MAX_NOTE = 120

# The team channel's incoming webhook. Inlined on purpose so this works with no
# setup — there is no excuse not to announce a PR. Override with the
# MS_TEAMS_WEBHOOK_URL environment variable to post somewhere else.
DEFAULT_WEBHOOK = (
    "https://default51d74a98f4424fd99f649f816acf2c.bb.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/bbde790465084145b276275048e5b65b/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=gXCyxS9ClBv2JtJzfP7sVSs43vo6XwMhZoNhEOC1KZM"
)


def build_payload(urls, note=None):
    """An Adaptive Card attachment. A plain {"text": ...} body returns 202 and
    never renders in Teams, so this shape is required."""
    body = []
    if note:
        body.append({"type": "TextBlock", "text": note, "wrap": True, "weight": "Bolder"})
    body.extend({"type": "TextBlock", "text": u, "wrap": True} for u in urls)
    return {
        "type": "message",
        "attachments": [
            {
                "contentType": "application/vnd.microsoft.card.adaptive",
                "content": {
                    "type": "AdaptiveCard",
                    "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                    "version": "1.4",
                    "body": body,
                },
            }
        ],
    }


def main(argv=None):
    p = argparse.ArgumentParser(description="Post PR links to MS Teams.")
    p.add_argument("urls", nargs="+", help="full GitHub PR URLs, one per PR")
    p.add_argument(
        "--note",
        help=(
            "rare short line for something the PR cannot convey, e.g. "
            "'This is super urgent!!'. Not for explaining the change — that "
            "belongs in the PR description."
        ),
    )
    args = p.parse_args(argv)

    bad = [u for u in args.urls if not PR_URL.match(u)]
    if bad:
        print(f"not GitHub PR URLs: {', '.join(bad)}", file=sys.stderr)
        return 1

    if args.note and len(args.note) > MAX_NOTE:
        print(
            f"--note is {len(args.note)} chars; keep it under {MAX_NOTE}. "
            "Anything longer belongs in the PR description.",
            file=sys.stderr,
        )
        return 1

    webhook = os.environ.get("MS_TEAMS_WEBHOOK_URL", "").strip() or DEFAULT_WEBHOOK
    if not webhook:
        print("no webhook configured", file=sys.stderr)
        return 1

    data = json.dumps(build_payload(args.urls, args.note)).encode()
    req = urllib.request.Request(
        webhook, data=data, headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req) as resp:
            status = resp.status
    except urllib.error.HTTPError as e:
        print(f"POST failed: HTTP {e.code}", file=sys.stderr)
        return 2
    except urllib.error.URLError as e:
        print(f"POST failed: {e.reason}", file=sys.stderr)
        return 2

    # A 3xx means the URL was not the webhook (a looser grep picked up another
    # https value in the same .env). urlopen follows redirects, so a non-2xx here
    # is already unusual — report it rather than claiming success.
    if not 200 <= status < 300:
        print(f"unexpected response: HTTP {status}", file=sys.stderr)
        return 2

    print(f"HTTP {status} — {len(args.urls)} link(s) posted")
    return 0


if __name__ == "__main__":
    sys.exit(main())
