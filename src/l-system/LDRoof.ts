import {vec3, vec4, mat3, mat4, quat} from 'gl-matrix';
import LSystem from 'LSystem';
import {lRandom} from './LRandom';
import {INV_PRISM_HEIGHT} from '../geometry/Plant';
import {LSymbol} from './LSymbol';
import {GSymbol, GShape} from './GSymbol';
import {GCube, EDGE_BACK, EDGE_BOT, EDGE_FRONT, EDGE_LEFT, EDGE_RIGHT, EDGE_TOP} from './GCube';
import {LDCube} from './LDCube';

// low density roof (triangular prism)

const INV_SQRT_THREE = 0.57735026919;
const SQRT_THREE_OVER_SIX = 0.28867513459; // sqrt(3) / 6

export class LDRoof extends GCube {

    constructor(stringRepr: string, position: vec3, rotation: vec3, scale: vec3) {
        super(stringRepr, position, rotation, scale);
        this.sides = 3;

        // use slightly different "toUnit" matrix
        let toUnitCubeQuat = quat.create();
        //mat4.fromScaling(this.toUnitCube, vec3.fromValues(INV_SQRT_THREE, INV_PRISM_HEIGHT, INV_SQRT_THREE));
        //quat.fromEuler(toUnitCubeQuat, 0, 90, 0);
        //mat4.fromRotationTranslationScale(this.toUnitCube, toUnitCubeQuat, vec3.fromValues(0, 0.5, 0), vec3.fromValues(INV_SQRT_THREE, INV_PRISM_HEIGHT, INV_SQRT_THREE)); 
        this.toUnitCube = mat4.create();
        mat4.translate(this.toUnitCube, this.toUnitCube, vec3.fromValues(0, -0.5 + SQRT_THREE_OVER_SIX, -0.5));
        mat4.rotateX(this.toUnitCube, this.toUnitCube, Math.PI * 0.5);
        mat4.rotateY(this.toUnitCube, this.toUnitCube, Math.PI * 0.5);
        mat4.scale(this.toUnitCube, this.toUnitCube, vec3.fromValues(INV_SQRT_THREE, INV_PRISM_HEIGHT, INV_SQRT_THREE));
    }

    spawnCopy(): LDRoof {
        let c = new LDRoof(this.stringRepr + "*", vec3.clone(this.position), vec3.clone(this.rotation), vec3.clone(this.scale));
        c.isEdge = this.isEdge.slice();
        c.depth = this.depth; 
        vec4.copy(c.color, this.color);
        return c;
    }

    canExpand(): boolean {
        return !this.isTerminal;
        //return (!this.isTerminal) && (this.isEdge[EDGE_BOT] || this.isEdge[EDGE_TOP]);
        //return (!this.isTerminal) && (this.isBot || this.isTop);
    }

    // p should be in [0, 1]
    expand(p: number): Array<LSymbol> {
        // roofs only expand once
        this.isTerminal = true;
        if (p < 0.3) {
            // add chimney with small probability
            let chimney = new LDCube("chimney", vec3.clone(this.position), vec3.clone(this.rotation), vec3.clone(this.scale));
            // make chimney square (from top)
            chimney.scale[0] = Math.min(this.scale[0], this.scale[2]) * 0.2;
            chimney.scale[2] = chimney.scale[0];
            // move chimney
            chimney.position[0] += chimney.scale[0] * (0.75 + 0.75 * lRandom.getNext()) * (lRandom.getNext() > 0.5 ? 1.0 : - 1.0);
            chimney.position[2] += chimney.scale[0] * (0.75 + 0.75 * lRandom.getNext()) * (lRandom.getNext() > 0.5 ? 1.0 : - 1.0);
            chimney.isTerminal = true;
            chimney.depth = 5;
            return [this, chimney];
        }
        return [this];
    }

};

//export default ExpansionRule;
//export default LSymbol;
