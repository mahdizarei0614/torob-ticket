attribute float routeProgress;
attribute float routeKind;
varying float vProgress;
varying float vKind;
void main() {
  vProgress = routeProgress;
  vKind = routeKind;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
