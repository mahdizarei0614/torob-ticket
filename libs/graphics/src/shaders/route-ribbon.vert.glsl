attribute vec2 routeNormal;
attribute float routeProgress;
attribute float routeSide;
attribute float routeKind;
attribute float routeMode;
attribute float routeLeg;
attribute float routeOverlap;
uniform float routeWidth;
uniform float routeLaneWidth;
varying float vProgress;
varying float vSide;
varying float vKind;
varying float vMode;
varying float vLeg;
void main() {
  vProgress = routeProgress;
  vSide = routeSide;
  vKind = routeKind;
  vMode = routeMode;
  vLeg = routeLeg;
  vec3 point = position;
  point.xy += routeNormal * (routeSide * routeWidth + routeOverlap * routeLaneWidth);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(point, 1.0);
}
