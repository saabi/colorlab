import {Matrix3 as mat3, Vector3 as vec3} from 'three';

export interface Transfer {
    power: number;
    off: number;
    slope: number;
    cutoffToLinear: number;
    cutoffToGamma: number;
};

export interface RgbSpace {
    primaries: mat3;
    white: vec3;
    trc: Transfer | [Transfer,Transfer,Transfer];
};

