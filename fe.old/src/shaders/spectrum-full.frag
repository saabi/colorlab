precision highp float;
precision highp int;


/**************************************************************************
 * Scroll to the bottom to change the parameters used to draw the diagram *
 **************************************************************************/

#define PI 3.1415926535897932384626433832795
#define EULER 2.7182818284590452353602874713527
#define inverse(a) mat3( a[2][2] * a[1][1] - a[1][2] * a[2][1],  a[2][2] * a[1][1] - a[1][2] * a[2][1], a[1][2] * a[0][1] - a[0][2] * a[1][1], -a[2][2] * a[1][0] + a[1][2] * a[2][0], a[2][2] * a[0][0] - a[0][2] * a[2][0], -a[1][2] * a[0][0] + a[0][2] * a[1][0], a[2][1] * a[1][0] - a[1][1] * a[2][0], -a[2][1] * a[0][0] + a[0][1] * a[2][0], a[1][1] * a[0][0] - a[0][1] * a[1][0] ) / (a[0][0] * (a[2][2] * a[1][1] - a[1][2] * a[2][1]) + a[0][1] * (-a[2][2] * a[1][0] + a[1][2] * a[2][0]) + a[0][2] * (a[2][1] * a[1][0] - a[1][1] * a[2][0]))

uniform vec2 resolution;
uniform vec3 spectrum;

/*
 * Structures
 */

// Parameters for transfer characteristics (gamma curves)
struct transfer {
    // Exponent used to linearize the signal
    float power;

    // Offset from 0.0 for the exponential curve
    float off;

    // Slope of linear segment near 0
    float slope;

    // Values below this are divided by slope during linearization
    float cutoffToLinear;

    // Values below this are multiplied by slope during gamma correction
    float cutoffToGamma;
};

// Parameters for a colorspace
struct rgb_space {
    // Chromaticity coordinates (xyz) for Red, Green, and Blue primaries
    mat3 primaries;

    // Chromaticity coordinates (xyz) for white point
    vec3 white;

    // Linearization and gamma correction parameters
    transfer trc;
};


/*
 * Preprocessor 'functions' that help build colorspaces as constants
 */

// Turns 6 chromaticity coordinates into a 3x3 matrix
#define Primaries(r1, r2, g1, g2, b1, b2)    mat3(        (r1), (r2), 1.0 - (r1) - (r2),        (g1), (g2), 1.0 - (g1) - (g2),        (b1), (b2), 1.0 - (b1) - (b2))

// Creates a whitepoint's xyz chromaticity coordinates from the given xy coordinates
#define White(x, y)    vec3((x), (y), 1.0 - (x) - (y))/(y)

// Creates a scaling matrix using a vec3 to set the xyz scalars
#define diag(v)     mat3(        (v).x, 0.0, 0.0,        0.0, (v).y, 0.0,        0.0, 0.0, (v).z)

// Creates a conversion matrix that turns RGB colors into XYZ colors
#define rgbToXyz(space)    space.primaries*diag(inverse((space).primaries)*(space).white)

// Creates a conversion matrix that turns XYZ colors into RGB colors
#define xyzToRgb(space)    inverse(rgbToXyz(space))

// Creates a conversion matrix converts linear RGB colors from one colorspace to another
#define conversionMatrix(f, t)    xyzToRgb(t)*rgbToXyz(f)


/*
 * Standard XYZ -> LMS transformation matrices
 */

const mat3 CIECAM02 = mat3(
    0.7328, -0.7036, 0.003,
    0.4296, 1.6975, 0.0136,
    -0.1624, 0.0061, 0.9834
);

const mat3 HUNT = mat3(
    0.38971, -0.22981, 0,
    0.68898, 1.1834, 0,
    -0.07868, 0.04641, 1
);

const mat3 CIECAM97_1 = mat3(
    0.8951, -0.7502, 0.0389,
    0.2664, 1.7135, -0.0685,
    -0.1614, 0.0367, 1.0296
);

const mat3 CIECAM97_2 = mat3(
    0.8562, -0.836, 0.0357,
    0.3372, 1.8327, -0.0469,
    -0.1934, 0.0033, 1.0112
);


/*
 * Chromaticities for RGB primaries
 */

// CIE 1931 RGB
const mat3 primariesCie = Primaries(
    0.72329, 0.27671,
    0.28557, 0.71045,
    0.15235, 0.02
);

