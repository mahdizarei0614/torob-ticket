uniform vec4 dot;
uniform float morphOpacity;
varying float vOpacity;
varying float vGlow;
void main() {
  float radius=length(gl_PointCoord-0.5)*6.0;
  float core=1.0-smoothstep(.75,1.45,radius);
  float halo=exp(-radius*radius*.8)*.04;
  gl_FragColor=vec4(dot.rgb,(core*vGlow+halo)*dot.a*vOpacity*morphOpacity*mapEdgeOpacity());
  #include <colorspace_fragment>
}
