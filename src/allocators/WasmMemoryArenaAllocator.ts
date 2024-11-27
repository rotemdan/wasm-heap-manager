import { alignToNextMultiple } from "../utilities/Utilities.js"

export class WasmMemoryArenaAllocator {
	wasmMemory: WebAssembly.Memory
	alignmentConstant: number
	currentAllocationAddress: number

	constructor(wasmMemory: WebAssembly.Memory, alignmentConstant = 8) {
		this.wasmMemory = wasmMemory
		this.alignmentConstant = alignmentConstant
		this.currentAllocationAddress = alignmentConstant
	}

	allocate(requestedByteSize: number) {
		const startAddress = this.currentAllocationAddress

		let endAddress = startAddress + Math.ceil(requestedByteSize)
		endAddress = alignToNextMultiple(endAddress, this.alignmentConstant)

		// Grow memory if needed
		if (endAddress > this.capacity) {
			const additionalRequiredCapacity = endAddress - this.capacity
			const additionalRequiredPages = Math.ceil(additionalRequiredCapacity / (2 ** 16)) + 1

			try {
				this.wasmMemory.grow(additionalRequiredPages)

				console.log(`Memory grown to ${this.capacity} bytes`)
			} catch (e) {
				throw new Error(`Couldn't grow wasm memory capacity from ${this.capacity} bytes to ${this.capacity + additionalRequiredCapacity} bytes`)
			}
		}

		// Update and return address
		this.currentAllocationAddress = endAddress

		return startAddress
	}

	deallocate() {
		// Do nothing. It never frees memory.
	}

	reset() {
		this.currentAllocationAddress = this.alignmentConstant
	}

	get capacity() {
		return this.heap.byteLength
	}

	get capacityPages() {
		return this.capacity / (2 ** 16)
	}

	get heap() {
		return this.wasmMemory.buffer
	}
}
