import {Matrix3 as mat3, Vector3 as vec3} from 'three';
import {Transfer, RgbSpace} from './theory';

let pow = Math.pow;
let exp = Math.exp;
let log = Math.log;

function gauss(x: number, A: number, x0: number, dx: number) {
    return A*exp(-0.6931471805599453 * pow((x - x0)/dx, 2.0));
}
function dGauss(x: number, A: number, x0: number, dx: number) {
    return -2.0*0.6931471805599453* A * (x-x0) * 
    exp(-0.6931471805599453 * pow(x-x0,2.0)/pow(dx,2.0)) / pow(dx,2.0);
}

function wavelengthToL (nm: number) {
    let tmp = gauss(nm, 104344.92193406945, 569.5078040786743, 54.651444860776735);
    tmp += dGauss(nm, -156430.21591338454, 590.1108598846736, 26.58929437546323);
    tmp += dGauss(nm, -145288.27503926188, 512.6297253843892, 19.260656047167043);
    tmp += gauss(nm, -7591.194203449524, 641.0781271336464, 37.920029730475456);
    tmp += gauss(nm, 1905.4399959767024, 434.408633321614, 17.7321868069511);
    return  tmp;
}

function wavelengthToM (nm: number) {
    let tmp = 108991.4133 * exp(-log(2.0) * pow(nm-547.2395,2.0) / pow(40.8751,2.0));
    tmp += -2.0*log(2.0)*486896.0939 * (nm-504.2192) * exp(-log(2.0) * pow(nm-504.2192,2.0)/pow(42.5372,2.0)) / pow(42.5372,2.0);
    tmp += -2.0*log(2.0)*(-58768.3624) * (nm-508.3118) * exp(-log(2.0) * pow(nm-508.3118,2.0)/pow(13.5221,2.0)) / pow(13.5221,2.0); 
    tmp += -2.0*log(2.0)*97877.6717 * (nm-540.9401) * exp(-log(2.0) * pow(nm-540.9401,2.0)/pow(19.0589,2.0)) / pow(19.0589,2.0);
    return tmp;
}

function wavelengthToS (nm: number) {
    let tmp = gauss(nm, 221368.60076492612, 444.9973131221829, 12.37472521822061);
    tmp += dGauss(nm, 2185498.6747593815, 442.0889660569674, 17.327094668813405);
    tmp += dGauss(nm, -628537.5904831715, 463.27066341009333, 25.92687407427804);
    tmp += dGauss(nm, -2253931.2636179845, 451.54166499032675, 15.502068959529584);
    tmp += dGauss(nm, -7463.1094212072485, 447.91353164623615, 3.692212735536991);
    return  tmp;
}
function coordsLMS(m: vec3, nm: number) {
    return m.set(
        wavelengthToL(nm)/100000, 
        wavelengthToM(nm)/100000,
        wavelengthToS(nm)/100000);
}
