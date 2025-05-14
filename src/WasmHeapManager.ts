import { TypedArray } from './utilities/TypedArray.js'
import { decodeUtf8, encodeUtf8, encodeUtf8Into } from './encodings/Utf8.js'
import { IEEE754Converter } from './utilities/IEEE754Converter.js'
import { decodeAscii, encodeAsciiInto } from './encodings/Ascii.js'
import { decodeUtf16, encodeUtf16Into } from './encodings/Utf16.js'
import { decodeUtf32, encodeUtf32Into } from './encodings/Utf32.js'
import { isNumber } from './utilities/Utilities.js'

export function createWasmHeapManager(
	heapGetter: HeapGetterCallback,
	allocateMethod: AllocatorMethod,
	deallocateMethod: DeallocatorMethod,
	options?: WasmHeapManagerOptions) {

	return new WasmHeapManager(heapGetter, allocateMethod, deallocateMethod, options)
}

export function wrapEmscriptenModuleHeap(emscriptenModule: any, options?: WasmHeapManagerOptions) {
	if (typeof emscriptenModule !== 'object') {
		throw new Error(`The given Emscripten module is undefined, null, or not an object`)
	}

	if (!emscriptenModule.HEAPU8) {
		throw new Error(`Couldn't find a 'HEAPU8' property in the given Emscripten module.`)
	}

	if (!emscriptenModule._malloc) {
		throw new Error(`Couldn't find a '_malloc' method in the Emscripten module. Please ensure it's set to be exported when the Emscripten module is compiled.`)
	}

	if (!emscriptenModule._free) {
		throw new Error(`Couldn't find a '_free' method in the Emscripten module. Please ensure it's set to be exported when the Emscripten module is compiled.`)
	}

	return new WasmHeapManager(
		() => emscriptenModule.HEAPU8.buffer,
		emscriptenModule._malloc,
		emscriptenModule._free,
		options
	)
}

////////////////////////////////////////////////////////////////////////////////////////////////////
// Heap manager class
////////////////////////////////////////////////////////////////////////////////////////////////////
export class WasmHeapManager {
	private cachedHeap!: ArrayBuffer | SharedArrayBuffer

	private cachedHeapInt8!: Int8Array
	private cachedHeapUint8!: Uint8Array
	private cachedHeapUint8Clamped!: Uint8ClampedArray

	private cachedHeapInt16!: Int16Array
	private cachedHeapUint16!: Uint16Array

	private cachedHeapInt32!: Int32Array
	private cachedHeapUint32!: Uint32Array

	private cachedHeapBigInt64!: BigInt64Array
	private cachedHeapBigUint64!: BigUint64Array

	private cachedHeapFloat32!: Float32Array
	private cachedHeapFloat64!: Float64Array

	private ieee754Converter = new IEEE754Converter()

	private finalizationRegistry: FinalizationRegistry<number>

	private options: WasmHeapManagerOptions

	constructor(
		public readonly heapGetter: HeapGetterCallback,
		public readonly allocate: AllocatorMethod,
		public readonly deallocate: DeallocatorMethod,
		options?: WasmHeapManagerOptions) {

		this.options = { ...defaultWasmHeapManagerOptions, ...(options || {}) }

		this.finalizationRegistry = new FinalizationRegistry<number>((address) => {
			this.deallocate(address)

			console.log(`Deallocated at address ${address}`)
		})

		this.updateCache(heapGetter())
	}

	////////////////////////////////////////////////////////////////////////////////////////////////////
	// Allocate and wrap numeric values and arrays
	////////////////////////////////////////////////////////////////////////////////////////////////////

	////////////////////////////////////////////////////////////////////////////////////////////////////
	// Int8
	////////////////////////////////////////////////////////////////////////////////////////////////////
	readInt8(address: number) {
		return this.heapInt8[address]
	}

	readInt8Atomic(address: number) {
		return Atomics.load(this.heapInt8, address)
	}

	writeInt8(address: number, value: number) {
		this.heapInt8[address] = value
	}

	writeInt8Atomic(address: number, value: number) {
		Atomics.store(this.heapInt8, address, value)
	}

	allocInt8(initialValue?: number) {
		const address = this.alloc(1)

		const ref = this.wrapInt8(address)

		if (initialValue !== undefined) {
			ref.write(initialValue)
		}

		this.registerFinalizerIfEnabled(ref)

		return ref
	}

	wrapInt8(address: number) {
		const ref = new Int8Ref(address, this)

		return ref
	}

	viewInt8Array(address: number, elementCount: number) {
		return this.heapInt8.subarray(address, address + elementCount)
	}

	allocInt8Array(elementCount: number): Int8ArrayRef
	allocInt8Array(elements: Int8Array): Int8ArrayRef
	allocInt8Array(countOrElements: number | Int8Array) {
		let ref: Int8ArrayRef

		if (isNumber(countOrElements)) {
			const elementCount = countOrElements

			const address = this.alloc(elementCount)

			ref = this.wrapInt8Array(address, elementCount)
		} else {
			const elements = countOrElements
			const elementCount = elements.length

			ref = this.allocInt8Array(elementCount)

			ref.view.set(elements)
		}

		this.registerFinalizerIfEnabled(ref)

		return ref
	}

	wrapInt8Array(address: number, elementCount: number) {
		const ref = new Int8ArrayRef(address, elementCount, this)

		return ref
	}

	////////////////////////////////////////////////////////////////////////////////////////////////////
	// Uint8
	////////////////////////////////////////////////////////////////////////////////////////////////////
	readUint8(address: number) {
		return this.heapUint8[address]
	}

	readUint8Atomic(address: number) {
		return Atomics.load(this.heapUint8, address)
	}

	writeUint8(address: number, value: number) {
		this.heapUint8[address] = value
	}

	writeUint8Atomic(address: number, value: number) {
		Atomics.store(this.heapUint8, address, value)
	}

	allocUint8(initialValue?: number) {
		const address = this.alloc(1)

		const ref = this.wrapUint8(address)

		if (initialValue !== undefined) {
			ref.write(initialValue)
		}

		this.registerFinalizerIfEnabled(ref)

		return ref
	}

	wrapUint8(address: number) {
		const ref = new Uint8Ref(address, this)

		return ref
	}

	viewUint8Array(address: number, elementCount: number) {
		return this.heapUint8.subarray(address, address + elementCount)
	}

	allocUint8Array(elementCount: number): Uint8ArrayRef
	allocUint8Array(elements: Uint8Array): Uint8ArrayRef
	allocUint8Array(countOrElements: number | Uint8Array) {
		let ref: Uint8ArrayRef

		if (isNumber(countOrElements)) {
			const elementCount = countOrElements

			const address = this.alloc(elementCount)

			ref = this.wrapUint8Array(address, elementCount)
		} else {
			const elements = countOrElements
			const elementCount = elements.length

			ref = this.allocUint8Array(elementCount)

			ref.view.set(elements)
		}

		this.registerFinalizerIfEnabled(ref)

		return ref
	}

	wrapUint8Array(address: number, elementCount: number) {
		const ref = new Uint8ArrayRef(address, elementCount, this)

		return ref
	}

	////////////////////////////////////////////////////////////////////////////////////////////////////
	// Uint8Clamped
	////////////////////////////////////////////////////////////////////////////////////////////////////
	readUint8Clamped(address: number) {
		return this.heapUint8Clamped[address]
	}

	readUint8ClampedAtomic(address: number) {
		return this.readUint8Atomic(address)
	}

	writeUint8Clamped(address: number, value: number) {
		this.heapUint8Clamped[address] = value
	}

	writeUint8ClampedAtomic(address: number, value: number) {
		if (value < 0) {
			value = 0
		} else if (value > 255) {
			value = 255
		}

		this.writeUint8Atomic(address, value)
	}

	allocUint8Clamped(initialValue?: number) {
		const address = this.alloc(1)

		const ref = this.wrapUint8Clamped(address)

		if (initialValue !== undefined) {
			ref.write(initialValue)
		}

		this.registerFinalizerIfEnabled(ref)

		return ref
	}

	wrapUint8Clamped(address: number) {
		const ref = new Uint8ClampedRef(address, this)

		return ref
	}

	viewUint8ClampedArray(address: number, elementCount: number) {
		return this.heapUint8Clamped.subarray(address, address + elementCount)
	}

	allocUint8ClampedArray(elementCount: number): Uint8ClampedArrayRef
	allocUint8ClampedArray(elements: Uint8ClampedArray): Uint8ClampedArrayRef
	allocUint8ClampedArray(countOrElements: number | Uint8ClampedArray) {
		let ref: Uint8ClampedArrayRef

		if (isNumber(countOrElements)) {
			const elementCount = countOrElements

			const address = this.alloc(elementCount)

			ref = this.wrapUint8ClampedArray(address, elementCount)
		} else {
			const elements = countOrElements
			const elementCount = elements.length

			ref = this.allocUint8ClampedArray(elementCount)

			ref.view.set(elements)
		}

		this.registerFinalizerIfEnabled(ref)

		return ref
	}

	wrapUint8ClampedArray(address: number, elementCount: number) {
		const ref = new Uint8ClampedArrayRef(address, elementCount, this)

		return ref
	}

	////////////////////////////////////////////////////////////////////////////////////////////////////
	// Int16
	////////////////////////////////////////////////////////////////////////////////////////////////////
	readInt16(address: number) {
		return this.heapInt16[address / 2]
	}

	readInt16Atomic(address: number) {
		return Atomics.load(this.heapInt16, address / 2)
	}

	writeInt16(address: number, value: number) {
		this.heapInt16[address / 2] = value
	}

	writeInt16Atomic(address: number, value: number) {
		Atomics.store(this.heapInt16, address / 2, value)
	}

	allocInt16(initialValue?: number) {
		const address = this.alloc(2)

		const ref = this.wrapInt16(address)

		if (initialValue !== undefined) {
			ref.write(initialValue)
		}

		this.registerFinalizerIfEnabled(ref)

		return ref
	}

