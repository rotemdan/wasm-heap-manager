# WebAssembly Heap Manager

A TypeScript / JavaScript library that provides safe and convenient methods to read, write, allocate and wrap numeric values, strings, and typed arrays, within the WebAssembly heap, Emscripten heap, or any custom one, defined by:

* A single `ArrayBuffer` or `SharedArrayBuffer` containing the entire heap
* An allocator function, like `alloc(size)`
* A deallocator function, like `free(address)`

To ensure the `ArrayBuffer` can be grown or replaced when needed, the manager is initialized with a user-defined callback function `getLatestHeap()` that should always return the most up-to-date instance of the heap. When the manager detects the current ArrayBuffer has become detached (`byteLength` of 0), the manager will call this function to retrieve the most up-to-date `ArrayBuffer` (other polling behaviors can also be configured via the the `pollingMode` constructor option).

## Features

* Provides operations to read and write various numeric and string types on arbitrary heap locations
* Creates TypedArray views on arbitrary regions of the heap
* Creates JavaScript objects that wrap around typed heap references, allowing to safely allocate, read, update and free them
* Supports all JavaScript typed arrays, including `BigInt64Array`, `BigUint64Array` and `Uint8ClampedArray`
* Supports thread-safe, atomic reads and writes for all primitive types. Polyfills atomic operations for floating point and clamped array elements
* Efficiently reads, writes, allocates and wraps ASCII, UTF-8, UTF-16 and UTF-32 strings directly on the heap
* Supports `ArrayBuffer` heaps larger than `4 GiB`, up to `2^53 - 1` bytes, which is about `8192 TiB` (large `ArrayBuffer` support is already available in Node.js 22+ and latest Firefox)
* Supports `SharedArrayBuffer`. Can be used to efficiently share data between different JavaScript threads
* Supports optional allocation tracking (enabled by default), allowing all heap objects allocated via the manager to be listed or freed in bulk
* Works on all major JavaScript runtimes, including browsers, Node.js, Deno and Bun
* Optimized for speed and minimal overhead, while balancing for safety and convenience
* No dependencies

## Installation

```
npm install wasm-heap-manager
```

## Initialization

### Wrap the heap of an Emscripten module (either WebAssembly or JavaScript-based)

```ts
import { createWasmHeapManager } from 'wasm-heap-manager'

// ...

// Ensure `_malloc` and `_free` are included as exports
// by passing `-s EXPORTED_FUNCTIONS="['_malloc', '_free', ...]"` to `emcc`
// when the code is compiled.
const heapManager = createWasmHeapManager(
	() => emscriptenModule.HEAPU8.buffer
	emscriptenModule._malloc,
	emscriptenModule._free
)
```

Or equivalent utility method:

```ts
import { wrapEmscriptenModuleHeap } from 'wasm-heap-manager'

// ...

const heapManager = wrapEmscriptenModuleHeap(emscriptenModule)
```

### Wrap the heap of a plain WebAssembly module's memory object
```ts
import { createWasmHeapManager } from 'wasm-heap-manager'

// ...

const instanceExports = wasmModule.instance.exports

// Assuming `memory`, `malloc` and `free` are valid exports from the module:
const heapManager = createWasmHeapManager(
	() => instanceExports.memory.buffer,
	instanceExports.malloc,
	instanceExports.free
)
```

### Wrap a custom `WebAssembly.Memory` object, allocator function, and deallocator function

Here's a basic ["bump" allocator](https://en.wikipedia.org/wiki/Region-based_memory_management), for illustration purposes only:
```ts
import { createWasmHeapManager } from 'wasm-heap-manager'

const memory = new WebAssembly.Memory({ initial: 1, maximum: 1000 })

// Current allocation address. Is incremented after each allocation.
let currentAddress = 8

function myAllocator(requestedSize: number) {
	// Compute start and end addresses of the newly allocated region
	const startAddress = currentAddress
	let endAddress = currentAddress + Math.ceil(requestedSize)

	// Align end address to 8 byte boundaries, if needed
	endAddress = alignToNextMultiple(endAddress, 8)

	// Grow memory if needed
	const currentCapacity = memory.buffer.byteLength

	if (endAddress > currentCapacity) {
		const additionalRequiredCapacity = endAddress - currentCapacity
		const additionalRequiredPages = Math.ceil(additionalRequiredCapacity / (2 ** 16)) + 1

		memory.grow(additionalRequiredPages)
	}

	// Update current allocation address
	currentAddress = endAddress

	return startAddress
}

function myDeallocator(address: number) {
	// Do nothing. It never frees memory.
}

const heapManager = createWasmHeapManager(
	() => memory.buffer,
	myAllocator,
	myDeallocator
)
```

