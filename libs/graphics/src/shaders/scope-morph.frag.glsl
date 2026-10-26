uniform vec4 dot;
uniform float morphOpacity;
varying float vOpacity;
void main() {
  float radius=length(gl_PointCoord-0.5)*6.0;
  float core=1.0-smoothstep(.75,1.45,radius);
  float halo=exp(-radius*radius*.8)*.06;
  gl_FragColor=vec4(dot.rgb,(core*.66+halo)*dot.a*vOpacity*morphOpacity);
  #include <colorspace_fragment>
}
