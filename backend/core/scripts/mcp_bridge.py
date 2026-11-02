import os
import sys
import urllib.error
import urllib.request

target = os.environ.get("CCONNECT_MCP_URL", "")
headers = {"Content-Type": "application/json", "Accept": "application/json, text/event-stream"}

for line in sys.stdin.buffer:
    body = line.strip()
    if not body or not target:
        continue
    request = urllib.request.Request(target, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=300) as response:
            answer = response.read().strip()
    except urllib.error.HTTPError as error:
        answer = error.read().strip()
    except OSError:
        continue
    if answer:
        sys.stdout.buffer.write(answer + b"\n")
        sys.stdout.buffer.flush()
