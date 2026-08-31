/**
 * SynapseFlow - Neural & Tensor Computational Graph Engine
 * High-performance 2D Matrix algebra, Automatic Differentiation (Autograd),
 * Backpropagation, Optimizer updates (SGD/Adam), Synthetic Data Generation & Code Generators.
 */

export type ActivationFunction = 'relu' | 'sigmoid' | 'tanh' | 'softmax' | 'linear';
export type OptimizerType = 'sgd' | 'adam' | 'rmsprop';
export type DatasetType = 'circles' | 'spirals' | 'xor' | 'moons';

export interface DataPoint {
  x: number;
  y: number;
  label: number; // 0 or 1
}

export interface LayerConfig {
  id: string;
  neurons: number;
  activation: ActivationFunction;
}

export interface NetworkConfig {
  inputDim: number;
  layers: LayerConfig[]; // Includes hidden layers and output layer
  learningRate: number;
  optimizer: OptimizerType;
  l2Regularization: number;
}

export interface GradientTraceNode {
  layerIndex: number;
  layerName: string;
  weightGradNorm: number;
  biasGradNorm: number;
  activationMean: number;
  status: 'NOMINAL' | 'VANISHING' | 'EXPLODING';
}

/**
 * 2D Tensor Matrix class with autograd gradient storage
 */
export class Tensor2D {
  rows: number;
  cols: number;
  data: number[][];
  grad: number[][];

  constructor(rows: number, cols: number, initialData?: number[][]) {
    this.rows = rows;
    this.cols = cols;
    if (initialData) {
      this.data = initialData.map(row => [...row]);
    } else {
      this.data = Array.from({ length: rows }, () => Array(cols).fill(0));
    }
    this.grad = Array.from({ length: rows }, () => Array(cols).fill(0));
  }

  // Xavier/He weight initialization
  static randomUniform(rows: number, cols: number, scale: number = 0.5): Tensor2D {
    const tensor = new Tensor2D(rows, cols);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        tensor.data[r][c] = (Math.random() * 2 - 1) * scale;
      }
    }
    return tensor;
  }

  static zeros(rows: number, cols: number): Tensor2D {
    return new Tensor2D(rows, cols);
  }

  zeroGrad(): void {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        this.grad[r][c] = 0;
      }
    }
  }

  // Matrix Multiplication: (A x B) -> (rowsA x colsB)
  matmul(other: Tensor2D): Tensor2D {
    if (this.cols !== other.rows) {
      throw new Error(`Dimension mismatch for matmul: [${this.rows}x${this.cols}] vs [${other.rows}x${other.cols}]`);
    }
    const result = new Tensor2D(this.rows, other.cols);
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < other.cols; j++) {
        let sum = 0;
        for (let k = 0; k < this.cols; k++) {
          sum += this.data[i][k] * other.data[k][j];
        }
        result.data[i][j] = sum;
      }
    }
    return result;
  }

  // Transpose: (rows x cols) -> (cols x rows)
  transpose(): Tensor2D {
    const result = new Tensor2D(this.cols, this.rows);
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        result.data[c][r] = this.data[r][c];
      }
    }
    return result;
  }

  // Calculate Frobenius Norm of matrix
  norm(useGrad: boolean = false): number {
    let sumSq = 0;
    const target = useGrad ? this.grad : this.data;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        sumSq += target[r][c] * target[r][c];
      }
    }
    return Math.sqrt(sumSq);
  }

  // Compute average of all elements
  mean(): number {
    let sum = 0;
    const count = this.rows * this.cols;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        sum += this.data[r][c];
      }
    }
    return count > 0 ? sum / count : 0;
  }
}

/**
 * Dense / Fully Connected Neural Layer
 */
export class DenseLayer {
  id: string;
  inFeatures: number;
  outFeatures: number;
  activation: ActivationFunction;

  weights: Tensor2D;
  biases: Tensor2D;

  // Adam Optimizer moment accumulators
  mW: Tensor2D;
  vW: Tensor2D;
  mb: Tensor2D;
  vb: Tensor2D;

