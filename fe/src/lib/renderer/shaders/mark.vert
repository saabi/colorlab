#version 300 es
precision highp float;
uniform mat4 uProj,uView; uniform vec3 uPos;
void main(){ gl_Position=uProj*uView*vec4(uPos,1.0); gl_PointSize=10.0; }
