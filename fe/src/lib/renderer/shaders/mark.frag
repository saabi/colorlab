#version 300 es
precision highp float; out vec4 frag; uniform vec3 uCol,uBorder;
void main(){ vec2 d=gl_PointCoord-0.5; if(dot(d,d)>0.25) discard;
  float edge=smoothstep(0.23,0.13,dot(d,d));
  frag=vec4(mix(uBorder,uCol,edge),1.0); }