	wrapInt16(address: number) {
		const ref = new Int16Ref(address, this)

		return ref
	}

	viewInt16Array(address: number, elementCount: number) {
		const startIndex = address / 2
		const endIndex = startIndex + elementCount

		return this.heapInt16.subarray(startIndex, endIndex)
	}

	allocInt16Array(elementCount: number): Int16ArrayRef
	allocInt16Array(elements: Int16Array): Int16ArrayRef
	allocInt16Array(countOrElements: number | Int16Array) {
		let ref: Int16ArrayRef

		if (isNumber(countOrElements)) {
			const elementCount = countOrElements

			const address = this.alloc(elementCount * 2)

			ref = this.wrapInt16Array(address, elementCount)
		} else {
			const elements = countOrElements
			const elementCount = elements.length

			ref = this.allocInt16Array(elementCount)

			ref.view.set(elements)
		}

		this.registerFinalizerIfEnabled(ref)

		return ref
	}

	wrapInt16Array(address: number, elementCount: number) {
		const ref = new Int16ArrayRef(address, elementCount, this)

		return ref
	}

	////////////////////////////////////////////////////////////////////////////////////////////////////
	// Uint16
	////////////////////////////////////////////////////////////////////////////////////////////////////
	readUint16(address: number) {
		return this.heapUint16[address / 2]
	}

	readUint16Atomic(address: number) {
		return Atomics.load(this.heapUint16, address / 2)
	}

	writeUint16(address: number, value: number) {
		this.heapUint16[address / 2] = value
	}

	writeUint16Atomic(address: number, value: number) {
		Atomics.store(this.heapUint16, address / 2, value)
	}

	allocUint16(initialValue?: number) {
		const address = this.alloc(2)

		const ref = this.wrapUint16(address)

		if (initialValue !== undefined) {
			ref.write(initialValue)
		}

		this.registerFinalizerIfEnabled(ref)

		return ref
	}

	wrapUint16(address: number) {
		const ref = new Uint16Ref(address, this)

		return ref
	}

	viewUint16Array(address: number, elementCount: number) {
		const startIndex = address / 2
		const endIndex = startIndex + elementCount

		return this.heapUint16.subarray(startIndex, endIndex)
	}

	allocUint16Array(elementCount: number): Uint16ArrayRef
	allocUint16Array(elements: Uint16Array): Uint16ArrayRef
	allocUint16Array(countOrElements: number | Uint16Array) {
		let ref: Uint16ArrayRef

		if (isNumber(countOrElements)) {
			const elementCount = countOrElements

			const address = this.alloc(elementCount * 2)

			ref = this.wrapUint16Array(address, elementCount)
		} else {
			const elements = countOrElements
			const elementCount = elements.length

			ref = this.allocUint16Array(elementCount)

			ref.view.set(elements)
		}

		this.registerFinalizerIfEnabled(ref)

		return ref
	}

	wrapUint16Array(address: number, elementCount: number) {
		const ref = new Uint16ArrayRef(address, elementCount, this)

		return ref
	}

	////////////////////////////////////////////////////////////////////////////////////////////////////
	// Int32
	////////////////////////////////////////////////////////////////////////////////////////////////////
	readInt32(address: number) {
		return this.heapInt32[address / 4]
	}

	readInt32Atomic(address: number) {
		return Atomics.load(this.heapInt32, address / 4)
	}

	writeInt32(address: number, value: number) {
		this.heapInt32[address / 4] = value
	}

	writeInt32Atomic(address: number, value: number) {
		Atomics.store(this.heapInt32, address / 4, value)
	}

	allocInt32(initialValue?: number) {
		const address = this.alloc(4)

		const ref = this.wrapInt32(address)

		if (initialValue !== undefined) {
			ref.write(initialValue)
		}

		this.registerFinalizerIfEnabled(ref)

		return ref
	}

	wrapInt32(address: number) {
		const ref = new Int32Ref(address, this)

		return ref
	}

	viewInt32Array(address: number, elementCount: number) {
		const startIndex = address / 4
		const endIndex = startIndex + elementCount

		return this.heapInt32.subarray(startIndex, endIndex)
	}

	allocInt32Array(elementCount: number): Int32ArrayRef
	allocInt32Array(elements: Int32Array): Int32ArrayRef
	allocInt32Array(countOrElements: number | Int32Array) {
		let ref: Int32ArrayRef

		if (isNumber(countOrElements)) {
			const elementCount = countOrElements

			const address = this.alloc(elementCount * 4)

			ref = this.wrapInt32Array(address, elementCount)
		} else {
			const elements = countOrElements
			const elementCount = elements.length

			ref = this.allocInt32Array(elementCount)

			ref.view.set(elements)
		}

		this.registerFinalizerIfEnabled(ref)

		return ref
	}

	wrapInt32Array(address: number, elementCount: number) {
		const ref = new Int32ArrayRef(address, elementCount, this)

		return ref
	}

	////////////////////////////////////////////////////////////////////////////////////////////////////
	// Uint32
	////////////////////////////////////////////////////////////////////////////////////////////////////
	readUint32(address: number) {
		return this.heapUint32[address / 4]
	}

	readUint32Atomic(address: number) {
		return Atomics.load(this.heapUint32, address / 4)
	}

	writeUint32(address: number, value: number) {
		this.heapUint32[address / 4] = value
	}

	writeUint32Atomic(address: number, value: number) {
		Atomics.store(this.heapUint32, address / 4, value)
	}

	allocUint32(initialValue?: number) {
		const address = this.alloc(4)

		const ref = this.wrapUint32(address)

		if (initialValue !== undefined) {
			ref.write(initialValue)
		}

		this.registerFinalizerIfEnabled(ref)

		return ref
	}

	wrapUint32(address: number) {
		const ref = new Uint32Ref(address, this)

		return ref
	}

	viewUint32Array(address: number, elementCount: number) {
		const startIndex = address / 4
		const endIndex = startIndex + elementCount

		return this.heapUint32.subarray(startIndex, endIndex)
	}

	allocUint32Array(elementCount: number): Uint32ArrayRef
	allocUint32Array(elements: Uint32Array): Uint32ArrayRef
	allocUint32Array(countOrElements: number | Uint32Array) {
		let ref: Uint32ArrayRef

		if (isNumber(countOrElements)) {
			const elementCount = countOrElements

			const address = this.alloc(elementCount * 4)

			ref = this.wrapUint32Array(address, elementCount)
		} else {
			const elements = countOrElements
			const elementCount = elements.length

			ref = this.allocUint32Array(elementCount)

			ref.view.set(elements)
		}

		this.registerFinalizerIfEnabled(ref)

		return ref
	}

	wrapUint32Array(address: number, elementCount: number) {
		const ref = new Uint32ArrayRef(address, elementCount, this)

		return ref
	}

	////////////////////////////////////////////////////////////////////////////////////////////////////
	// BigInt64
	////////////////////////////////////////////////////////////////////////////////////////////////////
	readBigInt64(address: number) {
		return this.heapBigInt64[address / 8]
	}

	readBigInt64Atomic(address: number) {
		return Atomics.load(this.heapBigInt64, address / 8)
	}

	writeBigInt64(address: number, value: bigint) {
		this.heapBigInt64[address / 8] = value
	}

	writeBigInt64Atomic(address: number, value: bigint) {
		Atomics.store(this.heapBigInt64 as any, address / 8, value)
	}

	allocBigInt64(initialValue?: bigint) {
		const address = this.alloc(8)

		const ref = this.wrapBigInt64(address)

		if (initialValue !== undefined) {
			ref.write(initialValue)
		}

		this.registerFinalizerIfEnabled(ref)

		return ref
	}

	wrapBigInt64(address: number) {
		const ref = new BigInt64Ref(address, this)

		return ref
	}

	viewBigInt64Array(address: number, elementCount: number) {
		const startIndex = address / 8
		const endIndex = startIndex + elementCount

		return this.heapBigInt64.subarray(startIndex, endIndex)
	}

	allocBigInt64Array(elementCount: number): BigInt64ArrayRef
	allocBigInt64Array(elements: BigInt64Array): BigInt64ArrayRef
	allocBigInt64Array(countOrElements: number | BigInt64Array) {
		let ref: BigInt64ArrayRef

		if (isNumber(countOrElements)) {
			const elementCount = countOrElements

			const address = this.alloc(elementCount * 8)

			ref = this.wrapBigInt64Array(address, elementCount)
		} else {
			const elements = countOrElements
			const elementCount = elements.length

			ref = this.allocBigInt64Array(elementCount)

			ref.view.set(elements)
		}

		this.registerFinalizerIfEnabled(ref)

		return ref
	}

	wrapBigInt64Array(address: number, elementCount: number) {
		const ref = new BigInt64ArrayRef(address, elementCount, this)

		return ref
	}

	////////////////////////////////////////////////////////////////////////////////////////////////////
	// BigUint64
	////////////////////////////////////////////////////////////////////////////////////////////////////
	readBigUint64(address: number) {
		return this.heapBigUint64[address / 8]
	}

	readBigUint64Atomic(address: number) {
		return Atomics.load(this.heapBigUint64, address / 8)
	}

	writeBigUint64(address: number, value: bigint) {
		this.heapBigUint64[address / 8] = value
	}

	writeBigUint64Atomic(address: number, value: bigint) {
		Atomics.store(this.heapBigUint64 as any, address / 8, value)
	}

	allocBigUint64(initialValue?: bigint) {
		const address = this.alloc(8)

		const ref = this.wrapBigUint64(address)

		if (initialValue !== undefined) {
			ref.write(initialValue)
		}

		this.registerFinalizerIfEnabled(ref)

		return ref
	}

	wrapBigUint64(address: number) {
		const ref = new BigUint64Ref(address, this)

		return ref
	}

	viewBigUint64Array(address: number, elementCount: number) {
		const startIndex = address / 8
		const endIndex = startIndex + elementCount

		return this.heapBigUint64.subarray(startIndex, endIndex)
	}

