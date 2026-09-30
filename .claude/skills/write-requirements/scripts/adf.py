#!/usr/bin/env python3
"""Convert constrained markdown into Atlassian Document Format (ADF) JSON.

Usage:
    python3 adf.py body.md > body.adf.json
    cat body.md | python3 adf.py > body.adf.json

The output is what `acli jira workitem create --description-file` and the
Atlassian MCP `createJiraIssue` / `editJiraIssue` `description` field accept.

Supported input (see write-requirements/reference.md section 2):

    ::: info | success | note | warning | error      panel fences
    :::                                              panel close
    # / ## / ###                                     headings
    - item                                           bullet list
    1. item                                          ordered list
    | a | b |  with a |---|---| separator            table (first row = header)
    **bold**  *italic*  ~~strike~~  `code`           inline marks
    [text](url)                                      link
    ENGR-1234 / PO-1234 / DEPLOY-12                  auto-linked issue keys

Stdlib only. Nested lists and images are deliberately unsupported.
"""

import json
import re
import sys

JIRA_BROWSE_URL = "https://avantageusa.atlassian.net/browse/"
PANEL_TYPES = {"info", "success", "note", "warning", "error"}
ISSUE_KEY_PATTERN = r"\b[A-Z][A-Z0-9]+-\d+\b"

INLINE_TOKEN = re.compile(
    r"(\[(?P<link_text>[^\]]+)\]\((?P<link_url>[^)\s]+)\))"
    r"|(`(?P<code>[^`]+)`)"
    r"|(\*\*(?P<bold>[^*]+)\*\*)"
    r"|(~~(?P<strike>[^~]+)~~)"
    r"|(\*(?P<italic>[^*]+)\*)"
    r"|(?P<key>" + ISSUE_KEY_PATTERN + r")"
)

HEADING_PATTERN = re.compile(r"^(#{1,3})\s+(.*)$")
BULLET_PATTERN = re.compile(r"^-\s+(.*)$")
ORDERED_PATTERN = re.compile(r"^\d+[.)]\s+(.*)$")
TABLE_SEPARATOR_PATTERN = re.compile(r"^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?$")
PANEL_OPEN_PATTERN = re.compile(r"^:::\s*(\w+)\s*$")
PANEL_CLOSE = ":::"


def text_node(text, marks=None):
    node = {"type": "text", "text": text}
    if marks:
        node["marks"] = marks
    return node


def link_mark(url):
    return {"type": "link", "attrs": {"href": url}}


def parse_inline(raw):
    """Turn one line of inline markdown into a list of ADF text nodes."""
    nodes = []
    position = 0
    for match in INLINE_TOKEN.finditer(raw):
        if match.start() > position:
            nodes.append(text_node(raw[position:match.start()]))
        if match.group("link_text") is not None:
            nodes.append(text_node(match.group("link_text"), [link_mark(match.group("link_url"))]))
        elif match.group("code") is not None:
            nodes.append(text_node(match.group("code"), [{"type": "code"}]))
        elif match.group("bold") is not None:
            nodes.extend(with_mark(parse_inline(match.group("bold")), {"type": "strong"}))
        elif match.group("strike") is not None:
            nodes.extend(with_mark(parse_inline(match.group("strike")), {"type": "strike"}))
        elif match.group("italic") is not None:
            nodes.extend(with_mark(parse_inline(match.group("italic")), {"type": "em"}))
        elif match.group("key") is not None:
            key = match.group("key")
            nodes.append(text_node(key, [link_mark(JIRA_BROWSE_URL + key)]))
        position = match.end()
    if position < len(raw):
        nodes.append(text_node(raw[position:]))
    return nodes


def has_code_mark(node):
    return any(mark["type"] == "code" for mark in node.get("marks", []))


def with_mark(nodes, mark):
    """Add a mark to every text node, keeping marks already present.

    Code-marked text is left as it is: ADF rejects `code` combined with any mark
    other than `link`, so `**bold with `code` inside**` would make Jira refuse the
    whole body ("not valid Atlassian Document Format").
    """
    marked = []
    for node in nodes:
        if has_code_mark(node):
            marked.append(node)
            continue
        copy = dict(node)
        copy["marks"] = list(node.get("marks", [])) + [mark]
        marked.append(copy)
    return marked


def paragraph(raw):
    return {"type": "paragraph", "content": parse_inline(raw)}


def heading(level, raw):
    return {"type": "heading", "attrs": {"level": level}, "content": parse_inline(raw)}


def list_item(raw):
    return {"type": "listItem", "content": [paragraph(raw)]}


