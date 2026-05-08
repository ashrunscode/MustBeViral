export interface ApiMeta {
	requestId: string;
	timestamp: string;
	[key: string]: unknown;
}

export interface ApiSuccess<T> {
	success: true;
	data: T;
	meta: ApiMeta;
}

export interface ApiFailure {
	success: false;
	error: {
		code: string;
		message: string;
		details?: unknown;
		requestId: string;
	};
}

export function successEnvelope<T>(data: T, requestId: string, meta?: Record<string, unknown>): ApiSuccess<T> {
	return {
		success: true,
		data,
		meta: {
			requestId,
			timestamp: new Date().toISOString(),
			...meta,
		},
	};
}

export function errorEnvelope(
	code: string,
	message: string,
	requestId: string,
	details?: unknown,
): ApiFailure {
	return {
		success: false,
		error: {
			code,
			message,
			...(details === undefined ? {} : { details }),
			requestId,
		},
	};
}
