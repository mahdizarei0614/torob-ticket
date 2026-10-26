uniform vec2 mapFadeViewport;
// Left, right, vertical widths in CSS pixels, followed by the consumer-only switch.
uniform vec4 mapFadeInsets;
varying vec2 vMapUv;
float mapEdgeOpacity() {
  if (mapFadeInsets.w < 0.5) return 1.0;
  vec2 pixels = vMapUv * mapFadeViewport;
  float left = smoothstep(0.0, mapFadeInsets.x, pixels.x);
  float right = smoothstep(0.0, mapFadeInsets.y, mapFadeViewport.x - pixels.x);
  float vertical = smoothstep(0.0, mapFadeInsets.z, min(pixels.y, mapFadeViewport.y - pixels.y));
  return left * right * vertical;
}
