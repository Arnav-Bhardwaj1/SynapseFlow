/**
 * Quantum Linear Algebra & Multi-Qubit State Vector Simulator Engine (Part 1)
 */

export interface Complex {
  re: number;
  im: number;
}

export const complex = (re: number, im: number = 0): Complex => ({ re, im });

export const cAdd = (a: Complex, b: Complex): Complex => ({ re: a.re + b.re, im: a.im + b.im });
export const cMul = (a: Complex, b: Complex): Complex => ({
  re: a.re * b.re - a.im * b.im,
  im: a.re * b.im + a.im * b.re
});
export const cScale = (a: Complex, s: number): Complex => ({ re: a.re * s, im: a.im * s });
export const cConj = (a: Complex): Complex => ({ re: a.re, im: -a.im });
export const cAbsSq = (a: Complex): number => a.re * a.re + a.im * a.im;

export const formatComplex = (c: Complex, precision: number = 2): string => {
  const r = Number(c.re.toFixed(precision));
  const i = Number(c.im.toFixed(precision));
  if (Math.abs(r) < 1e-4 && Math.abs(i) < 1e-4) return '0';
  if (Math.abs(i) < 1e-4) return `${r}`;
  if (Math.abs(r) < 1e-4) return `${i === 1 ? '' : i === -1 ? '-' : i}i`;
  const sign = i > 0 ? '+' : '-';
  return `${r} ${sign} ${Math.abs(i)}i`;
};

export type GateType = 'H' | 'X' | 'Z' | 'S' | 'CNOT' | 'CZ' | 'SWAP';

export interface QuantumGate {
  id: string;
  type: GateType;
  qubit: number;
  controlQubit?: number;
  step: number;
}

export interface BlochCoords {
  x: number;
  y: number;
  z: number;
  theta: number;
  phi: number;
}

const SQRT2_INV = 1 / Math.sqrt(2);
export type Matrix2x2 = [[Complex, Complex], [Complex, Complex]];

export const MATRIX_H: Matrix2x2 = [
  [complex(SQRT2_INV, 0), complex(SQRT2_INV, 0)],
  [complex(SQRT2_INV, 0), complex(-SQRT2_INV, 0)]
];
export const MATRIX_X: Matrix2x2 = [
  [complex(0, 0), complex(1, 0)],
  [complex(1, 0), complex(0, 0)]
];
export const MATRIX_Z: Matrix2x2 = [
  [complex(1, 0), complex(0, 0)],
  [complex(0, 0), complex(-1, 0)]
];
export const MATRIX_S: Matrix2x2 = [
  [complex(1, 0), complex(0, 0)],
  [complex(0, 0), complex(0, 1)]
];

export class QuantumCircuitEngine {
  numQubits: number;
  gates: QuantumGate[];

  constructor(numQubits: number = 3) {
    this.numQubits = Math.max(1, Math.min(5, numQubits));
    this.gates = [];
  }

  setNumQubits(n: number) {
    this.numQubits = Math.max(1, Math.min(5, n));
    this.gates = this.gates.filter(g => g.qubit < this.numQubits);
  }

  addGate(gate: QuantumGate) {
    this.gates = this.gates.filter(g => !(g.qubit === gate.qubit && g.step === gate.step));
    this.gates.push(gate);
  }

  removeGate(id: string) {
    this.gates = this.gates.filter(g => g.id !== id);
  }

  clear() {
    this.gates = [];
  }

  getInitialState(): Complex[] {
    const dim = 1 << this.numQubits;
    const state: Complex[] = new Array(dim).fill(0).map(() => complex(0, 0));
    state[0] = complex(1, 0);
    return state;
  }

  simulateToStep(targetStep: number): Complex[] {
    let state = this.getInitialState();
    const sortedSteps = Array.from(new Set(this.gates.map(g => g.step))).sort((a, b) => a - b);

    for (const step of sortedSteps) {
      if (step > targetStep) break;
      const stepGates = this.gates.filter(g => g.step === step);
      for (const gate of stepGates) {
        state = this.applyGate(state, gate);
      }
    }
    return state;
  }

