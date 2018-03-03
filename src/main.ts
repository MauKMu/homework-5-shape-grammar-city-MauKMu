// models from https://www.models-resource.com/wii/kirbysreturntodreamland/model/4572/
import {vec2, vec3, vec4, mat3, mat4} from 'gl-matrix';
import * as Stats from 'stats-js';
import * as DAT from 'dat-gui';
import Icosphere from './geometry/Icosphere';
import Square from './geometry/Square';
import Cube from './geometry/Cube';
import Plant from './geometry/Plant';
import {PRISM_HEIGHT, BRANCH_COLOR, TIP_COLOR, PEAR_COLOR} from './geometry/Plant';
import OpenGLRenderer from './rendering/gl/OpenGLRenderer';
import Camera from './Camera';
import {setGL} from './globals';
import ShaderProgram, {Shader} from './rendering/gl/ShaderProgram';
import {loadTexture} from './rendering/gl/ImageLoader';
import * as swal from 'sweetalert';

var OBJ = require('webgl-obj-loader');

import Turtle from './l-system/Turtle';
import {LSymbol, ExpansionRule} from './l-system/LSymbol';
import LSystem from './l-system/LSystem';
import {lRandom, LRANDOM_MATH_RANDOM, LRANDOM_DETERMINISTIC, getFBMFromRawPosition} from './l-system/LRandom';

import {GSymbol} from './l-system/GSymbol';
import {GCube} from './l-system/GCube';
import {HDCube} from './l-system/HDCube';
import {MDCube} from './l-system/MDCube';
import {LDCube} from './l-system/LDCube';
import {LDRoof} from './l-system/LDRoof';

enum ShaderEnum {
    LAMBERT = 1,
    CUSTOM,
    DISKS,
    PLANET,
    BLDGS,
    MAGIC,
}

enum FruitEnum {
    BANANA = 1,
    PINEAPPLE,
    RAMEN,
    PIZZA,
    CAKE,
}

// Define an object with application parameters and button callbacks
// This will be referred to by dat.GUI's functions that add GUI elements.
const controls = {
    tesselations: 6,
    'Load Scene': loadScene, // A function pointer, essentially
    geometryColor: [200, 10, 10],
    shader: ShaderEnum.LAMBERT,
    shaderSpeed: 1,
    'Toggle tilting': toggleAnimXZ,
    'Toggle squishing': toggleAnimY,
    lightX: 10,
    lightY: 10,
    lightZ: 1,
    lavaBias: 50,
    plumeBias: 0,
    edgeClarity: 0,
    iterations: 12,
    randomMode: LRANDOM_MATH_RANDOM,
    randomSeed: 0,
    woodColor: [BRANCH_COLOR[0] * 255, BRANCH_COLOR[1] * 255, BRANCH_COLOR[2] * 255],
    leafColor: [TIP_COLOR[0] * 255, TIP_COLOR[1] * 255, TIP_COLOR[2] * 255],
    fruit: FruitEnum.BANANA,
    'Show Alphabet': showAlphabet,
    'Show String': showCurrentString,
    'Regenerate String and Plant': remakePlant,
    'Redraw Plant': redrawPlant,
    'Show Help': showHelp,
};

let icosphere: Icosphere;
let square: Square;
let cube: Cube;
let plant: Plant;

let renderer: OpenGLRenderer;

let alphabet: Map<string, LSymbol>;
let lsys: LSystem;

function showAlphabet() {
    let strBuilder = new Array<string>();
    strBuilder.push("The alphabet is:");
    alphabet.forEach(function (value: LSymbol, index: string, map: Map<string, LSymbol>) {
        strBuilder.push(index);
    });
    swal(strBuilder.join("\n"));
}

function showCurrentString() {
    swal(lsys.lstring.toString());
}

function showHelp() {
    lsys.resetPlant();
    lsys.expandString();
    lsys.createPlant();
    /*
    swal(
        "Light Position: controls the light position for shading\n\n" +
        "iterations: number of times to expand the string\n\n" + 
        "randomMode: pick between using Math.random() or a deterministic seeded noise function\n\n" +
        "randomSeed: seed for deterministic seeded noise function\n\n" +
        "woodColor: color for wood geometry\n\n" +
        "leafColor: color for leaf geometry\n\n" +
        "fruit: pick one decoration to be placed on the branches (some non-fruity decorations may require more determination)\n\n" +
        "**NOTE** any changes made to the options above will only be applied if you re-draw the plant using some of the buttons below\n\n" +
        "Show Alphabet: shows L-system's alphabet\n\n" +
        "Show String: shows current expanded L-system string\n\n" +
        "Regenerate String and Plant: resets L-system string to axiom, re-expands it, then re-draws plant\n\n" +
        "Redraw Plant: re-draws plant without modifying L-system string\n\n" +
        "Show Help: shows this help message\n\n"
    );
    */
}

function remakePlant() {
    updateFruit(controls.fruit);
    lRandom.setSeed(controls.randomSeed);
    lsys.resetSystem();
    runIterations(controls.iterations);
    // expanding string also consumes RNG, so
    // we reset seed again to make this output consistent
    // with redrawPlant()
    lRandom.setSeed(controls.randomSeed);
    lsys.createPlant();
    //if (!lsys.plant.wasSafe) {
        //alert("Plant grew too much!");
    //}
}

function redrawPlant() {
    // reset plant only, so we keep current string
    updateFruit(controls.fruit);
    lRandom.setSeed(controls.randomSeed);
    lsys.resetPlant();
    lsys.createPlant();
}

