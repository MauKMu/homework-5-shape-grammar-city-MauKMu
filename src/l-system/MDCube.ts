import {vec3, mat3, mat4, quat} from 'gl-matrix';
import LSystem from 'LSystem';
import {lRandom} from './LRandom';
import {INV_PRISM_HEIGHT} from '../geometry/Plant';
import {LSymbol} from './LSymbol';
import {GSymbol, GShape} from './GSymbol';
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
        return c;
    }

    canExpand(): boolean {
        return (!this.isTerminal) && (this.isEdge[EDGE_BOT] || this.isEdge[EDGE_TOP]);
        //return (!this.isTerminal) && (this.isBot || this.isTop);
    }

    // p should be in [0, 1]
    expand(p: number): Array<LSymbol> {
        const DEL_THRESHOLD = 0.8;

        if (p > DEL_THRESHOLD) {
            // force some subdivs before disappearing
            if (this.depth > 1) {
                if (this.isEdge[EDGE_BOT] && !this.isEdge[EDGE_TOP]) {
                    // convert to columns
                    this.scale[0] *= 0.3;
                    this.scale[2] *= 0.2;
                    this.isTerminal = true;
                    return [this];
                }
                else if (this.isCorner()){// && this.isEdge[EDGE_TOP]) { 
                //else if (this.isEdge[EDGE_LEFT] || this.isEdge[EDGE_RIGHT] || this.isEdge[EDGE_BACK] || this.isEdge[EDGE_FRONT] || this.isEdge[EDGE_TOP]) { 
                //else if (this.isTop) {
                    // delete self
                    this.stringRepr = "0";
                    this.isTerminal = true;
                    this.action = function (lsys: LSystem) { };
                    return [this];
                }
            }
        }
        else {
            // normalize
            p /= DEL_THRESHOLD;
        }

        if (this.depth >= MAX_DEPTH) {
            // don't subdivide
            return [this];
        }
        
        // else, try subdividing
        let arr: Array<LSymbol>;
        if (p < 0.333) {
            arr = this.subdivide(0);
        }
        else if (p < 0.466) {
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
