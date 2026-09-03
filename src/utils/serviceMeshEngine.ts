/**
 * SynapseFlow - Distributed Service Mesh & Microservices Architecture Engine
 * Handles service topology routing, load balancing, circuit breaker state transitions,
 * chaos fault injection, RPC telemetry calculation, and Docker/Kubernetes YAML generation.
 */

export type ServiceType = 'gateway' | 'microservice' | 'database' | 'cache' | 'eventbus';
export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';
export type LoadBalancePolicy = 'round_robin' | 'least_connections' | 'weighted_random';

export interface ServiceNodeConfig {
  id: string;
  name: string;
  type: ServiceType;
  replicas: number;
  cpuCores: number;
  memoryMb: number;
  port: number;
  rateLimitRps: number;
  circuitBreakerThreshold: number; // Consecutive error count before tripping
  color: string;
  description: string;
}

export interface RouteConfig {
  id: string;
  sourceServiceId: string;
  targetServiceId: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  loadPolicy: LoadBalancePolicy;
  retryAttempts: number;
}

export interface TrafficRequest {
  traceId: string;
  timestamp: string;
  sourceName: string;
  targetName: string;
  method: string;
  path: string;
  statusCode: number;
  latencyMs: number;
  circuitBreakerState: CircuitBreakerState;
  payload: Record<string, any>;
  isFaultInjected?: boolean;
}

export interface ChaosSettings {
  latencySpikeMs: number;
  http500FaultRatePercent: number;
  networkPartitionActive: boolean;
  crashedServiceId: string | null;
}

export interface ClusterTelemetry {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  circuitBreakerTrips: number;
  p95LatencyMs: number;
  currentRps: number;
  monthlyCostUsd: number;
}

export const DEFAULT_SERVICES: ServiceNodeConfig[] = [
  {
    id: 'svc-gateway',
    name: 'api-gateway-ingress',
    type: 'gateway',
    replicas: 3,
    cpuCores: 2,
    memoryMb: 2048,
    port: 8080,
    rateLimitRps: 500,
    circuitBreakerThreshold: 5,
    color: '#06b6d4', // cyan
    description: 'TLS Termination, Auth Token Verification & Ingress Proxy'
  },
  {
    id: 'svc-auth',
    name: 'auth-identity-svc',
    type: 'microservice',
    replicas: 2,
    cpuCores: 1,
    memoryMb: 1024,
    port: 4001,
    rateLimitRps: 200,
    circuitBreakerThreshold: 3,
    color: '#a855f7', // purple
    description: 'OAuth2 JWT Signing, Session Validation & RBAC Engine'
  },
  {
    id: 'svc-orders',
    name: 'order-processing-svc',
    type: 'microservice',
    replicas: 4,
    cpuCores: 2,
    memoryMb: 4096,
    port: 4002,
    rateLimitRps: 300,
    circuitBreakerThreshold: 4,
    color: '#10b981', // emerald
    description: 'Order State Machine, Inventory Allocation & Ledger Audit'
  },
  {
    id: 'svc-payment',
    name: 'payment-gateway-svc',
    type: 'microservice',
    replicas: 2,
    cpuCores: 2,
    memoryMb: 2048,
    port: 4003,
    rateLimitRps: 100,
    circuitBreakerThreshold: 2,
    color: '#f59e0b', // amber
    description: 'PCI-DSS Payment Authorization & Stripe Webhook Handler'
  },
  {
    id: 'svc-cache',
    name: 'redis-cluster-cache',
    type: 'cache',
    replicas: 3,
    cpuCores: 1,
    memoryMb: 2048,
    port: 6379,
    rateLimitRps: 2000,
    circuitBreakerThreshold: 10,
    color: '#ec4899', // pink
    description: 'In-Memory Key-Value Store & Distributed Rate Limit Counter'
  },
  {
    id: 'svc-db',
    name: 'postgres-primary-db',
    type: 'database',
    replicas: 2,
    cpuCores: 4,
    memoryMb: 8192,
    port: 5432,
    rateLimitRps: 1500,
    circuitBreakerThreshold: 8,
    color: '#3b82f6', // blue
    description: 'ACID Relational Storage & Read-Replica Synchronization'
  }
];

