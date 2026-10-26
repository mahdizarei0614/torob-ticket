uniform vec4 route;
uniform vec4 routeMuted;
uniform vec4 highlight;
uniform vec4 background;
uniform float vehicleMode;
uniform float stopGlow;
varying vec2 vUv;
float capsule(vec2 p, vec2 a, vec2 b, float radius) {
  vec2 pa = p - a, ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)) - radius;
}
float roundBox(vec2 p, vec2 halfSize, float radius) {
  vec2 q = abs(p) - halfSize + radius;
  return min(max(q.x,q.y), 0.0) + length(max(q,0.0)) - radius;
}
void main() {
  vec2 p = vUv;
  float shape;
  float window = 0.0;
  float detail = 0.0;
  float wheel = 0.0;
  if (vehicleMode < 0.5) {
    // Rounded fuselage, swept wings and a distinct tail, all one glass shape.
    shape = capsule(p, vec2(0.0,-0.53), vec2(0.0,0.62), 0.115);
    shape = min(shape, capsule(p,vec2(-0.66,-0.12),vec2(0.0,0.21),0.075));
    shape = min(shape, capsule(p,vec2(0.66,-0.12),vec2(0.0,0.21),0.075));
    shape = min(shape, capsule(p,vec2(-0.28,-0.55),vec2(0.0,-0.42),0.055));
    shape = min(shape, capsule(p,vec2(0.28,-0.55),vec2(0.0,-0.42),0.055));
    window = 1.0 - smoothstep(0.0,0.025,roundBox(p - vec2(0.0,0.39),vec2(0.065,0.12),0.04));
  } else if (vehicleMode < 1.5) {
    // A streamlined side-profile train: swept cab, passenger windows and bogies.
    shape = roundBox(p - vec2(-0.14,0.03),vec2(0.63,0.30),0.12);
    shape = min(shape,capsule(p,vec2(0.40,0.17),vec2(0.68,-0.08),0.17));
    float panes = roundBox(vec2(mod(p.x + 0.71,0.25)-0.125,p.y-0.13),vec2(0.087,0.09),0.035);
    window = (1.0 - smoothstep(0.0,0.022,panes)) * step(-0.68,p.x) * (1.0-step(0.30,p.x));
    window = max(window,1.0-smoothstep(0.0,0.018,capsule(p,vec2(0.40,0.18),vec2(0.57,0.03),0.043)));
    float wheels = min(length(p-vec2(-0.48,-0.29)),length(p-vec2(0.43,-0.29)));
    shape = min(shape,wheels-0.105);
    wheel = 1.0-smoothstep(0.055,0.08,wheels);
    detail = exp(-pow((p.y+0.115)*65.0,2.0)) * (1.0-smoothstep(0.6,0.78,abs(p.x)));
    detail = max(detail,1.0-smoothstep(0.022,0.05,length(p-vec2(0.73,-0.09))));
    shape = min(shape,capsule(p,vec2(-0.35,0.35),vec2(-0.12,0.48),0.022));
    shape = min(shape,capsule(p,vec2(-0.12,0.48),vec2(0.04,0.35),0.022));
    shape = min(shape,capsule(p,vec2(-0.27,0.50),vec2(0.03,0.50),0.025));
  } else {
    // A side-profile coach with a panoramic window row, front door and round wheels.
    shape = roundBox(p - vec2(0.0,0.055),vec2(0.79,0.36),0.14);
    float panes = roundBox(vec2(mod(p.x + 0.70,0.29)-0.145,p.y-0.18),vec2(0.112,0.13),0.037);
    window = (1.0 - smoothstep(0.0,0.02,panes)) * step(-0.68,p.x) * (1.0-step(0.43,p.x));
    window = max(window,1.0-smoothstep(0.0,0.02,roundBox(p-vec2(0.57,0.09),vec2(0.065,0.21),0.035)));
    float wheels = min(length(p-vec2(-0.50,-0.30)),length(p-vec2(0.49,-0.30)));
    shape = min(shape,wheels-0.14);
    wheel = 1.0-smoothstep(0.075,0.1,wheels);
    detail = exp(-pow((p.y+0.10)*58.0,2.0)) * (1.0-smoothstep(0.58,0.74,abs(p.x)));
    detail = max(detail,1.0-smoothstep(0.025,0.055,length(p-vec2(0.72,-0.08))));
    shape = min(shape,capsule(p,vec2(0.73,0.21),vec2(0.85,0.18),0.025));
  }
  float body = 1.0 - smoothstep(-0.015,0.025,shape);
  float rim = exp(-abs(shape) * 57.0);
  float halo = exp(-max(shape,0.0) * 17.0) * 0.13;
  float glass = clamp(0.43 + p.y * 0.3 + p.x * -0.16,0.12,0.78);
  float shine = exp(-pow((p.y-p.x*0.4-0.36)*7.5,2.0));
  vec3 tint = mix(routeMuted.rgb,route.rgb,glass);
  tint = mix(tint,highlight.rgb,clamp(shine*0.62+rim*0.7+detail*0.75,0.0,0.94));
  tint = mix(tint,mix(background.rgb,route.rgb,0.12),window*0.74);
  tint = mix(tint,mix(background.rgb,routeMuted.rgb,0.3),wheel*0.9);
  float alpha = body * 0.95 + halo * (1.0 + stopGlow*0.9);
  gl_FragColor = vec4(tint,clamp(alpha,0.0,1.0));
  #include <colorspace_fragment>
}