  // Cache for forward pass computation
  lastInput: Tensor2D | null = null;
  lastZ: Tensor2D | null = null;
  lastA: Tensor2D | null = null;

  constructor(id: string, inFeatures: number, outFeatures: number, activation: ActivationFunction) {
    this.id = id;
    this.inFeatures = inFeatures;
    this.outFeatures = outFeatures;
    this.activation = activation;

    // He/Xavier initialization scale based on activation function
    const scale = activation === 'relu' ? Math.sqrt(2 / inFeatures) : Math.sqrt(1 / inFeatures);
    this.weights = Tensor2D.randomUniform(inFeatures, outFeatures, scale);
    this.biases = Tensor2D.zeros(1, outFeatures);

    this.mW = Tensor2D.zeros(inFeatures, outFeatures);
    this.vW = Tensor2D.zeros(inFeatures, outFeatures);
    this.mb = Tensor2D.zeros(1, outFeatures);
    this.vb = Tensor2D.zeros(1, outFeatures);
  }

  forward(input: Tensor2D): Tensor2D {
    this.lastInput = input;
    // Z = X * W + b
    const Z = new Tensor2D(input.rows, this.outFeatures);
    for (let r = 0; r < input.rows; r++) {
      for (let c = 0; c < this.outFeatures; c++) {
        let sum = this.biases.data[0][c];
        for (let k = 0; k < this.inFeatures; k++) {
          sum += input.data[r][k] * this.weights.data[k][c];
        }
        Z.data[r][c] = sum;
      }
    }
    this.lastZ = Z;

    // Apply Activation: A = f(Z)
    const A = new Tensor2D(Z.rows, Z.cols);
    for (let r = 0; r < Z.rows; r++) {
      for (let c = 0; c < Z.cols; c++) {
        const val = Z.data[r][c];
        if (this.activation === 'relu') {
          A.data[r][c] = Math.max(0, val);
        } else if (this.activation === 'sigmoid') {
          A.data[r][c] = 1 / (1 + Math.exp(-Math.max(-15, Math.min(15, val))));
        } else if (this.activation === 'tanh') {
          A.data[r][c] = Math.tanh(val);
        } else {
          A.data[r][c] = val; // linear
        }
      }
    }
    this.lastA = A;
    return A;
  }

  backward(dA: Tensor2D): Tensor2D {
    if (!this.lastInput || !this.lastZ || !this.lastA) {
      throw new Error('Forward pass must be executed before backward pass.');
    }

    const batchSize = dA.rows;
    const dZ = new Tensor2D(dA.rows, dA.cols);

    // 1. Compute dZ = dA * f'(Z)
    for (let r = 0; r < dA.rows; r++) {
      for (let c = 0; c < dA.cols; c++) {
        const zVal = this.lastZ.data[r][c];
        const aVal = this.lastA.data[r][c];
        const daVal = dA.data[r][c];

        let deriv = 1;
        if (this.activation === 'relu') {
          deriv = zVal > 0 ? 1 : 0;
        } else if (this.activation === 'sigmoid') {
          deriv = aVal * (1 - aVal);
        } else if (this.activation === 'tanh') {
          deriv = 1 - aVal * aVal;
        }

        dZ.data[r][c] = daVal * deriv;
      }
    }

    // 2. Compute dW = (X^T * dZ) / batchSize
    this.weights.zeroGrad();
    for (let i = 0; i < this.inFeatures; i++) {
      for (let j = 0; j < this.outFeatures; j++) {
        let sum = 0;
        for (let b = 0; b < batchSize; b++) {
          sum += this.lastInput.data[b][i] * dZ.data[b][j];
        }
        this.weights.grad[i][j] = sum / batchSize;
      }
    }

    // 3. Compute db = sum(dZ, axis=0) / batchSize
    this.biases.zeroGrad();
    for (let j = 0; j < this.outFeatures; j++) {
      let sum = 0;
      for (let b = 0; b < batchSize; b++) {
        sum += dZ.data[b][j];
      }
      this.biases.grad[0][j] = sum / batchSize;
    }

    // 4. Compute dX = dZ * W^T
    const dX = new Tensor2D(batchSize, this.inFeatures);
    for (let b = 0; b < batchSize; b++) {
      for (let i = 0; i < this.inFeatures; i++) {
        let sum = 0;
        for (let j = 0; j < this.outFeatures; j++) {
          sum += dZ.data[b][j] * this.weights.data[i][j];
        }
        dX.data[b][i] = sum;
      }
    }

    return dX;
  }

