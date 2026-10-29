// Data-only GPU fluid. All quantities are CSS px / seconds, not UI colors.
precision highp float;
precision highp int;
in vec2 vUv;
out vec4 outputState;
uniform int operation;
uniform sampler2D inputA;
uniform sampler2D inputB;
uniform sampler2D inputC;
uniform vec2 texel;
uniform vec2 viewport;
uniform vec2 previousViewport;
uniform vec4 frame;
uniform vec4 previousFrame;
uniform vec4 stroke;
uniform vec2 strokeVelocity;
uniform float strokeRadius;
uniform float dt;
vec2 oldUv(vec2 uv){return ((frame.xy+(uv-.5)*frame.zw)-previousFrame.xy)/previousFrame.zw+.5;}
bool inside(vec2 uv){return all(greaterThanEqual(uv,vec2(0.0)))&&all(lessThanEqual(uv,vec2(1.0)));}
float scaleRatio(){return (previousFrame.z/previousViewport.x)/(frame.z/viewport.x);}
vec4 previousSample(sampler2D field,vec2 uv){vec2 old=oldUv(uv);return inside(old)?texture(field,old):vec4(0.0);}
vec2 bounded(vec2 value,float limit){float lengthValue=length(value);return value*min(1.0,limit/max(.00001,lengthValue));}
float edgeAt(vec2 uv){return smoothstep(0.0,.045,min(min(uv.x,1.0-uv.x),min(uv.y,1.0-uv.y)));}
vec2 velocityAt(vec2 uv){return texture(inputA,clamp(uv,texel*.5,1.0-texel*.5)).xy;}
float scalarAt(sampler2D field,vec2 uv){return texture(field,clamp(uv,texel*.5,1.0-texel*.5)).x;}
void main(){
 vec2 cell=viewport*texel;
 if(operation==0){
  // Semi-Lagrangian fluid advection; source coordinates reproject camera changes.
  vec2 velocity=previousSample(inputA,vUv).xy*scaleRatio();
  vec2 sourceUv=vUv-velocity*dt/viewport;
  velocity=previousSample(inputA,sourceUv).xy*scaleRatio()*exp(-dt*1.65);
  vec2 p=vUv*viewport,a=stroke.xy*viewport,b=stroke.zw*viewport,ab=b-a;
  float along=clamp(dot(p-a,ab)/max(.0001,dot(ab,ab)),0.0,1.0);
  vec2 radial=p-(a+ab*along);float gaussian=exp(-dot(radial,radial)/max(1.0,strokeRadius*strokeRadius*.42));
  // Directional strokes plus a small signed eddy. No repulsion/exclusion circle.
  float speed=length(strokeVelocity),signValue=sin(a.x*.017+a.y*.023)>=0.0?1.0:-1.0;
  vec2 eddy=vec2(-radial.y,radial.x)/max(1.0,strokeRadius)*speed*.40*signValue;
  velocity+=(strokeVelocity+eddy)*gaussian*dt*7.5;
  outputState=vec4(bounded(velocity,240.0)*edgeAt(vUv),0.0,0.0);return;
 }
 if(operation==1){
  float curl=(velocityAt(vUv+vec2(texel.x,0)).y-velocityAt(vUv-vec2(texel.x,0)).y)/(2.0*cell.x)
   -(velocityAt(vUv+vec2(0,texel.y)).x-velocityAt(vUv-vec2(0,texel.y)).x)/(2.0*cell.y);
  outputState=vec4(curl,0,0,0);return;
 }
 if(operation==2){
  float left=abs(scalarAt(inputB,vUv-vec2(texel.x,0))),right=abs(scalarAt(inputB,vUv+vec2(texel.x,0)));
  float bottom=abs(scalarAt(inputB,vUv-vec2(0,texel.y))),top=abs(scalarAt(inputB,vUv+vec2(0,texel.y)));
  vec2 gradient=vec2((right-left)/cell.x,(top-bottom)/cell.y);gradient/=max(.0001,length(gradient));
  vec2 force=vec2(gradient.y,-gradient.x)*texture(inputB,vUv).x*18.0;
  outputState=vec4(bounded(texture(inputA,vUv).xy+force*dt,240.0)*edgeAt(vUv),0,0);return;
 }
 if(operation==3){
  float divergence=(velocityAt(vUv+vec2(texel.x,0)).x-velocityAt(vUv-vec2(texel.x,0)).x)/(2.0*cell.x)
   +(velocityAt(vUv+vec2(0,texel.y)).y-velocityAt(vUv-vec2(0,texel.y)).y)/(2.0*cell.y);
  outputState=vec4(divergence,0,0,0);return;
 }
 if(operation==4){
  float left=scalarAt(inputA,vUv-vec2(texel.x,0)),right=scalarAt(inputA,vUv+vec2(texel.x,0));
  float bottom=scalarAt(inputA,vUv-vec2(0,texel.y)),top=scalarAt(inputA,vUv+vec2(0,texel.y));
  vec2 inverseCell=1.0/(cell*cell);
  float pressure=((left+right)*inverseCell.x+(bottom+top)*inverseCell.y-texture(inputB,vUv).x)/(2.0*(inverseCell.x+inverseCell.y));
  outputState=vec4(pressure,0,0,0);return;
 }
 if(operation==5){
  float left=scalarAt(inputB,vUv-vec2(texel.x,0)),right=scalarAt(inputB,vUv+vec2(texel.x,0));
  float bottom=scalarAt(inputB,vUv-vec2(0,texel.y)),top=scalarAt(inputB,vUv+vec2(0,texel.y));
  vec2 velocity=texture(inputA,vUv).xy-vec2(right-left,top-bottom)/(2.0*cell);
  outputState=vec4(bounded(velocity,240.0)*edgeAt(vUv),0,0);return;
 }
 if(operation==6){
  vec4 previous=previousSample(inputA,vUv)*scaleRatio();
  vec2 displacement=previous.xy,velocity=previous.zw;
  vec2 carried=texture(inputB,clamp(vUv+displacement/viewport,texel*.5,1.0-texel*.5)).xy;
  // Integrated particle momentum with a slow damped spring back to its live anchor.
  velocity=bounded(velocity+(carried*3.0-velocity*2.0-displacement*.90)*dt,120.0);
  displacement+=velocity*dt;
  if(length(displacement)>24.0){vec2 normal=normalize(displacement);displacement=normal*24.0;velocity-=normal*max(0.0,dot(velocity,normal));}
  float edge=edgeAt(vUv);outputState=vec4(displacement*edge,velocity*edge);return;
 }
 // Explicit event-only snapshot conversion from16F into readback-compatible32F.
 outputState=texture(inputA,vUv);
}