// Identity RGB
const mat3 primariesIdentity = mat3(1.0);

// Original 1953 NTSC primaries
const mat3 primariesNtsc = Primaries(
    0.67, 0.33,
    0.21, 0.71,
    0.14, 0.08
);

// European Broadcasting Union primaries for SDTV and Rec. 601 (625 lines)
const mat3 primariesEbu = Primaries(
    0.64, 0.33,
    0.29, 0.6,
    0.15, 0.06
);

// P22 Phosphor primaries (allegedly; only found one source)
// Used by older versions of SMPTE-C, before specific chromaticities were given
const mat3 primariesP22 = Primaries(
    0.61, 0.342,
    0.298, 0.588,
    0.151, 0.064
);

// Modern day SMPTE-C primaries, used in modern NTSC (Rec. 601) and SMPTE-240M
const mat3 primariesSmpteC = Primaries(
    0.63, 0.34,
    0.31, 0.595,
    0.155, 0.07
);

// Never-popular, antiquated, and idealized 'HDTV' primaries based mostly on the
// 1953 NTSC colorspace. SMPTE-240M officially used the SMPTE-C primaries
const mat3 primaries240m = Primaries(
    0.67, 0.33,
    0.21, 0.71,
    0.15, 0.06
);

// Alleged primaries for old Sony TVs with a very blue whitepoint
const mat3 primariesSony = Primaries(
    0.625, 0.34,
    0.28, 0.595,
    0.155, 0.07
);

// Rec. 709 (HDTV) and sRGB primaries
const mat3 primaries709 = Primaries(
    0.64, 0.33,
    0.3, 0.6,
    0.15, 0.06
);

// DCI-P3 primaries
const mat3 primariesDciP3 = Primaries(
    0.68, 0.32,
    0.265, 0.69,
    0.15, 0.06
);

// Rec. 2020 UHDTV primaries
const mat3 primaries2020 = Primaries(
    0.708, 0.292,
    0.17, 0.797,
    0.131, 0.046
);

// If the HUNT XYZ->LMS matrix were expressed instead as
// chromaticity coordinates, these would be them
const mat3 primariesHunt = Primaries(
    0.8374, 0.1626,
    2.3, -1.3,
    0.168, 0.0
);

// If the CIECAM97_1 XYZ->LMS matrix were expressed instead as
// chromaticity coordinates, these would be them
const mat3 primariesCiecam971 = Primaries(
    0.7, 0.306,
    -0.357, 1.26,
    0.136, 0.042
);

// If the CIECAM97_2 XYZ->LMS matrix were expressed instead as
// chromaticity coordinates, these would be them
const mat3 primariesCiecam972 = Primaries(
    0.693, 0.316,
    -0.56, 1.472,
    0.15, 0.067
);

// If the CIECAM02 XYZ->LMS matrix were expressed instead as
// chromaticity coordinates, these would be them
const mat3 primariesCiecam02 = Primaries(
    0.711, 0.295,
    -1.476, 2.506,
    0.144, 0.057
);

// LMS primaries as chromaticity coordinates, computed from
// http://www.cvrl.org/ciepr8dp.htm, and
// http://www.cvrl.org/database/text/cienewxyz/cie2012xyz2.htm
/*const mat3 primariesLms = Primaries(
    0.73840145, 0.26159855,
    1.32671635, -0.32671635,
    0.15861916, 0.0
);*/

// Same as above, but in fractional form
const mat3 primariesLms = Primaries(
    194735469.0/263725741.0, 68990272.0/263725741.0,
    141445123.0/106612934.0, -34832189.0/106612934.0,
    36476327.0/229961670.0, 0.0
);


/*
 * Chromaticities for white points
 */

// Standard Illuminant C. White point for the original 1953 NTSC color system
const vec3 whiteC = White(0.310063, 0.316158);

// Standard illuminant E (also known as the 'equal energy' white point)
const vec3 whiteE = White(1.0/3.0, 1.0/3.0);

// Alleged whitepoint to use with the P22 phosphors (D65 might be more proper)
const vec3 whiteP22 = White(0.313, 0.329);

// Standard illuminant D65. Note that there are more digits here than specified
// in either sRGB or Rec 709, so in some cases results may differ from other
// software. Color temperature is roughly 6504 K (originally 6500K, but complex
// science stuff made them realize that was innaccurate)
const vec3 whiteD65 = White(0.312713, 0.329016);

