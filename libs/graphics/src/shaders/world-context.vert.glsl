varying vec2 vPosition;
varying vec2 vMapUv;
void main() {
  vPosition = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vMapUv = gl_Position.xy / gl_Position.w * 0.5 + 0.5;
}