  applyGate(state: Complex[], gate: QuantumGate): Complex[] {
    const dim = 1 << this.numQubits;
    const nextState: Complex[] = new Array(dim).fill(0).map(() => complex(0, 0));

    if (['H', 'X', 'Z', 'S'].includes(gate.type)) {
      let m: Matrix2x2 = MATRIX_H;
      if (gate.type === 'X') m = MATRIX_X;
      if (gate.type === 'Z') m = MATRIX_Z;
      if (gate.type === 'S') m = MATRIX_S;

      const bitMask = 1 << (this.numQubits - 1 - gate.qubit);
      for (let i = 0; i < dim; i++) {
        if ((i & bitMask) === 0) {
          const i0 = i;
          const i1 = i | bitMask;
          nextState[i0] = cAdd(cMul(m[0][0], state[i0]), cMul(m[0][1], state[i1]));
          nextState[i1] = cAdd(cMul(m[1][0], state[i0]), cMul(m[1][1], state[i1]));
        }
      }
      return nextState;
    }

    if (gate.type === 'CNOT' && gate.controlQubit !== undefined) {
      const cMask = 1 << (this.numQubits - 1 - gate.controlQubit);
      const tMask = 1 << (this.numQubits - 1 - gate.qubit);
      for (let i = 0; i < dim; i++) {
        nextState[i] = (i & cMask) !== 0 ? state[i ^ tMask] : state[i];
      }
      return nextState;
    }

    if (gate.type === 'CZ' && gate.controlQubit !== undefined) {
      const cMask = 1 << (this.numQubits - 1 - gate.controlQubit);
      const tMask = 1 << (this.numQubits - 1 - gate.qubit);
      for (let i = 0; i < dim; i++) {
        nextState[i] = ((i & cMask) !== 0 && (i & tMask) !== 0) ? cScale(state[i], -1) : state[i];
      }
      return nextState;
    }

    if (gate.type === 'SWAP' && gate.controlQubit !== undefined) {
      const m1 = 1 << (this.numQubits - 1 - gate.qubit);
      const m2 = 1 << (this.numQubits - 1 - gate.controlQubit);
      for (let i = 0; i < dim; i++) {
        const b1 = (i & m1) !== 0;
        const b2 = (i & m2) !== 0;
        nextState[i] = b1 !== b2 ? state[i ^ m1 ^ m2] : state[i];
      }
      return nextState;
    }

    return state;
  }

  computeBlochCoords(state: Complex[], targetQubit: number): BlochCoords {
    const bitMask = 1 << (this.numQubits - 1 - targetQubit);
    let rho00 = 0, rho11 = 0;
    let rho01 = complex(0, 0);

    for (let i = 0; i < state.length; i++) {
      if ((i & bitMask) === 0) {
        rho00 += cAbsSq(state[i]);
        rho11 += cAbsSq(state[i | bitMask]);
        rho01 = cAdd(rho01, cMul(state[i], cConj(state[i | bitMask])));
      }
    }

    const x = 2 * rho01.re;
    const y = 2 * rho01.im;
    const z = rho00 - rho11;
    const r = Math.sqrt(x * x + y * y + z * z);
    const theta = r > 1e-6 ? Math.acos(Math.min(1, Math.max(-1, z / r))) : 0;
    const phi = Math.atan2(y, x);

    return { x, y, z, theta, phi };
  }

  loadPreset(presetName: 'bell' | 'teleport') {
    this.clear();
    if (presetName === 'bell') {
      this.numQubits = 2;
      this.addGate({ id: '1', type: 'H', qubit: 0, step: 0 });
      this.addGate({ id: '2', type: 'CNOT', qubit: 1, controlQubit: 0, step: 1 });
    } else if (presetName === 'teleport') {
      this.numQubits = 3;
      this.addGate({ id: '1', type: 'H', qubit: 0, step: 0 });
      this.addGate({ id: '2', type: 'H', qubit: 1, step: 0 });
      this.addGate({ id: '3', type: 'CNOT', qubit: 2, controlQubit: 1, step: 1 });
      this.addGate({ id: '4', type: 'CNOT', qubit: 1, controlQubit: 0, step: 2 });
      this.addGate({ id: '5', type: 'H', qubit: 0, step: 3 });
    }
  }
}
