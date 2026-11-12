export const allRoundedCorners = ["front-left", "front-right", "back-right", "back-left"];

export const normalizeRoundedCorners = (roundedCorners) => {
  if (roundedCorners === "all") return new Set(allRoundedCorners);
  if (Array.isArray(roundedCorners)) {
    return new Set(roundedCorners.filter((corner) => allRoundedCorners.includes(corner)));
  }

  return new Set();
};

export const addArcPoints = (points, center, radius, startAngle, endAngle, arcSegments = 16) => {
  for (let index = 1; index <= arcSegments; index += 1) {
    const ratio = index / arcSegments;
    const angle = startAngle + (endAngle - startAngle) * ratio;

    points.push([center[0] + radius * Math.cos(angle), center[1] + radius * Math.sin(angle)]);
  }
};

export const selectiveRoundedRectanglePoints = ({ width, depth, radius, roundedCorners }) => {
  const corners = normalizeRoundedCorners(roundedCorners);
  const effectiveRadius = Math.min(radius, width / 2, depth / 2);

  if (effectiveRadius <= 0 || corners.size === 0) {
    return [
      [0, 0],
      [width, 0],
      [width, depth],
      [0, depth],
    ];
  }

  const points = [];
  const frontLeftRounded = corners.has("front-left");
  const frontRightRounded = corners.has("front-right");
  const backRightRounded = corners.has("back-right");
  const backLeftRounded = corners.has("back-left");

  points.push(frontLeftRounded ? [effectiveRadius, 0] : [0, 0]);
  points.push(frontRightRounded ? [width - effectiveRadius, 0] : [width, 0]);

  if (frontRightRounded) {
    addArcPoints(
      points,
      [width - effectiveRadius, effectiveRadius],
      effectiveRadius,
      -Math.PI / 2,
      0,
    );
  }

  points.push(backRightRounded ? [width, depth - effectiveRadius] : [width, depth]);

  if (backRightRounded) {
    addArcPoints(
      points,
      [width - effectiveRadius, depth - effectiveRadius],
      effectiveRadius,
      0,
      Math.PI / 2,
    );
  }

  points.push(backLeftRounded ? [effectiveRadius, depth] : [0, depth]);

  if (backLeftRounded) {
    addArcPoints(
      points,
      [effectiveRadius, depth - effectiveRadius],
      effectiveRadius,
      Math.PI / 2,
      Math.PI,
    );
  }

  points.push(frontLeftRounded ? [0, effectiveRadius] : [0, 0]);

  if (frontLeftRounded) {
    addArcPoints(
      points,
      [effectiveRadius, effectiveRadius],
      effectiveRadius,
      Math.PI,
      Math.PI * 1.5,
    );
  }

  return points;
};
