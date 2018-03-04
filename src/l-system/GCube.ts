import {vec3, vec4, mat3, mat4, quat} from 'gl-matrix';
import LSystem from 'LSystem';
import {lRandom} from './LRandom';
import {INV_PRISM_HEIGHT} from '../geometry/Plant';
import {LSymbol} from './LSymbol';
import {GSymbol, GShape} from './GSymbol';
import {useTrueColor} from '../main';

const INV_SQRT_TWO = 0.70710678118;

export const EDGE_LEFT = 0;
export const EDGE_RIGHT = 1;
export const EDGE_BOT = 2;
export const EDGE_TOP = 3;
export const EDGE_BACK = 4;
export const EDGE_FRONT = 5;


export class GCube extends GSymbol {
    toUnitCube: mat4;
    // indexed like: [-x, +x, -y, +y, -z, +z]
    // index is (2 * axis) + (min ? 0 : 1)
    isEdge: Array<boolean>;
    color: vec4;
    trueColor: vec4;
    sides: number;
    // indexed like: [x, y, z]
    // how many times this has subdivided on this axis
    subdivCount: Array<number>;
    // used in subdivision
    subdivMin: number;
    subdivRange: number;
    scaleTop: number;
    subdivMustBeOdd: boolean;
    subdivMustBeEven: boolean;

    globalRotation: vec3;
    globalTranslation: vec3;

    constructor(stringRepr: string, position: vec3, rotation: vec3, scale: vec3) {
        super(stringRepr, position, rotation, scale, GShape.CUBE);
        this.globalRotation = vec3.create();
        this.globalTranslation = vec3.create();

        this.isEdge = [true, true, true, true, true, true];
        this.color = vec4.fromValues(1, 0.5, 0.5, 1);
        this.trueColor = vec4.fromValues(0.8, 0.8, 0.8, 1);
        this.sides = 4;
        this.subdivCount = [0, 0, 0];
        this.subdivMin = 2;
        this.subdivRange = 2;
        this.scaleTop = 1;
        this.subdivMustBeOdd = false;
        this.subdivMustBeEven = false;

        this.toUnitCube = mat4.create();
        let toUnitCubeQuat = quat.create();
        quat.fromEuler(toUnitCubeQuat, 0, 45, 0);
        mat4.fromRotationTranslationScale(this.toUnitCube, toUnitCubeQuat, vec3.fromValues(0, -0.5, 0), vec3.fromValues(INV_SQRT_TWO, INV_PRISM_HEIGHT, INV_SQRT_TWO)); 

        this.action = function (lsys: LSystem) {
            // make transformation matrix with all of shape's transformations
            let q = quat.create();
            quat.fromEuler(q, this.rotation[0], this.rotation[1], this.rotation[2]);
            let m = mat4.create();
            //mat4.fromRotationTranslation(m, q, vec3.fromValues(0, 0, 0));
            mat4.fromRotationTranslationScale(m, q, this.position, this.scale); 

            mat4.multiply(m, m, this.toUnitCube);
            lsys.plant.useColor(this.getColor());
            // also scale into unit cube
            //lsys.plant.addPrism(m, 4, INV_SQRT_TWO, INV_SQRT_TWO, INV_PRISM_HEIGHT);
            //lsys.plant.addPrism(m, 4, 1, 1, 1);
            // apply global rotation after local transforms
            let globalQ = quat.create();
            quat.fromEuler(globalQ, this.globalRotation[0], this.globalRotation[1], this.globalRotation[2]);
            let globalM = mat4.create();
            mat4.fromRotationTranslation(globalM, globalQ, this.globalTranslation);

            mat4.multiply(m, globalM, m);
            lsys.plant.addNormalCorrectPrism(m, this.sides, 1, this.scaleTop, 1);
        };
    }

    getColor(): vec4 {
        return (useTrueColor) ? this.trueColor : this.color;
    }

    //canExpand(): boolean {
        //return true;
    //}

    // p should be in [0, 1]
    expand(p: number): Array<LSymbol> {
        vec3.set(this.scale, this.scale[0], this.scale[1] * 0.5, this.scale[2]);
        return [this, new GCube("blah", vec3.fromValues(this.position[0], this.position[1] + this.scale[1], this.position[2]), this.rotation, vec3.fromValues(this.scale[0] * 0.5, this.scale[1], this.scale[2]))];
    }


    subdivide(axis: number): Array<LSymbol> {
        let p = lRandom.getNext();
        let subdivs = Math.floor(this.subdivMin + p * this.subdivRange);
        if (axis == 1) {
            subdivs += 1;
        }
        let isEven = (subdivs % 2) == 0;
        if ((this.subdivMustBeEven && !isEven) || (this.subdivMustBeOdd && isEven)) {
            subdivs += 1;
        }

        this.subdivCount[axis] += 1;

        let arr = new Array<LSymbol>();

        let invSubdivs = 1 / subdivs;
        // adjust current symbol
        let len = this.scale[axis];
        // scale
        this.scale[axis] *= invSubdivs;
        // translate
        let origin = len * 0.5;
        let newOrigin = origin * invSubdivs;
        let increment = len * invSubdivs;
        this.position[axis] += newOrigin - origin;
        // increment depth
        this.depth += 1;

        // update isEdge -- store old values
        let wasMin = this.isEdge[2 * axis];
        let wasMax = this.isEdge[2 * axis + 1];
        // update isEdge -- set all on axis to false
        this.isEdge[2 * axis] = false;
        this.isEdge[2 * axis + 1] = false;
    
        arr.push(this);

        let factor = 0.9;

        for (let i = 1; i < subdivs; i++) {
            //let pos = vec3.clone(this.position);
            //pos[axis] += i * increment;
            let c = this.spawnCopy();
            c.position[axis] += i * increment;
            c.color[0] *= factor;
            c.color[1] *= factor;
            c.color[2] *= factor;
            factor *= 0.9;
            //let c = new MDCube("A", pos, vec3.clone(this.rotation), vec3.clone(this.scale));
            //c.depth = this.depth;
            arr.push(c);
        }

        // update edge -- restore min/max edges
        // "this" is min
        this.isEdge[2 * axis] = wasMin;
        // last is max
        (<GCube>arr[subdivs - 1]).isEdge[2 * axis + 1] = wasMax;

        return arr;
    }

    spawnCopy(): GCube {
        console.log("GCube clone");
        let c = new GCube(this.stringRepr + "*", vec3.clone(this.position), vec3.clone(this.rotation), vec3.clone(this.scale));
        c.isEdge = this.isEdge.slice();
        c.depth = this.depth; 
        vec4.copy(c.color, this.color);
        c.subdivCount = this.subdivCount.slice();
        return c;
    }

    isCorner(): boolean {
        return (this.isEdge[EDGE_LEFT] || this.isEdge[EDGE_RIGHT]) && (this.isEdge[EDGE_BACK] || this.isEdge[EDGE_FRONT]);
    }

};

//export default ExpansionRule;
//export default LSymbol;
