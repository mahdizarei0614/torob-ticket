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
  vec2 center = cell * spacing + gridOrigin;
  vec2 drift = livingDotOffset(center, time, dotDriftAmplitude) * unitsPerPixel;
  float radius = length(absolutePosition - center - drift) / unitsPerPixel;
  float phase = sin(center.x * 12.9898 + center.y * 78.233) * 6.283185;
  float core = 1.0 - smoothstep(0.75, 1.45 + proximity * 0.14, radius);
  float halo = exp(-radius * radius * 0.8) * (0.06 + proximity * 0.07);
  float breath = 0.66 + 0.19 * sin(time * 0.43 + phase) + 0.07 * sin(time * 0.19 - phase * 1.7);
  return vec4(mix(dot.rgb, highlight.rgb, proximity * 0.22), (core * min(1.0,breath + proximity * 0.13) + halo) * dot.a);
}
void main() {
  if (layer < 0.5) {
    gl_FragColor = vec4(dot.rgb, dot.a * 0.32);
  } else {
    float trace = trailAt(vPosition);
    vec4 a=lattice(baseSpacing,trace),b=lattice(latticeSpacings.y,trace),c=lattice(latticeSpacings.z,trace),d=lattice(latticeSpacings.w,trace);
    vec4 levels = vec4(a.a,b.a,c.a,d.a) * levelWeights;
    float alpha = levels.x + levels.y + levels.z + levels.w;
    vec3 color = (a.rgb*levels.x+b.rgb*levels.y+c.rgb*levels.z+d.rgb*levels.w)/max(0.0001,alpha);
    gl_FragColor = vec4(color,alpha);
  }
  gl_FragColor.a *= mapOpacity * mapEdgeOpacity();
  #include <colorspace_fragment>
}
