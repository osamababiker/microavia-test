import {GLOBUS} from "../globus.ts";
import {LonLat} from "@openglobus/og";

/**
 * Generate parallel hatching lines for a polygon.
 * @param options.polygonCoordinates Array of [lon, lat] closing polygon
 * @param options.lineSpacing Distance between lines in meters
 * @param options.lineAngle Bearing angle (deg from North)
 * @param options.lineExtension Offset beyond polygon edges in meters
 * @returns Array of arrays of LonLat points representing line segments
 */
export function createParallelHatching(options: {
    polygonCoordinates: number[][][],
    lineSpacing?: number,
    lineAngle?: number,
    lineExtension?: number
}): LonLat[][] {
    const { 
        polygonCoordinates, 
        lineSpacing = 100, 
        lineAngle = 0, 
        lineExtension = 50 
    } = options;
    
    console.log("polygonCoordinates", polygonCoordinates);
    
    // Handle the case when polygonCoordinates is an array of polygons
    // We'll just use the first polygon for now
    const polygonPoints = Array.isArray(polygonCoordinates[0]) && Array.isArray(polygonCoordinates[0][0])
        ? polygonCoordinates[0]  // Use first polygon if it's an array of polygons
        : polygonCoordinates;    // Otherwise use as is
    
    if (!polygonPoints || polygonPoints.length < 4) return [];
    
    // Earth radius in meters
    const earthRadius = 6371000;
    
    // Compute average latitude for projection
    const avgLatitude = polygonPoints.reduce((sum, point) => sum + point[1], 0) / polygonPoints.length;
    const avgLatitudeRadians = avgLatitude * Math.PI / 180;
    
    // Convert line angle to radians and precompute trigonometric values
    const angleRadians = lineAngle * Math.PI / 180;
    const cosAngle = Math.cos(angleRadians);
    const sinAngle = Math.sin(angleRadians);
    
    // Project and rotate polygon into 2D meters
    const projectedPoints = polygonPoints.map(([longitude, latitude]) => {
        const longitudeRadians = longitude * Math.PI / 180;
        const latitudeRadians = latitude * Math.PI / 180;
        
        // Equirectangular projection
        const projectedX = earthRadius * longitudeRadians * Math.cos(avgLatitudeRadians);
        const projectedY = earthRadius * latitudeRadians;
        
        // Rotate coordinates to align with desired line angle
        return {
            x: cosAngle * projectedX + sinAngle * projectedY,
            y: -sinAngle * projectedX + cosAngle * projectedY
        };
    });
    
    // Find the horizontal bounds of the rotated polygon
    const allXCoordinates = projectedPoints.map(point => point.x);
    const leftBoundary = Math.min(...allXCoordinates) - lineExtension;
    const rightBoundary = Math.max(...allXCoordinates) + lineExtension;
    
    // Generate hatching lines
    const hatchingLines = [];
    
    // Create lines at regular intervals from left to right
    for (let linePosition = leftBoundary; linePosition <= rightBoundary; linePosition += lineSpacing) {
        // Find intersections with polygon edges
        const intersectionPoints = [];
        
        // Check each edge of the polygon
        for (let edgeIndex = 0; edgeIndex < projectedPoints.length - 1; edgeIndex++) {
            const startPoint = projectedPoints[edgeIndex];
            const endPoint = projectedPoints[edgeIndex + 1];
            
            // Skip if the line doesn't intersect this edge
            if ((linePosition < startPoint.x && linePosition < endPoint.x) || 
                (linePosition > startPoint.x && linePosition > endPoint.x) || 
                (startPoint.x === endPoint.x)) {
                continue;
            }
            
            // Calculate intersection using linear interpolation
            const edgeProgress = (linePosition - startPoint.x) / (endPoint.x - startPoint.x);
            const intersectionY = startPoint.y + edgeProgress * (endPoint.y - startPoint.y);
            intersectionPoints.push(intersectionY);
        }
        
        // Sort intersection points from top to bottom
        intersectionPoints.sort((a, b) => a - b);
        
        // Create line segments between pairs of intersection points
        for (let pairIndex = 0; pairIndex + 1 < intersectionPoints.length; pairIndex += 2) {
            const segmentStart = intersectionPoints[pairIndex] - lineExtension;
            const segmentEnd = intersectionPoints[pairIndex + 1] + lineExtension;
            
            // Convert line segment back to geographic coordinates
            const lineSegment = [[linePosition, segmentStart], [linePosition, segmentEnd]].map(point => {
                // Rotate back to original orientation
                const rotatedX = cosAngle * point[0] - sinAngle * point[1];
                const rotatedY = sinAngle * point[0] + cosAngle * point[1];
                
                // Convert back to longitude/latitude
                const longitude = (rotatedX / (earthRadius * Math.cos(avgLatitudeRadians))) * 180 / Math.PI;
                const latitude = (rotatedY / earthRadius) * 180 / Math.PI;
                
                return new LonLat(longitude, latitude);
            });
            
            hatchingLines.push(lineSegment);
        }
    }
    
    return hatchingLines;
}
