import { alignToNextMultiple } from "../utilities/Utilities.js"

export class ArrayBufferArenaAllocator {
	heap: ArrayBuffer
	alignmentConstant: number
	currentAllocationAddress: number

	constructor(initialCapacity = 2 ** 16, alignmentConstant = 8) {
		this.heap = new ArrayBuffer(initialCapacity)
		this.alignmentConstant = alignmentConstant
		this.currentAllocationAddress = alignmentConstant
	}

	allocate(requestedByteSize: number) {
		const startAddress = this.currentAllocationAddress

		let endAddress = startAddress + Math.ceil(requestedByteSize)
		endAddress = alignToNextMultiple(endAddress, this.alignmentConstant)

		if (endAddress > this.capacity) {
			const largerHeap = new ArrayBuffer(endAddress * 2);

			(new Uint8Array(largerHeap)).set(new Uint8Array(this.heap))

			this.heap = largerHeap
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
}
