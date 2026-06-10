#version 300 es
precision highp float; precision highp int;
layout(location=0) in vec2 aCorner;
uniform int uN, uSpaceMode;
uniform mat3 uRgbToXyz, uXyzToRgb;
uniform mat3 uOkM1, uOkM2;
uniform mat3 uOkM1i, uOkM2i;
uniform vec3 uWhite, uLumaW;
uniform mat3 uCubeRot, uCubeRoti;
uniform vec3 uPlaneN; uniform float uPlaneD, uSliceEps, uSliceOn, uCutAbove, uCutBelow;
uniform float uCylSlice, uCylRad;
uniform mat4 uProj, uView;
out vec3 vRgb; out vec3 vWorld; out float vCutDist;

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
  vec3 p0=p;
  if ((uSliceOn > 0.5 && (uCutAbove > 0.5 || uCutBelow > 0.5)) || uCylSlice > 0.5) {
    float smin = uCutBelow > 0.5 ? -uSliceEps : -1.0e9;
    float smax = uCutAbove > 0.5 ?  uSliceEps :  1.0e9;
    for(int i=0;i<5;i++){
      if (uSliceOn > 0.5 && (uCutAbove > 0.5 || uCutBelow > 0.5)) {
        float s = dot(p, uPlaneN) - uPlaneD;
        p -= uPlaneN * (s - clamp(s, smin, smax));
      }
      if (uCylSlice > 0.5) {
        float r = length(p.xz);
        vec3 norm = vec3(0.0);
        if (r > 1e-5) {
          norm = vec3(p.x / r, 0.0, p.z / r);
        } else {
          norm = vec3(1.0, 0.0, 0.0);
        }
        if (r > uCylRad) {
          p -= norm * (r - uCylRad);
        }
      }
      rgb = clamp(fromWorld(p), 0.0, 1.0);
      p = toWorld(rgb);
    }
    vec3 pf = p;
    if (uSliceOn > 0.5 && (uCutAbove > 0.5 || uCutBelow > 0.5)) {
      float s = dot(pf, uPlaneN) - uPlaneD;
      pf -= uPlaneN * (s - clamp(s, smin, smax));
    }
    if (uCylSlice > 0.5) {
      float r = length(pf.xz);
      vec3 norm = vec3(0.0);
      if (r > 1e-5) {
        norm = vec3(pf.x / r, 0.0, pf.z / r);
      } else {
        norm = vec3(1.0, 0.0, 0.0);
      }
      if (r > uCylRad) {
        pf -= norm * (r - uCylRad);
      }
    }
    vec3 rf = fromWorld(pf);
    if (all(greaterThanEqual(rf, vec3(-0.002))) && all(lessThanEqual(rf, vec3(1.002)))) {
      p = pf; rgb = clamp(rf, 0.0, 1.0);
    }
  }
  vRgb=rgb; vWorld=p; vCutDist=length(p-p0);
  gl_Position=uProj*uView*vec4(p,1.0);
}
