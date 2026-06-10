precision mediump float;

uniform vec2 resolution;

struct transfer {
    float power;
    float off;
    float slope;
    float cutoffToLinear;
    float cutoffToGamma;
};

struct rgb_space {
    mat3 primaries;
    vec3 white;
    transfer trc;
};

mat3 inverse(mat3 m) {
  float a00 = m[0][0], a01 = m[0][1], a02 = m[0][2];
  float a10 = m[1][0], a11 = m[1][1], a12 = m[1][2];
  float a20 = m[2][0], a21 = m[2][1], a22 = m[2][2];

  float b01 = a22 * a11 - a12 * a21;
  float b11 = -a22 * a10 + a12 * a20;
  float b21 = a21 * a10 - a11 * a20;

  float det = a00 * b01 + a01 * b11 + a02 * b21;

  return mat3(b01, (-a22 * a01 + a02 * a21), (a12 * a01 - a02 * a11),
              b11, (a22 * a00 - a02 * a20), (-a12 * a00 + a02 * a10),
              b21, (-a21 * a00 + a01 * a20), (a11 * a00 - a01 * a10)) / det;
}

#define Primaries(r1, r2, g1, g2, b1, b2)    mat3(        (r1), (r2), 1.0 - (r1) - (r2),        (g1), (g2), 1.0 - (g1) - (g2),        (b1), (b2), 1.0 - (b1) - (b2))
#define White(x, y) vec3((x), (y), 1.0 - (x) - (y))/(y)
#define diag(v) mat3( (v).x, 0.0, 0.0,  0.0, (v).y, 0.0, 0.0, 0.0, (v).z)
#define rgbToXyz(space)    space.primaries*diag(inverse((space).primaries)*(space).white)
#define xyzToRgb(space)    inverse(rgbToXyz(space))
#define conversionMatrix(f, t)    xyzToRgb(t)*rgbToXyz(f)

const mat3 primaries709 = Primaries(
    0.64, 0.33,
    0.3, 0.6,
    0.15, 0.06
);

const mat3 primariesLms = Primaries(
    194735469.0/263725741.0, 68990272.0/263725741.0,
    141445123.0/106612934.0, -34832189.0/106612934.0,
    36476327.0/229961670.0, 0.0
);

const vec3 whiteE = White(1.0/3.0, 1.0/3.0);
const vec3 whiteD65 = White(0.312713, 0.329016);

const transfer gam10 = transfer(1.0, 0.0, 1.0, 0.0, 0.0);

const transfer gamSrgb = transfer(2.4, 0.055, 12.92, 0.04045, 0.0031308);

const rgb_space LmsRgb = rgb_space(primariesLms, whiteE, gam10);

const rgb_space to = rgb_space(primaries709, whiteD65, gamSrgb);

//mat3 toLms = xyzToRgb(LmsRgb);
//mat3 toRGB = xyzToRgb(to);

vec3 bmix( vec3 arg0, vec3 arg1, bvec3 bools ) { 
	return vec3( bools.x ? arg1.x : arg0.x, bools.y ? arg1.y : arg0.y, bools.z ? arg1.z : arg0.z); 
}
vec3 toLinear(vec3 color, transfer trc)
{
    bvec3 cutoff = lessThan(color, vec3(trc.cutoffToLinear));
    bvec3 negCutoff = lessThanEqual(color, vec3(-1.0*trc.cutoffToLinear));
    vec3 higher = pow((color + trc.off)/(1.0 + trc.off), vec3(trc.power));
    vec3 lower = color/trc.slope;
    vec3 neg = -1.0*pow((color - trc.off)/(-1.0 - trc.off), vec3(trc.power));

    color = bmix(higher, lower, cutoff);
    color = bmix(color, neg, negCutoff);

    return color;
}

// Gamma-corrects RGB colors to be sent to a display
vec3 toGamma(vec3 color, transfer trc)
{
    bvec3 cutoff = lessThan(color, vec3(trc.cutoffToGamma));
    bvec3 negCutoff = lessThanEqual(color, vec3(-1.0*trc.cutoffToGamma));
    vec3 higher = (1.0 + trc.off)*pow(color, vec3(1.0/trc.power)) - trc.off;
    vec3 lower = color*trc.slope;
    vec3 neg = (-1.0 - trc.off)*pow(-1.0*color, vec3(1.0/trc.power)) + trc.off;

    color = bmix(higher, lower, cutoff);
    color = bmix(color, neg, negCutoff);

    return color;
}