export const DEFAULT_ROUTES: RouteConfig[] = [
  {
    id: 'route-1',
    sourceServiceId: 'svc-gateway',
    targetServiceId: 'svc-auth',
    path: '/api/v1/auth/login',
    method: 'POST',
    loadPolicy: 'round_robin',
    retryAttempts: 2
  },
  {
    id: 'route-2',
    sourceServiceId: 'svc-gateway',
    targetServiceId: 'svc-orders',
    path: '/api/v1/orders/checkout',
    method: 'POST',
    loadPolicy: 'least_connections',
    retryAttempts: 3
  },
  {
    id: 'route-3',
    sourceServiceId: 'svc-orders',
    targetServiceId: 'svc-payment',
    path: '/internal/v1/charge',
    method: 'POST',
    loadPolicy: 'round_robin',
    retryAttempts: 1
  },
  {
    id: 'route-4',
    sourceServiceId: 'svc-orders',
    targetServiceId: 'svc-cache',
    path: '/cache/orders/session',
    method: 'GET',
    loadPolicy: 'weighted_random',
    retryAttempts: 2
  },
  {
    id: 'route-5',
    sourceServiceId: 'svc-orders',
    targetServiceId: 'svc-db',
    path: '/db/orders/insert',
    method: 'POST',
    loadPolicy: 'round_robin',
    retryAttempts: 3
  }
];

/**
 * Service Mesh Traffic Engine & Circuit Breaker Tracker
 */
export class ServiceMeshEngine {
  services: ServiceNodeConfig[];
  routes: RouteConfig[];
  chaos: ChaosSettings;

  circuitStates: Record<string, { state: CircuitBreakerState; consecutiveErrors: number }> = {};
  trafficHistory: TrafficRequest[] = [];

  constructor(services: ServiceNodeConfig[] = DEFAULT_SERVICES, routes: RouteConfig[] = DEFAULT_ROUTES) {
    this.services = services;
    this.routes = routes;
    this.chaos = {
      latencySpikeMs: 0,
      http500FaultRatePercent: 0,
      networkPartitionActive: false,
      crashedServiceId: null
    };

    // Initialize Circuit Breaker state table
    services.forEach(svc => {
      this.circuitStates[svc.id] = { state: 'CLOSED', consecutiveErrors: 0 };
    });
  }