	allocBigUint64Array(elementCount: number): BigUint64ArrayRef
	allocBigUint64Array(elements: BigUint64Array): BigUint64ArrayRef
	allocBigUint64Array(countOrElements: number | BigUint64Array) {
		let ref: BigUint64ArrayRef

		if (isNumber(countOrElements)) {
			const elementCount = countOrElements

			const address = this.alloc(elementCount * 8)

			ref = this.wrapBigUint64Array(address, elementCount)
		} else {
			const elements = countOrElements
			const elementCount = elements.length

			ref = this.allocBigUint64Array(elementCount)

			ref.view.set(elements)
		}

		this.registerFinalizerIfEnabled(ref)

		return ref
	}

	wrapBigUint64Array(address: number, elementCount: number) {
		const ref = new BigUint64ArrayRef(address, elementCount, this)

		return ref
	}

	////////////////////////////////////////////////////////////////////////////////////////////////////
	// Float32
	////////////////////////////////////////////////////////////////////////////////////////////////////
	readFloat32(address: number) {
		return this.heapFloat32[address / 4]
	}

	readFloat32Atomic(address: number) {
		const uint32Value = this.readUint32Atomic(address)
		const float32Value = this.ieee754Converter.uint32ToFloat32(uint32Value)

		return float32Value
	}

	writeFloat32(address: number, value: number) {
		this.heapFloat32[address / 4] = value
	}

	writeFloat32Atomic(address: number, value: number) {
		const float32Value = value
		const uint32Value = this.ieee754Converter.float32ToUint32(float32Value)

		this.writeUint32Atomic(address, uint32Value)
	}

	allocFloat32(initialValue?: number) {
		const address = this.alloc(4)

		const ref = this.wrapFloat32(address)

		if (initialValue !== undefined) {
			ref.write(initialValue)
		}

		this.registerFinalizerIfEnabled(ref)

		return ref
	}

	wrapFloat32(address: number) {
		const ref = new Float32Ref(address, this)

		return ref
	}

	viewFloat32Array(address: number, elementCount: number) {
		const startIndex = address / 4
		const endIndex = startIndex + elementCount

		return this.heapFloat32.subarray(startIndex, endIndex)
	}

	allocFloat32Array(elementCount: number): Float32ArrayRef
	allocFloat32Array(elements: Float32Array): Float32ArrayRef
	allocFloat32Array(countOrElements: number | Float32Array) {
		let ref: Float32ArrayRef

		if (isNumber(countOrElements)) {
			const elementCount = countOrElements

			const address = this.alloc(elementCount * 4)

			ref = this.wrapFloat32Array(address, elementCount)
		} else {
			const elements = countOrElements
			const elementCount = elements.length

			ref = this.allocFloat32Array(elementCount)

			ref.view.set(elements)
		}

		this.registerFinalizerIfEnabled(ref)

		return ref
	}

	wrapFloat32Array(address: number, elementCount: number) {
		const ref = new Float32ArrayRef(address, elementCount, this)

		return ref
	}

	////////////////////////////////////////////////////////////////////////////////////////////////////
	// Float64
	////////////////////////////////////////////////////////////////////////////////////////////////////
	readFloat64(address: number) {
		return this.heapFloat64[address / 8]
	}

	readFloat64Atomic(address: number) {
		const bitUint64Value = this.readBigUint64Atomic(address)
		const float64Value = this.ieee754Converter.bigUint64ToFloat64(bitUint64Value)

		return float64Value
	}

	writeFloat64(address: number, value: number) {
		this.heapFloat64[address / 8] = value
	}

	writeFloat64Atomic(address: number, value: number) {
		const float64Value = value
		const bigUint64Value = this.ieee754Converter.float64ToBigUint64(float64Value)

		this.writeBigUint64Atomic(address, bigUint64Value)
	}

	allocFloat64(initialValue?: number) {
		const address = this.alloc(8)

		const ref = this.wrapFloat64(address)

		if (initialValue !== undefined) {
			ref.write(initialValue)
		}

		this.registerFinalizerIfEnabled(ref)

		return ref
	}

	wrapFloat64(address: number) {
		const ref = new Float64Ref(address, this)

		return ref
	}

	viewFloat64Array(address: number, elementCount: number) {
		const startIndex = address / 8
		const endIndex = startIndex + elementCount

		return this.heapFloat64.subarray(startIndex, endIndex)
	}

	allocFloat64Array(elementCount: number): Float64ArrayRef
	allocFloat64Array(elements: Float64Array): Float64ArrayRef
	allocFloat64Array(countOrElements: number | Float64Array) {
		let ref: Float64ArrayRef

		if (isNumber(countOrElements)) {
			const elementCount = countOrElements

			const address = this.alloc(elementCount * 8)

			ref = this.wrapFloat64Array(address, elementCount)
		} else {
			const elements = countOrElements
			const elementCount = elements.length

			ref = this.allocFloat64Array(elementCount)

			ref.view.set(elements)
		}

		this.registerFinalizerIfEnabled(ref)

		return ref
	}

	wrapFloat64Array(address: number, elementCount: number) {
		const ref = new Float64ArrayRef(address, elementCount, this)

		return ref
	}

	////////////////////////////////////////////////////////////////////////////////////////////////////
	// Extension: Pointer types
	////////////////////////////////////////////////////////////////////////////////////////////////////

	////////////////////////////////////////////////////////////////////////////////////////////////////
	// Pointer32
	////////////////////////////////////////////////////////////////////////////////////////////////////
	readPointer32(address: number) {
		return this.readUint32(address)
	}

	readPointer32Atomic(address: number) {
		return this.readUint32Atomic(address)
	}

	writePointer32(address: number, value: number) {
		this.writeUint32(address, value)
	}

	writePointer32Atomic(address: number, value: number) {
		this.writeUint32Atomic(address, value)
	}

	allocPointer32(initialValue?: number) {
		const address = this.alloc(4)

		const ref = this.wrapPointer32(address)

		if (initialValue !== undefined) {
			ref.write(initialValue)
		}

		this.registerFinalizerIfEnabled(ref)

		return ref
	}

	wrapPointer32(address: number) {
		const ref = new Pointer32Ref(address, this)

		return ref
	}

	viewPointer32Array(address: number, elementCount: number) {
		const startIndex = address / 4
		const endIndex = startIndex + elementCount

		return this.heapUint32.subarray(startIndex, endIndex)
	}

	allocPointer32Array(elementCount: number): Pointer32ArrayRef
	allocPointer32Array(elements: Uint32Array): Pointer32ArrayRef
	allocPointer32Array(countOrElements: number | Uint32Array) {
		let ref: Pointer32ArrayRef

		if (isNumber(countOrElements)) {
			const elementCount = countOrElements

			const address = this.alloc(elementCount * 4)

			ref = this.wrapPointer32Array(address, elementCount)
		} else {
			const elements = countOrElements
			const elementCount = elements.length

			ref = this.allocPointer32Array(elementCount)

			ref.view.set(elements)
		}

		this.registerFinalizerIfEnabled(ref)

		return ref
	}

	wrapPointer32Array(address: number, elementCount: number) {
		const ref = new Pointer32ArrayRef(address, elementCount, this)

		return ref
	}

	////////////////////////////////////////////////////////////////////////////////////////////////////
	// Pointer53
	////////////////////////////////////////////////////////////////////////////////////////////////////
	readPointer53(address: number) {
		return Number(this.readBigUint64(address))
	}

	readPointer53Atomic(address: number) {
		return Number(this.readBigUint64Atomic(address))
	}

	writePointer53(address: number, value: number) {
		this.writeBigUint64(address, BigInt(value))
	}

	writePointer53Atomic(address: number, value: number) {
		this.writeBigUint64Atomic(address, BigInt(value))
	}

	allocPointer53(initialValue?: number) {
		const address = this.alloc(8)

		const ref = this.wrapPointer53(address)

		if (initialValue !== undefined) {
			ref.write(initialValue)
		}

		this.registerFinalizerIfEnabled(ref)

		return ref
	}

	wrapPointer53(address: number) {
		const ref = new Pointer53Ref(address, this)

		return ref
	}

	viewPointer53Array(address: number, elementCount: number) {
		const startIndex = address / 8
		const endIndex = startIndex + elementCount

		return this.heapBigUint64.subarray(startIndex, endIndex)
	}

	allocPointer53Array(elementCount: number): Pointer53ArrayRef
	allocPointer53Array(elements: BigUint64Array): Pointer53ArrayRef
	allocPointer53Array(countOrElements: number | BigUint64Array) {
		let ref: Pointer53ArrayRef

		if (isNumber(countOrElements)) {
			const elementCount = countOrElements

			const address = this.alloc(elementCount * 8)

			ref = this.wrapPointer53Array(address, elementCount)
		} else {
			const elements = countOrElements
			const elementCount = elements.length

			ref = this.allocPointer53Array(elementCount)

			ref.view.set(elements)
		}

		this.registerFinalizerIfEnabled(ref)

		return ref
	}

	wrapPointer53Array(address: number, elementCount: number) {
		const ref = new Pointer53ArrayRef(address, elementCount, this)

		return ref
	}

	////////////////////////////////////////////////////////////////////////////////////////////////////
	// Pointer64
	////////////////////////////////////////////////////////////////////////////////////////////////////
	readPointer64(address: number) {
		return this.readBigUint64(address)
	}

	readPointer64Atomic(address: number) {
		return this.readBigUint64Atomic(address)
	}

	writePointer64(address: number, value: bigint) {
		this.writeBigUint64(address, value)
	}

	writePointer64Atomic(address: number, value: bigint) {
		this.writeBigUint64Atomic(address, value)
	}

	allocPointer64(initialValue?: bigint) {
		const address = this.alloc(8)

		const ref = this.wrapPointer64(address)

		if (initialValue !== undefined) {
			ref.write(initialValue)
		}

		this.registerFinalizerIfEnabled(ref)

		return ref
	}

	wrapPointer64(address: number) {
		const ref = new Pointer64Ref(address, this)

		return ref
	}

