#version 300 es
precision highp float;
layout(location=0) in vec2 aXZ;
uniform mat4 uProj,uView; uniform float uY;
out vec3 vW;
void main(){ vW=vec3(aXZ.x,uY,aXZ.y); gl_Position=uProj*uView*vec4(vW,1.0); }