// Standard illuminant D50. Just included for the sake of including it. Content
// for Rec. 709 and sRGB is recommended to be produced using a D50 whitepoint.
// For the same reason as D65, the color temperature is 5003 K instead of 5000 K
const vec3 whiteD50 = White(0.34567, 0.35850);

// White point for DCI-P3 Theater
const vec3 whiteTheater = White(0.314, 0.351);

// Very blue white point for old Sony televisions. Color temperature of 9300 K.
// Use with the 'primariesSony' RGB primaries defined above
const vec3 whiteSony = White(0.283, 0.298);


/*
 * Gamma curve parameters
 */

// Linear gamma
const transfer gam10 = transfer(1.0, 0.0, 1.0, 0.0, 0.0);

// Gamma of 1.8; used by older Macintosh systems
const transfer gam18 = transfer(1.8, 0.0, 1.0, 0.0, 0.0);

// Gamma of 2.2; not linear near 0. Was defined abstractly to be used by early
// NTSC systems, and is what Adobe RGB uses
const transfer gam22 = transfer(2.2, 0.0, 1.0, 0.0, 0.0);

// Gamma of 2.4; not linear near 0. Seems a popular choice among some people
// online, so I included it. I don't think any standard uses this
const transfer gam24 = transfer(2.4, 0.0, 1.0, 0.0, 0.0);

// Gamma of 2.5; not linear near 0. Approximately what old Sony TVs used
const transfer gam25 = transfer(2.5, 0.0, 1.0, 0.0, 0.0);

// Gamma of 2.8; not linear near 0. Loosely defined gamma for European SDTV
const transfer gam28 = transfer(2.8, 0.0, 1.0, 0.0, 0.0);

// Modern SMPTE 170M, as well as Rec. 601, Rec. 709, and a rough approximation
// for Rec. 2020 content as well. Do not use with Rec. 2020 if you work with
// high bit depths!
const transfer gam170m = transfer(1.0/0.45, 0.099, 4.5, 0.0812, 0.018);

// Gamma for sRGB. Besides being full-range (0-255 values), this is the only
// difference between sRGB and Rec. 709.
const transfer gamSrgb = transfer(2.4, 0.055, 12.92, 0.04045, 0.0031308);


/*
 * RGB Colorspaces
 */

// CIE 1931 RGB
const rgb_space Cie1931 = rgb_space(primariesCie, whiteE, gam10);

// Identity RGB
const rgb_space Identity = rgb_space(primariesIdentity, whiteE, gam10);

// Original 1953 NTSC
const rgb_space Ntsc = rgb_space(primariesNtsc, whiteC, gam22);

// Mostly unused and early HDTV standard (SMPTE 240M)
const rgb_space Smpte240m = rgb_space(primaries240m, whiteD65, gam22);

// European Broadcasting Union SDTV
const rgb_space Ebu = rgb_space(primariesEbu, whiteD65, gam28);

// Original, imprecise colorspace for NTSC after 1987 (probably incorrect)
const rgb_space SmpteC = rgb_space(primariesP22, whiteD65, gam22);

// Modern SMPTE "C" colorimetry
const rgb_space Smpte170m = rgb_space(primariesSmpteC, whiteD65, gam170m);

// Old Sony displays using high temperature white point
const rgb_space Sony = rgb_space(primariesSony, whiteSony, gam25);

// Rec. 709 (HDTV)
const rgb_space Rec709 = rgb_space(primaries709, whiteD65, gam170m);

// sRGB (mostly the same as Rec. 709, but different gamma and full range values)
const rgb_space Srgb = rgb_space(primaries709, whiteD65, gamSrgb);

// DCI-P3 D65
const rgb_space DciP3D65 = rgb_space(primariesDciP3, whiteD65, gam170m);

// DCI-P3 D65
const rgb_space DciP3Theater = rgb_space(primariesDciP3, whiteTheater, gam170m);

// Rec. 2020
const rgb_space Rec2020 = rgb_space(primaries2020, whiteD65, gam170m);

// Hunt primaries, balanced against equal energy white point
const rgb_space HuntRgb = rgb_space(primariesHunt, whiteE, gam10);

