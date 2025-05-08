// ui-controls.ts
import { GLOBUS } from "./globus.ts";
import { LINE_LAYER } from "./lines/layer.ts";
import { Line } from "./lines/line.ts";
import { createParallelHatching } from "./lines/parallelHatchingAlgorithm.ts";

// Store the current polygon coordinates
let currentPolygonCoords: number[][] | null = null;

/**
 * Creates and adds a UI widget to control hatching parameters
 */
export function createControlWidget(): void {
  // Create widget container
  const widget = document.createElement('div');
  widget.className = 'hatching-controls';
  widget.style.cssText = `
    position: absolute;
    top: 10px;
    right: 10px;
    background: white;
    padding: 10px;
    border-radius: 5px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    z-index: 1000;
  `;
  
  // Add title
  const title = document.createElement('h3');
  title.textContent = 'Line Settings';
  title.style.margin = '0 0 10px 0';
  widget.appendChild(title);
  
  // Default values
  const defaults = {
    step: 100,
    bearing: 0,
    offset: 50
  };
  
  // Create sliders for each parameter
  const parameters = [
    { name: 'step', label: 'Spacing (m)', min: 10, max: 500, step: 10 },
    { name: 'bearing', label: 'Angle (°)', min: 0, max: 360, step: 5 },
    { name: 'offset', label: 'Offset (m)', min: 0, max: 200, step: 10 }
  ];
  
  const values: { [key: string]: number } = { ...defaults };
  
  // Create UI elements for each parameter
  parameters.forEach(param => {
    const container = document.createElement('div');
    container.style.marginBottom = '10px';
    
    // Label
    const label = document.createElement('label');
    label.textContent = `${param.label}: `;
    label.setAttribute('for', `hatching-${param.name}`);
    container.appendChild(label);
    
    // Value display
    const valueDisplay = document.createElement('span');
    valueDisplay.id = `hatching-${param.name}-value`;
    valueDisplay.textContent = `${defaults[param.name as keyof typeof defaults]}`;
    valueDisplay.style.marginLeft = '5px';
    container.appendChild(valueDisplay);
    
    // Slider
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.id = `hatching-${param.name}`;
    slider.min = param.min.toString();
    slider.max = param.max.toString();
    slider.step = param.step.toString();
    slider.value = defaults[param.name as keyof typeof defaults].toString();
    slider.style.width = '100%';
    slider.style.margin = '5px 0';
    
    // Update value on change
    slider.addEventListener('input', () => {
      const value = Number(slider.value);
      values[param.name] = value;
      valueDisplay.textContent = value.toString();
      
      // Only redraw if we have a polygon selected
      if (currentPolygonCoords) {
        updateLines();
      }
    });
    
    container.appendChild(slider);
    widget.appendChild(container);
  });
  
  // Add the widget to the document
  document.body.appendChild(widget);
  
  // Update function for when parameters change
  function updateLines() {
    if (!currentPolygonCoords) return;
    
    try {
      // Clear previous lines
      LINE_LAYER.clear();
      
      // Generate new hatching lines with current parameters
      const lines = createParallelHatching(
        currentPolygonCoords,
        values.step,
        values.bearing,
        values.offset
      );
      
      // Draw the lines using your existing pattern
      lines.forEach((line) => {
        for (let i = 0; i < line.length; i += 2) {
          const ll1 = line[i];
          const ll2 = line[i + 1];
          if (ll1 && ll2) {
            LINE_LAYER.add(new Line([[ll1.lon, ll1.lat], [ll2.lon, ll2.lat]]));
          }
        }
      });
    } catch (error) {
      console.error("Error updating lines:", error);
    }
  }
}

/**
 * Set the current polygon coordinates and redraw lines
 * @param coordinates - The coordinates of the polygon
 */
export function setCurrentPolygon(coordinates: number[][]) {
  try {
    // Store the coordinates for later use
    currentPolygonCoords = coordinates;
    
    // Clear previous lines
    LINE_LAYER.clear();
    
    // Get current parameter values from sliders
    const stepSlider = document.getElementById('hatching-step') as HTMLInputElement;
    const bearingSlider = document.getElementById('hatching-bearing') as HTMLInputElement;
    const offsetSlider = document.getElementById('hatching-offset') as HTMLInputElement;
    
    if (stepSlider && bearingSlider && offsetSlider) {
      const params = {
        step: Number(stepSlider.value),
        bearing: Number(bearingSlider.value),
        offset: Number(offsetSlider.value)
      };
      
      // Generate new hatching lines
      const lines = createParallelHatching(
        coordinates,
        params.step,
        params.bearing,
        params.offset
      );
      
      // Draw the lines
      lines.forEach((line) => {
        for (let i = 0; i < line.length; i += 2) {
          const ll1 = line[i];
          const ll2 = line[i + 1];
          if (ll1 && ll2) {
            LINE_LAYER.add(new Line([[ll1.lon, ll1.lat], [ll2.lon, ll2.lat]]));
          }
        }
      });
    } else {
      console.warn("UI controls not found. Make sure to call createControlWidget first.");
    }
  } catch (error) {
    console.error("Error setting polygon:", error);
  }
}