	viewPointer64Array(address: number, elementCount: number) {
		const startIndex = address / 8
		const endIndex = startIndex + elementCount

		return this.heapBigUint64.subarray(startIndex, endIndex)
	}

	allocPointer64Array(elementCount: number): Pointer64ArrayRef
	allocPointer64Array(elements: BigUint64Array): Pointer64ArrayRef
	allocPointer64Array(countOrElements: number | BigUint64Array) {
		let ref: Pointer64ArrayRef

		if (isNumber(countOrElements)) {
			const elementCount = countOrElements

			const address = this.alloc(elementCount * 8)

			ref = this.wrapPointer64Array(address, elementCount)
		} else {
			const elements = countOrElements
			const elementCount = elements.length

			ref = this.allocPointer64Array(elementCount)

			ref.view.set(elements)
		}

		this.registerFinalizerIfEnabled(ref)

		return ref
	}

	wrapPointer64Array(address: number, elementCount: number) {
		const ref = new Pointer64ArrayRef(address, elementCount, this)

		return ref
	}

	////////////////////////////////////////////////////////////////////////////////////////////////////
	// Extension: Read and write 128 bit, unsigned, little-endian integer
	////////////////////////////////////////////////////////////////////////////////////////////////////
	readBigUint128LE(address: number) {
		const heapBigUint64 = this.heapBigUint64

		const index = address / 8

		const valueUint128 =
			heapBigUint64[index] |
			heapBigUint64[index + 1] << 64n

		return valueUint128
	}

	writeBigUint128LE(address: number, value: bigint) {
		const heapBigUint64 = this.heapBigUint64

		const index = address / 8

		heapBigUint64[index] = value & 0xff_ff_ff_ff_ff_ff_ff_ffn
		heapBigUint64[index + 1] = value >> 64n
	}

	////////////////////////////////////////////////////////////////////////////////////////////////////
	// Extension: Read and write 256 bit, unsigned, little-endian integer
	////////////////////////////////////////////////////////////////////////////////////////////////////
	readBigUint256LE(address: number) {
		const heapBigUint64 = this.heapBigUint64

		const index = address / 8

		const valueUint256 =
			heapBigUint64[index] |
			heapBigUint64[index + 1] << 64n |
			heapBigUint64[index + 2] << 128n |
			heapBigUint64[index + 3] << 192n

		return valueUint256
	}

	writeBigUint256LE(address: number, value: bigint) {
		const heapBigUint64 = this.heapBigUint64

		const index = address / 8

		heapBigUint64[index] = (value) & 0xff_ff_ff_ff_ff_ff_ff_ffn
		heapBigUint64[index + 1] = (value >> 64n) & 0xff_ff_ff_ff_ff_ff_ff_ffn
		heapBigUint64[index + 2] = (value >> 128n) & 0xff_ff_ff_ff_ff_ff_ff_ffn
		heapBigUint64[index + 3] = (value >> 192n) & 0xff_ff_ff_ff_ff_ff_ff_ffn
	}

	////////////////////////////////////////////////////////////////////////////////////////////////////
	// Allocate and wrap strings
	////////////////////////////////////////////////////////////////////////////////////////////////////

	////////////////////////////////////////////////////////////////////////////////////////////////////
	// Null-terminated ASCII string
	////////////////////////////////////////////////////////////////////////////////////////////////////
	readNullTerminatedAsciiString(address: number, maxElementCount?: number) {
		const stringElementCount = this.getElementCountOfNullTerminatedString(address, 1, maxElementCount)
		const encodedString = this.heapUint8.subarray(address, address + stringElementCount)

		return decodeAscii(encodedString)
	}

	writeNullTerminatedAsciiString(address: number, value: string) {
		const heapUint8 = this.heapUint8

		const charCount = value.length

		const memoryRegion = heapUint8.subarray(address, address + charCount)

		const { written, read } = encodeAsciiInto(value, memoryRegion)

		heapUint8[address + written] = 0
	}

	allocNullTerminatedAsciiString(maxElementCount: number): NullTerminatedAsciiStringRef
	allocNullTerminatedAsciiString(value: string): NullTerminatedAsciiStringRef
	allocNullTerminatedAsciiString(valueOrMaxElementCount: string | number) {
		let ref: NullTerminatedAsciiStringRef

		if (isNumber(valueOrMaxElementCount)) {
			const maxElementCount = valueOrMaxElementCount

			const allocatedElementCount = maxElementCount + 1

			const address = this.alloc(allocatedElementCount)

			ref = this.wrapNullTerminatedAsciiString(address, allocatedElementCount)
		} else {
			const value = valueOrMaxElementCount

			const allocatedElementCount = value.length + 1

			const address = this.alloc(allocatedElementCount)

			ref = this.wrapNullTerminatedAsciiString(address, allocatedElementCount)

			ref.write(value)
		}

		this.registerFinalizerIfEnabled(ref)

		return ref
	}

	wrapNullTerminatedAsciiString(address: number, maxElementCount?: number) {
		if (maxElementCount == null) {
			maxElementCount = this.getElementCountOfNullTerminatedString(address, 1)
		}

		const ref = new NullTerminatedAsciiStringRef(address, maxElementCount, this)

		return ref
	}

	////////////////////////////////////////////////////////////////////////////////////////////////////
	// Null-terminated UTF-8 string
	////////////////////////////////////////////////////////////////////////////////////////////////////
	readNullTerminatedUtf8String(address: number, maxElementCount?: number) {
		const stringElementCount = this.getElementCountOfNullTerminatedString(address, 1, maxElementCount)
		const encodedString = this.heapUint8.subarray(address, address + stringElementCount)

		return decodeUtf8(encodedString)
	}

	writeNullTerminatedUtf8String(address: number, value: string, maxElementCount: number) {
		const heapUint8 = this.heapUint8

		// Take the subarray for the string.
		//
		// Ensure there's at least one byte available at the end,
		// to write the terminating 0 byte.
		const memoryRegion = heapUint8.subarray(address, (address + maxElementCount) - 1)

		// If UTF-8 byte size is larger than the memory region, it would be truncated.
		const { written, read } = encodeUtf8Into(value, memoryRegion)

		// Check if the write was complete, and error if it didn't
		if (read < value.length) {
			throw new Error(`The UTF-8 encoding of the given string, which contains ${value.length} UTF-16 characters, was longer than the maximum of ${maxElementCount} bytes.`)
		}

		// Write a 0 byte at the end to terminate the string
		heapUint8[address + written] = 0

		return written
	}

	allocNullTerminatedUtf8String(maxElementCount: number): NullTerminatedUtf8StringRef
	allocNullTerminatedUtf8String(value: string): NullTerminatedUtf8StringRef
	allocNullTerminatedUtf8String(valueOrMaxElementCount: string | number) {
		let ref: NullTerminatedUtf8StringRef

		if (isNumber(valueOrMaxElementCount)) {
			const maxElementCount = valueOrMaxElementCount

			const allocatedElementCount = maxElementCount + 1

			const address = this.alloc(allocatedElementCount)

			ref = this.wrapNullTerminatedAsciiString(address, allocatedElementCount)
		} else {
			const value = valueOrMaxElementCount

			const encodedString = encodeUtf8(value)

			const allocatedElementCount = encodedString.length + 1

			const address = this.alloc(allocatedElementCount)

			ref = this.wrapNullTerminatedUtf8String(address, allocatedElementCount)

			const allocatedElementsView = ref.allocatedElementsView

			ref.allocatedElementsView.set(encodedString)
			allocatedElementsView[encodedString.length] = 0
		}

		this.registerFinalizerIfEnabled(ref)

		return ref
	}

	wrapNullTerminatedUtf8String(address: number, maxElementCount?: number) {
		if (maxElementCount == null) {
			maxElementCount = this.getElementCountOfNullTerminatedString(address, 1)
		}

		const ref = new NullTerminatedUtf8StringRef(address, maxElementCount, this)

		return ref
	}

	////////////////////////////////////////////////////////////////////////////////////////////////////
	// Null-terminated UTF-16 string
	////////////////////////////////////////////////////////////////////////////////////////////////////
	readNullTerminatedUtf16String(address: number, maxElementCount?: number) {
		const stringElementCount = this.getElementCountOfNullTerminatedString(address, 2, maxElementCount)

		const addressAsIndex = address / 2
		const encodedString = this.heapUint16.subarray(addressAsIndex, addressAsIndex + stringElementCount)

		return decodeUtf16(encodedString)
	}

	writeNullTerminatedUtf16String(address: number, value: string, maxElementCount?: number) {
		const heapUint16 = this.heapUint16

		const stringElementCount = value.length

		if (maxElementCount && stringElementCount + 1 > maxElementCount) {
			throw new Error(`String of length ${stringElementCount} can't fit in maximum element count of ${maxElementCount}`)
		}

		const addressAsIndex = address / 2
		const memoryRegion = heapUint16.subarray(addressAsIndex, addressAsIndex + stringElementCount)

		const { written, read } = encodeUtf16Into(value, memoryRegion)

		heapUint16[addressAsIndex + written] = 0
	}

	allocNullTerminatedUtf16String(maxElementCount: number): NullTerminatedUtf16StringRef
	allocNullTerminatedUtf16String(value: string): NullTerminatedUtf16StringRef
	allocNullTerminatedUtf16String(valueOrMaxElementCount: string | number) {
		let ref: NullTerminatedUtf16StringRef

		if (isNumber(valueOrMaxElementCount)) {
			const maxElementCount = valueOrMaxElementCount

			const allocatedElementCount = maxElementCount + 1

			const address = this.alloc(allocatedElementCount * 2)

			ref = this.wrapNullTerminatedUtf16String(address, allocatedElementCount)
		} else {
			const value = valueOrMaxElementCount

			const allocatedElementCount = value.length + 1

			const address = this.alloc(allocatedElementCount * 2)

			ref = this.wrapNullTerminatedUtf16String(address, allocatedElementCount)

			ref.write(value)
		}

		this.registerFinalizerIfEnabled(ref)

		return ref
	}

