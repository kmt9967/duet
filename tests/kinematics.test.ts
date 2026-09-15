import assert from "node:assert/strict";
import { test, describe } from "node:test";

import {
  forwardKinematics,
  inverseKinematics,
  isReachable,
  withinLimits,
  LINKS,
} from "../src/lib/core/kinematics";
import { ARM_BASES } from "../src/lib/core/scene";
import { distance, vec3 } from "../src/lib/core/types";

describe("inverse kinematics", () => {
  test("IK solutions round-trip through FK", () => {
    // Any solved pose must actually put the gripper where we asked.
    const targets = [
      vec3(0.16, -0.19, 0.012),
      vec3(0.15, 0.0, 0.09),
      vec3(0.18, -0.16, 0.05),
    ];

    for (const target of targets) {
      const result = inverseKinematics(target, ARM_BASES.A);
      assert.equal(result.ok, true, `expected a solution for ${JSON.stringify(target)}`);
      if (!result.ok) continue;

      const achieved = forwardKinematics(result.joints, ARM_BASES.A);
      assert.ok(
        distance(achieved, target) < 1e-6,
        `FK(IK(p)) should equal p, off by ${distance(achieved, target)}`,
      );
    }
  });

  test("solutions always respect joint limits", () => {
    const result = inverseKinematics(vec3(0.16, -0.19, 0.012), ARM_BASES.A);
    assert.equal(result.ok, true);
    if (result.ok) assert.ok(withinLimits(result.joints));
  });

  test("rejects targets beyond full extension", () => {
    const far = vec3(0.9, 0, 0.012);
    assert.equal(inverseKinematics(far, ARM_BASES.A).ok, false);
  });

  test("the workspace is an annulus, not a disc", () => {
    // Targets very close to the base need more elbow flexion than the servo
    // allows. This hole is real and the scene generator depends on it.
    const tooClose = vec3(ARM_BASES.A.x + 0.04, ARM_BASES.A.y, 0.012);
    assert.equal(isReachable(tooClose, ARM_BASES.A), false);
  });

  test("planar reach at table height is well under full extension", () => {
    // A top-down grasp spends the wrist link vertically.
    const fullExtension = LINKS.upperArm + LINKS.forearm + LINKS.wrist;
    assert.ok(fullExtension > 0.3);
    const atFullExtension = vec3(fullExtension - 0.01, ARM_BASES.A.y, 0.012);
    assert.equal(isReachable(atFullExtension, ARM_BASES.A), false);
  });
});
