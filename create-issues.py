#!/usr/bin/env python3
r"""
Create the prepared Asentum bug reports as GitHub issues.

Usage:
    python create-issues.py <github_token>

Reads issues/*.md, pulls the "**Title:** `...`" line out as the issue
title, posts the rest as the body, to the repo the file is named for.

Idempotent-ish: skips any issue whose title already exists in the target
repo, so a re-run will not double-post.
"""
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

REPO_MAP = {
    "asentum-connect-1-view-endpoint.md": "asentum-network/asentum-connect",
    "asentum-connect-2-faucet-403.md": "asentum-network/asentum-connect",
    "asentum-connect-3-sdk-api-mismatch.md": "asentum-network/asentum-connect",
    "asentum-explorer-1-contract-hash-rpc.md": "asentum-network/asentum-explorer",
    "asentum-explorer-2-source-hash-mismatch.md": "asentum-network/asentum-explorer",
}

ISSUES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "issues")
API = "https://api.github.com"
UA = "asentum-guestbook-reporter"


def request(method, url, token, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("X-GitHub-Api-Version", "2022-11-28")
    req.add_header("User-Agent", UA)
    if data:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            body = resp.read().decode("utf-8", "replace")
            return resp.status, json.loads(body) if body else None
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")
        try:
            return e.code, json.loads(body)
        except json.JSONDecodeError:
            return e.code, {"raw": body[:400]}
    except urllib.error.URLError as e:
        return 0, {"error": str(e)}


def parse_issue_file(path):
    with open(path, "r", encoding="utf-8") as fh:
        text = fh.read()

    m = re.search(r"^\*\*Title:\*\*\s*`(.+?)`\s*$", text, re.MULTILINE)
    if not m:
        raise SystemExit(f"no **Title:** line found in {path}")
    title = m.group(1).strip()

    # Body = everything except the bold summary line and the Title line.
    lines = text.split("\n")
    body_lines, skip_next_blank = [], True
    for line in lines:
        if line.startswith("**Title:**"):
            skip_next_blank = True
            continue
        if skip_next_blank and line.strip() == "":
            skip_next_blank = False
            continue
        skip_next_blank = False
        body_lines.append(line)

    body = "\n".join(body_lines).strip()
    # Drop the leading bold summary line (it is redundant with the title).
    body = re.sub(r"^\*\*[^\n]*\*\*\s*\n+", "", body)
    return title, body


def existing_titles(repo, token):
    titles = set()
    for page in range(1, 6):
        status, data = request(
            "GET", f"{API}/repos/{repo}/issues?state=all&per_page=100&page={page}", token
        )
        if status != 200 or not isinstance(data, list):
            break
        if not data:
            break
        for it in data:
            if "title" in it:
                titles.add(it["title"].strip())
        time.sleep(0.2)
    return titles


def main():
    if len(sys.argv) < 2:
        raise SystemExit("usage: python create-issues.py <github_token>")
    token = sys.argv[1].strip()

    status, who = request("GET", f"{API}/user", token)
    if status != 200:
        print(f"! token rejected: {status} {who}")
        return 1
    print(f"authenticated as {who.get('login')} ({who.get('id')})\n")

    seen = {}
    created = skipped = failed = 0

    for fname, repo in REPO_MAP.items():
        path = os.path.join(ISSUES_DIR, fname)
        title, body = parse_issue_file(path)

        if repo not in seen:
            seen[repo] = existing_titles(repo, token)
        if title in seen[repo]:
            print(f"- SKIP (exists) {repo} :: {title}")
            skipped += 1
            continue

        status, data = request(
            "POST", f"{API}/repos/{repo}/issues", token, {"title": title, "body": body}
        )
        if status == 201:
            print(f"+ CREATED {repo}#{data['number']}  {data['html_url']}")
            print(f"    {title}")
            seen[repo].add(title)
            created += 1
        else:
            print(f"! FAILED {repo} :: {title}")
            print(f"    {status} {json.dumps(data)[:300]}")
            failed += 1
        time.sleep(1.5)  # be polite to the API

    print(f"\ncreated={created} skipped={skipped} failed={failed}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
