attribute float emphasis;
varying float vEmphasis;
uniform float pointSize;
void main() {
  vEmphasis = emphasis;
  gl_PointSize = pointSize * (emphasis > 0.5 ? 2.4 : 1.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
