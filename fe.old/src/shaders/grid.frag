//#extension GL_OES_standard_derivatives : enable

varying vec3 vertex;
varying vec3 colors;

void main() {
	// Pick a coordinate to visualize in a grid
	vec3 coord = mod(colors.xyz,0.9999);

	//float dFactor = 1.0/pow(length(vertex),2.0);
	float dFactor = clamp(1.0/pow(length(vertex),2.0),0.,1.);

	float v = 0.0;

		// Compute anti-aliased world-space grid lines
	vec3 grid = abs(fract(coord - 0.5) - 0.5) / fwidth(coord*3.);
	float line = min(min(grid.x, grid.y), grid.z);
	v = 1.0 - min(line, 1.0);
	
	coord *= 10.0;
	
	grid = abs(fract(coord - 0.5) - 0.5) / fwidth(coord*1.);
	line = min(min(grid.x, grid.y), grid.z);
	v += 1.0 - min(line, 1.0);

	float coord2 = length(vertex.xz)*4.0;

  	// Compute anti-aliased world-space grid lines
  	line = abs(fract(coord2 - 0.5) - 0.5) / fwidth(coord2);
	//v += 1.0 - min(line, 1.0);
	
    v = clamp(v,0.,1.0);// + (1.0-v)*0.1;
	v *= dFactor;
	v *= 0.1;

	// Just visualize the grid lines directly
	gl_FragColor = vec4(v);
}