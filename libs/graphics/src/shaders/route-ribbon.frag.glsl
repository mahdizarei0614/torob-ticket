uniform vec4 route;
uniform vec4 routeMuted;
uniform vec4 highlight;
uniform float reveal;
uniform float travel;
uniform float stopGlow;
uniform float strandOpacity;
uniform float headLength;
uniform float tailLength;
varying float vProgress;
varying float vSide;
varying float vKind;
varying float vMode;
void main() {
  if (vProgress > reveal) discard;
  float side = abs(vSide);
  float core;
  float halo = exp(-side * side * 5.0) * 0.14;
  if (vMode > 1.5) {
    // A soft road edge and restrained broken center line.
    float edge = 1.0 - smoothstep(0.055, 0.15, abs(side - 0.38));
    float center = (1.0 - smoothstep(0.025, 0.09, side)) * step(0.4, fract(vProgress * 58.0));
    core = edge * 0.68 + center * 0.64 + (1.0 - smoothstep(0.33, 0.44, side)) * 0.15;
  } else if (vMode > 0.5) {
    core = 1.0 - smoothstep(0.045, 0.15, abs(side - 0.36));
  } else {
    core = 1.0 - smoothstep(0.055, 0.21, side);
  }
  // The tail exists only behind the moving head, making direction legible.
  // Lengths are updated in CSS pixels as the camera eases or zooms.
  float behind = travel - vProgress;
  float tail = exp(-max(0.0,behind) / max(tailLength,0.0001) * 2.5) * (1.0 - smoothstep(0.0,headLength * 0.8,-behind)) * strandOpacity;
  float head = exp(-pow(behind / max(headLength,0.0001),2.0)) * strandOpacity;
  float ray = exp(-side * side * 25.0);
  float spark = exp(-pow(behind / max(headLength * 0.32,0.0001),2.0)) * exp(-side * side * 2.5) * strandOpacity;
  float flare = tail * ray * 0.88 + head * (0.8 + stopGlow * 1.4) + spark * (0.5 + stopGlow * 0.7);
  vec4 base = vKind > 0.5 ? routeMuted : route;
  vec3 light = mix(base.rgb, highlight.rgb, clamp(flare, 0.0, 1.0));
  float alpha = clamp(core * 0.76 + halo + tail * ray * 0.7 + head * ray * 0.8 + spark * (0.52 + stopGlow * 0.4), 0.0, 1.0) * base.a;
  gl_FragColor = vec4(light, alpha);
  #include <colorspace_fragment>
}
