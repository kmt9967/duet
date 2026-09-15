"use client";

/**
 * Top-down view of the bimanual workspace.
 *
 * Plan view is deliberate rather than a compromise: the things that matter here
 * are which arm can reach what, where the two envelopes overlap, and when both
 * arms are moving at once. All three are immediately legible from above and
 * would be obscured by a perspective camera.
 *
 * Screen axes are rotated from world axes — world +y (operator's left) maps to
 * screen x, and world +x (away from the operator) maps to screen -y — so the
 * arms sit at the bottom of the frame and the table extends upward.
 */

import { useEffect, useRef } from "react";

import { jointPositions } from "@/lib/core/kinematics";
import { ARM_BASES } from "@/lib/core/scene";
import type { ArmId, Scene, Vec3 } from "@/lib/core/types";
import { HANDOFF_POINT } from "@/lib/planner/planner";
import type { StepOutcome } from "@/lib/sim/executor";

const WORLD = {
  minX: -0.06,
  maxX: 0.27,
  minY: -0.33,
  maxY: 0.33,
} as const;

const ARM_COLOR: Record<ArmId, string> = {
  A: "#38bdf8",
  B: "#f472b6",
};

const OBJECT_COLOR: Record<string, string> = {
  plate: "#e2e8f0",
  mug: "#fbbf24",
  fork: "#94a3b8",
  spoon: "#94a3b8",
  knife: "#94a3b8",
  bottle: "#34d399",
  napkin: "#a78bfa",
};

export type WorkspaceCanvasProps = {
  scene: Scene;
  active: StepOutcome[];
  /** Highlight the reach envelope of this arm, if any. */
  focusArm?: ArmId | null;
};

