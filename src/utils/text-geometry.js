import modeling from "@jscad/modeling";

const { extrusions, geometries, measurements, transforms } = modeling;

const pointLineDistance = (point, start, end) => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  return Math.abs(dx * (start.y - point.y) - (start.x - point.x) * dy) / length;
};

const appendPoint = (contour, point) => {
  const previous = contour.at(-1);
  if (!previous || previous[0] !== point.x || previous[1] !== point.y)
    contour.push([point.x, point.y]);
};

const flattenQuadratic = (start, control, end, contour, tolerance, depth = 0) => {
  if (depth === 20 || pointLineDistance(control, start, end) <= tolerance) {
    appendPoint(contour, end);
    return;
  }
  const startControl = { x: (start.x + control.x) / 2, y: (start.y + control.y) / 2 };
  const controlEnd = { x: (control.x + end.x) / 2, y: (control.y + end.y) / 2 };
  const midpoint = {
    x: (startControl.x + controlEnd.x) / 2,
    y: (startControl.y + controlEnd.y) / 2,
  };
  flattenQuadratic(start, startControl, midpoint, contour, tolerance, depth + 1);
  flattenQuadratic(midpoint, controlEnd, end, contour, tolerance, depth + 1);
};

const flattenCubic = (start, firstControl, secondControl, end, contour, tolerance, depth = 0) => {
  const deviation = Math.max(
    pointLineDistance(firstControl, start, end),
    pointLineDistance(secondControl, start, end),
  );
  if (depth === 20 || deviation <= tolerance) {
    appendPoint(contour, end);
    return;
  }
  const startFirst = { x: (start.x + firstControl.x) / 2, y: (start.y + firstControl.y) / 2 };
  const controls = {
    x: (firstControl.x + secondControl.x) / 2,
    y: (firstControl.y + secondControl.y) / 2,
  };
  const secondEnd = { x: (secondControl.x + end.x) / 2, y: (secondControl.y + end.y) / 2 };
  const leftEnd = { x: (startFirst.x + controls.x) / 2, y: (startFirst.y + controls.y) / 2 };
  const rightStart = { x: (controls.x + secondEnd.x) / 2, y: (controls.y + secondEnd.y) / 2 };
  const midpoint = { x: (leftEnd.x + rightStart.x) / 2, y: (leftEnd.y + rightStart.y) / 2 };
  flattenCubic(start, startFirst, leftEnd, midpoint, contour, tolerance, depth + 1);
  flattenCubic(midpoint, rightStart, secondEnd, end, contour, tolerance, depth + 1);
};

export const textContours = (font, value, size, curveToleranceMm = 0.03) => {
  const contours = [];
  let contour;
  let current;
  let penX = 0;
  let previousGlyph;
  const commands = [];
  for (const character of value) {
    const glyph = font.charToGlyph(character);
    if (previousGlyph) {
      penX += (font.getKerningValue(previousGlyph, glyph) * size) / font.unitsPerEm;
    }
    commands.push(...glyph.getPath(penX, 0, size, {}, font).commands);
    penX += (glyph.advanceWidth * size) / font.unitsPerEm;
    previousGlyph = glyph;
  }

  for (const command of commands) {
    if (command.type === "M") {
      if (contour?.length > 2) contours.push(contour);
      contour = [];
      current = { x: command.x, y: command.y };
      appendPoint(contour, current);
    } else if (command.type === "L") {
      current = { x: command.x, y: command.y };
      appendPoint(contour, current);
    } else if (command.type === "Q") {
      const end = { x: command.x, y: command.y };
      flattenQuadratic(current, { x: command.x1, y: command.y1 }, end, contour, curveToleranceMm);
      current = end;
    } else if (command.type === "C") {
      const end = { x: command.x, y: command.y };
      flattenCubic(
        current,
        { x: command.x1, y: command.y1 },
        { x: command.x2, y: command.y2 },
        end,
        contour,
        curveToleranceMm,
      );
      current = end;
    }
  }
  if (contour?.length > 2) contours.push(contour);
  return contours;
};

export const createTextSolid = ({
  font,
  value,
  fontSizeMm = 10,
  extrusionHeightMm = 2,
  widthMm,
  heightMm,
  curveToleranceMm = 0.03,
}) => {
  if (!value?.trim()) return null;
  if (widthMm != null && heightMm != null)
    throw new Error("Specify either widthMm or heightMm, not both.");

  const contours = textContours(font, value, fontSizeMm, curveToleranceMm);
  if (contours.length === 0) return null;
  const outline = geometries.geom2.create(
    contours.flatMap((contour) =>
      contour.map((point, index) => [point, contour[(index + 1) % contour.length]]),
    ),
  );
  let solid = extrusions.extrudeLinear({ height: extrusionHeightMm }, outline);
  const [minimum, maximum] = measurements.measureBoundingBox(solid);
  const targetDimensionMm = widthMm ?? heightMm;
  if (targetDimensionMm != null) {
    if (targetDimensionMm <= 0) throw new Error("Text dimensions must be greater than zero.");
    const currentDimensionMm = widthMm != null ? maximum[0] - minimum[0] : maximum[1] - minimum[1];
    const scale = targetDimensionMm / currentDimensionMm;
    solid = transforms.scale([scale, scale, 1], solid);
  }
  const [scaledMinimum, scaledMaximum] = measurements.measureBoundingBox(solid);
  return transforms.translate(
    [-(scaledMinimum[0] + scaledMaximum[0]) / 2, -(scaledMinimum[1] + scaledMaximum[1]) / 2, 0],
    solid,
  );
};