// CIE CAM 1997 primaries, balanced against equal energy white point
const rgb_space Ciecam971Rgb = rgb_space(primariesCiecam971, whiteE, gam10);

// CIE CAM 1997 primaries, balanced against equal energy white point and linearized
const rgb_space Ciecam972Rgb = rgb_space(primariesCiecam972, whiteE, gam10);

// CIE CAM 2002 primaries, balanced against equal energy white point
const rgb_space Ciecam02Rgb = rgb_space(primariesCiecam02, whiteE, gam10);

// Lms primaries, balanced against equal energy white point
const rgb_space LmsRgb = rgb_space(primariesLms, whiteE, gam10);


/*
 * Settings
 */

// Convert to this colorspace
const rgb_space to = rgb_space(primaries709, whiteD65, gamSrgb);

// Choose main XYZ->LMS conversion matrix from which others derive
//const mat3 lmsMat = CIECAM02;

// Normalize the LMS matrix to the white point
//const mat3 toLms = inverse(diag((lmsMat*to.white)))*lmsMat;

// Or not
//const mat3 toLms = lmsMat;

// Use LMS primaries instead of a pre-created matrix
const mat3 toLms = xyzToRgb(LmsRgb);


// Converts RGB colors to a linear light scale
vec3 toLinear(vec3 color, transfer trc)
{
    bvec3 cutoff = lessThan(color, vec3(trc.cutoffToLinear));
    bvec3 negCutoff = lessThanEqual(color, vec3(-1.0*trc.cutoffToLinear));
    vec3 higher = pow((color + trc.off)/(1.0 + trc.off), vec3(trc.power));
    vec3 lower = color/trc.slope;
    vec3 neg = -1.0*pow((color - trc.off)/(-1.0 - trc.off), vec3(trc.power));

    color = mix(higher, lower, cutoff);
    color = mix(color, neg, negCutoff);

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

    color = mix(higher, lower, cutoff);
    color = mix(color, neg, negCutoff);

    return color;
}

#define gauss(x, o, u, A)    A/o*exp(-0.5*pow((x - u)/o, 2.0))

