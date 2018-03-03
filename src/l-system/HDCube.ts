import {vec3, vec4, mat3, mat4, quat} from 'gl-matrix';
import LSystem from 'LSystem';
import {lRandom} from './LRandom';
import {INV_PRISM_HEIGHT} from '../geometry/Plant';
import {LSymbol} from './LSymbol';
import {GSymbol, GShape} from './GSymbol';
import {GCube, EDGE_BACK, EDGE_BOT, EDGE_FRONT, EDGE_LEFT, EDGE_RIGHT, EDGE_TOP} from './GCube';

// high density cube

const MAX_DEPTH = 3;

export class HDCube extends GCube {

    constructor(stringRepr: string, position: vec3, rotation: vec3, scale: vec3) {
        super(stringRepr, position, rotation, scale);
    }

    spawnCopy(): HDCube {
        let c = new HDCube(this.stringRepr + "*", vec3.clone(this.position), vec3.clone(this.rotation), vec3.clone(this.scale));
        c.isEdge = this.isEdge.slice();
        c.depth = this.depth; 
        vec4.copy(c.color, this.color);
        c.subdivCount = this.subdivCount.slice();
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
            // do "lots" of subdivisions along Y
            this.subdivMin = 6;
            this.subdivRange = 4;
            let arr = this.subdivide(1);
            let scale = 0.9;
            for (let i = 1; i < arr.length; i++) {
                (<GCube>arr[i]).scale[0] *= scale;
                (<GCube>arr[i]).scale[2] *= scale;
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
                    spike.scale[2] *= 0.2;
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
            // add "in and out" effect
            this.subdivMin = 3;
            this.subdivRange = 7;
            
            this.subdivMustBeOdd = true;

            let arr = this.subdivide(1);
            let scale = 1.2;
            for (let i = 1; i < arr.length; i += 2) {
                (<GCube>arr[i]).scale[0] *= scale;
                (<GCube>arr[i]).scale[2] *= scale;
                (<GCube>arr[i]).sides = 8;
            }
            return arr;
        }
        /*
        else if (this.depth == 1) {
            // potentially add "spike"
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
            if (p < 0.4 && this.isCorner()) {
                // "delete" self
                this.stringRepr = "0";
                this.isTerminal = true;
                this.action = function (lsys: LSystem) { };
            }
            this.depth += 1;
            return [this];
        }
        else if (this.depth == 3) {
            // now we have a shape on the XZ plane
            // now subdivide along Y once
            let arr = this.subdivide(1);
            // with small probability, remove top
            if (p < 0.4) {
                arr = arr.slice(0, -1);
                //(<GCube>arr[arr.length - 1]).isEdge[EDGE_TOP] = true;
            }
            // transform top into roof
            let top = (<HDCube>arr[arr.length - 1]);
            let roof = new HDRoof("roof", vec3.clone(top.position), vec3.clone(top.rotation), vec3.clone(top.scale));
            //if (roof.scale[0] > roof.scale[2]) {
            if (lRandom.getNext() > 0.5) {
                roof.rotation[1] = 90;
                roof.scale[0] = top.scale[2];
                roof.scale[2] = top.scale[0];
            }
            roof.isEdge[EDGE_TOP] = true;
            roof.isTerminal = false;
            roof.depth = 4;
            arr[arr.length - 1] = roof;
            return arr;
        }
        else if (this.depth == 4 && this.isEdge[EDGE_TOP]) {
            debugger;
            this.depth = 5;
            // add chimney with small probability
            let chimney = new HDCube("chimney", vec3.clone(this.position), vec3.clone(this.rotation), vec3.clone(this.scale));
            // make chimney square (from top)
            chimney.scale[0] = Math.min(this.scale[0], this.scale[2]) * 0.4;
            chimney.scale[2] = chimney.scale[0];
            // move chimney
            chimney.position[0] += this.scale[0] * 0.3 * (lRandom.getNext() * 2.0 - 1.0);
            chimney.position[2] += this.scale[2] * 0.3 * (lRandom.getNext() * 2.0 - 1.0);
            chimney.isTerminal = true;
            chimney.depth = 5;
            return [this, chimney];
        }
        */
        this.isTerminal = true;
        return [this];
    }

};

//export default ExpansionRule;
//export default LSymbol;