	wrapNullTerminatedUtf16String(address: number, maxElementCount?: number) {
		if (maxElementCount == null) {
			maxElementCount = this.getElementCountOfNullTerminatedString(address, 2)
		}

		const ref = new NullTerminatedUtf16StringRef(address, maxElementCount, this)

		return ref
	}

	////////////////////////////////////////////////////////////////////////////////////////////////////
	// Null-terminated UTF-32 string
	////////////////////////////////////////////////////////////////////////////////////////////////////
	readNullTerminatedUtf32String(address: number, maxElementCount?: number) {
		const stringElementCount = this.getElementCountOfNullTerminatedString(address, 4, maxElementCount)

		const addressAsIndex = address / 4
		const encodedString = this.heapUint32.subarray(addressAsIndex, addressAsIndex + stringElementCount)

		return decodeUtf32(encodedString)
	}

	writeNullTerminatedUtf32String(address: number, value: string, maxElementCount?: number) {
		const heapUint32 = this.heapUint32

		const stringElementCount = value.length

		if (maxElementCount && stringElementCount + 1 > maxElementCount) {
			throw new Error(`String of length ${stringElementCount} can't fit in maximum element count of ${maxElementCount}`)
		}

		const addressAsIndex = address / 4
		const memoryRegion = heapUint32.subarray(addressAsIndex, addressAsIndex + stringElementCount)

		const { written, read } = encodeUtf32Into(value, memoryRegion)

		heapUint32[addressAsIndex + written] = 0
	}

	allocNullTerminatedUtf32String(maxElementCount: number): NullTerminatedUtf32StringRef
	allocNullTerminatedUtf32String(value: string): NullTerminatedUtf32StringRef
	allocNullTerminatedUtf32String(valueOrMaxElementCount: string | number) {
		let ref: NullTerminatedUtf32StringRef

		if (isNumber(valueOrMaxElementCount)) {
			const maxElementCount = valueOrMaxElementCount

			const allocatedElementCount = maxElementCount + 1

			const address = this.alloc(allocatedElementCount * 4)

			ref = this.wrapNullTerminatedUtf32String(address, allocatedElementCount)
		} else {
			const value = valueOrMaxElementCount

			const allocatedElementCount = value.length + 1

			const address = this.alloc(allocatedElementCount * 4)

			ref = this.wrapNullTerminatedUtf32String(address, allocatedElementCount)

			ref.write(value)
		}

		this.registerFinalizerIfEnabled(ref)

		return ref
	}

	wrapNullTerminatedUtf32String(address: number, maxElementCount?: number) {
		if (maxElementCount == null) {
			maxElementCount = this.getElementCountOfNullTerminatedString(address, 4)
		}

		const ref = new NullTerminatedUtf32StringRef(address, maxElementCount, this)

		return ref
	}

	////////////////////////////////////////////////////////////////////////////////////////////////////
	// Common string utilities
	////////////////////////////////////////////////////////////////////////////////////////////////////
	getElementCountOfNullTerminatedString(address: number, bytesPerElement: 1 | 2 | 4, maxElementCount?: number) {
		const startIndex = address / bytesPerElement
		let endIndex: number | undefined

		if (maxElementCount != null) {
			endIndex = startIndex + maxElementCount
		}

		let memoryRegionToScan: Uint8Array | Uint16Array | Uint32Array

		if (bytesPerElement === 1) {
			memoryRegionToScan = this.heapUint8.subarray(startIndex, endIndex)
		} else if (bytesPerElement === 2) {
			memoryRegionToScan = this.heapUint16.subarray(startIndex, endIndex)
		} else if (bytesPerElement === 4) {
			memoryRegionToScan = this.heapUint32.subarray(startIndex, endIndex)
		} else {
			throw new Error(`Invalid bytes per element: ${bytesPerElement}. Can only be 1, 2 or 4.`)
		}

		const result = memoryRegionToScan.indexOf(0)

		if (result === -1) {
			throw new Error(`Couldn't find a null terminator byte in the given memory region`)
		}

		return result
	}

	////////////////////////////////////////////////////////////////////////////////////////////////////
	// Allocate and free using the allocator and deallocator provided on initialization
	////////////////////////////////////////////////////////////////////////////////////////////////////
	private alloc(allocatedByteCount: number) {
		const address = this.allocate(allocatedByteCount)

		if (this.options.clearAllocatedRegions) {
			this.viewUint8Array(address, allocatedByteCount).fill(0)
		}

		return address
	}

	free(address: number): void
	free(heapReference: HeapRef): void
	free(addressOrHeapReference: number | HeapRef) {
		if (isNumber(addressOrHeapReference)) {
			const address = addressOrHeapReference

			this.deallocate(address)
		} else if (addressOrHeapReference instanceof HeapRef) {
			const heapReference = addressOrHeapReference

			if (heapReference.isFreed) {
				return
			}

			this.deallocate(heapReference.address)

			heapReference.address = 0
		} else {
			throw new TypeError(`Invalid argument type`)
		}
	}

	private registerFinalizerIfEnabled(ref: HeapRef) {
		if (this.options.enableGarbageCollection) {
			this.finalizationRegistry.register(ref, ref.address)
		}
	}

	////////////////////////////////////////////////////////////////////////////////////////////////////
	// Manage cached heap views
	////////////////////////////////////////////////////////////////////////////////////////////////////
	private updateCacheIfNeeded() {
		const pollingMode = this.options.pollingMode

		if ((pollingMode === 'never') ||
			(pollingMode === 'whenEmpty' && this.cachedHeap.byteLength > 0)) {
			return
		}

		const newHeap = this.heapGetter()

		if (newHeap.byteLength > 0) {
			this.updateCache(newHeap)
		}
	}

	private updateCache(newHeap: ArrayBuffer | SharedArrayBuffer) {
		this.cachedHeap = newHeap

		this.cachedHeapInt8 = new Int8Array(newHeap)
		this.cachedHeapUint8 = new Uint8Array(newHeap)
		this.cachedHeapUint8Clamped = new Uint8ClampedArray(newHeap)

		this.cachedHeapInt16 = new Int16Array(newHeap)
		this.cachedHeapUint16 = new Uint16Array(newHeap)

		this.cachedHeapInt32 = new Int32Array(newHeap)
		this.cachedHeapUint32 = new Uint32Array(newHeap)

		this.cachedHeapBigInt64 = new BigInt64Array(newHeap)
		this.cachedHeapBigUint64 = new BigUint64Array(newHeap)

		this.cachedHeapFloat32 = new Float32Array(newHeap)
		this.cachedHeapFloat64 = new Float64Array(newHeap)
	}

	get heapInt8() {
		this.updateCacheIfNeeded()

		return this.cachedHeapInt8
	}

	get heapUint8() {
		this.updateCacheIfNeeded()

		return this.cachedHeapUint8
	}

	get heapUint8Clamped() {
		this.updateCacheIfNeeded()

		return this.cachedHeapUint8Clamped
	}

	get heapInt16() {
		this.updateCacheIfNeeded()

		return this.cachedHeapInt16
	}

	get heapUint16() {
		this.updateCacheIfNeeded()

		return this.cachedHeapUint16
	}

	get heapInt32() {
		this.updateCacheIfNeeded()

		return this.cachedHeapInt32
	}

	get heapUint32() {
		this.updateCacheIfNeeded()

		return this.cachedHeapUint32
	}

	get heapBigInt64() {
		this.updateCacheIfNeeded()

		return this.cachedHeapBigInt64
	}

	get heapBigUint64() {
		this.updateCacheIfNeeded()

		return this.cachedHeapBigUint64
	}

	get heapFloat32() {
		this.updateCacheIfNeeded()

		return this.cachedHeapFloat32
	}

	get heapFloat64() {
		this.updateCacheIfNeeded()

		return this.cachedHeapFloat64
	}
}

////////////////////////////////////////////////////////////////////////////////////////////////////
// Generic heap reference class.
//
// Includes an address, and a JavaScript reference to the associated heap manager.
////////////////////////////////////////////////////////////////////////////////////////////////////
abstract class HeapRef {
	public address: number
	protected readonly manager: WasmHeapManager

	constructor(address: number, manager: WasmHeapManager) {
		this.address = address
		this.manager = manager
	}

	free() {
		this.manager.free(this)
	}

	clear() {
		this.assertNotFreed()

		this.allocatedBytesView.fill(0)
	}

	get allocatedBytesView() {
		return this.manager.viewUint8Array(this.address, this.allocatedByteCount)
	}

	get isFreed() {
		return this.address === 0
	}

	abstract allocatedByteCount: number

	protected assertNotFreed() {
		if (this.isFreed) {
			throw new Error('Attempt to read a freed WASM heap reference.')
		}
	}
}

////////////////////////////////////////////////////////////////////////////////////////////////////
// Numeric references
////////////////////////////////////////////////////////////////////////////////////////////////////
abstract class NumericRef<T extends number | bigint> extends HeapRef {
	get value(): T {
		this.assertNotFreed()

		return this.read()
	}

	set value(newValue: T) {
		this.assertNotFreed()

		this.write(newValue)
	}

	abstract read(): T
	abstract write(newValue: T): this

	abstract readAtomic(): T
	abstract writeAtomic(newValue: T): this

	abstract allocatedByteCount: 1 | 2 | 4 | 8
}

export class Int8Ref extends NumericRef<number> {
	constructor(address: number, manager: WasmHeapManager) {
		super(address, manager)
	}

	read() {
		this.assertNotFreed()

		return this.manager.readInt8(this.address)
	}

	readAtomic() {
		this.assertNotFreed()

		return this.manager.readInt8Atomic(this.address)
	}

	write(newValue: number) {
		this.assertNotFreed()

		this.manager.writeInt8(this.address, newValue)

		return this
	}

	writeAtomic(newValue: number) {
		this.assertNotFreed()

		this.manager.writeInt8Atomic(this.address, newValue)

		return this
	}

	get allocatedByteCount() {
		return 1 as 1
	}
}