  // Parameter update via SGD or Adam
  updateParams(lr: number, optimizer: OptimizerType, l2Reg: number = 0, stepCount: number = 1): void {
    const beta1 = 0.9;
    const beta2 = 0.999;
    const eps = 1e-8;

    for (let i = 0; i < this.inFeatures; i++) {
      for (let j = 0; j < this.outFeatures; j++) {
        let gW = this.weights.grad[i][j] + l2Reg * this.weights.data[i][j];

        if (optimizer === 'adam') {
          this.mW.data[i][j] = beta1 * this.mW.data[i][j] + (1 - beta1) * gW;
          this.vW.data[i][j] = beta2 * this.vW.data[i][j] + (1 - beta2) * (gW * gW);

          const mHat = this.mW.data[i][j] / (1 - Math.pow(beta1, stepCount));
          const vHat = this.vW.data[i][j] / (1 - Math.pow(beta2, stepCount));

          this.weights.data[i][j] -= (lr * mHat) / (Math.sqrt(vHat) + eps);
        } else {
          // Standard SGD
          this.weights.data[i][j] -= lr * gW;
        }
      }
    }

    for (let j = 0; j < this.outFeatures; j++) {
      let gb = this.biases.grad[0][j];

      if (optimizer === 'adam') {
        this.mb.data[0][j] = beta1 * this.mb.data[0][j] + (1 - beta1) * gb;
        this.vb.data[0][j] = beta2 * this.vb.data[0][j] + (1 - beta2) * (gb * gb);

        const mHat = this.mb.data[0][j] / (1 - Math.pow(beta1, stepCount));
        const vHat = this.vb.data[0][j] / (1 - Math.pow(beta2, stepCount));

        this.biases.data[0][j] -= (lr * mHat) / (Math.sqrt(vHat) + eps);
      } else {
        this.biases.data[0][j] -= lr * gb;
      }
    }
  }
}

/**
 * Sequential Neural Network Model Container
 */
export class NeuralNetwork {
  config: NetworkConfig;
  layers: DenseLayer[] = [];
  stepCount: number = 0;

  constructor(config: NetworkConfig) {
    this.config = config;
    this.buildNetwork();
  }

  buildNetwork(): void {
    this.layers = [];
    let currentIn = this.config.inputDim;

    this.config.layers.forEach((layerConf) => {
      const layer = new DenseLayer(layerConf.id, currentIn, layerConf.neurons, layerConf.activation);
      this.layers.push(layer);
      currentIn = layerConf.neurons;
    });
  }

  forward(X: Tensor2D): Tensor2D {
    let current = X;
    for (const layer of this.layers) {
      current = layer.forward(current);
    }
    return current;
  }

  // Computes Binary Cross Entropy Loss & returns Loss + Initial Gradient
  computeLoss(predictions: Tensor2D, targets: Tensor2D): { loss: number; dLoss: Tensor2D } {
    const batchSize = predictions.rows;
    let totalLoss = 0;
    const dLoss = new Tensor2D(predictions.rows, predictions.cols);
    const eps = 1e-7;

    for (let r = 0; r < batchSize; r++) {
      const p = Math.max(eps, Math.min(1 - eps, predictions.data[r][0]));
      const y = targets.data[r][0];

      // BCE: - [y * log(p) + (1-y) * log(1-p)]
      totalLoss += -(y * Math.log(p) + (1 - y) * Math.log(1 - p));

      // Derivative dL/dp = (p - y) / (p * (1 - p))
      dLoss.data[r][0] = (p - y) / (p * (1 - p));
    }

    return {
      loss: totalLoss / batchSize,
      dLoss
    };
  }

