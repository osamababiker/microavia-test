import { LonLat, Vec3, Ellipsoid } from "@openglobus/og";
import { GLOBUS } from "../globus.ts";

/**
 * Creates parallel hatching lines for a polygon
 * @param options.polygonCoordinates - Array of polygon coordinates [lon, lat]
 * @param options.step - Distance between parallel lines in meters (default: 100)
 * @param options.bearing - Orientation of lines in degrees from North (default: 0)
 * @param options.offset - External offset from polygon edges in meters (default: 50)
 * @returns Array of line coordinates as LonLat arrays
 */
export function createParallelHatching(options: {
  polygonCoordinates: number[][],
  step?: number,
  bearing?: number,
  offset?: number
}): LonLat[][] {
  // Extract options with defaults
  const { polygonCoordinates } = options;
  const step = options.step || 100;
  const bearing = options.bearing || 0;
  const offset = options.offset || 50;
  
  // Reference to the ellipsoid for geodesic calculations
  const ellipsoid = GLOBUS.planet.ellipsoid;
  
  // Result array to hold all hatch lines
  const hatchLines: LonLat[][] = [];
  
  // Find the bounding box of the polygon
  const boundingBox = findBoundingBox(polygonCoordinates);
  
  // Calculate the extended bounding box (plus offset)
  const extendedBox = extendBoundingBox(boundingBox, ellipsoid, offset * 2);
  
  // Calculate the perpendicular bearing (90 degrees from the hatch line direction)
  const perpendicularBearing = (bearing + 90) % 360;
  
  // Get the diagonal distance of the bounding box for line length calculation
  const boxCenter = [
    (extendedBox.minLon + extendedBox.maxLon) / 2,
    (extendedBox.minLat + extendedBox.maxLat) / 2
  ];
  const cornerPoint = [extendedBox.minLon, extendedBox.minLat];
  const diagonalDistance = calculateDistance(boxCenter, cornerPoint, ellipsoid) * 2;
  
  // Calculate the width of the box in the perpendicular direction
  // to determine how many lines we need
  const width = calculateBoxWidthInDirection(extendedBox, perpendicularBearing, ellipsoid);
  
  // Calculate number of lines needed
  const numLines = Math.ceil(width / step) + 1;
  
  // Find a starting point at one edge of the bounding box
  const startPoint = calculateStartPoint(boxCenter, perpendicularBearing, width / 2, ellipsoid);
  
  // Generate all the parallel lines
  for (let i = 0; i < numLines; i++) {
    // Calculate current line start position by stepping along the perpendicular direction
    const linePos = calculateDestination(startPoint, (perpendicularBearing + 180) % 360, i * step, ellipsoid);
    
    // Create a line in both directions from this position
    const lineStart = calculateDestination(linePos, (bearing + 180) % 360, diagonalDistance, ellipsoid);
    const lineEnd = calculateDestination(linePos, bearing, diagonalDistance, ellipsoid);
    
    // Find all intersections with the polygon
    const intersections = findPolygonIntersections(
      lineStart, lineEnd, polygonCoordinates, ellipsoid
    );
    
    // Process intersection pairs to create the hatching lines
    if (intersections.length >= 2) {
      // Group intersections in pairs (entry/exit points)
      for (let j = 0; j < intersections.length; j += 2) {
        if (j + 1 < intersections.length) {
          const start = intersections[j];
          const end = intersections[j + 1];
          
          // Calculate offset points (extending the line beyond the polygon)
          const startWithOffset = calculateDestination(
            start, (bearing + 180) % 360, offset, ellipsoid
          );
          const endWithOffset = calculateDestination(
            end, bearing, offset, ellipsoid
          );
          
          // Add the line to the result
          hatchLines.push([
            new LonLat(startWithOffset[0], startWithOffset[1]),
            new LonLat(endWithOffset[0], endWithOffset[1])
          ]);
        }
      }
    }
  }
  
  return hatchLines;
}

/**
 * Finds the bounding box of a polygon
 */
function findBoundingBox(polygon: number[][]): {
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
} {
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  
  for (const point of polygon) {
    minLon = Math.min(minLon, point[0]);
    maxLon = Math.max(maxLon, point[0]);
    minLat = Math.min(minLat, point[1]);
    maxLat = Math.max(maxLat, point[1]);
  }
  
  return { minLon, maxLon, minLat, maxLat };
}

/**
 * Extends a bounding box by a specified distance in meters
 */