const vec3 wref =  vec3(0.95047, 1.0, 1.08883); 
vec3 xyz2lab(vec3 xyz) {

    xyz /= wref;

    if ( xyz.x > 0.008856 ) xyz.x = pow(xyz.x , ( 1./3. ));
    else                    xyz.x = ( 7.787 * xyz.x ) + ( 16. / 116. );
    if ( xyz.y > 0.008856 ) xyz.y = pow(xyz.y, ( 1./3. ));
    else                    xyz.y = ( 7.787 * xyz.y ) + ( 16. / 116. );
    if ( xyz.z > 0.008856 ) xyz.z = pow(xyz.z,  1./3. );
    else                    xyz.z = ( 7.787 * xyz.z ) + ( 16. / 116. );

    return vec3( (116. * xyz.y ) - 16., 500. * ( xyz.x - xyz.z ), 200. * ( xyz.y - xyz.z ));
}
vec3 lab2xyz(in vec3 c)
{   
      vec3 result;

      float y = (c.x + 16.0) / 116.0;
      float z = y - (c.z / 200.0);
      float x = (c.y / 500.0) + z;
      
      float y3 = pow(y, 3.0);
      float x3 = pow(x, 3.0);
      float z3 = pow(z, 3.0);

      if (y3 > 0.008856) y = y3;
      else               y = (y - (16.0 / 116.0)) / 7.787;
      if (x3 > 0.008856) x = x3;
      else               x = (x - (16.0 / 116.0)) / 7.787;
      if (z3 > 0.008856) z = z3;
      else               z = (z - (16.0 / 116.0)) / 7.787;

      result.x = x * to.white.x;
      result.y = y * to.white.y;
      result.z = z * to.white.z;

      return result;
}


#define gauss2(x, A, x0, dx)    A*exp(-0.6931471805599453*pow((x - x0)/dx, 2.0))
#define dgauss(x, A, x0, dx)    -2.0*0.6931471805599453*A * (x-x0) * exp(-0.6931471805599453 * pow(x-x0,2.0)/pow(dx,2.0)) / pow(dx,2.0)
float M(float nm) {
    float tmp = 108991.4133 * exp(-log(2.0) * pow(nm-547.2395,2.0) / pow(40.8751,2.0));
    tmp += -2.0*log(2.0)*486896.0939 * (nm-504.2192) * exp(-log(2.0) * pow(nm-504.2192,2.0)/pow(42.5372,2.0)) / pow(42.5372,2.0);
    tmp += -2.0*log(2.0)*(-58768.3624) * (nm-508.3118) * exp(-log(2.0) * pow(nm-508.3118,2.0)/pow(13.5221,2.0)) / pow(13.5221,2.0); 
    tmp += -2.0*log(2.0)*97877.6717 * (nm-540.9401) * exp(-log(2.0) * pow(nm-540.9401,2.0)/pow(19.0589,2.0)) / pow(19.0589,2.0);
    return tmp;
}
float L2(float nm) {
    float tmp = gauss2(nm, 104344.92193406945, 569.5078040786743, 54.651444860776735);
    tmp += dgauss(nm, -156430.21591338454, 590.1108598846736, 26.58929437546323);
    tmp += dgauss(nm, -145288.27503926188, 512.6297253843892, 19.260656047167043);
    tmp += gauss2(nm, -7591.194203449524, 641.0781271336464, 37.920029730475456);
    tmp += gauss2(nm, 1905.4399959767024, 434.408633321614, 17.7321868069511);
    return  tmp;
}
float S2(float nm) {
    float tmp = gauss2(nm, 221368.60076492612, 444.9973131221829, 12.37472521822061);
    tmp += dgauss(nm, 2185498.6747593815, 442.0889660569674, 17.327094668813405);
    tmp += dgauss(nm, -628537.5904831715, 463.27066341009333, 25.92687407427804);
    tmp += dgauss(nm, -2253931.2636179845, 451.54166499032675, 15.502068959529584);
    tmp += dgauss(nm, -7463.1094212072485, 447.91353164623615, 3.692212735536991);
    return  tmp;
}
vec3 coordsLMS(float nm) {
    return vec3(L2(nm),M(nm),S2(nm))/100000.0;
}

vec3 LMS2XYZ2(vec3 lms) {
    return vec3(
        1.94735469*lms.x -1.41445123*lms.y +0.36476327*lms.z,
        0.68990272*lms.x +0.34832189*lms.y,
        1.93485343*lms.z
    );
}
vec3 XYZ2LMS(vec3 xyz) {
    return mat3(
        0.7328, 0.4296, -0.1624,
        -0.7036, 1.6975, 0.0061,
        0.003, 0.0136, 0.9834
    )*xyz;
}
vec3 gamutScale(vec3 color, float luma)
{
    float low = min(color.r, min(color.g, min(color.b, 0.0)));
    float high = max(color.r, max(color.g, max(color.b, 1.0)));

    float lowScale = low/(low - luma);
    float highScale = max((high - 1.0)/(high - luma), 0.0);
    float scale = max(lowScale, highScale);
    color += scale*(luma - color);

    return color;
}

