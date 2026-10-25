uniform vec4 dot;
uniform vec4 highlight;
uniform vec4 focus;
varying float vEmphasis;
void main() {
  if (length(gl_PointCoord - vec2(0.5)) > 0.5) discard;
  gl_FragColor = vEmphasis > 1.5 ? focus : vEmphasis > 0.5 ? highlight : dot;
  #include <colorspace_fragment>
}
