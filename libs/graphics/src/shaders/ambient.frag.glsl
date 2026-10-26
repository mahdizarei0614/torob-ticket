uniform vec4 route;
uniform vec4 routeMuted;
uniform vec4 focus;
uniform vec4 highlight;
uniform float reveal;
uniform float emphasis;
varying float vProgress;
varying float vKind;
void main() {
  if (vProgress > reveal) discard;
  vec4 base = vKind > 1.5 ? focus : vKind > 0.5 ? routeMuted : route;
  // Host-owned progress supplies a finite accent; no shader clock or idle loop.
  float accent = clamp(emphasis, 0.0, 1.0) * (0.35 + 0.3 * sin(vProgress * 6.283185));
  gl_FragColor = mix(base, highlight, accent);
  #include <colorspace_fragment>
}
