# Thesis Research Dashboard

A Streamlit dashboard for exploring participant telemetry collected by the
extension during user studies. Reads JSONL files from
`~/.continue-research-logs/` and lets you filter by participant and session.

## Quick start

```bash
./research/run-dashboard.sh
```

This installs Streamlit + Plotly if needed, then launches the dashboard in
your browser at http://localhost:8501.

## What you'll see

**Sidebar** — pick a participant and a specific session (or "all sessions").
Refresh button reloads the latest log files.

**Tabs:**

- **📈 Overview** — event distribution by category, activity timeline, top
  20 event types
- **🎤 Voice** — transcripts, intent classification (local vs LLM), latency
  distribution, full transcript history
- **👁 Gaze** — dwell triggers, code blocks selected, calibration changes,
  estimated tracking time, gaze position heatmap
- **🤖 AI** — overview request/receive counts, explain-button breakdown
  (api/concept/usage), inline comments inserted
- **▶️ Runs** — Python file execution history, success rate, average
  duration
- **✂️ Selections** — selection method breakdown (manual / voice / gaze)
- **📂 Files** — files opened, saved, switched
- **📄 Raw events** — filterable table of every event, with CSV download

## Data format

Each session is a JSONL file at:

```
~/.continue-research-logs/<Participant>_<YYYY-MM-DD_HH-MM-SS>_<id>.jsonl
```

One event per line, with this envelope:

```json
{
  "ts": "2026-04-10T10:23:45.123Z",
  "session_id": "abc-123",
  "participant_id": "Raphael Fakhri",
  "category": "voice",
  "event": "intent_classified",
  "data": {
    "transcript": "select scores data",
    "action": "select_function",
    "path": "local",
    "classification_ms": 47
  }
}
```

## Privacy

The extension never logs raw code content. Selections are stored as `length`
plus a 16-character SHA-256 hash (`content_sha256`). Voice transcripts are
logged in full because they're required for analysis.

## Manual analysis with pandas

If you'd rather work in a notebook:

```python
import pandas as pd
df = pd.read_json("~/.continue-research-logs/Raphael_Fakhri_*.jsonl", lines=True)
voice = df[df.category == "voice"]
local_rate = voice[voice.event == "intent_classified"].data.apply(
    lambda d: d.get("path") == "local"
).mean()
```
