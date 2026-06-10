#version 300 es
precision highp float; out vec4 frag; uniform vec3 uCol;
void main(){ frag=vec4(uCol,1.0); }
