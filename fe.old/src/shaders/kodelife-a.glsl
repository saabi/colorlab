#version 440

uniform vec2 resolution;
uniform float colorIntensity;
uniform float gammaCenter;
uniform float gammaRange;

in VertexData
{
    vec4 v_position;
    vec3 v_normal;
    vec2 v_texcoord;
} inData;

out vec4 fragColor;

uniform sampler2D noise;
uniform vec3 palette[8];
uniform int paletteSize;

const int indexMatrix8x8[64] = int[](0,  32, 8,  40, 2,  34, 10, 42,
                                     48, 16, 56, 24, 50, 18, 58, 26,
                                     12, 44, 4,  36, 14, 46, 6,  38,
                                     60, 28, 52, 20, 62, 30, 54, 22,
                                     3,  35, 11, 43, 1,  33, 9,  41,
                                     51, 19, 59, 27, 49, 17, 57, 25,
                                     15, 47, 7,  39, 13, 45, 5,  37,
                                     63, 31, 55, 23, 61, 29, 53, 21);

float indexValue() {
    int x = int(mod(gl_FragCoord.x, 8));
    int y = int(mod(gl_FragCoord.y, 8));
    return indexMatrix8x8[(x + y * 8)] / 64.0;
}

float dither(float color) {
    color *= 256;
    float closestColor = round(color);
    float secondClosestColor = closestColor + 1;
    color /= 256;
    closestColor /= 256;
    secondClosestColor /= 256;
    float d = indexValue();
    float distance = abs(closestColor - color);
    return (distance < d) ? closestColor : secondClosestColor;
}

float ditherA(float color) {
    return color + indexValue() - (1.0 / 128.0);
}
float dither2(float color) {
    float noise = texture(noise, mod(gl_FragCoord.xy/256,1)).r;
    return color + mix(-0.5/256.0, 0.5/256.0, noise);
}

float cgamma(float g, float a, float linear) {
    float k = a/(g-1.0);
    float gm1 = g - 1.0;
    float d = (pow(1.0+a,g)+pow(gm1,gm1))/(pow(a,gm1)*pow(g,g));
    return mix((1.0+a)*pow(linear, 1./g) - a, a*linear, step(linear, k/d));
    //return linear<k ? linear*d : (1.0+a) * pow(linear,1.0/g) - a;
}

float gamma(float t, float gamma) { return pow(t, 1./gamma); }
float sRGBgamma(float t) { return mix(1.055*pow(t, 1./2.4) - 0.055, 12.92*t, step(t, 0.0031308)); }
float sRGBgamma2(float t, float gamma) { return cgamma(gamma, (gamma-1)*0.055/2.4, t); }
vec3 sRGB2(vec3 c) { return vec3 (sRGBgamma(c.x), sRGBgamma(c.y), sRGBgamma(c.z)); }

void main( void ) {

    float aspect = resolution.x/resolution.y;

    vec2 xy = gl_FragCoord.xy;

    vec2 uv = ( xy * 1.0 / resolution.xy );
    uv.x -= 0.5;

    vec2 cart = vec2(xy.x*aspect, xy.y);

    float gammaBase = gammaCenter - gammaRange/2;
    float gammaCorrection = (max(0, gammaBase + uv.y * gammaRange));

    float offset = (0.5 - abs(uv.x))*2;
    int evenodd = (int(xy.y/1) % 2);
    evenodd *= (gammaCorrection<=0?0:1);

    vec3 color = vec3(0,01,0);
    float factor = mix(1,clamp(offset*2-0.25,0,1),offset>0.125);
    float finalIntensity = mix(0.5,evenodd, factor)*colorIntensity * (xy.y>=0?1:0);

    float gammaCorrected = sRGBgamma2(finalIntensity, gammaCorrection);
    gammaCorrected = gamma(finalIntensity, gammaCorrection);

    color *= dither2(gammaCorrected);
    
//    color *= dither2(finalIntensity);
//    color *= dither2(mix(0.5,evenodd, factor));
//    color *= gamma(0.,20000.4);
//    color = vec3(gamma(mix(0.5,evenodd, factor),2.2));

    if (abs(xy.y+0.5 - resolution.y/2) == 20) color = vec3(1);

    fragColor = vec4( color, 1.0 );

}