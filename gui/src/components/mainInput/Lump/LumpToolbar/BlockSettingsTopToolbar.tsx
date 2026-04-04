import {
  ExclamationTriangleIcon,
  GiftIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/outline";
import { useContext, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { IdeMessengerContext } from "../../../../context/IdeMessenger";
import { useAppSelector } from "../../../../redux/hooks";
import {
  selectPendingToolCalls,
  selectToolCallsByStatus,
} from "../../../../redux/selectors/selectToolCalls";
import StarterCreditsPopover from "../../../StarterCreditsPopover";
import { ToolTip } from "../../../gui/Tooltip";
import HoverItem from "../../InputToolbar/HoverItem";

import { useAuth } from "../../../../context/Auth";
import { useCreditStatus } from "../../../../hooks/useCredits";
import { CONFIG_ROUTES } from "../../../../util/navigation";

import { useSelection } from "../../../../context/SelectionContext";

export function BlockSettingsTopToolbar() {
  const navigate = useNavigate();
  const { selectedProfile } = useAuth();
  const { selection, setSelection, launchStarted, startLaunch } =
    useSelection();
  const [shimmerGetStarted, setShimmerGetStarted] = useState(false);
  const [shimmerSelection, setShimmerSelection] = useState(false);
  const shimmerRef = useRef({ getStarted: false, selection: false });

  useEffect(() => {
    shimmerRef.current.getStarted = shimmerGetStarted;
    shimmerRef.current.selection = shimmerSelection;
  }, [shimmerGetStarted, shimmerSelection]);

  useEffect(() => {
    const listener = (event: any) => {
      if (event.data?.messageType === "selectionChange") {
        setSelection(event.data.data);
        if (shimmerRef.current.getStarted || shimmerRef.current.selection) {
          setShimmerGetStarted(false);
          setShimmerSelection(false);
        }
      }
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [setSelection]);

  const handleGetStartedClick = () => {
    if (!selection?.content) {
      setShimmerSelection(true);
      setTimeout(() => setShimmerSelection(false), 2000);
      return;
    }
    startLaunch();
  };

  const handleSelectionClick = () => {
    setShimmerGetStarted(true);
    setTimeout(() => setShimmerGetStarted(false), 2000);
  };

  const configError = useAppSelector((store) => store.config.configError);
  const ideMessenger = useContext(IdeMessengerContext);

  const pendingToolCalls = useAppSelector(selectPendingToolCalls);
  const callingToolCalls = useAppSelector((state) =>
    selectToolCallsByStatus(state, "calling"),
  );
  const hasActiveContent =
    pendingToolCalls.length > 0 || callingToolCalls.length > 0;

  const shouldShowError = configError && configError?.length > 0;

  const { creditStatus, isUsingFreeTrial, refreshCreditStatus } =
    useCreditStatus();

  const [gazeActive, setGazeActive] = useState(false);
  const [gazePanelOpen, setGazePanelOpen] = useState(false);
  const [gazeCalibDots, setGazeCalibDots] = useState(false);
  const gazeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detect gaze mode from gazeUpdate messages
  useEffect(() => {
    const handler = (event: any) => {
      if (
        event.data?.messageType === "gazeUpdate" ||
        event.data?.messageType === "gazeCalibrationSync"
      ) {
        setGazeActive(true);
        if (gazeTimeoutRef.current) clearTimeout(gazeTimeoutRef.current);
        gazeTimeoutRef.current = setTimeout(() => {
          setGazeActive(false);
          setGazePanelOpen(false);
          setGazeCalibDots(false);
          window.dispatchEvent(
            new CustomEvent("gazeCalibrationDots", { detail: { show: false } }),
          );
        }, 3000);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);
  const [gazeOffsetX, setGazeOffsetX] = useState(0);
  const [gazeOffsetY, setGazeOffsetY] = useState(0);
  const [gazeMomentumX, setGazeMomentumX] = useState(3.0);
  const [gazeMomentumY, setGazeMomentumY] = useState(1.0);
  const [gazeSmoothing, setGazeSmoothing] = useState(0.3);
  const [gazeDwellMs, setGazeDwellMs] = useState(1500);
  const [gazeHitRadius, setGazeHitRadius] = useState(40);

  // Initialize sliders from saved calibration when gaze starts
  useEffect(() => {
    const handleSync = (event: any) => {
      if (event.data?.messageType !== "gazeCalibrationSync") return;
      const d = event.data.data;
      if (d.offsetX !== undefined) setGazeOffsetX(d.offsetX);
      if (d.offsetY !== undefined) setGazeOffsetY(d.offsetY);
      if (d.momentumX !== undefined) setGazeMomentumX(d.momentumX);
      if (d.momentumY !== undefined) setGazeMomentumY(d.momentumY);
      if (d.smoothing !== undefined) setGazeSmoothing(d.smoothing);
      if (d.dwellMs !== undefined) setGazeDwellMs(d.dwellMs);
      if (d.hitRadius !== undefined) setGazeHitRadius(d.hitRadius);
    };
    window.addEventListener("message", handleSync);
    return () => window.removeEventListener("message", handleSync);
  }, []);

  const gazeValuesRef = useRef({
    gazeOffsetX,
    gazeOffsetY,
    gazeMomentumX,
    gazeMomentumY,
    gazeSmoothing,
    gazeDwellMs,
    gazeHitRadius,
  });
  gazeValuesRef.current = {
    gazeOffsetX,
    gazeOffsetY,
    gazeMomentumX,
    gazeMomentumY,
    gazeSmoothing,
    gazeDwellMs,
    gazeHitRadius,
  };

  const sendGazeCalibration = (action: "update" | "save") => {
    const v = gazeValuesRef.current;
    void ideMessenger.post("gazeCalibrate", {
      action,
      offsetX: v.gazeOffsetX,
      offsetY: v.gazeOffsetY,
      momentumX: v.gazeMomentumX,
      momentumY: v.gazeMomentumY,
      smoothing: v.gazeSmoothing,
      dwellMs: v.gazeDwellMs,
      hitRadius: v.gazeHitRadius,
    });
  };

  // Send live updates when sliders change
  useEffect(() => {
    sendGazeCalibration("update");
    // Broadcast dwellMs and hitRadius to Chat.tsx gaze hover logic
    window.dispatchEvent(
      new CustomEvent("gazeCalibrationUpdate", {
        detail: { dwellMs: gazeDwellMs, hitRadius: gazeHitRadius },
      }),
    );
  }, [
    gazeOffsetX,
    gazeOffsetY,
    gazeMomentumX,
    gazeMomentumY,
    gazeSmoothing,
    gazeDwellMs,
    gazeHitRadius,
  ]);

  return (
    <div className="flex flex-col gap-4">
      {!launchStarted && (
        <div className="relative -mx-2 -mt-2 rounded-2xl bg-[rgb(52,87,177)] p-6 text-center">
          {/* Gaze Settings Ribbon */}
          {gazeActive && (
            <>
              <button
                onClick={() => setGazePanelOpen(!gazePanelOpen)}
                style={{
                  background:
                    "linear-gradient(to bottom, rgba(255, 60, 60, 0.85), rgba(200, 30, 30, 0.9))",
                  borderRadius: "0 16px 0 12px",
                  border: "none",
                  outline: "none",
                }}
                className="absolute right-0 top-0 flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white shadow-lg transition-all hover:brightness-90"
              >
                <Cog6ToothIcon className="h-3.5 w-3.5" />
                Gaze Settings
              </button>

              {gazePanelOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: 28,
                    right: 0,
                    zIndex: 99998,
                    background: "rgba(30, 30, 30, 0.95)",
                    border: "none",
                    borderRadius: "0 0 0 8px",
                    padding: 12,
                    width: 220,
                    fontSize: 11,
                    color: "#ccc",
                    backdropFilter: "blur(8px)",
                    textAlign: "left",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 10,
                    }}
                  >
                    <span
                      style={{ fontWeight: 700, color: "#fff", fontSize: 12 }}
                    >
                      Gaze Calibration
                    </span>
                    <button
                      onClick={() => setGazePanelOpen(false)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#888",
                        cursor: "pointer",
                        fontSize: 14,
                      }}
                    >
                      ✕
                    </button>
                  </div>

                  {/* Offset X */}
                  <div style={{ marginBottom: 8 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 2,
                      }}
                    >
                      <span>Offset X</span>
                      <span style={{ color: "#fff", fontFamily: "monospace" }}>
                        {gazeOffsetX.toFixed(3)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-1}
                      max={1}
                      step={0.005}
                      value={gazeOffsetX}
                      onChange={(e) =>
                        setGazeOffsetX(parseFloat(e.target.value))
                      }
                      style={{ width: "100%" }}
                    />
                  </div>

                  {/* Offset Y */}
                  <div style={{ marginBottom: 8 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 2,
                      }}
                    >
                      <span>Offset Y</span>
                      <span style={{ color: "#fff", fontFamily: "monospace" }}>
                        {gazeOffsetY.toFixed(3)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-1}
                      max={1}
                      step={0.005}
                      value={gazeOffsetY}
                      onChange={(e) =>
                        setGazeOffsetY(parseFloat(e.target.value))
                      }
                      style={{ width: "100%" }}
                    />
                  </div>

                  {/* Momentum X */}
                  <div style={{ marginBottom: 8 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 2,
                      }}
                    >
                      <span>Momentum X</span>
                      <span style={{ color: "#fff", fontFamily: "monospace" }}>
                        {gazeMomentumX.toFixed(2)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.5}
                      max={5.0}
                      step={0.05}
                      value={gazeMomentumX}
                      onChange={(e) =>
                        setGazeMomentumX(parseFloat(e.target.value))
                      }
                      style={{ width: "100%" }}
                    />
                  </div>

                  {/* Momentum Y */}
                  <div style={{ marginBottom: 8 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 2,
                      }}
                    >
                      <span>Momentum Y</span>
                      <span style={{ color: "#fff", fontFamily: "monospace" }}>
                        {gazeMomentumY.toFixed(2)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.5}
                      max={5.0}
                      step={0.05}
                      value={gazeMomentumY}
                      onChange={(e) =>
                        setGazeMomentumY(parseFloat(e.target.value))
                      }
                      style={{ width: "100%" }}
                    />
                  </div>

                  {/* Smoothing */}
                  <div style={{ marginBottom: 8 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 2,
                      }}
                    >
                      <span>Smoothing</span>
                      <span style={{ color: "#fff", fontFamily: "monospace" }}>
                        {gazeSmoothing.toFixed(2)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={gazeSmoothing}
                      onChange={(e) =>
                        setGazeSmoothing(parseFloat(e.target.value))
                      }
                      style={{ width: "100%" }}
                    />
                  </div>

                  {/* Dwell Time */}
                  <div style={{ marginBottom: 8 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 2,
                      }}
                    >
                      <span>Dwell Time</span>
                      <span style={{ color: "#fff", fontFamily: "monospace" }}>
                        {gazeDwellMs}ms
                      </span>
                    </div>
                    <input
                      type="range"
                      min={100}
                      max={3000}
                      step={100}
                      value={gazeDwellMs}
                      onChange={(e) => setGazeDwellMs(parseInt(e.target.value))}
                      style={{ width: "100%" }}
                    />
                  </div>

                  {/* Hit Radius */}
                  <div style={{ marginBottom: 10 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 2,
                      }}
                    >
                      <span>Hit Radius</span>
                      <span style={{ color: "#fff", fontFamily: "monospace" }}>
                        {gazeHitRadius}px
                      </span>
                    </div>
                    <input
                      type="range"
                      min={15}
                      max={100}
                      step={5}
                      value={gazeHitRadius}
                      onChange={(e) =>
                        setGazeHitRadius(parseInt(e.target.value))
                      }
                      style={{ width: "100%" }}
                    />
                  </div>

                  {/* Calibration Dots */}
                  <button
                    onClick={() => {
                      const next = !gazeCalibDots;
                      setGazeCalibDots(next);
                      window.dispatchEvent(
                        new CustomEvent("gazeCalibrationDots", {
                          detail: { show: next },
                        }),
                      );
                    }}
                    style={{
                      width: "100%",
                      padding: "5px 0",
                      marginBottom: 6,
                      background: gazeCalibDots
                        ? "rgba(255, 60, 60, 0.7)"
                        : "rgba(255, 255, 255, 0.1)",
                      border: "none",
                      borderRadius: 4,
                      color: "#fff",
                      fontWeight: 600,
                      fontSize: 11,
                      cursor: "pointer",
                    }}
                  >
                    {gazeCalibDots ? "Hide" : "Show"} Calibration Dots
                  </button>

                  {/* Save */}
                  <button
                    onClick={() => sendGazeCalibration("save")}
                    style={{
                      width: "100%",
                      padding: "5px 0",
                      background: "rgba(62, 106, 225, 0.9)",
                      border: "none",
                      borderRadius: 4,
                      color: "#fff",
                      fontWeight: 600,
                      fontSize: 11,
                      cursor: "pointer",
                    }}
                  >
                    Save Calibration
                  </button>
                </div>
              )}
            </>
          )}
          <div className="mb-2 text-sm font-bold uppercase tracking-wider text-white">
            Launch Overview
          </div>
          <p className="mb-4 text-xs text-white/70">
            Selected code will be analyzed and an overview will be generated.
          </p>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={handleGetStartedClick}
              data-gaze-action="overview"
              className={`rounded-full border-none bg-white px-8 py-3 text-base font-bold text-black transition-all hover:bg-gradient-to-b hover:from-gray-300 hover:to-white ${shimmerGetStarted ? "animate-shimmer animate-shimmer-active" : ""}`}
            >
              Get Started
            </button>
            <button
              onClick={handleSelectionClick}
              className={`min-w-[140px] rounded-full border border-white bg-transparent px-4 py-3 text-base font-medium text-white transition-all hover:bg-white hover:text-black ${shimmerSelection ? "animate-shimmer animate-shimmer-active" : ""}`}
            >
              {selection?.filepath && selection?.range
                ? `${selection.filepath.split("/").pop()}: ${selection.range.start.line + 1}-${selection.range.end.line + 1}`
                : selection?.filepath
                  ? selection.filepath.split("/").pop()
                  : "No file"}
            </button>
          </div>
        </div>
      )}

      {/* Bottom: Icons and Config dropdown */}
      <div className="flex w-full items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-1">
          {shouldShowError && (
            <ToolTip delayShow={700} content="View configuration errors">
              <div
                role="button"
                tabIndex={0}
                onClick={() => navigate(CONFIG_ROUTES.CONFIGS)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(CONFIG_ROUTES.CONFIGS);
                  }
                }}
                data-testid="block-settings-toolbar-icon-error"
                className="relative flex cursor-pointer select-none items-center rounded-full px-1.5 py-1 sm:px-1.5"
              >
                <ExclamationTriangleIcon
                  className="text-warning h-[13px] w-[13px] flex-shrink-0"
                  aria-hidden="true"
                />
              </div>
            </ToolTip>
          )}

          {!hasActiveContent && (
            <div className="flex items-center gap-1.5">
              {isUsingFreeTrial && (
                <ToolTip content="View remaining starter credits">
                  <StarterCreditsPopover
                    creditStatus={creditStatus}
                    refreshCreditStatus={refreshCreditStatus}
                  >
                    <HoverItem px={2}>
                      <GiftIcon className="text-description-muted h-3 w-3 hover:brightness-125" />
                    </HoverItem>
                  </StarterCreditsPopover>
                </ToolTip>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
