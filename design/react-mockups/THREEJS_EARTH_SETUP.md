# Three.js Photorealistic Earth Implementation

## Overview
The `AcquisitionsGlobeEarth` component now features a photorealistic Three.js-rendered Earth sphere with NASA textures, dynamic day/night shading, specular ocean reflections, and atmospheric rim glow effects.

## Technology Stack
- **Three.js r128** - 3D graphics library
- **Custom GLSL Shaders** - For day/night transition and atmospheric effects
- **NASA Textures** - High-resolution satellite imagery

## Installation

### 1. Install Dependencies
```bash
cd design/react-mockups
npm install
```

This installs Three.js and @types/three as specified in package.json.

### 2. Download Textures
The Earth rendering requires NASA satellite texture maps. Download them to `/public/assets/textures/`:

```bash
cd public/assets/textures/

# Day texture (Earth's daytime appearance)
curl -o earth_day.jpg "https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_atmos_2048.jpg"

# Night texture (City lights)
curl -o earth_night.png "https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_lights_2048.png"

# Specular map (Ocean reflectivity)
curl -o earth_specular.jpg "https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_specular_2048.jpg"

# Normal map (Surface detail)
curl -o earth_normal.jpg "https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_normal_2048.jpg"

# Clouds texture
curl -o earth_clouds.png "https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_clouds_1024.png"
```

Or download manually from the URLs and save to the textures directory.

### 3. Verify Installation
```bash
npm run dev
```

Navigate to `/examples/acquisitions-globe-earth` to see the photorealistic Earth rendering.

## Architecture

### Components

#### ThreeEarth.tsx
The main Three.js rendering component that:
- Initializes a WebGL scene with proper aspect ratio handling
- Loads NASA textures with fallback support (GitHub CDN as primary, fallback to procedural)
- Creates shader materials for realistic Earth rendering
- Manages camera and rendering loop with demand-driven updates
- Handles window resize events

#### AcquisitionsGlobeEarth.tsx
The page component that:
- Integrates ThreeEarth for base Earth rendering
- Adds data overlays (satellite orbits, ground stations, acquisition footprints)
- Implements camera controls (drag to rotate, scroll to zoom)
- Provides UI for datatake selection

### Shader System

#### Earth Material Shader
**Vertex Shader:** Transforms vertices and passes position/normal/UV data to fragment shader

**Fragment Shader:** 
- Calculates sun-facing angle to determine day/night transition
- Blends day texture (daytime appearance) with night texture (city lights) along terminator line
- Applies cloud overlay with variable opacity
- Computes specular highlights on ocean surfaces based on specular map
- Uses Fresnel-like effect for natural light falloff

**Key Features:**
- Smooth `smoothstep()` interpolation along terminator line (prevents hard shadows)
- Specular calculation based on Blinn-Phong model
- Cloud layer that blends dynamically with day texture

#### Atmosphere Shader
**Vertex Shader:** Passes normalized normal and view position

**Fragment Shader:**
- Fresnel term: `pow(0.6 - dot(normal, viewDir), 2.5)`
- Creates cyan-blue glow around Earth's rim
- Additive blending for authentic atmospheric effect
- Dynamic intensity based on view angle

### Data Overlays

Rendered as Three.js geometries with proper depth sorting:

1. **Satellite Orbits** (`renderOrder: 3-5`)
   - Thin lines showing orbital paths
   - Color-coded per satellite constellation
   - Semi-transparent for visual clarity

2. **Ground Stations** (`renderOrder: 10`)
   - Sphere markers at station coordinates
   - Emissive blue color matching theme
   - Coverage circles as torus geometries

3. **Acquisition Footprints** (`renderOrder: 8-12`)
   - Line segments representing satellite swaths
   - Color-coded by completeness status (green/orange/red)
   - Semi-transparent for layering

### Depth & Rendering Order

The implementation uses Three.js `renderOrder` to ensure proper layering:
```
renderOrder: 0  → Earth sphere (depthWrite: true)
renderOrder: 1  → Atmosphere halo (depthWrite: false, additive blending)
renderOrder: 3-5 → Orbital traces
renderOrder: 8+ → Acquisition footprints
renderOrder: 10 → Station markers
```