function extendBoundingBox(
  box: { minLon: number; maxLon: number; minLat: number; maxLat: number },
  ellipsoid: Ellipsoid,
  distanceMeters: number
): { minLon: number; maxLon: number; minLat: number; maxLat: number } {
  const center = [
    (box.minLon + box.maxLon) / 2,
    (box.minLat + box.maxLat) / 2
  ];
  
  // Extend in all four cardinal directions
  const north = calculateDestination(center, 0, distanceMeters, ellipsoid);
  const east = calculateDestination(center, 90, distanceMeters, ellipsoid);
  const south = calculateDestination(center, 180, distanceMeters, ellipsoid);
  const west = calculateDestination(center, 270, distanceMeters, ellipsoid);
  
  // Calculate the new bounds
  return {
    minLon: box.minLon - (center[0] - west[0]),
    maxLon: box.maxLon + (east[0] - center[0]),
    minLat: box.minLat - (center[1] - south[1]),
    maxLat: box.maxLat + (north[1] - center[1])
  };
}

/**
 * Calculates the width of a bounding box in a specific direction
 */
function calculateBoxWidthInDirection(
  box: { minLon: number; maxLon: number; minLat: number; maxLat: number },
  bearing: number,
  ellipsoid: Ellipsoid
): number {
  const center = [
    (box.minLon + box.maxLon) / 2,
    (box.minLat + box.maxLat) / 2
  ];
  
  // Project all four corners onto the bearing direction
  const corners = [
    [box.minLon, box.minLat],
    [box.maxLon, box.minLat],
    [box.maxLon, box.maxLat],
    [box.minLon, box.maxLat]
  ];
  
  // Find the corner that's furthest in the bearing direction
  let maxDist = -Infinity;
  let minDist = Infinity;
  
  for (const corner of corners) {
    const dist = projectPointOntoDirection(center, corner, bearing, ellipsoid);
    maxDist = Math.max(maxDist, dist);
    minDist = Math.min(minDist, dist);
  }
  
  // Return the width in the bearing direction
  return maxDist - minDist;
}

/**
 * Projects a point onto a direction and returns the scalar projection
 */
function projectPointOntoDirection(
  center: number[], 
  point: number[], 
  bearing: number,
  ellipsoid: Ellipsoid
): number {
  // Convert center and point to cartesian coordinates
  const centerCart = latLonToCartesian(center[1], center[0], ellipsoid);
  const pointCart = latLonToCartesian(point[1], point[0], ellipsoid);
  
  // Calculate direction vector from center based on bearing
  const dirCart = bearingToCartesianDirection(center, bearing, ellipsoid);
  
  // Calculate vector from center to point
  const vecFromCenter = new Vec3(
    pointCart.x - centerCart.x,
    pointCart.y - centerCart.y,
    pointCart.z - centerCart.z
  );
  
  // Project onto the direction
  return Vec3.dot(vecFromCenter, dirCart);
}

/**
 * Calculates a destination point given a start point, bearing, and distance
 */
function calculateDestination(
  start: number[],
  bearing: number,
  distance: number,
  ellipsoid: Ellipsoid
): number[] {
  // Calculate destination using OpenGlobus Ellipsoid
  const startLonLat = new LonLat(start[0], start[1]);
  const destLonLat = ellipsoid.getDestination(startLonLat, bearing, distance);
  
  return [destLonLat.lon, destLonLat.lat];
}

/**
 * Calculates a start point for the hatching algorithm
 */
function calculateStartPoint(
  center: number[],
  bearing: number,
  distance: number,
  ellipsoid: Ellipsoid
): number[] {
  return calculateDestination(center, bearing, distance, ellipsoid);
}

/**
 * Calculates the distance between two points on the ellipsoid
 */
function calculateDistance(
  point1: number[],
  point2: number[],
  ellipsoid: Ellipsoid
): number {
  const lonLat1 = new LonLat(point1[0], point1[1]);
  const lonLat2 = new LonLat(point2[0], point2[1]);
  
  return ellipsoid.getGeodesicDistance(lonLat1, lonLat2);
}

/**
 * Converts latitude and longitude to cartesian coordinates
 */
function latLonToCartesian(
  lat: number,
  lon: number,
  ellipsoid: Ellipsoid
): Vec3 {
  const lonLat = new LonLat(lon, lat);
  return ellipsoid.lonLatToCartesian(lonLat);
}

/**
 * Converts a bearing to a cartesian direction vector
 */
