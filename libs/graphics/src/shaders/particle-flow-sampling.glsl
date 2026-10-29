uniform sampler2D particleFlowState;
uniform vec4 particleFlowFrame;
uniform vec2 particleFlowViewport;
uniform float particleFlowActive;
vec2 particleFlowOffset(vec2 anchor, float unit, float amplitude, float spacingPx, vec2 drift) {
  float budget=max(0.0,min(12.0,spacingPx*2.5-2.0-amplitude*0.70710678118));
  if(particleFlowActive<0.5||budget<=0.0)return vec2(0.0);
  vec2 uv=(anchor+drift*unit-particleFlowFrame.xy)/particleFlowFrame.zw+0.5;
  if(any(lessThan(uv,vec2(0.0)))||any(greaterThan(uv,vec2(1.0))))return vec2(0.0);
  vec2 raw=texture2D(particleFlowState,uv).rg;
  uint seed=livingDotHash(uint(int(floor(anchor.x*128.0+0.5))) ^ livingDotHash(uint(int(floor(anchor.y*128.0+0.5)))+0x9e3779b9u));
  float angle=(float(seed&65535u)/65535.0-0.5)*0.42;
  float strength=0.84+float(seed>>16u)/65535.0*0.28;
  vec2 offset=vec2(raw.x*cos(angle)-raw.y*sin(angle),raw.x*sin(angle)+raw.y*cos(angle))*strength;
  float edge=min(min(uv.x,uv.y),min(1.0-uv.x,1.0-uv.y));
  return offset*budget/sqrt(budget*budget+dot(offset,offset))*smoothstep(0.0,0.035,edge);
}
