/**
 * Core world model for the DUET bimanual dinner-table domain.
 *
 * Units are SI: metres, radians, kilograms. The table surface is the z = 0
 * plane, +x points away from the operator, +y points to the operator's left,
 * +z is up. Both arms are mounted at the rear edge of the workspace.
 */

export type Vec3 = { x: number; y: number; z: number };

export const ARMS = ["A", "B"] as const;
/** Arm A is mounted on the operator's right, arm B on the left. */
export type ArmId = (typeof ARMS)[number];

export const OBJECT_KINDS = [
  "plate",
  "mug",
  "fork",
  "spoon",
  "knife",
  "bottle",
  "napkin",
] as const;
export type ObjectKind = (typeof OBJECT_KINDS)[number];

/**
 * Where an object currently lives. Objects inside a closed drawer are
 * unreachable until that drawer is opened — the planner relies on this.
 */
export type ObjectLocation =
  | { type: "table" }
  | { type: "drawer"; drawerId: string }
  | { type: "held"; arm: ArmId };

export type SceneObject = {
  id: string;
  kind: ObjectKind;
  /** Centre of the object in world coordinates. */
  position: Vec3;
  /** Rotation about +z, radians. */
  yaw: number;
  /** Axis-aligned half-extents used for reach and collision tests. */
  halfExtents: Vec3;
  massKg: number;
  /** Surface friction coefficient. Randomised per seed for robustness testing. */
  friction: number;
  location: ObjectLocation;
  /**
   * True when the object can only be grasped by one specific arm because of
   * its position — used to force hand-offs in the planner.
   */
  graspableBy: ArmId[];
};

export type Drawer = {
  id: string;
  label: string;
  /** Front-face centre when fully closed. */
  position: Vec3;
  /** 0 = fully closed, 1 = fully open. */
  openness: number;
  /** How far the drawer slides along -x when opened, metres. */
  travel: number;
  /** Which arm can physically reach the handle. */
  reachableBy: ArmId[];
};

/** A named region of the table that the task specification refers to. */
export type Placemat = {
  id: string;
  label: string;
  center: Vec3;
  halfExtents: Vec3;
};

export type ArmState = {
  id: ArmId;
  /** Joint angles in radians, base-to-wrist. See kinematics.ts for the model. */
  joints: number[];
  /** Object id currently grasped, or null. */
  holding: string | null;
  /** Mount point of the arm base in world coordinates. */
  base: Vec3;
};

export type SceneConfig = {
  seed: number;
  /** Multiplier applied to all object friction values. */
  frictionScale: number;
  /** Multiplier applied to all object masses. */
  massScale: number;
  /** Scene lighting intensity, affects the rendered view only. */
  lighting: number;
  /** Table surface tint, affects the rendered view only. */
  backgroundVariant: number;
};

export type Scene = {
  config: SceneConfig;
  objects: SceneObject[];
  drawers: Drawer[];
  placemats: Placemat[];
  arms: Record<ArmId, ArmState>;
};

/** Reasons a plan step can fail, surfaced to the operator verbatim. */
export type FailureReason =
  | "unreachable"
  | "occupied"
  | "drawer-closed"
  | "collision"
  | "slipped"
  | "no-such-object"
  | "ambiguous";

export type Vec3Like = Readonly<Vec3>;

export function vec3(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

export function distance(a: Vec3Like, b: Vec3Like): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function planarDistance(a: Vec3Like, b: Vec3Like): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Human-readable article + name, e.g. "the blue mug". */
export function describeObject(o: SceneObject): string {
  return `the ${o.kind}`;
}
