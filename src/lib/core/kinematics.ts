/**
 * Kinematics for a 5-DOF SO-101 arm plus gripper.
 *
 * Joint order: [shoulder_pan, shoulder_lift, elbow_flex, wrist_flex,
 * wrist_roll, gripper].
 *
 * The arm is modelled as a base yaw joint followed by a planar three-link
 * chain in the vertical plane selected by that yaw. This is the standard
 * decomposition for this class of arm and admits a closed-form solution, so IK
 * is exact and allocation-free rather than iterative.
 *
 * Link lengths are approximations of the published SO-101 geometry, expressed
 * in metres. They are declared here as the single source of truth so the
 * renderer and the solver can never disagree.
 */

import { type Vec3, vec3 } from "./types";

export const LINKS = {
  /** Table surface to the shoulder pitch axis. */
  base: 0.0563,
  /** Shoulder to elbow. */
  upperArm: 0.1159,
  /** Elbow to wrist. */
  forearm: 0.135,
  /** Wrist to the point between the gripper fingers. */
  wrist: 0.0721,
} as const;

/**
 * Per-joint limits in radians, matching the SO-101 servo travel.
 *
 * The elbow range matters more than it looks. Grasping an object close to the
 * base at table height requires deep elbow flexion — around 1.84 rad — and the
 * solution only stays inside the wrist limit on the elbow-down branch. A
 * tighter elbow range silently makes most of the near workspace unreachable.
 */
export const JOINT_LIMITS: ReadonlyArray<readonly [number, number]> = [
  [-Math.PI, Math.PI], // shoulder_pan
  [-1.92, 1.92], // shoulder_lift
  [-1.95, 1.95], // elbow_flex
  [-1.92, 1.92], // wrist_flex
  [-Math.PI, Math.PI], // wrist_roll
  [0, 1.0], // gripper: 0 closed, 1 fully open
];

export const MAX_PLANAR_REACH =
  LINKS.upperArm + LINKS.forearm + LINKS.wrist;

export function clampToLimits(joints: number[]): number[] {
  return joints.map((q, i) => {
    const limit = JOINT_LIMITS[i];
    if (!limit) return q;
    return Math.min(limit[1], Math.max(limit[0], q));
  });
}

export function withinLimits(joints: number[]): boolean {
  return joints.every((q, i) => {
    const limit = JOINT_LIMITS[i];
    if (!limit) return true;
    // Allow a hair of numerical slack so a solution exactly at the stop passes.
    return q >= limit[0] - 1e-6 && q <= limit[1] + 1e-6;
  });
}

/**
 * Forward kinematics: joint angles to end-effector position in world space.
 * `base` is the arm's mount point.
 */
export function forwardKinematics(joints: number[], base: Vec3): Vec3 {
  const [pan = 0, lift = 0, elbow = 0, wristFlex = 0] = joints;

  // Angles accumulate down the planar chain, measured from horizontal.
  const a1 = lift;
  const a2 = lift + elbow;
  const a3 = lift + elbow + wristFlex;

  const r =
    LINKS.upperArm * Math.cos(a1) +
    LINKS.forearm * Math.cos(a2) +
    LINKS.wrist * Math.cos(a3);
  const z =
    LINKS.base +
    LINKS.upperArm * Math.sin(a1) +
    LINKS.forearm * Math.sin(a2) +
    LINKS.wrist * Math.sin(a3);

  return vec3(base.x + r * Math.cos(pan), base.y + r * Math.sin(pan), z);
}

export type IkResult =
  | { ok: true; joints: number[] }
  | { ok: false; reason: "out-of-range" | "joint-limits" };

/**
 * Closed-form inverse kinematics for a target point in world space.
 *
 * `approach` is the pitch of the gripper at the target, in radians, measured
 * from horizontal. The default of -PI/2 is a straight top-down grasp, which is
 * what every table-top pick in this domain uses.
 */
export function inverseKinematics(
  target: Vec3,
  base: Vec3,
  approach = -Math.PI / 2,
  currentJoints?: number[],
): IkResult {
  const dx = target.x - base.x;
  const dy = target.y - base.y;
  const pan = Math.atan2(dy, dx);

  // Radial and vertical offset of the target from the shoulder pitch axis.
  const r = Math.hypot(dx, dy);
  const z = target.z - LINKS.base;

  // Back off along the approach direction to find the wrist centre.
  const rw = r - LINKS.wrist * Math.cos(approach);
  const zw = z - LINKS.wrist * Math.sin(approach);

  const d = Math.hypot(rw, zw);
  const l1 = LINKS.upperArm;
  const l2 = LINKS.forearm;

  if (d > l1 + l2 || d < Math.abs(l1 - l2)) {
    return { ok: false, reason: "out-of-range" };
  }

  // Law of cosines for the elbow.
  const cosElbow = (d * d - l1 * l1 - l2 * l2) / (2 * l1 * l2);
  const clamped = Math.min(1, Math.max(-1, cosElbow));

  // Two branches exist. Prefer elbow-up, which keeps the forearm clear of the
  // table, then fall back to elbow-down if the first violates a joint stop.
  const branches = [Math.acos(clamped), -Math.acos(clamped)];

  let fallback: number[] | null = null;

  for (const elbow of branches) {
    const k1 = l1 + l2 * Math.cos(elbow);
    const k2 = l2 * Math.sin(elbow);
    const lift = Math.atan2(zw, rw) - Math.atan2(k2, k1);
    const wristFlex = approach - lift - elbow;

    // Preserve the current wrist roll and gripper opening when we have them,
    // so IK never spuriously spins the wrist mid-trajectory.
    const roll = currentJoints?.[4] ?? 0;
    const grip = currentJoints?.[5] ?? 0;

    const joints = [pan, lift, elbow, wristFlex, roll, grip];

    if (withinLimits(joints)) {
      return { ok: true, joints };
    }
    fallback ??= joints;
  }

  return { ok: false, reason: "joint-limits" };
}

/**
 * Whether a world point is solvable for an arm at the given approach angle.
 * Used by the planner for reach tests, so planning and execution agree.
 */
export function isReachable(
  target: Vec3,
  base: Vec3,
  approach = -Math.PI / 2,
): boolean {
  return inverseKinematics(target, base, approach).ok;
}

/** Smoothstep easing, used to interpolate between joint waypoints. */
export function ease(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

/** Per-joint linear interpolation with smoothstep timing. */
export function interpolateJoints(
  from: number[],
  to: number[],
  t: number,
): number[] {
  const e = ease(t);
  return from.map((q, i) => q + ((to[i] ?? q) - q) * e);
}

/**
 * World-space positions of each joint, for rendering the arm as a polyline.
 * Returns [base, shoulder, elbow, wrist, tip].
 */
export function jointPositions(joints: number[], base: Vec3): Vec3[] {
  const [pan = 0, lift = 0, elbow = 0, wristFlex = 0] = joints;
  const a1 = lift;
  const a2 = lift + elbow;
  const a3 = lift + elbow + wristFlex;

  const points: Vec3[] = [vec3(base.x, base.y, 0)];
  let r = 0;
  let z = LINKS.base;
  points.push(vec3(base.x, base.y, z));

  const segments: Array<[number, number]> = [
    [LINKS.upperArm, a1],
    [LINKS.forearm, a2],
    [LINKS.wrist, a3],
  ];

  for (const [length, angle] of segments) {
    r += length * Math.cos(angle);
    z += length * Math.sin(angle);
    points.push(vec3(base.x + r * Math.cos(pan), base.y + r * Math.sin(pan), z));
  }

  return points;
}
