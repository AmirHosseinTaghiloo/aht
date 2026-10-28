//#region src/index.ts
const SELF_URL = import.meta.url;
/** Sources with no file information, including JSC's `native`, `(1:11)` and `(:0)` frames. */
const NATIVE_SOURCE_RE = /^(?:<anonymous>|native|unknown|:?\d+(?::\d+)?)$/u;
function isSlash(code) {
	return code === 47 || code === 92;
}
function indexOrEnd(text, search, from) {
	const index = text.indexOf(search, from);
	return index < 0 ? text.length : index;
}
function isDigit(code) {
	return code > 47 && code < 58;
}
/** Matches the characters removed by `String.prototype.trim`. */
function isSpace(code) {
	if (code < 128) return code === 32 || code > 8 && code < 14;
	return !String.fromCharCode(code).trim();
}
function parseFrame(text, from, to, cursor) {
	const frame = {
		function: void 0,
		source: ""
	};
	if (text.startsWith("async ", from)) {
		frame.isAsync = true;
		from += 6;
	}
	if (text.startsWith("new ", from)) {
		frame.isConstructor = true;
		from += 4;
	}
	let start = from;
	let end = to;
	if (text.charCodeAt(end - 1) === 41) {
		end--;
		if (cursor.paren < from) cursor.paren = indexOrEnd(text, " (", from);
		let open = cursor.paren;
		if (open < end) {
			if (cursor.space < open + 2) cursor.space = indexOrEnd(text, " ", open + 2);
			if (cursor.space < end) open = text.lastIndexOf(" (", end - 1);
		}
		if (open > from && open + 2 < end && text.indexOf(")", open) === end) {
			frame.function = text.slice(from, open);
			start = open + 2;
		} else {
			text = text.slice(from, to);
			start = parseEvalFrame(text, frame);
			if (start < 0) return;
			end = text.indexOf(")", start);
		}
	} else if (from >= to || /\s/u.test(text.slice(from, to))) return;
	let column = end;
	let columnValue = 0;
	let scale = 1;
	let code = text.charCodeAt(column - 1);
	while (isDigit(code)) {
		columnValue += (code - 48) * scale;
		scale *= 10;
		code = text.charCodeAt(--column - 1);
	}
	if (column < end && code === 58) {
		let line = column - 1;
		let lineValue = 0;
		scale = 1;
		code = text.charCodeAt(line - 1);
		while (isDigit(code)) {
			lineValue += (code - 48) * scale;
			scale *= 10;
			code = text.charCodeAt(--line - 1);
		}
		if (line < column - 1 && line > start + 1 && code === 58) {
			frame.line = lineValue;
			frame.column = columnValue;
			end = line - 1;
		}
	}
	const src = text.slice(start, end);
	if (src.length < 20 && NATIVE_SOURCE_RE.test(src)) frame.isNative = true;
	frame.source = toFileURL(src);
	return frame;
}
/**
* Resolves an `eval` frame, such as `eval (eval at fn (file:1:2), <anonymous>:3:4)`, to the
* innermost real source location, discarding the position within the evaluated code since
* it cannot be resolved to a file. Returns the index at which the source starts, or -1 for
* other frames.
*/
function parseEvalFrame(rest, frame) {
	const evalAt = rest.lastIndexOf("eval at ");
	const open = evalAt < 0 ? -1 : rest.indexOf("(", evalAt);
	if ((open < 0 ? -1 : rest.indexOf(")", open)) - open < 2) return -1;
	const origin = rest.indexOf(" (eval at ");
	frame.isEval = true;
	if (origin > 0) frame.function = rest.slice(0, origin);
	return open + 1;
}
/**
* Converts an absolute filesystem path into a `file://` URL, so that Windows paths become
* valid URLs (`C:\x\y.js` -> `file:///C:/x/y.js`, `\\server\share\x.js` ->
* `file://server/share/x.js`). Sources that already carry a scheme, device paths
* (`\\.\pipe\x`) and relative paths are returned unchanged.
*/
function toFileURL(source) {
	const first = source.charCodeAt(0);
	let prefix = "file:///";
	if (isSlash(first)) {
		prefix = "file://";
		if (isSlash(source.charCodeAt(1))) {
			if (source.charCodeAt(2) === 46) return source;
			source = source.slice(2);
		}
	} else if ((first | 32) < 97 || (first | 32) > 122 || source.charCodeAt(1) !== 58 || !isSlash(source.charCodeAt(2))) return source;
	return prefix + (source.includes("\\") ? source.replaceAll("\\", "/") : source);
}
function captureRawStackTrace() {
	const holder = {};
	Error.captureStackTrace?.(holder, captureRawStackTrace);
	return holder.stack;
}
function captureStackTrace() {
	return parseRawStackTrace(captureRawStackTrace() ?? "");
}
/**
* Parses the stack trace of an existing error, returning an empty array for errors
* without a (string) stack.
*/
function parseError(error) {
	const stack = error?.stack;
	return typeof stack === "string" ? parseRawStackTrace(stack) : [];
}
/**
* Parses a stack trace produced by V8 (Node, Deno, Chromium) or JSC (Bun) into structured
* frames.
*
* Lines that are recognisably frames but cannot be parsed further are returned with an
* empty `source`, so that a consumer can still render their `raw` text.
*/
function parseRawStackTrace(stacktrace) {
	const trace = [];
	const length = stacktrace.length;
	const cursor = {
		paren: -1,
		space: -1
	};
	for (let start = 0, next = 0; start < length; start = next) {
		let end = stacktrace.indexOf("\n", start);
		if (end < 0) end = length;
		next = end + 1;
		let at = start;
		while (at < end && isSpace(stacktrace.charCodeAt(at))) at++;
		while (end > at && isSpace(stacktrace.charCodeAt(end - 1))) end--;
		if (at === start || end - at < 3 || !stacktrace.startsWith("at ", at)) continue;
		const frame = parseFrame(stacktrace, at + 3, end, cursor) ?? { source: "" };
		if (frame.source === SELF_URL) continue;
		frame.raw = stacktrace.slice(start, end);
		trace.push(frame);
	}
	return trace;
}
//#endregion
export { captureRawStackTrace, captureStackTrace, parseError, parseRawStackTrace };
