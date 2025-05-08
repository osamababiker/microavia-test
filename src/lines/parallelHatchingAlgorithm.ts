import {GLOBUS} from "../globus.ts";
import {LonLat} from "@openglobus/og";

/**
 * Generate parallel hatching lines for a polygon.
 * @param options.polygonCoordinates Array of [lon, lat] closing polygon
 * @param options.step Distance between lines in meters
 * @param options.bearing Bearing angle (deg from North)
 * @param options.offset Offset beyond polygon edges in meters
 * @returns Array of arrays of LonLat points representing line segments
 */
export function createParallelHatching(options: {
    polygonCoordinates: number[][][],
    step?: number,
    bearing?: number,
    offset?: number
}): LonLat[][] {
    const { polygonCoordinates, step = 100, bearing = 0, offset = 50 } = options;
    
    console.log("polygonCoordinates", polygonCoordinates);
    
    // Handle the case when polygonCoordinates is an array of polygons
    // We'll just use the first polygon for now
    const coordinates = Array.isArray(polygonCoordinates[0]) && Array.isArray(polygonCoordinates[0][0])
        ? polygonCoordinates[0]  // Use first polygon if it's an array of polygons
        : polygonCoordinates;    // Otherwise use as is
    
    if (!coordinates || coordinates.length < 4) return [];
    
    // Earth radius
    const R = 6371000;
    
    // Compute origin latitude for projection
    const lat0 = coordinates.reduce((sum, p) => sum + p[1], 0) / coordinates.length;
    const lat0Rad = lat0 * Math.PI / 180;
    
    // Precompute rotation
    const bRad = bearing * Math.PI / 180;
    const cosB = Math.cos(bRad), sinB = Math.sin(bRad);
    
    // Project and rotate polygon into 2D meters
    const pts: { x: number; y: number }[] = coordinates.map(([lon, lat]) => {
        const lonRad = lon * Math.PI / 180;
        const latRad = lat * Math.PI / 180;
        // Equirectangular projection
        const x = R * lonRad * Math.cos(lat0Rad);
        const y = R * latRad;
        // Rotate coords by -bearing to align lines vertical
        return {
            x: cosB * x + sinB * y,
            y: -sinB * x + cosB * y
        };
    });
    
    // Compute min/max in rotated frame
    const xs = pts.map(p => p.x);
    const minX = Math.min(...xs) - offset;
    const maxX = Math.max(...xs) + offset;
    
    // Generate x positions
    const lines: LonLat[][] = [];
    for (let x0 = minX; x0 <= maxX; x0 += step) {
        // Find intersections with polygon edges
        const intersects: number[] = [];
        for (let i = 0; i < pts.length - 1; i++) {
            const a = pts[i], b = pts[i + 1];
            if ((x0 < a.x && x0 < b.x) || (x0 > a.x && x0 > b.x) || (a.x === b.x)) continue;
            // Linear interpolation
            const t = (x0 - a.x) / (b.x - a.x);
            const y = a.y + t * (b.y - a.y);
            intersects.push(y);
        }
        intersects.sort((a, b) => a - b);
        // Pair up intersects for segments
        for (let j = 0; j + 1 < intersects.length; j += 2) {
            const y1 = intersects[j] - offset;
            const y2 = intersects[j + 1] + offset;
            // Recover endpoints in original coords: rotate back then inverse project
            const seg: LonLat[] = [[x0, y1], [x0, y2]].map(p => {
                // rotate by bearing
                const xr = cosB * p[0] - sinB * p[1];
                const yr = sinB * p[0] + cosB * p[1];
                const lon = (xr / (R * Math.cos(lat0Rad))) * 180 / Math.PI;
                const lat = (yr / R) * 180 / Math.PI;
                return new LonLat(lon, lat);
            });
            lines.push(seg);
        }
    }
    
    return lines;
}