function loadScene() {
    icosphere = new Icosphere(vec3.fromValues(0, 0, 0), 1, controls.tesselations);
    icosphere.create();
    square = new Square(vec3.fromValues(0, 0, 0));
    square.create();
    cube = new Cube(vec3.fromValues(1.5, 0, 0));
    cube.create();
    plant = new Plant(vec3.fromValues(0, 0, 0));
    plant.create();
}

function toggleAnimXZ() {
    renderer.toggleAnimXZ();
}

function toggleAnimY() {
    renderer.toggleAnimY();
}

// as it turns out, Maps keyed by Enums and dat.GUI don't play well,
// since dat.GUI mysteriously returns Enum values as strings...???
// so these have to be plain objects...
// well, TypeScript typed objects
let objFilenames: { [id: number]: string } = {};
objFilenames[FruitEnum.BANANA] = "models/banana.obj";
objFilenames[FruitEnum.PINEAPPLE] = "models/pineapple.obj";
objFilenames[FruitEnum.RAMEN] = "models/ramen.obj";
objFilenames[FruitEnum.PIZZA] = "models/pizza.obj";
objFilenames[FruitEnum.CAKE] = "models/cake.obj";
let texFilenames: { [id: number]: string } = {};
texFilenames[FruitEnum.BANANA] = "textures/banana.png";
texFilenames[FruitEnum.PINEAPPLE] = "textures/pineapple.png";
texFilenames[FruitEnum.RAMEN] = "textures/ramen.png";
texFilenames[FruitEnum.PIZZA] = "textures/pizza.png";
texFilenames[FruitEnum.CAKE] = "textures/cake.png";
let objString: string;
let isObjLoaded: boolean;
let lastLoaded: number;
let mesh: any;
let texture: WebGLTexture;

function readTextFile(file: string) {
    var rawFile = new XMLHttpRequest();
    rawFile.open("GET", file, false);
    rawFile.onreadystatechange = function () {
        if (rawFile.readyState === 4) {
            if (rawFile.status === 200 || rawFile.status == 0) {
                objString = rawFile.responseText;
                mesh = new OBJ.Mesh(objString);
                isObjLoaded = true;
                //alert(objString);
            }
        }
        //objString = "Error when loading OBJ file!"        
    }
    rawFile.send(null);
}

function loadMesh(filename: string) {
    objString = "";
    readTextFile(filename);
}

function loadFruit(fruit: FruitEnum) {
    loadMesh(objFilenames[fruit]);
    texture = loadTexture(texFilenames[fruit]);
}

let cakeCount: number = 0;

function updateFruit(fruit: FruitEnum) {
    if (fruit == FruitEnum.CAKE) {
        // print "funny" message
        if (cakeCount <= 0) {
            swal("the cake is a lie.");
        }
        else if (cakeCount == 1) {
            swal("Well... if you insist.");
        }
        else if (cakeCount == 3) {
            swal("Delicious and moist.");
        }

        cakeCount++;

        if (cakeCount <= 1) {
            return;
        }
    }
    if (fruit != lastLoaded) {
        loadFruit(fruit);
        lastLoaded = fruit;
    }
}

function bleh() {
    let axiom = new Array<LSymbol>();

    const planeDims = vec2.fromValues(50, 50);
    const planeDimsDouble = vec2.fromValues(planeDims[0] * 2.0, planeDims[1] * 2.0);
    const planeMin = vec2.fromValues(-planeDims[0], -planeDims[1]);

    let ground = new LSymbol("GND", function (lsys: LSystem) {
        lsys.plant.addPlane(planeDims);
    });
    axiom.push(ground);

    const gridDims = vec2.fromValues(15, 15);
    let pos = vec2.create();
    let offset = vec2.create();

    for (let i = 0; i < gridDims[0]; i++) {
        offset[0] = (i + 0.5) / gridDims[0];
        for (let j = 0; j < gridDims[1]; j++) {
            // get FBM ========================================================
            offset[1] = (j + 0.5) / gridDims[1];
            // pos = planeMin + planeDimsDouble * offset
            vec2.multiply(pos, planeDimsDouble, offset);
            vec2.add(pos, pos, planeMin);
            let fbm = getFBMFromRawPosition(pos, 1.0);
            //fbm = Math.pow(fbm, 2.0);
            //console.log(pos);
            //console.log("fbm:");
            //console.log(fbm);
            //console.log("fbm POW ===============:");
            //console.log(Math.pow(fbm, 2.0));
            // place bldg =====================================================
            let bldg: GCube;
            if (fbm < 0.333) {
                //bldg = new LDCube("cube", vec3.fromValues(pos[0], 0, pos[1]), vec3.fromValues(0, 0, 0), vec3.fromValues(4, 1 + fbm * 12, 4));
                bldg = new LDCube("cube", vec3.fromValues(0, 0, 0), vec3.fromValues(0, 0, 0), vec3.fromValues(4, 1 + fbm * 12, 4));
                bldg.color = vec4.fromValues(0.4, 0.4, 1.0 - fbm, 1);
                bldg.globalRotation = vec3.fromValues(0, lRandom.getNext() * 90 - 45, 0);
            }
            else if (fbm < 0.667) {
                //bldg = new MDCube("cube", vec3.fromValues(pos[0], 0, pos[1]), vec3.fromValues(0, 0, 0), vec3.fromValues(4, 1 + fbm * 20, 4));
                bldg = new MDCube("cube", vec3.fromValues(0, 0, 0), vec3.fromValues(0, 0, 0), vec3.fromValues(4, 1 + fbm * 20, 4));
                bldg.color = vec4.fromValues(0.4, fbm + 0.23, 0.4, 1);
                bldg.globalRotation = vec3.fromValues(0, lRandom.getNext() * 20 - 10, 0);
            }
            else {
                //bldg = new HDCube("cube", vec3.fromValues(pos[0], 0, pos[1]), vec3.fromValues(0, 0, 0), vec3.fromValues(4, 1 + fbm * 100, 4));
                bldg = new HDCube("cube", vec3.fromValues(0, 0, 0), vec3.fromValues(0, 0, 0), vec3.fromValues(4, 1 + fbm * 100, 4));
                bldg.color = vec4.fromValues(fbm, 0.4, 0.4, 1);
            }
            bldg.globalTranslation = vec3.fromValues(pos[0], 0, pos[1]);
            bldg.globalTranslation[1] += bldg.scale[1] * 0.5;
            //bldg.position[1] += bldg.scale[1] * 0.5;
            //bldg.color = vec4.fromValues((i + 0.5) / gridDims[0], (j + 0.5) / gridDims[1], 0, 1);
            axiom.push(bldg);
        }
    }

    let gc1 = new HDCube("cube1", vec3.fromValues(0, 5, 0), vec3.fromValues(0, 0, 0), vec3.fromValues(1, 10, 1));
    let gc2 = new HDCube("cube2", vec3.fromValues(1, 5, 0), vec3.fromValues(0, 0, 0), vec3.fromValues(1, 10, 1));
    let gc3 = new HDCube("cube3", vec3.fromValues(2, 5, 1), vec3.fromValues(0, 0, 0), vec3.fromValues(1, 10, 1));
    let gc4 = new HDCube("cube2", vec3.fromValues(-1, 0, 0), vec3.fromValues(0, 0, 0), vec3.fromValues(1, 1, 1));
    //let rf = new LDRoof("roof", vec3.fromValues(-1, 1, 0), vec3.fromValues(0, 0, 0), vec3.fromValues(1, 1, 1));

    lsys = new LSystem();
    //lsys.setAxiom([ground, gc1, gc2, gc3, gc4]);
    lsys.setAxiom(axiom);

    //lsys.expandString();

    lsys.createPlant();
    plant = lsys.plant;
}