function bearingToCartesianDirection(
  point: number[],
  bearing: number,
  ellipsoid: Ellipsoid
): Vec3 {
  // Get a point a small distance away in the bearing direction
  const dist = 1000; // 1km
  const destPoint = calculateDestination(point, bearing, dist, ellipsoid);
  
  // Convert both points to cartesian
  const startCart = latLonToCartesian(point[1], point[0], ellipsoid);
  const endCart = latLonToCartesian(destPoint[1], destPoint[0], ellipsoid);
  
  // Create direction vector
  const dir = new Vec3(
    endCart.x - startCart.x,
    endCart.y - startCart.y,
    endCart.z - startCart.z
  );
  
  // Normalize
  dir.normalize();
  
  return dir;
}

/**
 * Checks if a point is on a line segment
 */
function isPointOnLineSegment(
  point: number[],
  lineStart: number[],
  lineEnd: number[],
  tolerance: number = 1e-10
): boolean {
  // Calculate vectors
  const vectorLine = [
    lineEnd[0] - lineStart[0],
    lineEnd[1] - lineStart[1]
  ];
  
  const vectorPoint = [
    point[0] - lineStart[0],
    point[1] - lineStart[1]
  ];
  
  // Calculate cross product
  const cross = vectorLine[0] * vectorPoint[1] - vectorLine[1] * vectorPoint[0];
  
  // Check if point is on line (cross product is close to zero)
  if (Math.abs(cross) > tolerance) {
    return false;
  }
  
  // Check if point is within the segment bounds
  const dotProduct = vectorLine[0] * vectorPoint[0] + vectorLine[1] * vectorPoint[1];
  const squaredLength = vectorLine[0] * vectorLine[0] + vectorLine[1] * vectorLine[1];
  
  return dotProduct >= 0 && dotProduct <= squaredLength;
}

/**
 * Finds the intersection point of two line segments
 */
function findIntersection(
  line1Start: number[],
  line1End: number[],
  line2Start: number[],
  line2End: number[]
): number[] | null {
  // Line 1 represented as a1x + b1y = c1
  const a1 = line1End[1] - line1Start[1];
  const b1 = line1Start[0] - line1End[0];
  const c1 = a1 * line1Start[0] + b1 * line1Start[1];
  
  // Line 2 represented as a2x + b2y = c2
  const a2 = line2End[1] - line2Start[1];
  const b2 = line2Start[0] - line2End[0];
  const c2 = a2 * line2Start[0] + b2 * line2Start[1];
  
  // Determinant
  const determinant = a1 * b2 - a2 * b1;
  
  // If lines are parallel, no intersection
  if (Math.abs(determinant) < 1e-10) {
    return null;
  }
  
  // Calculate intersection point
  const x = (b2 * c1 - b1 * c2) / determinant;
  const y = (a1 * c2 - a2 * c1) / determinant;
  
  // Check if intersection is within both line segments
  if (
    isPointOnLineSegment([x, y], line1Start, line1End) &&
    isPointOnLineSegment([x, y], line2Start, line2End)
  ) {
    return [x, y];
  }
  
  return null;
}

/**
 * Finds all intersections of a line with a polygon
 */
function findPolygonIntersections(
  lineStart: number[],
  lineEnd: number[],
  polygon: number[][],
  ellipsoid: Ellipsoid
): number[][] {
  const intersections: number[][] = [];
  
  // Check each polygon edge for intersection
  for (let i = 0; i < polygon.length - 1; i++) {
    const intersection = findIntersection(
      lineStart,
      lineEnd,
      polygon[i],
      polygon[i + 1]
    );
    
    if (intersection) {
      intersections.push(intersection);
    }
  }
  
  // Check the closing edge (last point to first point)
  // if the polygon is not already closed
  if (
    polygon[0][0] !== polygon[polygon.length - 1][0] ||
    polygon[0][1] !== polygon[polygon.length - 1][1]
  ) {
    const intersection = findIntersection(
      lineStart,
      lineEnd,
      polygon[polygon.length - 1],
      polygon[0]
    );
    
    if (intersection) {
      intersections.push(intersection);
    }
  }
  
  // Sort intersections by distance from lineStart
  if (intersections.length > 0) {
    intersections.sort((a, b) => {
      const distA = calculateDistance(lineStart, a, ellipsoid);
      const distB = calculateDistance(lineStart, b, ellipsoid);
      return distA - distB;
    });
  }
  
  return intersections;
}