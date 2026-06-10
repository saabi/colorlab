#version 300 es
precision highp float;
in vec3 vRgb; in vec3 vWorld; in float vCutDist; out vec4 frag;
uniform float uLines, uGhost, uGridOnly, uCapGridOnly, uClippedGridAlpha, uCvdSev;
uniform vec3 uMaskPlaneN;
uniform float uMaskPlaneD, uMaskSliceEps, uMaskSliceOn, uMaskCutAbove, uMaskCutBelow;
uniform float uMaskCylSlice, uMaskCylRad;
uniform mat3 uCvd;
uniform mat3 uRgb2Lms, uLms2Rgb;
float g1(float t){ return mix(1.055*pow(t,1.0/2.4)-0.055, 12.92*t, step(t,0.0031308)); }
vec3 srgbGamma(vec3 c){ return vec3(g1(c.x),g1(c.y),g1(c.z)); }
vec3 cvd(vec3 lin){
  if(uCvdSev<0.001) return lin;
  vec3 lms=uRgb2Lms*lin;
  vec3 sim=uCvd*lms;
  lms=mix(lms,sim,uCvdSev);
  return uLms2Rgb*lms;
}
float clippedSurfaceMask(vec3 p){
  float clipped=0.0;
  if(uMaskSliceOn>0.5){
    float s=dot(p,uMaskPlaneN)-uMaskPlaneD;
    if(uMaskCutAbove>0.5 && s>uMaskSliceEps){ clipped=1.0; }
    if(uMaskCutBelow>0.5 && s<-uMaskSliceEps){ clipped=1.0; }
  }
  if(uMaskCylSlice>0.5){
    float r=length(p.xz);
    if(r>uMaskCylRad){ clipped=1.0; }
  }
  return clipped;
}
void main(){
  vec3 lin=clamp(vRgb,0.0,1.0);
  vec3 c=srgbGamma(clamp(cvd(lin),0.0,1.0));
  if(uGhost>0.5){ frag=vec4(c*0.085,1.0); return; }
  float v=0.0;
  if(uLines>0.5){
    vec3 coord=mod(srgbGamma(lin),0.9999)+1.0;
    vec3 fw1=fwidth(coord*3.0);
    vec3 grid1=abs(fract(coord-0.5)-0.5)/fw1;
    vec3 line1=clamp(1.0-grid1,0.0,1.0)*clamp(1.0/fw1,0.0,1.0);
    v=max(max(line1.x,line1.y),line1.z);
    
    coord*=10.0;
    vec3 fw2=fwidth(coord*1.0);
    vec3 grid2=abs(fract(coord-0.5)-0.5)/fw2;
    vec3 line2=clamp(1.0-grid2,0.0,1.0)*clamp(1.0/fw2,0.0,1.0);
    v+=max(max(line2.x,line2.y),line2.z);
    
    v=clamp(v,0.0,1.0)*clamp(1.0/pow(length(vWorld)+0.6,2.0),0.0,1.0)*0.9;
  }
  if(uGridOnly>0.5){
    if(uCapGridOnly>0.5){ v*=smoothstep(0.0005,0.003,abs(vCutDist)); }
    float clipped=clippedSurfaceMask(vWorld);
    if(uCapGridOnly>0.5){ clipped=0.0; }
    vec3 gridColor=mix(vec3(0.0),vec3(1.0),clipped);
    float alpha=v*0.22*mix(1.0,uClippedGridAlpha,clipped);
    frag=vec4(gridColor,alpha);
    return;
  }
  frag=vec4(c*(1.0-v*0.2),1.0);
}
