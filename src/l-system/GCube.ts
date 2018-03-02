import {vec3, mat3, mat4, quat} from 'gl-matrix';
import LSystem from 'LSystem';
import {lRandom} from './LRandom';
import {INV_PRISM_HEIGHT} from '../geometry/Plant';
import {LSymbol} from './LSymbol';
import {GSymbol, GShape} from './GSymbol';

const INV_SQRT_TWO = 0.70710678118;

export class GCube extends GSymbol {
    toUnitCube: mat4;

    constructor(stringRepr: string, position: vec3, rotation: vec3, scale: vec3) {
        super(stringRepr, position, rotation, scale, GShape.CUBE);

        this.toUnitCube = mat4.create();
        let toUnitCubeQuat = quat.create();
        quat.fromEuler(toUnitCubeQuat, 0, 45, 0);
        mat4.fromRotationTranslationScale(this.toUnitCube, toUnitCubeQuat, vec3.fromValues(0, -0.5, 0), vec3.fromValues(INV_SQRT_TWO, INV_PRISM_HEIGHT, INV_SQRT_TWO)); 

        this.action = function (lsys: LSystem) {
            // make transformation matrix with all of shape's transformations
            let q = quat.create();
            quat.fromEuler(q, this.rotation[0], this.rotation[1], this.rotation[2]);
            let m = mat4.create();
            mat4.fromRotationTranslationScale(m, q, this.position, this.scale); 

            mat4.multiply(m, m, this.toUnitCube);
            // also scale into unit cube
            //lsys.plant.addPrism(m, 4, INV_SQRT_TWO, INV_SQRT_TWO, INV_PRISM_HEIGHT);
            //lsys.plant.addPrism(m, 4, 1, 1, 1);
            lsys.plant.addNormalCorrectPrism(m, 4, 1, 1, 1);
        };
    }

    //canExpand(): boolean {
        //return true;
    //}

    // p should be in [0, 1]
    expand(p: number): Array<LSymbol> {
        vec3.set(this.scale, this.scale[0], this.scale[1] * 0.5, this.scale[2]);
        return [this, new GCube("blah", vec3.fromValues(this.position[0], this.position[1] + this.scale[1], this.position[2]), this.rotation, vec3.fromValues(this.scale[0] * 0.5, this.scale[1], this.scale[2]))];
    }

};

//export default ExpansionRule;
//export default LSymbol;
