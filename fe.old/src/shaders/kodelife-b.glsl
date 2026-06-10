#version 150

uniform vec2 resolution;
uniform float Lvalue;
uniform sampler2D noise;
uniform vec4 primary;

// CONSTANTS
const vec3 gammaCorrection = vec3(2.33,2.5,2.53);
const vec3 wref =  vec3(0.95047, 1.0, 1.08883); 


in VertexData
{
    vec4 v_position;
    vec3 v_normal;
    vec2 v_texcoord;
} inData;

out vec4 fragColor;

// GAMMA
float gamma(float t, float g) { return pow(t, 1./g); }
vec3 gamma(vec3 c, vec3 g) { return vec3(gamma(c.r, g.r), gamma(c.g, g.g), gamma(c.b, g.b)); }

// DITHERING
float dither(float color, vec2 xy) {
    float noise = texture(noise, mod(xy/256,1)).r;
    return color + mix(-0.5/256.0, 0.5/256.0, noise);
}

float dither(float color) {
    return dither(color, gl_FragCoord.xy);
}

vec3 dither(vec3 color) {
    return vec3(dither(color.r,gl_FragCoord.xy),dither(color.g,gl_FragCoord.xy+vec2(64,0)), dither(color.b,gl_FragCoord.xy+vec2(64,0)));
}


// LAB
float xyzF(float t){ return mix(pow(t,1./3.), 7.787037*t + 0.139731, step(t,0.00885645)); }
float xyzR(float t){ return mix(t*t*t , 0.1284185*(t - 0.139731), step(t,0.20689655)); }

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
void main(void)
{
    float aspect = resolution.x/resolution.y;

    vec2 xy = gl_FragCoord.xy;

    vec2 uv = xy / resolution.xy;

    vec2 cart = uv*220-110;
    cart.x *= aspect;

    //vec3 lab = vec3(uv.x*100,0,0);
    vec3 targetlab = rgb2lab(gamma(primary.rgb,1/gammaCorrection));
    vec3 lab = vec3(Lvalue,cart);
    lab = vec3(targetlab.x, cart);
    float lnAB = length(targetlab.yz);
    lab = vec3(cart.y*2, cart.x*targetlab.y/lnAB, cart.x*targetlab.z/lnAB);
    vec3 clab = lab*vec3(1,-1,-1);
    //lab=targetlab;
    vec3 rgb = lab2rgb(lab);
    vec3 crgb = lab2rgb(clab);
    //rgb = lab2rgb(rgb2lab(lab2rgb(lab)));
    if (rgb.r>1 || rgb.b>1 || rgb.g>1 || rgb.r<0 || rgb.b<0 || rgb.g<0) rgb = vec3(lab2rgb(vec3(50,0,0)));
    if (crgb.r>1 || crgb.b>1 || crgb.g>1 || crgb.r<0 || crgb.b<0 || crgb.g<0) rgb = vec3(lab2rgb(vec3(50,0,0)));
    vec3 color = vec3(dither(rgb));
    //color = 
    color = gamma(color, gammaCorrection);
    //if( distance(lab, targetlab) < 1 ) color = vec3(1);

    fragColor = vec4(color,1);
}