Code for utility method `alignToNextMultiple`:
```ts
function alignToNextMultiple(value: number, alignmentConstant: number) {
	// Align end address to the alignment constant, if needed
	const alignmentRemainder = value % alignmentConstant

	if (alignmentRemainder > 0) {
		// Pad end address to next multiple of the alignment constant
		value += alignmentConstant - alignmentRemainder
	}

	return value
}
```
## Reading and writing

### Directly reading and writing numeric values on the heap

Reading numeric values:
```ts
const int8Value = heapManager.readInt8(address)
const uint8Value = heapManager.readUint8(address)
const clampedUint8Value = heapManager.readClampedUint8(address)
const int16Value = heapManager.readInt16(address)
const uint16Value = heapManager.readUint16(address)
const int32Value = heapManager.readInt32(address)
const uint32Value = heapManager.readUint32(address)
const bigInt64Value = heapManager.readBigInt64(address)
const bigUint64Value = heapManager.readBigUint64(address)
const float32Value = heapManager.readFloat32(address)
const float64Value = heapManager.readFloat64(address)

// Pointer types
const pointer32Value = heapManager.readPointer32(address)
const pointer53Value = heapManager.readPointer53(address)
const pointer64Value = heapManager.readPointer64(address)

// Large unsigned integer extensions (little endian):
const bigUint128Value = heapManager.readBigUint128LE(address)
const bigUint256Value = heapManager.readBigUint256LE(address)
```

Writing numeric values:
```ts
heapManager.writeInt8(address, int8Value)
heapManager.writeUint8(address, uint8Value)
heapManager.writeClampedUint8(address, clampedUint8Value)
heapManager.writeInt16(address, int16Value)
heapManager.writeUint16(address, uint16Value)
heapManager.writeInt32(address, int32Value)
heapManager.writeUint32(address, uint32Value)
heapManager.writeBigInt64(address, bigInt64Value)
heapManager.writeBigUint64(address, bigUint64Value)
heapManager.writeFloat32(address, float32Value)
heapManager.writeFloat64(address, float64Value)

// Pointer types
heapManager.writePointer32(address, pointer32Value)
heapManager.writePointer53(address, pointer53Value)
heapManager.writePointer64(address, pointer64Value)

// Large unsigned integer extensions (little endian):
heapManager.writeBigUint128LE(address, bigUint128Value)
heapManager.writeBigUint256LE(address, bigUint256Value)
```

### Directly reading and writing strings on the heap

Read string:
```ts
const stringValue = heapManager.readNullTerminatedAsciiString(address)
const stringValue = heapManager.readNullTerminatedUtf8String(address)
const stringValue = heapManager.readNullTerminatedUtf16String(address)
const stringValue = heapManager.readNullTerminatedUtf32String(address)
```

Write string:
```ts
heapManager.writeNullTerminatedAsciiString(address, stringValue)
heapManager.writeNullTerminatedUtf8String(address, stringValue)
heapManager.writeNullTerminatedUtf16String(address, stringValue)
heapManager.writeNullTerminatedUtf32String(address, stringValue)
```

### Creating TypedArray views of arbitrary heap regions

`address` is a byte address on the heap. `elementCount` is an element count for the view, for the particular type that is being viewed

```ts
heapManager.viewInt8Array(address, elementCount)
heapManager.viewUint8Array(address, elementCount)
heapManager.viewClampedUint8Array(address, elementCount)
heapManager.viewInt16Array(address, elementCount)
heapManager.viewUint16Array(address, elementCount)
heapManager.viewInt32Array(address, elementCount)
heapManager.viewUint32Array(address, elementCount)
heapManager.viewBigInt64Array(address, elementCount)
heapManager.viewBigUint64Array(address, elementCount)
heapManager.viewFloat32Array(address, elementCount)
heapManager.viewFloat64Array(address, elementCount)

// Pointer views
heapManager.viewPointer32Array(address, elementCount) // identical to viewUint32Array
heapManager.viewPointer64Array(address, elementCount) // identical to viewBigUint64Array
```
The view is a `subarray` of the heap's current ArrayBuffer. You can read and write to and from it directly.

**Note**: the returned subarray should not be used for a long duration as it can become invalid or out-of-date when the underlying ArrayBuffer is detached during a memory resize or similar event. Please ensure you only use the returned typed array for the very immediate term!

## Allocating memory

### Allocating numeric values on the heap

```ts
const int8Ref = heapManager.allocInt8()
const uint8Ref = heapManager.allocUint8()
const clampedUint8Ref = heapManager.allocClampedUint8()
const int16Ref = heapManager.allocInt16()
const uint16Ref = heapManager.allocUint16()
const int32Ref = heapManager.allocInt32()
const uint32Ref = heapManager.allocUint32()
const bigInt64Ref = heapManager.allocBigInt64()
const bigUint64Ref = heapManager.allocBigUint64()
const float32Ref = heapManager.allocFloat32()
const float64Ref = heapManager.allocFloat64()

// Pointer types
const pointer32Ref = heapManager.allocPointer32()
const pointer53Ref = heapManager.allocPointer53()
const pointer64Ref = heapManager.allocPointer64()
```

