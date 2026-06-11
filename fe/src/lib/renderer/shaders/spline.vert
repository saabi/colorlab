#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aCol;
uniform mat4 uProj,uView;
out vec3 vCol;
void main(){ gl_Position=uProj*uView*vec4(aPos,1.0); vCol=aCol; }
