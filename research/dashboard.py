"""
Thesis research telemetry dashboard.

Reads JSONL session logs from ~/.continue-research-logs/ and presents
per-participant statistics, timelines, and raw event tables.

Run with:
    streamlit run research/dashboard.py
"""

from __future__ import annotations

import json
import os
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any

import pandas as pd
import plotly.express as px
import streamlit as st

LOGS_DIR = Path.home() / ".continue-research-logs"

# ─── Page config ───────────────────────────────────────────────────────
st.set_page_config(
    page_title="Thesis Research Dashboard",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded",
)


# ─── Loaders ───────────────────────────────────────────────────────────
@st.cache_data(ttl=10)
def list_log_files() -> list[Path]:
    """Return all .jsonl files in the logs directory, newest first."""
    if not LOGS_DIR.exists():
        return []
    files = sorted(
        LOGS_DIR.glob("*.jsonl"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    return files


@st.cache_data(ttl=10)
def load_session(file_path_str: str) -> pd.DataFrame:
    """Load one JSONL file into a DataFrame."""
    rows: list[dict[str, Any]] = []
    with open(file_path_str, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    if not rows:
        return pd.DataFrame()
    df = pd.DataFrame(rows)
    df["ts"] = pd.to_datetime(df["ts"], errors="coerce")
    return df


@st.cache_data(ttl=10)
def load_all_sessions() -> pd.DataFrame:
    """Load every session into one DataFrame, with file_name column."""
    all_dfs: list[pd.DataFrame] = []
    for f in list_log_files():
        df = load_session(str(f))
        if df.empty:
            continue
        df["log_file"] = f.name
        df["file_size_kb"] = round(f.stat().st_size / 1024, 1)
        all_dfs.append(df)
    if not all_dfs:
        return pd.DataFrame()
    return pd.concat(all_dfs, ignore_index=True)


def session_summary(df: pd.DataFrame) -> dict[str, Any]:
    """Compute high-level stats for a single session DataFrame."""
    if df.empty:
        return {}
    return {
        "participant": df["participant_id"].iloc[0],
        "session_id": df["session_id"].iloc[0],
        "start": df["ts"].min(),
        "end": df["ts"].max(),
        "duration_min": round(
            (df["ts"].max() - df["ts"].min()).total_seconds() / 60, 1
        ),
        "total_events": len(df),
    }


def safe_get(d: Any, key: str, default: Any = None) -> Any:
    if isinstance(d, dict):
        return d.get(key, default)
    return default


# ─── Sidebar ───────────────────────────────────────────────────────────
st.sidebar.title("📊 Thesis Dashboard")
st.sidebar.caption(f"Logs directory: `{LOGS_DIR}`")

if not LOGS_DIR.exists():
    st.error(
        f"Logs directory does not exist: `{LOGS_DIR}`. "
        "Run a session first to generate data."
    )
    st.stop()

all_files = list_log_files()
if not all_files:
    st.warning("No session log files found yet. Run a session to generate data.")
    st.stop()

all_df = load_all_sessions()

# Build participant → sessions map
participants = sorted(all_df["participant_id"].unique())
selected_participant = st.sidebar.selectbox(
    "Participant",
    options=["— All participants —"] + participants,
    index=0,
)

# Filter to selected participant
if selected_participant == "— All participants —":
    p_df = all_df
    p_files = all_files
else:
    p_df = all_df[all_df["participant_id"] == selected_participant]
    p_files = [f for f in all_files if f.name in p_df["log_file"].unique()]

# Build session selector
sessions = (
    p_df.groupby("log_file")
    .agg(
        participant=("participant_id", "first"),
        start=("ts", "min"),
        end=("ts", "max"),
        events=("ts", "size"),
    )
    .reset_index()
    .sort_values("start", ascending=False)
)

session_options = ["— All sessions for participant —"] + [
    f"{row['log_file']} · {row['events']} events · "
    f"{row['start'].strftime('%Y-%m-%d %H:%M')}"
    for _, row in sessions.iterrows()
]
selected_session_label = st.sidebar.selectbox("Session", options=session_options)

if selected_session_label != "— All sessions for participant —":
    selected_log_file = selected_session_label.split(" · ")[0]
    df = p_df[p_df["log_file"] == selected_log_file].copy()
else:
    df = p_df.copy()

st.sidebar.divider()
st.sidebar.metric("Sessions in view", df["log_file"].nunique())
st.sidebar.metric("Events in view", len(df))
st.sidebar.metric("Participants in view", df["participant_id"].nunique())

if st.sidebar.button("🔄 Refresh data"):
    st.cache_data.clear()
    st.rerun()

# ─── Main page ─────────────────────────────────────────────────────────
st.title("Thesis Research Dashboard")
if selected_participant != "— All participants —":
    st.subheader(f"Participant: **{selected_participant}**")
else:
    st.subheader("All participants")

if df.empty:
    st.info("No events for the selected filter.")
    st.stop()

# ─── Top KPIs ──────────────────────────────────────────────────────────
col1, col2, col3, col4, col5 = st.columns(5)
col1.metric("Total events", f"{len(df):,}")
col2.metric(
    "Sessions",
    f"{df['session_id'].nunique()}",
)
col3.metric("Participants", f"{df['participant_id'].nunique()}")
duration_min = round(
    (df["ts"].max() - df["ts"].min()).total_seconds() / 60, 1
)
col4.metric("Time span (min)", f"{duration_min}")
col5.metric("Categories", f"{df['category'].nunique()}")

st.divider()

# ─── Tabs ──────────────────────────────────────────────────────────────
(
    tab_overview,
    tab_per_task,
    tab_voice,
    tab_gaze,
    tab_ai,
    tab_run,
    tab_select,
    tab_files,
    tab_raw,
) = st.tabs(
    [
        "📈 Overview",
        "🎯 Per-Task",
        "🎤 Voice",
        "👁 Gaze",
        "🤖 AI",
        "▶️ Runs",
        "✂️ Selections",
        "📂 Files",
        "📄 Raw events",
    ]
)

# ── Overview tab ──────────────────────────────────────────────────────
with tab_overview:
    st.subheader("Event distribution by category")
    cat_counts = df["category"].value_counts().reset_index()
    cat_counts.columns = ["category", "count"]
    fig = px.bar(
        cat_counts,
        x="category",
        y="count",
        color="category",
        text="count",
        title=None,
    )
    fig.update_layout(showlegend=False, height=350)
    st.plotly_chart(fig, use_container_width=True)

    st.subheader("Activity timeline")
    df_per_min = df.copy()
    df_per_min["minute"] = df_per_min["ts"].dt.floor("min")
    timeline = (
        df_per_min.groupby(["minute", "category"]).size().reset_index(name="count")
    )
    fig = px.line(
        timeline,
        x="minute",
        y="count",
        color="category",
        markers=True,
        title=None,
    )
    fig.update_layout(height=400)
    st.plotly_chart(fig, use_container_width=True)

    st.subheader("Top 20 event types")
    top_events = (
        df.groupby(["category", "event"])
        .size()
        .reset_index(name="count")
        .sort_values("count", ascending=False)
        .head(20)
    )
    st.dataframe(top_events, use_container_width=True, hide_index=True)


# ── Per-Task tab ──────────────────────────────────────────────────────
def _derive_task(file_path: Any) -> str:
    """Map a full file path to its parent exercise folder name.

    `/.../Exercises/1 - Charts and Plots/code.py` → `1 - Charts and Plots`.
    Falls back to `(other)` for paths outside an exercise folder, and
    `(no file)` for missing paths.
    """
    if not file_path or not isinstance(file_path, str):
        return "(no file)"
    # Strip file:// prefix if present
    p = file_path
    if p.startswith("file://"):
        p = p[len("file://"):]
    parts = p.replace("\\", "/").split("/")
    if len(parts) < 2:
        return "(other)"
    parent = parts[-2]
    # Recognize "N - Name" pattern (exercise folders) or "0 - Start Here"
    import re

    if re.match(r"^\d+\s*-\s*.+", parent):
        return parent
    return parent or "(other)"


with tab_per_task:
    st.subheader("AI interactions per task")
    st.caption(
        "Stacked bar chart of how many times each AI interaction type was "
        "used per exercise (task). Filter the categories to include below."
    )

    # Define interaction types and their friendly labels
    INTERACTIONS = {
        "Overview": ("ai", "overview_requested", None),
        "B-API": ("ai", "explain_clicked", "api"),
        "B-Concept": ("ai", "explain_clicked", "concept"),
        "B-Usage": ("ai", "explain_clicked", "usage"),
        "Prompt": ("ai", "prompt_sent", "prompt"),
        "P-Context": ("ai", "prompt_sent", "prompt_context"),
        "P-Followup": ("ai", "prompt_sent", "prompt_followup"),
    }

    selected_types = st.multiselect(
        "Interaction types to include",
        options=list(INTERACTIONS.keys()),
        default=list(INTERACTIONS.keys()),
    )

    # Build a dataframe with [task, interaction_type, count]
    rows: list[dict[str, Any]] = []
    for label in selected_types:
        category, event, subtype = INTERACTIONS[label]
        subset = df[(df["category"] == category) & (df["event"] == event)].copy()
        if subset.empty:
            continue

        # Filter by sub-type if applicable (explain_clicked / prompt_sent)
        if subtype is not None:
            if event == "explain_clicked":
                subset = subset[
                    subset["data"].apply(lambda d: safe_get(d, "type") == subtype)
                ]
            elif event == "prompt_sent":
                subset = subset[
                    subset["data"].apply(
                        lambda d: safe_get(d, "prompt_type") == subtype
                    )
                ]
        if subset.empty:
            continue

        subset["task"] = subset["data"].apply(
            lambda d: _derive_task(safe_get(d, "file"))
        )
        for task, count in subset["task"].value_counts().items():
            rows.append(
                {"task": task, "interaction": label, "count": int(count)}
            )

    if not rows:
        st.info(
            "No matching AI interactions for the selected types. "
            "Try a wider filter or run a session first."
        )
    else:
        chart_df = pd.DataFrame(rows)

        # Order tasks by leading number for clean X-axis ordering
        def task_sort_key(t: str) -> tuple[int, str]:
            import re

            m = re.match(r"^(\d+)\s*-\s*(.*)", t)
            if m:
                return (int(m.group(1)), m.group(2))
            return (9999, t)

        ordered_tasks = sorted(chart_df["task"].unique(), key=task_sort_key)
        ordered_interactions = [
            i for i in INTERACTIONS.keys() if i in chart_df["interaction"].unique()
        ]

        fig = px.bar(
            chart_df,
            x="task",
            y="count",
            color="interaction",
            text="count",
            category_orders={
                "task": ordered_tasks,
                "interaction": ordered_interactions,
            },
            color_discrete_sequence=px.colors.qualitative.Set2,
        )
        fig.update_layout(
            barmode="stack",
            height=500,
            xaxis_title="Task",
            yaxis_title="Interaction count",
            legend_title="Interaction",
        )
        fig.update_traces(textposition="inside")
        st.plotly_chart(fig, use_container_width=True)

        st.subheader("Per-task table")
        pivot = (
            chart_df.pivot_table(
                index="task",
                columns="interaction",
                values="count",
                fill_value=0,
                aggfunc="sum",
            )
            .reindex(ordered_tasks)
            .reindex(columns=ordered_interactions, fill_value=0)
        )
        pivot["Total"] = pivot.sum(axis=1)
        st.dataframe(pivot, use_container_width=True)

        st.download_button(
            "📥 Download per-task counts as CSV",
            data=pivot.reset_index().to_csv(index=False).encode("utf-8"),
            file_name=f"per_task_interactions_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
            mime="text/csv",
        )


# ── Voice tab ─────────────────────────────────────────────────────────
with tab_voice:
    voice = df[df["category"] == "voice"].copy()
    if voice.empty:
        st.info("No voice events.")
    else:
        c1, c2, c3, c4 = st.columns(4)
        toggle_on = (voice["event"] == "voice_toggle_on").sum()
        transcripts = (voice["event"] == "transcript_final").sum()
        classified = voice[voice["event"] == "intent_classified"]
        unknown = (
            classified["data"].apply(lambda d: safe_get(d, "action") == "unknown").sum()
            if len(classified)
            else 0
        )
        c1.metric("Voice sessions started", toggle_on)
        c2.metric("Final transcripts", transcripts)
        c3.metric("Successful classifications", len(classified) - unknown)
        c4.metric("Failed classifications", int(unknown))

        st.subheader("Classification path (local vs LLM)")
        if not classified.empty:
            paths = classified["data"].apply(lambda d: safe_get(d, "path", "?"))
            path_counts = paths.value_counts().reset_index()
            path_counts.columns = ["path", "count"]
            fig = px.pie(
                path_counts,
                names="path",
                values="count",
                hole=0.4,
            )
            fig.update_layout(height=300)
            st.plotly_chart(fig, use_container_width=True)

            st.subheader("Classification latency by path")
            latencies = classified.copy()
            latencies["path"] = latencies["data"].apply(
                lambda d: safe_get(d, "path", "?")
            )
            latencies["latency_ms"] = latencies["data"].apply(
                lambda d: safe_get(d, "classification_ms", 0)
            )
            fig = px.box(latencies, x="path", y="latency_ms", points="all")
            fig.update_layout(height=350)
            st.plotly_chart(fig, use_container_width=True)

        st.subheader("All transcripts")
        finals = voice[voice["event"] == "transcript_final"].copy()
        if not finals.empty:
            finals["transcript"] = finals["data"].apply(
                lambda d: safe_get(d, "transcript", "")
            )
            finals_view = finals[
                ["ts", "participant_id", "transcript"]
            ].sort_values("ts")
            st.dataframe(finals_view, use_container_width=True, hide_index=True)

        st.subheader("Intents resolved")
        if not classified.empty:
            int_view = classified.copy()
            int_view["transcript"] = int_view["data"].apply(
                lambda d: safe_get(d, "transcript", "")
            )
            int_view["action"] = int_view["data"].apply(
                lambda d: safe_get(d, "action", "")
            )
            int_view["path"] = int_view["data"].apply(
                lambda d: safe_get(d, "path", "")
            )
            int_view["latency_ms"] = int_view["data"].apply(
                lambda d: safe_get(d, "classification_ms", 0)
            )
            st.dataframe(
                int_view[
                    ["ts", "participant_id", "transcript", "action", "path", "latency_ms"]
                ].sort_values("ts"),
                use_container_width=True,
                hide_index=True,
            )


# ── Gaze tab ──────────────────────────────────────────────────────────
with tab_gaze:
    gaze = df[df["category"] == "gaze"].copy()
    if gaze.empty:
        st.info("No gaze events.")
    else:
        c1, c2, c3, c4 = st.columns(4)
        toggle_on = (gaze["event"] == "gaze_toggle_on").sum()
        dwells = (gaze["event"] == "dwell_triggered").sum()
        block_selections = (gaze["event"] == "block_selected").sum()
        cal_changes = (gaze["event"] == "calibration_change").sum()
        c1.metric("Gaze sessions started", int(toggle_on))
        c2.metric("Dwell triggers", int(dwells))
        c3.metric("Code blocks selected", int(block_selections))
        c4.metric("Calibration changes", int(cal_changes))

        # Estimate total gaze time from samples (1Hz so each ≈ 1 second of viewing)
        samples = gaze[gaze["event"] == "dot_position"]
        if not samples.empty:
            est_seconds = len(samples)
            st.caption(
                f"≈ {est_seconds} seconds of active gaze tracking "
                f"(based on 1Hz samples)"
            )

        st.subheader("Block selections")
        blocks = gaze[gaze["event"] == "block_selected"].copy()
        if not blocks.empty:
            blocks["kind"] = blocks["data"].apply(lambda d: safe_get(d, "kind", ""))
            blocks["name"] = blocks["data"].apply(lambda d: safe_get(d, "name", ""))
            blocks["lines"] = blocks["data"].apply(
                lambda d: f"{safe_get(d, 'start_line', '?')}-{safe_get(d, 'end_line', '?')}"
            )
            st.dataframe(
                blocks[["ts", "participant_id", "kind", "name", "lines"]].sort_values(
                    "ts"
                ),
                use_container_width=True,
                hide_index=True,
            )

        st.subheader("Gaze position heatmap (sampled @ 1Hz)")
        if not samples.empty:
            samples_xy = samples.copy()
            samples_xy["x"] = samples_xy["data"].apply(lambda d: safe_get(d, "x", 0))
            samples_xy["y"] = samples_xy["data"].apply(lambda d: safe_get(d, "y", 0))
            fig = px.density_heatmap(
                samples_xy,
                x="x",
                y="y",
                nbinsx=30,
                nbinsy=30,
                title="Normalized gaze coordinates (0-1)",
            )
            fig.update_yaxes(autorange="reversed")
            fig.update_layout(height=400)
            st.plotly_chart(fig, use_container_width=True)


# ── AI tab ────────────────────────────────────────────────────────────
with tab_ai:
    ai = df[df["category"] == "ai"].copy()
    if ai.empty:
        st.info("No AI events.")
    else:
        c1, c2, c3, c4 = st.columns(4)
        ov_req = (ai["event"] == "overview_requested").sum()
        ov_recv = (ai["event"] == "overview_received").sum()
        explains = (ai["event"] == "explain_clicked").sum()
        comments = (ai["event"] == "inline_comment_inserted").sum()
        c1.metric("Overviews requested", int(ov_req))
        c2.metric("Overviews received", int(ov_recv))
        c3.metric("Explain clicks", int(explains))
        c4.metric("Inline comments inserted", int(comments))

        st.subheader("Explain breakdown (api/concept/usage)")
        explain_df = ai[ai["event"] == "explain_clicked"].copy()
        if not explain_df.empty:
            explain_df["type"] = explain_df["data"].apply(
                lambda d: safe_get(d, "type", "")
            )
            type_counts = explain_df["type"].value_counts().reset_index()
            type_counts.columns = ["type", "count"]
            fig = px.bar(
                type_counts,
                x="type",
                y="count",
                color="type",
                text="count",
            )
            fig.update_layout(showlegend=False, height=300)
            st.plotly_chart(fig, use_container_width=True)

        st.subheader("Overview lifecycle")
        ov = ai[ai["event"].isin(["overview_requested", "overview_received"])].copy()
        if not ov.empty:
            ov_view = ov[["ts", "participant_id", "event", "data"]].sort_values("ts")
            ov_view["data_str"] = ov_view["data"].apply(
                lambda d: json.dumps(d) if isinstance(d, dict) else ""
            )
            st.dataframe(
                ov_view[["ts", "participant_id", "event", "data_str"]],
                use_container_width=True,
                hide_index=True,
            )


# ── Run tab ───────────────────────────────────────────────────────────
with tab_run:
    runs = df[df["category"] == "run"].copy()
    if runs.empty:
        st.info("No run events.")
    else:
        starts = runs[runs["event"] == "run_started"]
        completes = runs[runs["event"] == "run_completed"].copy()
        c1, c2, c3, c4 = st.columns(4)
        c1.metric("Runs started", len(starts))
        c2.metric("Runs completed", len(completes))
        if not completes.empty:
            completes["exit_code"] = completes["data"].apply(
                lambda d: safe_get(d, "exit_code", -1)
            )
            completes["duration_ms"] = completes["data"].apply(
                lambda d: safe_get(d, "duration_ms", 0)
            )
            success = (completes["exit_code"] == 0).sum()
            c3.metric("Successful runs", int(success))
            c4.metric(
                "Avg duration (s)",
                f"{(completes['duration_ms'].mean() / 1000):.2f}",
            )

            st.subheader("Run history")
            history = completes[
                ["ts", "participant_id", "data"]
            ].copy()
            history["file"] = history["data"].apply(
                lambda d: safe_get(d, "file", "")
            )
            history["exit"] = history["data"].apply(
                lambda d: safe_get(d, "exit_code", "")
            )
            history["duration_s"] = history["data"].apply(
                lambda d: round(safe_get(d, "duration_ms", 0) / 1000, 2)
            )
            st.dataframe(
                history[
                    ["ts", "participant_id", "file", "exit", "duration_s"]
                ].sort_values("ts"),
                use_container_width=True,
                hide_index=True,
            )


# ── Selections tab ────────────────────────────────────────────────────
with tab_select:
    sel = df[df["category"] == "selection"].copy()
    if sel.empty:
        st.info("No selection events.")
    else:
        sel["method"] = sel["data"].apply(lambda d: safe_get(d, "method", "?"))
        method_counts = sel["method"].value_counts().reset_index()
        method_counts.columns = ["method", "count"]
        fig = px.pie(
            method_counts,
            names="method",
            values="count",
            hole=0.4,
            title="Selection method distribution",
        )
        fig.update_layout(height=350)
        st.plotly_chart(fig, use_container_width=True)

        sel["file"] = sel["data"].apply(lambda d: safe_get(d, "file", ""))
        sel["lines"] = sel["data"].apply(
            lambda d: f"{safe_get(d, 'start_line', '?')}-{safe_get(d, 'end_line', '?')}"
        )
        sel["length"] = sel["data"].apply(lambda d: safe_get(d, "length", 0))
        st.dataframe(
            sel[
                ["ts", "participant_id", "method", "file", "lines", "length"]
            ].sort_values("ts"),
            use_container_width=True,
            hide_index=True,
        )


# ── Files tab ─────────────────────────────────────────────────────────
with tab_files:
    ed = df[df["category"] == "editor"].copy()
    if ed.empty:
        st.info("No editor events.")
    else:
        c1, c2, c3 = st.columns(3)
        c1.metric("File opens", int((ed["event"] == "file_opened").sum()))
        c2.metric("File saves", int((ed["event"] == "file_saved").sum()))
        c3.metric(
            "Active editor switches",
            int((ed["event"] == "active_editor_changed").sum()),
        )

        st.subheader("Files touched")
        ed["file"] = ed["data"].apply(lambda d: safe_get(d, "file", "?"))
        files = ed["file"].value_counts().head(20).reset_index()
        files.columns = ["file", "events"]
        st.dataframe(files, use_container_width=True, hide_index=True)


# ── Raw events tab ────────────────────────────────────────────────────
with tab_raw:
    st.subheader(f"Raw events ({len(df)})")
    cat_filter = st.multiselect(
        "Filter by category",
        options=sorted(df["category"].unique()),
        default=[],
    )
    raw_df = df.copy()
    if cat_filter:
        raw_df = raw_df[raw_df["category"].isin(cat_filter)]

    raw_df["data_str"] = raw_df["data"].apply(
        lambda d: json.dumps(d) if isinstance(d, dict) else ""
    )
    st.dataframe(
        raw_df[
            ["ts", "participant_id", "category", "event", "data_str"]
        ].sort_values("ts", ascending=False),
        use_container_width=True,
        hide_index=True,
        height=600,
    )

    st.download_button(
        "📥 Download filtered events as CSV",
        data=raw_df[
            ["ts", "session_id", "participant_id", "category", "event", "data_str"]
        ]
        .to_csv(index=False)
        .encode("utf-8"),
        file_name=f"events_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
        mime="text/csv",
    )
