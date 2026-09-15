/**
 * Seeded generator for the dinner-table scene.
 *
 * The Intel brief asks for evaluation "across randomized object placement,
 * weights, friction, shapes, lighting, and background conditions". Every one of
 * those axes is driven from the seed here, so `generateScene(n)` is the single
 * source of truth for what seed `n` means.
 *
 * Layout is deliberately arranged so that a meaningful fraction of seeds place
 * at least one required object outside one arm's reach envelope. That is what
 * forces the planner to produce a genuine hand-off rather than two independent
 * single-arm plans.
 */

import { isReachable } from "./kinematics";
import { createRng, type Rng } from "./rng";
import {
  type ArmId,
  type Drawer,
  type ObjectKind,
  type Placemat,
  type Scene,
  type SceneConfig,
  type SceneObject,
  type Vec3,
  planarDistance,
  vec3,
} from "./types";

/**
 * Mount points for the two SO-101 arms, at the rear edge of the workspace.
 *
 * The separation is chosen so the two reach envelopes overlap in a band around
 * y = 0 but not at the outer edges. That overlap is the hand-off zone; the
 * non-overlapping edges are what make hand-offs necessary rather than decorative.
 */
export const ARM_BASES: Record<ArmId, Vec3> = {
  A: vec3(0, -0.12, 0),
  B: vec3(0, 0.12, 0),
};

/**
 * Closest the gripper may approach its own base, metres.
 *
 * The real constraint is the elbow stop rather than link length: a target at
 * table height about 0.14 m from the base already demands roughly 2.0 rad of
 * elbow flexion, past the servo limit. So the usable workspace is an annulus
 * with a hole at the centre. IK is the authority — this constant only
 * short-circuits the obvious cases.
 */
export const REACH_MIN = 0.13;

/**
 * Extent of the usable table surface.
 *
 * Note these bounds are a sampling envelope, not a reachability claim: a
 * top-down grasp spends the wrist link vertically, so the true planar reach at
 * table height is around 0.22 m, well inside the arm's 0.32 m full extension.
 * Every candidate position is therefore verified with real IK, never with a
 * radius test.
 */
export const TABLE = {
  minX: 0.07,
  maxX: 0.2,
  minY: -0.28,
  maxY: 0.28,
} as const;

/** Representative height at which table-top objects are grasped. */
const GRASP_PROBE_Z = 0.012;

/** Height at which an object is released onto a placemat. */
const PLACE_PROBE_Z = 0.01;

const OBJECT_SHAPES: Record<
  ObjectKind,
  { halfExtents: Vec3; massKg: number; friction: number }
> = {
  plate: { halfExtents: vec3(0.055, 0.055, 0.008), massKg: 0.25, friction: 0.5 },
  mug: { halfExtents: vec3(0.035, 0.035, 0.045), massKg: 0.18, friction: 0.6 },
  fork: { halfExtents: vec3(0.008, 0.055, 0.004), massKg: 0.04, friction: 0.35 },
  spoon: { halfExtents: vec3(0.009, 0.05, 0.005), massKg: 0.04, friction: 0.35 },
  knife: { halfExtents: vec3(0.007, 0.06, 0.004), massKg: 0.05, friction: 0.35 },
  bottle: { halfExtents: vec3(0.032, 0.032, 0.06), massKg: 0.55, friction: 0.45 },
  napkin: { halfExtents: vec3(0.045, 0.045, 0.003), massKg: 0.01, friction: 0.7 },
};

/**
 * Which arms can physically reach a point, decided by solving IK rather than by
 * a radius heuristic. The planner and executor call the same solver, so a
 * position generated here is guaranteed to be actionable.
 */
export function reachableArms(p: Vec3): ArmId[] {
  const probe = vec3(p.x, p.y, p.z > 0 ? p.z : GRASP_PROBE_Z);
  return (["A", "B"] as const).filter((arm) => {
    if (planarDistance(probe, ARM_BASES[arm]) < REACH_MIN) return false;
    return isReachable(probe, ARM_BASES[arm]);
  });
}

/**
 * Sample a table position that at least one arm can reach.
 * `bias` nudges sampling toward one side so we can deliberately create
 * single-arm-only placements.
 */
function sampleReachablePoint(
  rng: Rng,
  bias: "left" | "right" | "any",
  graspZ: number,
): Vec3 {
  for (let attempt = 0; attempt < 200; attempt++) {
    const x = rng.float(TABLE.minX, TABLE.maxX);
    const yRange: [number, number] =
      bias === "right"
        ? [TABLE.minY, -0.16]
        : bias === "left"
          ? [0.16, TABLE.maxY]
          : [TABLE.minY, TABLE.maxY];
    const y = rng.float(yRange[0], yRange[1]);
    // Validate at the height the object will actually be grasped at: a tall
    // object trades planar reach for height, so a position that works for a
    // plate can be unreachable for a bottle.
    const p = vec3(x, y, graspZ);
    if (reachableArms(p).length > 0) return p;
  }
  // Fall back to a point on the centreline both arms can service.
  return vec3(0.15, 0, graspZ);
}

/** Reject positions that overlap an already-placed object. */
function isClear(p: Vec3, placed: SceneObject[], clearance: number): boolean {
  return placed.every(
    (o) => planarDistance(p, o.position) > clearance,
  );
}

