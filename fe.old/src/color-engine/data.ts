
import {Matrix3 as mat3, Vector3 as vec3} from 'three';
import {Transfer, RgbSpace} from './theory';
import * as Factory from './factory';

export const Primaries = {
    identity: new mat3().set(
        1,0,0,
        0,1,0,
        0,0,1
    ),
    CIE1931: Factory.PrimaryColors(
        0.72329, 0.27671,
        0.28557, 0.71045,
        0.15235, 0.02
    ),
    NTSC: Factory.PrimaryColors(
        0.67, 0.33,
        0.21, 0.71,
        0.14, 0.08
    ),
    EBU: Factory.PrimaryColors(
        0.64, 0.33,
        0.29, 0.6,
        0.15, 0.06
    ),
    P22: Factory.PrimaryColors(
        0.61, 0.342,
        0.298, 0.588,
        0.151, 0.064
    ),
    SMPTEC: Factory.PrimaryColors(
        0.63, 0.34,
        0.31, 0.595,
        0.155, 0.07
    ),
    HDTV240M: Factory.PrimaryColors(
        0.67, 0.33,
        0.21, 0.71,
        0.15, 0.06
    ),
    Sony: Factory.PrimaryColors(
        0.625, 0.34,
        0.28, 0.595,
        0.155, 0.07
    ),
    REC709: Factory.PrimaryColors(
        0.64, 0.33,
        0.3, 0.6,
        0.15, 0.06
    ),
    DCIP3: Factory.PrimaryColors(
        0.68, 0.32,
        0.265, 0.69,
        0.15, 0.06
    ),
    REC2020: Factory.PrimaryColors(
        0.708, 0.292,
        0.17, 0.797,
        0.131, 0.046
    ),
    HUNT: Factory.PrimaryColors(
        0.8374, 0.1626,
        2.3, -1.3,
        0.168, 0.0
    ),
    CIECAM97_1: Factory.PrimaryColors(
        0.7, 0.306,
        -0.357, 1.26,
        0.136, 0.042
    ),
    CIECAM97_2: Factory.PrimaryColors(
        0.693, 0.316,
        -0.56, 1.472,
        0.15, 0.067
    ),
    CIECAM02: Factory.PrimaryColors(
        0.711, 0.295,
        -1.476, 2.506,
        0.144, 0.057
    ),
    SAMSUNG_1: Factory.PrimaryColors(
        0.633, 0.340,
        0.320, 0.622,
        0.155, 0.042
    ),
    LMS: Factory.PrimaryColors(
        194735469.0/263725741.0, 68990272.0/263725741.0,
        141445123.0/106612934.0, -34832189.0/106612934.0,
        36476327.0/229961670.0, 0.0
    )
}

export const WhitePoints = {
    C: Factory.WhitePoint(0.310063, 0.316158),
    E: Factory.WhitePoint(1.0/3.0, 1.0/3.0),
    P22: Factory.WhitePoint(0.313, 0.329),
    D65: Factory.WhitePoint(0.312713, 0.329016),
    D50: Factory.WhitePoint(0.34567, 0.35850),
    Theater: Factory.WhitePoint(0.314, 0.351),
    Sony: Factory.WhitePoint(0.283, 0.298)
}

export const Transfers = {
    gamma10: {
        power: 1,
        off: 0,
        slope: 1,
        cutoffToLinear: 0,
        cutoffToGamma: 0
    },
    gamma18: {
        power: 1.8,
        off: 0,
        slope: 1,
        cutoffToLinear: 0,
        cutoffToGamma: 0
    },
    gamma22: {
        power: 2.2,
        off: 0,
        slope: 1,
        cutoffToLinear: 0,
        cutoffToGamma: 0
    },
    gamma24: {
        power: 2.4,
        off: 0,
        slope: 1,
        cutoffToLinear: 0,
        cutoffToGamma: 0
    },
    gamma25: {
        power: 2.5,
        off: 0,
        slope: 1,
        cutoffToLinear: 0,
        cutoffToGamma: 0
    },
    gamma28: {
        power: 2.8,
        off: 0,
        slope: 1,
        cutoffToLinear: 0,
        cutoffToGamma: 0
    },
    gamma170m: {
        power: 1/0.45,
        off: 0.099,
        slope: 4.5,
        cutoffToLinear: 0.0812,
        cutoffToGamma: 0.018
    },
    gammmaSrgb: {
        power: 2.4,
        off: 0.055,
        slope: 12.92,
        cutoffToLinear: 0.04045,
        cutoffToGamma: 0.0031308
    }
}
    
