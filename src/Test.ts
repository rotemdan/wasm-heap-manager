import { ArrayBufferArenaAllocator } from "./allocators/ArrayBufferArenaAllocator.js"
import { WasmHeapManager } from "./WasmHeapManager.js"
import { WasmMemoryArenaAllocator } from "./allocators/WasmMemoryArenaAllocator.js"
import { decodeUtf8, decodeUtf8_JS, encodeUtf8, encodeUtf8Into, encodeUtf8Into_JS } from "./encodings/Utf8.js"
import { decodeUtf32, encodeUtf32 } from "./encodings/Utf32.js"

declare const global: any

async function startTest2() {
	const heapManager = initArrayBufferHeap()

	const strRef = heapManager.allocNullTerminatedUtf8String(100000)

	strRef.value = 'Hey there.'

	const str = strRef.value

	const int32Ref = heapManager.allocInt32()

	int32Ref.writeAtomic(1234)

	const floatRef = heapManager.allocFloat64()

	const testValue = 3.212353523524574

	floatRef.writeAtomic(testValue)

	const val = floatRef.value

	const x = 1
}

async function startTest1() {
	const heapManager = initArrayBufferHeap()

	const int64Ref = heapManager.allocBigInt64(142239392323424n)

	const strRef = heapManager.allocNullTerminatedUtf16String(`傷寒論注釋 揚子雲集`)

	const r = strRef.value

	const test = strRef.encodedElementsView

	const floats = new Float64Array([1.2, 3.3, 2.2])

	const arrayRef = heapManager.allocFloat64Array(floats)

	const numRef = heapManager.allocFloat32().write(234.56756)

	for (let i = 0; i < 1000000; i++) {
		const ref = heapManager.allocUint8Array(100_000_000)

		const test = ref.view

		const x = 0
	}

	const buf1 = heapManager.heapUint8.buffer

	heapManager.allocUint8Array(200001)

	const buf2 = heapManager.heapUint8.buffer

	heapManager.allocUint8Array(200001)

	const buf3 = heapManager.heapUint8.buffer

	const x = 0
}

function testUtf8() {
	const iterationCount = 100000
	//let shortStr = "Hello world! how are you?"
	let shortStr = "史	🫰	🫱	🫲	🫳	🫴	🫵	🫶	🫷	↙️記 漢書 道德指歸論 傷寒論注釋 揚子雲集 淮南鴻烈解"
	let str = ''

	for (let i = 0; i < 200; i++) {
		str += shortStr
	}

	const encodedBytes = encodeUtf8(str)

	let result1: Uint8Array
	let result2: Uint8Array

	{
		const buf1 = new Uint8Array(10000)
		let written = 0

		console.time('JS Encoder')

		for (let i = 0; i < iterationCount; i++) {
			encodeUtf8Into_JS(str, buf1)
		}

		console.timeEnd('JS Encoder')

		result1 = buf1.slice(0, written)
	}

	{
		const buf2 = new Uint8Array(10000)

		console.time('TextEncoder')

		let written = 0

		for (let i = 0; i < iterationCount; i++) {
			encodeUtf8Into(str, buf2)
		}

		console.timeEnd('TextEncoder')

		result2 = buf2.slice(0, written)
	}

	{
		console.time('JS Decoder')

		let result: string

		for (let i = 0; i < iterationCount; i++) {
			result = decodeUtf8_JS(encodedBytes)
		}

		console.timeEnd('JS Decoder')

		//console.log(result!)
		//console.log(str)
	}

	{
		console.time('TextDecoder')

		for (let i = 0; i < iterationCount; i++) {
			decodeUtf8(encodedBytes)
		}

		console.timeEnd('TextDecoder')
	}

	//console.log(result1)
	//console.log(result2)
}

function initWasmHeap() {
	const wasmMemory = new WebAssembly.Memory({ initial: 1, maximum: 2 ** 16, shared: false })

	const allocator = new WasmMemoryArenaAllocator(wasmMemory, 8)

	const heapManager = new WasmHeapManager(
		() => allocator.heap,
		(requestedByteSize: number) => allocator.allocate(requestedByteSize),
		() => {},
		{
			clearAllocatedRegions: false,
			pollingMode: 'whenEmpty',
		}
	)

	return heapManager
}

function initArrayBufferHeap() {
	const allocator = new ArrayBufferArenaAllocator()

	const heapManager = new WasmHeapManager(
		() => allocator.heap,
		(requestedByteSize: number) => allocator.allocate(requestedByteSize),
		() => { },
		{
			clearAllocatedRegions: false,
			pollingMode: 'always',
		}
	)

	return heapManager
}

startTest2()
//testUtf8()