function blah() {
    //lRandom.setMode(LRANDOM_DETERMINISTIC);
    //lRandom.setSeed(10);
    //objString = "";
    //isObjLoaded = false;
    //readTextFile("models/fg_pear.obj");
    //readTextFile("models/banana.obj");
    //console.log(isObjLoaded);
    //let mesh = new OBJ.Mesh(objString);

    loadFruit(controls.fruit);
    lastLoaded = controls.fruit;

    // define alphabet
    alphabet = new Map<string, LSymbol>();

    // symbol definitions below.
    // they include:
    //   * string representation
    //   * action
    //   * expansion rules, if any

    let F = new LSymbol("F", function (lsys: LSystem) {
        let turtle = lsys.getTopTurtle();
        //lsys.addPrismAtTurtle(turtle);
        lsys.addScaledPrismAtTurtle(turtle, 2.0);
        turtle.moveForward(PRISM_HEIGHT * 2.0);
    });
    alphabet.set(F.stringRepr, F);
    let shortF = new LSymbol("(f)", function (lsys: LSystem) {
        let turtle = lsys.getTopTurtle();
        lsys.addScaledPrismAtTurtle(turtle, 2.0);
        turtle.moveForward(PRISM_HEIGHT * 1.55);
    });
    alphabet.set(shortF.stringRepr, shortF);
    let midF = new LSymbol("(ff)", function (lsys: LSystem) {
        let turtle = lsys.getTopTurtle();
        lsys.addScaledPrismAtTurtle(turtle, 2.0);
        turtle.moveForward(PRISM_HEIGHT * 1.75);
    });
    alphabet.set(midF.stringRepr, midF);
    let push = new LSymbol("[", function (lsys: LSystem) {
        let turtle = lsys.getTopTurtle();
        let copy = turtle.makeDeepCopy();
        copy.depth++;
        lsys.turtleStack.push(copy);
    });
    alphabet.set(push.stringRepr, push);
    let pop = new LSymbol("]", function (lsys: LSystem) {
        lsys.turtleStack.pop();
    });
    alphabet.set(pop.stringRepr, pop);
    // "root"
    //let R = new LSymbol("R", function (lsys: LSystem) {
        //let turtle = lsys.getTopTurtle();
        //lsys.addPrismAtTurtle(turtle);
        //turtle.moveForward(PRISM_HEIGHT * 0.8);
    //});
    let plusZ = new LSymbol("(+Z)", function (lsys: LSystem) {
        let turtle = lsys.getTopTurtle();
        turtle.rotateZ(Math.PI * 0.1333333);
    });
    alphabet.set(plusZ.stringRepr, plusZ);
    //let minusZ = new LSymbol("(-Z)", function (lsys: LSystem) {
        //let turtle = lsys.getTopTurtle();
        //turtle.rotateZ(-Math.PI * 0.1333333);
    //});
    //alphabet.set(minusZ.stringRepr, minusZ);
    // decorations ============================================
    let decorationPear = new LSymbol("(pear)", function (lsys: LSystem) {
        let turtle = lsys.getTopTurtle();
        lsys.useColor(PEAR_COLOR);
        lsys.addPearAtTurtle(turtle, mesh);
        lsys.useColor(BRANCH_COLOR);
    });
    alphabet.set(decorationPear.stringRepr, decorationPear);
    // twisty trunk ===========================================
    let twistyPlusBigY = new LSymbol("(T+Y)", function (lsys: LSystem) {
        let turtle = lsys.getTopTurtle();
        turtle.rotateY(Math.PI * 0.2);
        lsys.addPrismAtTurtle(turtle);
        turtle.moveForward(PRISM_HEIGHT * 0.8);
    });
    alphabet.set(twistyPlusBigY.stringRepr, twistyPlusBigY);
    let twistyMinusBigY = new LSymbol("(T-Y)", function (lsys: LSystem) {
        let turtle = lsys.getTopTurtle();
        turtle.rotateY(-Math.PI * 0.2);
        lsys.addPrismAtTurtle(turtle);
        turtle.moveForward(PRISM_HEIGHT * 0.8);
    });
    alphabet.set(twistyMinusBigY.stringRepr, twistyMinusBigY);
    // just expands to one of (T+Y) or (T-Y)
    let twistyStart = new LSymbol("(TS)", function (lsys: LSystem) {
    });
    alphabet.set(twistyStart.stringRepr, twistyStart);
    twistyStart.setExpansionRules([new ExpansionRule(1, [twistyPlusBigY]), new ExpansionRule(1, [twistyMinusBigY])]);
    // set expansion rules for other twisty trunks
    twistyPlusBigY.setExpansionRules([
        new ExpansionRule(2, [twistyPlusBigY, twistyPlusBigY]),
        new ExpansionRule(4, [twistyPlusBigY]),
        new ExpansionRule(1, [twistyPlusBigY, twistyMinusBigY])
    ]);
    twistyMinusBigY.setExpansionRules([
        new ExpansionRule(2, [twistyMinusBigY, twistyMinusBigY]),
        new ExpansionRule(4, [twistyMinusBigY]),
        new ExpansionRule(1, [twistyMinusBigY, twistyPlusBigY])
    ]);
    // branchy trunk ==========================================
    let BRANCHY_Y_INC = 0.2;
    let branchyPlusSmallX = new LSymbol("(B+x)", function (lsys: LSystem) {
        let turtle = lsys.getTopTurtle();
        // nudge upwards
        vec3.add(turtle.orientation, turtle.orientation, vec3.fromValues(0, BRANCHY_Y_INC, 0));
        vec3.normalize(turtle.orientation, turtle.orientation);
        // apply desired rotation
        turtle.rotateX(Math.PI * 0.1);
        lsys.addPrismAtTurtle(turtle);
        turtle.moveForward(PRISM_HEIGHT);
    });
    alphabet.set(branchyPlusSmallX.stringRepr, branchyPlusSmallX);
    let branchyMinusSmallX = new LSymbol("(B-x)", function (lsys: LSystem) {
        let turtle = lsys.getTopTurtle();
        // nudge upwards
        vec3.add(turtle.orientation, turtle.orientation, vec3.fromValues(0, BRANCHY_Y_INC, 0));
        vec3.normalize(turtle.orientation, turtle.orientation);
        // apply desired rotation
        turtle.rotateX(-Math.PI * 0.1);
        lsys.addPrismAtTurtle(turtle);
        turtle.moveForward(PRISM_HEIGHT);
    });
    alphabet.set(branchyMinusSmallX.stringRepr, branchyMinusSmallX);
    let branchyPlusSmallY = new LSymbol("(B+y)", function (lsys: LSystem) {
        let turtle = lsys.getTopTurtle();
        // nudge upwards
        vec3.add(turtle.orientation, turtle.orientation, vec3.fromValues(0, BRANCHY_Y_INC, 0));
        vec3.normalize(turtle.orientation, turtle.orientation);
        // apply desired rotation
        turtle.rotateY(Math.PI * 0.1);
        lsys.addPrismAtTurtle(turtle);
        turtle.moveForward(PRISM_HEIGHT);
    });
    alphabet.set(branchyPlusSmallY.stringRepr, branchyPlusSmallY);
    let branchyMinusSmallY = new LSymbol("(B-y)", function (lsys: LSystem) {
        let turtle = lsys.getTopTurtle();
        // nudge upwards
        vec3.add(turtle.orientation, turtle.orientation, vec3.fromValues(0, BRANCHY_Y_INC, 0));
        vec3.normalize(turtle.orientation, turtle.orientation);
        // apply desired rotation
        turtle.rotateY(-Math.PI * 0.1);
        lsys.addPrismAtTurtle(turtle);
        turtle.moveForward(PRISM_HEIGHT);
    });
    alphabet.set(branchyMinusSmallY.stringRepr, branchyMinusSmallY);
    // expands to a branchy trunk
    let branchyStart = new LSymbol("(BS)", function (lsys: LSystem) {
    });
    alphabet.set(branchyStart.stringRepr, branchyStart);
    branchyStart.setExpansionRules([
        new ExpansionRule(1, [branchyPlusSmallX]),
        new ExpansionRule(1, [branchyMinusSmallX]),
        new ExpansionRule(1, [branchyPlusSmallY]),
        new ExpansionRule(1, [branchyMinusSmallY]),
    ]);

    // define this here so we can add it to branchy expansion rules
    // "seed" for araucaria branches
    let araucariaStart = new LSymbol("(AS)", function (lsys: LSystem) {
    });
    alphabet.set(araucariaStart.stringRepr, araucariaStart);

    // set expansion rules for branchy trunk pieces
    branchyPlusSmallX.setExpansionRules([
        new ExpansionRule(9, [branchyPlusSmallX, araucariaStart, araucariaStart, araucariaStart]),
        new ExpansionRule(6, [branchyPlusSmallX]),
        new ExpansionRule(2, [branchyPlusSmallX, branchyMinusSmallX]),
        new ExpansionRule(1, [branchyPlusSmallX, branchyPlusSmallY]),
        new ExpansionRule(1, [branchyPlusSmallX, branchyMinusSmallY])
    ]);
    branchyMinusSmallX.setExpansionRules([
        new ExpansionRule(9, [branchyMinusSmallX, araucariaStart, araucariaStart, araucariaStart]),
        new ExpansionRule(6, [branchyMinusSmallX]),
        new ExpansionRule(2, [branchyMinusSmallX, branchyPlusSmallX]),
        new ExpansionRule(1, [branchyMinusSmallX, branchyPlusSmallY]),
        new ExpansionRule(1, [branchyMinusSmallX, branchyMinusSmallY])
    ]);
    branchyPlusSmallY.setExpansionRules([
        new ExpansionRule(9, [branchyPlusSmallY, araucariaStart, araucariaStart, araucariaStart]),
        new ExpansionRule(6, [branchyPlusSmallY]),
        new ExpansionRule(2, [branchyPlusSmallY, branchyMinusSmallY]),
        new ExpansionRule(1, [branchyPlusSmallY, branchyPlusSmallX]),
        new ExpansionRule(1, [branchyPlusSmallY, branchyMinusSmallX])
    ]);
    branchyMinusSmallY.setExpansionRules([
        new ExpansionRule(9, [branchyMinusSmallY, araucariaStart, araucariaStart, araucariaStart]),
        new ExpansionRule(6, [branchyMinusSmallY]),
        new ExpansionRule(2, [branchyMinusSmallY, branchyPlusSmallY]),
        new ExpansionRule(1, [branchyMinusSmallY, branchyPlusSmallX]),
        new ExpansionRule(1, [branchyMinusSmallY, branchyMinusSmallX])
    ]);
    // transition main trunk -> araucaria =====================
    // use "vertify" to smoothly change into a mostly vertical direction
    // similar to araucariaLong, but more intense
    let vertify = new LSymbol("(vert)", function (lsys: LSystem) {
        let turtle = lsys.getTopTurtle();
        // draw some prisms while increasing Y to move orientation up
        let VERTIFY_Y_INC = 0.8;
        for (let i = 0; i < 3; i++) {
            // draw part of the branch
            lsys.addPrismAtTurtle(turtle);
            turtle.moveForward(PRISM_HEIGHT);
            // add to Y and normalize to nudge it upwards
            vec3.add(turtle.orientation, turtle.orientation, vec3.fromValues(0, VERTIFY_Y_INC, 0));
            vec3.normalize(turtle.orientation, turtle.orientation);
        }
    });
    alphabet.set(vertify.stringRepr, vertify);
    // do this by setting orientation to something with Y <= 0
    // we call this "flatifying", as it "flattens" the direction
    // (if you think of up as a "non-flat" direction. flatty mcflatty.)
    let flatify = new LSymbol("(flat)", function (lsys: LSystem) {
        let turtle = lsys.getTopTurtle();
        let angle = lRandom.getNext() * 2.0 * Math.PI;
        let y = -lRandom.getNext() * 0.3 + 0.05;
        vec3.set(turtle.orientation, Math.cos(angle), y, Math.sin(angle));
        vec3.normalize(turtle.orientation, turtle.orientation);
    });
    alphabet.set(flatify.stringRepr, flatify);
    // araucaria branches =====================================
    // the main branches coming off the main trunk have two parts:
    // the "straight", long part coming from the main trunk; and
    // the vertical tip at the end;
    let araucariaLong = new LSymbol("(AL)", function (lsys: LSystem) {
        let turtle = lsys.getTopTurtle();
        // make thinner branch
        turtle.scaleTop *= 0.8;
        // draw some prisms while increasing Y to move orientation up
        let ARAUCARIA_Y_INC = 0.2;
        let length = 1.4 + lRandom.getNext() * 0.2;
        for (let i = 0; i < 5; i++) {
            // draw part of the branch
            lsys.addScaledPrismAtTurtleNoShrink(turtle, length);
            turtle.moveForward(PRISM_HEIGHT * length);
            // add to Y and normalize to nudge it upwards
            vec3.add(turtle.orientation, turtle.orientation, vec3.fromValues(0, ARAUCARIA_Y_INC, 0));
            vec3.normalize(turtle.orientation, turtle.orientation);
            // draw a pear with a small probability
            if (lRandom.getNext() < 0.15) {
                lsys.useColor(PEAR_COLOR);
                lsys.addPearAtTurtle(turtle, mesh);
                lsys.useColor(BRANCH_COLOR);
            }
        }
    });
    alphabet.set(araucariaLong.stringRepr, araucariaLong);
    let araucariaTip = new LSymbol("(AT)", function (lsys: LSystem) {
        let turtle = lsys.getTopTurtle();
        // prepare to draw tip
        lsys.useColor(TIP_COLOR);
        // draw tip
        //lsys.addPrismAtTurtle(turtle);
        lsys.addTipPrismAtTurtle(turtle);
        // undo color/thickness changes
        lsys.useColor(BRANCH_COLOR);

        //turtle.scaleTop *= 0.81;
        //lsys.addScaledPrismAtTurtle(turtle, 0.4);
        turtle.moveForward(PRISM_HEIGHT * 0.4);
    });
    alphabet.set(araucariaTip.stringRepr, araucariaTip);
    // "helper" symbol to change the turtle orientation randomly
    // and make branches more chaotic
    let randify = new LSymbol("(rand)", function (lsys: LSystem) {
        let turtle = lsys.getTopTurtle();
        let angle = lRandom.getNext() * 2.0 * Math.PI;
        let y = lRandom.getNext() * 1.8 - 0.9;
        vec3.set(turtle.orientation, Math.cos(angle), y, Math.sin(angle));
        vec3.normalize(turtle.orientation, turtle.orientation);
    });
    alphabet.set(randify.stringRepr, randify);

    // set expansion rules for araucaria
    araucariaStart.setExpansionRules([
        // artificially force all araucaria branches to end with lots of branched araucariaTips
        new ExpansionRule(6, [push, flatify, araucariaLong, decorationPear, araucariaTip,
                                  push, randify, araucariaTip,
                                      push, randify, araucariaTip,
                                          push, randify, araucariaTip,
                                          pop,
                                      pop,
                                      push, randify, araucariaTip,
                                          push, randify, araucariaTip,
                                          pop,
                                      pop,
                                      push, randify, araucariaTip,
                                          push, randify, araucariaTip,
                                          pop,
                                      pop,
                                      push, randify, araucariaTip,
                                          push, randify, araucariaTip,
                                          pop,
                                      pop,
                                  pop,
                              pop,
                              push, flatify, araucariaLong, decorationPear, araucariaTip,
                                  push, randify, araucariaTip,
                                      push, randify, araucariaTip,
                                          push, randify, araucariaTip,
                                          pop,
                                      pop,
                                      push, randify, araucariaTip,
                                          push, randify, araucariaTip,
                                          pop,
                                      pop,
                                      push, randify, araucariaTip,
                                          push, randify, araucariaTip,
                                          pop,
                                      pop,
                                  pop,
                              pop,
        ]),
        new ExpansionRule(1, [push, flatify, araucariaLong, decorationPear, araucariaTip,
                                  push, randify, araucariaTip,
                                      push, randify, araucariaTip,
                                          push, randify, araucariaTip,
                                          pop,
                                      pop,
                                      push, randify, araucariaTip,
                                          push, randify, araucariaTip,
                                          pop,
                                      pop,
                                      push, randify, araucariaTip,
                                          push, randify, araucariaTip,
                                          pop,
                                      pop,
                                  pop,
                              pop,
                              branchyStart, // make tree go up a bit
                              push, flatify, araucariaLong, decorationPear, araucariaTip,
                                  push, randify, araucariaTip,
                                      push, randify, araucariaTip,
                                          push, randify, araucariaTip,
                                          pop,
                                      pop,
                                      push, randify, araucariaTip,
                                          push, randify, araucariaTip,
                                          pop,
                                      pop,
                                      push, randify, araucariaTip,
                                          push, randify, araucariaTip,
                                          pop,
                                      pop,
                                  pop,
                              pop,
        ]),
    ]);

    araucariaTip.setExpansionRules([
        new ExpansionRule(1, [araucariaTip]), // don't change
        new ExpansionRule(6, [araucariaTip, push, randify, araucariaTip, pop]), // add branch
        new ExpansionRule(3, [araucariaTip, decorationPear, push, randify, araucariaTip, pop]), // add branch w/ pear
        new ExpansionRule(0.5, [araucariaTip, araucariaTip]), // grow current branch
        new ExpansionRule(0.5, [araucariaTip, decorationPear, araucariaTip]) // grow current branch w/ pear
    ]);

    // initialize L-system
    lsys = new LSystem();

    //lsys.setAxiom([R, plusZ, R, plusZ, R, twistyPlusBigY, twistyPlusBigY, twistyPlusBigY]);
    //lsys.setAxiom([R, plusZ, R, plusZ, R, twistyPlusBigY, twistyPlusBigY, twistyPlusBigY, vertify, R, R]);
    //lsys.setAxiom([R, R, R, push, flatify, araucariaLong, pop, push, flatify, araucariaLong, pop  ]);
    //lsys.setAxiom([R, R, R, push, flatify, araucariaLong, araucariaTip, push, randify, araucariaTip, pop, push, randify, araucariaTip, pop, push, randify, araucariaTip, pop, pop, push, flatify, araucariaLong, pop  ]);
    lsys.setAxiom([
        //F, plusZ, F, plusZ, F, plusZ, F, twistyStart, vertify, F, branchyStart
        shortF, plusZ, shortF, plusZ, shortF, plusZ, midF, twistyStart, vertify, F, branchyStart
    ]);

    runIterations(12);
    lsys.createPlant();

    /*
    console.log(lsys.lstring.toString());
    lsys.expandString();
    console.log(lsys.lstring.toString());
    lsys.expandString();
    console.log(lsys.lstring.toString());
    lsys.expandString();
    console.log(lsys.lstring.toString());
    lsys.expandString();
    console.log(lsys.lstring.toString());
    lsys.expandString();
    console.log(lsys.lstring.toString());
    lsys.expandString();
    console.log(lsys.lstring.toString());
    lsys.expandString();

    // remove expansions that lead to araucariaStart
    // we do this to avoid spawning new araucariaStarts that
    // won't have enough iterations to expand into nice bushy branches
    branchyPlusSmallX.setExpansionRules(branchyPlusSmallX.expansionRules.slice(1));
    branchyMinusSmallX.setExpansionRules(branchyMinusSmallX.expansionRules.slice(1));
    branchyPlusSmallY.setExpansionRules(branchyPlusSmallY.expansionRules.slice(1));
    branchyMinusSmallY.setExpansionRules(branchyMinusSmallY.expansionRules.slice(1));

    console.log(lsys.lstring.toString());
    lsys.expandString();
    console.log(lsys.lstring.toString());
    lsys.expandString();
    console.log(lsys.lstring.toString());
    lsys.expandString();
    console.log(lsys.lstring.toString());
    lsys.expandString();
    console.log(lsys.lstring.toString());
    lsys.executeString();
    */

    //F.action(lsys);
    //let turtle = lsys.getTopTurtle();
    //turtle.orientation = vec3.fromValues(0.7071, 0.7071, 0);
    //F.action(lsys);
    //turtle.orientation = vec3.fromValues(1, 0, 0);
    //F.action(lsys);
    plant = lsys.plant;
    //lsys.addPearAtTurtle(new Turtle(), mesh);
    //lsys.addPearAtTurtle(lsys.getTopTurtle(), mesh);
    //plant.addDecoration(mesh, mat4.create());
    //plant.create();

    console.log(alphabet.keys());
}

