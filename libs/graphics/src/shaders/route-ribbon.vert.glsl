attribute vec2 routeNormal;
attribute float routeProgress;
attribute float routeSide;
attribute float routeKind;
attribute float routeMode;
uniform float routeWidth;
varying float vProgress;
varying float vSide;
varying float vKind;
varying float vMode;
void main() {
  vProgress = routeProgress;
  vSide = routeSide;
  vKind = routeKind;
  vMode = routeMode;
  vec3 point = position;
  point.xy += routeNormal * routeSide * routeWidth;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(point, 1.0);
}