export class Uint8Ref extends NumericRef<number> {
	constructor(address: number, manager: WasmHeapManager) {
		super(address, manager)
	}

	read() {
		this.assertNotFreed()

		return this.manager.readUint8(this.address)
	}

	readAtomic() {
		this.assertNotFreed()

		return this.manager.readUint8Atomic(this.address)
	}

	write(newValue: number) {
		this.assertNotFreed()

		this.manager.writeUint8(this.address, newValue)

		return this
	}

	writeAtomic(newValue: number) {
		this.assertNotFreed()

		this.manager.writeUint8Atomic(this.address, newValue)

		return this
	}

	get allocatedByteCount() {
		return 1 as 1
	}
}

export class Uint8ClampedRef extends NumericRef<number> {
	constructor(address: number, manager: WasmHeapManager) {
		super(address, manager)
	}

	read() {
		this.assertNotFreed()

		return this.manager.readUint8Clamped(this.address)
	}

	readAtomic() {
		this.assertNotFreed()

		return this.manager.readUint8ClampedAtomic(this.address)
	}

	write(newValue: number) {
		this.assertNotFreed()

		this.manager.writeUint8Clamped(this.address, newValue)

		return this
	}

	writeAtomic(newValue: number) {
		this.assertNotFreed()

		this.manager.writeUint8ClampedAtomic(this.address, newValue)

		return this
	}

	get allocatedByteCount() {
		return 1 as 1
	}
}

export class Int16Ref extends NumericRef<number> {
	constructor(address: number, manager: WasmHeapManager) {
		super(address, manager)
	}

	read() {
		this.assertNotFreed()

		return this.manager.readInt16(this.address)
	}

	readAtomic() {
		this.assertNotFreed()

		return this.manager.readInt16Atomic(this.address)
	}

	write(newValue: number) {
		this.assertNotFreed()

		this.manager.writeInt16(this.address, newValue)

		return this
	}

	writeAtomic(newValue: number) {
		this.assertNotFreed()

		this.manager.writeInt16Atomic(this.address, newValue)

		return this
	}

	get allocatedByteCount() {
		return 2 as 2
	}
}

export class Uint16Ref extends NumericRef<number> {
	constructor(address: number, manager: WasmHeapManager) {
		super(address, manager)
	}

	read() {
		this.assertNotFreed()

		return this.manager.readUint16(this.address)
	}

	readAtomic() {
		this.assertNotFreed()

		return this.manager.readUint16Atomic(this.address)
	}

	write(newValue: number) {
		this.assertNotFreed()

		this.manager.writeUint16(this.address, newValue)

		return this
	}

	writeAtomic(newValue: number) {
		this.assertNotFreed()

		this.manager.writeUint16Atomic(this.address, newValue)

		return this
	}

	get allocatedByteCount() {
		return 2 as 2
	}
}

export class Int32Ref extends NumericRef<number> {
	constructor(address: number, manager: WasmHeapManager) {
		super(address, manager)
	}

	read() {
		this.assertNotFreed()

		return this.manager.readInt32(this.address)
	}

	readAtomic() {
		this.assertNotFreed()

		return this.manager.readInt32Atomic(this.address)
	}

	write(newValue: number) {
		this.assertNotFreed()

		this.manager.writeInt32(this.address, newValue)

		return this
	}

	writeAtomic(newValue: number) {
		this.assertNotFreed()

		this.manager.writeInt32Atomic(this.address, newValue)

		return this
	}

	get allocatedByteCount() {
		return 4 as 4
	}
}

export class Uint32Ref extends NumericRef<number> {
	constructor(address: number, manager: WasmHeapManager) {
		super(address, manager)
	}

	read() {
		this.assertNotFreed()

		return this.manager.readUint32(this.address)
	}

	readAtomic() {
		this.assertNotFreed()

		return this.manager.readUint32Atomic(this.address)
	}

	write(newValue: number) {
		this.assertNotFreed()

		this.manager.writeUint32(this.address, newValue)

		return this
	}

	writeAtomic(newValue: number) {
		this.assertNotFreed()

		this.manager.writeUint32Atomic(this.address, newValue)

		return this
	}

	get allocatedByteCount() {
		return 4 as 4
	}
}

export class BigInt64Ref extends NumericRef<bigint> {
	constructor(address: number, manager: WasmHeapManager) {
		super(address, manager)
	}

	read() {
		this.assertNotFreed()

		return this.manager.readBigInt64(this.address)
	}

	readAtomic() {
		this.assertNotFreed()

		return this.manager.readBigInt64Atomic(this.address)
	}

	write(newValue: bigint) {
		this.assertNotFreed()

		this.manager.writeBigInt64(this.address, newValue)

		return this
	}

	writeAtomic(newValue: bigint) {
		this.assertNotFreed()

		this.manager.writeBigInt64Atomic(this.address, newValue)

		return this
	}

	get allocatedByteCount() {
		return 8 as 8
	}
}

export class BigUint64Ref extends NumericRef<bigint> {
	constructor(address: number, manager: WasmHeapManager) {
		super(address, manager)
	}

	read() {
		this.assertNotFreed()

		return this.manager.readBigUint64(this.address)
	}

	readAtomic() {
		this.assertNotFreed()

		return this.manager.readBigUint64Atomic(this.address)
	}

	write(newValue: bigint) {
		this.assertNotFreed()

		this.manager.writeBigUint64(this.address, newValue)

		return this
	}

	writeAtomic(newValue: bigint) {
		this.assertNotFreed()

		this.manager.writeBigUint64Atomic(this.address, newValue)

		return this
	}

	get allocatedByteCount() {
		return 8 as 8
	}
}

export class Float32Ref extends NumericRef<number> {
	constructor(address: number, manager: WasmHeapManager) {
		super(address, manager)
	}

	read() {
		this.assertNotFreed()

		return this.manager.readFloat32(this.address)
	}

	readAtomic() {
		this.assertNotFreed()

		return this.manager.readFloat32Atomic(this.address)
	}

	write(newValue: number) {
		this.assertNotFreed()

		this.manager.writeFloat32(this.address, newValue)

		return this
	}

	writeAtomic(newValue: number) {
		this.assertNotFreed()

		this.manager.writeFloat32Atomic(this.address, newValue)

		return this
	}

	get allocatedByteCount() {
		return 4 as 4
	}
}

export class Float64Ref extends NumericRef<number> {
	constructor(address: number, manager: WasmHeapManager) {
		super(address, manager)
	}

	read() {
		this.assertNotFreed()

		return this.manager.readFloat64(this.address)
	}

	readAtomic() {
		this.assertNotFreed()

		return this.manager.readFloat64Atomic(this.address)
	}

	write(newValue: number) {
		this.assertNotFreed()

		this.manager.writeFloat64(this.address, newValue)

		return this
	}

	writeAtomic(newValue: number) {
		this.assertNotFreed()

		this.manager.writeFloat64Atomic(this.address, newValue)

		return this
	}

	get allocatedByteCount() {
		return 8 as 8
	}
}

////////////////////////////////////////////////////////////////////////////////////////////////////
// Pointer references
////////////////////////////////////////////////////////////////////////////////////////////////////

export abstract class PointerRef<T extends number | bigint> extends NumericRef<T> {
	free(options?: { freePointedAddress?: boolean }) {
		if (options?.freePointedAddress) {
			const pointedAddress = Number(this.read())

			this.manager.free(pointedAddress)
		}

		super.free()
	}
}

export class Pointer32Ref extends NumericRef<number> {
	constructor(address: number, manager: WasmHeapManager) {
		super(address, manager)
	}

	read() {
		this.assertNotFreed()

		return this.manager.readPointer32(this.address)
	}

	readAtomic() {
		this.assertNotFreed()

		return this.manager.readPointer32Atomic(this.address)
	}

	write(newValue: number) {
		this.assertNotFreed()

		this.manager.writePointer32(this.address, newValue)

		return this
	}

	writeAtomic(newValue: number) {
		this.assertNotFreed()

		this.manager.writePointer32Atomic(this.address, newValue)

		return this
	}

	get allocatedByteCount() {
		return 4 as 4
	}
}

export class Pointer53Ref extends NumericRef<number> {
	constructor(address: number, manager: WasmHeapManager) {
		super(address, manager)
	}

	read() {
		this.assertNotFreed()

		return this.manager.readPointer53(this.address)
	}

	readAtomic() {
		this.assertNotFreed()

		return this.manager.readPointer53Atomic(this.address)
	}

	write(newValue: number) {
		this.assertNotFreed()

		this.manager.writePointer53(this.address, newValue)

		return this
	}

	writeAtomic(newValue: number) {
		this.assertNotFreed()

		this.manager.writePointer53Atomic(this.address, newValue)

		return this
	}

	get allocatedByteCount() {
		return 8 as 8
	}
}

export class Pointer64Ref extends NumericRef<bigint> {
	constructor(address: number, manager: WasmHeapManager) {
		super(address, manager)
	}

	read() {
		this.assertNotFreed()

		return this.manager.readPointer64(this.address)
	}

	readAtomic() {
		this.assertNotFreed()

		return this.manager.readPointer64Atomic(this.address)
	}

	write(newValue: bigint) {
		this.assertNotFreed()

		this.manager.writePointer64(this.address, newValue)

		return this
	}

	writeAtomic(newValue: bigint) {
		this.assertNotFreed()

		this.manager.writePointer64Atomic(this.address, newValue)

		return this
	}

	get allocatedByteCount() {
		return 8 as 8
	}
}

////////////////////////////////////////////////////////////////////////////////////////////////////
// String references
////////////////////////////////////////////////////////////////////////////////////////////////////
abstract class StringRef extends HeapRef {
	allocatedElementCount: number

	constructor(address: number, allocatedElementCount: number, manager: WasmHeapManager) {
		super(address, manager)

		this.allocatedElementCount = allocatedElementCount
	}

	get value(): string {
		this.assertNotFreed()

		return this.read()
	}

	set value(newValue: string) {
		this.assertNotFreed()

		this.write(newValue)
	}

	abstract read(): string
	abstract write(newValue: string): this

