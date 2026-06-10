#version 300 es
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
}