The returned reference object has these specialized properties and methods:
* `value`: getter/setter for easy access to the value
* `read()`: read value
* `readAtomic()`: atomically read value
* `write(newValue)` write a new value
* `writeAtomic(newValue)`: atomically write a new value

And these inherited properties and methods:
* `address`: heap byte offset of the allocated region
* `allocatedByteSize`: allocated size of the reference, in bytes
* `allocatedBytesView`: Uint8Array view of the allocated memory region
* `clear()`: set allocated memory region to all 0
* `free()`: free the memory associated with this reference
* `isFreed`: check if reference has been freed (only aware of `free` called through the reference!)

### Allocating strings on the heap

```ts
const asciiStringRef = heapManager.allocNullTerminatedAsciiString(elementCount)
const utf8StringRef = heapManager.allocNullTerminatedUtf8String(elementCount)
const utf16StringRef = heapManager.allocNullTerminatedUtf16String(elementCount)
const utf32StringRef = heapManager.allocNullTerminatedUtf32String(elementCount)
```
`elementCount` is the total number of encoded elements that would be allocated.
* For ASCII and UTF-8, each element is a `uint8` (1 byte)
* For UTF-16, each element is a `uint16` (2 bytes)
* For UTF-32, each element is a `uint32` (4 bytes)

The returned reference object has these specialized properties and methods:
* `value`: getter/setter for easy access to the stored string
* `read()`: read value
* `write(newValue)`: write new value
* `encodedElementsView`: a `Uint8Array`, `Uint16Array` or `Uint32Array` subarray of the string's encoded elements, excluding the terminating character
* `encodedElementCount`: element count of the stored string, excluding terminating character. Computing this value requires scanning the memory to find the offset of the first 0 element in the allocated region
* `encodedBytesView`: a `Uint8Array` subarray of the string's encoded bytes, excluding terminating character
* `encodedByteLength`: byte length of the stored string, excluding terminating character.

And these inherited properties and methods:
* `address`: heap byte offset of the allocated region
* `allocatedByteSize`: allocated size of the reference, in bytes
* `allocatedBytesView`: Uint8Array view of the allocated memory region
* `clear()`: set allocated memory region to all 0
* `free()`: free the memory associated with this reference
* `isFreed`: check if reference has been freed (only applies to calls made through the reference!)
* `bytesPerElement`: number of bytes for each encoded elements. `1` for ASCII and UTF-8, `2` for UTF-16 and `4` for UTF-32

### Allocating typed arrays on the heap

```ts
const int8ArrayRef = heapManager.allocInt8Array(elementCount)
const uint8ArrayRef = heapManager.allocUint8Array(elementCount)
const uint8ClampedArrayRef = heapManager.allocClampedUint8Array(elementCount)
const int16ArrayRef = heapManager.allocInt16Array(elementCount)
const uint16ArrayRef = heapManager.allocUint16Array(elementCount)
const int32ArrayRef = heapManager.allocInt32Array(elementCount)
const uint32ArrayRef = heapManager.allocUint32Array(elementCount)
const bigInt64ArrayRef = heapManager.allocBigInt64Array(elementCount)
const bigUint64ArrayRef = heapManager.allocBigUint64Array(elementCount)
const float32ArrayRef = heapManager.allocFloat32Array(elementCount)
const float64ArrayRef = heapManager.allocFloat64Array(elementCount)

// Pointer types
const pointer32ArrayRef = heapManager.allocPointer32Array(elementCount)
const pointer53ArrayRef = heapManager.allocPointer53Array(elementCount)
const pointer64ArrayRef = heapManager.allocPointer64Array(elementCount)
```

The returned reference object has these specialized properties and methods:
* `view`: subarray for easy access to the reference's memory region
* `readAt(index)`: read element at index
* `readAtomicAt(index)`: atomically read element at index
* `writeAt(index, newValue)`: write element at index
* `writeAtomicAt(index, newValue)`: atomically write element  at index
* `elementCount`: element count
* `bytesPerElement`: bytes per element

And these inherited properties and methods:
* `address`: heap byte offset of the allocated region
* `allocatedByteSize`: allocated size of the reference, in bytes
* `allocatedBytesView`: Uint8Array view of the allocated memory region
* `clear()`: set allocated memory region to all 0
* `free()`: free the memory associated with this reference
* `isFreed`: check if reference has been freed (only applies to calls made through the reference!)

## Wrapping existing data

### Wrapping existing numeric values on the heap