	abstract allocatedElementsView: Uint8Array | Uint16Array | Uint32Array
	abstract encodedElementsView: Uint8Array | Uint16Array | Uint32Array

	get encodedBytesView() {
		this.assertNotFreed()

		return this.manager.heapUint8.subarray(this.address, this.address + this.encodedByteCount)
	}

	get encodedByteCount() {
		return this.encodedElementCount * this.bytesPerElement
	}

	abstract encodedElementCount: number
	abstract bytesPerElement: 1 | 2 | 4

	get allocatedByteCount() {
		return this.allocatedElementCount * this.bytesPerElement
	}
}

abstract class NullTerminatedStringRef extends StringRef {
	get encodedElementCount() {
		this.assertNotFreed()

		return this.manager.getElementCountOfNullTerminatedString(this.address, this.bytesPerElement, this.allocatedElementCount)
	}
}

export class NullTerminatedAsciiStringRef extends NullTerminatedStringRef {
	read() {
		this.assertNotFreed()

		return this.manager.readNullTerminatedAsciiString(this.address, this.allocatedElementCount)
	}

	write(newValue: string) {
		this.assertNotFreed()

		this.manager.writeNullTerminatedAsciiString(this.address, newValue)

		return this
	}

	get allocatedElementsView() {
		return this.allocatedBytesView
	}

	get encodedElementsView() {
		return this.encodedBytesView
	}

	get bytesPerElement() {
		return 1 as 1
	}
}

export class NullTerminatedUtf8StringRef extends NullTerminatedStringRef {
	read() {
		this.assertNotFreed()

		return this.manager.readNullTerminatedUtf8String(this.address, this.allocatedElementCount)
	}

	write(newValue: string) {
		this.assertNotFreed()

		this.manager.writeNullTerminatedUtf8String(this.address, newValue, this.allocatedElementCount)

		return this
	}

	get allocatedElementsView() {
		return this.allocatedBytesView
	}

	get encodedElementsView() {
		this.assertNotFreed()

		return this.encodedBytesView
	}

	get bytesPerElement() {
		return 1 as 1
	}
}

export class NullTerminatedUtf16StringRef extends NullTerminatedStringRef {
	read() {
		this.assertNotFreed()

		return this.manager.readNullTerminatedUtf16String(this.address, this.allocatedElementCount)
	}

	write(newValue: string) {
		this.assertNotFreed()

		this.manager.writeNullTerminatedUtf16String(this.address, newValue)

		return this
	}

	get allocatedElementsView() {
		this.assertNotFreed()

		return this.manager.viewUint16Array(this.address, this.allocatedElementCount)
	}

	get encodedElementsView() {
		this.assertNotFreed()

		const addressAsIndex = this.address / 2

		return this.manager.heapUint16.subarray(addressAsIndex, addressAsIndex + this.encodedElementCount)
	}

	get bytesPerElement() {
		return 2 as 2
	}
}

export class NullTerminatedUtf32StringRef extends NullTerminatedStringRef {
	read() {
		this.assertNotFreed()

		return this.manager.readNullTerminatedUtf32String(this.address, this.allocatedElementCount)
	}

	write(newValue: string) {
		this.assertNotFreed()

		this.manager.writeNullTerminatedUtf32String(this.address, newValue)

		return this
	}

	get allocatedElementsView() {
		this.assertNotFreed()

		return this.manager.viewUint32Array(this.address, this.allocatedElementCount)
	}

	get encodedElementsView() {
		this.assertNotFreed()

		const addressAsIndex = this.address / 4

		return this.manager.heapUint32.subarray(addressAsIndex, addressAsIndex + this.encodedElementCount)
	}

	get bytesPerElement() {
		return 4 as 4
	}
}

////////////////////////////////////////////////////////////////////////////////////////////////////
// Typed array references
////////////////////////////////////////////////////////////////////////////////////////////////////
abstract class TypedArrayRef<T extends TypedArray> extends HeapRef {
	readonly elementCount: number

	constructor(address: number, elementCount: number, manager: WasmHeapManager) {
		super(address, manager)

		this.elementCount = elementCount
	}

	abstract view: T

	get allocatedByteCount() {
		return this.elementCount * this.bytesPerElement
	}

	abstract bytesPerElement: 1 | 2 | 4 | 8

	abstract readAt(index: number): number | bigint
	abstract readAtomicAt(index: number): number | bigint

	abstract writeAt(index: number, value: number | bigint): this
	abstract writeAtomicAt(index: number, value: number | bigint): this
}

export class Int8ArrayRef extends TypedArrayRef<Int8Array> {
	constructor(address: number, elementCount: number, manager: WasmHeapManager) {
		super(address, elementCount, manager)
	}

	get view() {
		this.assertNotFreed()

		return this.manager.viewInt8Array(this.address, this.elementCount)
	}

	readAt(index: number) {
		this.assertNotFreed()

		return this.manager.readInt8(this.address + index)
	}

	readAtomicAt(index: number) {
		this.assertNotFreed()

		return this.manager.readInt8Atomic(this.address + index)
	}

	writeAt(index: number, value: number) {
		this.assertNotFreed()

		this.manager.writeInt8(this.address + index, value)

		return this
	}

	writeAtomicAt(index: number, value: number) {
		this.assertNotFreed()

		this.manager.writeInt8Atomic(this.address + index, value)

		return this
	}

	get bytesPerElement() {
		return 1 as 1
	}
}

export class Uint8ArrayRef extends TypedArrayRef<Uint8Array> {
	constructor(address: number, elementCount: number, manager: WasmHeapManager) {
		super(address, elementCount, manager)
	}

	get view() {
		this.assertNotFreed()

		return this.manager.viewUint8Array(this.address, this.elementCount)
	}

	readAt(index: number) {
		this.assertNotFreed()

		return this.manager.readUint8(this.address + index)
	}

	readAtomicAt(index: number) {
		this.assertNotFreed()

		return this.manager.readUint8Atomic(this.address + index)
	}

	writeAt(index: number, value: number) {
		this.assertNotFreed()

		this.manager.writeUint8(this.address + index, value)

		return this
	}

	writeAtomicAt(index: number, value: number) {
		this.assertNotFreed()

		this.manager.writeUint8Atomic(this.address + index, value)

		return this
	}

	get bytesPerElement() {
		return 1 as 1
	}
}

export class Uint8ClampedArrayRef extends TypedArrayRef<Uint8ClampedArray> {
	constructor(address: number, elementCount: number, manager: WasmHeapManager) {
		super(address, elementCount, manager)
	}

	get view() {
		this.assertNotFreed()

		return this.manager.viewUint8ClampedArray(this.address, this.elementCount)
	}

	readAt(index: number) {
		this.assertNotFreed()

		return this.manager.readUint8Clamped(this.address + index)
	}

	readAtomicAt(index: number) {
		this.assertNotFreed()

		return this.manager.readUint8ClampedAtomic(this.address + index)
	}

	writeAt(index: number, value: number) {
		this.assertNotFreed()

		this.manager.writeUint8Clamped(this.address + index, value)

		return this
	}

	writeAtomicAt(index: number, value: number) {
		this.assertNotFreed()

		this.manager.writeUint8ClampedAtomic(this.address + index, value)

		return this
	}

	get bytesPerElement() {
		return 1 as 1
	}
}

export class Int16ArrayRef extends TypedArrayRef<Int16Array> {
	constructor(address: number, elementCount: number, manager: WasmHeapManager) {
		super(address, elementCount, manager)
	}

	get view() {
		this.assertNotFreed()

		return this.manager.viewInt16Array(this.address, this.elementCount)
	}

	readAt(index: number) {
		this.assertNotFreed()

		return this.manager.readInt16(this.address + (index * 2))
	}

	readAtomicAt(index: number) {
		this.assertNotFreed()

		return this.manager.readInt16Atomic(this.address + (index * 2))
	}

	writeAt(index: number, value: number) {
		this.assertNotFreed()

		this.manager.writeInt16(this.address + (index * 2), value)

		return this
	}

	writeAtomicAt(index: number, value: number) {
		this.assertNotFreed()

		this.manager.writeInt16Atomic(this.address + (index * 2), value)

		return this
	}

	get bytesPerElement() {
		return 2 as 2
	}
}

export class Uint16ArrayRef extends TypedArrayRef<Uint16Array> {
	constructor(address: number, elementCount: number, manager: WasmHeapManager) {
		super(address, elementCount, manager)
	}

	get view() {
		this.assertNotFreed()

		return this.manager.viewUint16Array(this.address, this.elementCount)
	}

	readAt(index: number) {
		this.assertNotFreed()

		return this.manager.readUint16(this.address + (index * 2))
	}

	readAtomicAt(index: number) {
		this.assertNotFreed()

		return this.manager.readUint16Atomic(this.address + (index * 2))
	}

	writeAt(index: number, value: number) {
		this.assertNotFreed()

		this.manager.writeUint16(this.address + (index * 2), value)

		return this
	}

	writeAtomicAt(index: number, value: number) {
		this.assertNotFreed()

		this.manager.writeUint16Atomic(this.address + (index * 2), value)

		return this
	}

	get bytesPerElement() {
		return 2 as 2
	}
}

export class Int32ArrayRef extends TypedArrayRef<Int32Array> {
	constructor(address: number, elementCount: number, manager: WasmHeapManager) {
		super(address, elementCount, manager)
	}

	get view() {
		this.assertNotFreed()

		return this.manager.viewInt32Array(this.address, this.elementCount)
	}

	readAt(index: number) {
		this.assertNotFreed()

		return this.manager.readInt32(this.address + (index * 4))
	}

	readAtomicAt(index: number) {
		this.assertNotFreed()

		return this.manager.readInt32Atomic(this.address + (index * 4))
	}

	writeAt(index: number, value: number) {
		this.assertNotFreed()

		this.manager.writeInt32(this.address + (index * 4), value)

		return this
	}

	writeAtomicAt(index: number, value: number) {
		this.assertNotFreed()

		this.manager.writeInt32Atomic(this.address + (index * 4), value)

		return this
	}