// Converts from a wavelength to xyz
// Constructed using multi-peak gaussian functions generated using Labplot
// More closely fits the physiologically-based XYZ curves proposed in 2011
vec3 waveToXyz(float wave)
{
    // XYZ directly
    /*float x1 = gauss(wave, 29.475, 444.358, 55.1489);
    float x2 = gauss(wave, 40.7142, 446.251, -41.6977);
    float x3 = gauss(wave, 23.5915, 606.057, 24.34);
    float x4 = gauss(wave, 37.6977, 590.361, 73.5741);

    float y1 = gauss(wave, 19.6797, 656.021, -0.778595);
    float y2 = gauss(wave, 42.4066, 565.962, 101.492);
    float y3 = gauss(wave, 27.5225, 462.807, 3.53373);
    float y4 = gauss(wave, 18.2148, 529.439, 8.83261);

    float z1 = gauss(wave, 10.2339, 422.327, 16.9254);
    float z2 = gauss(wave, 11.889, 443.142, 37.6146);
    float z3 = gauss(wave, 8.90569, 467.586, 10.5197);
    float z4 = gauss(wave, 25.8258, 460.901, 48.0458);*/

    // LMS (use with matrix operation to convert to XYZ)
    /*float x1 = gauss(wave, 23.5566, 446.096, 1.89299);
    float x2 = gauss(wave, 11.6691, 500.916, -2.28739);
    float x3 = gauss(wave, 32.3956, 536.797, 53.544);
    float x4 = gauss(wave, 33.11, 592.064, 62.7607);

    float y1 = gauss(wave, 13.3211, 479.559, 3.68812);
    float y2 = gauss(wave, 19.5222, 450.237, 3.33538);
    float y3 = gauss(wave, 17.7555, 521.0, 10.3423);
    float y4 = gauss(wave, 33.3204, 552.385, 77.3657);

    float z1 = gauss(wave, 10.2339, 422.327, 8.74764);
    float z2 = gauss(wave, 11.8916, 443.145, 19.3);
    float z3 = gauss(wave, 8.90568, 467.586, 5.43695);
    float z4 = gauss(wave, 25.8258, 460.901, 24.8318);*/

    // Increased accuracy
    float x1 = gauss(wave, 21.6622, 449.682, 2.36612);
    float x2 = gauss(wave, 11.0682, 477.589, 1.39883);
    float x3 = gauss(wave, 25.7494, 532.488, 34.0478);
    float x4 = gauss(wave, 5.91487, 570.2, 0.243387);
    float x5 = gauss(wave, 34.98, 585.858, 77.8669);

    float y1 = gauss(wave, 19.5222, 450.237, 3.33537);
    float y2 = gauss(wave, 13.3211, 479.559, 3.68813);
    float y3 = gauss(wave, 17.1502, 519.924, 9.68484);
    float y4 = gauss(wave, 3.27696, 542.8, 0.105766);
    float y5 = gauss(wave, 33.3895, 552.158, 77.9298);

    float z1 = gauss(wave, 8.84562, 467.661, 5.32073);
    float z2 = gauss(wave, 1.30608, 444.863, -0.0330768);
    float z3 = gauss(wave, 10.2028, 422.211, 8.58498);
    float z4 = gauss(wave, 11.9848, 443.084, 19.6347);
    float z5 = gauss(wave, 25.7907, 460.886, 24.9128);

    vec3 color = vec3(
        1.0/sqrt(2.0*PI)*(x1 + x2 + x3 + x4 + x5),
        1.0/sqrt(2.0*PI)*(y1 + y2 + y3 + y4 + y5),
        1.0/sqrt(2.0*PI)*(z1 + z2 + z3 + z4 + z5)
    );

    color = mat3(
        1.94735469, 0.68990272, 0,
        -1.41445123, 0.34832189, 0,
        0.36476327, 0, 1.93485343
    )*color;

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
float xyzF(float t){ return mix(pow(t,1./3.), 7.787037*t + 0.139731, step(t,0.00885645)); }
float xyzR(float t){ return mix(t*t*t , 0.1284185*(t - 0.139731), step(t,0.20689655)); }
vec3 rgb2lab2(in vec3 c)
{
    mat3 toXYZ = rgbToXyz(to);
    return xyz2lab(toXYZ * c);
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
float L(float nm) {
    float tmp = 104344.9219 * exp(-log(2.0) * pow(nm-569.5078,2.0) / pow(54.6514,2.0));
    tmp += (-2.0*log(2.0)*(-156430.2159) * (nm-590.1109) * exp(-log(2.0) * pow(nm-590.1109,2.0)/pow(26.5893,2.0)) / pow(26.5893,2.0));
    tmp += (-2.0*log(2.0)*(-145288.275) * (nm-512.6297) * exp(-log(2.0) * pow(nm-512.6297,2.0)/pow(19.2607,2.0)) / pow(19.2607,2.0));
    tmp += -7591.1942 * exp(-log(2.0) * pow(nm-641.0781,2.0) / pow(37.92,2.0));
    tmp += 1905.44 * exp(-log(2.0) * pow(nm-434.4086,2.0) / pow(17.7322,2.0));
    return tmp;
}
float M(float nm) {
    float tmp = 108991.4133 * exp(-log(2.0) * pow(nm-547.2395,2.0) / pow(40.8751,2.0));
    tmp += -2.0*log(2.0)*486896.0939 * (nm-504.2192) * exp(-log(2.0) * pow(nm-504.2192,2.0)/pow(42.5372,2.0)) / pow(42.5372,2.0);
    tmp += -2.0*log(2.0)*(-58768.3624) * (nm-508.3118) * exp(-log(2.0) * pow(nm-508.3118,2.0)/pow(13.5221,2.0)) / pow(13.5221,2.0); 
    tmp += -2.0*log(2.0)*97877.6717 * (nm-540.9401) * exp(-log(2.0) * pow(nm-540.9401,2.0)/pow(19.0589,2.0)) / pow(19.0589,2.0);
    return tmp;
}
float S(float nm) {
    float tmp = 218309.4821 * exp(-log(2.0) * pow(nm-445.5196,2.0) / pow(12.5518,2.0));
    tmp += -2.0*log(2.0)*1.9775e6 * (nm-441.6949) * exp(-log(2.0) * pow(nm-441.6949,2.0)/pow(17.5001,2.0)) / pow(17.5001,2.0);
    tmp += (-2.0*log(2.0)*(-633498.2057) * (nm-462.732) * exp(-log(2.0) * pow(nm-462.732,2.0)/pow(26.3118,2.0)) / pow(26.3118,2.0));
    tmp += (-2.0*log(2.0)*(-1.9475e6) * (nm-452.4883) * exp(-log(2.0) * pow(nm-452.4883,2.0)/pow(15.3723,2.0)) / pow(15.3723,2.0));
    return  tmp;

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

vec3 LMS2XYZ(vec3 lms) {
    return mat3(
        1.0961, -0.2789, 0.1827,
        0.4544, 0.4735, 0.0721,
        -0.0096, -0.0057, 1.0153
    )*lms;
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

// Older, original version of the function
/*vec3 waveToXyz(float wave)
{
    float x1 = (wave-442.0)*((wave<442.0)?0.0624:0.0374);
    float x2 = (wave-599.8)*((wave<599.8)?0.0264:0.0323);
    float x3 = (wave-501.1)*((wave<501.1)?0.0490:0.0382);

    float y1 = (wave-568.8)*((wave<568.8)?0.0213:0.0247);
    float y2 = (wave-530.9)*((wave<530.9)?0.0613:0.0322);

    float z1 = (wave-437.0)*((wave<437.0)?0.0845:0.0278);
    float z2 = (wave-459.0)*((wave<459.0)?0.0385:0.0725);

    return vec3(
        0.362*exp(-0.5*x1*x1) + 1.056*exp(-0.5*x2*x2) - 0.065*exp(-0.5*x3*x3),
        0.821*exp(-0.5*y1*y1) + 0.286*exp(-0.5*y2*y2),
        1.217*exp(-0.5*z1*z1) + 0.681*exp(-0.5*z2*z2)
    );
}*/

// Scales a color to the closest in-gamut representation of that color
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
    float lw = 1./resolution.y;
    if (uv.y < .5 && uv.y+lw > .5 ) bg += vec3(1,1,1);
    if (uv.y < color.r/2.0 && uv.y+lw*2.0 > color.r/2.0 ) bg *= vec3(1.0,0.0,0.0);
    if (uv.y < color.g/2.0 && uv.y+lw*2.0 > color.g/2.0 ) bg *= vec3(0.0,1.0,0.0);
    if (uv.y < color.b/2.0 && uv.y+lw*2.0 > color.b/2.0 ) bg *= vec3(0.0,0.0,1.0);

    return bg;
}
#define GAMMA vec3(2.4,2.05,1.5)
vec3 gamma(vec3 col, vec3 gamma) {
    return vec3(pow(col.r,1.0/gamma.r),pow(col.g,1.0/gamma.g),pow(col.b,1.0/gamma.b));
}
#define SOL 299792458.0e9
void main() {
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
    rgb = (rgb-black_correction(wave))*1.12/bright_correction(wave);
    float RGB = rgb.x + rgb.y + rgb.z;
    vec3 rgb2 = vec3(rgb.x/RGB,rgb.y/RGB,rgb.z/RGB);

    vec3 xyzlab = xyz2lab(xyz);
    vec3 rgblab = rgb2lab2(rgb);
    mat3 toRGB = xyzToRgb(to);
//    rgblab.x = 39;
    rgblab *= vec3(1.0,vec2((labsat_correction(wave))/2.8+1.0));
    vec3 labrgb = toRGB*lab2xyz(rgblab);
//    labrgb +=.11;
    
    vec3 corrected = toGamma(labrgb, to.trc);
    //corrected = gamma(rgb, GAMMA);
    corrected = plot(gl_FragCoord.xy, corrected, labrgb);
    //corrected = plot(gl_FragCoord.xy, corrected, lab2xyz(xyz2lab(xyz)));
    //corrected = plot(gl_FragCoord.xy, corrected, xyzlab/vec3(100,1000,1000)+vec3(0,.5,.5));
    //corrected = plot(gl_FragCoord.xy, corrected, rgblab/vec3(100,1000,1000)+vec3(0,.5,.5));
    //corrected = plot(gl_FragCoord.xy, corrected, sqrt(rgblab.z*rgblab.z+rgblab.y*rgblab.y)/vec3(1000,1000,1000)+vec3(0.5,.5,.5));
    corrected = plot(gl_FragCoord.xy, corrected, vec3(labsat_correction(wave))/vec3(10,10,10)+vec3(0.5,.5,.5));


    gl_FragColor = vec4(corrected, 1.0);
}