export function WorkspaceCanvas({ scene, active, focusArm }: WorkspaceCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssWidth = parent.clientWidth;
    const cssHeight = Math.max(320, Math.round(cssWidth * 0.62));

    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // --- world -> screen -------------------------------------------------
    const worldW = WORLD.maxY - WORLD.minY;
    const worldH = WORLD.maxX - WORLD.minX;
    const scale = Math.min(cssWidth / worldW, cssHeight / worldH);
    const offsetX = (cssWidth - worldW * scale) / 2;
    const offsetY = (cssHeight - worldH * scale) / 2;

    const sx = (p: { y: number }) => offsetX + (p.y - WORLD.minY) * scale;
    const sy = (p: { x: number }) => offsetY + (WORLD.maxX - p.x) * scale;
    const sr = (metres: number) => metres * scale;

    ctx.clearRect(0, 0, cssWidth, cssHeight);

    // --- backdrop --------------------------------------------------------
    ctx.fillStyle = "#070b14";
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    ctx.strokeStyle = "rgba(148,163,184,0.07)";
    ctx.lineWidth = 1;
    for (let gy = WORLD.minY; gy <= WORLD.maxY + 1e-6; gy += 0.05) {
      ctx.beginPath();
      ctx.moveTo(sx({ y: gy }), 0);
      ctx.lineTo(sx({ y: gy }), cssHeight);
      ctx.stroke();
    }
    for (let gx = WORLD.minX; gx <= WORLD.maxX + 1e-6; gx += 0.05) {
      ctx.beginPath();
      ctx.moveTo(0, sy({ x: gx }));
      ctx.lineTo(cssWidth, sy({ x: gx }));
      ctx.stroke();
    }

    // --- reach envelopes -------------------------------------------------
    // Drawn as an annulus: the inner hole is real, caused by the elbow stop.
    for (const arm of ["A", "B"] as const) {
      const base = ARM_BASES[arm];
      const focused = focusArm === arm;
      ctx.save();
      ctx.beginPath();
      ctx.arc(sx(base), sy(base), sr(0.225), 0, Math.PI * 2);
      ctx.arc(sx(base), sy(base), sr(0.14), 0, Math.PI * 2, true);
      ctx.fillStyle = focused
        ? `${ARM_COLOR[arm]}22`
        : `${ARM_COLOR[arm]}0d`;
      ctx.fill("evenodd");
      ctx.restore();

      ctx.beginPath();
      ctx.arc(sx(base), sy(base), sr(0.225), 0, Math.PI * 2);
      ctx.strokeStyle = focused ? `${ARM_COLOR[arm]}88` : `${ARM_COLOR[arm]}33`;
      ctx.setLineDash([4, 5]);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // --- hand-off zone ---------------------------------------------------
    ctx.beginPath();
    ctx.arc(sx(HANDOFF_POINT), sy(HANDOFF_POINT), sr(0.028), 0, Math.PI * 2);
    ctx.fillStyle = "rgba(250,204,21,0.10)";
    ctx.fill();
    ctx.strokeStyle = "rgba(250,204,21,0.55)";
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1.25;
    ctx.stroke();
    ctx.setLineDash([]);
    label(ctx, "HAND-OFF", sx(HANDOFF_POINT), sy(HANDOFF_POINT) - sr(0.04), "rgba(250,204,21,0.8)");

    // --- placemats -------------------------------------------------------
    for (const mat of scene.placemats) {
      const w = sr(mat.halfExtents.y * 2);
      const h = sr(mat.halfExtents.x * 2);
      const cx = sx(mat.center);
      const cy = sy(mat.center);
      ctx.fillStyle = "rgba(148,163,184,0.07)";
      ctx.strokeStyle = "rgba(148,163,184,0.35)";
      ctx.lineWidth = 1;
      roundRect(ctx, cx - w / 2, cy - h / 2, w, h, 6);
      ctx.fill();
      ctx.stroke();
      label(ctx, mat.label.toUpperCase(), cx, cy + h / 2 + 12, "rgba(148,163,184,0.75)");
    }

    // --- drawer ----------------------------------------------------------
    for (const drawer of scene.drawers) {
      const slide = drawer.openness * drawer.travel;
      const pos = { x: drawer.position.x - slide, y: drawer.position.y };
      const w = sr(0.11);
      const h = sr(0.05);
      ctx.fillStyle = drawer.openness > 0.5 ? "rgba(56,189,248,0.12)" : "rgba(30,41,59,0.85)";
      ctx.strokeStyle = drawer.openness > 0.5 ? "rgba(56,189,248,0.7)" : "rgba(100,116,139,0.6)";
      ctx.lineWidth = 1.25;
      roundRect(ctx, sx(pos) - w / 2, sy(pos) - h / 2, w, h, 4);
      ctx.fill();
      ctx.stroke();
      label(
        ctx,
        drawer.openness > 0.5 ? "DRAWER OPEN" : "DRAWER CLOSED",
        sx(pos),
        sy(pos) - h / 2 - 8,
        drawer.openness > 0.5 ? "rgba(56,189,248,0.9)" : "rgba(100,116,139,0.9)",
      );
    }

    // --- objects ---------------------------------------------------------
    for (const object of scene.objects) {
      if (object.location.type === "drawer" && (scene.drawers[0]?.openness ?? 0) < 0.5) {
        continue; // hidden inside a closed drawer
      }
      const held = object.location.type === "held";
      const color = OBJECT_COLOR[object.kind] ?? "#cbd5e1";
      const cx = sx(object.position);
      const cy = sy(object.position);

      // Round items are drawn as discs; elongated ones (cutlery) as oriented
      // rectangles. Using the longest half-extent as a radius for a fork would
      // render a 11 cm blob instead of a 1.6 cm-wide utensil.
      const halfW = sr(object.halfExtents.y);
      const halfH = sr(object.halfExtents.x);
      const elongated =
        Math.max(object.halfExtents.x, object.halfExtents.y) >
        Math.min(object.halfExtents.x, object.halfExtents.y) * 1.8;

      ctx.save();
      ctx.translate(cx, cy);
      // World yaw is about +z; screen axes are rotated, so negate to match.
      ctx.rotate(-object.yaw);
      ctx.fillStyle = held ? color : `${color}cc`;
      ctx.strokeStyle = held ? "#ffffff" : `${color}`;
      ctx.lineWidth = held ? 2 : 1;

      if (elongated) {
        roundRect(
          ctx,
          -Math.max(2, halfW),
          -Math.max(2, halfH),
          Math.max(4, halfW * 2),
          Math.max(4, halfH * 2),
          2,
        );
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.ellipse(0, 0, Math.max(4, halfW), Math.max(4, halfH), 0, 0, Math.PI * 2);
        ctx.fill();
        if (held) ctx.stroke();
      }
      ctx.restore();

      const labelOffset = Math.max(halfW, halfH, 5) + 11;
      label(
        ctx,
        object.kind.toUpperCase(),
        cx,
        cy + labelOffset,
        "rgba(226,232,240,0.72)",
      );
    }

    // --- arms ------------------------------------------------------------
    const movingArms = new Set(active.map((o) => o.arm));

    for (const arm of ["A", "B"] as const) {
      const state = scene.arms[arm];
      const points = jointPositions(state.joints, state.base);
      const color = ARM_COLOR[arm];
      const moving = movingArms.has(arm);

      // Link polyline.
      ctx.beginPath();
      ctx.moveTo(sx(points[0]!), sy(points[0]!));
      for (const p of points.slice(1)) ctx.lineTo(sx(p), sy(p));
      ctx.strokeStyle = color;
      ctx.lineWidth = moving ? 4 : 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (moving) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Joints.
      for (const [i, p] of points.entries()) {
        ctx.beginPath();
        ctx.arc(sx(p), sy(p), i === 0 ? 6 : 3.2, 0, Math.PI * 2);
        ctx.fillStyle = i === 0 ? color : "#0b1220";
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.fill();
        ctx.stroke();
      }

      label(
        ctx,
        `ARM ${arm}${state.holding ? " • HOLDING" : ""}`,
        sx(state.base),
        sy(state.base) + 20,
        color,
      );
    }
  }, [scene, active, focusArm]);

  return (
    <div className="w-full">
      <canvas ref={canvasRef} className="block w-full rounded-xl" />
    </div>
  );
}

function label(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
) {
  ctx.font =
    "600 9px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export { ARM_COLOR };
export type { Vec3 };