	get bytesPerElement() {
		return 4 as 4
	}
}

export class Uint32ArrayRef extends TypedArrayRef<Uint32Array> {
	constructor(address: number, elementCount: number, manager: WasmHeapManager) {
		super(address, elementCount, manager)
	}

	get view() {
		this.assertNotFreed()

		return this.manager.viewUint32Array(this.address, this.elementCount)
	}

	readAt(index: number) {
		this.assertNotFreed()

		return this.manager.readUint32(this.address + (index * 4))
	}

	readAtomicAt(index: number) {
		this.assertNotFreed()

		return this.manager.readUint32Atomic(this.address + (index * 4))
	}

	writeAt(index: number, value: number) {
		this.assertNotFreed()

		this.manager.writeUint32(this.address + (index * 4), value)

		return this
	}

	writeAtomicAt(index: number, value: number) {
		this.assertNotFreed()

		this.manager.writeUint32Atomic(this.address + (index * 4), value)

		return this
	}

	get bytesPerElement() {
		return 4 as 4
	}
}

export class BigInt64ArrayRef extends TypedArrayRef<BigInt64Array> {
	constructor(address: number, elementCount: number, manager: WasmHeapManager) {
		super(address, elementCount, manager)
	}

	get view() {
		this.assertNotFreed()

		return this.manager.viewBigInt64Array(this.address, this.elementCount)
	}

	readAt(index: number) {
		this.assertNotFreed()

		return this.manager.readBigInt64(this.address + (index * 8))
	}

	readAtomicAt(index: number) {
		this.assertNotFreed()

		return this.manager.readBigInt64Atomic(this.address + (index * 8))
	}

	writeAt(index: number, value: bigint) {
		this.assertNotFreed()

		this.manager.writeBigInt64(this.address + (index * 8), value)

		return this
	}

	writeAtomicAt(index: number, value: bigint) {
		this.assertNotFreed()

		this.manager.writeBigInt64Atomic(this.address + (index * 8), value)

		return this
	}

	get bytesPerElement() {
		return 8 as 8
	}
}

export class BigUint64ArrayRef extends TypedArrayRef<BigUint64Array> {
	constructor(address: number, elementCount: number, manager: WasmHeapManager) {
		super(address, elementCount, manager)
	}

	get view() {
		this.assertNotFreed()

		return this.manager.viewBigUint64Array(this.address, this.elementCount)
	}

	readAt(index: number) {
		this.assertNotFreed()

		return this.manager.readBigUint64(this.address + (index * 8))
	}

	readAtomicAt(index: number) {
		this.assertNotFreed()

		return this.manager.readBigUint64Atomic(this.address + (index * 8))
	}

	writeAt(index: number, value: bigint) {
		this.assertNotFreed()

		this.manager.writeBigUint64(this.address + (index * 8), value)

		return this
	}

	writeAtomicAt(index: number, value: bigint) {
		this.assertNotFreed()

		this.manager.writeBigUint64Atomic(this.address + (index * 8), value)

		return this
	}

	get bytesPerElement() {
		return 8 as 8
	}
}

export class Float32ArrayRef extends TypedArrayRef<Float32Array> {
	constructor(address: number, elementCount: number, manager: WasmHeapManager) {
		super(address, elementCount, manager)
	}

	get view() {
		this.assertNotFreed()

		return this.manager.viewFloat32Array(this.address, this.elementCount)
	}

	readAt(index: number) {
		this.assertNotFreed()

		return this.manager.readFloat32(this.address + (index * 4))
	}

	readAtomicAt(index: number) {
		this.assertNotFreed()

		return this.manager.readFloat32Atomic(this.address + (index * 4))
	}

	writeAt(index: number, value: number) {
		this.assertNotFreed()

		this.manager.writeFloat32(this.address + (index * 4), value)

		return this
	}

	writeAtomicAt(index: number, value: number) {
		this.assertNotFreed()

		this.manager.writeFloat32Atomic(this.address + (index * 4), value)

		return this
	}

	get bytesPerElement() {
		return 4 as 4
	}
}

export class Float64ArrayRef extends TypedArrayRef<Float64Array> {
	constructor(address: number, elementCount: number, manager: WasmHeapManager) {
		super(address, elementCount, manager)
	}

	get view() {
		this.assertNotFreed()

		return this.manager.viewFloat64Array(this.address, this.elementCount)
	}

	readAt(index: number) {
		this.assertNotFreed()

		return this.manager.readFloat64(this.address + (index * 8))
	}

	readAtomicAt(index: number) {
		this.assertNotFreed()

		return this.manager.readFloat64Atomic(this.address + (index * 8))
	}

	writeAt(index: number, value: number) {
		this.assertNotFreed()

		this.manager.writeFloat64(this.address + (index * 8), value)

		return this
	}

	writeAtomicAt(index: number, value: number) {
		this.assertNotFreed()

		this.manager.writeFloat64Atomic(this.address + (index * 8), value)

		return this
	}

	get bytesPerElement() {
		return 8 as 8
	}
}

////////////////////////////////////////////////////////////////////////////////////////////////////
// Pointer array types
////////////////////////////////////////////////////////////////////////////////////////////////////

export abstract class PointerArrayRef<T extends TypedArray> extends TypedArrayRef<T> {
	free(options?: { freeElements?: boolean }) {
		if (options?.freeElements) {
			this.assertNotFreed()

			for (let i = 0; i < this.elementCount; i++) {
				const element = Number(this.readAt(i))

				this.manager.free(element)
			}
		}

		super.free()
	}
}

export class Pointer32ArrayRef extends PointerArrayRef<Uint32Array> {
	constructor(address: number, elementCount: number, manager: WasmHeapManager) {
		super(address, elementCount, manager)
	}

	get view() {
		this.assertNotFreed()

		return this.manager.viewUint32Array(this.address, this.elementCount)
	}

	readAt(index: number) {
		this.assertNotFreed()

		return this.manager.readPointer32(this.address + (index * 4))
	}

	readAtomicAt(index: number) {
		this.assertNotFreed()

		return this.manager.readPointer32Atomic(this.address + (index * 4))
	}

	writeAt(index: number, value: number) {
		this.assertNotFreed()

		this.manager.writePointer32(this.address + (index * 4), value)

		return this
	}

	writeAtomicAt(index: number, value: number) {
		this.assertNotFreed()

		this.manager.writePointer32Atomic(this.address + (index * 4), value)

		return this
	}

	get bytesPerElement() {
		return 4 as 4
	}
}

export class Pointer53ArrayRef extends PointerArrayRef<BigUint64Array> {
	constructor(address: number, elementCount: number, manager: WasmHeapManager) {
		super(address, elementCount, manager)
	}

	get view() {
		this.assertNotFreed()

		return this.manager.viewBigUint64Array(this.address, this.elementCount)
	}

	readAt(index: number) {
		this.assertNotFreed()

		return this.manager.readPointer53(this.address + (index * 8))
	}

	readAtomicAt(index: number) {
		this.assertNotFreed()

		return this.manager.readPointer53Atomic(this.address + (index * 8))
	}

	writeAt(index: number, value: number) {
		this.assertNotFreed()

		this.manager.writePointer53(this.address + (index * 8), value)

		return this
	}

	writeAtomicAt(index: number, value: number) {
		this.assertNotFreed()

		this.manager.writePointer53Atomic(this.address + (index * 8), value)

		return this
	}

	free(options?: { freeElements?: boolean }) {
		if (options?.freeElements) {
			this.assertNotFreed()

			for (let i = 0; i < this.elementCount; i++) {
				const elementAsNumber = Number(this.readAt(i))

				this.manager.free(elementAsNumber)
			}
		}

		super.free()
	}

	get bytesPerElement() {
		return 8 as 8
	}
}

export class Pointer64ArrayRef extends PointerArrayRef<BigUint64Array> {
	constructor(address: number, elementCount: number, manager: WasmHeapManager) {
		super(address, elementCount, manager)
	}

	get view() {
		this.assertNotFreed()

		return this.manager.viewBigUint64Array(this.address, this.elementCount)
	}

	readAt(index: number) {
		this.assertNotFreed()

		return this.manager.readPointer64(this.address + (index * 8))
	}

	readAtomicAt(index: number) {
		this.assertNotFreed()

		return this.manager.readPointer64Atomic(this.address + (index * 8))
	}

	writeAt(index: number, value: bigint) {
		this.assertNotFreed()

		this.manager.writePointer64(this.address + (index * 8), value)

		return this
	}

	writeAtomicAt(index: number, value: bigint) {
		this.assertNotFreed()

		this.manager.writePointer64Atomic(this.address + (index * 8), value)

		return this
	}

	get bytesPerElement() {
		return 8 as 8
	}
}

////////////////////////////////////////////////////////////////////////////////////////////////////
// Common types
////////////////////////////////////////////////////////////////////////////////////////////////////
export type AllocatorMethod = (size: number) => number
export type DeallocatorMethod = (address: number) => void
export type HeapGetterCallback = () => ArrayBuffer

export interface WasmHeapManagerOptions {
	clearAllocatedRegions?: boolean
	pollingMode?: 'always' | 'whenEmpty' | 'never'
	enableGarbageCollection?: boolean
}

export const defaultWasmHeapManagerOptions: WasmHeapManagerOptions = {
	clearAllocatedRegions: true,
	pollingMode: 'whenEmpty',
	enableGarbageCollection: false
}

export const enum DataType {
	Int8,
	Uint8,
	Uint8Clamped,
	Int16,
	Uint16,
	Int32,
	Uint32,
	BigInt64,
	BigUint64,
	Float32,
	Float64,
	Pointer32,
	Pointer64,

	Int8Array,
	Uint8Array,
	Uint8ClampedArray,
	Int16Array,
	Uint16Array,
	Int32Array,
	Uint32Array,
	BigInt64Array,
	BigUint64Array,
	Float32Array,
	Float64Array,
	Pointer32Array,
	Pointer64Array,
}
