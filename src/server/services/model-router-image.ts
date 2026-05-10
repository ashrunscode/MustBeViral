export interface NormalisedImageOutput {
	imageBase64: string;
	bytes: Uint8Array;
	contentType: "image/png";
	byteLength: number;
}

export type WorkersAiImageInput =
	| {
			prompt: string;
			steps: number;
	  }
	| {
			multipart: {
				body: ReadableStream<Uint8Array> | null;
				contentType: string;
			};
	  };

const MOCK_PNG_BASE64 =
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

export function buildWorkersAiImageInput(model: string, prompt: string): WorkersAiImageInput {
	if (isFlux2Model(model)) {
		const form = new FormData();
		form.append("prompt", prompt);
		form.append("width", "1024");
		form.append("height", "1024");
		const formResponse = new Response(form);
		return {
			multipart: {
				body: formResponse.body,
				contentType: formResponse.headers.get("content-type") ?? "multipart/form-data",
			},
		};
	}

	return { prompt, steps: 4 };
}

export async function normaliseWorkersAiImageOutput(
	output: unknown,
): Promise<NormalisedImageOutput> {
	if (isRecord(output) && typeof output.image === "string") {
		return normaliseBase64Image(output.image);
	}
	if (typeof output === "string") {
		return normaliseBase64Image(output);
	}
	if (output instanceof ArrayBuffer) {
		return normaliseBytes(new Uint8Array(output));
	}
	if (ArrayBuffer.isView(output)) {
		return normaliseBytes(new Uint8Array(output.buffer, output.byteOffset, output.byteLength));
	}
	if (isReadableStream(output)) {
		const buffer = await new Response(output).arrayBuffer();
		return normaliseBytes(new Uint8Array(buffer));
	}
	throw new Error("workers_ai_image_missing");
}

export function mockPngBase64(): string {
	return MOCK_PNG_BASE64;
}

export function imageBase64ToBytes(base64: string): Uint8Array {
	const clean = stripDataUrlPrefix(base64);
	const binary = atob(clean);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) {
		bytes[index] = binary.charCodeAt(index);
	}
	return bytes;
}

export function imageBytesToBase64(bytes: Uint8Array): string {
	let binary = "";
	const chunkSize = 0x8000;
	for (let offset = 0; offset < bytes.length; offset += chunkSize) {
		const chunk = bytes.subarray(offset, offset + chunkSize);
		binary += String.fromCharCode(...chunk);
	}
	return btoa(binary);
}

export function buildCreativeR2Key(brandId: string, creativeId: string): string {
	if (!isSafePathSegment(brandId) || !isSafePathSegment(creativeId)) {
		throw new Error("invalid_creative_r2_key_segment");
	}
	return `creatives/${brandId}/${creativeId}.png`;
}

function isFlux2Model(model: string): boolean {
	return model.startsWith("@cf/black-forest-labs/flux-2-");
}

function normaliseBase64Image(base64: string): NormalisedImageOutput {
	return normaliseBytes(imageBase64ToBytes(base64));
}

function normaliseBytes(bytes: Uint8Array): NormalisedImageOutput {
	return {
		imageBase64: imageBytesToBase64(bytes),
		bytes,
		contentType: "image/png",
		byteLength: bytes.byteLength,
	};
}

function stripDataUrlPrefix(base64: string): string {
	const commaIndex = base64.indexOf(",");
	if (base64.startsWith("data:") && commaIndex >= 0) {
		return base64.slice(commaIndex + 1);
	}
	return base64;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isReadableStream(value: unknown): value is ReadableStream<Uint8Array> {
	return typeof ReadableStream !== "undefined" && value instanceof ReadableStream;
}

function isSafePathSegment(value: string): boolean {
	return /^[A-Za-z0-9_-]+$/.test(value);
}
