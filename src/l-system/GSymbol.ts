import {vec3, mat4} from 'gl-matrix';
import LSystem from './LSystem';
import {LSymbol, ExpansionRule} from './LSymbol';

export enum GShape {
    CUBE = 1,

}

export class GSymbol extends LSymbol {
    shape: GShape;
    position: vec3;
    rotation: vec3;
    scale: vec3;
    isTerminal: boolean;
    depth: number;

    constructor(stringRepr: string, position: vec3, rotation: vec3, scale: vec3, shape: GShape)  {
        super(stringRepr, function (lsys: LSystem) { });
        this.shape = shape;
        this.position = position;
        this.rotation = rotation;
        this.scale = scale;
        this.isTerminal = false;
        this.depth = 0;
    }

    // rules should be an array of tuples
    // each tuple is of the form (weight, symbol)
    // the higher a given weight, the higher the chance the symbol will be chosen
    setExpansionRules(rules: Array<ExpansionRule>) {
        console.log("Don't set expansion rules of GSymbol!");
    }

    updateWeights() {
        console.log("Don't update weights of GSymbol!");
    }

    canExpand(): boolean {
        return !this.isTerminal;
    }

    // p should be in [0, 1]
    expand(p: number): Array<LSymbol> {
        return [];
    }

};

//export default ExpansionRule;
//export default LSymbol;
