float sRGBgamma(float t) {
    return mix(1.055*pow(t, 1./2.4) - 0.055, 12.92*t, step(t, 0.0031308));
}

vec3 sRGBgamma(in vec3 c) {
    return vec3 (sRGBgamma(c.x), sRGBgamma(c.y), sRGBgamma(c.z));
}

float generalizedSRGBgamma(float linear, float g, float a) {
    float k = a/(g-1.0);
    float gm1 = g - 1.0;
    float d = (pow(1.0+a,g)+pow(gm1,gm1))/(pow(a,gm1)*pow(g,g));
    return mix((1.0+a)*pow(linear, 1./g) - a, a*linear, step(linear, k/d));
}

vec3 sRGBlikeGamma(vec3 linear, vec3 gamma) {
    return vec3(
        generalizedSRGBgamma(linear.r, gamma.r, (gamma.r-1.0)*0.055/2.4),
        generalizedSRGBgamma(linear.g, gamma.g, (gamma.g-1.0)*0.055/2.4),
        generalizedSRGBgamma(linear.b, gamma.b, (gamma.b-1.0)*0.055/2.4));
}