  // Generate synthetic RPC traffic packet
  dispatchRequest(routeId?: string): TrafficRequest {
    const route = this.routes.find(r => r.id === routeId) || this.routes[Math.floor(Math.random() * this.routes.length)];
    const sourceSvc = this.services.find(s => s.id === route.sourceServiceId) || this.services[0];
    const targetSvc = this.services.find(s => s.id === route.targetServiceId) || this.services[1];

    const traceId = `trace-${Math.random().toString(36).substring(2, 9)}`;
    const nowStr = new Date().toLocaleTimeString();

    const cb = this.circuitStates[targetSvc.id] || { state: 'CLOSED', consecutiveErrors: 0 };

    // 1. Check Circuit Breaker status
    if (cb.state === 'OPEN') {
      return {
        traceId,
        timestamp: nowStr,
        sourceName: sourceSvc.name,
        targetName: targetSvc.name,
        method: route.method,
        path: route.path,
        statusCode: 503,
        latencyMs: 4,
        circuitBreakerState: 'OPEN',
        payload: { error: 'CIRCUIT_BREAKER_OPEN', message: `Target service ${targetSvc.name} circuit is tripped.` },
        isFaultInjected: true
      };
    }

    // 2. Check Crashed Service Fault
    if (this.chaos.crashedServiceId === targetSvc.id) {
      this.recordError(targetSvc.id, targetSvc.circuitBreakerThreshold);
      return {
        traceId,
        timestamp: nowStr,
        sourceName: sourceSvc.name,
        targetName: targetSvc.name,
        method: route.method,
        path: route.path,
        statusCode: 502,
        latencyMs: 12,
        circuitBreakerState: this.circuitStates[targetSvc.id].state,
        payload: { error: 'POD_CRASHED', message: `Connection refused to crashed pod: ${targetSvc.name}` },
        isFaultInjected: true
      };
    }

    // 3. Check Network Partition Fault
    if (this.chaos.networkPartitionActive && sourceSvc.type === 'gateway' && targetSvc.type === 'database') {
      return {
        traceId,
        timestamp: nowStr,
        sourceName: sourceSvc.name,
        targetName: targetSvc.name,
        method: route.method,
        path: route.path,
        statusCode: 504,
        latencyMs: 1200 + this.chaos.latencySpikeMs,
        circuitBreakerState: cb.state,
        payload: { error: 'NETWORK_PARTITION_TIMEOUT', message: 'Ingress subnet disconnected from DB rack.' },
        isFaultInjected: true
      };
    }

    // 4. Check HTTP 500 Chaos Injection
    const isFault = Math.random() * 100 < this.chaos.http500FaultRatePercent;
    let statusCode = 200;
    let computedLatency = 12 + Math.floor(Math.random() * 35) + this.chaos.latencySpikeMs;
    let payload: Record<string, any> = {};

    if (isFault) {
      statusCode = 500;
      this.recordError(targetSvc.id, targetSvc.circuitBreakerThreshold);
      payload = { error: 'CHAOS_HTTP_500', message: 'Injected synthetic internal server error.' };
    } else {
      this.recordSuccess(targetSvc.id);
      if (route.method === 'POST') statusCode = 201;
      payload = {
        status: 'SUCCESS',
        traceId,
        processedBy: `${targetSvc.name}-pod-${Math.floor(1 + Math.random() * targetSvc.replicas)}`,
        bytesTransferred: 1420
      };
    }

    const req: TrafficRequest = {
      traceId,
      timestamp: nowStr,
      sourceName: sourceSvc.name,
      targetName: targetSvc.name,
      method: route.method,
      path: route.path,
      statusCode,
      latencyMs: computedLatency,
      circuitBreakerState: this.circuitStates[targetSvc.id].state,
      payload,
      isFaultInjected: isFault || this.chaos.latencySpikeMs > 0
    };

    this.trafficHistory.unshift(req);
    if (this.trafficHistory.length > 60) this.trafficHistory.pop();

    return req;
  }

  recordError(svcId: string, threshold: number): void {
    const cb = this.circuitStates[svcId] || { state: 'CLOSED', consecutiveErrors: 0 };
    cb.consecutiveErrors++;
    if (cb.consecutiveErrors >= threshold) {
      cb.state = 'OPEN';
    }
    this.circuitStates[svcId] = cb;
  }

  recordSuccess(svcId: string): void {
    const cb = this.circuitStates[svcId] || { state: 'CLOSED', consecutiveErrors: 0 };
    if (cb.state === 'HALF_OPEN') {
      cb.state = 'CLOSED';
      cb.consecutiveErrors = 0;
    } else if (cb.state === 'CLOSED') {
      cb.consecutiveErrors = Math.max(0, cb.consecutiveErrors - 1);
    }
    this.circuitStates[svcId] = cb;
  }

  resetCircuitBreaker(svcId: string): void {
    this.circuitStates[svcId] = { state: 'CLOSED', consecutiveErrors: 0 };
  }

  // Calculate cluster-wide metrics
  getTelemetry(): ClusterTelemetry {
    const total = this.trafficHistory.length;
    if (total === 0) {
      return {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        circuitBreakerTrips: 0,
        p95LatencyMs: 0,
        currentRps: 0,
        monthlyCostUsd: this.calculateMonthlyCost()
      };
    }

    const successful = this.trafficHistory.filter(t => t.statusCode >= 200 && t.statusCode < 400).length;
    const failed = total - successful;
    const trips = Object.values(this.circuitStates).filter(cb => cb.state === 'OPEN').length;

    const latencies = this.trafficHistory.map(t => t.latencyMs).sort((a, b) => a - b);
    const p95Idx = Math.floor(latencies.length * 0.95);
    const p95LatencyMs = latencies[p95Idx] || 0;

    return {
      totalRequests: total,
      successfulRequests: successful,
      failedRequests: failed,
      circuitBreakerTrips: trips,
      p95LatencyMs,
      currentRps: Math.round(15 + Math.random() * 25),
      monthlyCostUsd: this.calculateMonthlyCost()
    };
  }

