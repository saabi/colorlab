#version 300 es
precision highp float; out vec4 frag; uniform vec3 uCol;
void main(){ vec2 d=gl_PointCoord-0.5; if(dot(d,d)>0.25) discard;
  float edge=smoothstep(0.25,0.16,dot(d,d));
  frag=vec4(mix(vec3(1.0),uCol,edge),1.0); }
