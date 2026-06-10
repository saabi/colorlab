varying vec3 colors;
varying vec3 vertex;

const vec3 wref =  vec3(0.95047, 1.0, 1.08883); 

const float clipTop=70.;
const float clipBottom=0.;
const float clipRadius=200.;

vec3 rgb2xyz(in vec3 c)
{
    return c*mat3(0.4124, 0.3576, 0.1805,
          		  0.2126, 0.7152, 0.0722,
                  0.0193, 0.1192, 0.9505);
}

float xyzF(float t){ return mix(pow(t,1./3.), 7.787037*t + 0.139731, step(t,0.00885645)); }
float xyzR(float t){ return mix(t*t*t , 0.1284185*(t - 0.139731), step(t,0.20689655)); }
vec3 xyz2lab(vec3 xyz) {

	xyz /= wref;

	if ( xyz.x > 0.008856 ) xyz.x = pow(xyz.x , ( 1./3. ));
	else                    xyz.x = ( 7.787 * xyz.x ) + ( 16. / 116. );
	if ( xyz.y > 0.008856 ) xyz.y = pow(xyz.y, ( 1./3. ));
	else                    xyz.y = ( 7.787 * xyz.y ) + ( 16. / 116. );
	if ( xyz.z > 0.008856 ) xyz.z = pow(xyz.z,  1./3. );
	else                    xyz.z = ( 7.787 * xyz.z ) + ( 16. / 116. );

	return vec3( (116. * xyz.y ) - 16., 500. * ( xyz.x - xyz.z ), 200. * ( xyz.y - xyz.z ))/100.;
}
vec3 rgb2lab(in vec3 c)
{
	c  *= mat3( 0.4124, 0.3576, 0.1805,
          		0.2126, 0.7152, 0.0722,
                0.0193, 0.1192, 0.9505);
    
    c.x = xyzF(c.x/wref.x);
	c.y = xyzF(c.y/wref.y);
	c.z = xyzF(c.z/wref.z);
	
	return vec3(max(0.,116.*c.y - 16.0), 500.*(c.x - c.y), 200.*(c.y - c.z));
}
vec3 lab2rgb(in vec3 c)
{   
    float lg = 1./116.*(c.x + 16.);
    vec3 xyz = vec3(wref.x*xyzR(lg + 0.002*c.y),
    				wref.y*xyzR(lg),
    				wref.z*xyzR(lg - 0.005*c.z));
    #ifndef ABODE_RGB
    vec3 rgb = xyz*mat3( 3.2406, -1.5372,-0.4986,
          		        -0.9689,  1.8758, 0.0415,
                	     0.0557,  -0.2040, 1.0570);
	#else
    vec3 rgb = xyz*mat3( 2.0413690, -0.5649464, -0.3446944,
						-0.9692660,  1.8760108,  0.0415560,
 						0.0134474, -0.1183897,  1.0154096);
    #endif
    return rgb;
}
mat4 rotationMatrix(vec3 axis, float angle)
{
    axis = normalize(axis);
    float s = sin(angle);
    float c = cos(angle);
    float oc = 1.0 - c;
    
    return mat4(oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
                oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  0.0,
                oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           0.0,
                0.0,                                0.0,                                0.0,                                1.0);
}
vec3 rgbU(in vec3 c) {
	vec4 tmp = rotationMatrix(normalize(vec3(0.,1.,0.)),0.7853981633974483)*vec4(c,1.0);
	tmp = rotationMatrix(normalize(vec3(1.,0.,0.)),0.9553166181245093)*tmp;
	return tmp.xyz*.707;
}
vec3 rgb2xyzU(in vec3 c) {
	vec3 c1 = rgb2xyz(c);
	vec4 tmp = rotationMatrix(normalize(vec3(0.,1.,0.)),0.7853981633974483)*vec4(c1,1.0);
	tmp = rotationMatrix(normalize(vec3(1.,0.,0.)),0.9553166181245093)*tmp;
	return tmp.xyz;
}
vec3 labU(in vec3 lab) {
	return lab.yxz/100.;
}

void main() {
	vec3 posrgb = position + 0.5;
	//colors = posrgb;
	//pos = rgbU(pos);
	//pos = rgb2xyzU(pos);
	vec3 posxyz = rgb2xyz(posrgb);
	vec3 poslab = rgb2lab(posrgb);
	colors = posrgb;

	for (int i=0; i<0; i++) {
		
		if (poslab.x > clipTop)
			poslab.x = clipTop;
		if (poslab.x < clipBottom)
			poslab.x = clipBottom;
		vec2 ab = poslab.yz;
		if (length(ab)>clipRadius)
			poslab.yz = normalize(ab)*clipRadius;
		//if (length(poslab-vec3(50.,0.,0.))>200.)
			//poslab = vec3(50.,0.,0.)+normalize(poslab-vec3(50.,0.,0.))*200.;

		colors = lab2rgb(poslab);
		colors = clamp(colors,0.0,1.0);
		poslab = rgb2lab(colors);
	}
	vec3 posWorld = labU(poslab);
	//vec3 posWorld = posxyz;
    vertex = posWorld;
	gl_Position  = projectionMatrix * modelViewMatrix * vec4( posWorld, 1.0 );
}