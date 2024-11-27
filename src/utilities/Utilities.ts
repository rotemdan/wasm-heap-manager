import { TypedArray, TypedArrayConstructor } from "./TypedArray.js"

export function concatUint8Arrays(arrays: Uint8Array[]) {
	return concatTypedArrays<Uint8Array>(Uint8Array, arrays)
}

function concatTypedArrays<T extends TypedArray>(TypedArrayConstructor: TypedArrayConstructor<T>, arrays: T[]) {
	let totalLength = 0

	for (const array of arrays) {
		totalLength += array.length
	}

	const result = new TypedArrayConstructor(totalLength)

	let writeOffset = 0

	for (const array of arrays) {
		result.set(array as any, writeOffset)

		writeOffset += array.length
	}

	return result as T
}

export function getRandomId() {
	return Math.random().toString().substring(2)
}

export function alignToNextMultiple(value: number, alignmentConstant: number) {
	// Align end address to the alignment constant, if needed
	const alignmentRemainder = value % alignmentConstant

	if (alignmentRemainder > 0) {
		// Pad end address to next multiple of the alignment constant
		value += alignmentConstant - alignmentRemainder
	}

	return value
}

export function isString(value: any): value is string {
	return typeof value === 'string'
}

export function isNumber(value: any): value is number {
	return typeof value === 'number'
}

export function isBigInt(value: any): value is bigint {
	return typeof value === 'bigint'
}
