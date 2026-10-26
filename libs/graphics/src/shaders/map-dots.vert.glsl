attribute float emphasis;
attribute float hoverGlow;
attribute float phase;
varying float vEmphasis;
varying float vHover;
varying float vBreath;
uniform float pointSize;
uniform float atmosphere;
uniform float time;
void main() {
  vEmphasis = emphasis;
  vHover = hoverGlow;
  vBreath = 0.66 + 0.19 * sin(time * 0.43 + phase) + 0.07 * sin(time * 0.19 - phase * 1.7);
  float legacySize = pointSize * (emphasis > 0.5 ? 2.4 : 1.0);
  float size = pointSize * (1.0 + min(emphasis,1.0) * 0.55 + hoverGlow * 0.65);
  if (emphasis > 1.5) size = pointSize * 3.3;
  gl_PointSize = mix(legacySize,size,atmosphere);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
