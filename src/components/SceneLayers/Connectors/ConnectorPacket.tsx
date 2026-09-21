import React, { useEffect, useMemo, useRef } from 'react';
import gsap from 'gsap';
import { useTheme } from '@mui/material';
import { Coords, FlowPlaybackStatus } from 'src/types';
import { getPointAtProgress } from 'src/utils';

interface Props {
  points: Coords[];
  color: string;
  label?: string;
  // The step's own duration at speed 1x. The running tween is scaled by
  // `speed` via `timeScale()` (see the effect below) rather than rebuilt,
  // so a speed change mid-flight adjusts the pace without restarting it.
  baseDurationMs: number;
  speed: number;
  // Only 'PLAYING'/'PAUSED' are meaningful here — Connector.tsx only mounts
  // this component while one of those is true for the connector's step.
  status: FlowPlaybackStatus;
  reducedMotion: boolean;
  // Called exactly once, when the packet reaches its destination (or
  // immediately, after a short pause, under reduced motion).
  onArrive: () => void;
}

// Renders a single travelling packet along `points` (already in the
// direction of travel, and in the same mirrored pixel space as the
// connector's own polyline — must be drawn inside that same <Svg>). Motion
// is driven by a GSAP tween over a plain progress value in [0, 1], reading
// the point at that progress from the connector's own <polyline> via
// SVGGeometryElement when available (accurate for curved/segmented paths),
// falling back to the pure getPointAtProgress() util otherwise (jsdom and
// older browsers do not implement getTotalLength/getPointAtLength).
export const ConnectorPacket = ({
  points,
  color,
  label,
  baseDurationMs,
  speed,
  status,
  reducedMotion,
  onArrive
}: Props) => {
  const theme = useTheme();
  const polylineRef = useRef<SVGPolylineElement>(null);
  const dotPositionRef = useRef<Coords>(points[0] ?? { x: 0, y: 0 });
  const dotRef = useRef<SVGCircleElement>(null);
  const labelGroupRef = useRef<SVGGElement>(null);
  const tweenRef = useRef<gsap.core.Tween | null>(null);
  const hasArrivedRef = useRef(false);

  // Latest-ref pattern: `arrive()` below is captured once inside the
  // tween-creation effect (which only re-runs per step, not on every
  // render), so it must read `onArrive` through a ref to always call the
  // current callback rather than whichever one was passed in at the moment
  // the effect last ran (R3-stale-onArrive-closure).
  const onArriveRef = useRef(onArrive);
  useEffect(() => {
    onArriveRef.current = onArrive;
  }, [onArrive]);

  // Latest-ref for the same reason as `onArriveRef` above: the
  // tween-creation effect below only re-runs per step (its deps are
  // [points, baseDurationMs, reducedMotion]), but `speed` can change without
  // those deps changing — e.g. the tween-creation effect itself re-running
  // for an unrelated reason (points recomputed for the same step,
  // reducedMotion flipping) would otherwise create the new tween at the
  // default timeScale (1) until the next speed change fires the separate
  // speed effect below (R3-speed-lost-on-tween-rebuild). Reading the latest
  // speed here and applying it right after creating the tween keeps a
  // rebuilt tween in sync with the live speed even when speed itself didn't
  // change.
  const speedRef = useRef(speed);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  const pointsString = useMemo(() => {
    return points
      .map((point) => {
        return `${point.x},${point.y}`;
      })
      .join(' ');
  }, [points]);

  const getPointAt = (progress: number): Coords => {
    const polyline = polylineRef.current;

    if (polyline && typeof polyline.getTotalLength === 'function') {
      try {
        const length = polyline.getTotalLength();

        if (length > 0) {
          const domPoint = polyline.getPointAtLength(progress * length);
          return { x: domPoint.x, y: domPoint.y };
        }
      } catch {
        // Not implemented in this environment (e.g. jsdom) — fall through
        // to the pure fallback below.
      }
    }

    return getPointAtProgress(points, progress);
  };

  const moveTo = (progress: number) => {
    const point = getPointAt(progress);
    dotPositionRef.current = point;

    if (dotRef.current) {
      dotRef.current.setAttribute('cx', String(point.x));
      dotRef.current.setAttribute('cy', String(point.y));
    }

    if (labelGroupRef.current) {
      // The parent <Svg> is rendered with `transform: scale(-1, 1)`; this
      // group counter-flips so the label text itself reads normally.
      labelGroupRef.current.setAttribute(
        'transform',
        `translate(${point.x}, ${point.y - 24}) scale(-1, 1)`
      );
    }
  };

  // Drives the travel itself: mounts a fresh tween whenever the path or
  // duration changes (Connector.tsx remounts this component per step via
  // `key`, so this effectively runs once per step) and tears it down again
  // on step change / unmount, so no tween is ever leaked. Under reduced
  // motion, the packet is placed at the destination up front and the tween
  // just times a short, capped pause before calling onArrive — reusing the
  // same tween (instead of a bare setTimeout) means PAUSED still freezes it
  // (see the play/pause effect below) instead of silently auto-advancing.
  useEffect(() => {
    hasArrivedRef.current = false;

    const arrive = () => {
      if (hasArrivedRef.current) return;
      hasArrivedRef.current = true;
      moveTo(1);
      onArriveRef.current();
    };

    moveTo(reducedMotion ? 1 : 0);

    const durationSeconds = reducedMotion
      ? Math.min(baseDurationMs, 400) / 1000
      : Math.max(baseDurationMs, 0) / 1000;

    const progressState = { value: 0 };
    const tween = gsap.to(progressState, {
      value: 1,
      duration: durationSeconds,
      ease: 'none',
      paused: status !== 'PLAYING',
      onUpdate: reducedMotion
        ? undefined
        : () => {
            moveTo(progressState.value);
          },
      onComplete: arrive
    });

    tweenRef.current = tween;
    tween.timeScale(speedRef.current > 0 ? speedRef.current : 1);

    return () => {
      tween.kill();
      tweenRef.current = null;
    };
    // points/baseDurationMs/reducedMotion identity changes on every step
    // (Connector.tsx keys this component by step id) and are otherwise
    // stable across unrelated re-renders (see Connector.tsx's
    // `packetPoints`/`tilesKey` memos), so this intentionally does not react
    // to `status` or `speed` — pausing/resuming and speed changes are
    // applied to this same tween by the two effects below instead of
    // restarting it here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, baseDurationMs, reducedMotion]);

  // Pauses/resumes the in-flight tween without restarting it — this is what
  // lets PAUSED freeze the packet in place and PLAY resume from there.
  useEffect(() => {
    const tween = tweenRef.current;
    if (!tween) return;

    if (status === 'PLAYING') {
      tween.play();
    } else {
      tween.pause();
    }
  }, [status]);

  // Adjusts the running tween's playback rate in place when speed changes,
  // instead of rebuilding it (which would jump the packet back to its
  // starting point and restart the step).
  useEffect(() => {
    const tween = tweenRef.current;
    if (!tween) return;

    tween.timeScale(speed > 0 ? speed : 1);
  }, [speed]);

  return (
    <g>
      <polyline
        ref={polylineRef}
        points={pointsString}
        fill="none"
        stroke="none"
      />
      <circle
        ref={dotRef}
        cx={dotPositionRef.current.x}
        cy={dotPositionRef.current.y}
        r={14}
        fill={color}
        stroke={theme.palette.common.white}
        strokeWidth={3}
      />
      {label && (
        <g ref={labelGroupRef}>
          <text
            textAnchor="middle"
            fontSize={22}
            fontWeight={600}
            fill={theme.palette.common.black}
            stroke={theme.palette.common.white}
            strokeWidth={4}
            paintOrder="stroke"
          >
            {label}
          </text>
        </g>
      )}
    </g>
  );
};
