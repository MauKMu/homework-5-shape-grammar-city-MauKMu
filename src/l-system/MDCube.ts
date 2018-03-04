import {vec3, vec4, mat3, mat4, quat} from 'gl-matrix';
import LSystem from 'LSystem';
import {lRandom} from './LRandom';
import {INV_PRISM_HEIGHT} from '../geometry/Plant';
import {LSymbol} from './LSymbol';
import {GSymbol, GShape} from './GSymbol';
import {MDCylinder} from './MDCylinder';
import {GCube, EDGE_BACK, EDGE_BOT, EDGE_FRONT, EDGE_LEFT, EDGE_RIGHT, EDGE_TOP} from './GCube';

// medium density cube

const MAX_DEPTH = 4;

const myColors = [
    //vec4.fromValues(0.9, 0.9, 0.8, 1.0), // yellow
    //vec4.fromValues(0.95, 0.8, 0.7, 1.0), // orange
    vec4.fromValues(0.85, 0.85, 0.85, 1.0), // white
    //vec4.fromValues(0.95, 0.75, 0.75, 1.0), // red
    vec4.fromValues(0.85, 0.85, 0.97, 1.0), // blue
    vec4.fromValues(0.85, 0.95, 0.87, 1.0), // green
    //vec4.fromValues(0.95, 0.75, 0.97, 1.0), // purple
];

enum Fate {
    TERMINAL = 1,
    COLUMN,
    DELETED,
    
};

export class MDCube extends GCube {
    fate: Fate;
    floors: number;

    constructor(stringRepr: string, position: vec3, rotation: vec3, scale: vec3) {
        super(stringRepr, position, rotation, scale);
        this.fate = Fate.TERMINAL;
        // pick from a few random colors
        let p = lRandom.getNext();
        vec4.copy(this.trueColor, myColors[Math.floor(p * 0.99999 * myColors.length)]);
        // pick a number of floors
        this.floors = Math.ceil(lRandom.getNext() * 4) + 8;
    }

    spawnCopy(): MDCube {
        let c = new MDCube(this.stringRepr + "*", vec3.clone(this.position), vec3.clone(this.rotation), vec3.clone(this.scale));
        c.isEdge = this.isEdge.slice();
        c.depth = this.depth; 
        vec4.copy(c.color, this.color);
        vec4.copy(c.trueColor, this.trueColor);
        c.subdivCount = this.subdivCount.slice();
        c.globalRotation = vec3.clone(this.globalRotation);
        c.globalTranslation = vec3.clone(this.globalTranslation);
        c.floors = this.floors;
        c.fate = this.fate;
        return c;
    }

    canExpand(): boolean {
        return (!this.isTerminal);
        //return (!this.isTerminal) && (this.isBot || this.isTop);
    }

    isOuterXZ(): boolean {
        return this.isEdge[EDGE_LEFT] || this.isEdge[EDGE_RIGHT] || this.isEdge[EDGE_BACK] || this.isEdge[EDGE_FRONT];
    }

    // p should be in [0, 1]
    expand(p: number): Array<LSymbol> {
        if (this.depth == 0) {
            // subdivide along X, Z only
            this.subdivMin = 4;
            this.subdivRange = 3;
            if (p < 0.5) {
                return this.subdivide(0);
            }
            else {
                return this.subdivide(2);
            }
        }
        else if (this.depth == 1) {
            // subdivide along other axis
            if (this.subdivCount[0] > 0) {
                return this.subdivide(2);
            }
            else {
                return this.subdivide(0);
            }
        }
        else if (this.depth == 2) {
            // delete with moderate chance
            if ((p < 0.3 && this.isCorner()) || (p < 0.1 && !this.isOuterXZ())) {
                // "delete" self
                this.stringRepr = "0";
                this.isTerminal = true;
                this.action = function (lsys: LSystem) { };
                this.depth += 1;
                return [this];
            }
            else {
                // subdivide by Y once
                //this.subdivMin = 2;
                //this.subdivRange = 6;
                this.subdivMin = this.floors;
                this.subdivRange = 0;
                let arr = this.subdivide(1);
                // try to make columns
                if (lRandom.getNext() < 0.3) {
                    let colCount = Math.ceil(lRandom.getNext() * 3);
                    for (let i = 0; i < colCount; i++) {
                        (<MDCube>arr[i]).fate = Fate.COLUMN;
                    }
                }
                // try to delete
                if (this.isCorner() && lRandom.getNext() < 0.3) {
                    let delCount = Math.ceil(lRandom.getNext() * 3);
                    for (let i = 0; i < delCount; i++) {
                        (<MDCube>arr[arr.length - 1 - i]).fate = Fate.DELETED;
                    }
                }
                // scale every other floor
                const factor = 1.11;
                for (let i = 1; i < arr.length; i += 2) {
                    if ((<MDCube>arr[i]).fate != Fate.TERMINAL) {
                        // skip because this will be deleted anyway
                        continue;
                    }
                    (<MDCube>arr[i]).scale[0] *= factor;
                    (<MDCube>arr[i]).scale[2] *= factor;
                }
                return arr;
            }
        }
        else if (this.depth == 3) {
            this.depth += 1;
            if (this.fate == Fate.COLUMN) {
                // "delete" self
                this.stringRepr = "0";
                this.isTerminal = true;
                this.action = function (lsys: LSystem) { };
                // convert to columns
                let cyl = new MDCylinder("cyl", vec3.clone(this.position), vec3.clone(this.rotation), vec3.clone(this.scale));
                vec4.copy(cyl.color, this.color);
                vec4.scale(cyl.trueColor, this.trueColor, 0.7);
                //vec4.copy(cyl.trueColor, this.trueColor);
                cyl.scale[0] = Math.min(cyl.scale[0], cyl.scale[2]) * 0.6;
                cyl.scale[2] = cyl.scale[0];
                cyl.globalRotation = vec3.clone(this.globalRotation);
                cyl.globalTranslation = vec3.clone(this.globalTranslation);
                return [cyl];
            }
            return [this];
        }
        else if (this.depth == 4) {
            this.depth += 1;
            if (this.fate == Fate.DELETED) {
                // delete self
                this.stringRepr = "0";
                this.isTerminal = true;
                this.action = function (lsys: LSystem) { };
            }
            return [this];
        }
        this.isTerminal = true;
        return [this];
    }

};

//export default ExpansionRule;
//export default LSymbol;