  calculateMonthlyCost(): number {
    let totalCost = 0;
    this.services.forEach(svc => {
      // $15/month per replica + $8 per CPU core + $4 per GB RAM
      const svcCost = (15 * svc.replicas) + (8 * svc.cpuCores * svc.replicas) + (4 * (svc.memoryMb / 1024) * svc.replicas);
      totalCost += svcCost;
    });
    return Math.round(totalCost);
  }
}

/**
 * Docker Compose & Kubernetes Manifest Exporters
 */
export function generateDockerComposeYaml(services: ServiceNodeConfig[]): string {
  const serviceBlocks = services.map(svc => {
    return `  ${svc.name}:
    image: synapseflow/${svc.name}:v1.2.0
    container_name: ${svc.name}
    ports:
      - "${svc.port}:${svc.port}"
    environment:
      - NODE_ENV=production
      - PORT=${svc.port}
      - RATE_LIMIT_RPS=${svc.rateLimitRps}
    deploy:
      replicas: ${svc.replicas}
      resources:
        limits:
          cpus: '${svc.cpuCores}'
          memory: ${svc.memoryMb}M`;
  }).join('\n\n');

  return `version: '3.8'

services:
${serviceBlocks}

networks:
  default:
    name: synapse-mesh-network
`;
}

export function generateKubernetesManifests(services: ServiceNodeConfig[]): string {
  return services.map(svc => `---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${svc.name}
  labels:
    app: ${svc.name}
    tier: ${svc.type}
spec:
  replicas: ${svc.replicas}
  selector:
    matchLabels:
      app: ${svc.name}
  template:
    metadata:
      labels:
        app: ${svc.name}
    spec:
      containers:
      - name: ${svc.name}
        image: synapseflow/${svc.name}:v1.2.0
        ports:
        - containerPort: ${svc.port}
        resources:
          requests:
            cpu: "${svc.cpuCores * 0.5}"
            memory: "${svc.memoryMb / 2}Mi"
          limits:
            cpu: "${svc.cpuCores}"
            memory: "${svc.memoryMb}Mi"
---
apiVersion: v1
kind: Service
metadata:
  name: ${svc.name}-svc
spec:
  type: ClusterIP
  ports:
  - port: ${svc.port}
    targetPort: ${svc.port}
  selector:
    app: ${svc.name}
`).join('\n');
}

export function generateExpressBoilerplate(services: ServiceNodeConfig[]): string {
  const gateway = services.find(s => s.type === 'gateway') || services[0];
  return `import express from 'express';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app = express();
const PORT = process.env.PORT || ${gateway.port};

app.use(cors());
app.use(express.json());

// Ingress Rate Limiting Middleware
const rateLimitWindowMs = 60 * 1000;
const maxRequests = ${gateway.rateLimitRps};

app.use((req, res, next) => {
  // Rate limit counter implementation...
  next();
});

// Dynamic Proxy Microservice Routing Table
${services.filter(s => s.type !== 'gateway').map(s => `app.use('/api/v1/${s.name.replace('-svc', '')}', createProxyMiddleware({
  target: 'http://${s.name}-svc:${s.port}',
  changeOrigin: true,
  pathRewrite: { '^/api/v1/${s.name.replace('-svc', '')}': '' }
}));`).join('\n')}

app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'UP', service: '${gateway.name}', timestamp: new Date() });
});

app.listen(PORT, () => {
  console.log(\`[ServiceMesh] Ingress Gateway listening on port \${PORT}\`);
});
`;
}
