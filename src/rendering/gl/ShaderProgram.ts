import {vec3, vec4, mat4} from 'gl-matrix';
import Drawable from './Drawable';
import {gl} from '../../globals';

var activeProgram: WebGLProgram = null;

export class Shader {
  shader: WebGLShader;

  constructor(type: number, source: string) {
    this.shader = gl.createShader(type);
    gl.shaderSource(this.shader, source);
    gl.compileShader(this.shader);

    if (!gl.getShaderParameter(this.shader, gl.COMPILE_STATUS)) {
      throw gl.getShaderInfoLog(this.shader);
    }
  }
};

class ShaderProgram {
  prog: WebGLProgram;

  attrPos: number;
  attrNor: number;
  attrCol: number;
  attrUV: number;

  unifModel: WebGLUniformLocation;
  unifModelInvTr: WebGLUniformLocation;
  unifViewProj: WebGLUniformLocation;
  unifColor: WebGLUniformLocation;
  unifTime: WebGLUniformLocation;
  unifTimeXZ: WebGLUniformLocation;
  unifTimeY: WebGLUniformLocation;
  unifSpeed: WebGLUniformLocation;
  unifEyePos: WebGLUniformLocation;
  unifLightPos: WebGLUniformLocation;
  unifLavaBias: WebGLUniformLocation;
  unifPlumeBias: WebGLUniformLocation;
  unifEdgeClarity: WebGLUniformLocation;
  unifSampler0: WebGLUniformLocation;
  unifPerlinSeed: WebGLUniformLocation;

  constructor(shaders: Array<Shader>) {
    this.prog = gl.createProgram();

    for (let shader of shaders) {
      gl.attachShader(this.prog, shader.shader);
    }
    gl.linkProgram(this.prog);
    if (!gl.getProgramParameter(this.prog, gl.LINK_STATUS)) {
      throw gl.getProgramInfoLog(this.prog);
    }

    this.attrPos = gl.getAttribLocation(this.prog, "vs_Pos");
    this.attrNor = gl.getAttribLocation(this.prog, "vs_Nor");
    this.attrCol = gl.getAttribLocation(this.prog, "vs_Col");
    this.attrUV = gl.getAttribLocation(this.prog, "vs_UV");
    this.unifModel        = gl.getUniformLocation(this.prog, "u_Model");
    this.unifModelInvTr   = gl.getUniformLocation(this.prog, "u_ModelInvTr");
    this.unifViewProj     = gl.getUniformLocation(this.prog, "u_ViewProj");
    this.unifColor        = gl.getUniformLocation(this.prog, "u_Color");
    this.unifTime         = gl.getUniformLocation(this.prog, "u_Time");
    this.unifTimeXZ       = gl.getUniformLocation(this.prog, "u_TimeXZ");
    this.unifTimeY        = gl.getUniformLocation(this.prog, "u_TimeY");
    this.unifSpeed        = gl.getUniformLocation(this.prog, "u_Speed");
    this.unifEyePos       = gl.getUniformLocation(this.prog, "u_EyePos");
    this.unifLightPos     = gl.getUniformLocation(this.prog, "u_LightPos");
    this.unifLavaBias     = gl.getUniformLocation(this.prog, "u_LavaBias");
    this.unifPlumeBias    = gl.getUniformLocation(this.prog, "u_PlumeBias");
    this.unifEdgeClarity  = gl.getUniformLocation(this.prog, "u_EdgeClarity");
    this.unifSampler0  = gl.getUniformLocation(this.prog, "u_Sampler0");
    this.unifPerlinSeed  = gl.getUniformLocation(this.prog, "u_PerlinSeed");
  }

  use() {
    if (activeProgram !== this.prog) {
      gl.useProgram(this.prog);
      activeProgram = this.prog;
    }
  }

  setSampler0(texture: WebGLTexture) {
    this.use();
    if (this.unifSampler0 !== -1) {
        // Tell WebGL we want to affect texture unit 0
        gl.activeTexture(gl.TEXTURE0);

        // Bind the texture to texture unit 0
        gl.bindTexture(gl.TEXTURE_2D, texture);

        // Tell the shader we bound the texture to texture unit 0
        gl.uniform1i(this.unifSampler0, 0);
    }
  }