  // Train single batch epoch step
  trainStep(X: Tensor2D, Y: Tensor2D): { loss: number; accuracy: number } {
    this.stepCount++;

    // 1. Forward Pass
    const predictions = this.forward(X);

    // 2. Compute Loss & Initial dLoss
    const { loss, dLoss } = this.computeLoss(predictions, Y);

    // 3. Backward Pass
    let currentGradient = dLoss;
    for (let i = this.layers.length - 1; i >= 0; i--) {
      currentGradient = this.layers[i].backward(currentGradient);
    }

    // 4. Update Parameters
    for (const layer of this.layers) {
      layer.updateParams(
        this.config.learningRate,
        this.config.optimizer,
        this.config.l2Regularization,
        this.stepCount
      );
    }

    // 5. Calculate Accuracy
    let correct = 0;
    for (let r = 0; r < predictions.rows; r++) {
      const predLabel = predictions.data[r][0] >= 0.5 ? 1 : 0;
      const trueLabel = Y.data[r][0];
      if (predLabel === trueLabel) correct++;
    }

    return {
      loss,
      accuracy: Math.round((correct / predictions.rows) * 100)
    };
  }

  // Inspect gradient norms across layers for vanishing/exploding analysis
  inspectGradients(): GradientTraceNode[] {
    return this.layers.map((layer, idx) => {
      const wNorm = layer.weights.norm(true);
      const bNorm = layer.biases.norm(true);
      const actMean = layer.lastA ? layer.lastA.mean() : 0;

      let status: GradientTraceNode['status'] = 'NOMINAL';
      if (wNorm < 1e-5) status = 'VANISHING';
      else if (wNorm > 50) status = 'EXPLODING';

      return {
        layerIndex: idx + 1,
        layerName: `Layer ${idx + 1} (${layer.activation.toUpperCase()})`,
        weightGradNorm: parseFloat(wNorm.toFixed(6)),
        biasGradNorm: parseFloat(bNorm.toFixed(6)),
        activationMean: parseFloat(actMean.toFixed(4)),
        status
      };
    });
  }
}

/**
 * Synthetic 2D Datasets Generators
 */
export function generateSyntheticDataset(datasetType: DatasetType, sampleCount: number = 160): DataPoint[] {
  const points: DataPoint[] = [];

  for (let i = 0; i < sampleCount; i++) {
    let x = 0;
    let y = 0;
    let label = 0;

    if (datasetType === 'circles') {
      const r = Math.random();
      const theta = Math.random() * 2 * Math.PI;
      const isInner = Math.random() > 0.5;
      const radius = isInner ? r * 0.4 : 0.6 + r * 0.35;
      x = radius * Math.cos(theta);
      y = radius * Math.sin(theta);
      label = isInner ? 1 : 0;
    } else if (datasetType === 'spirals') {
      const n = sampleCount / 2;
      const isSpiral1 = i < n;
      const idx = isSpiral1 ? i : i - n;
      const r = (idx / n) * 0.8;
      const t = 1.25 * idx * (Math.PI / 16) + (isSpiral1 ? 0 : Math.PI);
      x = r * Math.sin(t) + (Math.random() - 0.5) * 0.08;
      y = r * Math.cos(t) + (Math.random() - 0.5) * 0.08;
      label = isSpiral1 ? 1 : 0;
    } else if (datasetType === 'xor') {
      x = (Math.random() - 0.5) * 1.6;
      y = (Math.random() - 0.5) * 1.6;
      label = (x > 0 && y > 0) || (x < 0 && y < 0) ? 1 : 0;
    } else if (datasetType === 'moons') {
      const isTopMoon = i < sampleCount / 2;
      const u = Math.random() * Math.PI;
      if (isTopMoon) {
        x = Math.cos(u) * 0.6 - 0.2;
        y = Math.sin(u) * 0.6 - 0.1;
        label = 1;
      } else {
        x = 0.4 - Math.cos(u) * 0.6;
        y = 0.1 - Math.sin(u) * 0.6;
        label = 0;
      }
      x += (Math.random() - 0.5) * 0.08;
      y += (Math.random() - 0.5) * 0.08;
    }

    points.push({ x: parseFloat(x.toFixed(3)), y: parseFloat(y.toFixed(3)), label });
  }

  return points;
}

