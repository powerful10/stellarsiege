(function aimTargetingBootstrap() {
  const TAU = Math.PI * 2;

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function normalizeAngle(angle) {
    let out = Number(angle || 0);
    while (out > Math.PI) out -= TAU;
    while (out < -Math.PI) out += TAU;
    return out;
  }

  function enemyRadius(enemy) {
    const size = Number(enemy && enemy.size);
    return Number.isFinite(size) && size > 0 ? size : 16;
  }

  function selectTargetFromTap(tapPoint, enemies, radius) {
    if (!tapPoint || !Array.isArray(enemies) || enemies.length === 0) return null;
    const baseRadius = Math.max(8, Number(radius) || 0);
    let best = null;
    let bestDist = Infinity;

    enemies.forEach((enemy) => {
      if (!enemy || Number(enemy.hp || 0) <= 0) return;
      if (!Number.isFinite(Number(enemy.x)) || !Number.isFinite(Number(enemy.y))) return;
      const dx = Number(enemy.x) - Number(tapPoint.x || 0);
      const dy = Number(enemy.y) - Number(tapPoint.y || 0);
      const dist = Math.hypot(dx, dy);
      const hitRadius = baseRadius + enemyRadius(enemy) * 0.45;
      if (dist <= hitRadius && dist < bestDist) {
        best = enemy;
        bestDist = dist;
      }
    });

    return best;
  }

  function updateAimTowardsTarget(currentAim, targetPos, smoothing) {
    if (!currentAim || !targetPos) return Number(currentAim && currentAim.angle) || 0;
    const originX = Number(currentAim.x || 0);
    const originY = Number(currentAim.y || 0);
    const currentAngle = Number(currentAim.angle || 0);
    const tx = Number(targetPos.x || 0);
    const ty = Number(targetPos.y || 0);
    const targetAngle = Math.atan2(ty - originY, tx - originX);
    const alpha = clamp(Number(smoothing) || 0, 0, 1);
    const delta = normalizeAngle(targetAngle - currentAngle);
    return normalizeAngle(currentAngle + delta * alpha);
  }

  function findNextTarget(enemies, playerPos, aimDir, coneAngle, maxRange) {
    if (!Array.isArray(enemies) || enemies.length === 0) return null;
    if (!playerPos || !aimDir) return null;

    const range = Math.max(24, Number(maxRange) || 0);
    const halfCone = Math.max(0.01, Number(coneAngle) || 0) * 0.5;
    const rawDirX = Number(aimDir.x || 0);
    const rawDirY = Number(aimDir.y || 0);
    const dirLen = Math.hypot(rawDirX, rawDirY) || 1;
    const dirX = rawDirX / dirLen;
    const dirY = rawDirY / dirLen;
    const px = Number(playerPos.x || 0);
    const py = Number(playerPos.y || 0);

    let best = null;
    let bestScore = Infinity;

    enemies.forEach((enemy) => {
      if (!enemy || Number(enemy.hp || 0) <= 0) return;
      const dx = Number(enemy.x || 0) - px;
      const dy = Number(enemy.y || 0) - py;
      const dist = Math.hypot(dx, dy);
      if (!dist || dist > range) return;

      const nx = dx / dist;
      const ny = dy / dist;
      const dot = clamp(nx * dirX + ny * dirY, -1, 1);
      const angle = Math.acos(dot);
      if (angle > halfCone) return;

      const anglePenalty = halfCone > 0 ? angle / halfCone : 0;
      const score = dist * (1 + anglePenalty * 0.65);
      if (score < bestScore) {
        bestScore = score;
        best = enemy;
      }
    });

    return best;
  }

  window.AimTargeting = {
    selectTargetFromTap,
    updateAimTowardsTarget,
    findNextTarget,
  };
})();
