import './style.css'
import {GLOBUS} from "./globus.ts";
import {Polygon} from "./polygons/polygon.ts";
import {POLYGONS_LAYER} from "./polygons/layer.ts";
import {LINE_LAYER} from "./lines/layer.ts";
import {createControlWidget, setCurrentPolygon} from "./ui-controls.ts";

GLOBUS.planet.addLayer(POLYGONS_LAYER)
GLOBUS.planet.addLayer(LINE_LAYER)

// Create the UI controls for adjusting line parameters
createControlWidget();

POLYGONS_LAYER.events.on('ldblclick', (e: any) => {
    try {
        if (e.pickingObject instanceof Polygon) {
            const polygon = e.pickingObject,
                polygonCoordinates = polygon.coordinates;

            LINE_LAYER.clear()

            setCurrentPolygon(polygonCoordinates);
        }
    } catch (e) {
        console.error(e)
    }
})

const entities = POLYGONS_LAYER.getEntities()
if (entities && entities.length > 0) {
    const lastPoly = entities.pop(),
        extent = lastPoly?.getExtent()

    extent && GLOBUS.planet.camera.flyExtent(extent)
}
