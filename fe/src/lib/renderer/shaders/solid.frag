#version 300 es
precision highp float;
in vec3 vRgb; in vec3 vWorld; out vec4 frag;
uniform float uLines, uGhost, uCvdSev;
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
void main(){
  vec3 lin=clamp(vRgb,0.0,1.0);
  vec3 c=srgbGamma(clamp(cvd(lin),0.0,1.0));
  if(uGhost>0.5){ frag=vec4(c*0.085,1.0); return; }
  float v=0.0;
  if(uLines>0.5){
    vec3 coord=mod(srgbGamma(lin),0.9999)+1.0;
    vec3 grid=abs(fract(coord-0.5)-0.5)/fwidth(coord*3.0);
    v=1.0-min(min(min(grid.x,grid.y),grid.z),1.0);
    coord*=10.0;
    grid=abs(fract(coord-0.5)-0.5)/fwidth(coord*1.0);
    v+=1.0-min(min(min(grid.x,grid.y),grid.z),1.0);
    v=clamp(v,0.0,1.0)*clamp(1.0/pow(length(vWorld)+0.6,2.0),0.0,1.0)*0.9;
  }
  frag=vec4(c*(1.0-v*0.2),1.0);
}