For example, pointers returned from WebAssembly methods can be wrapped and used in a safe way.

```ts
const int8Ref = heapManager.wrapInt8(address)
const uint8Ref = heapManager.wrapUint8(address)
const clampedUint8Ref = heapManager.wrapClampedUint8(address)
const int16Ref = heapManager.wrapInt16(address)
const uint16Ref = heapManager.wrapUint16(address)
const int32Ref = heapManager.wrapInt32(address)
const uint32Ref = heapManager.wrapUint32(address)
const bigInt64Ref = heapManager.wrapBigInt64(address)
const bigUint64Ref = heapManager.wrapBigUint64(address)
const float32Ref = heapManager.wrapFloat32(address)
const float64Ref = heapManager.wrapFloat64(address)

// Pointer types
const pointer32Ref = heapManager.wrapPointer32(address)
const pointer53Ref = heapManager.wrapPointer53(address)
const pointer64Ref = heapManager.wrapPointer64(address)
```

Returns the same reference object as the value allocation methods.

### Wrapping existing strings on the heap

```ts
const stringRef = heapManager.wrapNullTerminatedAsciiString(address)
const stringRef = heapManager.wrapNullTerminatedUtf8String(address)
const stringRef = heapManager.wrapNullTerminatedUtf16String(address)
const stringRef = heapManager.wrapNullTerminatedUtf32String(address)
```

Returns the same reference object as the string allocation methods.

### Wrapping existing typed arrays on the heap

```ts
const int8ArrayRef = heapManager.wrapInt8Array(address, elementCount)
const uint8ArrayRef = heapManager.wrapUint8Array(address, elementCount)
const uint8ClampedArrayRef = heapManager.wrapClampedUint8Array(address, elementCount)
const int16ArrayRef = heapManager.wrapInt16Array(address, elementCount)
const uint16ArrayRef = heapManager.wrapUint16Array(address, elementCount)
const int32ArrayRef = heapManager.wrapInt32Array(address, elementCount)
const uint32ArrayRef = heapManager.wrapUint32Array(address, elementCount)
const bigInt64ArrayRef = heapManager.wrapBigInt64Array(address, elementCount)
const bigUint64ArrayRef = heapManager.wrapBigUint64Array(address, elementCount)
const float32ArrayRef = heapManager.wrapFloat32Array(address, elementCount)
const float64ArrayRef = heapManager.wrapFloat64Array(address, elementCount)

// Pointer types
const pointer32ArrayRef = heapManager.wrapPointer32Array(address, elementCount)
const pointer53ArrayRef = heapManager.wrapPointer53Array(address, elementCount)
const pointer64ArrayRef = heapManager.wrapPointer64Array(address, elementCount)
```

Returns the same reference object as the typed array allocation methods.

## Pointer types

* `pointer32` operations (read, write, allocate, wrap), `Pointer32Ref` and `Pointer32ArrayRef` are identical to `uint32` operations. The distinct naming is meant for increased code safety to ensure pointers are uniquely typed in the user code
* `pointer64` operations (read, write, allocate, wrap), `Pointer64Ref` and `Pointer64ArrayRef` are identical to `BigUint64` operations. The distinct naming is meant for increased code safety to ensure pointers are uniquely typed in the user code
* `pointer53` operations internally use `BigUint64` for storage on the heap, but are implicitly cast to and from `number`s. Since JavaScript `number`s are limited to a maximum safe integer values of `2^53 - 1`, it means the `number` based pointers can reference up to `8192 TiB`, which is sufficient for almost all use cases today

**Recommendation**: unless you're expecting an extremely large memory capacity, for memory ranges over `2^32` (4 GiB), use `pointer53` instead of `pointer64`. It saves the hassle of converting to and from `BigInt`s and in that way simplifies your code, and could in practice help ensure that larger address spaces are correctly managed, without the extra boilerplate code.

## Constructor options

* `clearAllocatedRegions`: always zero a heap region after it is allocated. Defaults to `true`
* `pollingMode`: how often the manager would poll the callback to get the latest `ArrayBuffer`. Can be set to `never` (will never call the callback - assumes the `ArrayBuffer` is static and never replaced), `whenEmpty` (will invoke the callback when the ArrayBuffer has a `byteLength` of 0), or `always` (will invoke the callback every time the heap is accessed). Defaults to `whenEmpty`, which works with the standard behavior of Emscripten heaps and WASM memory objects. If you are using a custom `ArrayBuffer` object as heap, you may need to set to `always` (in case it's being replaced) or `never` (in case it is static)
* `trackAllocations`: will internally track all heap references created via the manager (not including wrapped heap objects originally allocated externally), and allow to list and free them in bulk. Defaults to `true`

## Future

* Support for arrays with a custom element size
* Support for structure data types
* Support for arrays of structures

## License

MIT
