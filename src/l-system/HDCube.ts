import {vec3, vec4, mat3, mat4, quat} from 'gl-matrix';
import LSystem from 'LSystem';
import {lRandom} from './LRandom';
import {INV_PRISM_HEIGHT} from '../geometry/Plant';
import {LSymbol} from './LSymbol';
import {GSymbol, GShape} from './GSymbol';
import {GCube, EDGE_BACK, EDGE_BOT, EDGE_FRONT, EDGE_LEFT, EDGE_RIGHT, EDGE_TOP} from './GCube';

// high density cube

const MAX_DEPTH = 3;

// use as bitfield
const HD_BLDG_ROUND = 1;
const HD_BLDG_ALTERNATING = 2;

export class HDCube extends GCube {
    flags: number;

    constructor(stringRepr: string, position: vec3, rotation: vec3, scale: vec3) {
        super(stringRepr, position, rotation, scale);
        this.flags = 0;
    }

    spawnCopy(): HDCube {
        let c = new HDCube(this.stringRepr + "*", vec3.clone(this.position), vec3.clone(this.rotation), vec3.clone(this.scale));
        c.isEdge = this.isEdge.slice();
        c.depth = this.depth; 
        vec4.copy(c.color, this.color);
        c.subdivCount = this.subdivCount.slice();
        c.flags = this.flags;
        c.sides = this.sides;
        c.globalRotation = vec3.clone(this.globalRotation);
        c.globalTranslation = vec3.clone(this.globalTranslation);
        return c;
    }

    canExpand(): boolean {
        return (!this.isTerminal);// && (this.isEdge[EDGE_BOT] || this.isEdge[EDGE_TOP]);
        //return (!this.isTerminal) && (this.isBot || this.isTop);
    }

    // TODO!!!!
    // p should be in [0, 1]
    expand(p: number): Array<LSymbol> {
        if (this.depth == 0) {
            // pick whether we want to be an "alt shape" building
            // will propagate to all children
            this.flags = 0;
            if (p < 0.5) {
                this.flags |= HD_BLDG_ROUND;
            }
            if (lRandom.getNext() < 0.7) {
                this.flags |= HD_BLDG_ALTERNATING;
            }
            // do "lots" of subdivisions along Y
            this.subdivMin = 6;
            this.subdivRange = 4;
            let arr = this.subdivide(1);
            // if round, scale down to account for rounder prisms being bigger
            let scale = ((this.flags & HD_BLDG_ROUND) ? 0.71 : 1.0);
            let sides = (this.flags & HD_BLDG_ROUND) ? 8 : 4;
            for (let i = 0; i < arr.length; i++) {
                (<GCube>arr[i]).scale[0] *= scale;
                (<GCube>arr[i]).scale[2] *= scale;
                (<GCube>arr[i]).sides = sides;
                scale *= 0.9;
            }
            return arr;
        }
        else if (this.depth == 1) {
            // add "spike" if top with high chance
            if (this.isEdge[EDGE_TOP]) {
                if (p < 0.6) {
                    // TODO: add spike 
                    let spike = new GCube("spike", vec3.clone(this.position), vec3.clone(this.rotation), vec3.clone(this.scale));
                    spike.isTerminal = true;
                    spike.scaleTop = 0.1;
                    spike.scale[0] *= 0.2;
                    spike.scale[1] *= 2;
                    spike.scale[2] *= 0.2;
                    spike.sides = 12;
                    spike.globalTranslation = vec3.clone(this.globalTranslation);
                    spike.globalRotation = vec3.clone(this.globalRotation);
                    // delete self (not necessary if returning just spike?)
                    this.stringRepr = "0";
                    this.isTerminal = true;
                    this.action = function (lsys: LSystem) { };

                    return [spike];
                }
                else {
                    p = lRandom.getNext();
                }
            }
            if (!(this.flags & HD_BLDG_ALTERNATING)) {
                this.depth += 1;
                return [this];
            }
            // add "in and out" effect
            this.subdivMin = 3;
            this.subdivRange = 7;

            //let arr: Array<LSymbol>;
            // shrink inner layers
            this.subdivMustBeOdd = true;
            //this.color = vec4.fromValues(0.4, 0.4, 1, 1);
            let arr = this.subdivide(1);
            let scale = 0.93;
            for (let i = 1; i < arr.length; i += 2) {
                (<GCube>arr[i]).scale[0] *= scale;
                (<GCube>arr[i]).scale[2] *= scale;
            }
            return arr;
        }
        this.isTerminal = true;
        return [this];
    }

};

//export default ExpansionRule;
//export default LSymbol;