def table_cell(raw, is_header):
    return {
        "type": "tableHeader" if is_header else "tableCell",
        "attrs": {},
        "content": [paragraph(raw)],
    }


def split_table_row(line):
    stripped = line.strip()
    if stripped.startswith("|"):
        stripped = stripped[1:]
    if stripped.endswith("|"):
        stripped = stripped[:-1]
    return [cell.strip() for cell in stripped.split("|")]


def table(rows):
    """rows: list of lists of cell text; the first row is the header."""
    adf_rows = []
    for index, cells in enumerate(rows):
        is_header = index == 0
        adf_rows.append({
            "type": "tableRow",
            "content": [table_cell(cell, is_header) for cell in cells],
        })
    return {
        "type": "table",
        "attrs": {"isNumberColumnEnabled": False, "layout": "default"},
        "content": adf_rows,
    }


def panel(panel_type, content):
    return {"type": "panel", "attrs": {"panelType": panel_type}, "content": content}


class BlockParser:
    """Line-oriented parser. Collects blocks into the current container."""

    def __init__(self):
        self.document = []
        self.current_panel = None
        self.list_kind = None
        self.list_items = []
        self.table_rows = []
        self.in_table = False

    def container(self):
        if self.current_panel is not None:
            return self.current_panel["content"]
        return self.document

    def flush_list(self):
        if not self.list_items:
            return
        node_type = "orderedList" if self.list_kind == "ordered" else "bulletList"
        self.container().append({"type": node_type, "content": self.list_items})
        self.list_items = []
        self.list_kind = None

    def flush_table(self):
        if not self.in_table:
            return
        if self.table_rows:
            self.container().append(table(self.table_rows))
        self.table_rows = []
        self.in_table = False

    def flush_all(self):
        self.flush_list()
        self.flush_table()

    def open_panel(self, panel_type):
        self.flush_all()
        if self.current_panel is not None:
            self.close_panel()
        if panel_type not in PANEL_TYPES:
            raise ValueError(
                "unknown panel type '%s' (expected one of %s)" % (panel_type, ", ".join(sorted(PANEL_TYPES)))
            )
        self.current_panel = panel(panel_type, [])

    def close_panel(self):
        self.flush_all()
        if self.current_panel is None:
            return
        if not self.current_panel["content"]:
            self.current_panel["content"].append(paragraph(""))
        self.document.append(self.current_panel)
        self.current_panel = None

    def feed(self, line):
        stripped = line.rstrip("\n")

        panel_open = PANEL_OPEN_PATTERN.match(stripped)
        if panel_open:
            self.open_panel(panel_open.group(1).lower())
            return
        if stripped.strip() == PANEL_CLOSE:
            self.close_panel()
            return

        if stripped.strip() == "":
            self.flush_all()
            return

        if stripped.lstrip().startswith("|"):
            if TABLE_SEPARATOR_PATTERN.match(stripped.strip()):
                return
            self.flush_list()
            self.in_table = True
            self.table_rows.append(split_table_row(stripped))
            return
        self.flush_table()

        heading_match = HEADING_PATTERN.match(stripped)
        if heading_match:
            self.flush_list()
            self.container().append(heading(len(heading_match.group(1)), heading_match.group(2).strip()))
            return

        bullet_match = BULLET_PATTERN.match(stripped.strip())
        if bullet_match:
            if self.list_kind != "bullet":
                self.flush_list()
                self.list_kind = "bullet"
            self.list_items.append(list_item(bullet_match.group(1)))
            return

        ordered_match = ORDERED_PATTERN.match(stripped.strip())
        if ordered_match:
            if self.list_kind != "ordered":
                self.flush_list()
                self.list_kind = "ordered"
            self.list_items.append(list_item(ordered_match.group(1)))
            return

        self.flush_list()
        self.container().append(paragraph(stripped.strip()))

    def finish(self):
        self.flush_all()
        if self.current_panel is not None:
            self.close_panel()
        return {"type": "doc", "version": 1, "content": self.document}


def convert(markdown_text):
    parser = BlockParser()
    for line in markdown_text.splitlines():
        parser.feed(line)
    return parser.finish()


def main(argv):
    if len(argv) > 1 and argv[1] not in ("-", ""):
        with open(argv[1], encoding="utf-8") as handle:
            source = handle.read()
    else:
        source = sys.stdin.read()
    try:
        document = convert(source)
    except ValueError as error:
        sys.stderr.write("adf.py: %s\n" % error)
        return 2
    json.dump(document, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