export const RgbSpaces = {
    identity: {
        primaries: Primaries.identity,
        white: WhitePoints.E,
        transfer: Transfers.gamma10
    },
    CIE1931: {
        primaries: Primaries.CIE1931,
        white: WhitePoints.E,
        transfer: Transfers.gamma10
    },
    NTSC: {
        primaries: Primaries.NTSC,
        white: WhitePoints.C,
        transfer: Transfers.gamma22
    },
    SMPTE240M: {
        primaries: Primaries.HDTV240M,
        white: WhitePoints.D65,
        transfer: Transfers.gamma22
    },
    EBU: {
        primaries: Primaries.EBU,
        white: WhitePoints.D65,
        transfer: Transfers.gamma28
    },
    SMPTEC: {
        primaries: Primaries.SMPTEC,
        white: WhitePoints.D65,
        transfer: Transfers.gamma22
    },
    SMPTE170M: {
        primaries: Primaries.SMPTEC,
        white: WhitePoints.D65,
        transfer: Transfers.gamma170m
    },
    Sony: {
        primaries: Primaries.Sony,
        white: WhitePoints.Sony,
        transfer: Transfers.gamma25
    },
    REC709: {
        primaries: Primaries.REC709,
        white: WhitePoints.D65,
        transfer: Transfers.gamma170m
    },
    SRGB: {
        primaries: Primaries.REC709,
        white: WhitePoints.D65,
        transfer: Transfers.gammmaSrgb
    },
    DCIP3D65: {
        primaries: Primaries.DCIP3,
        white: WhitePoints.D65,
        transfer: Transfers.gamma170m
    },
    DCIP3Theater: {
        primaries: Primaries.DCIP3,
        white: WhitePoints.Theater,
        transfer: Transfers.gamma170m
    },
    REC2020: {
        primaries: Primaries.REC2020,
        white: WhitePoints.D65,
        transfer: Transfers.gamma170m
    },
    HUNT: {
        primaries: Primaries.HUNT,
        white: WhitePoints.E,
        transfer: Transfers.gamma10
    },
    CIECAM97_1: {
        primaries: Primaries.CIECAM97_1,
        white: WhitePoints.E,
        transfer: Transfers.gamma10
    },
    CIECAM97_2: {
        primaries: Primaries.CIECAM97_2,
        white: WhitePoints.E,
        transfer: Transfers.gamma10
    },
    CIECAM2002: {
        primaries: Primaries.REC2020,
        white: WhitePoints.E,
        transfer: Transfers.gamma10
    },
    LMS: {
        primaries: Primaries.LMS,
        white: WhitePoints.E,
        transfer: Transfers.gamma10
    }
}

export let MonitorRgbSpaces = {
    SAMSUNG_S23B350: {
        primaries: Primaries.SAMSUNG_1,
        white: WhitePoints.D65,
        transfer: [
            {
                power: 2.4,
                off: 0,
                slope: 1,
                cutoffToLinear: 0,
                cutoffToGamma: 0
            },
            {
                power: 2.4,
                off: 0,
                slope: 1,
                cutoffToLinear: 0,
                cutoffToGamma: 0
            },
            {
                power: 2.4,
                off: 0,
                slope: 1,
                cutoffToLinear: 0,
                cutoffToGamma: 0
            }
        ]
    }
}

export const StandardXYZtoLMStransforms = {
    CIECAM02: new mat3().set(
        0.7328, -0.7036, 0.003,
        0.4296, 1.6975, 0.0136,
        -0.1624, 0.0061, 0.9834
    ),
    HUNT: new mat3().set(
        0.38971, -0.22981, 0,
        0.68898, 1.1834, 0,
        -0.07868, 0.04641, 1
    ),
    CIECAM97_1: new mat3().set(
        0.8951, -0.7502, 0.0389,
        0.2664, 1.7135, -0.0685,
        -0.1614, 0.0367, 1.0296
    ),
    CIECAM97_2: new mat3().set(
        0.8562, -0.836, 0.0357,
        0.3372, 1.8327, -0.0469,
        -0.1934, 0.0033, 1.0112
    )
}
