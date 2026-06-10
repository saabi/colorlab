varying vec3 vertex;

void main() {
	vertex = position;
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}