  setModelMatrix(model: mat4) {
    this.use();
    if (this.unifModel !== -1) {
      gl.uniformMatrix4fv(this.unifModel, false, model);
    }

    if (this.unifModelInvTr !== -1) {
      let modelinvtr: mat4 = mat4.create();
      mat4.transpose(modelinvtr, model);
      mat4.invert(modelinvtr, modelinvtr);
      gl.uniformMatrix4fv(this.unifModelInvTr, false, modelinvtr);
    }
  }

  setViewProjMatrix(vp: mat4) {
    this.use();
    if (this.unifViewProj !== -1) {
      gl.uniformMatrix4fv(this.unifViewProj, false, vp);
    }
  }

  setGeometryColor(color: vec4) {
    this.use();
    if (this.unifColor !== -1) {
      gl.uniform4fv(this.unifColor, color);
    }
  }

  setTime(time: number) {
    this.use();
    if (this.unifTime !== -1) {
      gl.uniform1f(this.unifTime, time);
    }
  }

  setTimeXZ(time: number) {
    this.use();
    if (this.unifTimeXZ !== -1) {
      gl.uniform1f(this.unifTimeXZ, time);
    }
  }

  setTimeY(time: number) {
    this.use();
    if (this.unifTimeY !== -1) {
      gl.uniform1f(this.unifTimeY, time);
    }
  }

  setSpeed(speed: number) {
    this.use();
    if (this.unifSpeed !== -1) {
      gl.uniform1f(this.unifSpeed, speed);
    }
  }

  setEyePos(eyePos: vec3) {
    this.use();
    if (this.unifEyePos !== -1) {
      gl.uniform3fv(this.unifEyePos, eyePos);
    }
  }

  setLightPos(lightPos: vec3) {
    this.use();
    if (this.unifLightPos !== -1) {
      gl.uniform3fv(this.unifLightPos, lightPos);
    }
  }

  setLavaBias(lavaBias: number) {
    this.use();
    if (this.unifLavaBias !== -1) {
      gl.uniform1f(this.unifLavaBias, lavaBias);
    }
  }

  setPlumeBias(plumeBias: number) {
    this.use();
    if (this.unifPlumeBias !== -1) {
      gl.uniform1f(this.unifPlumeBias, plumeBias);
    }
  }

  setEdgeClarity(edgeClarity: number) {
    this.use();
    if (this.unifEdgeClarity !== -1) {
      gl.uniform1f(this.unifEdgeClarity, edgeClarity);
    }
  }

  setPerlinSeed(perlinSeed: number) {
    this.use();
    if (this.unifPerlinSeed !== -1) {
      gl.uniform1f(this.unifPerlinSeed, perlinSeed);
    }
  }

  draw(d: Drawable) {
    this.use();

    if (this.attrPos != -1 && d.bindPos()) {
      gl.enableVertexAttribArray(this.attrPos);
      gl.vertexAttribPointer(this.attrPos, 4, gl.FLOAT, false, 0, 0);
    }

    if (this.attrNor != -1 && d.bindNor()) {
      gl.enableVertexAttribArray(this.attrNor);
      gl.vertexAttribPointer(this.attrNor, 4, gl.FLOAT, false, 0, 0);
    }

    if (this.attrCol != -1 && d.bindCol()) {
      gl.enableVertexAttribArray(this.attrCol);
      gl.vertexAttribPointer(this.attrCol, 4, gl.FLOAT, false, 0, 0);
    }

    if (this.attrUV != -1 && d.bindUV()) {
      gl.enableVertexAttribArray(this.attrUV);
      gl.vertexAttribPointer(this.attrUV, 2, gl.FLOAT, false, 0, 0);
    }

    d.bindIdx();
    gl.drawElements(d.drawMode(), d.elemCount(), gl.UNSIGNED_INT, 0);

    if (this.attrPos != -1) gl.disableVertexAttribArray(this.attrPos);
    if (this.attrNor != -1) gl.disableVertexAttribArray(this.attrNor);
    if (this.attrCol != -1) gl.disableVertexAttribArray(this.attrCol);
    if (this.attrUV != -1) gl.disableVertexAttribArray(this.attrUV);
  }
};

export default ShaderProgram;
