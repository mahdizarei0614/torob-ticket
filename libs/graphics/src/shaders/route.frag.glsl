uniform vec4 route;
uniform vec4 routeMuted;
uniform vec4 focus;
uniform float reveal;
varying float vProgress;
varying float vKind;
void main() {
  if (vProgress > reveal) discard;
  gl_FragColor = vKind > 1.5 ? focus : vKind > 0.5 ? routeMuted : route;
  #include <colorspace_fragment>
}