function runIterations(iterations: number) {
    if (iterations > 9) {
        for (let i = 0; i < iterations - 5; i++) {
            lsys.expandString();
        }

        // remove expansions that lead to araucariaStart
        // we do this to avoid spawning new araucariaStarts that
        // won't have enough iterations to expand into nice bushy branches
        let branchyPlusSmallX = alphabet.get("(B+x)");
        let branchyMinusSmallX = alphabet.get("(B-x)");
        let branchyPlusSmallY = alphabet.get("(B+y)");
        let branchyMinusSmallY = alphabet.get("(B-y)");
        // assume old weight is same for all
        let oldWeight = branchyPlusSmallX.expansionRules[0].weight;

        branchyPlusSmallX.expansionRules[0].weight = 0;
        branchyMinusSmallX.expansionRules[0].weight = 0;
        branchyPlusSmallY.expansionRules[0].weight = 0;
        branchyMinusSmallY.expansionRules[0].weight = 0;

        branchyPlusSmallX.updateWeights();
        branchyMinusSmallX.updateWeights();
        branchyPlusSmallY.updateWeights();
        branchyMinusSmallY.updateWeights();

        for (let i = 0; i < 5; i++) {
            lsys.expandString();
        }

        branchyPlusSmallX.expansionRules[0].weight = oldWeight;
        branchyMinusSmallX.expansionRules[0].weight = oldWeight;
        branchyPlusSmallY.expansionRules[0].weight = oldWeight;
        branchyMinusSmallY.expansionRules[0].weight = oldWeight;

        branchyPlusSmallX.updateWeights();
        branchyMinusSmallX.updateWeights();
        branchyPlusSmallY.updateWeights();
        branchyMinusSmallY.updateWeights();
    }
    else {
        for (let i = 0; i < iterations; i++) {
            lsys.expandString();
        }
    }
    /*
    if (iterations >= 13) {
        console.log(lsys.lstring.toString());
        //console.log(["length is: ", lsys.lstring.length()]);
        alert(["length is: ", lsys.lstring.length()]);
        debugger;
    }
    */
}

