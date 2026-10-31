uniform vec4 dot;
uniform vec4 highlight;
uniform vec4 focus;
uniform vec4 route;
uniform float atmosphere;
uniform float geographyOpacity;
uniform float time;
uniform float motionReduced;
varying float vEmphasis;
varying float vGeography;
varying float vHover;
varying float vBreath;
varying float vLife;
void main() {
  float radius = length(gl_PointCoord - vec2(0.5));
  if (radius > 0.5) discard;
  if (atmosphere < 0.5) {
    gl_FragColor = vGeography > 0.5 ? dot : vEmphasis > 1.5 ? focus : vEmphasis > 0.5 ? highlight : dot;
  } else {
    float core = 1.0 - smoothstep(0.10,0.19,radius);
    float halo = exp(-radius * radius * 22.0) * (0.14 + vHover * 0.085);
    float strength = vGeography>0.5?clamp(vBreath+vHover*0.10,0.58,0.90):clamp(vBreath + vEmphasis * 0.23 + vHover * 0.13,0.0,1.0);
    vec3 tint = vGeography>0.5?mix(dot.rgb,route.rgb,clamp(vHover*0.12+min(vEmphasis,1.0)*0.10,0.0,0.22)):mix(dot.rgb,highlight.rgb,clamp(vHover * 0.22 + min(vEmphasis,1.0) * 0.38,0.0,1.0));
    float alpha = (core * strength + halo) * dot.a;
    if(vGeography>0.5)alpha=min(0.94,alpha);
    if (vEmphasis > 1.5) {
      float settled = motionReduced > 0.5 ? 1.0 : 1.0 - exp(-time * 5.5);
      float ring = exp(-pow((radius - (0.17 + settled * 0.19)) * 48.0,2.0));
      core = 1.0 - smoothstep(0.055,0.10,radius);
      halo = exp(-radius * radius * 21.0) * 0.35;
      tint = mix(route.rgb,highlight.rgb,core * 0.72 + ring * 0.35);
      alpha = (core + ring * 0.42 + halo) * min(1.0,0.45+settled);
    }
    gl_FragColor = vec4(tint,clamp(alpha,0.0,1.0));
  }
  if (vEmphasis < 0.5) gl_FragColor.a *= geographyOpacity;
  gl_FragColor.a *= vLife;
  gl_FragColor.a *= mix(1.0, mapEdgeOpacity(), vGeography);
  #include <colorspace_fragment>
}
