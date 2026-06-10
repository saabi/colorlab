import {Matrix3 as mat3, Vector3 as vec3} from 'three';
import {Transfer, RgbSpace} from './theory';

export function PrimaryColors(r1: number, r2: number, g1: number, g2: number, b1: number, b2: number) {
    return new mat3().set( r1, r2, 1 - r1 - r2,  
                            g1, g2, 1 - g1 - g2,
                            b1, b2, 1 - b1 - b2);
}
export function WhitePoint(x: number, y: number) {
    return new vec3(x/y, 1, (1 - x - y)/y);
}
function diag(v: vec3) {
    return new mat3().set( v.x, 0, 0,  
                    0, v.y, 0,  
                    0, 0, v.z);
}
export function SpaceToXyz(space: RgbSpace) {
    let tmpMat = space.primaries.clone();
    let tmpVec = space.white.clone();
    return tmpMat.multiply( diag( tmpVec.applyMatrix3( new mat3().getInverse(space.primaries, true) ) ) ) ;
}
export function XyzToSpace(space: RgbSpace) {
    return new mat3().getInverse(SpaceToXyz(space), true);
}
export function ConversionMatrix(f: RgbSpace, t: RgbSpace) {
    return XyzToSpace(t).multiply( SpaceToXyz(f) );
}        
