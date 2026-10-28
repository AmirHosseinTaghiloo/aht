import { styleText } from "node:util";
//#region ../../node_modules/.pnpm/@speed-highlight+core@2.1.0/node_modules/@speed-highlight/core/dist/languages/bash.js
var e$1 = {
	type: "var",
	match: /\$\w+|\${[^}]*}|\$\([^)]*\)/g
};
var t$8 = [
	{
		type: "cmnt",
		sub: "todo",
		match: /#.*/g
	},
	{
		type: "str",
		match: /(["'])((?!\1)[^\r\n\\]|\\[^])*\1?/g,
		sub: [e$1]
	},
	{
		type: "oper",
		match: /(?<=\s|^)\.*\/[a-z/_.-]+/gi
	},
	{
		type: "kwd",
		match: /\s-[a-zA-Z]+|[&|;]+|\b(unset|readonly|shift|export|if|fi|else|elif|while|do|done|for|until|case|esac|break|continue|exit|return|trap|wait|eval|exec|then|declare|enable|local|select|typeset|time|add|remove|install|update|delete)(?=\s|$)/g
	},
	{ expand: "num" },
	{
		type: "func",
		match: /(?<=(^|\||\&\&|\;)\s*)[a-z_.-]+(?=\s|$)/gim
	},
	{
		type: "bool",
		match: /(?<=\s|^)(true|false)(?=\s|$)/g
	},
	{
		type: "oper",
		match: /[=(){}<>!]+/g
	},
	{
		type: "var",
		match: /(?<=\s|^)[\w_]+(?=\s*=)/g
	},
	e$1
];
//#endregion
//#region ../../node_modules/.pnpm/@speed-highlight+core@2.1.0/node_modules/@speed-highlight/core/dist/languages/css.js
var t$7 = [
	{
		match: /\/\*((?!\*\/)[^])*(\*\/)?/g,
		type: "cmnt",
		sub: "todo"
	},
	{ expand: "str" },
	{
		type: "var",
		match: /--[\w-]+|\b[\w-]+(?=\s*:)/g
	},
	{
		type: "kwd",
		match: /@[\w-]+\b|!important\b|\b(and|not|only|or)\b|\b(?=([a-z-]+))\2(?=[^{}]*{)/g
	},
	{
		type: "var",
		match: /(::?|\.)(?!\d)[\w-]+(?=[^{}]*{)/g
	},
	{
		type: "func",
		match: /#[\w-]+(?=[^{}]*{)/g
	},
	{
		type: "num",
		match: /#[\da-f]{3,8}/gi
	},
	{
		type: "num",
		match: /-?\d*\.?\d+([a-z]+|%)?/gi,
		sub: [{
			type: "var",
			match: /[a-z]+|%/gi
		}]
	},
	{
		match: /url\([^)]*\)/g,
		sub: [{
			type: "func",
			match: /url(?=\()/g
		}, {
			type: "str",
			match: /[^()]+/g
		}]
	},
	{
		type: "func",
		match: /\b[a-zA-Z][\w-]*(?=\s*\()/g
	},
	{
		type: "num",
		match: /\b[a-z-]+\b/g
	}
];
//#endregion
//#region ../../node_modules/.pnpm/@speed-highlight+core@2.1.0/node_modules/@speed-highlight/core/dist/languages/diff.js
var t$6 = [
	{
		type: "deleted",
		match: /^[-<].*/gm
	},
	{
		type: "insert",
		match: /^[+>].*/gm
	},
	{
		type: "kwd",
		match: /!.*/gm
	},
	{
		type: "section",
		match: /^@@.*@@$|^\d.*|^([*+-])\1\1.*/gm
	}
];
//#endregion
//#region ../../node_modules/.pnpm/@speed-highlight+core@2.1.0/node_modules/@speed-highlight/core/dist/languages/html.js
var a$2 = ":A-Z_a-zÀ-ÖØ-öø-˿Ͱ-ͽͿ-῿‌-‍⁰-↏Ⰰ-⿯、-퟿豈-﷏ﷰ-�";
var t$5 = `[${a$2}][${a$2 + "\\-\\.0-9·̀-ͯ‿-⁀"}]*`;
var e = `(\\s+${t$5}\\s*(=\\s*([^"'>\\s][^>\\s]*|("|')(\\\\[^]|(?!\\4)[^])*\\4?)?)?)*\\s*`;
var s$2 = {
	match: RegExp(`<[/!?]?${t$5}${e}[/!?]?>`, "g"),
	sub: [
		{
			type: "var",
			match: RegExp(`^<[/!?]?${t$5}`, "g"),
			sub: [{
				type: "oper",
				match: /^<[\/!?]?/g
			}]
		},
		{
			type: "str",
			match: /=\s*([^"'>\s][^>\s]*|("|')(\\[^]|(?!\2)[^])*\2?)/g,
			sub: [{
				type: "oper",
				match: /^=/g
			}]
		},
		{
			type: "oper",
			match: /[\/!?]?>/g
		},
		{
			type: "class",
			match: RegExp(t$5, "g")
		}
	]
};
var m$2 = [
	{
		match: /<!--[^]*?-->/g,
		type: "cmnt",
		sub: "todo"
	},
	{
		type: "class",
		match: /<!\[CDATA\[[\s\S]*?\]\]>/gi
	},
	s$2,
	{
		type: "str",
		match: RegExp(`<\\?${t$5}([^?]|\\?[^?>])*\\?+>`, "g"),
		sub: [{
			type: "var",
			match: RegExp(`^<\\?${t$5}`, "g"),
			sub: [{
				type: "oper",
				match: /^<\?/g
			}]
		}, {
			type: "oper",
			match: /\?+>$/g
		}]
	},
	{
		type: "var",
		match: /&(#x?)?[\da-z]{1,8};/gi
	}
];
var c$1 = (u, g) => ({
	type: "str",
	match: RegExp(`(?<=\\s${u}\\s*)=\\s*('[^']*'|"[^"]*")`, "gi"),
	sub: [{
		type: "oper",
		match: /^=/g
	}, {
		match: /(?<=['"])[^]+(?=['"]$)/g,
		sub: g
	}]
});
var p$1 = {
	...s$2,
	sub: [
		c$1("style", "css"),
		c$1("on\\w+", "js"),
		...s$2.sub
	]
};
var F = [
	{
		type: "class",
		match: /<!DOCTYPE("[^"]*"|'[^']*'|[^"'>])*>/gi,
		sub: [
			{
				type: "str",
				match: /"[^"]*"|'[^']*'/g
			},
			{
				type: "oper",
				match: /^<!|>$/g
			},
			{
				type: "var",
				match: /DOCTYPE/gi
			}
		]
	},
	{
		match: RegExp(`<style${e}>[^]*?</style\\s*>`, "g"),
		sub: [
			{
				match: RegExp(`^<style${e}>`, "g"),
				sub: p$1.sub
			},
			{
				match: /[^]*(?=<\/style\s*>$)/g,
				sub: "css"
			},
			p$1
		]
	},
	{
		match: RegExp(`<script${e}>[^]*?<\/script\\s*>`, "g"),
		sub: [
			{
				match: RegExp(`^<script${e}>`, "g"),
				sub: p$1.sub
			},
			{
				match: /[^]*(?=<\/script\s*>$)/g,
				sub: "js"
			},
			p$1
		]
	},
	...m$2.map((u) => u === s$2 ? p$1 : u)
];
//#endregion
//#region ../../node_modules/.pnpm/@speed-highlight+core@2.1.0/node_modules/@speed-highlight/core/dist/languages/http.js
var i$1 = {
	bash: [[/#!(\/usr)?\/bin\/bash/g, 500], [/\b(if|elif|then|fi|echo)\b|\$/g, 10]],
	html: [[/<\/?[a-z-]+[^\n>]*>/g, 10], [/^\s+<!DOCTYPE\s+html/g, 500]],
	http: [[/^(GET|HEAD|POST|PUT|DELETE|PATCH|HTTP)\b/g, 500]],
	ts: [[/\b(console|await|async|function|export|import|this|class|for|let|const|map|join|require|document|window|implements|interface|namespace|true|false|null)\b/g, 10]],
	py: [[/\b(def|print|await|async|class|and|or|lambda|import|from|self|asyncio|pass|True|False|None|__init__)\b/g, 10]],
	sql: [[/\b(SELECT|INSERT|FROM)\b/g, 50]],
	pl: [[/#!(\/usr)?\/bin\/perl/g, 500], [/\b(use|print)\b|\$/g, 10]],
	lua: [[/#!(\/usr)?\/bin\/lua/g, 500]],
	make: [[/\b(ifneq|endif|if|elif|then|fi|echo|.PHONY|^[a-z]+ ?:$)\b|\$/gm, 10]],
	uri: [[/https?:|mailto:|tel:|ftp:/g, 30]],
	css: [[/^(@import|@page|@media|(\.|#)[a-z]+)/gm, 20]],
	diff: [[/^[+><-]/gm, 10], [/^@@ ?[-+,0-9 ]+ ?@@/gm, 25]],
	md: [[/^(>|\t\*|\t\d+.)/gm, 10], [/\[.*\](.*)/g, 10]],
	docker: [[/^(FROM|ENTRYPOINT|RUN)/gm, 500]],
	xml: [[/<\/?[a-z-]+[^\n>]*>/g, 10], [/^<\?xml/g, 500]],
	c: [[/#include\b|\bprintf\s+\(/g, 100]],
	rs: [[/^\s+(use|fn|mut|match)\b/gm, 100]],
	go: [[/\b(func|fmt|package)\b/g, 100]],
	java: [[/^import\s+java/gm, 500]],
	asm: [[/^(section|global main|extern|\t(call|mov|ret))/gm, 100]],
	yaml: [[/^(\s+)?[a-z][a-z0-9]*:/gim, 10]]
};
function a$1(n) {
	return Object.entries(i$1).map(([e, t]) => [e, t.reduce((m, [s, g]) => m + [...n.matchAll(s)].length * g, 0)]).filter(([e, t]) => t > 20).sort((e, t) => t[1] - e[1])[0]?.[0] || "plain";
}
var c = [
	{
		type: "kwd",
		match: /^(GET|HEAD|POST|PUT|DELETE|CONNECT|OPTIONS|TRACE|PATCH|PRI|SEARCH)\b/gm
	},
	{ expand: "str" },
	{
		type: "section",
		match: /\bHTTP\/[\d.]+\b/g
	},
	{ expand: "num" },
	{
		type: "oper",
		match: /[,;:=]/g
	},
	{
		type: "var",
		match: /[a-zA-Z][\w-]*(?=:)/g
	},
	{
		match: /\n\n[^]*/g,
		sub: a$1
	}
];
//#endregion
//#region ../../node_modules/.pnpm/@speed-highlight+core@2.1.0/node_modules/@speed-highlight/core/dist/languages/js.js
var s$1 = [
	{ match: /(("|')((?!\2)[^\r\n\\]|\\[^])*\2|[a-zA-Z]\w*)(?=\s*:)/g },
	{
		match: /\/\*\*((?!\*\/)[^])*(\*\/)?/g,
		type: "cmnt",
		sub: "jsdoc"
	},
	{
		match: /\/\/.*\n?|\/\*((?!\*\/)[^])*(\*\/)?/g,
		type: "cmnt",
		sub: "todo"
	},
	{ expand: "str" },
	{
		match: /`((?!`)[^]|\\[^])*`?/g,
		type: "str",
		sub: [{
			match: new class {
				exec(t) {
					let e = this.lastIndex, a, n = (c) => {
						for (; ++e < t.length - 2;) if (t[e] == "{") n();
						else if (t[e] == "}") return;
					};
					for (; e < t.length; ++e) if (t[e - 1] != "\\" && t[e] == "$" && t[e + 1] == "{") return a = e++, n(e), this.lastIndex = e + 1, {
						index: a,
						0: t.slice(a, e + 1)
					};
					return null;
				}
			}(),
			sub: [{
				type: "kwd",
				match: /^\${|}$/g
			}, {
				match: /(?!^\$|{)[^]+(?=}$)/g,
				sub: "js"
			}]
		}]
	},
	{
		type: "kwd",
		match: /=>|(?<![^.]\.)\b(this|set|get|as|async|await|break|case|catch|class|const|constructor|continue|debugger|default|delete|do|else|enum|export|extends|finally|for|from|function|if|implements|import|in|instanceof|interface|let|var|of|new|package|private|protected|public|return|static|super|switch|throw|throws|try|typeof|void|while|with|yield)\b/g
	},
	{
		match: /(?<=[^\w$)\]'"`\s]\s*|\b(case|do|else|in|instanceof|new|of|return|throw|typeof|void|yield|await)\s+|^\s*)\/((?!\/)[^\r\n\\]|\\.)+\/\w*/gm,
		type: "oper",
		sub: "regex"
	},
	{ expand: "num" },
	{
		type: "num",
		match: /\b(NaN|null|undefined|[A-Z][A-Z_]*)\b/g
	},
	{
		type: "bool",
		match: /\b(true|false)\b/g
	},
	{
		type: "var",
		match: /#[\w$]+/g
	},
	{
		type: "oper",
		match: /[/*+:?&|%^~=!,<>.^-]+/g
	},
	{
		type: "class",
		match: /\b[A-Z][\w_]*\b/g
	},
	{
		type: "func",
		match: /[a-zA-Z$_][\w$_]*(?=\s*((\?\.)?\s*\(|=\s*(\(?[\w,{}\[\])]+\)? =>|function\b)))/g
	}
];
//#endregion
//#region ../../node_modules/.pnpm/@speed-highlight+core@2.1.0/node_modules/@speed-highlight/core/dist/languages/jsdoc.js
var a = {
	type: "cmnt",
	sub: [
		{
			type: "kwd",
			match: /@\w+/g
		},
		{
			type: "type",
			match: /{[\w\s|<>,.@\[\]]+}/g
		},
		{
			type: "var",
			match: /\[[\w\s="']+\]/g
		},
		...{
			type: "cmnt",
			sub: [
				{
					type: "err",
					match: /\b(TODO|FIXME|DEBUG|OPTIMIZE|WARNING|XXX|BUG)\b/g
				},
				{
					type: "class",
					match: /\bIDEA\b/g
				},
				{
					type: "insert",
					match: /\b(CHANGED|FIX|CHANGE)\b/g
				},
				{
					type: "oper",
					match: /\bQUESTION\b/g
				}
			]
		}.sub
	]
};
//#endregion
//#region ../../node_modules/.pnpm/@speed-highlight+core@2.1.0/node_modules/@speed-highlight/core/dist/languages/json.js
var t$4 = [
	{
		type: "var",
		match: /(("|')((?!\2)[^\r\n\\]|\\[^])*\2|[a-zA-Z]\w*)(?=\s*:)/g
	},
	{ expand: "str" },
	{ expand: "num" },
	{
		type: "num",
		match: /\bnull\b/g
	},
	{
		type: "bool",
		match: /\b(true|false)\b/g
	}
];
//#endregion
//#region ../../node_modules/.pnpm/@speed-highlight+core@2.1.0/node_modules/@speed-highlight/core/dist/languages/md.js
var i = {
	bash: [[/#!(\/usr)?\/bin\/bash/g, 500], [/\b(if|elif|then|fi|echo)\b|\$/g, 10]],
	html: [[/<\/?[a-z-]+[^\n>]*>/g, 10], [/^\s+<!DOCTYPE\s+html/g, 500]],
	http: [[/^(GET|HEAD|POST|PUT|DELETE|PATCH|HTTP)\b/g, 500]],
	ts: [[/\b(console|await|async|function|export|import|this|class|for|let|const|map|join|require|document|window|implements|interface|namespace|true|false|null)\b/g, 10]],
	py: [[/\b(def|print|await|async|class|and|or|lambda|import|from|self|asyncio|pass|True|False|None|__init__)\b/g, 10]],
	sql: [[/\b(SELECT|INSERT|FROM)\b/g, 50]],
	pl: [[/#!(\/usr)?\/bin\/perl/g, 500], [/\b(use|print)\b|\$/g, 10]],
	lua: [[/#!(\/usr)?\/bin\/lua/g, 500]],
	make: [[/\b(ifneq|endif|if|elif|then|fi|echo|.PHONY|^[a-z]+ ?:$)\b|\$/gm, 10]],
	uri: [[/https?:|mailto:|tel:|ftp:/g, 30]],
	css: [[/^(@import|@page|@media|(\.|#)[a-z]+)/gm, 20]],
	diff: [[/^[+><-]/gm, 10], [/^@@ ?[-+,0-9 ]+ ?@@/gm, 25]],
	md: [[/^(>|\t\*|\t\d+.)/gm, 10], [/\[.*\](.*)/g, 10]],
	docker: [[/^(FROM|ENTRYPOINT|RUN)/gm, 500]],
	xml: [[/<\/?[a-z-]+[^\n>]*>/g, 10], [/^<\?xml/g, 500]],
	c: [[/#include\b|\bprintf\s+\(/g, 100]],
	rs: [[/^\s+(use|fn|mut|match)\b/gm, 100]],
	go: [[/\b(func|fmt|package)\b/g, 100]],
	java: [[/^import\s+java/gm, 500]],
	asm: [[/^(section|global main|extern|\t(call|mov|ret))/gm, 100]],
	yaml: [[/^(\s+)?[a-z][a-z0-9]*:/gim, 10]]
};
function m$1(e) {
	return Object.entries(i).map(([a, t]) => [a, t.reduce((n, [s, g]) => n + [...e.matchAll(s)].length * g, 0)]).filter(([a, t]) => t > 20).sort((a, t) => t[1] - a[1])[0]?.[0] || "plain";
}
var r = [
	{
		type: "cmnt",
		match: /^>.*|^[ \t]*(=+|-{2,})[ \t]*$/gm
	},
	{
		type: "section",
		match: /^#{1,6}[ \t]/gm
	},
	{
		type: "class",
		match: /\*\*.*?\*\*/g
	},
	{
		match: /^(`{3,}).*\n[^]*?^\1[ \t]*$/gm,
		sub: (e) => ({
			type: "kwd",
			sub: [{
				match: /\n[^]*(?=```)/g,
				sub: e.split(`
`)[0].slice(3) || m$1(e)
			}]
		})
	},
	{
		type: "str",
		match: /`[^`\n]*`/g
	},
	{
		type: "var",
		match: /~~.*?~~/g
	},
	{
		type: "kwd",
		match: /\b_\S(.*?\S)?_\b|\*\S(.*?\S)?\*|^[ \t]*([*+-]|\d+[.)])([ \t]|$)/gm
	},
	{
		type: "func",
		match: /\[[^\]]*]\([^)]*\)|<[^>]*>/g,
		sub: [{
			type: "oper",
			match: /^\[[^\]]*]/g
		}]
	}
];
//#endregion
//#region ../../node_modules/.pnpm/@speed-highlight+core@2.1.0/node_modules/@speed-highlight/core/dist/languages/py.js
var t$3 = [
	{
		match: /#.*/g,
		type: "cmnt",
		sub: "todo"
	},
	{
		type: "str",
		match: /f("""|''')(\\[^]|(?!\1)[^])*\1?|f("|')(\\[^]|(?!\3).)*\3?/gi,
		sub: [{
			type: "var",
			match: /{[^{}]*}/g,
			sub: [{
				match: /(?!^{)[^]*(?=}$)/g,
				sub: "py"
			}]
		}]
	},
	{
		match: /("""|''')(\\[^]|(?!\1)[^])*\1?/g,
		type: "cmnt",
		sub: "todo"
	},
	{ expand: "str" },
	{
		type: "kwd",
		match: /\b(and|as|assert|async|await|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|raise|return|try|while|with|yield)\b/g
	},
	{
		type: "bool",
		match: /\b(False|True|None)\b/g
	},
	{ expand: "num" },
	{
		type: "func",
		match: /[a-z_]\w*(?=\s*\()/gi
	},
	{
		type: "oper",
		match: /[-/*+<>,=!&|^%]+/g
	},
	{
		type: "class",
		match: /\b[A-Z][\w_]*\b/g
	}
];
//#endregion
//#region ../../node_modules/.pnpm/@speed-highlight+core@2.1.0/node_modules/@speed-highlight/core/dist/languages/regex.js
var t$2 = {
	type: "oper",
	sub: [
		{
			match: /^(?!\/).*/gm,
			type: "cmnt",
			sub: "todo"
		},
		{
			type: "num",
			match: /\[((?!\])[^\\]|\\.)*\]/g
		},
		{
			type: "kwd",
			match: /\||\^|\$|\\.|\w+($|\r|\n)/g
		},
		{
			type: "var",
			match: /[*+?.]|\{\d+(,\d*)?\}/g
		}
	]
};
//#endregion
//#region ../../node_modules/.pnpm/@speed-highlight+core@2.1.0/node_modules/@speed-highlight/core/dist/languages/todo.js
var t$1 = {
	type: "cmnt",
	sub: [
		{
			type: "err",
			match: /\b(TODO|FIXME|DEBUG|OPTIMIZE|WARNING|XXX|BUG)\b/g
		},
		{
			type: "class",
			match: /\bIDEA\b/g
		},
		{
			type: "insert",
			match: /\b(CHANGED|FIX|CHANGE)\b/g
		},
		{
			type: "oper",
			match: /\bQUESTION\b/g
		}
	]
};
//#endregion
//#region ../../node_modules/.pnpm/@speed-highlight+core@2.1.0/node_modules/@speed-highlight/core/dist/languages/ts.js
var p = [
	{
		type: "type",
		match: /:\s*(any|void|number|boolean|string|object|never|enum)\b/g
	},
	{
		type: "kwd",
		match: /\b(type|namespace|typedef|interface|public|private|protected|implements|declare|abstract|readonly)\b/g
	},
	...[
		{ match: /(("|')((?!\2)[^\r\n\\]|\\[^])*\2|[a-zA-Z]\w*)(?=\s*:)/g },
		{
			match: /\/\*\*((?!\*\/)[^])*(\*\/)?/g,
			type: "cmnt",
			sub: "jsdoc"
		},
		{
			match: /\/\/.*\n?|\/\*((?!\*\/)[^])*(\*\/)?/g,
			type: "cmnt",
			sub: "todo"
		},
		{ expand: "str" },
		{
			match: /`((?!`)[^]|\\[^])*`?/g,
			type: "str",
			sub: [{
				match: new class {
					exec(t) {
						let e = this.lastIndex, a, n = (s) => {
							for (; ++e < t.length - 2;) if (t[e] == "{") n();
							else if (t[e] == "}") return;
						};
						for (; e < t.length; ++e) if (t[e - 1] != "\\" && t[e] == "$" && t[e + 1] == "{") return a = e++, n(e), this.lastIndex = e + 1, {
							index: a,
							0: t.slice(a, e + 1)
						};
						return null;
					}
				}(),
				sub: [{
					type: "kwd",
					match: /^\${|}$/g
				}, {
					match: /(?!^\$|{)[^]+(?=}$)/g,
					sub: "js"
				}]
			}]
		},
		{
			type: "kwd",
			match: /=>|(?<![^.]\.)\b(this|set|get|as|async|await|break|case|catch|class|const|constructor|continue|debugger|default|delete|do|else|enum|export|extends|finally|for|from|function|if|implements|import|in|instanceof|interface|let|var|of|new|package|private|protected|public|return|static|super|switch|throw|throws|try|typeof|void|while|with|yield)\b/g
		},
		{
			match: /(?<=[^\w$)\]'"`\s]\s*|\b(case|do|else|in|instanceof|new|of|return|throw|typeof|void|yield|await)\s+|^\s*)\/((?!\/)[^\r\n\\]|\\.)+\/\w*/gm,
			type: "oper",
			sub: "regex"
		},
		{ expand: "num" },
		{
			type: "num",
			match: /\b(NaN|null|undefined|[A-Z][A-Z_]*)\b/g
		},
		{
			type: "bool",
			match: /\b(true|false)\b/g
		},
		{
			type: "var",
			match: /#[\w$]+/g
		},
		{
			type: "oper",
			match: /[/*+:?&|%^~=!,<>.^-]+/g
		},
		{
			type: "class",
			match: /\b[A-Z][\w_]*\b/g
		},
		{
			type: "func",
			match: /[a-zA-Z$_][\w$_]*(?=\s*((\?\.)?\s*\(|=\s*(\(?[\w,{}\[\])]+\)? =>|function\b)))/g
		}
	]
];
//#endregion
//#region ../../node_modules/.pnpm/@speed-highlight+core@2.1.0/node_modules/@speed-highlight/core/dist/languages/yaml.js
var t = [
	{
		match: /#.*/g,
		type: "cmnt",
		sub: "todo"
	},
	{ expand: "str" },
	{
		type: "str",
		match: /(>|\|)\r?\n((\s[^\n]*)?(\r?\n|$))*/g
	},
	{
		type: "type",
		match: /!![a-z]+/g
	},
	{
		type: "bool",
		match: /\b(Yes|No)\b/g
	},
	{
		type: "oper",
		match: /[+:-]/g
	},
	{ expand: "num" },
	{
		type: "var",
		match: /[a-zA-Z][\w-]*(?=:)/g
	}
];
//#endregion
//#region ../../node_modules/.pnpm/@speed-highlight+core@2.1.0/node_modules/@speed-highlight/core/dist/tokenize.js
var u = {
	num: {
		type: "num",
		match: /(\.e?|\b)\d(e-|[\d.oxa-fA-F_])*(\.|\b)/g
	},
	str: {
		type: "str",
		match: /(["'])(\\[^]|(?!\1)[^\r\n\\])*\1?/g
	},
	strDouble: {
		type: "str",
		match: /"((?!")[^\r\n\\]|\\[^])*"?/g
	}
};
function* s(i, d, l, r) {
	let a = 0;
	try {
		let t, p, e = {}, x, n = [], h = typeof d == "string" ? yield d : d, c = [...h.sub ?? h];
		for (; a < i.length;) {
			for (e.index = null, t = c.length; t-- > 0;) {
				if (p = c[t].expand ? u[c[t].expand] : c[t], n[t] === void 0 || n[t].match.index < a) {
					if (p.match.lastIndex = a, x = p.match.exec(i), x === null) {
						c.splice(t, 1), n.splice(t, 1);
						continue;
					}
					n[t] = {
						match: x,
						lastIndex: p.match.lastIndex
					};
				}
				n[t].match[0] && (n[t].match.index <= e.index || e.index === null) && (e = {
					part: p,
					index: n[t].match.index,
					match: n[t].match[0],
					end: n[t].lastIndex
				});
			}
			if (e.index === null) break;
			l(i.slice(a, e.index), h.type), a = e.index, e.part.sub ? yield* s(e.match, typeof e.part.sub == "string" ? e.part.sub : typeof e.part.sub == "function" ? e.part.sub(e.match) : e.part, l, e.part.type) : l(e.match, e.part.type), a = e.end;
		}
		l(i.slice(a, i.length), h.type);
	} catch {
		l(i.slice(a), r);
	}
}
function m(i, d, l, r = {}) {
	let a = s(i, d, l), t = a.next();
	for (; !t.done;) t = a.next(r.languages?.[t.value]);
}
//#endregion
//#region src/utils/highlight.ts
/**
* The HTML rules with embedded script blocks read as TypeScript, which is what
* a single-file component's `<script setup lang="ts">` almost always holds.
*/
function typedScripts(grammar) {
	return grammar.map((rule) => {
		const sub = "sub" in rule ? rule.sub : void 0;
		if (sub === "js") return {
			...rule,
			sub: "ts"
		};
		if (Array.isArray(sub)) return {
			...rule,
			sub: typedScripts(sub)
		};
		return rule;
	});
}
/**
* The languages `highlight` can be asked for, plus the ones their definitions
* reach through a nested `sub`. Importing each definition by its own subpath
* keeps the unused ones out of the bundle.
*/
const LANGUAGES = {
	bash: t$8,
	css: t$7,
	diff: t$6,
	html: F,
	http: c,
	js: s$1,
	jsdoc: a,
	json: t$4,
	md: [{
		type: "section",
		match: /^#{1,6} .*/gm
	}, ...r],
	py: t$3,
	regex: t$2,
	todo: t$1,
	ts: p,
	vue: typedScripts(F),
	yaml: t
};
const ALIASES = {
	console: "bash",
	javascript: "js",
	markdown: "md",
	mjs: "js",
	mts: "ts",
	patch: "diff",
	python: "py",
	sh: "bash",
	shell: "bash",
	typescript: "ts",
	xml: "html",
	yml: "yaml",
	zsh: "bash"
};
/**
* Markdown hands us the whole info string of a fence, which in Nuxt docs is
* routinely `ts twoslash` or `vue [app.vue]`, so only the first word counts.
* An unknown language stays unresolved, so its region keeps the type of the
* rule embedding it.
*/
const RESOLVER = new Proxy(LANGUAGES, { get(languages, name) {
	const key = name.trim().split(/[\s,{[]/)[0].toLowerCase();
	return languages[ALIASES[key] ?? key];
} });
const THEME = {
	bool: "yellow",
	class: "yellow",
	cmnt: "gray",
	deleted: "red",
	err: "red",
	esc: "cyan",
	func: "cyan",
	insert: "green",
	kwd: "magenta",
	num: "magenta",
	oper: "dim",
	section: "magenta",
	str: "green",
	type: "blue",
	var: "blue"
};
/**
* Colour the tokens of a document, leaving its text untouched.
*
* `styleText` writes no escapes when stdout cannot show them, so piped output
* stays parseable by `jq` and friends.
*/
function highlight(code, language) {
	let output = "";
	try {
		m(code, LANGUAGES[language], (text, token) => {
			const style = token && THEME[token];
			output += style && text ? styleText(style, text) : text;
		}, { languages: RESOLVER });
	} catch {
		return code;
	}
	return output;
}
//#endregion
export { highlight as t };
