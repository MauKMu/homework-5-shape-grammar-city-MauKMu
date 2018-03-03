import {vec2, vec3, vec4} from 'gl-matrix';

// Singleton class
// https://k94n.com/es6-modules-single-instance-pattern

export const LRANDOM_MATH_RANDOM = 1; // use Math.random()
export const LRANDOM_DETERMINISTIC = 2; // use deterministic noise

// https://gist.github.com/patriciogonzalezvivo/670c22f3966e662d2f83
function fract(x: number): number {
    return x - Math.floor(x); 
}

// this should be enough if x is an integer
// i.e. not varying by small amounts
// (otherwise we would see sine+sawtoot-like patterns, which is "fixed" with the noise() function)
function rand(x: number) {
    return fract(Math.sin(x) * 43758.5453123);
}

class LRandom {
    mode: number;
    state: number;

    // set mode to one of the LRANDOM_* values above
    //constructor(mode: number, seed: number) {
        //this.mode = mode;
        //this.state = seed;
    //}
    constructor() {
        this.mode = LRANDOM_MATH_RANDOM;
        this.state = 0;
    }

    setSeed(seed: number) {
        this.state = seed;
    }

    setMode(mode: number) {
        this.mode = mode;
    }

    getNext() {
        if (this.mode == LRANDOM_MATH_RANDOM) {
            return Math.random();
        }
        else if (this.mode == LRANDOM_DETERMINISTIC) {
            return rand(this.state++);
        }
        else {
            return -1.0;
        }
    }

};

// this makes it a singleton
export let lRandom = new LRandom();

// more random stuff
// from Adam's demo
function random2(p: vec2): vec2 {
    // original GLSL: normalize(2.0 * fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453) - 1.0);
    // original GLSL: normalize(2.0 * fract(    sin(   vec2(dotX, dotY)   ) * 43758.5453) - 1.0);
    /* original GLSL: normalize(
                        2.0 * fract(
                            sin(
                                vec2(dot(p, vec2(127.1, 311.7)),
                                     dot(p, vec2(269.5, 183.3))
                                )) * 43758.5453) - 1.0);
    */
    let dotX = vec2.dot(p, vec2.fromValues(127.1, 311.7));
    let dotY = vec2.dot(p, vec2.fromValues(269.5, 183.3));
    // original GLSL: normalize(2.0 * fract(sin(vec2(dotX, dotY)) * 43758.5453) - 1.0);
    const BIGNUM = 123.45;
    let sinVec = vec2.fromValues(Math.sin(dotX), Math.sin(dotY));
    //vec2.scaleAndAdd(sinVec, vec2.fromValues(0.5, 0.5), sinVec, 0.5);
    vec2.scale(sinVec, sinVec, BIGNUM);
    // original GLSL: normalize(2.0 * fract(sinVec) - 1.0);
    let ret = vec2.fromValues(fract(sinVec[0]), fract(sinVec[1]));
    // ret = vec2(-1) + 2 * ret
    vec2.scaleAndAdd(ret, vec2.fromValues(-1.0, -1.0), ret, 2.0);
    vec2.normalize(ret, ret);
    return ret;
}

function surflet(P: vec2, gridPoint: vec2): number
{
    //return (P[0] * P[0]) * 0.07;
    // Compute falloff function by converting linear distance to a polynomial
    let distX = Math.abs(P[0] - gridPoint[0]);
    let distY = Math.abs(P[1] - gridPoint[1]);
    let tX = 1.0 - 6.0 * Math.pow(distX, 5.0) + 15.0 * Math.pow(distX, 4.0) - 10.0 * Math.pow(distX, 3.0);
    let tY = 1.0 - 6.0 * Math.pow(distY, 5.0) + 15.0 * Math.pow(distY, 4.0) - 10.0 * Math.pow(distY, 3.0);

    // Get the random vector for the grid point
    let gradient = random2(gridPoint);
    // Get the vector from the grid point to P
    //let diff = P - gridPoint;
    let diff = vec2.create();
    //vec2.subtract(diff, gridPoint, P);
    vec2.subtract(diff, P, gridPoint);
    // Get the value of our height field by dotting grid->P with our gradient
    let height = vec2.dot(diff, gradient);
    // Scale our height field (i.e. reduce it) by our polynomial falloff function
    return height * tX * tY;
}

function PerlinNoise(uv: vec2): number
{
    // Tile the space
    // vec2 uvXLYL = floor(uv);
    let uvXLYL = vec2.fromValues(Math.floor(uv[0]), Math.floor(uv[1]));
    //vec2 uvXHYL = uvXLYL + vec2(1, 0);
    let uvXHYL = vec2.fromValues(uvXLYL[0] + 1.0, uvXLYL[1] + 0.0);
    //vec2 uvXHYH = uvXLYL + vec2(1, 1);
    let uvXHYH = vec2.fromValues(uvXLYL[0] + 1.0, uvXLYL[1] + 1.0);
    //vec2 uvXLYH = uvXLYL + vec2(0, 1);
    let uvXLYH = vec2.fromValues(uvXLYL[0] + 0.0, uvXLYL[1] + 1.0);

    return surflet(uv, uvXLYL) + surflet(uv, uvXHYL) + surflet(uv, uvXHYH) + surflet(uv, uvXLYH);
}

function clamp(min: number, max: number, val: number): number {
    return (val < min) ? min :
           (val > max) ? max :
                         val;
}

function normalizedPerlinNoise(v: vec2): number {
    //console.log("before norm: ");
    //console.log(PerlinNoise(v));
    //return PerlinNoise(v);
    return clamp(0.0, 1.0, PerlinNoise(v) + 0.5);
}

/* FBM (uses Perlin) */
function getFBM(pt: vec2, startFreq: number): number {
    let noiseSum = 0.0;
    let amplitudeSum = 0.0;
    let amplitude = 1.0;
    let frequency = startFreq;
    let scaledPt = vec2.create();
    for (let i = 0; i < 5; i++) {
        vec2.scale(scaledPt, pt, frequency);
        let perlin = normalizedPerlinNoise(scaledPt);
        noiseSum += perlin * amplitude;
        amplitudeSum += amplitude;
        amplitude *= 0.5;
        frequency *= 2.0;
    }
    return noiseSum / amplitudeSum;
}

// "normalizes" coordinate before calling FBM
export function getFBMFromRawPosition(pos: vec2, startFreq: number): number {
    //vec2 coord = pos / 100.0;
    //coord += vec2(3.14, 5.01);
    let coord = vec2.clone(pos);
    vec2.scaleAndAdd(coord, vec2.fromValues(3.14, 5.01), coord, 1 / 100.0);
    //return Math.pow(Math.sin(coord[0] + coord[1]), 2.0);
    return getFBM(coord, startFreq);
}

