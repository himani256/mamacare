"use strict";

const fs = require("fs");
const path = require("path");

const sharedZodPath = path.join(
  __dirname,
  "..",
  "node_modules",
  "next",
  "dist",
  "shared",
  "lib",
  "zod.js",
);

const compiledEntryPath = path.join(
  __dirname,
  "..",
  "node_modules",
  "next",
  "dist",
  "compiled",
  "zod",
  "index.js",
);

const sharedFileContents = `"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportZodError = reportZodError;
exports.formatZodError = formatZodError;
exports.normalizeZodErrors = normalizeZodErrors;
const zod_1 = require("next/dist/compiled/zod");
const zod_validation_error_1 = require("next/dist/compiled/zod-validation-error");
const Log = require("../../build/output/log");
function processZodErrorMessage(issue) {
    let message = issue.message;
    let path;
    if (issue.path.length > 0) {
        if (issue.path.length === 1) {
            const identifier = issue.path[0];
            if (typeof identifier === "number") {
                path = \`index \${identifier}\`;
            }
            else {
                path = \`"\${identifier}"\`;
            }
        }
        else {
            path = \`"\${issue.path.reduce((acc, cur) => {
                if (typeof cur === "number") {
                    return \`\${acc}[\${cur}]\`;
                }
                if (cur.includes('"')) {
                    return \`\${acc}["\${cur.replaceAll('"', '\\\\\\"')}"]\`;
                }
                const separator = acc.length === 0 ? "" : ".";
                return acc + separator + cur;
            }, "")}"\`;
        }
    }
    else {
        path = "";
    }
    if (issue.code === "invalid_type" &&
        issue.received === zod_1.ZodParsedType.undefined) {
        return \`\${path} is missing, expected \${issue.expected}\`;
    }
    if (issue.code === "invalid_enum_value") {
        return \`Expected \${(0, zod_1.util.joinValues)(issue.options)}, received '\${issue.received}' at \${path}\`;
    }
    return message + (path ? \` at \${path}\` : "");
}
function normalizeZodErrors(error) {
    return error.issues.flatMap((issue) => {
        const issues = [{ issue, message: processZodErrorMessage(issue) }];
        if ("unionErrors" in issue) {
            for (const unionError of issue.unionErrors) {
                issues.push(...normalizeZodErrors(unionError));
            }
        }
        return issues;
    });
}
function formatZodError(prefix, error) {
    return new Error((0, zod_validation_error_1.fromZodError)(error, { prefix }).toString());
}
function reportZodError(prefix, error) {
    Log.error(formatZodError(prefix, error).message);
}
`;

const compiledEntryContents = `"use strict";
const zod = require("./index.cjs");
module.exports = zod;
`;

function ensureSharedZodHelper() {
  if (fs.existsSync(sharedZodPath)) {
    return false;
  }

  fs.mkdirSync(path.dirname(sharedZodPath), { recursive: true });
  fs.writeFileSync(sharedZodPath, sharedFileContents, "utf8");
  return true;
}

function ensureCompiledEntry() {
  if (fs.existsSync(compiledEntryPath)) {
    return false;
  }

  fs.mkdirSync(path.dirname(compiledEntryPath), { recursive: true });
  fs.writeFileSync(compiledEntryPath, compiledEntryContents, "utf8");
  return true;
}

const sharedCreated = ensureSharedZodHelper();
const entryCreated = ensureCompiledEntry();

if (sharedCreated || entryCreated) {
  console.log("Patched missing Next zod helper files.");
}

