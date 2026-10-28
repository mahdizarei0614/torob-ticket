uniform vec4 dot;
uniform vec4 highlight;
uniform float layer;
uniform float time;
uniform float unitsPerPixel;
uniform float dotDriftAmplitude;
uniform vec4 levelWeights;
uniform float centralLongitude;
uniform float baseSpacing;
uniform vec4 latticeSpacings;
uniform vec2 gridOrigin;
uniform vec4 trailSamples[16];
uniform float mapOpacity;
varying vec2 vPosition;
float trailAt(vec2 position) {
  float strength = 0.0;
  for (int i = 0; i < 16; i++) {
    vec4 tracePoint = trailSamples[i];
    if (tracePoint.w > 0.0001) {
      float radial = 1.0 - smoothstep(0.0, tracePoint.z, distance(position, tracePoint.xy));
      strength = max(strength, radial * tracePoint.w);
    }
  }
  return strength;
}
vec4 lattice(float spacing, float proximity) {
  vec2 absolutePosition = vPosition + vec2(centralLongitude, 0.0);
  vec2 cell = floor((absolutePosition - gridOrigin) / spacing + 0.5);
  float alpha = 0.0;
  float amplitude = min(dotDriftAmplitude, max(0.0, (spacing / unitsPerPixel * 2.5 - 2.0) / 0.70710678118));
  // A moving center can leave its static cell. Neighbor evaluation keeps the
  // complete dot visible across cell boundaries, including the world overview.
  for (int y = -2; y <= 2; y++) for (int x = -2; x <= 2; x++) {
    vec2 center = (cell + vec2(float(x), float(y))) * spacing + gridOrigin;
    vec2 separation = (absolutePosition - center) / unitsPerPixel;
    if (any(greaterThan(abs(separation), vec2(amplitude * 0.70710678118 + 2.0)))) continue;
    vec3 particle = livingDotParticle(center, time, amplitude);
    if (particle.z < 0.0001) continue;
    float radius = length(separation - particle.xy);
    float phase = sin(center.x * 12.9898 + center.y * 78.233) * 6.283185;
    float core = 1.0 - smoothstep(0.75, 1.45 + proximity * 0.14, radius);
    float halo = exp(-radius * radius * 0.8) * (0.06 + proximity * 0.07);
    float breath = 0.66 + 0.19 * sin(time * 0.43 + phase) + 0.07 * sin(time * 0.19 - phase * 1.7);
    alpha = max(alpha, (core * min(1.0, breath + proximity * 0.13) + halo) * dot.a * particle.z);
  }
  return vec4(mix(dot.rgb, highlight.rgb, proximity * 0.22), alpha);
}
void main() {
  if (layer < 0.5) {
    gl_FragColor = vec4(dot.rgb, dot.a * 0.32);
  } else {
    float trace = trailAt(vPosition);
    vec4 a=vec4(0.0),b=vec4(0.0),c=vec4(0.0),d=vec4(0.0);
    // Only the one or two visible density levels need fragment work.
    if (levelWeights.x > 0.0001) a=lattice(baseSpacing,trace);
    if (levelWeights.y > 0.0001) b=lattice(latticeSpacings.y,trace);
    if (levelWeights.z > 0.0001) c=lattice(latticeSpacings.z,trace);
    if (levelWeights.w > 0.0001) d=lattice(latticeSpacings.w,trace);
    vec4 levels = vec4(a.a,b.a,c.a,d.a) * levelWeights;
    float alpha = levels.x + levels.y + levels.z + levels.w;
    vec3 color = (a.rgb*levels.x+b.rgb*levels.y+c.rgb*levels.z+d.rgb*levels.w)/max(0.0001,alpha);
    gl_FragColor = vec4(color,alpha);
  }
  gl_FragColor.a *= mapOpacity * mapEdgeOpacity();
  #include <colorspace_fragment>
}
