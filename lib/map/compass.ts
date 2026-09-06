/** Screen rotation, in degrees, for an arrow whose unrotated direction is up. */
export function compassAngle(
  originX: number,
  originY: number,
  northX: number,
  northY: number,
) {
  return (Math.atan2(northX - originX, northY - originY) * 180) / Math.PI;
}