function placeObject(
  rng: Rng,
  kind: ObjectKind,
  id: string,
  placed: SceneObject[],
  config: SceneConfig,
  bias: "left" | "right" | "any",
): SceneObject {
  const shape = OBJECT_SHAPES[kind];
  const graspZ = shape.halfExtents.z;
  let position = sampleReachablePoint(rng, bias, graspZ);
  for (let attempt = 0; attempt < 120; attempt++) {
    if (isClear(position, placed, 0.055)) break;
    position = sampleReachablePoint(rng, bias, graspZ);
  }

  // Per-seed shape jitter: ±12% on each axis, so no two seeds share geometry.
  const jitter = () => rng.float(0.88, 1.12);
  const halfExtents = vec3(
    shape.halfExtents.x * jitter(),
    shape.halfExtents.y * jitter(),
    shape.halfExtents.z * jitter(),
  );

  return {
    id,
    kind,
    position,
    yaw: rng.float(-Math.PI, Math.PI),
    halfExtents,
    massKg: shape.massKg * config.massScale * rng.float(0.85, 1.15),
    friction: shape.friction * config.frictionScale * rng.float(0.9, 1.1),
    location: { type: "table" },
    graspableBy: reachableArms(position),
  };
}

export function generateScene(seed: number): Scene {
  const rng = createRng(seed);

  const config: SceneConfig = {
    seed,
    frictionScale: rng.float(0.7, 1.35),
    massScale: rng.float(0.8, 1.3),
    lighting: rng.float(0.55, 1.25),
    backgroundVariant: rng.int(0, 3),
  };

  // --- Drawers -------------------------------------------------------------
  // The drawer sits at the far edge and holds the cutlery. Which arm can reach
  // its handle varies by seed, which in turn decides whether retrieving cutlery
  // needs a hand-off. Resample until at least one arm can actually service it.
  let drawerPos = vec3(0.19, rng.float(-0.07, 0.07), 0.03);
  for (let attempt = 0; attempt < 60; attempt++) {
    if (reachableArms(drawerPos).length > 0) break;
    drawerPos = vec3(0.19, rng.float(-0.07, 0.07), 0.03);
  }
  const drawers: Drawer[] = [
    {
      id: "drawer-top",
      label: "top drawer",
      position: drawerPos,
      openness: 0,
      travel: 0.06,
      reachableBy: reachableArms(drawerPos),
    },
  ];

  // --- Placemats -----------------------------------------------------------
  // Two settings, one on each side. Each must sit inside exactly one arm's
  // envelope: that asymmetry is what forces a hand-off whenever an object has
  // to cross the table.
  //
  // Reachability is verified with IK rather than assumed. The usable region is
  // an annulus, not a disc — targets too close to a base need more elbow
  // flexion than the joint allows — so a naive offset can land in the hole at
  // the centre and silently make the setting unreachable.
  let matOffset = rng.float(0.17, 0.23);
  let matX = rng.float(0.15, 0.19);
  for (let attempt = 0; attempt < 80; attempt++) {
    const right = reachableArms(vec3(matX, -matOffset, PLACE_PROBE_Z));
    const left = reachableArms(vec3(matX, matOffset, PLACE_PROBE_Z));
    const rightOk = right.length === 1 && right[0] === "A";
    const leftOk = left.length === 1 && left[0] === "B";
    if (rightOk && leftOk) break;
    matOffset = rng.float(0.17, 0.23);
    matX = rng.float(0.15, 0.19);
  }

  const placemats: Placemat[] = [
    {
      id: "mat-right",
      label: "right setting",
      center: vec3(matX, -matOffset, 0),
      halfExtents: vec3(0.1, 0.075, 0.002),
    },
    {
      id: "mat-left",
      label: "left setting",
      center: vec3(matX, matOffset, 0),
      halfExtents: vec3(0.1, 0.075, 0.002),
    },
  ];

  // --- Objects -------------------------------------------------------------
  const objects: SceneObject[] = [];

  // Cutlery starts inside the closed drawer. It is unreachable until opened.
  for (const [i, kind] of (["fork", "spoon"] as const).entries()) {
    const shape = OBJECT_SHAPES[kind];
    objects.push({
      id: `${kind}-1`,
      kind,
      position: vec3(drawerPos.x, drawerPos.y + (i === 0 ? -0.04 : 0.04), 0.04),
      yaw: 0,
      halfExtents: shape.halfExtents,
      massKg: shape.massKg * config.massScale,
      friction: shape.friction * config.frictionScale,
      location: { type: "drawer", drawerId: "drawer-top" },
      graspableBy: [],
    });
  }

  // A plate and a mug on the table. Bias them to opposite sides on roughly
  // half of seeds so a hand-off becomes necessary.
  const forceHandoff = rng.chance(0.55);
  objects.push(
    placeObject(rng, "plate", "plate-1", objects, config, forceHandoff ? "right" : "any"),
  );
  objects.push(
    placeObject(rng, "mug", "mug-1", objects, config, forceHandoff ? "left" : "any"),
  );

  // A bottle used by the pour action, plus an optional napkin as a distractor.
  objects.push(placeObject(rng, "bottle", "bottle-1", objects, config, "any"));
  if (rng.chance(0.5)) {
    objects.push(placeObject(rng, "napkin", "napkin-1", objects, config, "any"));
  }

  return {
    config,
    objects,
    drawers,
    placemats,
    arms: {
      A: { id: "A", joints: restPose(), holding: null, base: ARM_BASES.A },
      B: { id: "B", joints: restPose(), holding: null, base: ARM_BASES.B },
    },
  };
}

/** Neutral joint configuration both arms start from. */
export function restPose(): number[] {
  return [0, -0.6, 1.2, -0.6, 0, 0];
}

/** Deep clone so the executor can mutate a scene without touching the original. */
export function cloneScene(scene: Scene): Scene {
  return structuredClone(scene);
}
