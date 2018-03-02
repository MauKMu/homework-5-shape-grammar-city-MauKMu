import {vec3, mat3, mat4, quat} from 'gl-matrix';
import LSystem from 'LSystem';
import {lRandom} from './LRandom';
import {INV_PRISM_HEIGHT} from '../geometry/Plant';
import {LSymbol} from './LSymbol';
import {GSymbol, GShape} from './GSymbol';
import {GCube} from './GCube';

// medium density cube

const EDGE_LEFT = 0;
const EDGE_RIGHT = 1;
const EDGE_BOT = 2;
const EDGE_TOP = 3;
const EDGE_BACK = 4;
const EDGE_FRONT = 5;

const MAX_DEPTH = 4;

export class MDCube extends GCube {
    // indexed like: [-x, +x, -y, +y, -z, +z]
    // index is (2 * axis) + (min ? 0 : 1)
    isEdge: Array<boolean>;
    isTop: boolean;
    isBot: boolean;
    isLeft: boolean;
    isRight: boolean;
    isBack: boolean;
    isFront: boolean;


    constructor(stringRepr: string, position: vec3, rotation: vec3, scale: vec3) {
        super(stringRepr, position, rotation, scale);
        this.isEdge = [true, true, true, true, true, true];
        this.isTop = true;
        this.isBot = true;
        this.isLeft = true;
        this.isRight = true;
        this.isBack = true;
        this.isFront = true;
    }

    subdivide(axis: number): Array<LSymbol> {
        let p = lRandom.getNext();
        let subdivs = Math.floor(2 + p * 2);
        if (axis == 1) {
            subdivs += 1;
        }
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

        for (let i = 1; i < subdivs; i++) {
            //let pos = vec3.clone(this.position);
            //pos[axis] += i * increment;
            let c = this.spawnCopy();
            c.position[axis] += i * increment;
            //let c = new MDCube("A", pos, vec3.clone(this.rotation), vec3.clone(this.scale));
            //c.depth = this.depth;
            arr.push(c);
        }

        // update edge -- restore min/max edges
        // "this" is min
        this.isEdge[2 * axis] = wasMin;
        // last is max
        (<MDCube>arr[subdivs - 1]).isEdge[2 * axis + 1] = wasMax;

        return arr;
    }

    spawnCopy(): MDCube {
        let c = new MDCube(this.stringRepr + "*", vec3.clone(this.position), vec3.clone(this.rotation), vec3.clone(this.scale));
        c.isEdge = this.isEdge.slice();
        c.isBot = this.isBot;
        c.isTop = this.isTop;
        c.isLeft = this.isLeft;
        c.isRight = this.isRight;
        c.isBack = this.isBack;
        c.isFront = this.isFront;
        c.depth = this.depth; 
        return c;
    }

    isCorner(): boolean {
        return (this.isEdge[EDGE_LEFT] || this.isEdge[EDGE_RIGHT]) && (this.isEdge[EDGE_BACK] || this.isEdge[EDGE_FRONT]);
    }

    canExpand(): boolean {
        return (!this.isTerminal) && (this.isEdge[EDGE_BOT] || this.isEdge[EDGE_TOP]);
        //return (!this.isTerminal) && (this.isBot || this.isTop);
    }

    // p should be in [0, 1]
    expand(p: number): Array<LSymbol> {
        const DEL_THRESHOLD = 0.9;

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
                else if (this.isCorner() && this.isEdge[EDGE_TOP]) { 
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
            // handle isTop, isBot
            // set to false so all copies are false
            let wasBot = this.isBot;
            let wasTop = this.isTop;
            this.isBot = false;
            this.isTop = false;
            arr = this.subdivide(1);
            // "restore" values to relevant shapes
            this.isBot = wasBot;
            (<MDCube>arr[arr.length - 1]).isTop = wasTop;
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
