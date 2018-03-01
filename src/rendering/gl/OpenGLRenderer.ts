import {mat4, vec3, vec4} from 'gl-matrix';
import Drawable from './Drawable';
import Camera from '../../Camera';
import {gl} from '../../globals';
import ShaderProgram from './ShaderProgram';

// In this file, `gl` is accessible because it is imported above
class OpenGLRenderer {
  geometryColor: vec4;
  startTime: number;
  shaderSpeed: number;
  startTimeXZ: number;
  lastStopTimeXZ: number;
  isStoppedXZ: boolean;
  startTimeY: number;
  lastStopTimeY: number;
  isStoppedY: boolean;
  accTime: number;
  lightPos: vec3;
  lavaBias: number;
  plumeBias: number;
  edgeClarity: number;

  constructor(public canvas: HTMLCanvasElement) {
    this.geometryColor = vec4.fromValues(0, 0, 0, 1);
    this.startTime = Date.now();
    this.shaderSpeed = 1;
    this.isStoppedXZ = false;
    this.startTimeXZ = this.startTime;
    this.lastStopTimeXZ = 0;
    this.isStoppedY = false;
    this.startTimeY = this.startTime;
    this.lastStopTimeY = 0;
    this.accTime = 0;
    this.lightPos = vec3.fromValues(10, 1, 1);
    this.lavaBias = 0.5;
    this.plumeBias = 0;
    this.edgeClarity = 0;
  }

  setClearColor(r: number, g: number, b: number, a: number) {
    gl.clearColor(r, g, b, a);
  }

  setSize(width: number, height: number) {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  clear() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }

  setGeometryColor(color: vec4) {
    this.geometryColor = color;
  }

  setShaderSpeed(speed: number) {
      this.shaderSpeed = speed;
  }

  setLightPos(lightPos: vec3) {
      this.lightPos = lightPos;
  }

  setLavaBias(lavaBias: number) {
      this.lavaBias = lavaBias;
  }

  setPlumeBias(plumeBias: number) {
      this.plumeBias = plumeBias;
  }

  setEdgeClarity(edgeClarity: number) {
      this.edgeClarity = edgeClarity;
  }

  toggleAnimXZ() {
    let now = Date.now();

    if (!this.isStoppedXZ) {
      this.lastStopTimeXZ += now - this.startTimeXZ;
    }
    this.startTimeXZ = now;

    this.isStoppedXZ = !this.isStoppedXZ;
  }

  toggleAnimY() {
    let now = Date.now();

    if (!this.isStoppedY) {
      this.lastStopTimeY += now - this.startTimeY;
    }
    this.startTimeY = now;

    this.isStoppedY = !this.isStoppedY;
  }

  render(camera: Camera, prog: ShaderProgram, drawables: Array<Drawable>) {
    let model = mat4.create();
    let viewProj = mat4.create();

    mat4.identity(model);
    mat4.multiply(viewProj, camera.projectionMatrix, camera.viewMatrix);
    prog.setModelMatrix(model);
    prog.setViewProjMatrix(viewProj);
    prog.setEyePos(camera.position);
    prog.setLightPos(this.lightPos);
    prog.setLavaBias(this.lavaBias);
    prog.setPlumeBias(this.plumeBias);
    prog.setEdgeClarity(this.edgeClarity);
    prog.setGeometryColor(this.geometryColor);
    let now = Date.now();
    let delta = now - this.startTime;
    this.accTime += this.shaderSpeed * delta;
    this.startTime = now;
    prog.setTime(this.accTime);
    if (this.isStoppedXZ) {
      prog.setTimeXZ(this.lastStopTimeXZ);
    }
    else {
      prog.setTimeXZ(now - this.startTimeXZ + this.lastStopTimeXZ);
    }
    if (this.isStoppedY) {
      prog.setTimeY(this.lastStopTimeY);
    }
    else {
      prog.setTimeY(now - this.startTimeY + this.lastStopTimeY);
    }
    prog.setSpeed(this.shaderSpeed);

    for (let drawable of drawables) {
      //prog.setModelMatrix(mat4.fromTranslation(mat4.create(), drawable.center));
      prog.draw(drawable);
    }
  }
};

export default OpenGLRenderer;
// pretend we know how to shade things

