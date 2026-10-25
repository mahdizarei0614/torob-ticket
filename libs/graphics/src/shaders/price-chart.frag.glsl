uniform vec4 chartLine;
uniform vec4 chartMarker;
uniform vec4 chartGrid;
uniform float selectedX;
uniform float kind;
varying float vX;
void main() {
  vec4 color = kind > 1.5 ? chartGrid : kind > 0.5 && abs(vX - selectedX) < 0.005 ? chartMarker : chartLine;
  gl_FragColor = color;
  #include <colorspace_fragment>
}