/**
 * Convert DataPoint array into Tensor2D (X and Y matrices)
 */
export function datasetToTensors(dataset: DataPoint[]): { X: Tensor2D; Y: Tensor2D } {
  const X = new Tensor2D(dataset.length, 2);
  const Y = new Tensor2D(dataset.length, 1);

  dataset.forEach((pt, idx) => {
    X.data[idx][0] = pt.x;
    X.data[idx][1] = pt.y;
    Y.data[idx][0] = pt.label;
  });

  return { X, Y };
}

/**
 * Code Synthesizer Exporters
 */
export function generatePyTorchCode(config: NetworkConfig): string {
  const layerDefs = config.layers.map((l, i) => {
    const inDim = i === 0 ? config.inputDim : config.layers[i - 1].neurons;
    const actMap: Record<ActivationFunction, string> = {
      relu: 'nn.ReLU()',
      sigmoid: 'nn.Sigmoid()',
      tanh: 'nn.Tanh()',
      softmax: 'nn.Softmax(dim=1)',
      linear: 'nn.Identity()'
    };
    return `            nn.Linear(${inDim}, ${l.neurons}),\n            ${actMap[l.activation]}`;
  }).join(',\n');

  return `import torch
import torch.nn as nn
import torch.optim as optim

class SynapseNeuralNet(nn.Module):
    def __init__(self):
        super(SynapseNeuralNet, self).__init__()
        self.model = nn.Sequential(
${layerDefs}
        )

    def forward(self, x):
        return self.model(x)

# Initialize Model & Optimizer
model = SynapseNeuralNet()
optimizer = optim.${config.optimizer.toUpperCase()}(model.parameters(), lr=${config.learningRate}, weight_decay=${config.l2Regularization})
criterion = nn.BCELoss()

# Training Loop Demo
for epoch in range(100):
    optimizer.zero_grad()
    # x_batch, y_batch = load_data()
    # outputs = model(x_batch)
    # loss = criterion(outputs, y_batch)
    # loss.backward()
    # optimizer.step()
`;
}

export function generateTensorFlowCode(config: NetworkConfig): string {
  const layerLines = config.layers.map((l, i) => {
    if (i === 0) {
      return `  tf.keras.layers.Dense(${l.neurons}, input_shape=(${config.inputDim},), activation='${l.activation}'),`;
    }
    return `  tf.keras.layers.Dense(${l.neurons}, activation='${l.activation}'),`;
  }).join('\n');

  return `import tensorflow as tf

model = tf.keras.Sequential([
${layerLines}
])

model.compile(
  optimizer=tf.keras.optimizers.${config.optimizer === 'adam' ? 'Adam' : 'SGD'}(learning_rate=${config.learningRate}),
  loss='binary_crossentropy',
  metrics=['accuracy']
)

# model.fit(X_train, y_train, epochs=100, batch_size=32)
`;
}

export function generateJSMathCode(config: NetworkConfig): string {
  return `// SynapseFlow Procedural Matrix Forward Pass
function forwardPass(inputs) {
  // inputs: array of length ${config.inputDim}
  let current = inputs;
  
${config.layers.map((l, i) => `  // Layer ${i + 1} (${l.activation})
  current = applyDenseLayer(current, weights_L${i + 1}, biases_L${i + 1}, '${l.activation}');`).join('\n')}

  return current;
}

function applyDenseLayer(input, weights, biases, activation) {
  const output = [];
  for (let col = 0; col < weights[0].length; col++) {
    let sum = biases[col];
    for (let row = 0; row < input.length; row++) {
      sum += input[row] * weights[row][col];
    }
    if (activation === 'relu') output.push(Math.max(0, sum));
    else if (activation === 'sigmoid') output.push(1 / (1 + Math.exp(-sum)));
    else if (activation === 'tanh') output.push(Math.tanh(sum));
    else output.push(sum);
  }
  return output;
}
`;
}
