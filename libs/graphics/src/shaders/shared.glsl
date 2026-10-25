// All color uniforms are linear RGBA resolved from semantic CSS tokens.
uniform vec4 background;
uniform vec4 route;
uniform vec4 highlight;
uniform float progress;
varying vec2 vUv;
void main() {
  // Deliberately flat diagnostic scene; geography and charts belong to later tasks.
  float line = 1.0 - smoothstep(0.014, 0.024, abs(vUv.y - (0.28 + 0.35 * vUv.x)));
  float marker = 1.0 - smoothstep(0.035, 0.045, length(vUv - vec2(progress, 0.28 + 0.35 * progress)));
  vec4 color = mix(background, route, line);
  color = mix(color, highlight, marker);
  gl_FragColor = color;
  #include <colorspace_fragment>
}
