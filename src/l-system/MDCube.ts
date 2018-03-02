import {vec3, mat3, mat4, quat} from 'gl-matrix';
import LSystem from 'LSystem';
import {lRandom} from './LRandom';
import {INV_PRISM_HEIGHT} from '../geometry/Plant';
import {LSymbol} from './LSymbol';
import {GSymbol, GShape} from './GSymbol';
import {GCube} from './GCube';

// medium density cube

export class MDCube extends GCube {
    isTop: boolean;
    isBot: boolean;

    constructor(stringRepr: string, position: vec3, rotation: vec3, scale: vec3) {
        super(stringRepr, position, rotation, scale);
        this.isTop = true;
        this.isBot = true;
    }

    subdivide(axis: number): Array<LSymbol> {
        let p = lRandom.getNext();
        let subdivs = Math.floor(2 + p * 3);
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

        arr.push(this);

        for (let i = 1; i < subdivs; i++) {
            let pos = vec3.clone(this.position);
            pos[axis] += i * increment;
            let c = new MDCube("A", pos, vec3.clone(this.rotation), vec3.clone(this.scale));
            c.depth = this.depth;
            arr.push(c);
        }
        return arr;
    }

    //canExpand(): boolean {
        //return true;
    //}

    // p should be in [0, 1]
    expand(p: number): Array<LSymbol> {
        if (p > 0.9) {
            // force some subdivs before disappearing
            if (this.depth > 1) {
                // delete self
                this.isTerminal = true;
                this.action = function (lsys: LSystem) { };
                return [this];
            }
        }
        else {
            // normalize
            p /= 0.9;
        }
        
        // else, try subdividing
        let arr: Array<LSymbol>;
        if (p < 0.333) {
            arr = this.subdivide(0);
        }
        else if (p < 0.666) {
            arr = this.subdivide(1);
        }
        else {
            arr = this.subdivide(2);
        }
        return arr;
        //vec3.set(this.scale, this.scale[0], this.scale[1] * 0.5, this.scale[2]);
        //return [this, new GCube("blah", vec3.fromValues(this.position[0], this.position[1] + this.scale[1], this.position[2]), this.rotation, vec3.fromValues(this.scale[0] * 0.5, this.scale[1], this.scale[2]))];
    }

};

//export default ExpansionRule;
//export default LSymbol;
