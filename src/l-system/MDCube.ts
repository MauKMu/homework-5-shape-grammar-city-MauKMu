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

export class MDCube extends GCube {

    constructor(stringRepr: string, position: vec3, rotation: vec3, scale: vec3) {
        super(stringRepr, position, rotation, scale);
    }

    spawnCopy(): MDCube {
        let c = new MDCube(this.stringRepr + "*", vec3.clone(this.position), vec3.clone(this.rotation), vec3.clone(this.scale));
        c.isEdge = this.isEdge.slice();
        c.depth = this.depth; 
        vec4.copy(c.color, this.color);
        c.subdivCount = this.subdivCount.slice();
        c.globalRotation = vec3.clone(this.globalRotation);
        c.globalTranslation = vec3.clone(this.globalTranslation);
        return c;
    }

    canExpand(): boolean {
        return (!this.isTerminal) && (this.isEdge[EDGE_BOT] || this.isEdge[EDGE_TOP]);
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
            if (p < 0.3 && this.isCorner()) {
                // "delete" self
                this.stringRepr = "0";
                this.isTerminal = true;
                this.action = function (lsys: LSystem) { };
                this.depth += 1;
                return [this];
            }
            else {
                // subdivide by Y once
                this.subdivMin = 2;
                this.subdivRange = 6;
                return this.subdivide(1);
            }
        }
        else if (this.depth < 5) {
            // try deleting twice based on Y division
            this.depth += 1;
            if (p < 0.3) {
                if (this.isEdge[EDGE_BOT] && !this.isEdge[EDGE_TOP]) {
                    // "delete" self
                    this.stringRepr = "0";
                    this.isTerminal = true;
                    this.action = function (lsys: LSystem) { };
                    // convert to columns
                    let cyl = new MDCylinder("cyl", vec3.clone(this.position), vec3.clone(this.rotation), vec3.clone(this.scale));
                    vec4.copy(cyl.color, this.color);
                    cyl.scale[0] = Math.min(cyl.scale[0], cyl.scale[2]) * 0.6;
                    cyl.scale[2] = cyl.scale[0];
                    cyl.globalRotation = vec3.clone(this.globalRotation);
                    cyl.globalTranslation = vec3.clone(this.globalTranslation);
                    return [cyl];
                }
                else if (this.isCorner() && this.isEdge[EDGE_TOP]) {// && this.isEdge[EDGE_TOP]) {  
                    // delete self
                    this.stringRepr = "0";
                    this.isTerminal = true;
                    this.action = function (lsys: LSystem) { };
                    return [this];
                }
            }
            return [this];
        }
        this.isTerminal = true;
        return [this];
    }

};

//export default ExpansionRule;
//export default LSymbol;
