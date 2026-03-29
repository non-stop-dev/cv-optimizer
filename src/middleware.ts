import { defineMiddleware } from 'astro:middleware';

const PRODUCTION_CSP = [
	"default-src 'self'",
	"base-uri 'none'",
	"object-src 'none'",
	"frame-ancestors 'none'",
	"frame-src 'none'",
	"form-action 'self'",
	"connect-src 'self'",
	"script-src 'self'",
	"style-src 'self' https://fonts.googleapis.com",
	"style-src-attr 'none'",
	"style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com",
	"img-src 'self' data: blob:",
	"font-src 'self' https://fonts.gstatic.com data:",
	"worker-src 'self'",
	"manifest-src 'self'",
	'upgrade-insecure-requests'
].join('; ');

const DEVELOPMENT_CSP = [
	"default-src 'self' http: https: ws: wss: data: blob:",
	"base-uri 'none'",
	"object-src 'none'",
	"frame-ancestors 'none'",
	"frame-src 'none'",
	"form-action 'self'",
	"connect-src 'self' http: https: ws: wss:",
	"script-src 'self' 'unsafe-inline' 'unsafe-eval'",
	"style-src 'self' https://fonts.googleapis.com",
	"style-src-attr 'none'",
	"style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com",
	"img-src 'self' data: blob:",
	"font-src 'self' https://fonts.gstatic.com data:",
	"worker-src 'self' blob:",
	"manifest-src 'self'"
].join('; ');

const SECURITY_HEADERS = {
	'Content-Security-Policy': import.meta.env.PROD ? PRODUCTION_CSP : DEVELOPMENT_CSP,
	'Referrer-Policy': 'strict-origin-when-cross-origin',
	'X-Content-Type-Options': 'nosniff',
	'X-Frame-Options': 'DENY',
	'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
} as const;

const isHttpsRequest = (request: Request) => {
	if (new URL(request.url).protocol === 'https:') {
		return true;
	}

	const forwardedProto = request.headers.get('x-forwarded-proto');
	if (!forwardedProto) {
		return false;
	}

	const firstValue = forwardedProto.split(',')[0]?.trim().toLowerCase();
	return firstValue === 'https';
};

const toHttpsUrl = (request: Request) => {
	const currentUrl = new URL(request.url);
	const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
	const secureUrl = new URL(currentUrl.toString());
	secureUrl.protocol = 'https:';
	if (forwardedHost) {
		secureUrl.host = forwardedHost;
	}
	return secureUrl;
};

export const onRequest = defineMiddleware(async ({ request }, next) => {
	if (import.meta.env.PROD && !isHttpsRequest(request)) {
		return Response.redirect(toHttpsUrl(request), 308);
	}

	const response = await next();
	const headers = new Headers(response.headers);

	for (const [headerName, headerValue] of Object.entries(SECURITY_HEADERS)) {
		headers.set(headerName, headerValue);
	}

	if (import.meta.env.PROD) {
		headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
	}

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers
	});
});