Data overlays use `polygonOffset` settings to prevent Z-fighting with the Earth surface.

## Camera Controls

- **Drag (Mouse)**: Rotate the globe
  - Horizontal drag: Rotate around Y axis
  - Vertical drag: Rotate around X axis
  
- **Scroll (Mouse Wheel)**: Zoom in/out
  - Scroll up: Zoom in (min distance: 1.5 radius)
  - Scroll down: Zoom out (max distance: 6 radius)

Camera always looks at Earth's center (0,0,0).

## Performance Optimization

### Demand-Driven Rendering
The renderer uses a clamped frame delta approach:
- Animation frame only triggers when needed (camera movement, clock update)
- Fallback to continuous animation while globe is actively being used
- Stops rendering when tab is not visible (future: add IntersectionObserver)

### Texture Optimization
- Textures loaded with `THREE.SRGBColorSpace` for correct color interpretation
- IcosahedronGeometry used for smooth sphere with fewer vertices than alternatives
- Mipmap generation automatic via TextureLoader

### Memory Management
- Proper disposal of geometries and materials on unmount
- Cached loader prevents duplicate texture loads
- Scene graph organized with named groups for easy cleanup

## Customization

### Adjusting Day/Night Transition
In `earthFragmentShader`, modify the `smoothstep` parameters:
```glsl
float terminator_soft = smoothstep(-0.1, 0.1, terminator);
```
- Smaller range = sharper terminator line
- Larger range = softer twilight zone

### Changing Atmosphere Color
In `atmosphereFragmentShader`, modify:
```glsl
vec3 atmosphereColor = vec3(0.0, 0.78, 0.84);  // Change these RGB values
```

### Adjusting Atmosphere Intensity
Modify the fresnel exponent (higher = more intense edge glow):
```glsl
float fresnel = pow(0.6 - dot(normal, viewDir), 2.5);
                    // ↑ Change exponent (2.0-4.0 typical)
```

### Cloud Opacity
In ThreeEarth component, modify the uniform:
```typescript
cloudOpacity: { value: 0.4 },  // 0.0 (no clouds) to 1.0 (full clouds)
```

## Browser Support
- Requires WebGL 2.0 support
- Tested on Chrome/Chromium, Firefox, Safari (with WebGL enabled)
- Mobile devices with WebGL acceleration work well

## Troubleshooting

### Black/Empty Canvas
1. Check browser console for shader compilation errors
2. Verify textures are loading (Network tab in DevTools)
3. Ensure WebGL is enabled in browser settings
4. Check that `/public/assets/textures/` files exist

### Performance Issues
1. Reduce geometry detail: Change `64` to `32` in IcosahedronGeometry
2. Disable cloud overlay: Set `cloudOpacity` to `0.0`
3. Reduce data overlay count: Limit ACQ_DATATAKES in loop

### Texture Quality
- Textures look dim: Check colorSpace settings (should be `SRGBColorSpace`)
- Colors inverted: Verify texture format matches expectation
- Textures missing: System falls back to procedural pink/cyan placeholder

## Future Enhancements

1. **Bump Mapping**: Use normal map for surface detail without geometry complexity
2. **Atmosphere Scattering**: Rayleigh/Mie scattering for more realistic atmosphere
3. **Time-of-Day**: Animate sun position based on actual UTC time
4. **Data Update Animation**: Smooth transitions when datatake selection changes
5. **Mobile Optimizations**: Touch gestures for mobile users
6. **Post-Processing**: Bloom effect on atmosphere, depth-of-field
7. **Particle Effects**: Solar wind/aurora effects in upper atmosphere

## References

- Three.js Documentation: https://threejs.org/docs/
- NASA Earth Imagery: https://earthobservatory.nasa.gov/
- Three.js Planet Examples: https://github.com/mrdoob/three.js/tree/dev/examples
- WebGL Shader Reference: https://www.khronos.org/opengl/wiki/Core_Language_(GLSL)
