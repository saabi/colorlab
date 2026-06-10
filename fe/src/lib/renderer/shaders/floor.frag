#version 300 es
precision highp float;
in vec3 vW;
out vec4 frag;

void main() {
	float dF = clamp(1.0 / pow(length(vW)*1.4, 8.0), 0.0, 1.0);
	vec2 c = vW.xz;
	vec2 g = abs(fract(c - 0.5) - 0.5) / fwidth(c * 3.0);
	float v = 1.0 - min(min(g.x, g.y), 1.0);
	c *= 10.0;
	g = abs(fract(c - 0.5) - 0.5) / fwidth(c);
	v += 1.0 - min(min(g.x, g.y), 1.0);
	float r = length(vW.xz) * 5.0;
	float ring = abs(fract(r - 0.5) - 0.5) / fwidth(r);
	v += 1.0 - min(ring, 1.0);
	v = clamp(v, 0.0, 1.0) + (1.0 - v) * 0.01;
	v *= dF;
	v *= 0.5;
	frag = vec4(vec3(v), 1.0);
}
