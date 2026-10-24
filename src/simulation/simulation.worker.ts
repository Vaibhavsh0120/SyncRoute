import { createSimulationWorkerRuntime } from './workerRuntime'
import type { SimulationWorkerRequest } from './workerProtocol'

const runtime = createSimulationWorkerRuntime()
self.onmessage = (event: MessageEvent<SimulationWorkerRequest>) => {
  self.postMessage(runtime.handle(event.data))
}
