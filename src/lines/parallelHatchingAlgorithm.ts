import {LonLat} from "@openglobus/og";


export function createParallelHatching(
    polygonCoordinates: number[][][],
    lineSpacing?: number,
    lineAngle?: number,
    lineExtension?: number): LonLat[][] {
    
    const polygonPoints = Array.isArray(polygonCoordinates[0]) && Array.isArray(polygonCoordinates[0][0])
        ? polygonCoordinates[0]  
        : polygonCoordinates; 
    
    if (!polygonPoints || polygonPoints.length < 4) return [];
    
    // defain earth radius
    const earthRadius = 6371000;
    
    // we need to calculate a reference latitude for projecting the curved Earth surface onto a flat plane
    // will use javascript reduce function to get the total of polygon poits and then will get the average
    const avgLatitude = polygonPoints.reduce((sum, point) => sum + point[1], 0) / polygonPoints.length;

    // we need to convert the the calculated average from degree to radians for typescript x * ()
    const avgLatitudeRadians = avgLatitude * Math.PI / 180;
    
    // here I need to convert the angle also from degree to radians 
    const angleRadians = lineAngle * Math.PI / 180;

    // I need to calculate the cos and sin to be used later for rotation 
    // will calculated one time to improve performance
    const cosAngle = Math.cos(angleRadians);
    const sinAngle = Math.sin(angleRadians);
    
    // transform our polygon coordinates to (x,y) and rotate them using our sin and cos angle 
    const projectedPoints = polygonPoints.map(([longitude, latitude]) => {
        const longitudeRadians = longitude * Math.PI / 180;
        const latitudeRadians = latitude * Math.PI / 180;

        const transformedX = earthRadius * longitudeRadians * Math.cos(avgLatitudeRadians);
        const transformedY = earthRadius * latitudeRadians;
        
        return {
            x: cosAngle * transformedX + sinAngle * transformedY,
            y: -sinAngle * transformedX + cosAngle * transformedY
        };
    });
    
    // we need to find the horizontal bounds of the rotated polygon
    // will use the lineExtension so lines will extend slightly beyond the pplygon 
    const allXCoordinates = projectedPoints.map(point => point.x);
    const leftBoundary = Math.min(...allXCoordinates) - lineExtension;
    const rightBoundary = Math.max(...allXCoordinates) + lineExtension;
    
    const hatchingLines = [];
    
    // loop using the leftBoundary and rightBoundary to create lines from left to right
    for (let linePosition = leftBoundary; linePosition <= rightBoundary; linePosition += lineSpacing) {
        const intersectionPoints = [];
        
        // will check each edge of the polygon
        // asume the polygon is closed so the last point should be the same as the first point
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
        
        // to sort intersection points from top to bottom
        intersectionPoints.sort((a, b) => a - b);
        
        // create lines 
        for (let pairIndex = 0; pairIndex + 1 < intersectionPoints.length; pairIndex += 2) {
            const segmentStart = intersectionPoints[pairIndex] - lineExtension;
            const segmentEnd = intersectionPoints[pairIndex + 1] + lineExtension;
            
            // will convert line back to geographic coordinates
            const lineSegment = [[linePosition, segmentStart], [linePosition, segmentEnd]].map(point => {
                // rotate back to original orientation
                const rotatedX = cosAngle * point[0] - sinAngle * point[1];
                const rotatedY = sinAngle * point[0] + cosAngle * point[1];
                
                // convert back to longitude/latitude
                const longitude = (rotatedX / (earthRadius * Math.cos(avgLatitudeRadians))) * 180 / Math.PI;
                const latitude = (rotatedY / earthRadius) * 180 / Math.PI;
                
                return new LonLat(longitude, latitude);
            });
            
            hatchingLines.push(lineSegment);
        }
    }
    
    return hatchingLines;
}
