import json
import os
import sys
import urllib.request
import webbrowser

url = sys.argv[1] if len(sys.argv) > 1 else ""
target = os.environ.pop("CCONNECT_BROWSE_URL", "")
token = os.environ.pop("CCONNECT_BROWSE_TOKEN", "")
os.environ.pop("BROWSER", None)

if url and target:
    request = urllib.request.Request(
        target,
        data=json.dumps({"url": url, "token": token}).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    try:
        urllib.request.urlopen(request, timeout=5).close()
    except OSError:
        pass

if url:
    webbrowser.open(url)
