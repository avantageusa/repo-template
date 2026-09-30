---
name: announce-pr
description: >
  Announce a pull request to the team's MS Teams channel. Use after opening a PR —
  including from the jira-triage auto-PR flow — or when asked to "announce it",
  "post the PR", "tell the team", "put it in the channel". Posts the PR URL and
  nothing else.
---

# Announce a PR to Teams

## The rule

**One URL per PR. No other text.**

The channel is a list of links, not a place to explain work. Everything a reader
needs — what changed, why, testing, risk — is already in the PR description, and
that is where it stays current. Text pasted into a chat message goes stale the
moment the PR is updated, and it is read by more people, with less context, than
the PR itself.

Two PRs means two URLs. Ten PRs means ten URLs. Never a summary of them.

### The only exception

A short line is allowed when it carries information that **cannot be gleaned from
the PR** and that the channel genuinely needs.

Allowed:

> This is super urgent!!

Not allowed — this belongs in the PR description, not the channel:

> ENGR-6606 deviates from its ticket. Polling is not removed outright: the hub is
> behind `use-competition-hub-ws`, which defaults to false, so deleting the poll
> would leave the contests page with no refresh trigger wherever that flag is off.
> Polling stays as the fallback and the GrowthBook fields are deprecated rather
> than deleted — please sanity-check that reading.

If you catch yourself explaining a decision, a trade-off, a deviation from the
ticket, or asking for a specific review focus — **edit the PR description instead**
and post the bare URL. The reviewer opens the PR either way.

Test before adding a line: *would this sentence be wrong or missing if someone only
read the PR?* If no, drop it.

## Sending

No setup, no environment variable, no excuse to skip it:

```sh
python3 .claude/skills/announce-pr/announce.py https://github.com/<org>/<repo>/pull/<n>
```

Several PRs — pass them all, one message, one line each:

```sh
python3 .claude/skills/announce-pr/announce.py <url1> <url2> <url3>
```

With the rare urgent note:

```sh
python3 .claude/skills/announce-pr/announce.py --note 'This is super urgent!!' <url>
```

## The webhook

The team channel's incoming webhook is **built into `announce.py`** (`DEFAULT_WEBHOOK`),
so announcing works out of the box in any repo the package syncs into. Set
`MS_TEAMS_WEBHOOK_URL` only to post somewhere else — it overrides the default.

It is a post-only endpoint to one channel: it grants no read access and carries no
account data. Do not print it into logs, Jira comments or PR bodies for tidiness'
sake, but there is nothing to work around here — just run the script.

## Payload shape — this part is not optional

Teams only renders **Adaptive Card attachments**. A plain `{"text": "..."}` body is
accepted with **HTTP 202 and never appears in the channel.** `announce.py` sends the
correct shape; if you ever hand-roll a post, it must be:

```json
{
  "type": "message",
  "attachments": [{
    "contentType": "application/vnd.microsoft.card.adaptive",
    "content": {
      "type": "AdaptiveCard",
      "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
      "version": "1.4",
      "body": [{ "type": "TextBlock", "text": "<pr url>", "wrap": true }]
    }
  }]
}
```

## Verifying

**202 does not mean delivered.** It means the endpoint accepted the HTTP request.
The only proof is the message appearing in the channel.

So: never report "announced" on the strength of a 202 alone when the payload shape
is anything other than the one above. If someone says the announcement did not
arrive, assume the payload, not the network.

## When it cannot be sent

If the POST fails (non-2xx, or a network error), say so plainly and give the command
for a human to retry. Do not improvise another channel, and do not quietly skip the
announcement — an unannounced PR is one nobody reviews.
