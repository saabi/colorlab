export const VS_SOLID = `#version 300 es
precision highp float; precision highp int;
layout(location=0) in vec2 aCorner;
uniform int uN, uSpaceMode;
uniform mat3 uRgbToXyz, uXyzToRgb;
uniform mat3 uOkM1, uOkM2;
uniform mat3 uOkM1i, uOkM2i;
uniform vec3 uWhite, uLumaW;
uniform mat3 uCubeRot, uCubeRoti;
uniform vec3 uPlaneN; uniform float uPlaneD, uSliceEps, uSliceOn, uCutAbove, uCutBelow;
uniform mat4 uProj, uView;
out vec3 vRgb; out vec3 vWorld;

vec3 faceToRgb(int f, vec2 uv){
  if(f==0) return vec3(0.0,uv.x,uv.y);
  if(f==1) return vec3(1.0,uv.x,uv.y);
  if(f==2) return vec3(uv.x,0.0,uv.y);
  if(f==3) return vec3(uv.x,1.0,uv.y);
  if(f==4) return vec3(uv.x,uv.y,0.0);
  return vec3(uv.x,uv.y,1.0);
}
float labF(float t){ return t>0.008856 ? pow(t,1.0/3.0) : 7.787*t+16.0/116.0; }
float labFi(float t){ float t3=t*t*t; return t3>0.008856 ? t3 : (t-16.0/116.0)/7.787; }
vec3 toWorld(vec3 rgb){
  if(uSpaceMode==0) return uCubeRot*(rgb-0.5);
  if(uSpaceMode==5){
    vec3 p=uCubeRot*(rgb-0.5);
    float luma=dot(rgb,uLumaW);
    return vec3(p.x, luma-0.5, p.z);
  }
  vec3 xyz = uRgbToXyz*rgb;
  if(uSpaceMode==1) return xyz-vec3(0.48,0.5,0.54);
  if(uSpaceMode==2){
    vec3 f=vec3(labF(xyz.x/uWhite.x),labF(xyz.y/uWhite.y),labF(xyz.z/uWhite.z));
    vec3 lab=vec3(116.0*f.y-16.0, 500.0*(f.x-f.y), 200.0*(f.y-f.z));
    return vec3(lab.y, lab.x-50.0, lab.z)*0.01;
  }
  vec3 lms=uOkM1*rgb; lms=sign(lms)*pow(abs(lms),vec3(1.0/3.0));
  vec3 lab=uOkM2*lms;
  return vec3(lab.y*2.2, lab.x-0.5, lab.z*2.2);
}
vec3 fromWorld(vec3 p){
  if(uSpaceMode==0||uSpaceMode==5) return uCubeRoti*p+0.5;
  if(uSpaceMode==1) return uXyzToRgb*(p+vec3(0.48,0.5,0.54));
  if(uSpaceMode==2){
    float L=p.y*100.0+50.0, a=p.x*100.0, b=p.z*100.0;
    float fy=(L+16.0)/116.0, fx=a/500.0+fy, fz=fy-b/200.0;
    return uXyzToRgb*vec3(uWhite.x*labFi(fx), uWhite.y*labFi(fy), uWhite.z*labFi(fz));
  }
  vec3 lab=vec3(p.y+0.5, p.x/2.2, p.z/2.2);
  vec3 lms=uOkM2i*lab; lms=lms*lms*lms;
  return uOkM1i*lms;
}
void main(){
  int cells=uN*uN; int face=gl_InstanceID/cells; int cell=gl_InstanceID-face*cells;
  vec2 uv=(vec2(float(cell%uN),float(cell/uN))+aCorner)/float(uN);
  vec3 rgb=faceToRgb(face,uv);
  vec3 p=toWorld(rgb);
  if(uSliceOn>0.5 && (uCutAbove>0.5||uCutBelow>0.5)){
    float smin = uCutBelow>0.5 ? -uSliceEps : -1.0e9;
    float smax = uCutAbove>0.5 ?  uSliceEps :  1.0e9;
    for(int i=0;i<5;i++){
      float s=dot(p,uPlaneN)-uPlaneD;
      p-=uPlaneN*(s-clamp(s,smin,smax));
      rgb=clamp(fromWorld(p),0.0,1.0);
      p=toWorld(rgb);
    }
    float s=dot(p,uPlaneN)-uPlaneD;
    vec3 pf=p-uPlaneN*(s-clamp(s,smin,smax));
    vec3 rf=fromWorld(pf);
    if(all(greaterThanEqual(rf,vec3(-0.002)))&&all(lessThanEqual(rf,vec3(1.002)))){
      p=pf; rgb=clamp(rf,0.0,1.0);
    }
  }
  vRgb=rgb; vWorld=p;
  gl_Position=uProj*uView*vec4(p,1.0);
}`;

export const FS_SOLID = `#version 300 es
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
}`;

export const VS_LINE = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
uniform mat4 uProj,uView;
void main(){ gl_Position=uProj*uView*vec4(aPos,1.0); }`;

export const FS_LINE = `#version 300 es
precision highp float; out vec4 frag; uniform vec3 uCol;
void main(){ frag=vec4(uCol,1.0); }`;

export const VS_FLOOR = `#version 300 es
precision highp float;
layout(location=0) in vec2 aXZ;
uniform mat4 uProj,uView; uniform float uY;
out vec3 vW;
void main(){ vW=vec3(aXZ.x,uY,aXZ.y); gl_Position=uProj*uView*vec4(vW,1.0); }`;

export const FS_FLOOR = `#version 300 es
precision highp float;
in vec3 vW; out vec4 frag;
void main(){
  float dF=clamp(1.0/pow(length(vW)*1.4,2.0),0.0,1.0);
  vec2 c=vW.xz*2.0;
  vec2 g=abs(fract(c-0.5)-0.5)/fwidth(c*3.0);
  float v=1.0-min(min(g.x,g.y),1.0);
  c*=5.0;
  g=abs(fract(c-0.5)-0.5)/fwidth(c);
  v+=1.0-min(min(g.x,g.y),1.0);
  float r=length(vW.xz)*4.0;
  float ring=abs(fract(r-0.5)-0.5)/fwidth(r);
  v+=1.0-min(ring,1.0);
  frag=vec4(vec3(clamp(v,0.0,1.0)*dF*0.12),1.0);
}`;

export const VS_MARK = `#version 300 es
precision highp float;
uniform mat4 uProj,uView; uniform vec3 uPos;
void main(){ gl_Position=uProj*uView*vec4(uPos,1.0); gl_PointSize=10.0; }`;

export const FS_MARK = `#version 300 es
precision highp float; out vec4 frag; uniform vec3 uCol;
void main(){ vec2 d=gl_PointCoord-0.5; if(dot(d,d)>0.25) discard;
  float edge=smoothstep(0.25,0.16,dot(d,d));
  frag=vec4(mix(vec3(1.0),uCol,edge),1.0); }`;
