export class IEEE754Converter {
	// 32 bit float conversions
	private uint32View = new Uint32Array(1)
	private float32View = new Float32Array(this.uint32View.buffer)

	float32ToUint32(value: number) {
		this.float32View[0] = value

		return this.uint32View[0]
	}

	uint32ToFloat32(value: number) {
		this.uint32View[0] = value

		return this.float32View[0]
	}

	// 64 bit float conversions
	private bigUint64View = new BigUint64Array(1)
	private float64View = new Float64Array(this.bigUint64View.buffer)

	float64ToBigUint64(value: number) {
		this.float64View[0] = value

		return this.bigUint64View[0]
	}

	bigUint64ToFloat64(value: bigint) {
		this.bigUint64View[0] = value

		return this.float64View[0]
	}
}
