#version 300 es
precision highp float;
in vec3 vCol; out vec4 frag;
void main(){ frag=vec4(vCol,1.0); }
