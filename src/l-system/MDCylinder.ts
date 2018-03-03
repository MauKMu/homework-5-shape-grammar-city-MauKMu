import {vec3, vec4, mat3, mat4, quat} from 'gl-matrix';
import LSystem from 'LSystem';
import {lRandom} from './LRandom';
import {INV_PRISM_HEIGHT} from '../geometry/Plant';
import {LSymbol} from './LSymbol';
import {GSymbol, GShape} from './GSymbol';
import {GCube, EDGE_BACK, EDGE_BOT, EDGE_FRONT, EDGE_LEFT, EDGE_RIGHT, EDGE_TOP} from './GCube';

// medium density cylinder

export class MDCylinder extends GCube {

    constructor(stringRepr: string, position: vec3, rotation: vec3, scale: vec3) {
        super(stringRepr, position, rotation, scale);
        this.sides = 8;
    }

    spawnCopy(): MDCylinder {
        let c = new MDCylinder(this.stringRepr + "*", vec3.clone(this.position), vec3.clone(this.rotation), vec3.clone(this.scale));
        c.isEdge = this.isEdge.slice();
        c.depth = this.depth; 
        vec4.copy(c.color, this.color);
        c.globalRotation = vec3.clone(this.globalRotation);
        return c;
    }

    canExpand(): boolean {
        return false;
        //return (!this.isTerminal) && (this.isEdge[EDGE_BOT] || this.isEdge[EDGE_TOP]);
        //return (!this.isTerminal) && (this.isBot || this.isTop);
    }

    // p should be in [0, 1]
    expand(p: number): Array<LSymbol> {
        return [this];
    }

};

//export default ExpansionRule;
//export default LSymbol;