function main() {
    /*
    let f = function (y: number) {
        console.log("x+1: " + (y + 1));
        this.stringRepra = "bbb";
    };
    let s = new LSymbol("aaa", f);
    console.log(s.stringRepr);
    s.action(1);
    console.log(s.stringRepr);
    */
    // Initial display for framerate
    const stats = Stats();
    stats.setMode(0);
    stats.domElement.style.position = 'absolute';
    stats.domElement.style.left = '0px';
    stats.domElement.style.top = '0px';
    document.body.appendChild(stats.domElement);

    // Add controls to the gui
    const gui = new DAT.GUI();
    //gui.add(controls, 'tesselations', 0, 8).step(1);
    //gui.add(controls, 'Load Scene');
    //let colorController = gui.addColor(controls, 'geometryColor');
    //gui.add(controls, 'shader', { "Lame Lambert": ShaderEnum.LAMBERT, "Cool Custom": ShaderEnum.CUSTOM, "Decent Disks": ShaderEnum.DISKS, "Plumous Planet": ShaderEnum.PLANET, "Urban Planet": ShaderEnum.BLDGS, "Magic Plumous Planet": ShaderEnum.MAGIC });
    //let speedController = gui.add(controls, 'shaderSpeed', 0, 10);
    //gui.add(controls, 'Toggle tilting');
    //gui.add(controls, 'Toggle squishing');
    //gui.add(controls, 'lavaBias', 0, 100);
    //gui.add(controls, 'plumeBias', 0, 100);
    //gui.add(controls, 'edgeClarity', 0, 100);
    let lightFolder = gui.addFolder('Light Position');
    lightFolder.add(controls, 'lightX');
    lightFolder.add(controls, 'lightY');
    lightFolder.add(controls, 'lightZ');
    gui.add(controls, 'iterations').min(0).step(1);
    let randomModeController = gui.add(controls, 'randomMode', { "Math.random()": LRANDOM_MATH_RANDOM, "Seeded Noise": LRANDOM_DETERMINISTIC });
    let randomSeedController = gui.add(controls, 'randomSeed');
    let woodColorController = gui.addColor(controls, 'woodColor');
    let leafColorController = gui.addColor(controls, 'leafColor');
    gui.add(controls, 'fruit', { "Banana": FruitEnum.BANANA, "Pineapple": FruitEnum.PINEAPPLE, '"Chinese Noodles"': FruitEnum.RAMEN, "Pizza": FruitEnum.PIZZA, "Cake": FruitEnum.CAKE });
    gui.add(controls, 'Show Alphabet');
    gui.add(controls, 'Show String');
    gui.add(controls, 'Regenerate String and Plant');
    gui.add(controls, 'Redraw Plant');
    gui.add(controls, 'Show Help');


    // Set up L-system event listeners
    randomModeController.onChange(function (mode: number) {
        console.log(mode);
        lRandom.setMode(mode);
    });

    randomSeedController.onChange(function (seed: number) {
        lRandom.setSeed(seed);
    });

    woodColorController.onChange(function (color: Int32Array) {
        vec4.set(BRANCH_COLOR, color[0] / 255, color[1] / 255, color[2] / 255, 1);
    });

    leafColorController.onChange(function (color: Int32Array) {
        vec4.set(TIP_COLOR, color[0] / 255, color[1] / 255, color[2] / 255, 1);
    });

    // get canvas and webgl context
    const canvas = <HTMLCanvasElement>document.getElementById('canvas');
    const gl = <WebGL2RenderingContext>canvas.getContext('webgl2');
    if (!gl) {
        alert('WebGL 2 not supported!');
    }
    // `setGL` is a function imported above which sets the value of `gl` in the `globals.ts` module.
    // Later, we can import `gl` from `globals.ts` to access it
    setGL(gl);

    // Initial call to load scene
    loadScene();
    //blah();
    bleh();

    // load textures
    //let pearTex = loadTexture(gl, "textures/banana.png");

    const camera = new Camera(vec3.fromValues(0, 5, 10), vec3.fromValues(0, 4, 0));

    renderer = new OpenGLRenderer(canvas);
    renderer.setClearColor(0.2, 0.2, 0.2, 1);
    gl.enable(gl.DEPTH_TEST);

    // Set up event listener for color change
    //colorController.onChange(function (color: Int32Array) {
        //renderer.setGeometryColor(vec4.fromValues(color[0] / 255, color[1] / 255, color[2] / 255, 1));
    //});

    // Initialize color
    renderer.setGeometryColor(vec4.fromValues(controls.geometryColor[0] / 255,
        controls.geometryColor[1] / 255,
        controls.geometryColor[2] / 255,
        1
    ));

    // Set up event listener for shader speed
    //speedController.onChange(function (speed: number) {
        //renderer.setShaderSpeed(speed);
    //});

    const lambert = new ShaderProgram([
        new Shader(gl.VERTEX_SHADER, require('./shaders/lambert-vert.glsl')),
        new Shader(gl.FRAGMENT_SHADER, require('./shaders/lambert-frag.glsl')),
    ]);

    const custom = new ShaderProgram([
        new Shader(gl.VERTEX_SHADER, require('./shaders/custom-vert.glsl')),
        new Shader(gl.FRAGMENT_SHADER, require('./shaders/custom-frag.glsl')),
    ]);

    const disks = new ShaderProgram([
        new Shader(gl.VERTEX_SHADER, require('./shaders/disks-vert.glsl')),
        new Shader(gl.FRAGMENT_SHADER, require('./shaders/disks-frag.glsl')),
    ]);

    const planet = new ShaderProgram([
        new Shader(gl.VERTEX_SHADER, require('./shaders/planet-vert.glsl')),
        new Shader(gl.FRAGMENT_SHADER, require('./shaders/planet-frag.glsl')),
    ]);

    const planetMagic = new ShaderProgram([
        new Shader(gl.VERTEX_SHADER, require('./shaders/planet-vert.glsl')),
        new Shader(gl.FRAGMENT_SHADER, require('./shaders/planet-magic-frag.glsl')),
    ]);

    const bldgs = new ShaderProgram([
        new Shader(gl.VERTEX_SHADER, require('./shaders/bldgs-vert.glsl')),
        new Shader(gl.FRAGMENT_SHADER, require('./shaders/bldgs-frag.glsl')),
    ]);

    let shaders: { [id: number]: ShaderProgram; } = {};
    shaders[ShaderEnum.LAMBERT] = lambert;
    shaders[ShaderEnum.CUSTOM] = custom;
    shaders[ShaderEnum.DISKS] = disks;
    shaders[ShaderEnum.PLANET] = planet;
    shaders[ShaderEnum.MAGIC] = planetMagic;
    shaders[ShaderEnum.BLDGS] = bldgs;

    // set shader to use texture
    lambert.setSampler0(texture);

    // This function will be called every frame
    function tick() {
        camera.update();
        stats.begin();
        gl.viewport(0, 0, window.innerWidth, window.innerHeight);
        renderer.clear();
        renderer.setLightPos(vec3.fromValues(controls.lightX, controls.lightY, controls.lightZ));
        renderer.setLavaBias(controls.lavaBias / 100);
        renderer.setPlumeBias(controls.plumeBias / 100);
        renderer.setEdgeClarity(controls.edgeClarity / 100);
        renderer.render(camera, shaders[controls.shader], [
            // icosphere,
            // square,
            //cube,
            plant,
        ]);
        stats.end();

        // Tell the browser to call `tick` again whenever it renders a new frame
        requestAnimationFrame(tick);
    }

    window.addEventListener('resize', function () {
        renderer.setSize(window.innerWidth, window.innerHeight);
        camera.setAspectRatio(window.innerWidth / window.innerHeight);
        camera.updateProjectionMatrix();
    }, false);

    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.setAspectRatio(window.innerWidth / window.innerHeight);
    camera.updateProjectionMatrix();

    // Start the render loop
    tick();
}

main();