float black_correction(float wave) {
    return (1.0-smoothstep(380.0,519.0,wave) +smoothstep(519.0,730.0,wave))*.29;
}
float bright_correction(float wave) {
    return .82 - smoothstep(443.0,535.0,wave)*.03 + smoothstep(535.0,605.0,wave)*.21;
    return smoothstep(380.0,443.0,wave)*.82 + smoothstep(443.0,610.0,wave)*.18 - smoothstep(610.0,730.0,wave);
}
float labsat_correction(float wave) {
    return smoothstep(443.0,489.0,wave)-smoothstep(489.0,522.0,wave);
}
// Converts from XYZ to RGB
vec3 convert(vec3 color)
{
    mat3 toLms = xyzToRgb(LmsRgb);
    mat3 toRGB = xyzToRgb(to);
    mat3 whiteBalance = inverse(toLms)*diag((toLms*to.white)/(toLms*whiteE))*toLms;

    // Commented out numbers/lines are for uniformly brightening the
    // spectrum to fit it within sRGB while retaining full accuracy
    color /= 3.70;
    color += .29;
    color = whiteBalance*color;

    float luma = color.y;
    color = toRGB*color;
    color = gamutScale(color, luma);

    return color;
}
vec3 plot(vec2 fragCoord, vec3 bg, vec3 color) {
    // setup coordinate system
    vec2 uv = fragCoord/resolution.xy;
    uv.x *= resolution.x/resolution.y;
    float lw = 1./resolution.y+0.00000001;
    if (uv.y < .5 && uv.y+lw > .5 ) bg += vec3(1,1,1);
    if (uv.y < color.r/2.0 && uv.y+lw*2.0 > color.r/2.0 ) bg *= vec3(1.0,0.0,0.0);
    if (uv.y < color.g/2.0 && uv.y+lw*2.0 > color.g/2.0 ) bg *= vec3(0.0,1.0,0.0);
    if (uv.y < color.b/2.0 && uv.y+lw*2.0 > color.b/2.0 ) bg *= vec3(0.0,0.0,1.0);

    return bg;
}
vec3 rgb2lab2(in vec3 c)
{
    mat3 toXYZ = rgbToXyz(to);
    return xyz2lab(toXYZ * c);
}
float sRGBgamma(float t) {
    return mix(1.055*pow(t, 1./2.4) - 0.055, 12.92*t, step(t, 0.0031308));
}

vec3 sRGBgamma(in vec3 c) {
    return vec3 (sRGBgamma(c.x), sRGBgamma(c.y), sRGBgamma(c.z));
}

#define SOL 299792458.0e9
void main() {
    mat3 toRGB = xyzToRgb(to);

    float freq = 4.106746e14*gl_FragCoord.x/resolution.x + (8.0222524e14 - 4.106746e14);
    float wave = SOL/freq;
    //float wave = 340.0*gl_FragCoord.x/resolution.x + 390.0;

    //float wave = 340.0*fragCoord.x/iResolution.x + 390.0;
    //vec3 xyz = waveToXyz(wave);
    vec3 lms = coordsLMS(wave);
    vec3 xyz = LMS2XYZ2(lms);
    float XYZ = xyz.x + xyz.y + xyz.z;
    vec3 xyz2 = vec3(xyz.x/XYZ,xyz.y/XYZ,xyz.z/XYZ);


    vec3 rgb = convert(xyz);
    //rgb = toRGB*xyz;
    rgb = (rgb-black_correction(wave))*1.12/bright_correction(wave);
    float RGB = rgb.x + rgb.y + rgb.z;
    vec3 rgb2 = vec3(rgb.x/RGB,rgb.y/RGB,rgb.z/RGB);

    vec3 xyzlab = xyz2lab(xyz);
    vec3 rgblab = rgb2lab2(rgb);
//    rgblab.x = 39;
    rgblab *= vec3(1.0,vec2((labsat_correction(wave))/2.8+1.0));
    //vec3 labrgb = toRGB*xyz;
    vec3 labrgb = toRGB*lab2xyz(rgblab);
    //vec3 labrgb = convert(lab2xyz(rgblab));
//    labrgb +=.11;
    
    vec3 corrected = toGamma(labrgb, to.trc);
    //corrected = sRGBgamma(rgb);
    corrected = plot(gl_FragCoord.xy, corrected, labrgb);
    //corrected = plot(gl_FragCoord.xy, corrected, lab2xyz(xyz2lab(xyz)));
    //corrected = plot(gl_FragCoord.xy, corrected, xyzlab/vec3(100,1000,1000)+vec3(0,.5,.5));
    //corrected = plot(gl_FragCoord.xy, corrected, rgblab/vec3(100,1000,1000)+vec3(0,.5,.5));
    //corrected = plot(gl_FragCoord.xy, corrected, sqrt(rgblab.z*rgblab.z+rgblab.y*rgblab.y)/vec3(1000,1000,1000)+vec3(0.5,.5,.5));
    //corrected = plot(gl_FragCoord.xy, corrected, vec3(labsat_correction(wave))/vec3(10,10,10)+vec3(0.5,.5,.5));


    gl_FragColor = vec4(corrected, 1.0);
    //fragColor = vec4(vec3(bvec3(true)), 1.0);
}
