// include: shell.js
// The Module object: Our interface to the outside world. We import
// and export values on it. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(moduleArg) => Promise<Module>
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to check if Module already exists (e.g. case 3 above).
// Substitution will be replaced with actual code on later stage of the build,
// this way Closure Compiler will not mangle it (e.g. case 4. above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
var Module = typeof libopenmpt != "undefined" ? libopenmpt : {};

// Determine the runtime environment we are in. You can customize this by
// setting the ENVIRONMENT setting at compile time (see settings.js).
// Attempt to auto-detect the environment
var ENVIRONMENT_IS_WEB = typeof window == "object";

var ENVIRONMENT_IS_WORKER = typeof WorkerGlobalScope != "undefined";

// N.b. Electron.js environment is simultaneously a NODE-environment, but
// also a web environment.
var ENVIRONMENT_IS_NODE = typeof process == "object" && typeof process.versions == "object" && typeof process.versions.node == "string" && process.type != "renderer";

if (ENVIRONMENT_IS_NODE) {}

// --pre-jses are emitted after the Module integration code, so that they can
// refer to Module (if they choose; they can also define Module)
// Sometimes an existing Module object exists with properties
// meant to overwrite the default module functionality. Here
// we collect those properties and reapply _after_ we configure
// the current environment's defaults to avoid having to be so
// defensive during initialization.
var moduleOverrides = Object.assign({}, Module);

var arguments_ = [];

var thisProgram = "./this.program";

var quit_ = (status, toThrow) => {
  throw toThrow;
};

// `/` should be present at the end if `scriptDirectory` is not empty
var scriptDirectory = "";

function locateFile(path) {
  if (Module["locateFile"]) {
    return Module["locateFile"](path, scriptDirectory);
  }
  return scriptDirectory + path;
}

// Hooks that are implemented differently in different runtime environments.
var readAsync, readBinary;

if (ENVIRONMENT_IS_NODE) {
  // These modules will usually be used on Node.js. Load them eagerly to avoid
  // the complexity of lazy-loading.
  var fs = require("fs");
  var nodePath = require("path");
  scriptDirectory = __dirname + "/";
  // include: node_shell_read.js
  readBinary = filename => {
    // We need to re-wrap `file://` strings to URLs.
    filename = isFileURI(filename) ? new URL(filename) : filename;
    var ret = fs.readFileSync(filename);
    return ret;
  };
  readAsync = async (filename, binary = true) => {
    // See the comment in the `readBinary` function.
    filename = isFileURI(filename) ? new URL(filename) : filename;
    var ret = fs.readFileSync(filename, binary ? undefined : "utf8");
    return ret;
  };
  // end include: node_shell_read.js
  if (!Module["thisProgram"] && process.argv.length > 1) {
    thisProgram = process.argv[1].replace(/\\/g, "/");
  }
  arguments_ = process.argv.slice(2);
  if (typeof module != "undefined") {
    module["exports"] = Module;
  }
  quit_ = (status, toThrow) => {
    process.exitCode = status;
    throw toThrow;
  };
} else // Note that this includes Node.js workers when relevant (pthreads is enabled).
// Node.js workers are detected as a combination of ENVIRONMENT_IS_WORKER and
// ENVIRONMENT_IS_NODE.
if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  if (ENVIRONMENT_IS_WORKER) {
    // Check worker, not web, since window could be polyfilled
    scriptDirectory = self.location.href;
  } else if (typeof document != "undefined" && document.currentScript) {
    // web
    scriptDirectory = document.currentScript.src;
  }
  // blob urls look like blob:http://site.com/etc/etc and we cannot infer anything from them.
  // otherwise, slice off the final part of the url to find the script directory.
  // if scriptDirectory does not contain a slash, lastIndexOf will return -1,
  // and scriptDirectory will correctly be replaced with an empty string.
  // If scriptDirectory contains a query (starting with ?) or a fragment (starting with #),
  // they are removed because they could contain a slash.
  if (scriptDirectory.startsWith("blob:")) {
    scriptDirectory = "";
  } else {
    scriptDirectory = scriptDirectory.substr(0, scriptDirectory.replace(/[?#].*/, "").lastIndexOf("/") + 1);
  }
  {
    // include: web_or_worker_shell_read.js
    if (ENVIRONMENT_IS_WORKER) {
      readBinary = url => {
        var xhr = new XMLHttpRequest;
        xhr.open("GET", url, false);
        xhr.responseType = "arraybuffer";
        xhr.send(null);
        return new Uint8Array(/** @type{!ArrayBuffer} */ (xhr.response));
      };
    }
    readAsync = async url => {
      // Fetch has some additional restrictions over XHR, like it can't be used on a file:// url.
      // See https://github.com/github/fetch/pull/92#issuecomment-140665932
      // Cordova or Electron apps are typically loaded from a file:// url.
      // So use XHR on webview if URL is a file URL.
      if (isFileURI(url)) {
        return new Promise((resolve, reject) => {
          var xhr = new XMLHttpRequest;
          xhr.open("GET", url, true);
          xhr.responseType = "arraybuffer";
          xhr.onload = () => {
            if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) {
              // file URLs can return 0
              resolve(xhr.response);
              return;
            }
            reject(xhr.status);
          };
          xhr.onerror = reject;
          xhr.send(null);
        });
      }
      var response = await fetch(url, {
        credentials: "same-origin"
      });
      if (response.ok) {
        return response.arrayBuffer();
      }
      throw new Error(response.status + " : " + response.url);
    };
  }
} else // end include: web_or_worker_shell_read.js
{}

var out = Module["print"] || console.log.bind(console);

var err = Module["printErr"] || console.error.bind(console);

// Merge back in the overrides
Object.assign(Module, moduleOverrides);

// Free the object hierarchy contained in the overrides, this lets the GC
// reclaim data used.
moduleOverrides = null;

// Emit code to handle expected values on the Module object. This applies Module.x
// to the proper local x. This has two benefits: first, we only emit it if it is
// expected to arrive, and second, by using a local everywhere else that can be
// minified.
if (Module["arguments"]) arguments_ = Module["arguments"];

if (Module["thisProgram"]) thisProgram = Module["thisProgram"];

// perform assertions in shell.js after we set up out() and err(), as otherwise if an assertion fails it cannot print the message
// end include: shell.js
// include: preamble.js
// === Preamble library stuff ===
// Documentation for the public APIs defined in this file must be updated in:
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at:
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html
var wasmBinary = Module["wasmBinary"];

// Wasm globals
var wasmMemory;

//========================================
// Runtime essentials
//========================================
// whether we are quitting the application. no code should run after this.
// set in exit() and abort()
var ABORT = false;

// set by exit() and abort().  Passed to 'onExit' handler.
// NOTE: This is also used as the process return code code in shell environments
// but only when noExitRuntime is false.
var EXITSTATUS;

// Memory management
var /** @type {!Int8Array} */ HEAP8, /** @type {!Uint8Array} */ HEAPU8, /** @type {!Int16Array} */ HEAP16, /** @type {!Uint16Array} */ HEAPU16, /** @type {!Int32Array} */ HEAP32, /** @type {!Uint32Array} */ HEAPU32, /** @type {!Float32Array} */ HEAPF32, /** @type {!Float64Array} */ HEAPF64;

// include: runtime_shared.js
function updateMemoryViews() {
  var b = wasmMemory.buffer;
  Module["HEAP8"] = HEAP8 = new Int8Array(b);
  Module["HEAP16"] = HEAP16 = new Int16Array(b);
  Module["HEAPU8"] = HEAPU8 = new Uint8Array(b);
  Module["HEAPU16"] = HEAPU16 = new Uint16Array(b);
  Module["HEAP32"] = HEAP32 = new Int32Array(b);
  Module["HEAPU32"] = HEAPU32 = new Uint32Array(b);
  Module["HEAPF32"] = HEAPF32 = new Float32Array(b);
  Module["HEAPF64"] = HEAPF64 = new Float64Array(b);
}

// end include: runtime_shared.js
// include: runtime_stack_check.js
// end include: runtime_stack_check.js
var __ATPRERUN__ = [];

// functions called before the runtime is initialized
var __ATINIT__ = [];

// functions called during shutdown
var __ATPOSTRUN__ = [];

// functions called after the main() is called
var runtimeInitialized = false;

function preRun() {
  if (Module["preRun"]) {
    if (typeof Module["preRun"] == "function") Module["preRun"] = [ Module["preRun"] ];
    while (Module["preRun"].length) {
      addOnPreRun(Module["preRun"].shift());
    }
  }
  callRuntimeCallbacks(__ATPRERUN__);
}

function initRuntime() {
  runtimeInitialized = true;
  if (!Module["noFSInit"] && !FS.initialized) FS.init();
  FS.ignorePermissions = false;
  TTY.init();
  callRuntimeCallbacks(__ATINIT__);
}

function postRun() {
  if (Module["postRun"]) {
    if (typeof Module["postRun"] == "function") Module["postRun"] = [ Module["postRun"] ];
    while (Module["postRun"].length) {
      addOnPostRun(Module["postRun"].shift());
    }
  }
  callRuntimeCallbacks(__ATPOSTRUN__);
}

function addOnPreRun(cb) {
  __ATPRERUN__.unshift(cb);
}

function addOnInit(cb) {
  __ATINIT__.unshift(cb);
}

function addOnPostRun(cb) {
  __ATPOSTRUN__.unshift(cb);
}

// include: runtime_math.js
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/imul
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/fround
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/clz32
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/trunc
// end include: runtime_math.js
// A counter of dependencies for calling run(). If we need to
// do asynchronous work before running, increment this and
// decrement it. Incrementing must happen in a place like
// Module.preRun (used by emcc to add file preloading).
// Note that you can add dependencies in preRun, even though
// it happens right before run - run will be postponed until
// the dependencies are met.
var runDependencies = 0;

var dependenciesFulfilled = null;

// overridden to take different actions when all run dependencies are fulfilled
function getUniqueRunDependency(id) {
  return id;
}

function addRunDependency(id) {
  runDependencies++;
  Module["monitorRunDependencies"]?.(runDependencies);
}

function removeRunDependency(id) {
  runDependencies--;
  Module["monitorRunDependencies"]?.(runDependencies);
  if (runDependencies == 0) {
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback();
    }
  }
}

/** @param {string|number=} what */ function abort(what) {
  Module["onAbort"]?.(what);
  what = "Aborted(" + what + ")";
  // TODO(sbc): Should we remove printing and leave it up to whoever
  // catches the exception?
  err(what);
  ABORT = true;
  what += ". Build with -sASSERTIONS for more info.";
  // Use a wasm runtime error, because a JS error might be seen as a foreign
  // exception, which means we'd run destructors on it. We need the error to
  // simply make the program stop.
  // FIXME This approach does not work in Wasm EH because it currently does not assume
  // all RuntimeErrors are from traps; it decides whether a RuntimeError is from
  // a trap or not based on a hidden field within the object. So at the moment
  // we don't have a way of throwing a wasm trap from JS. TODO Make a JS API that
  // allows this in the wasm spec.
  // Suppress closure compiler warning here. Closure compiler's builtin extern
  // definition for WebAssembly.RuntimeError claims it takes no arguments even
  // though it can.
  // TODO(https://github.com/google/closure-compiler/pull/3913): Remove if/when upstream closure gets fixed.
  /** @suppress {checkTypes} */ var e = new WebAssembly.RuntimeError(what);
  // Throw the error whether or not MODULARIZE is set because abort is used
  // in code paths apart from instantiation where an exception is expected
  // to be thrown when abort is called.
  throw e;
}

// include: memoryprofiler.js
// end include: memoryprofiler.js
// include: URIUtils.js
// Prefix of data URIs emitted by SINGLE_FILE and related options.
var dataURIPrefix = "data:application/octet-stream;base64,";

/**
 * Indicates whether filename is a base64 data URI.
 * @noinline
 */ var isDataURI = filename => filename.startsWith(dataURIPrefix);

/**
 * Indicates whether filename is delivered via file protocol (as opposed to http/https)
 * @noinline
 */ var isFileURI = filename => filename.startsWith("file://");

// end include: URIUtils.js
// include: runtime_exceptions.js
// end include: runtime_exceptions.js
function findWasmBinary() {
  var f = "libopenmpt.wasm";
  if (!isDataURI(f)) {
    return locateFile(f);
  }
  return f;
}

var wasmBinaryFile;

function getBinarySync(file) {
  if (file == wasmBinaryFile && wasmBinary) {
    return new Uint8Array(wasmBinary);
  }
  if (readBinary) {
    return readBinary(file);
  }
  throw "both async and sync fetching of the wasm failed";
}

async function getWasmBinary(binaryFile) {
  // If we don't have the binary yet, load it asynchronously using readAsync.
  if (!wasmBinary) {
    // Fetch the binary using readAsync
    try {
      var response = await readAsync(binaryFile);
      return new Uint8Array(response);
    } catch {}
  }
  // Otherwise, getBinarySync should be able to get it synchronously
  return getBinarySync(binaryFile);
}

async function instantiateArrayBuffer(binaryFile, imports) {
  try {
    var binary = await getWasmBinary(binaryFile);
    var instance = await WebAssembly.instantiate(binary, imports);
    return instance;
  } catch (reason) {
    err(`failed to asynchronously prepare wasm: ${reason}`);
    abort(reason);
  }
}

async function instantiateAsync(binary, binaryFile, imports) {
  if (!binary && typeof WebAssembly.instantiateStreaming == "function" && !isDataURI(binaryFile) && // Don't use streaming for file:// delivered objects in a webview, fetch them synchronously.
  !isFileURI(binaryFile) && // Avoid instantiateStreaming() on Node.js environment for now, as while
  // Node.js v18.1.0 implements it, it does not have a full fetch()
  // implementation yet.
  // Reference:
  //   https://github.com/emscripten-core/emscripten/pull/16917
  !ENVIRONMENT_IS_NODE && typeof fetch == "function") {
    try {
      var response = fetch(binaryFile, {
        credentials: "same-origin"
      });
      var instantiationResult = await WebAssembly.instantiateStreaming(response, imports);
      return instantiationResult;
    } catch (reason) {
      // We expect the most common failure cause to be a bad MIME type for the binary,
      // in which case falling back to ArrayBuffer instantiation should work.
      err(`wasm streaming compile failed: ${reason}`);
      err("falling back to ArrayBuffer instantiation");
    }
  }
  return instantiateArrayBuffer(binaryFile, imports);
}

function getWasmImports() {
  // prepare imports
  return {
    "a": wasmImports
  };
}

// Create the wasm instance.
// Receives the wasm imports, returns the exports.
async function createWasm() {
  // Load the wasm module and create an instance of using native support in the JS engine.
  // handle a generated wasm instance, receiving its exports and
  // performing other necessary setup
  /** @param {WebAssembly.Module=} module*/ function receiveInstance(instance, module) {
    wasmExports = instance.exports;
    wasmMemory = wasmExports["xa"];
    updateMemoryViews();
    wasmTable = wasmExports["af"];
    addOnInit(wasmExports["ya"]);
    removeRunDependency("wasm-instantiate");
    return wasmExports;
  }
  // wait for the pthread pool (if any)
  addRunDependency("wasm-instantiate");
  // Prefer streaming instantiation if available.
  function receiveInstantiationResult(result) {
    // 'result' is a ResultObject object which has both the module and instance.
    // receiveInstance() will swap in the exports (to Module.asm) so they can be called
    // TODO: Due to Closure regression https://github.com/google/closure-compiler/issues/3193, the above line no longer optimizes out down to the following line.
    // When the regression is fixed, can restore the above PTHREADS-enabled path.
    receiveInstance(result["instance"]);
  }
  var info = getWasmImports();
  // User shell pages can write their own Module.instantiateWasm = function(imports, successCallback) callback
  // to manually instantiate the Wasm module themselves. This allows pages to
  // run the instantiation parallel to any other async startup actions they are
  // performing.
  // Also pthreads and wasm workers initialize the wasm instance through this
  // path.
  if (Module["instantiateWasm"]) {
    try {
      return Module["instantiateWasm"](info, receiveInstance);
    } catch (e) {
      err(`Module.instantiateWasm callback failed with error: ${e}`);
      return false;
    }
  }
  wasmBinaryFile ??= findWasmBinary();
  var result = await instantiateAsync(wasmBinary, wasmBinaryFile, info);
  receiveInstantiationResult(result);
  return result;
}

// Globals used by JS i64 conversions (see makeSetValue)
var tempDouble;

var tempI64;

// include: runtime_debug.js
// end include: runtime_debug.js
// === Body ===
// end include: preamble.js
class ExitStatus {
  name="ExitStatus";
  constructor(status) {
    this.message = `Program terminated with exit(${status})`;
    this.status = status;
  }
}

var callRuntimeCallbacks = callbacks => {
  while (callbacks.length > 0) {
    // Pass the module as the first argument.
    callbacks.shift()(Module);
  }
};

var noExitRuntime = Module["noExitRuntime"] || true;

var stackRestore = val => __emscripten_stack_restore(val);

var stackSave = () => _emscripten_stack_get_current();

var UTF8Decoder = typeof TextDecoder != "undefined" ? new TextDecoder : undefined;

/**
     * Given a pointer 'idx' to a null-terminated UTF8-encoded string in the given
     * array that contains uint8 values, returns a copy of that string as a
     * Javascript String object.
     * heapOrArray is either a regular array, or a JavaScript typed array view.
     * @param {number=} idx
     * @param {number=} maxBytesToRead
     * @return {string}
     */ var UTF8ArrayToString = (heapOrArray, idx = 0, maxBytesToRead = NaN) => {
  var endIdx = idx + maxBytesToRead;
  var endPtr = idx;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on
  // null terminator by itself.  Also, use the length info to avoid running tiny
  // strings through TextDecoder, since .subarray() allocates garbage.
  // (As a tiny code save trick, compare endPtr against endIdx using a negation,
  // so that undefined/NaN means Infinity)
  while (heapOrArray[endPtr] && !(endPtr >= endIdx)) ++endPtr;
  if (endPtr - idx > 16 && heapOrArray.buffer && UTF8Decoder) {
    return UTF8Decoder.decode(heapOrArray.subarray(idx, endPtr));
  }
  var str = "";
  // If building with TextDecoder, we have already computed the string length
  // above, so test loop end condition against that
  while (idx < endPtr) {
    // For UTF8 byte structure, see:
    // http://en.wikipedia.org/wiki/UTF-8#Description
    // https://www.ietf.org/rfc/rfc2279.txt
    // https://tools.ietf.org/html/rfc3629
    var u0 = heapOrArray[idx++];
    if (!(u0 & 128)) {
      str += String.fromCharCode(u0);
      continue;
    }
    var u1 = heapOrArray[idx++] & 63;
    if ((u0 & 224) == 192) {
      str += String.fromCharCode(((u0 & 31) << 6) | u1);
      continue;
    }
    var u2 = heapOrArray[idx++] & 63;
    if ((u0 & 240) == 224) {
      u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
    } else {
      u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | (heapOrArray[idx++] & 63);
    }
    if (u0 < 65536) {
      str += String.fromCharCode(u0);
    } else {
      var ch = u0 - 65536;
      str += String.fromCharCode(55296 | (ch >> 10), 56320 | (ch & 1023));
    }
  }
  return str;
};

/**
     * Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the
     * emscripten HEAP, returns a copy of that string as a Javascript String object.
     *
     * @param {number} ptr
     * @param {number=} maxBytesToRead - An optional length that specifies the
     *   maximum number of bytes to read. You can omit this parameter to scan the
     *   string until the first 0 byte. If maxBytesToRead is passed, and the string
     *   at [ptr, ptr+maxBytesToReadr[ contains a null byte in the middle, then the
     *   string will cut short at that byte index (i.e. maxBytesToRead will not
     *   produce a string of exact length [ptr, ptr+maxBytesToRead[) N.B. mixing
     *   frequent uses of UTF8ToString() with and without maxBytesToRead may throw
     *   JS JIT optimizations off, so it is worth to consider consistently using one
     * @return {string}
     */ var UTF8ToString = (ptr, maxBytesToRead) => ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : "";

var ___assert_fail = (condition, filename, line, func) => abort(`Assertion failed: ${UTF8ToString(condition)}, at: ` + [ filename ? UTF8ToString(filename) : "unknown filename", line, func ? UTF8ToString(func) : "unknown function" ]);

var exceptionCaught = [];

var uncaughtExceptionCount = 0;

var ___cxa_begin_catch = ptr => {
  var info = new ExceptionInfo(ptr);
  if (!info.get_caught()) {
    info.set_caught(true);
    uncaughtExceptionCount--;
  }
  info.set_rethrown(false);
  exceptionCaught.push(info);
  ___cxa_increment_exception_refcount(ptr);
  return ___cxa_get_exception_ptr(ptr);
};

var exceptionLast = 0;

var ___cxa_end_catch = () => {
  // Clear state flag.
  _setThrew(0, 0);
  // Call destructor if one is registered then clear it.
  var info = exceptionCaught.pop();
  ___cxa_decrement_exception_refcount(info.excPtr);
  exceptionLast = 0;
};

// XXX in decRef?
class ExceptionInfo {
  // excPtr - Thrown object pointer to wrap. Metadata pointer is calculated from it.
  constructor(excPtr) {
    this.excPtr = excPtr;
    this.ptr = excPtr - 24;
  }
  set_type(type) {
    HEAPU32[(((this.ptr) + (4)) >> 2)] = type;
  }
  get_type() {
    return HEAPU32[(((this.ptr) + (4)) >> 2)];
  }
  set_destructor(destructor) {
    HEAPU32[(((this.ptr) + (8)) >> 2)] = destructor;
  }
  get_destructor() {
    return HEAPU32[(((this.ptr) + (8)) >> 2)];
  }
  set_caught(caught) {
    caught = caught ? 1 : 0;
    HEAP8[(this.ptr) + (12)] = caught;
  }
  get_caught() {
    return HEAP8[(this.ptr) + (12)] != 0;
  }
  set_rethrown(rethrown) {
    rethrown = rethrown ? 1 : 0;
    HEAP8[(this.ptr) + (13)] = rethrown;
  }
  get_rethrown() {
    return HEAP8[(this.ptr) + (13)] != 0;
  }
  // Initialize native structure fields. Should be called once after allocated.
  init(type, destructor) {
    this.set_adjusted_ptr(0);
    this.set_type(type);
    this.set_destructor(destructor);
  }
  set_adjusted_ptr(adjustedPtr) {
    HEAPU32[(((this.ptr) + (16)) >> 2)] = adjustedPtr;
  }
  get_adjusted_ptr() {
    return HEAPU32[(((this.ptr) + (16)) >> 2)];
  }
}

var ___resumeException = ptr => {
  if (!exceptionLast) {
    exceptionLast = ptr;
  }
  throw exceptionLast;
};

var setTempRet0 = val => __emscripten_tempret_set(val);

var findMatchingCatch = args => {
  var thrown = exceptionLast;
  if (!thrown) {
    // just pass through the null ptr
    setTempRet0(0);
    return 0;
  }
  var info = new ExceptionInfo(thrown);
  info.set_adjusted_ptr(thrown);
  var thrownType = info.get_type();
  if (!thrownType) {
    // just pass through the thrown ptr
    setTempRet0(0);
    return thrown;
  }
  // can_catch receives a **, add indirection
  // The different catch blocks are denoted by different types.
  // Due to inheritance, those types may not precisely match the
  // type of the thrown object. Find one which matches, and
  // return the type of the catch block which should be called.
  for (var caughtType of args) {
    if (caughtType === 0 || caughtType === thrownType) {
      // Catch all clause matched or exactly the same type is caught
      break;
    }
    var adjusted_ptr_addr = info.ptr + 16;
    if (___cxa_can_catch(caughtType, thrownType, adjusted_ptr_addr)) {
      setTempRet0(caughtType);
      return thrown;
    }
  }
  setTempRet0(thrownType);
  return thrown;
};

var ___cxa_find_matching_catch_17 = (arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9, arg10, arg11, arg12, arg13, arg14) => findMatchingCatch([ arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9, arg10, arg11, arg12, arg13, arg14 ]);

var ___cxa_find_matching_catch_2 = () => findMatchingCatch([]);

var ___cxa_find_matching_catch_3 = arg0 => findMatchingCatch([ arg0 ]);

var ___cxa_find_matching_catch_4 = (arg0, arg1) => findMatchingCatch([ arg0, arg1 ]);

var ___cxa_find_matching_catch_6 = (arg0, arg1, arg2, arg3) => findMatchingCatch([ arg0, arg1, arg2, arg3 ]);

var ___cxa_rethrow = () => {
  var info = exceptionCaught.pop();
  if (!info) {
    abort("no exception to throw");
  }
  var ptr = info.excPtr;
  if (!info.get_rethrown()) {
    // Only pop if the corresponding push was through rethrow_primary_exception
    exceptionCaught.push(info);
    info.set_rethrown(true);
    info.set_caught(false);
    uncaughtExceptionCount++;
  }
  exceptionLast = ptr;
  throw exceptionLast;
};

var ___cxa_throw = (ptr, type, destructor) => {
  var info = new ExceptionInfo(ptr);
  // Initialize ExceptionInfo content after it was allocated in __cxa_allocate_exception.
  info.init(type, destructor);
  exceptionLast = ptr;
  uncaughtExceptionCount++;
  throw exceptionLast;
};

var ___cxa_uncaught_exceptions = () => uncaughtExceptionCount;

var __abort_js = () => abort("");

var runtimeKeepaliveCounter = 0;

var __emscripten_runtime_keepalive_clear = () => {
  noExitRuntime = false;
  runtimeKeepaliveCounter = 0;
};

var timers = {};

var handleException = e => {
  // Certain exception types we do not treat as errors since they are used for
  // internal control flow.
  // 1. ExitStatus, which is thrown by exit()
  // 2. "unwind", which is thrown by emscripten_unwind_to_js_event_loop() and others
  //    that wish to return to JS event loop.
  if (e instanceof ExitStatus || e == "unwind") {
    return EXITSTATUS;
  }
  quit_(1, e);
};

var keepRuntimeAlive = () => noExitRuntime || runtimeKeepaliveCounter > 0;

var _proc_exit = code => {
  EXITSTATUS = code;
  if (!keepRuntimeAlive()) {
    Module["onExit"]?.(code);
    ABORT = true;
  }
  quit_(code, new ExitStatus(code));
};

/** @suppress {duplicate } */ /** @param {boolean|number=} implicit */ var exitJS = (status, implicit) => {
  EXITSTATUS = status;
  _proc_exit(status);
};

var _exit = exitJS;

var maybeExit = () => {
  if (!keepRuntimeAlive()) {
    try {
      _exit(EXITSTATUS);
    } catch (e) {
      handleException(e);
    }
  }
};

var callUserCallback = func => {
  if (ABORT) {
    return;
  }
  try {
    func();
    maybeExit();
  } catch (e) {
    handleException(e);
  }
};

var _emscripten_get_now = () => performance.now();

var __setitimer_js = (which, timeout_ms) => {
  // First, clear any existing timer.
  if (timers[which]) {
    clearTimeout(timers[which].id);
    delete timers[which];
  }
  // A timeout of zero simply cancels the current timeout so we have nothing
  // more to do.
  if (!timeout_ms) return 0;
  var id = setTimeout(() => {
    delete timers[which];
    callUserCallback(() => __emscripten_timeout(which, _emscripten_get_now()));
  }, timeout_ms);
  timers[which] = {
    id,
    timeout_ms
  };
  return 0;
};

var stringToUTF8Array = (str, heap, outIdx, maxBytesToWrite) => {
  // Parameter maxBytesToWrite is not optional. Negative values, 0, null,
  // undefined and false each don't write out any bytes.
  if (!(maxBytesToWrite > 0)) return 0;
  var startIdx = outIdx;
  var endIdx = outIdx + maxBytesToWrite - 1;
  // -1 for string null terminator.
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code
    // unit, not a Unicode code point of the character! So decode
    // UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description
    // and https://www.ietf.org/rfc/rfc2279.txt
    // and https://tools.ietf.org/html/rfc3629
    var u = str.charCodeAt(i);
    // possibly a lead surrogate
    if (u >= 55296 && u <= 57343) {
      var u1 = str.charCodeAt(++i);
      u = 65536 + ((u & 1023) << 10) | (u1 & 1023);
    }
    if (u <= 127) {
      if (outIdx >= endIdx) break;
      heap[outIdx++] = u;
    } else if (u <= 2047) {
      if (outIdx + 1 >= endIdx) break;
      heap[outIdx++] = 192 | (u >> 6);
      heap[outIdx++] = 128 | (u & 63);
    } else if (u <= 65535) {
      if (outIdx + 2 >= endIdx) break;
      heap[outIdx++] = 224 | (u >> 12);
      heap[outIdx++] = 128 | ((u >> 6) & 63);
      heap[outIdx++] = 128 | (u & 63);
    } else {
      if (outIdx + 3 >= endIdx) break;
      heap[outIdx++] = 240 | (u >> 18);
      heap[outIdx++] = 128 | ((u >> 12) & 63);
      heap[outIdx++] = 128 | ((u >> 6) & 63);
      heap[outIdx++] = 128 | (u & 63);
    }
  }
  // Null-terminate the pointer to the buffer.
  heap[outIdx] = 0;
  return outIdx - startIdx;
};

var stringToUTF8 = (str, outPtr, maxBytesToWrite) => stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);

var __tzset_js = (timezone, daylight, std_name, dst_name) => {
  // TODO: Use (malleable) environment variables instead of system settings.
  var currentYear = (new Date).getFullYear();
  var winter = new Date(currentYear, 0, 1);
  var summer = new Date(currentYear, 6, 1);
  var winterOffset = winter.getTimezoneOffset();
  var summerOffset = summer.getTimezoneOffset();
  // Local standard timezone offset. Local standard time is not adjusted for
  // daylight savings.  This code uses the fact that getTimezoneOffset returns
  // a greater value during Standard Time versus Daylight Saving Time (DST).
  // Thus it determines the expected output during Standard Time, and it
  // compares whether the output of the given date the same (Standard) or less
  // (DST).
  var stdTimezoneOffset = Math.max(winterOffset, summerOffset);
  // timezone is specified as seconds west of UTC ("The external variable
  // `timezone` shall be set to the difference, in seconds, between
  // Coordinated Universal Time (UTC) and local standard time."), the same
  // as returned by stdTimezoneOffset.
  // See http://pubs.opengroup.org/onlinepubs/009695399/functions/tzset.html
  HEAPU32[((timezone) >> 2)] = stdTimezoneOffset * 60;
  HEAP32[((daylight) >> 2)] = Number(winterOffset != summerOffset);
  var extractZone = timezoneOffset => {
    // Why inverse sign?
    // Read here https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/getTimezoneOffset
    var sign = timezoneOffset >= 0 ? "-" : "+";
    var absOffset = Math.abs(timezoneOffset);
    var hours = String(Math.floor(absOffset / 60)).padStart(2, "0");
    var minutes = String(absOffset % 60).padStart(2, "0");
    return `UTC${sign}${hours}${minutes}`;
  };
  var winterName = extractZone(winterOffset);
  var summerName = extractZone(summerOffset);
  if (summerOffset < winterOffset) {
    // Northern hemisphere
    stringToUTF8(winterName, std_name, 17);
    stringToUTF8(summerName, dst_name, 17);
  } else {
    stringToUTF8(winterName, dst_name, 17);
    stringToUTF8(summerName, std_name, 17);
  }
};

var _emscripten_date_now = () => Date.now();

var nowIsMonotonic = 1;

var checkWasiClock = clock_id => clock_id >= 0 && clock_id <= 3;

var convertI32PairToI53Checked = (lo, hi) => ((hi + 2097152) >>> 0 < 4194305 - !!lo) ? (lo >>> 0) + hi * 4294967296 : NaN;

function _clock_time_get(clk_id, ignored_precision_low, ignored_precision_high, ptime) {
  var ignored_precision = convertI32PairToI53Checked(ignored_precision_low, ignored_precision_high);
  if (!checkWasiClock(clk_id)) {
    return 28;
  }
  var now;
  // all wasi clocks but realtime are monotonic
  if (clk_id === 0) {
    now = _emscripten_date_now();
  } else if (nowIsMonotonic) {
    now = _emscripten_get_now();
  } else {
    return 52;
  }
  // "now" is in ms, and wasi times are in ns.
  var nsec = Math.round(now * 1e3 * 1e3);
  (tempI64 = [ nsec >>> 0, (tempDouble = nsec, (+(Math.abs(tempDouble))) >= 1 ? (tempDouble > 0 ? (+(Math.floor((tempDouble) / 4294967296))) >>> 0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble))) >>> 0)) / 4294967296))))) >>> 0) : 0) ], 
  HEAP32[((ptime) >> 2)] = tempI64[0], HEAP32[(((ptime) + (4)) >> 2)] = tempI64[1]);
  return 0;
}

var getHeapMax = () => // Stay one Wasm page short of 4GB: while e.g. Chrome is able to allocate
// full 4GB Wasm memories, the size will wrap back to 0 bytes in Wasm side
// for any code that deals with heap sizes, which would require special
// casing all heap size related code to treat 0 specially.
2147483648;

var alignMemory = (size, alignment) => Math.ceil(size / alignment) * alignment;

var growMemory = size => {
  var b = wasmMemory.buffer;
  var pages = ((size - b.byteLength + 65535) / 65536) | 0;
  try {
    // round size grow request up to wasm page size (fixed 64KB per spec)
    wasmMemory.grow(pages);
    // .grow() takes a delta compared to the previous size
    updateMemoryViews();
    return 1;
  } /*success*/ catch (e) {}
};

// implicit 0 return to save code size (caller will cast "undefined" into 0
// anyhow)
var _emscripten_resize_heap = requestedSize => {
  var oldSize = HEAPU8.length;
  // With CAN_ADDRESS_2GB or MEMORY64, pointers are already unsigned.
  requestedSize >>>= 0;
  // With multithreaded builds, races can happen (another thread might increase the size
  // in between), so return a failure, and let the caller retry.
  // Memory resize rules:
  // 1.  Always increase heap size to at least the requested size, rounded up
  //     to next page multiple.
  // 2a. If MEMORY_GROWTH_LINEAR_STEP == -1, excessively resize the heap
  //     geometrically: increase the heap size according to
  //     MEMORY_GROWTH_GEOMETRIC_STEP factor (default +20%), At most
  //     overreserve by MEMORY_GROWTH_GEOMETRIC_CAP bytes (default 96MB).
  // 2b. If MEMORY_GROWTH_LINEAR_STEP != -1, excessively resize the heap
  //     linearly: increase the heap size by at least
  //     MEMORY_GROWTH_LINEAR_STEP bytes.
  // 3.  Max size for the heap is capped at 2048MB-WASM_PAGE_SIZE, or by
  //     MAXIMUM_MEMORY, or by ASAN limit, depending on which is smallest
  // 4.  If we were unable to allocate as much memory, it may be due to
  //     over-eager decision to excessively reserve due to (3) above.
  //     Hence if an allocation fails, cut down on the amount of excess
  //     growth, in an attempt to succeed to perform a smaller allocation.
  // A limit is set for how much we can grow. We should not exceed that
  // (the wasm binary specifies it, so if we tried, we'd fail anyhow).
  var maxHeapSize = getHeapMax();
  if (requestedSize > maxHeapSize) {
    return false;
  }
  // Loop through potential heap size increases. If we attempt a too eager
  // reservation that fails, cut down on the attempted size and reserve a
  // smaller bump instead. (max 3 times, chosen somewhat arbitrarily)
  for (var cutDown = 1; cutDown <= 4; cutDown *= 2) {
    var overGrownHeapSize = oldSize * (1 + .2 / cutDown);
    // ensure geometric growth
    // but limit overreserving (default to capping at +96MB overgrowth at most)
    overGrownHeapSize = Math.min(overGrownHeapSize, requestedSize + 100663296);
    var newSize = Math.min(maxHeapSize, alignMemory(Math.max(requestedSize, overGrownHeapSize), 65536));
    var replacement = growMemory(newSize);
    if (replacement) {
      return true;
    }
  }
  return false;
};

var ENV = {};

var getExecutableName = () => thisProgram || "./this.program";

var getEnvStrings = () => {
  if (!getEnvStrings.strings) {
    // Default values.
    // Browser language detection #8751
    var lang = ((typeof navigator == "object" && navigator.languages && navigator.languages[0]) || "C").replace("-", "_") + ".UTF-8";
    var env = {
      "USER": "web_user",
      "LOGNAME": "web_user",
      "PATH": "/",
      "PWD": "/",
      "HOME": "/home/web_user",
      "LANG": lang,
      "_": getExecutableName()
    };
    // Apply the user-provided values, if any.
    for (var x in ENV) {
      // x is a key in ENV; if ENV[x] is undefined, that means it was
      // explicitly set to be so. We allow user code to do that to
      // force variables with default values to remain unset.
      if (ENV[x] === undefined) delete env[x]; else env[x] = ENV[x];
    }
    var strings = [];
    for (var x in env) {
      strings.push(`${x}=${env[x]}`);
    }
    getEnvStrings.strings = strings;
  }
  return getEnvStrings.strings;
};

var stringToAscii = (str, buffer) => {
  for (var i = 0; i < str.length; ++i) {
    HEAP8[buffer++] = str.charCodeAt(i);
  }
  // Null-terminate the string
  HEAP8[buffer] = 0;
};

var _environ_get = (__environ, environ_buf) => {
  var bufSize = 0;
  getEnvStrings().forEach((string, i) => {
    var ptr = environ_buf + bufSize;
    HEAPU32[(((__environ) + (i * 4)) >> 2)] = ptr;
    stringToAscii(string, ptr);
    bufSize += string.length + 1;
  });
  return 0;
};

var _environ_sizes_get = (penviron_count, penviron_buf_size) => {
  var strings = getEnvStrings();
  HEAPU32[((penviron_count) >> 2)] = strings.length;
  var bufSize = 0;
  strings.forEach(string => bufSize += string.length + 1);
  HEAPU32[((penviron_buf_size) >> 2)] = bufSize;
  return 0;
};

var PATH = {
  isAbs: path => path.charAt(0) === "/",
  splitPath: filename => {
    var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
    return splitPathRe.exec(filename).slice(1);
  },
  normalizeArray: (parts, allowAboveRoot) => {
    // if the path tries to go above the root, `up` ends up > 0
    var up = 0;
    for (var i = parts.length - 1; i >= 0; i--) {
      var last = parts[i];
      if (last === ".") {
        parts.splice(i, 1);
      } else if (last === "..") {
        parts.splice(i, 1);
        up++;
      } else if (up) {
        parts.splice(i, 1);
        up--;
      }
    }
    // if the path is allowed to go above the root, restore leading ..s
    if (allowAboveRoot) {
      for (;up; up--) {
        parts.unshift("..");
      }
    }
    return parts;
  },
  normalize: path => {
    var isAbsolute = PATH.isAbs(path), trailingSlash = path.substr(-1) === "/";
    // Normalize the path
    path = PATH.normalizeArray(path.split("/").filter(p => !!p), !isAbsolute).join("/");
    if (!path && !isAbsolute) {
      path = ".";
    }
    if (path && trailingSlash) {
      path += "/";
    }
    return (isAbsolute ? "/" : "") + path;
  },
  dirname: path => {
    var result = PATH.splitPath(path), root = result[0], dir = result[1];
    if (!root && !dir) {
      // No dirname whatsoever
      return ".";
    }
    if (dir) {
      // It has a dirname, strip trailing slash
      dir = dir.substr(0, dir.length - 1);
    }
    return root + dir;
  },
  basename: path => {
    // EMSCRIPTEN return '/'' for '/', not an empty string
    if (path === "/") return "/";
    path = PATH.normalize(path);
    path = path.replace(/\/$/, "");
    var lastSlash = path.lastIndexOf("/");
    if (lastSlash === -1) return path;
    return path.substr(lastSlash + 1);
  },
  join: (...paths) => PATH.normalize(paths.join("/")),
  join2: (l, r) => PATH.normalize(l + "/" + r)
};

var initRandomFill = () => {
  if (typeof crypto == "object" && typeof crypto["getRandomValues"] == "function") {
    // for modern web browsers
    return view => crypto.getRandomValues(view);
  } else if (ENVIRONMENT_IS_NODE) {
    // for nodejs with or without crypto support included
    try {
      var crypto_module = require("crypto");
      var randomFillSync = crypto_module["randomFillSync"];
      if (randomFillSync) {
        // nodejs with LTS crypto support
        return view => crypto_module["randomFillSync"](view);
      }
      // very old nodejs with the original crypto API
      var randomBytes = crypto_module["randomBytes"];
      return view => (view.set(randomBytes(view.byteLength)), // Return the original view to match modern native implementations.
      view);
    } catch (e) {}
  }
  // we couldn't find a proper implementation, as Math.random() is not suitable for /dev/random, see emscripten-core/emscripten/pull/7096
  abort("initRandomDevice");
};

var randomFill = view => (randomFill = initRandomFill())(view);

var PATH_FS = {
  resolve: (...args) => {
    var resolvedPath = "", resolvedAbsolute = false;
    for (var i = args.length - 1; i >= -1 && !resolvedAbsolute; i--) {
      var path = (i >= 0) ? args[i] : FS.cwd();
      // Skip empty and invalid entries
      if (typeof path != "string") {
        throw new TypeError("Arguments to path.resolve must be strings");
      } else if (!path) {
        return "";
      }
      // an invalid portion invalidates the whole thing
      resolvedPath = path + "/" + resolvedPath;
      resolvedAbsolute = PATH.isAbs(path);
    }
    // At this point the path should be resolved to a full absolute path, but
    // handle relative paths to be safe (might happen when process.cwd() fails)
    resolvedPath = PATH.normalizeArray(resolvedPath.split("/").filter(p => !!p), !resolvedAbsolute).join("/");
    return ((resolvedAbsolute ? "/" : "") + resolvedPath) || ".";
  },
  relative: (from, to) => {
    from = PATH_FS.resolve(from).substr(1);
    to = PATH_FS.resolve(to).substr(1);
    function trim(arr) {
      var start = 0;
      for (;start < arr.length; start++) {
        if (arr[start] !== "") break;
      }
      var end = arr.length - 1;
      for (;end >= 0; end--) {
        if (arr[end] !== "") break;
      }
      if (start > end) return [];
      return arr.slice(start, end - start + 1);
    }
    var fromParts = trim(from.split("/"));
    var toParts = trim(to.split("/"));
    var length = Math.min(fromParts.length, toParts.length);
    var samePartsLength = length;
    for (var i = 0; i < length; i++) {
      if (fromParts[i] !== toParts[i]) {
        samePartsLength = i;
        break;
      }
    }
    var outputParts = [];
    for (var i = samePartsLength; i < fromParts.length; i++) {
      outputParts.push("..");
    }
    outputParts = outputParts.concat(toParts.slice(samePartsLength));
    return outputParts.join("/");
  }
};

var FS_stdin_getChar_buffer = [];

var lengthBytesUTF8 = str => {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code
    // unit, not a Unicode code point of the character! So decode
    // UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var c = str.charCodeAt(i);
    // possibly a lead surrogate
    if (c <= 127) {
      len++;
    } else if (c <= 2047) {
      len += 2;
    } else if (c >= 55296 && c <= 57343) {
      len += 4;
      ++i;
    } else {
      len += 3;
    }
  }
  return len;
};

/** @type {function(string, boolean=, number=)} */ function intArrayFromString(stringy, dontAddNull, length) {
  var len = length > 0 ? length : lengthBytesUTF8(stringy) + 1;
  var u8array = new Array(len);
  var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
  if (dontAddNull) u8array.length = numBytesWritten;
  return u8array;
}

var FS_stdin_getChar = () => {
  if (!FS_stdin_getChar_buffer.length) {
    var result = null;
    if (ENVIRONMENT_IS_NODE) {
      // we will read data by chunks of BUFSIZE
      var BUFSIZE = 256;
      var buf = Buffer.alloc(BUFSIZE);
      var bytesRead = 0;
      // For some reason we must suppress a closure warning here, even though
      // fd definitely exists on process.stdin, and is even the proper way to
      // get the fd of stdin,
      // https://github.com/nodejs/help/issues/2136#issuecomment-523649904
      // This started to happen after moving this logic out of library_tty.js,
      // so it is related to the surrounding code in some unclear manner.
      /** @suppress {missingProperties} */ var fd = process.stdin.fd;
      try {
        bytesRead = fs.readSync(fd, buf, 0, BUFSIZE);
      } catch (e) {
        // Cross-platform differences: on Windows, reading EOF throws an
        // exception, but on other OSes, reading EOF returns 0. Uniformize
        // behavior by treating the EOF exception to return 0.
        if (e.toString().includes("EOF")) bytesRead = 0; else throw e;
      }
      if (bytesRead > 0) {
        result = buf.slice(0, bytesRead).toString("utf-8");
      }
    } else if (typeof window != "undefined" && typeof window.prompt == "function") {
      // Browser.
      result = window.prompt("Input: ");
      // returns null on cancel
      if (result !== null) {
        result += "\n";
      }
    } else {}
    if (!result) {
      return null;
    }
    FS_stdin_getChar_buffer = intArrayFromString(result, true);
  }
  return FS_stdin_getChar_buffer.shift();
};

var TTY = {
  ttys: [],
  init() {},
  // https://github.com/emscripten-core/emscripten/pull/1555
  // if (ENVIRONMENT_IS_NODE) {
  //   // currently, FS.init does not distinguish if process.stdin is a file or TTY
  //   // device, it always assumes it's a TTY device. because of this, we're forcing
  //   // process.stdin to UTF8 encoding to at least make stdin reading compatible
  //   // with text files until FS.init can be refactored.
  //   process.stdin.setEncoding('utf8');
  // }
  shutdown() {},
  // https://github.com/emscripten-core/emscripten/pull/1555
  // if (ENVIRONMENT_IS_NODE) {
  //   // inolen: any idea as to why node -e 'process.stdin.read()' wouldn't exit immediately (with process.stdin being a tty)?
  //   // isaacs: because now it's reading from the stream, you've expressed interest in it, so that read() kicks off a _read() which creates a ReadReq operation
  //   // inolen: I thought read() in that case was a synchronous operation that just grabbed some amount of buffered data if it exists?
  //   // isaacs: it is. but it also triggers a _read() call, which calls readStart() on the handle
  //   // isaacs: do process.stdin.pause() and i'd think it'd probably close the pending call
  //   process.stdin.pause();
  // }
  register(dev, ops) {
    TTY.ttys[dev] = {
      input: [],
      output: [],
      ops
    };
    FS.registerDevice(dev, TTY.stream_ops);
  },
  stream_ops: {
    open(stream) {
      var tty = TTY.ttys[stream.node.rdev];
      if (!tty) {
        throw new FS.ErrnoError(43);
      }
      stream.tty = tty;
      stream.seekable = false;
    },
    close(stream) {
      // flush any pending line data
      stream.tty.ops.fsync(stream.tty);
    },
    fsync(stream) {
      stream.tty.ops.fsync(stream.tty);
    },
    read(stream, buffer, offset, length, pos) {
      /* ignored */ if (!stream.tty || !stream.tty.ops.get_char) {
        throw new FS.ErrnoError(60);
      }
      var bytesRead = 0;
      for (var i = 0; i < length; i++) {
        var result;
        try {
          result = stream.tty.ops.get_char(stream.tty);
        } catch (e) {
          throw new FS.ErrnoError(29);
        }
        if (result === undefined && bytesRead === 0) {
          throw new FS.ErrnoError(6);
        }
        if (result === null || result === undefined) break;
        bytesRead++;
        buffer[offset + i] = result;
      }
      if (bytesRead) {
        stream.node.atime = Date.now();
      }
      return bytesRead;
    },
    write(stream, buffer, offset, length, pos) {
      if (!stream.tty || !stream.tty.ops.put_char) {
        throw new FS.ErrnoError(60);
      }
      try {
        for (var i = 0; i < length; i++) {
          stream.tty.ops.put_char(stream.tty, buffer[offset + i]);
        }
      } catch (e) {
        throw new FS.ErrnoError(29);
      }
      if (length) {
        stream.node.mtime = stream.node.ctime = Date.now();
      }
      return i;
    }
  },
  default_tty_ops: {
    get_char(tty) {
      return FS_stdin_getChar();
    },
    put_char(tty, val) {
      if (val === null || val === 10) {
        out(UTF8ArrayToString(tty.output));
        tty.output = [];
      } else {
        if (val != 0) tty.output.push(val);
      }
    },
    // val == 0 would cut text output off in the middle.
    fsync(tty) {
      if (tty.output && tty.output.length > 0) {
        out(UTF8ArrayToString(tty.output));
        tty.output = [];
      }
    },
    ioctl_tcgets(tty) {
      // typical setting
      return {
        c_iflag: 25856,
        c_oflag: 5,
        c_cflag: 191,
        c_lflag: 35387,
        c_cc: [ 3, 28, 127, 21, 4, 0, 1, 0, 17, 19, 26, 0, 18, 15, 23, 22, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
      };
    },
    ioctl_tcsets(tty, optional_actions, data) {
      // currently just ignore
      return 0;
    },
    ioctl_tiocgwinsz(tty) {
      return [ 24, 80 ];
    }
  },
  default_tty1_ops: {
    put_char(tty, val) {
      if (val === null || val === 10) {
        err(UTF8ArrayToString(tty.output));
        tty.output = [];
      } else {
        if (val != 0) tty.output.push(val);
      }
    },
    fsync(tty) {
      if (tty.output && tty.output.length > 0) {
        err(UTF8ArrayToString(tty.output));
        tty.output = [];
      }
    }
  }
};

var mmapAlloc = size => {
  abort();
};

var MEMFS = {
  ops_table: null,
  mount(mount) {
    return MEMFS.createNode(null, "/", 16895, 0);
  },
  createNode(parent, name, mode, dev) {
    if (FS.isBlkdev(mode) || FS.isFIFO(mode)) {
      // no supported
      throw new FS.ErrnoError(63);
    }
    MEMFS.ops_table ||= {
      dir: {
        node: {
          getattr: MEMFS.node_ops.getattr,
          setattr: MEMFS.node_ops.setattr,
          lookup: MEMFS.node_ops.lookup,
          mknod: MEMFS.node_ops.mknod,
          rename: MEMFS.node_ops.rename,
          unlink: MEMFS.node_ops.unlink,
          rmdir: MEMFS.node_ops.rmdir,
          readdir: MEMFS.node_ops.readdir,
          symlink: MEMFS.node_ops.symlink
        },
        stream: {
          llseek: MEMFS.stream_ops.llseek
        }
      },
      file: {
        node: {
          getattr: MEMFS.node_ops.getattr,
          setattr: MEMFS.node_ops.setattr
        },
        stream: {
          llseek: MEMFS.stream_ops.llseek,
          read: MEMFS.stream_ops.read,
          write: MEMFS.stream_ops.write,
          allocate: MEMFS.stream_ops.allocate,
          mmap: MEMFS.stream_ops.mmap,
          msync: MEMFS.stream_ops.msync
        }
      },
      link: {
        node: {
          getattr: MEMFS.node_ops.getattr,
          setattr: MEMFS.node_ops.setattr,
          readlink: MEMFS.node_ops.readlink
        },
        stream: {}
      },
      chrdev: {
        node: {
          getattr: MEMFS.node_ops.getattr,
          setattr: MEMFS.node_ops.setattr
        },
        stream: FS.chrdev_stream_ops
      }
    };
    var node = FS.createNode(parent, name, mode, dev);
    if (FS.isDir(node.mode)) {
      node.node_ops = MEMFS.ops_table.dir.node;
      node.stream_ops = MEMFS.ops_table.dir.stream;
      node.contents = {};
    } else if (FS.isFile(node.mode)) {
      node.node_ops = MEMFS.ops_table.file.node;
      node.stream_ops = MEMFS.ops_table.file.stream;
      node.usedBytes = 0;
      // The actual number of bytes used in the typed array, as opposed to contents.length which gives the whole capacity.
      // When the byte data of the file is populated, this will point to either a typed array, or a normal JS array. Typed arrays are preferred
      // for performance, and used by default. However, typed arrays are not resizable like normal JS arrays are, so there is a small disk size
      // penalty involved for appending file writes that continuously grow a file similar to std::vector capacity vs used -scheme.
      node.contents = null;
    } else if (FS.isLink(node.mode)) {
      node.node_ops = MEMFS.ops_table.link.node;
      node.stream_ops = MEMFS.ops_table.link.stream;
    } else if (FS.isChrdev(node.mode)) {
      node.node_ops = MEMFS.ops_table.chrdev.node;
      node.stream_ops = MEMFS.ops_table.chrdev.stream;
    }
    node.atime = node.mtime = node.ctime = Date.now();
    // add the new node to the parent
    if (parent) {
      parent.contents[name] = node;
      parent.atime = parent.mtime = parent.ctime = node.atime;
    }
    return node;
  },
  getFileDataAsTypedArray(node) {
    if (!node.contents) return new Uint8Array(0);
    if (node.contents.subarray) return node.contents.subarray(0, node.usedBytes);
    // Make sure to not return excess unused bytes.
    return new Uint8Array(node.contents);
  },
  expandFileStorage(node, newCapacity) {
    var prevCapacity = node.contents ? node.contents.length : 0;
    if (prevCapacity >= newCapacity) return;
    // No need to expand, the storage was already large enough.
    // Don't expand strictly to the given requested limit if it's only a very small increase, but instead geometrically grow capacity.
    // For small filesizes (<1MB), perform size*2 geometric increase, but for large sizes, do a much more conservative size*1.125 increase to
    // avoid overshooting the allocation cap by a very large margin.
    var CAPACITY_DOUBLING_MAX = 1024 * 1024;
    newCapacity = Math.max(newCapacity, (prevCapacity * (prevCapacity < CAPACITY_DOUBLING_MAX ? 2 : 1.125)) >>> 0);
    if (prevCapacity != 0) newCapacity = Math.max(newCapacity, 256);
    // At minimum allocate 256b for each file when expanding.
    var oldContents = node.contents;
    node.contents = new Uint8Array(newCapacity);
    // Allocate new storage.
    if (node.usedBytes > 0) node.contents.set(oldContents.subarray(0, node.usedBytes), 0);
  },
  // Copy old data over to the new storage.
  resizeFileStorage(node, newSize) {
    if (node.usedBytes == newSize) return;
    if (newSize == 0) {
      node.contents = null;
      // Fully decommit when requesting a resize to zero.
      node.usedBytes = 0;
    } else {
      var oldContents = node.contents;
      node.contents = new Uint8Array(newSize);
      // Allocate new storage.
      if (oldContents) {
        node.contents.set(oldContents.subarray(0, Math.min(newSize, node.usedBytes)));
      }
      // Copy old data over to the new storage.
      node.usedBytes = newSize;
    }
  },
  node_ops: {
    getattr(node) {
      var attr = {};
      // device numbers reuse inode numbers.
      attr.dev = FS.isChrdev(node.mode) ? node.id : 1;
      attr.ino = node.id;
      attr.mode = node.mode;
      attr.nlink = 1;
      attr.uid = 0;
      attr.gid = 0;
      attr.rdev = node.rdev;
      if (FS.isDir(node.mode)) {
        attr.size = 4096;
      } else if (FS.isFile(node.mode)) {
        attr.size = node.usedBytes;
      } else if (FS.isLink(node.mode)) {
        attr.size = node.link.length;
      } else {
        attr.size = 0;
      }
      attr.atime = new Date(node.atime);
      attr.mtime = new Date(node.mtime);
      attr.ctime = new Date(node.ctime);
      // NOTE: In our implementation, st_blocks = Math.ceil(st_size/st_blksize),
      //       but this is not required by the standard.
      attr.blksize = 4096;
      attr.blocks = Math.ceil(attr.size / attr.blksize);
      return attr;
    },
    setattr(node, attr) {
      for (const key of [ "mode", "atime", "mtime", "ctime" ]) {
        if (attr[key]) {
          node[key] = attr[key];
        }
      }
      if (attr.size !== undefined) {
        MEMFS.resizeFileStorage(node, attr.size);
      }
    },
    lookup(parent, name) {
      throw MEMFS.doesNotExistError;
    },
    mknod(parent, name, mode, dev) {
      return MEMFS.createNode(parent, name, mode, dev);
    },
    rename(old_node, new_dir, new_name) {
      var new_node;
      try {
        new_node = FS.lookupNode(new_dir, new_name);
      } catch (e) {}
      if (new_node) {
        if (FS.isDir(old_node.mode)) {
          // if we're overwriting a directory at new_name, make sure it's empty.
          for (var i in new_node.contents) {
            throw new FS.ErrnoError(55);
          }
        }
        FS.hashRemoveNode(new_node);
      }
      // do the internal rewiring
      delete old_node.parent.contents[old_node.name];
      new_dir.contents[new_name] = old_node;
      old_node.name = new_name;
      new_dir.ctime = new_dir.mtime = old_node.parent.ctime = old_node.parent.mtime = Date.now();
    },
    unlink(parent, name) {
      delete parent.contents[name];
      parent.ctime = parent.mtime = Date.now();
    },
    rmdir(parent, name) {
      var node = FS.lookupNode(parent, name);
      for (var i in node.contents) {
        throw new FS.ErrnoError(55);
      }
      delete parent.contents[name];
      parent.ctime = parent.mtime = Date.now();
    },
    readdir(node) {
      return [ ".", "..", ...Object.keys(node.contents) ];
    },
    symlink(parent, newname, oldpath) {
      var node = MEMFS.createNode(parent, newname, 511 | 40960, 0);
      node.link = oldpath;
      return node;
    },
    readlink(node) {
      if (!FS.isLink(node.mode)) {
        throw new FS.ErrnoError(28);
      }
      return node.link;
    }
  },
  stream_ops: {
    read(stream, buffer, offset, length, position) {
      var contents = stream.node.contents;
      if (position >= stream.node.usedBytes) return 0;
      var size = Math.min(stream.node.usedBytes - position, length);
      if (size > 8 && contents.subarray) {
        // non-trivial, and typed array
        buffer.set(contents.subarray(position, position + size), offset);
      } else {
        for (var i = 0; i < size; i++) buffer[offset + i] = contents[position + i];
      }
      return size;
    },
    write(stream, buffer, offset, length, position, canOwn) {
      // If the buffer is located in main memory (HEAP), and if
      // memory can grow, we can't hold on to references of the
      // memory buffer, as they may get invalidated. That means we
      // need to do copy its contents.
      if (buffer.buffer === HEAP8.buffer) {
        canOwn = false;
      }
      if (!length) return 0;
      var node = stream.node;
      node.mtime = node.ctime = Date.now();
      if (buffer.subarray && (!node.contents || node.contents.subarray)) {
        // This write is from a typed array to a typed array?
        if (canOwn) {
          node.contents = buffer.subarray(offset, offset + length);
          node.usedBytes = length;
          return length;
        } else if (node.usedBytes === 0 && position === 0) {
          // If this is a simple first write to an empty file, do a fast set since we don't need to care about old data.
          node.contents = buffer.slice(offset, offset + length);
          node.usedBytes = length;
          return length;
        } else if (position + length <= node.usedBytes) {
          // Writing to an already allocated and used subrange of the file?
          node.contents.set(buffer.subarray(offset, offset + length), position);
          return length;
        }
      }
      // Appending to an existing file and we need to reallocate, or source data did not come as a typed array.
      MEMFS.expandFileStorage(node, position + length);
      if (node.contents.subarray && buffer.subarray) {
        // Use typed array write which is available.
        node.contents.set(buffer.subarray(offset, offset + length), position);
      } else {
        for (var i = 0; i < length; i++) {
          node.contents[position + i] = buffer[offset + i];
        }
      }
      node.usedBytes = Math.max(node.usedBytes, position + length);
      return length;
    },
    llseek(stream, offset, whence) {
      var position = offset;
      if (whence === 1) {
        position += stream.position;
      } else if (whence === 2) {
        if (FS.isFile(stream.node.mode)) {
          position += stream.node.usedBytes;
        }
      }
      if (position < 0) {
        throw new FS.ErrnoError(28);
      }
      return position;
    },
    allocate(stream, offset, length) {
      MEMFS.expandFileStorage(stream.node, offset + length);
      stream.node.usedBytes = Math.max(stream.node.usedBytes, offset + length);
    },
    mmap(stream, length, position, prot, flags) {
      if (!FS.isFile(stream.node.mode)) {
        throw new FS.ErrnoError(43);
      }
      var ptr;
      var allocated;
      var contents = stream.node.contents;
      // Only make a new copy when MAP_PRIVATE is specified.
      if (!(flags & 2) && contents && contents.buffer === HEAP8.buffer) {
        // We can't emulate MAP_SHARED when the file is not backed by the
        // buffer we're mapping to (e.g. the HEAP buffer).
        allocated = false;
        ptr = contents.byteOffset;
      } else {
        allocated = true;
        ptr = mmapAlloc(length);
        if (!ptr) {
          throw new FS.ErrnoError(48);
        }
        if (contents) {
          // Try to avoid unnecessary slices.
          if (position > 0 || position + length < contents.length) {
            if (contents.subarray) {
              contents = contents.subarray(position, position + length);
            } else {
              contents = Array.prototype.slice.call(contents, position, position + length);
            }
          }
          HEAP8.set(contents, ptr);
        }
      }
      return {
        ptr,
        allocated
      };
    },
    msync(stream, buffer, offset, length, mmapFlags) {
      MEMFS.stream_ops.write(stream, buffer, 0, length, offset, false);
      // should we check if bytesWritten and length are the same?
      return 0;
    }
  }
};

var asyncLoad = async url => {
  var arrayBuffer = await readAsync(url);
  return new Uint8Array(arrayBuffer);
};

var FS_createDataFile = (parent, name, fileData, canRead, canWrite, canOwn) => {
  FS.createDataFile(parent, name, fileData, canRead, canWrite, canOwn);
};

var preloadPlugins = Module["preloadPlugins"] || [];

var FS_handledByPreloadPlugin = (byteArray, fullname, finish, onerror) => {
  // Ensure plugins are ready.
  if (typeof Browser != "undefined") Browser.init();
  var handled = false;
  preloadPlugins.forEach(plugin => {
    if (handled) return;
    if (plugin["canHandle"](fullname)) {
      plugin["handle"](byteArray, fullname, finish, onerror);
      handled = true;
    }
  });
  return handled;
};

var FS_createPreloadedFile = (parent, name, url, canRead, canWrite, onload, onerror, dontCreateFile, canOwn, preFinish) => {
  // TODO we should allow people to just pass in a complete filename instead
  // of parent and name being that we just join them anyways
  var fullname = name ? PATH_FS.resolve(PATH.join2(parent, name)) : parent;
  var dep = getUniqueRunDependency(`cp ${fullname}`);
  // might have several active requests for the same fullname
  function processData(byteArray) {
    function finish(byteArray) {
      preFinish?.();
      if (!dontCreateFile) {
        FS_createDataFile(parent, name, byteArray, canRead, canWrite, canOwn);
      }
      onload?.();
      removeRunDependency(dep);
    }
    if (FS_handledByPreloadPlugin(byteArray, fullname, finish, () => {
      onerror?.();
      removeRunDependency(dep);
    })) {
      return;
    }
    finish(byteArray);
  }
  addRunDependency(dep);
  if (typeof url == "string") {
    asyncLoad(url).then(processData, onerror);
  } else {
    processData(url);
  }
};

var FS_modeStringToFlags = str => {
  var flagModes = {
    "r": 0,
    "r+": 2,
    "w": 512 | 64 | 1,
    "w+": 512 | 64 | 2,
    "a": 1024 | 64 | 1,
    "a+": 1024 | 64 | 2
  };
  var flags = flagModes[str];
  if (typeof flags == "undefined") {
    throw new Error(`Unknown file open mode: ${str}`);
  }
  return flags;
};

var FS_getMode = (canRead, canWrite) => {
  var mode = 0;
  if (canRead) mode |= 292 | 73;
  if (canWrite) mode |= 146;
  return mode;
};

var FS = {
  root: null,
  mounts: [],
  devices: {},
  streams: [],
  nextInode: 1,
  nameTable: null,
  currentPath: "/",
  initialized: false,
  ignorePermissions: true,
  ErrnoError: class {
    name="ErrnoError";
    // We set the `name` property to be able to identify `FS.ErrnoError`
    // - the `name` is a standard ECMA-262 property of error objects. Kind of good to have it anyway.
    // - when using PROXYFS, an error can come from an underlying FS
    // as different FS objects have their own FS.ErrnoError each,
    // the test `err instanceof FS.ErrnoError` won't detect an error coming from another filesystem, causing bugs.
    // we'll use the reliable test `err.name == "ErrnoError"` instead
    constructor(errno) {
      this.errno = errno;
    }
  },
  filesystems: null,
  syncFSRequests: 0,
  readFiles: {},
  FSStream: class {
    shared={};
    get object() {
      return this.node;
    }
    set object(val) {
      this.node = val;
    }
    get isRead() {
      return (this.flags & 2097155) !== 1;
    }
    get isWrite() {
      return (this.flags & 2097155) !== 0;
    }
    get isAppend() {
      return (this.flags & 1024);
    }
    get flags() {
      return this.shared.flags;
    }
    set flags(val) {
      this.shared.flags = val;
    }
    get position() {
      return this.shared.position;
    }
    set position(val) {
      this.shared.position = val;
    }
  },
  FSNode: class {
    node_ops={};
    stream_ops={};
    readMode=292 | 73;
    writeMode=146;
    mounted=null;
    constructor(parent, name, mode, rdev) {
      if (!parent) {
        parent = this;
      }
      // root node sets parent to itself
      this.parent = parent;
      this.mount = parent.mount;
      this.id = FS.nextInode++;
      this.name = name;
      this.mode = mode;
      this.rdev = rdev;
      this.atime = this.mtime = this.ctime = Date.now();
    }
    get read() {
      return (this.mode & this.readMode) === this.readMode;
    }
    set read(val) {
      val ? this.mode |= this.readMode : this.mode &= ~this.readMode;
    }
    get write() {
      return (this.mode & this.writeMode) === this.writeMode;
    }
    set write(val) {
      val ? this.mode |= this.writeMode : this.mode &= ~this.writeMode;
    }
    get isFolder() {
      return FS.isDir(this.mode);
    }
    get isDevice() {
      return FS.isChrdev(this.mode);
    }
  },
  lookupPath(path, opts = {}) {
    if (!path) return {
      path: "",
      node: null
    };
    opts.follow_mount ??= true;
    if (!PATH.isAbs(path)) {
      path = FS.cwd() + "/" + path;
    }
    // limit max consecutive symlinks to 40 (SYMLOOP_MAX).
    linkloop: for (var nlinks = 0; nlinks < 40; nlinks++) {
      // split the absolute path
      var parts = path.split("/").filter(p => !!p && (p !== "."));
      // start at the root
      var current = FS.root;
      var current_path = "/";
      for (var i = 0; i < parts.length; i++) {
        var islast = (i === parts.length - 1);
        if (islast && opts.parent) {
          // stop resolving
          break;
        }
        if (parts[i] === "..") {
          current_path = PATH.dirname(current_path);
          current = current.parent;
          continue;
        }
        current_path = PATH.join2(current_path, parts[i]);
        try {
          current = FS.lookupNode(current, parts[i]);
        } catch (e) {
          // if noent_okay is true, suppress a ENOENT in the last component
          // and return an object with an undefined node. This is needed for
          // resolving symlinks in the path when creating a file.
          if ((e?.errno === 44) && islast && opts.noent_okay) {
            return {
              path: current_path
            };
          }
          throw e;
        }
        // jump to the mount's root node if this is a mountpoint
        if (FS.isMountpoint(current) && (!islast || opts.follow_mount)) {
          current = current.mounted.root;
        }
        // by default, lookupPath will not follow a symlink if it is the final path component.
        // setting opts.follow = true will override this behavior.
        if (FS.isLink(current.mode) && (!islast || opts.follow)) {
          if (!current.node_ops.readlink) {
            throw new FS.ErrnoError(52);
          }
          var link = current.node_ops.readlink(current);
          if (!PATH.isAbs(link)) {
            link = PATH.dirname(current_path) + "/" + link;
          }
          path = link + "/" + parts.slice(i + 1).join("/");
          continue linkloop;
        }
      }
      return {
        path: current_path,
        node: current
      };
    }
    throw new FS.ErrnoError(32);
  },
  getPath(node) {
    var path;
    while (true) {
      if (FS.isRoot(node)) {
        var mount = node.mount.mountpoint;
        if (!path) return mount;
        return mount[mount.length - 1] !== "/" ? `${mount}/${path}` : mount + path;
      }
      path = path ? `${node.name}/${path}` : node.name;
      node = node.parent;
    }
  },
  hashName(parentid, name) {
    var hash = 0;
    for (var i = 0; i < name.length; i++) {
      hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
    }
    return ((parentid + hash) >>> 0) % FS.nameTable.length;
  },
  hashAddNode(node) {
    var hash = FS.hashName(node.parent.id, node.name);
    node.name_next = FS.nameTable[hash];
    FS.nameTable[hash] = node;
  },
  hashRemoveNode(node) {
    var hash = FS.hashName(node.parent.id, node.name);
    if (FS.nameTable[hash] === node) {
      FS.nameTable[hash] = node.name_next;
    } else {
      var current = FS.nameTable[hash];
      while (current) {
        if (current.name_next === node) {
          current.name_next = node.name_next;
          break;
        }
        current = current.name_next;
      }
    }
  },
  lookupNode(parent, name) {
    var errCode = FS.mayLookup(parent);
    if (errCode) {
      throw new FS.ErrnoError(errCode);
    }
    var hash = FS.hashName(parent.id, name);
    for (var node = FS.nameTable[hash]; node; node = node.name_next) {
      var nodeName = node.name;
      if (node.parent.id === parent.id && nodeName === name) {
        return node;
      }
    }
    // if we failed to find it in the cache, call into the VFS
    return FS.lookup(parent, name);
  },
  createNode(parent, name, mode, rdev) {
    var node = new FS.FSNode(parent, name, mode, rdev);
    FS.hashAddNode(node);
    return node;
  },
  destroyNode(node) {
    FS.hashRemoveNode(node);
  },
  isRoot(node) {
    return node === node.parent;
  },
  isMountpoint(node) {
    return !!node.mounted;
  },
  isFile(mode) {
    return (mode & 61440) === 32768;
  },
  isDir(mode) {
    return (mode & 61440) === 16384;
  },
  isLink(mode) {
    return (mode & 61440) === 40960;
  },
  isChrdev(mode) {
    return (mode & 61440) === 8192;
  },
  isBlkdev(mode) {
    return (mode & 61440) === 24576;
  },
  isFIFO(mode) {
    return (mode & 61440) === 4096;
  },
  isSocket(mode) {
    return (mode & 49152) === 49152;
  },
  flagsToPermissionString(flag) {
    var perms = [ "r", "w", "rw" ][flag & 3];
    if ((flag & 512)) {
      perms += "w";
    }
    return perms;
  },
  nodePermissions(node, perms) {
    if (FS.ignorePermissions) {
      return 0;
    }
    // return 0 if any user, group or owner bits are set.
    if (perms.includes("r") && !(node.mode & 292)) {
      return 2;
    } else if (perms.includes("w") && !(node.mode & 146)) {
      return 2;
    } else if (perms.includes("x") && !(node.mode & 73)) {
      return 2;
    }
    return 0;
  },
  mayLookup(dir) {
    if (!FS.isDir(dir.mode)) return 54;
    var errCode = FS.nodePermissions(dir, "x");
    if (errCode) return errCode;
    if (!dir.node_ops.lookup) return 2;
    return 0;
  },
  mayCreate(dir, name) {
    if (!FS.isDir(dir.mode)) {
      return 54;
    }
    try {
      var node = FS.lookupNode(dir, name);
      return 20;
    } catch (e) {}
    return FS.nodePermissions(dir, "wx");
  },
  mayDelete(dir, name, isdir) {
    var node;
    try {
      node = FS.lookupNode(dir, name);
    } catch (e) {
      return e.errno;
    }
    var errCode = FS.nodePermissions(dir, "wx");
    if (errCode) {
      return errCode;
    }
    if (isdir) {
      if (!FS.isDir(node.mode)) {
        return 54;
      }
      if (FS.isRoot(node) || FS.getPath(node) === FS.cwd()) {
        return 10;
      }
    } else {
      if (FS.isDir(node.mode)) {
        return 31;
      }
    }
    return 0;
  },
  mayOpen(node, flags) {
    if (!node) {
      return 44;
    }
    if (FS.isLink(node.mode)) {
      return 32;
    } else if (FS.isDir(node.mode)) {
      if (FS.flagsToPermissionString(flags) !== "r" || // opening for write
      (flags & 512)) {
        // TODO: check for O_SEARCH? (== search for dir only)
        return 31;
      }
    }
    return FS.nodePermissions(node, FS.flagsToPermissionString(flags));
  },
  MAX_OPEN_FDS: 4096,
  nextfd() {
    for (var fd = 0; fd <= FS.MAX_OPEN_FDS; fd++) {
      if (!FS.streams[fd]) {
        return fd;
      }
    }
    throw new FS.ErrnoError(33);
  },
  getStreamChecked(fd) {
    var stream = FS.getStream(fd);
    if (!stream) {
      throw new FS.ErrnoError(8);
    }
    return stream;
  },
  getStream: fd => FS.streams[fd],
  createStream(stream, fd = -1) {
    // clone it, so we can return an instance of FSStream
    stream = Object.assign(new FS.FSStream, stream);
    if (fd == -1) {
      fd = FS.nextfd();
    }
    stream.fd = fd;
    FS.streams[fd] = stream;
    return stream;
  },
  closeStream(fd) {
    FS.streams[fd] = null;
  },
  dupStream(origStream, fd = -1) {
    var stream = FS.createStream(origStream, fd);
    stream.stream_ops?.dup?.(stream);
    return stream;
  },
  chrdev_stream_ops: {
    open(stream) {
      var device = FS.getDevice(stream.node.rdev);
      // override node's stream ops with the device's
      stream.stream_ops = device.stream_ops;
      // forward the open call
      stream.stream_ops.open?.(stream);
    },
    llseek() {
      throw new FS.ErrnoError(70);
    }
  },
  major: dev => ((dev) >> 8),
  minor: dev => ((dev) & 255),
  makedev: (ma, mi) => ((ma) << 8 | (mi)),
  registerDevice(dev, ops) {
    FS.devices[dev] = {
      stream_ops: ops
    };
  },
  getDevice: dev => FS.devices[dev],
  getMounts(mount) {
    var mounts = [];
    var check = [ mount ];
    while (check.length) {
      var m = check.pop();
      mounts.push(m);
      check.push(...m.mounts);
    }
    return mounts;
  },
  syncfs(populate, callback) {
    if (typeof populate == "function") {
      callback = populate;
      populate = false;
    }
    FS.syncFSRequests++;
    if (FS.syncFSRequests > 1) {
      err(`warning: ${FS.syncFSRequests} FS.syncfs operations in flight at once, probably just doing extra work`);
    }
    var mounts = FS.getMounts(FS.root.mount);
    var completed = 0;
    function doCallback(errCode) {
      FS.syncFSRequests--;
      return callback(errCode);
    }
    function done(errCode) {
      if (errCode) {
        if (!done.errored) {
          done.errored = true;
          return doCallback(errCode);
        }
        return;
      }
      if (++completed >= mounts.length) {
        doCallback(null);
      }
    }
    // sync all mounts
    mounts.forEach(mount => {
      if (!mount.type.syncfs) {
        return done(null);
      }
      mount.type.syncfs(mount, populate, done);
    });
  },
  mount(type, opts, mountpoint) {
    var root = mountpoint === "/";
    var pseudo = !mountpoint;
    var node;
    if (root && FS.root) {
      throw new FS.ErrnoError(10);
    } else if (!root && !pseudo) {
      var lookup = FS.lookupPath(mountpoint, {
        follow_mount: false
      });
      mountpoint = lookup.path;
      // use the absolute path
      node = lookup.node;
      if (FS.isMountpoint(node)) {
        throw new FS.ErrnoError(10);
      }
      if (!FS.isDir(node.mode)) {
        throw new FS.ErrnoError(54);
      }
    }
    var mount = {
      type,
      opts,
      mountpoint,
      mounts: []
    };
    // create a root node for the fs
    var mountRoot = type.mount(mount);
    mountRoot.mount = mount;
    mount.root = mountRoot;
    if (root) {
      FS.root = mountRoot;
    } else if (node) {
      // set as a mountpoint
      node.mounted = mount;
      // add the new mount to the current mount's children
      if (node.mount) {
        node.mount.mounts.push(mount);
      }
    }
    return mountRoot;
  },
  unmount(mountpoint) {
    var lookup = FS.lookupPath(mountpoint, {
      follow_mount: false
    });
    if (!FS.isMountpoint(lookup.node)) {
      throw new FS.ErrnoError(28);
    }
    // destroy the nodes for this mount, and all its child mounts
    var node = lookup.node;
    var mount = node.mounted;
    var mounts = FS.getMounts(mount);
    Object.keys(FS.nameTable).forEach(hash => {
      var current = FS.nameTable[hash];
      while (current) {
        var next = current.name_next;
        if (mounts.includes(current.mount)) {
          FS.destroyNode(current);
        }
        current = next;
      }
    });
    // no longer a mountpoint
    node.mounted = null;
    // remove this mount from the child mounts
    var idx = node.mount.mounts.indexOf(mount);
    node.mount.mounts.splice(idx, 1);
  },
  lookup(parent, name) {
    return parent.node_ops.lookup(parent, name);
  },
  mknod(path, mode, dev) {
    var lookup = FS.lookupPath(path, {
      parent: true
    });
    var parent = lookup.node;
    var name = PATH.basename(path);
    if (!name || name === "." || name === "..") {
      throw new FS.ErrnoError(28);
    }
    var errCode = FS.mayCreate(parent, name);
    if (errCode) {
      throw new FS.ErrnoError(errCode);
    }
    if (!parent.node_ops.mknod) {
      throw new FS.ErrnoError(63);
    }
    return parent.node_ops.mknod(parent, name, mode, dev);
  },
  statfs(path) {
    // NOTE: None of the defaults here are true. We're just returning safe and
    //       sane values.
    var rtn = {
      bsize: 4096,
      frsize: 4096,
      blocks: 1e6,
      bfree: 5e5,
      bavail: 5e5,
      files: FS.nextInode,
      ffree: FS.nextInode - 1,
      fsid: 42,
      flags: 2,
      namelen: 255
    };
    var parent = FS.lookupPath(path, {
      follow: true
    }).node;
    if (parent?.node_ops.statfs) {
      Object.assign(rtn, parent.node_ops.statfs(parent.mount.opts.root));
    }
    return rtn;
  },
  create(path, mode = 438) {
    mode &= 4095;
    mode |= 32768;
    return FS.mknod(path, mode, 0);
  },
  mkdir(path, mode = 511) {
    mode &= 511 | 512;
    mode |= 16384;
    return FS.mknod(path, mode, 0);
  },
  mkdirTree(path, mode) {
    var dirs = path.split("/");
    var d = "";
    for (var i = 0; i < dirs.length; ++i) {
      if (!dirs[i]) continue;
      d += "/" + dirs[i];
      try {
        FS.mkdir(d, mode);
      } catch (e) {
        if (e.errno != 20) throw e;
      }
    }
  },
  mkdev(path, mode, dev) {
    if (typeof dev == "undefined") {
      dev = mode;
      mode = 438;
    }
    mode |= 8192;
    return FS.mknod(path, mode, dev);
  },
  symlink(oldpath, newpath) {
    if (!PATH_FS.resolve(oldpath)) {
      throw new FS.ErrnoError(44);
    }
    var lookup = FS.lookupPath(newpath, {
      parent: true
    });
    var parent = lookup.node;
    if (!parent) {
      throw new FS.ErrnoError(44);
    }
    var newname = PATH.basename(newpath);
    var errCode = FS.mayCreate(parent, newname);
    if (errCode) {
      throw new FS.ErrnoError(errCode);
    }
    if (!parent.node_ops.symlink) {
      throw new FS.ErrnoError(63);
    }
    return parent.node_ops.symlink(parent, newname, oldpath);
  },
  rename(old_path, new_path) {
    var old_dirname = PATH.dirname(old_path);
    var new_dirname = PATH.dirname(new_path);
    var old_name = PATH.basename(old_path);
    var new_name = PATH.basename(new_path);
    // parents must exist
    var lookup, old_dir, new_dir;
    // let the errors from non existent directories percolate up
    lookup = FS.lookupPath(old_path, {
      parent: true
    });
    old_dir = lookup.node;
    lookup = FS.lookupPath(new_path, {
      parent: true
    });
    new_dir = lookup.node;
    if (!old_dir || !new_dir) throw new FS.ErrnoError(44);
    // need to be part of the same mount
    if (old_dir.mount !== new_dir.mount) {
      throw new FS.ErrnoError(75);
    }
    // source must exist
    var old_node = FS.lookupNode(old_dir, old_name);
    // old path should not be an ancestor of the new path
    var relative = PATH_FS.relative(old_path, new_dirname);
    if (relative.charAt(0) !== ".") {
      throw new FS.ErrnoError(28);
    }
    // new path should not be an ancestor of the old path
    relative = PATH_FS.relative(new_path, old_dirname);
    if (relative.charAt(0) !== ".") {
      throw new FS.ErrnoError(55);
    }
    // see if the new path already exists
    var new_node;
    try {
      new_node = FS.lookupNode(new_dir, new_name);
    } catch (e) {}
    // early out if nothing needs to change
    if (old_node === new_node) {
      return;
    }
    // we'll need to delete the old entry
    var isdir = FS.isDir(old_node.mode);
    var errCode = FS.mayDelete(old_dir, old_name, isdir);
    if (errCode) {
      throw new FS.ErrnoError(errCode);
    }
    // need delete permissions if we'll be overwriting.
    // need create permissions if new doesn't already exist.
    errCode = new_node ? FS.mayDelete(new_dir, new_name, isdir) : FS.mayCreate(new_dir, new_name);
    if (errCode) {
      throw new FS.ErrnoError(errCode);
    }
    if (!old_dir.node_ops.rename) {
      throw new FS.ErrnoError(63);
    }
    if (FS.isMountpoint(old_node) || (new_node && FS.isMountpoint(new_node))) {
      throw new FS.ErrnoError(10);
    }
    // if we are going to change the parent, check write permissions
    if (new_dir !== old_dir) {
      errCode = FS.nodePermissions(old_dir, "w");
      if (errCode) {
        throw new FS.ErrnoError(errCode);
      }
    }
    // remove the node from the lookup hash
    FS.hashRemoveNode(old_node);
    // do the underlying fs rename
    try {
      old_dir.node_ops.rename(old_node, new_dir, new_name);
      // update old node (we do this here to avoid each backend
      // needing to)
      old_node.parent = new_dir;
    } catch (e) {
      throw e;
    } finally {
      // add the node back to the hash (in case node_ops.rename
      // changed its name)
      FS.hashAddNode(old_node);
    }
  },
  rmdir(path) {
    var lookup = FS.lookupPath(path, {
      parent: true
    });
    var parent = lookup.node;
    var name = PATH.basename(path);
    var node = FS.lookupNode(parent, name);
    var errCode = FS.mayDelete(parent, name, true);
    if (errCode) {
      throw new FS.ErrnoError(errCode);
    }
    if (!parent.node_ops.rmdir) {
      throw new FS.ErrnoError(63);
    }
    if (FS.isMountpoint(node)) {
      throw new FS.ErrnoError(10);
    }
    parent.node_ops.rmdir(parent, name);
    FS.destroyNode(node);
  },
  readdir(path) {
    var lookup = FS.lookupPath(path, {
      follow: true
    });
    var node = lookup.node;
    if (!node.node_ops.readdir) {
      throw new FS.ErrnoError(54);
    }
    return node.node_ops.readdir(node);
  },
  unlink(path) {
    var lookup = FS.lookupPath(path, {
      parent: true
    });
    var parent = lookup.node;
    if (!parent) {
      throw new FS.ErrnoError(44);
    }
    var name = PATH.basename(path);
    var node = FS.lookupNode(parent, name);
    var errCode = FS.mayDelete(parent, name, false);
    if (errCode) {
      // According to POSIX, we should map EISDIR to EPERM, but
      // we instead do what Linux does (and we must, as we use
      // the musl linux libc).
      throw new FS.ErrnoError(errCode);
    }
    if (!parent.node_ops.unlink) {
      throw new FS.ErrnoError(63);
    }
    if (FS.isMountpoint(node)) {
      throw new FS.ErrnoError(10);
    }
    parent.node_ops.unlink(parent, name);
    FS.destroyNode(node);
  },
  readlink(path) {
    var lookup = FS.lookupPath(path);
    var link = lookup.node;
    if (!link) {
      throw new FS.ErrnoError(44);
    }
    if (!link.node_ops.readlink) {
      throw new FS.ErrnoError(28);
    }
    return link.node_ops.readlink(link);
  },
  stat(path, dontFollow) {
    var lookup = FS.lookupPath(path, {
      follow: !dontFollow
    });
    var node = lookup.node;
    if (!node) {
      throw new FS.ErrnoError(44);
    }
    if (!node.node_ops.getattr) {
      throw new FS.ErrnoError(63);
    }
    return node.node_ops.getattr(node);
  },
  lstat(path) {
    return FS.stat(path, true);
  },
  chmod(path, mode, dontFollow) {
    var node;
    if (typeof path == "string") {
      var lookup = FS.lookupPath(path, {
        follow: !dontFollow
      });
      node = lookup.node;
    } else {
      node = path;
    }
    if (!node.node_ops.setattr) {
      throw new FS.ErrnoError(63);
    }
    node.node_ops.setattr(node, {
      mode: (mode & 4095) | (node.mode & ~4095),
      ctime: Date.now()
    });
  },
  lchmod(path, mode) {
    FS.chmod(path, mode, true);
  },
  fchmod(fd, mode) {
    var stream = FS.getStreamChecked(fd);
    FS.chmod(stream.node, mode);
  },
  chown(path, uid, gid, dontFollow) {
    var node;
    if (typeof path == "string") {
      var lookup = FS.lookupPath(path, {
        follow: !dontFollow
      });
      node = lookup.node;
    } else {
      node = path;
    }
    if (!node.node_ops.setattr) {
      throw new FS.ErrnoError(63);
    }
    node.node_ops.setattr(node, {
      timestamp: Date.now()
    });
  },
  // we ignore the uid / gid for now
  lchown(path, uid, gid) {
    FS.chown(path, uid, gid, true);
  },
  fchown(fd, uid, gid) {
    var stream = FS.getStreamChecked(fd);
    FS.chown(stream.node, uid, gid);
  },
  truncate(path, len) {
    if (len < 0) {
      throw new FS.ErrnoError(28);
    }
    var node;
    if (typeof path == "string") {
      var lookup = FS.lookupPath(path, {
        follow: true
      });
      node = lookup.node;
    } else {
      node = path;
    }
    if (!node.node_ops.setattr) {
      throw new FS.ErrnoError(63);
    }
    if (FS.isDir(node.mode)) {
      throw new FS.ErrnoError(31);
    }
    if (!FS.isFile(node.mode)) {
      throw new FS.ErrnoError(28);
    }
    var errCode = FS.nodePermissions(node, "w");
    if (errCode) {
      throw new FS.ErrnoError(errCode);
    }
    node.node_ops.setattr(node, {
      size: len,
      timestamp: Date.now()
    });
  },
  ftruncate(fd, len) {
    var stream = FS.getStreamChecked(fd);
    if ((stream.flags & 2097155) === 0) {
      throw new FS.ErrnoError(28);
    }
    FS.truncate(stream.node, len);
  },
  utime(path, atime, mtime) {
    var lookup = FS.lookupPath(path, {
      follow: true
    });
    var node = lookup.node;
    node.node_ops.setattr(node, {
      atime,
      mtime
    });
  },
  open(path, flags, mode = 438) {
    if (path === "") {
      throw new FS.ErrnoError(44);
    }
    flags = typeof flags == "string" ? FS_modeStringToFlags(flags) : flags;
    if ((flags & 64)) {
      mode = (mode & 4095) | 32768;
    } else {
      mode = 0;
    }
    var node;
    if (typeof path == "object") {
      node = path;
    } else {
      // noent_okay makes it so that if the final component of the path
      // doesn't exist, lookupPath returns `node: undefined`. `path` will be
      // updated to point to the target of all symlinks.
      var lookup = FS.lookupPath(path, {
        follow: !(flags & 131072),
        noent_okay: true
      });
      node = lookup.node;
      path = lookup.path;
    }
    // perhaps we need to create the node
    var created = false;
    if ((flags & 64)) {
      if (node) {
        // if O_CREAT and O_EXCL are set, error out if the node already exists
        if ((flags & 128)) {
          throw new FS.ErrnoError(20);
        }
      } else {
        // node doesn't exist, try to create it
        node = FS.mknod(path, mode, 0);
        created = true;
      }
    }
    if (!node) {
      throw new FS.ErrnoError(44);
    }
    // can't truncate a device
    if (FS.isChrdev(node.mode)) {
      flags &= ~512;
    }
    // if asked only for a directory, then this must be one
    if ((flags & 65536) && !FS.isDir(node.mode)) {
      throw new FS.ErrnoError(54);
    }
    // check permissions, if this is not a file we just created now (it is ok to
    // create and write to a file with read-only permissions; it is read-only
    // for later use)
    if (!created) {
      var errCode = FS.mayOpen(node, flags);
      if (errCode) {
        throw new FS.ErrnoError(errCode);
      }
    }
    // do truncation if necessary
    if ((flags & 512) && !created) {
      FS.truncate(node, 0);
    }
    // we've already handled these, don't pass down to the underlying vfs
    flags &= ~(128 | 512 | 131072);
    // register the stream with the filesystem
    var stream = FS.createStream({
      node,
      path: FS.getPath(node),
      // we want the absolute path to the node
      flags,
      seekable: true,
      position: 0,
      stream_ops: node.stream_ops,
      // used by the file family libc calls (fopen, fwrite, ferror, etc.)
      ungotten: [],
      error: false
    });
    // call the new stream's open function
    if (stream.stream_ops.open) {
      stream.stream_ops.open(stream);
    }
    if (Module["logReadFiles"] && !(flags & 1)) {
      if (!(path in FS.readFiles)) {
        FS.readFiles[path] = 1;
      }
    }
    return stream;
  },
  close(stream) {
    if (FS.isClosed(stream)) {
      throw new FS.ErrnoError(8);
    }
    if (stream.getdents) stream.getdents = null;
    // free readdir state
    try {
      if (stream.stream_ops.close) {
        stream.stream_ops.close(stream);
      }
    } catch (e) {
      throw e;
    } finally {
      FS.closeStream(stream.fd);
    }
    stream.fd = null;
  },
  isClosed(stream) {
    return stream.fd === null;
  },
  llseek(stream, offset, whence) {
    if (FS.isClosed(stream)) {
      throw new FS.ErrnoError(8);
    }
    if (!stream.seekable || !stream.stream_ops.llseek) {
      throw new FS.ErrnoError(70);
    }
    if (whence != 0 && whence != 1 && whence != 2) {
      throw new FS.ErrnoError(28);
    }
    stream.position = stream.stream_ops.llseek(stream, offset, whence);
    stream.ungotten = [];
    return stream.position;
  },
  read(stream, buffer, offset, length, position) {
    if (length < 0 || position < 0) {
      throw new FS.ErrnoError(28);
    }
    if (FS.isClosed(stream)) {
      throw new FS.ErrnoError(8);
    }
    if ((stream.flags & 2097155) === 1) {
      throw new FS.ErrnoError(8);
    }
    if (FS.isDir(stream.node.mode)) {
      throw new FS.ErrnoError(31);
    }
    if (!stream.stream_ops.read) {
      throw new FS.ErrnoError(28);
    }
    var seeking = typeof position != "undefined";
    if (!seeking) {
      position = stream.position;
    } else if (!stream.seekable) {
      throw new FS.ErrnoError(70);
    }
    var bytesRead = stream.stream_ops.read(stream, buffer, offset, length, position);
    if (!seeking) stream.position += bytesRead;
    return bytesRead;
  },
  write(stream, buffer, offset, length, position, canOwn) {
    if (length < 0 || position < 0) {
      throw new FS.ErrnoError(28);
    }
    if (FS.isClosed(stream)) {
      throw new FS.ErrnoError(8);
    }
    if ((stream.flags & 2097155) === 0) {
      throw new FS.ErrnoError(8);
    }
    if (FS.isDir(stream.node.mode)) {
      throw new FS.ErrnoError(31);
    }
    if (!stream.stream_ops.write) {
      throw new FS.ErrnoError(28);
    }
    if (stream.seekable && stream.flags & 1024) {
      // seek to the end before writing in append mode
      FS.llseek(stream, 0, 2);
    }
    var seeking = typeof position != "undefined";
    if (!seeking) {
      position = stream.position;
    } else if (!stream.seekable) {
      throw new FS.ErrnoError(70);
    }
    var bytesWritten = stream.stream_ops.write(stream, buffer, offset, length, position, canOwn);
    if (!seeking) stream.position += bytesWritten;
    return bytesWritten;
  },
  allocate(stream, offset, length) {
    if (FS.isClosed(stream)) {
      throw new FS.ErrnoError(8);
    }
    if (offset < 0 || length <= 0) {
      throw new FS.ErrnoError(28);
    }
    if ((stream.flags & 2097155) === 0) {
      throw new FS.ErrnoError(8);
    }
    if (!FS.isFile(stream.node.mode) && !FS.isDir(stream.node.mode)) {
      throw new FS.ErrnoError(43);
    }
    if (!stream.stream_ops.allocate) {
      throw new FS.ErrnoError(138);
    }
    stream.stream_ops.allocate(stream, offset, length);
  },
  mmap(stream, length, position, prot, flags) {
    // User requests writing to file (prot & PROT_WRITE != 0).
    // Checking if we have permissions to write to the file unless
    // MAP_PRIVATE flag is set. According to POSIX spec it is possible
    // to write to file opened in read-only mode with MAP_PRIVATE flag,
    // as all modifications will be visible only in the memory of
    // the current process.
    if ((prot & 2) !== 0 && (flags & 2) === 0 && (stream.flags & 2097155) !== 2) {
      throw new FS.ErrnoError(2);
    }
    if ((stream.flags & 2097155) === 1) {
      throw new FS.ErrnoError(2);
    }
    if (!stream.stream_ops.mmap) {
      throw new FS.ErrnoError(43);
    }
    if (!length) {
      throw new FS.ErrnoError(28);
    }
    return stream.stream_ops.mmap(stream, length, position, prot, flags);
  },
  msync(stream, buffer, offset, length, mmapFlags) {
    if (!stream.stream_ops.msync) {
      return 0;
    }
    return stream.stream_ops.msync(stream, buffer, offset, length, mmapFlags);
  },
  ioctl(stream, cmd, arg) {
    if (!stream.stream_ops.ioctl) {
      throw new FS.ErrnoError(59);
    }
    return stream.stream_ops.ioctl(stream, cmd, arg);
  },
  readFile(path, opts = {}) {
    opts.flags = opts.flags || 0;
    opts.encoding = opts.encoding || "binary";
    if (opts.encoding !== "utf8" && opts.encoding !== "binary") {
      throw new Error(`Invalid encoding type "${opts.encoding}"`);
    }
    var ret;
    var stream = FS.open(path, opts.flags);
    var stat = FS.stat(path);
    var length = stat.size;
    var buf = new Uint8Array(length);
    FS.read(stream, buf, 0, length, 0);
    if (opts.encoding === "utf8") {
      ret = UTF8ArrayToString(buf);
    } else if (opts.encoding === "binary") {
      ret = buf;
    }
    FS.close(stream);
    return ret;
  },
  writeFile(path, data, opts = {}) {
    opts.flags = opts.flags || 577;
    var stream = FS.open(path, opts.flags, opts.mode);
    if (typeof data == "string") {
      var buf = new Uint8Array(lengthBytesUTF8(data) + 1);
      var actualNumBytes = stringToUTF8Array(data, buf, 0, buf.length);
      FS.write(stream, buf, 0, actualNumBytes, undefined, opts.canOwn);
    } else if (ArrayBuffer.isView(data)) {
      FS.write(stream, data, 0, data.byteLength, undefined, opts.canOwn);
    } else {
      throw new Error("Unsupported data type");
    }
    FS.close(stream);
  },
  cwd: () => FS.currentPath,
  chdir(path) {
    var lookup = FS.lookupPath(path, {
      follow: true
    });
    if (lookup.node === null) {
      throw new FS.ErrnoError(44);
    }
    if (!FS.isDir(lookup.node.mode)) {
      throw new FS.ErrnoError(54);
    }
    var errCode = FS.nodePermissions(lookup.node, "x");
    if (errCode) {
      throw new FS.ErrnoError(errCode);
    }
    FS.currentPath = lookup.path;
  },
  createDefaultDirectories() {
    FS.mkdir("/tmp");
    FS.mkdir("/home");
    FS.mkdir("/home/web_user");
  },
  createDefaultDevices() {
    // create /dev
    FS.mkdir("/dev");
    // setup /dev/null
    FS.registerDevice(FS.makedev(1, 3), {
      read: () => 0,
      write: (stream, buffer, offset, length, pos) => length,
      llseek: () => 0
    });
    FS.mkdev("/dev/null", FS.makedev(1, 3));
    // setup /dev/tty and /dev/tty1
    // stderr needs to print output using err() rather than out()
    // so we register a second tty just for it.
    TTY.register(FS.makedev(5, 0), TTY.default_tty_ops);
    TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops);
    FS.mkdev("/dev/tty", FS.makedev(5, 0));
    FS.mkdev("/dev/tty1", FS.makedev(6, 0));
    // setup /dev/[u]random
    // use a buffer to avoid overhead of individual crypto calls per byte
    var randomBuffer = new Uint8Array(1024), randomLeft = 0;
    var randomByte = () => {
      if (randomLeft === 0) {
        randomLeft = randomFill(randomBuffer).byteLength;
      }
      return randomBuffer[--randomLeft];
    };
    FS.createDevice("/dev", "random", randomByte);
    FS.createDevice("/dev", "urandom", randomByte);
    // we're not going to emulate the actual shm device,
    // just create the tmp dirs that reside in it commonly
    FS.mkdir("/dev/shm");
    FS.mkdir("/dev/shm/tmp");
  },
  createSpecialDirectories() {
    // create /proc/self/fd which allows /proc/self/fd/6 => readlink gives the
    // name of the stream for fd 6 (see test_unistd_ttyname)
    FS.mkdir("/proc");
    var proc_self = FS.mkdir("/proc/self");
    FS.mkdir("/proc/self/fd");
    FS.mount({
      mount() {
        var node = FS.createNode(proc_self, "fd", 16895, 73);
        node.stream_ops = {
          llseek: MEMFS.stream_ops.llseek
        };
        node.node_ops = {
          lookup(parent, name) {
            var fd = +name;
            var stream = FS.getStreamChecked(fd);
            var ret = {
              parent: null,
              mount: {
                mountpoint: "fake"
              },
              node_ops: {
                readlink: () => stream.path
              },
              id: fd + 1
            };
            ret.parent = ret;
            // make it look like a simple root node
            return ret;
          },
          readdir() {
            return Array.from(FS.streams.entries()).filter(([k, v]) => v).map(([k, v]) => k.toString());
          }
        };
        return node;
      }
    }, {}, "/proc/self/fd");
  },
  createStandardStreams(input, output, error) {
    // TODO deprecate the old functionality of a single
    // input / output callback and that utilizes FS.createDevice
    // and instead require a unique set of stream ops
    // by default, we symlink the standard streams to the
    // default tty devices. however, if the standard streams
    // have been overwritten we create a unique device for
    // them instead.
    if (input) {
      FS.createDevice("/dev", "stdin", input);
    } else {
      FS.symlink("/dev/tty", "/dev/stdin");
    }
    if (output) {
      FS.createDevice("/dev", "stdout", null, output);
    } else {
      FS.symlink("/dev/tty", "/dev/stdout");
    }
    if (error) {
      FS.createDevice("/dev", "stderr", null, error);
    } else {
      FS.symlink("/dev/tty1", "/dev/stderr");
    }
    // open default streams for the stdin, stdout and stderr devices
    var stdin = FS.open("/dev/stdin", 0);
    var stdout = FS.open("/dev/stdout", 1);
    var stderr = FS.open("/dev/stderr", 1);
  },
  staticInit() {
    FS.nameTable = new Array(4096);
    FS.mount(MEMFS, {}, "/");
    FS.createDefaultDirectories();
    FS.createDefaultDevices();
    FS.createSpecialDirectories();
    FS.filesystems = {
      "MEMFS": MEMFS
    };
  },
  init(input, output, error) {
    FS.initialized = true;
    // Allow Module.stdin etc. to provide defaults, if none explicitly passed to us here
    input ??= Module["stdin"];
    output ??= Module["stdout"];
    error ??= Module["stderr"];
    FS.createStandardStreams(input, output, error);
  },
  quit() {
    FS.initialized = false;
    // force-flush all streams, so we get musl std streams printed out
    // close all of our streams
    for (var i = 0; i < FS.streams.length; i++) {
      var stream = FS.streams[i];
      if (!stream) {
        continue;
      }
      FS.close(stream);
    }
  },
  findObject(path, dontResolveLastLink) {
    var ret = FS.analyzePath(path, dontResolveLastLink);
    if (!ret.exists) {
      return null;
    }
    return ret.object;
  },
  analyzePath(path, dontResolveLastLink) {
    // operate from within the context of the symlink's target
    try {
      var lookup = FS.lookupPath(path, {
        follow: !dontResolveLastLink
      });
      path = lookup.path;
    } catch (e) {}
    var ret = {
      isRoot: false,
      exists: false,
      error: 0,
      name: null,
      path: null,
      object: null,
      parentExists: false,
      parentPath: null,
      parentObject: null
    };
    try {
      var lookup = FS.lookupPath(path, {
        parent: true
      });
      ret.parentExists = true;
      ret.parentPath = lookup.path;
      ret.parentObject = lookup.node;
      ret.name = PATH.basename(path);
      lookup = FS.lookupPath(path, {
        follow: !dontResolveLastLink
      });
      ret.exists = true;
      ret.path = lookup.path;
      ret.object = lookup.node;
      ret.name = lookup.node.name;
      ret.isRoot = lookup.path === "/";
    } catch (e) {
      ret.error = e.errno;
    }
    return ret;
  },
  createPath(parent, path, canRead, canWrite) {
    parent = typeof parent == "string" ? parent : FS.getPath(parent);
    var parts = path.split("/").reverse();
    while (parts.length) {
      var part = parts.pop();
      if (!part) continue;
      var current = PATH.join2(parent, part);
      try {
        FS.mkdir(current);
      } catch (e) {}
      // ignore EEXIST
      parent = current;
    }
    return current;
  },
  createFile(parent, name, properties, canRead, canWrite) {
    var path = PATH.join2(typeof parent == "string" ? parent : FS.getPath(parent), name);
    var mode = FS_getMode(canRead, canWrite);
    return FS.create(path, mode);
  },
  createDataFile(parent, name, data, canRead, canWrite, canOwn) {
    var path = name;
    if (parent) {
      parent = typeof parent == "string" ? parent : FS.getPath(parent);
      path = name ? PATH.join2(parent, name) : parent;
    }
    var mode = FS_getMode(canRead, canWrite);
    var node = FS.create(path, mode);
    if (data) {
      if (typeof data == "string") {
        var arr = new Array(data.length);
        for (var i = 0, len = data.length; i < len; ++i) arr[i] = data.charCodeAt(i);
        data = arr;
      }
      // make sure we can write to the file
      FS.chmod(node, mode | 146);
      var stream = FS.open(node, 577);
      FS.write(stream, data, 0, data.length, 0, canOwn);
      FS.close(stream);
      FS.chmod(node, mode);
    }
  },
  createDevice(parent, name, input, output) {
    var path = PATH.join2(typeof parent == "string" ? parent : FS.getPath(parent), name);
    var mode = FS_getMode(!!input, !!output);
    FS.createDevice.major ??= 64;
    var dev = FS.makedev(FS.createDevice.major++, 0);
    // Create a fake device that a set of stream ops to emulate
    // the old behavior.
    FS.registerDevice(dev, {
      open(stream) {
        stream.seekable = false;
      },
      close(stream) {
        // flush any pending line data
        if (output?.buffer?.length) {
          output(10);
        }
      },
      read(stream, buffer, offset, length, pos) {
        /* ignored */ var bytesRead = 0;
        for (var i = 0; i < length; i++) {
          var result;
          try {
            result = input();
          } catch (e) {
            throw new FS.ErrnoError(29);
          }
          if (result === undefined && bytesRead === 0) {
            throw new FS.ErrnoError(6);
          }
          if (result === null || result === undefined) break;
          bytesRead++;
          buffer[offset + i] = result;
        }
        if (bytesRead) {
          stream.node.atime = Date.now();
        }
        return bytesRead;
      },
      write(stream, buffer, offset, length, pos) {
        for (var i = 0; i < length; i++) {
          try {
            output(buffer[offset + i]);
          } catch (e) {
            throw new FS.ErrnoError(29);
          }
        }
        if (length) {
          stream.node.mtime = stream.node.ctime = Date.now();
        }
        return i;
      }
    });
    return FS.mkdev(path, mode, dev);
  },
  forceLoadFile(obj) {
    if (obj.isDevice || obj.isFolder || obj.link || obj.contents) return true;
    if (typeof XMLHttpRequest != "undefined") {
      throw new Error("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.");
    } else {
      // Command-line.
      try {
        obj.contents = readBinary(obj.url);
        obj.usedBytes = obj.contents.length;
      } catch (e) {
        throw new FS.ErrnoError(29);
      }
    }
  },
  createLazyFile(parent, name, url, canRead, canWrite) {
    // Lazy chunked Uint8Array (implements get and length from Uint8Array).
    // Actual getting is abstracted away for eventual reuse.
    class LazyUint8Array {
      lengthKnown=false;
      chunks=[];
      // Loaded chunks. Index is the chunk number
      get(idx) {
        if (idx > this.length - 1 || idx < 0) {
          return undefined;
        }
        var chunkOffset = idx % this.chunkSize;
        var chunkNum = (idx / this.chunkSize) | 0;
        return this.getter(chunkNum)[chunkOffset];
      }
      setDataGetter(getter) {
        this.getter = getter;
      }
      cacheLength() {
        // Find length
        var xhr = new XMLHttpRequest;
        xhr.open("HEAD", url, false);
        xhr.send(null);
        if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
        var datalength = Number(xhr.getResponseHeader("Content-length"));
        var header;
        var hasByteServing = (header = xhr.getResponseHeader("Accept-Ranges")) && header === "bytes";
        var usesGzip = (header = xhr.getResponseHeader("Content-Encoding")) && header === "gzip";
        var chunkSize = 1024 * 1024;
        // Chunk size in bytes
        if (!hasByteServing) chunkSize = datalength;
        // Function to get a range from the remote URL.
        var doXHR = (from, to) => {
          if (from > to) throw new Error("invalid range (" + from + ", " + to + ") or no bytes requested!");
          if (to > datalength - 1) throw new Error("only " + datalength + " bytes available! programmer error!");
          // TODO: Use mozResponseArrayBuffer, responseStream, etc. if available.
          var xhr = new XMLHttpRequest;
          xhr.open("GET", url, false);
          if (datalength !== chunkSize) xhr.setRequestHeader("Range", "bytes=" + from + "-" + to);
          // Some hints to the browser that we want binary data.
          xhr.responseType = "arraybuffer";
          if (xhr.overrideMimeType) {
            xhr.overrideMimeType("text/plain; charset=x-user-defined");
          }
          xhr.send(null);
          if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
          if (xhr.response !== undefined) {
            return new Uint8Array(/** @type{Array<number>} */ (xhr.response || []));
          }
          return intArrayFromString(xhr.responseText || "", true);
        };
        var lazyArray = this;
        lazyArray.setDataGetter(chunkNum => {
          var start = chunkNum * chunkSize;
          var end = (chunkNum + 1) * chunkSize - 1;
          // including this byte
          end = Math.min(end, datalength - 1);
          // if datalength-1 is selected, this is the last block
          if (typeof lazyArray.chunks[chunkNum] == "undefined") {
            lazyArray.chunks[chunkNum] = doXHR(start, end);
          }
          if (typeof lazyArray.chunks[chunkNum] == "undefined") throw new Error("doXHR failed!");
          return lazyArray.chunks[chunkNum];
        });
        if (usesGzip || !datalength) {
          // if the server uses gzip or doesn't supply the length, we have to download the whole file to get the (uncompressed) length
          chunkSize = datalength = 1;
          // this will force getter(0)/doXHR do download the whole file
          datalength = this.getter(0).length;
          chunkSize = datalength;
          out("LazyFiles on gzip forces download of the whole file when length is accessed");
        }
        this._length = datalength;
        this._chunkSize = chunkSize;
        this.lengthKnown = true;
      }
      get length() {
        if (!this.lengthKnown) {
          this.cacheLength();
        }
        return this._length;
      }
      get chunkSize() {
        if (!this.lengthKnown) {
          this.cacheLength();
        }
        return this._chunkSize;
      }
    }
    if (typeof XMLHttpRequest != "undefined") {
      if (!ENVIRONMENT_IS_WORKER) throw "Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc";
      var lazyArray = new LazyUint8Array;
      var properties = {
        isDevice: false,
        contents: lazyArray
      };
    } else {
      var properties = {
        isDevice: false,
        url
      };
    }
    var node = FS.createFile(parent, name, properties, canRead, canWrite);
    // This is a total hack, but I want to get this lazy file code out of the
    // core of MEMFS. If we want to keep this lazy file concept I feel it should
    // be its own thin LAZYFS proxying calls to MEMFS.
    if (properties.contents) {
      node.contents = properties.contents;
    } else if (properties.url) {
      node.contents = null;
      node.url = properties.url;
    }
    // Add a function that defers querying the file size until it is asked the first time.
    Object.defineProperties(node, {
      usedBytes: {
        get: function() {
          return this.contents.length;
        }
      }
    });
    // override each stream op with one that tries to force load the lazy file first
    var stream_ops = {};
    var keys = Object.keys(node.stream_ops);
    keys.forEach(key => {
      var fn = node.stream_ops[key];
      stream_ops[key] = (...args) => {
        FS.forceLoadFile(node);
        return fn(...args);
      };
    });
    function writeChunks(stream, buffer, offset, length, position) {
      var contents = stream.node.contents;
      if (position >= contents.length) return 0;
      var size = Math.min(contents.length - position, length);
      if (contents.slice) {
        // normal array
        for (var i = 0; i < size; i++) {
          buffer[offset + i] = contents[position + i];
        }
      } else {
        for (var i = 0; i < size; i++) {
          // LazyUint8Array from sync binary XHR
          buffer[offset + i] = contents.get(position + i);
        }
      }
      return size;
    }
    // use a custom read function
    stream_ops.read = (stream, buffer, offset, length, position) => {
      FS.forceLoadFile(node);
      return writeChunks(stream, buffer, offset, length, position);
    };
    // use a custom mmap function
    stream_ops.mmap = (stream, length, position, prot, flags) => {
      FS.forceLoadFile(node);
      var ptr = mmapAlloc(length);
      if (!ptr) {
        throw new FS.ErrnoError(48);
      }
      writeChunks(stream, HEAP8, ptr, length, position);
      return {
        ptr,
        allocated: true
      };
    };
    node.stream_ops = stream_ops;
    return node;
  }
};

var SYSCALLS = {
  DEFAULT_POLLMASK: 5,
  calculateAt(dirfd, path, allowEmpty) {
    if (PATH.isAbs(path)) {
      return path;
    }
    // relative path
    var dir;
    if (dirfd === -100) {
      dir = FS.cwd();
    } else {
      var dirstream = SYSCALLS.getStreamFromFD(dirfd);
      dir = dirstream.path;
    }
    if (path.length == 0) {
      if (!allowEmpty) {
        throw new FS.ErrnoError(44);
      }
      return dir;
    }
    return dir + "/" + path;
  },
  doStat(func, path, buf) {
    var stat = func(path);
    HEAP32[((buf) >> 2)] = stat.dev;
    HEAP32[(((buf) + (4)) >> 2)] = stat.mode;
    HEAPU32[(((buf) + (8)) >> 2)] = stat.nlink;
    HEAP32[(((buf) + (12)) >> 2)] = stat.uid;
    HEAP32[(((buf) + (16)) >> 2)] = stat.gid;
    HEAP32[(((buf) + (20)) >> 2)] = stat.rdev;
    (tempI64 = [ stat.size >>> 0, (tempDouble = stat.size, (+(Math.abs(tempDouble))) >= 1 ? (tempDouble > 0 ? (+(Math.floor((tempDouble) / 4294967296))) >>> 0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble))) >>> 0)) / 4294967296))))) >>> 0) : 0) ], 
    HEAP32[(((buf) + (24)) >> 2)] = tempI64[0], HEAP32[(((buf) + (28)) >> 2)] = tempI64[1]);
    HEAP32[(((buf) + (32)) >> 2)] = 4096;
    HEAP32[(((buf) + (36)) >> 2)] = stat.blocks;
    var atime = stat.atime.getTime();
    var mtime = stat.mtime.getTime();
    var ctime = stat.ctime.getTime();
    (tempI64 = [ Math.floor(atime / 1e3) >>> 0, (tempDouble = Math.floor(atime / 1e3), 
    (+(Math.abs(tempDouble))) >= 1 ? (tempDouble > 0 ? (+(Math.floor((tempDouble) / 4294967296))) >>> 0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble))) >>> 0)) / 4294967296))))) >>> 0) : 0) ], 
    HEAP32[(((buf) + (40)) >> 2)] = tempI64[0], HEAP32[(((buf) + (44)) >> 2)] = tempI64[1]);
    HEAPU32[(((buf) + (48)) >> 2)] = (atime % 1e3) * 1e3 * 1e3;
    (tempI64 = [ Math.floor(mtime / 1e3) >>> 0, (tempDouble = Math.floor(mtime / 1e3), 
    (+(Math.abs(tempDouble))) >= 1 ? (tempDouble > 0 ? (+(Math.floor((tempDouble) / 4294967296))) >>> 0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble))) >>> 0)) / 4294967296))))) >>> 0) : 0) ], 
    HEAP32[(((buf) + (56)) >> 2)] = tempI64[0], HEAP32[(((buf) + (60)) >> 2)] = tempI64[1]);
    HEAPU32[(((buf) + (64)) >> 2)] = (mtime % 1e3) * 1e3 * 1e3;
    (tempI64 = [ Math.floor(ctime / 1e3) >>> 0, (tempDouble = Math.floor(ctime / 1e3), 
    (+(Math.abs(tempDouble))) >= 1 ? (tempDouble > 0 ? (+(Math.floor((tempDouble) / 4294967296))) >>> 0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble))) >>> 0)) / 4294967296))))) >>> 0) : 0) ], 
    HEAP32[(((buf) + (72)) >> 2)] = tempI64[0], HEAP32[(((buf) + (76)) >> 2)] = tempI64[1]);
    HEAPU32[(((buf) + (80)) >> 2)] = (ctime % 1e3) * 1e3 * 1e3;
    (tempI64 = [ stat.ino >>> 0, (tempDouble = stat.ino, (+(Math.abs(tempDouble))) >= 1 ? (tempDouble > 0 ? (+(Math.floor((tempDouble) / 4294967296))) >>> 0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble))) >>> 0)) / 4294967296))))) >>> 0) : 0) ], 
    HEAP32[(((buf) + (88)) >> 2)] = tempI64[0], HEAP32[(((buf) + (92)) >> 2)] = tempI64[1]);
    return 0;
  },
  doMsync(addr, stream, len, flags, offset) {
    if (!FS.isFile(stream.node.mode)) {
      throw new FS.ErrnoError(43);
    }
    if (flags & 2) {
      // MAP_PRIVATE calls need not to be synced back to underlying fs
      return 0;
    }
    var buffer = HEAPU8.slice(addr, addr + len);
    FS.msync(stream, buffer, offset, len, flags);
  },
  getStreamFromFD(fd) {
    var stream = FS.getStreamChecked(fd);
    return stream;
  },
  varargs: undefined,
  getStr(ptr) {
    var ret = UTF8ToString(ptr);
    return ret;
  }
};

function _fd_close(fd) {
  try {
    var stream = SYSCALLS.getStreamFromFD(fd);
    FS.close(stream);
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return e.errno;
  }
}

/** @param {number=} offset */ var doReadv = (stream, iov, iovcnt, offset) => {
  var ret = 0;
  for (var i = 0; i < iovcnt; i++) {
    var ptr = HEAPU32[((iov) >> 2)];
    var len = HEAPU32[(((iov) + (4)) >> 2)];
    iov += 8;
    var curr = FS.read(stream, HEAP8, ptr, len, offset);
    if (curr < 0) return -1;
    ret += curr;
    if (curr < len) break;
    // nothing more to read
    if (typeof offset != "undefined") {
      offset += curr;
    }
  }
  return ret;
};

function _fd_read(fd, iov, iovcnt, pnum) {
  try {
    var stream = SYSCALLS.getStreamFromFD(fd);
    var num = doReadv(stream, iov, iovcnt);
    HEAPU32[((pnum) >> 2)] = num;
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return e.errno;
  }
}

function _fd_seek(fd, offset_low, offset_high, whence, newOffset) {
  var offset = convertI32PairToI53Checked(offset_low, offset_high);
  try {
    if (isNaN(offset)) return 61;
    var stream = SYSCALLS.getStreamFromFD(fd);
    FS.llseek(stream, offset, whence);
    (tempI64 = [ stream.position >>> 0, (tempDouble = stream.position, (+(Math.abs(tempDouble))) >= 1 ? (tempDouble > 0 ? (+(Math.floor((tempDouble) / 4294967296))) >>> 0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble))) >>> 0)) / 4294967296))))) >>> 0) : 0) ], 
    HEAP32[((newOffset) >> 2)] = tempI64[0], HEAP32[(((newOffset) + (4)) >> 2)] = tempI64[1]);
    if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null;
    // reset readdir state
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return e.errno;
  }
}

/** @param {number=} offset */ var doWritev = (stream, iov, iovcnt, offset) => {
  var ret = 0;
  for (var i = 0; i < iovcnt; i++) {
    var ptr = HEAPU32[((iov) >> 2)];
    var len = HEAPU32[(((iov) + (4)) >> 2)];
    iov += 8;
    var curr = FS.write(stream, HEAP8, ptr, len, offset);
    if (curr < 0) return -1;
    ret += curr;
    if (curr < len) {
      // No more space to write.
      break;
    }
    if (typeof offset != "undefined") {
      offset += curr;
    }
  }
  return ret;
};

function _fd_write(fd, iov, iovcnt, pnum) {
  try {
    var stream = SYSCALLS.getStreamFromFD(fd);
    var num = doWritev(stream, iov, iovcnt);
    HEAPU32[((pnum) >> 2)] = num;
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return e.errno;
  }
}

var _llvm_eh_typeid_for = type => type;

function _random_get(buffer, size) {
  try {
    randomFill(HEAPU8.subarray(buffer, buffer + size));
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return e.errno;
  }
}

/** @type {WebAssembly.Table} */ var wasmTable;

/** @suppress{checkTypes} */ var getWasmTableEntry = funcPtr => wasmTable.get(funcPtr);

FS.createPreloadedFile = FS_createPreloadedFile;

FS.staticInit();

// This error may happen quite a bit. To avoid overhead we reuse it (and
// suffer a lack of stack info).
MEMFS.doesNotExistError = new FS.ErrnoError(44);

/** @suppress {checkTypes} */ MEMFS.doesNotExistError.stack = "<generic error, no stack>";

var wasmImports = {
  /** @export */ n: ___assert_fail,
  /** @export */ k: ___cxa_begin_catch,
  /** @export */ m: ___cxa_end_catch,
  /** @export */ ja: ___cxa_find_matching_catch_17,
  /** @export */ a: ___cxa_find_matching_catch_2,
  /** @export */ h: ___cxa_find_matching_catch_3,
  /** @export */ y: ___cxa_find_matching_catch_4,
  /** @export */ ia: ___cxa_find_matching_catch_6,
  /** @export */ Q: ___cxa_rethrow,
  /** @export */ v: ___cxa_throw,
  /** @export */ R: ___cxa_uncaught_exceptions,
  /** @export */ e: ___resumeException,
  /** @export */ sa: __abort_js,
  /** @export */ qa: __emscripten_runtime_keepalive_clear,
  /** @export */ ra: __setitimer_js,
  /** @export */ na: __tzset_js,
  /** @export */ ca: _clock_time_get,
  /** @export */ S: _emscripten_resize_heap,
  /** @export */ ua: _environ_get,
  /** @export */ va: _environ_sizes_get,
  /** @export */ ga: _fd_close,
  /** @export */ wa: _fd_read,
  /** @export */ da: _fd_seek,
  /** @export */ _: _fd_write,
  /** @export */ A: invoke_di,
  /** @export */ ka: invoke_did,
  /** @export */ I: invoke_didi,
  /** @export */ D: invoke_dii,
  /** @export */ G: invoke_diii,
  /** @export */ H: invoke_diiii,
  /** @export */ M: invoke_fi,
  /** @export */ oa: invoke_fii,
  /** @export */ t: invoke_i,
  /** @export */ d: invoke_ii,
  /** @export */ fa: invoke_iid,
  /** @export */ la: invoke_iifi,
  /** @export */ b: invoke_iii,
  /** @export */ N: invoke_iiifii,
  /** @export */ J: invoke_iiifiii,
  /** @export */ g: invoke_iiii,
  /** @export */ ha: invoke_iiiidd,
  /** @export */ o: invoke_iiiii,
  /** @export */ ea: invoke_iiiiid,
  /** @export */ r: invoke_iiiiii,
  /** @export */ u: invoke_iiiiiii,
  /** @export */ F: invoke_iiiiiiii,
  /** @export */ P: invoke_iiiiiiiii,
  /** @export */ C: invoke_iiiiiiiiiiii,
  /** @export */ T: invoke_iij,
  /** @export */ aa: invoke_iiji,
  /** @export */ W: invoke_ijiij,
  /** @export */ U: invoke_j,
  /** @export */ Y: invoke_jiiii,
  /** @export */ j: invoke_v,
  /** @export */ l: invoke_vi,
  /** @export */ w: invoke_vid,
  /** @export */ c: invoke_vii,
  /** @export */ E: invoke_viid,
  /** @export */ K: invoke_viif,
  /** @export */ f: invoke_viii,
  /** @export */ ma: invoke_viiidi,
  /** @export */ i: invoke_viiii,
  /** @export */ p: invoke_viiiii,
  /** @export */ x: invoke_viiiiii,
  /** @export */ s: invoke_viiiiiii,
  /** @export */ L: invoke_viiiiiiii,
  /** @export */ O: invoke_viiiiiiiii,
  /** @export */ z: invoke_viiiiiiiiii,
  /** @export */ B: invoke_viiiiiiiiiiiiiii,
  /** @export */ $: invoke_viiij,
  /** @export */ Z: invoke_viij,
  /** @export */ X: invoke_viiji,
  /** @export */ ba: invoke_vij,
  /** @export */ V: invoke_viji,
  /** @export */ q: _llvm_eh_typeid_for,
  /** @export */ pa: _proc_exit,
  /** @export */ ta: _random_get
};

var wasmExports;

createWasm();

var ___wasm_call_ctors = () => (___wasm_call_ctors = wasmExports["ya"])();

var _openmpt_get_library_version = Module["_openmpt_get_library_version"] = () => (_openmpt_get_library_version = Module["_openmpt_get_library_version"] = wasmExports["za"])();

var __ZN7openmpt19get_library_versionEv = Module["__ZN7openmpt19get_library_versionEv"] = () => (__ZN7openmpt19get_library_versionEv = Module["__ZN7openmpt19get_library_versionEv"] = wasmExports["Aa"])();

var _openmpt_get_core_version = Module["_openmpt_get_core_version"] = () => (_openmpt_get_core_version = Module["_openmpt_get_core_version"] = wasmExports["Ba"])();

var __ZN7openmpt16get_core_versionEv = Module["__ZN7openmpt16get_core_versionEv"] = () => (__ZN7openmpt16get_core_versionEv = Module["__ZN7openmpt16get_core_versionEv"] = wasmExports["Ca"])();

var _openmpt_free_string = Module["_openmpt_free_string"] = a0 => (_openmpt_free_string = Module["_openmpt_free_string"] = wasmExports["Da"])(a0);

var _free = Module["_free"] = a0 => (_free = Module["_free"] = wasmExports["Ea"])(a0);

var _openmpt_get_string = Module["_openmpt_get_string"] = a0 => (_openmpt_get_string = Module["_openmpt_get_string"] = wasmExports["Fa"])(a0);

var __ZN7openmpt6string3getERKNSt3__212basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEE = Module["__ZN7openmpt6string3getERKNSt3__212basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEE"] = (a0, a1) => (__ZN7openmpt6string3getERKNSt3__212basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEE = Module["__ZN7openmpt6string3getERKNSt3__212basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEE"] = wasmExports["Ga"])(a0, a1);

var _openmpt_get_supported_extensions = Module["_openmpt_get_supported_extensions"] = () => (_openmpt_get_supported_extensions = Module["_openmpt_get_supported_extensions"] = wasmExports["Ha"])();

var _openmpt_is_extension_supported = Module["_openmpt_is_extension_supported"] = a0 => (_openmpt_is_extension_supported = Module["_openmpt_is_extension_supported"] = wasmExports["Ia"])(a0);

var _openmpt_log_func_default = Module["_openmpt_log_func_default"] = (a0, a1) => (_openmpt_log_func_default = Module["_openmpt_log_func_default"] = wasmExports["Ja"])(a0, a1);

var _openmpt_log_func_silent = Module["_openmpt_log_func_silent"] = (a0, a1) => (_openmpt_log_func_silent = Module["_openmpt_log_func_silent"] = wasmExports["Ka"])(a0, a1);

var _openmpt_error_is_transient = Module["_openmpt_error_is_transient"] = a0 => (_openmpt_error_is_transient = Module["_openmpt_error_is_transient"] = wasmExports["La"])(a0);

var _openmpt_error_string = Module["_openmpt_error_string"] = a0 => (_openmpt_error_string = Module["_openmpt_error_string"] = wasmExports["Ma"])(a0);

var _openmpt_error_func_default = Module["_openmpt_error_func_default"] = (a0, a1) => (_openmpt_error_func_default = Module["_openmpt_error_func_default"] = wasmExports["Na"])(a0, a1);

var _openmpt_error_func_log = Module["_openmpt_error_func_log"] = (a0, a1) => (_openmpt_error_func_log = Module["_openmpt_error_func_log"] = wasmExports["Oa"])(a0, a1);

var _openmpt_error_func_store = Module["_openmpt_error_func_store"] = (a0, a1) => (_openmpt_error_func_store = Module["_openmpt_error_func_store"] = wasmExports["Pa"])(a0, a1);

var _openmpt_error_func_ignore = Module["_openmpt_error_func_ignore"] = (a0, a1) => (_openmpt_error_func_ignore = Module["_openmpt_error_func_ignore"] = wasmExports["Qa"])(a0, a1);

var _openmpt_error_func_errno = Module["_openmpt_error_func_errno"] = (a0, a1) => (_openmpt_error_func_errno = Module["_openmpt_error_func_errno"] = wasmExports["Ra"])(a0, a1);

var _openmpt_error_func_errno_userdata = Module["_openmpt_error_func_errno_userdata"] = a0 => (_openmpt_error_func_errno_userdata = Module["_openmpt_error_func_errno_userdata"] = wasmExports["Sa"])(a0);

var _openmpt_could_open_probability = Module["_openmpt_could_open_probability"] = (a0, a1, a2, a3, a4) => (_openmpt_could_open_probability = Module["_openmpt_could_open_probability"] = wasmExports["Ta"])(a0, a1, a2, a3, a4);

var _openmpt_could_open_probability2 = Module["_openmpt_could_open_probability2"] = (a0, a1, a2, a3, a4, a5, a6, a7, a8) => (_openmpt_could_open_probability2 = Module["_openmpt_could_open_probability2"] = wasmExports["Ua"])(a0, a1, a2, a3, a4, a5, a6, a7, a8);

var _openmpt_could_open_propability = Module["_openmpt_could_open_propability"] = (a0, a1, a2, a3, a4) => (_openmpt_could_open_propability = Module["_openmpt_could_open_propability"] = wasmExports["Va"])(a0, a1, a2, a3, a4);

var _openmpt_probe_file_header_get_recommended_size = Module["_openmpt_probe_file_header_get_recommended_size"] = () => (_openmpt_probe_file_header_get_recommended_size = Module["_openmpt_probe_file_header_get_recommended_size"] = wasmExports["Wa"])();

var _openmpt_probe_file_header = Module["_openmpt_probe_file_header"] = (a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11) => (_openmpt_probe_file_header = Module["_openmpt_probe_file_header"] = wasmExports["Xa"])(a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11);

var _openmpt_probe_file_header_without_filesize = Module["_openmpt_probe_file_header_without_filesize"] = (a0, a1, a2, a3, a4, a5, a6, a7, a8, a9) => (_openmpt_probe_file_header_without_filesize = Module["_openmpt_probe_file_header_without_filesize"] = wasmExports["Ya"])(a0, a1, a2, a3, a4, a5, a6, a7, a8, a9);

var _openmpt_probe_file_header_from_stream = Module["_openmpt_probe_file_header_from_stream"] = (a0, a1, a2, a3, a4, a5, a6, a7, a8, a9) => (_openmpt_probe_file_header_from_stream = Module["_openmpt_probe_file_header_from_stream"] = wasmExports["Za"])(a0, a1, a2, a3, a4, a5, a6, a7, a8, a9);

var _openmpt_module_create = Module["_openmpt_module_create"] = (a0, a1, a2, a3, a4) => (_openmpt_module_create = Module["_openmpt_module_create"] = wasmExports["_a"])(a0, a1, a2, a3, a4);

var _openmpt_module_create2 = Module["_openmpt_module_create2"] = (a0, a1, a2, a3, a4, a5, a6, a7, a8) => (_openmpt_module_create2 = Module["_openmpt_module_create2"] = wasmExports["$a"])(a0, a1, a2, a3, a4, a5, a6, a7, a8);

var _openmpt_module_create_from_memory = Module["_openmpt_module_create_from_memory"] = (a0, a1, a2, a3, a4) => (_openmpt_module_create_from_memory = Module["_openmpt_module_create_from_memory"] = wasmExports["ab"])(a0, a1, a2, a3, a4);

var _openmpt_module_create_from_memory2 = Module["_openmpt_module_create_from_memory2"] = (a0, a1, a2, a3, a4, a5, a6, a7, a8) => (_openmpt_module_create_from_memory2 = Module["_openmpt_module_create_from_memory2"] = wasmExports["bb"])(a0, a1, a2, a3, a4, a5, a6, a7, a8);

var _openmpt_module_destroy = Module["_openmpt_module_destroy"] = a0 => (_openmpt_module_destroy = Module["_openmpt_module_destroy"] = wasmExports["cb"])(a0);

var _openmpt_module_set_log_func = Module["_openmpt_module_set_log_func"] = (a0, a1, a2) => (_openmpt_module_set_log_func = Module["_openmpt_module_set_log_func"] = wasmExports["db"])(a0, a1, a2);

var _openmpt_module_set_error_func = Module["_openmpt_module_set_error_func"] = (a0, a1, a2) => (_openmpt_module_set_error_func = Module["_openmpt_module_set_error_func"] = wasmExports["eb"])(a0, a1, a2);

var _openmpt_module_error_get_last = Module["_openmpt_module_error_get_last"] = a0 => (_openmpt_module_error_get_last = Module["_openmpt_module_error_get_last"] = wasmExports["fb"])(a0);

var _openmpt_module_error_get_last_message = Module["_openmpt_module_error_get_last_message"] = a0 => (_openmpt_module_error_get_last_message = Module["_openmpt_module_error_get_last_message"] = wasmExports["gb"])(a0);

var _openmpt_module_error_set_last = Module["_openmpt_module_error_set_last"] = (a0, a1) => (_openmpt_module_error_set_last = Module["_openmpt_module_error_set_last"] = wasmExports["hb"])(a0, a1);

var _openmpt_module_error_clear = Module["_openmpt_module_error_clear"] = a0 => (_openmpt_module_error_clear = Module["_openmpt_module_error_clear"] = wasmExports["ib"])(a0);

var _openmpt_module_select_subsong = Module["_openmpt_module_select_subsong"] = (a0, a1) => (_openmpt_module_select_subsong = Module["_openmpt_module_select_subsong"] = wasmExports["jb"])(a0, a1);

var _openmpt_module_get_selected_subsong = Module["_openmpt_module_get_selected_subsong"] = a0 => (_openmpt_module_get_selected_subsong = Module["_openmpt_module_get_selected_subsong"] = wasmExports["kb"])(a0);

var _openmpt_module_set_repeat_count = Module["_openmpt_module_set_repeat_count"] = (a0, a1) => (_openmpt_module_set_repeat_count = Module["_openmpt_module_set_repeat_count"] = wasmExports["lb"])(a0, a1);

var _openmpt_module_get_repeat_count = Module["_openmpt_module_get_repeat_count"] = a0 => (_openmpt_module_get_repeat_count = Module["_openmpt_module_get_repeat_count"] = wasmExports["mb"])(a0);

var _openmpt_module_get_duration_seconds = Module["_openmpt_module_get_duration_seconds"] = a0 => (_openmpt_module_get_duration_seconds = Module["_openmpt_module_get_duration_seconds"] = wasmExports["nb"])(a0);

var _openmpt_module_set_position_seconds = Module["_openmpt_module_set_position_seconds"] = (a0, a1) => (_openmpt_module_set_position_seconds = Module["_openmpt_module_set_position_seconds"] = wasmExports["ob"])(a0, a1);

var _openmpt_module_get_position_seconds = Module["_openmpt_module_get_position_seconds"] = a0 => (_openmpt_module_get_position_seconds = Module["_openmpt_module_get_position_seconds"] = wasmExports["pb"])(a0);

var _openmpt_module_set_position_order_row = Module["_openmpt_module_set_position_order_row"] = (a0, a1, a2) => (_openmpt_module_set_position_order_row = Module["_openmpt_module_set_position_order_row"] = wasmExports["qb"])(a0, a1, a2);

var _openmpt_module_get_render_param = Module["_openmpt_module_get_render_param"] = (a0, a1, a2) => (_openmpt_module_get_render_param = Module["_openmpt_module_get_render_param"] = wasmExports["rb"])(a0, a1, a2);

var _openmpt_module_set_render_param = Module["_openmpt_module_set_render_param"] = (a0, a1, a2) => (_openmpt_module_set_render_param = Module["_openmpt_module_set_render_param"] = wasmExports["sb"])(a0, a1, a2);

var _openmpt_module_read_mono = Module["_openmpt_module_read_mono"] = (a0, a1, a2, a3) => (_openmpt_module_read_mono = Module["_openmpt_module_read_mono"] = wasmExports["tb"])(a0, a1, a2, a3);

var _openmpt_module_read_stereo = Module["_openmpt_module_read_stereo"] = (a0, a1, a2, a3, a4) => (_openmpt_module_read_stereo = Module["_openmpt_module_read_stereo"] = wasmExports["ub"])(a0, a1, a2, a3, a4);

var _openmpt_module_read_quad = Module["_openmpt_module_read_quad"] = (a0, a1, a2, a3, a4, a5, a6) => (_openmpt_module_read_quad = Module["_openmpt_module_read_quad"] = wasmExports["vb"])(a0, a1, a2, a3, a4, a5, a6);

var _openmpt_module_read_float_mono = Module["_openmpt_module_read_float_mono"] = (a0, a1, a2, a3) => (_openmpt_module_read_float_mono = Module["_openmpt_module_read_float_mono"] = wasmExports["wb"])(a0, a1, a2, a3);

var _openmpt_module_read_float_stereo = Module["_openmpt_module_read_float_stereo"] = (a0, a1, a2, a3, a4) => (_openmpt_module_read_float_stereo = Module["_openmpt_module_read_float_stereo"] = wasmExports["xb"])(a0, a1, a2, a3, a4);

var _openmpt_module_read_float_quad = Module["_openmpt_module_read_float_quad"] = (a0, a1, a2, a3, a4, a5, a6) => (_openmpt_module_read_float_quad = Module["_openmpt_module_read_float_quad"] = wasmExports["yb"])(a0, a1, a2, a3, a4, a5, a6);

var _openmpt_module_read_interleaved_stereo = Module["_openmpt_module_read_interleaved_stereo"] = (a0, a1, a2, a3) => (_openmpt_module_read_interleaved_stereo = Module["_openmpt_module_read_interleaved_stereo"] = wasmExports["zb"])(a0, a1, a2, a3);

var _openmpt_module_read_interleaved_quad = Module["_openmpt_module_read_interleaved_quad"] = (a0, a1, a2, a3) => (_openmpt_module_read_interleaved_quad = Module["_openmpt_module_read_interleaved_quad"] = wasmExports["Ab"])(a0, a1, a2, a3);

var _openmpt_module_read_interleaved_float_stereo = Module["_openmpt_module_read_interleaved_float_stereo"] = (a0, a1, a2, a3) => (_openmpt_module_read_interleaved_float_stereo = Module["_openmpt_module_read_interleaved_float_stereo"] = wasmExports["Bb"])(a0, a1, a2, a3);

var _openmpt_module_read_interleaved_float_quad = Module["_openmpt_module_read_interleaved_float_quad"] = (a0, a1, a2, a3) => (_openmpt_module_read_interleaved_float_quad = Module["_openmpt_module_read_interleaved_float_quad"] = wasmExports["Cb"])(a0, a1, a2, a3);

var _openmpt_module_get_metadata_keys = Module["_openmpt_module_get_metadata_keys"] = a0 => (_openmpt_module_get_metadata_keys = Module["_openmpt_module_get_metadata_keys"] = wasmExports["Db"])(a0);

var _openmpt_module_get_metadata = Module["_openmpt_module_get_metadata"] = (a0, a1) => (_openmpt_module_get_metadata = Module["_openmpt_module_get_metadata"] = wasmExports["Eb"])(a0, a1);

var _openmpt_module_get_current_estimated_bpm = Module["_openmpt_module_get_current_estimated_bpm"] = a0 => (_openmpt_module_get_current_estimated_bpm = Module["_openmpt_module_get_current_estimated_bpm"] = wasmExports["Fb"])(a0);

var _openmpt_module_get_current_speed = Module["_openmpt_module_get_current_speed"] = a0 => (_openmpt_module_get_current_speed = Module["_openmpt_module_get_current_speed"] = wasmExports["Gb"])(a0);

var _openmpt_module_get_current_tempo = Module["_openmpt_module_get_current_tempo"] = a0 => (_openmpt_module_get_current_tempo = Module["_openmpt_module_get_current_tempo"] = wasmExports["Hb"])(a0);

var _openmpt_module_get_current_tempo2 = Module["_openmpt_module_get_current_tempo2"] = a0 => (_openmpt_module_get_current_tempo2 = Module["_openmpt_module_get_current_tempo2"] = wasmExports["Ib"])(a0);

var _openmpt_module_get_current_order = Module["_openmpt_module_get_current_order"] = a0 => (_openmpt_module_get_current_order = Module["_openmpt_module_get_current_order"] = wasmExports["Jb"])(a0);

var _openmpt_module_get_current_pattern = Module["_openmpt_module_get_current_pattern"] = a0 => (_openmpt_module_get_current_pattern = Module["_openmpt_module_get_current_pattern"] = wasmExports["Kb"])(a0);

var _openmpt_module_get_current_row = Module["_openmpt_module_get_current_row"] = a0 => (_openmpt_module_get_current_row = Module["_openmpt_module_get_current_row"] = wasmExports["Lb"])(a0);

var _openmpt_module_get_current_playing_channels = Module["_openmpt_module_get_current_playing_channels"] = a0 => (_openmpt_module_get_current_playing_channels = Module["_openmpt_module_get_current_playing_channels"] = wasmExports["Mb"])(a0);

var _openmpt_module_get_current_channel_vu_mono = Module["_openmpt_module_get_current_channel_vu_mono"] = (a0, a1) => (_openmpt_module_get_current_channel_vu_mono = Module["_openmpt_module_get_current_channel_vu_mono"] = wasmExports["Nb"])(a0, a1);

var _openmpt_module_get_current_channel_vu_left = Module["_openmpt_module_get_current_channel_vu_left"] = (a0, a1) => (_openmpt_module_get_current_channel_vu_left = Module["_openmpt_module_get_current_channel_vu_left"] = wasmExports["Ob"])(a0, a1);

var _openmpt_module_get_current_channel_vu_right = Module["_openmpt_module_get_current_channel_vu_right"] = (a0, a1) => (_openmpt_module_get_current_channel_vu_right = Module["_openmpt_module_get_current_channel_vu_right"] = wasmExports["Pb"])(a0, a1);

var _openmpt_module_get_current_channel_vu_rear_left = Module["_openmpt_module_get_current_channel_vu_rear_left"] = (a0, a1) => (_openmpt_module_get_current_channel_vu_rear_left = Module["_openmpt_module_get_current_channel_vu_rear_left"] = wasmExports["Qb"])(a0, a1);

var _openmpt_module_get_current_channel_vu_rear_right = Module["_openmpt_module_get_current_channel_vu_rear_right"] = (a0, a1) => (_openmpt_module_get_current_channel_vu_rear_right = Module["_openmpt_module_get_current_channel_vu_rear_right"] = wasmExports["Rb"])(a0, a1);

var _openmpt_module_get_num_subsongs = Module["_openmpt_module_get_num_subsongs"] = a0 => (_openmpt_module_get_num_subsongs = Module["_openmpt_module_get_num_subsongs"] = wasmExports["Sb"])(a0);

var _openmpt_module_get_num_channels = Module["_openmpt_module_get_num_channels"] = a0 => (_openmpt_module_get_num_channels = Module["_openmpt_module_get_num_channels"] = wasmExports["Tb"])(a0);

var _openmpt_module_get_num_orders = Module["_openmpt_module_get_num_orders"] = a0 => (_openmpt_module_get_num_orders = Module["_openmpt_module_get_num_orders"] = wasmExports["Ub"])(a0);

var _openmpt_module_get_num_patterns = Module["_openmpt_module_get_num_patterns"] = a0 => (_openmpt_module_get_num_patterns = Module["_openmpt_module_get_num_patterns"] = wasmExports["Vb"])(a0);

var _openmpt_module_get_num_instruments = Module["_openmpt_module_get_num_instruments"] = a0 => (_openmpt_module_get_num_instruments = Module["_openmpt_module_get_num_instruments"] = wasmExports["Wb"])(a0);

var _openmpt_module_get_num_samples = Module["_openmpt_module_get_num_samples"] = a0 => (_openmpt_module_get_num_samples = Module["_openmpt_module_get_num_samples"] = wasmExports["Xb"])(a0);

var _openmpt_module_get_subsong_name = Module["_openmpt_module_get_subsong_name"] = (a0, a1) => (_openmpt_module_get_subsong_name = Module["_openmpt_module_get_subsong_name"] = wasmExports["Yb"])(a0, a1);

var _openmpt_module_get_channel_name = Module["_openmpt_module_get_channel_name"] = (a0, a1) => (_openmpt_module_get_channel_name = Module["_openmpt_module_get_channel_name"] = wasmExports["Zb"])(a0, a1);

var _openmpt_module_get_order_name = Module["_openmpt_module_get_order_name"] = (a0, a1) => (_openmpt_module_get_order_name = Module["_openmpt_module_get_order_name"] = wasmExports["_b"])(a0, a1);

var _openmpt_module_get_pattern_name = Module["_openmpt_module_get_pattern_name"] = (a0, a1) => (_openmpt_module_get_pattern_name = Module["_openmpt_module_get_pattern_name"] = wasmExports["$b"])(a0, a1);

var _openmpt_module_get_instrument_name = Module["_openmpt_module_get_instrument_name"] = (a0, a1) => (_openmpt_module_get_instrument_name = Module["_openmpt_module_get_instrument_name"] = wasmExports["ac"])(a0, a1);

var _openmpt_module_get_sample_name = Module["_openmpt_module_get_sample_name"] = (a0, a1) => (_openmpt_module_get_sample_name = Module["_openmpt_module_get_sample_name"] = wasmExports["bc"])(a0, a1);

var _openmpt_module_get_order_pattern = Module["_openmpt_module_get_order_pattern"] = (a0, a1) => (_openmpt_module_get_order_pattern = Module["_openmpt_module_get_order_pattern"] = wasmExports["cc"])(a0, a1);

var _openmpt_module_get_pattern_num_rows = Module["_openmpt_module_get_pattern_num_rows"] = (a0, a1) => (_openmpt_module_get_pattern_num_rows = Module["_openmpt_module_get_pattern_num_rows"] = wasmExports["dc"])(a0, a1);

var _openmpt_module_get_pattern_row_channel_command = Module["_openmpt_module_get_pattern_row_channel_command"] = (a0, a1, a2, a3, a4) => (_openmpt_module_get_pattern_row_channel_command = Module["_openmpt_module_get_pattern_row_channel_command"] = wasmExports["ec"])(a0, a1, a2, a3, a4);

var _openmpt_module_format_pattern_row_channel_command = Module["_openmpt_module_format_pattern_row_channel_command"] = (a0, a1, a2, a3, a4) => (_openmpt_module_format_pattern_row_channel_command = Module["_openmpt_module_format_pattern_row_channel_command"] = wasmExports["fc"])(a0, a1, a2, a3, a4);

var _openmpt_module_highlight_pattern_row_channel_command = Module["_openmpt_module_highlight_pattern_row_channel_command"] = (a0, a1, a2, a3, a4) => (_openmpt_module_highlight_pattern_row_channel_command = Module["_openmpt_module_highlight_pattern_row_channel_command"] = wasmExports["gc"])(a0, a1, a2, a3, a4);

var _openmpt_module_format_pattern_row_channel = Module["_openmpt_module_format_pattern_row_channel"] = (a0, a1, a2, a3, a4, a5) => (_openmpt_module_format_pattern_row_channel = Module["_openmpt_module_format_pattern_row_channel"] = wasmExports["hc"])(a0, a1, a2, a3, a4, a5);

var _openmpt_module_highlight_pattern_row_channel = Module["_openmpt_module_highlight_pattern_row_channel"] = (a0, a1, a2, a3, a4, a5) => (_openmpt_module_highlight_pattern_row_channel = Module["_openmpt_module_highlight_pattern_row_channel"] = wasmExports["ic"])(a0, a1, a2, a3, a4, a5);

var _openmpt_module_get_ctls = Module["_openmpt_module_get_ctls"] = a0 => (_openmpt_module_get_ctls = Module["_openmpt_module_get_ctls"] = wasmExports["jc"])(a0);

var _openmpt_module_ctl_get = Module["_openmpt_module_ctl_get"] = (a0, a1) => (_openmpt_module_ctl_get = Module["_openmpt_module_ctl_get"] = wasmExports["kc"])(a0, a1);

var _openmpt_module_ctl_get_boolean = Module["_openmpt_module_ctl_get_boolean"] = (a0, a1) => (_openmpt_module_ctl_get_boolean = Module["_openmpt_module_ctl_get_boolean"] = wasmExports["lc"])(a0, a1);

var _openmpt_module_ctl_get_integer = Module["_openmpt_module_ctl_get_integer"] = (a0, a1) => (_openmpt_module_ctl_get_integer = Module["_openmpt_module_ctl_get_integer"] = wasmExports["mc"])(a0, a1);

var _openmpt_module_ctl_get_floatingpoint = Module["_openmpt_module_ctl_get_floatingpoint"] = (a0, a1) => (_openmpt_module_ctl_get_floatingpoint = Module["_openmpt_module_ctl_get_floatingpoint"] = wasmExports["nc"])(a0, a1);

var _openmpt_module_ctl_get_text = Module["_openmpt_module_ctl_get_text"] = (a0, a1) => (_openmpt_module_ctl_get_text = Module["_openmpt_module_ctl_get_text"] = wasmExports["oc"])(a0, a1);

var _openmpt_module_ctl_set = Module["_openmpt_module_ctl_set"] = (a0, a1, a2) => (_openmpt_module_ctl_set = Module["_openmpt_module_ctl_set"] = wasmExports["pc"])(a0, a1, a2);

var _openmpt_module_ctl_set_boolean = Module["_openmpt_module_ctl_set_boolean"] = (a0, a1, a2) => (_openmpt_module_ctl_set_boolean = Module["_openmpt_module_ctl_set_boolean"] = wasmExports["qc"])(a0, a1, a2);

var _openmpt_module_ctl_set_integer = Module["_openmpt_module_ctl_set_integer"] = (a0, a1, a2, a3) => (_openmpt_module_ctl_set_integer = Module["_openmpt_module_ctl_set_integer"] = wasmExports["rc"])(a0, a1, a2, a3);

var _openmpt_module_ctl_set_floatingpoint = Module["_openmpt_module_ctl_set_floatingpoint"] = (a0, a1, a2) => (_openmpt_module_ctl_set_floatingpoint = Module["_openmpt_module_ctl_set_floatingpoint"] = wasmExports["sc"])(a0, a1, a2);

var _openmpt_module_ctl_set_text = Module["_openmpt_module_ctl_set_text"] = (a0, a1, a2) => (_openmpt_module_ctl_set_text = Module["_openmpt_module_ctl_set_text"] = wasmExports["tc"])(a0, a1, a2);

var _openmpt_module_ext_create = Module["_openmpt_module_ext_create"] = (a0, a1, a2, a3, a4, a5, a6, a7, a8) => (_openmpt_module_ext_create = Module["_openmpt_module_ext_create"] = wasmExports["uc"])(a0, a1, a2, a3, a4, a5, a6, a7, a8);

var _openmpt_module_ext_create_from_memory = Module["_openmpt_module_ext_create_from_memory"] = (a0, a1, a2, a3, a4, a5, a6, a7, a8) => (_openmpt_module_ext_create_from_memory = Module["_openmpt_module_ext_create_from_memory"] = wasmExports["vc"])(a0, a1, a2, a3, a4, a5, a6, a7, a8);

var _openmpt_module_ext_destroy = Module["_openmpt_module_ext_destroy"] = a0 => (_openmpt_module_ext_destroy = Module["_openmpt_module_ext_destroy"] = wasmExports["wc"])(a0);

var _openmpt_module_ext_get_module = Module["_openmpt_module_ext_get_module"] = a0 => (_openmpt_module_ext_get_module = Module["_openmpt_module_ext_get_module"] = wasmExports["xc"])(a0);

var _openmpt_module_ext_get_interface = Module["_openmpt_module_ext_get_interface"] = (a0, a1, a2, a3) => (_openmpt_module_ext_get_interface = Module["_openmpt_module_ext_get_interface"] = wasmExports["yc"])(a0, a1, a2, a3);

var __ZN7openmpt9exceptionC2ERKNSt3__212basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEE = Module["__ZN7openmpt9exceptionC2ERKNSt3__212basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEE"] = (a0, a1) => (__ZN7openmpt9exceptionC2ERKNSt3__212basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEE = Module["__ZN7openmpt9exceptionC2ERKNSt3__212basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEE"] = wasmExports["zc"])(a0, a1);

var __ZNK7openmpt9exception4whatEv = Module["__ZNK7openmpt9exception4whatEv"] = a0 => (__ZNK7openmpt9exception4whatEv = Module["__ZNK7openmpt9exception4whatEv"] = wasmExports["Ac"])(a0);

var __ZN7openmpt9exceptionD2Ev = Module["__ZN7openmpt9exceptionD2Ev"] = a0 => (__ZN7openmpt9exceptionD2Ev = Module["__ZN7openmpt9exceptionD2Ev"] = wasmExports["Bc"])(a0);

var _malloc = Module["_malloc"] = a0 => (_malloc = Module["_malloc"] = wasmExports["Cc"])(a0);

var __ZN7openmpt9exceptionC2ERKS0_ = Module["__ZN7openmpt9exceptionC2ERKS0_"] = (a0, a1) => (__ZN7openmpt9exceptionC2ERKS0_ = Module["__ZN7openmpt9exceptionC2ERKS0_"] = wasmExports["Dc"])(a0, a1);

var __ZN7openmpt9exceptionC2EOS0_ = Module["__ZN7openmpt9exceptionC2EOS0_"] = (a0, a1) => (__ZN7openmpt9exceptionC2EOS0_ = Module["__ZN7openmpt9exceptionC2EOS0_"] = wasmExports["Ec"])(a0, a1);

var __ZN7openmpt9exceptionaSERKS0_ = Module["__ZN7openmpt9exceptionaSERKS0_"] = (a0, a1) => (__ZN7openmpt9exceptionaSERKS0_ = Module["__ZN7openmpt9exceptionaSERKS0_"] = wasmExports["Fc"])(a0, a1);

var __ZN7openmpt9exceptionaSEOS0_ = Module["__ZN7openmpt9exceptionaSEOS0_"] = (a0, a1) => (__ZN7openmpt9exceptionaSEOS0_ = Module["__ZN7openmpt9exceptionaSEOS0_"] = wasmExports["Gc"])(a0, a1);

var __ZN7openmpt9exceptionD0Ev = Module["__ZN7openmpt9exceptionD0Ev"] = a0 => (__ZN7openmpt9exceptionD0Ev = Module["__ZN7openmpt9exceptionD0Ev"] = wasmExports["Hc"])(a0);

var __ZN7openmpt24get_supported_extensionsEv = Module["__ZN7openmpt24get_supported_extensionsEv"] = a0 => (__ZN7openmpt24get_supported_extensionsEv = Module["__ZN7openmpt24get_supported_extensionsEv"] = wasmExports["Ic"])(a0);

var __ZN7openmpt22is_extension_supportedERKNSt3__212basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEE = Module["__ZN7openmpt22is_extension_supportedERKNSt3__212basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEE"] = a0 => (__ZN7openmpt22is_extension_supportedERKNSt3__212basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEE = Module["__ZN7openmpt22is_extension_supportedERKNSt3__212basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEE"] = wasmExports["Jc"])(a0);

var __ZN7openmpt23is_extension_supported2ENSt3__217basic_string_viewIcNS0_11char_traitsIcEEEE = Module["__ZN7openmpt23is_extension_supported2ENSt3__217basic_string_viewIcNS0_11char_traitsIcEEEE"] = a0 => (__ZN7openmpt23is_extension_supported2ENSt3__217basic_string_viewIcNS0_11char_traitsIcEEEE = Module["__ZN7openmpt23is_extension_supported2ENSt3__217basic_string_viewIcNS0_11char_traitsIcEEEE"] = wasmExports["Kc"])(a0);

var __ZN7openmpt22could_open_probabilityERNSt3__213basic_istreamIcNS0_11char_traitsIcEEEEdRNS0_13basic_ostreamIcS3_EE = Module["__ZN7openmpt22could_open_probabilityERNSt3__213basic_istreamIcNS0_11char_traitsIcEEEEdRNS0_13basic_ostreamIcS3_EE"] = (a0, a1, a2) => (__ZN7openmpt22could_open_probabilityERNSt3__213basic_istreamIcNS0_11char_traitsIcEEEEdRNS0_13basic_ostreamIcS3_EE = Module["__ZN7openmpt22could_open_probabilityERNSt3__213basic_istreamIcNS0_11char_traitsIcEEEEdRNS0_13basic_ostreamIcS3_EE"] = wasmExports["Lc"])(a0, a1, a2);

var __ZN7openmpt22could_open_propabilityERNSt3__213basic_istreamIcNS0_11char_traitsIcEEEEdRNS0_13basic_ostreamIcS3_EE = Module["__ZN7openmpt22could_open_propabilityERNSt3__213basic_istreamIcNS0_11char_traitsIcEEEEdRNS0_13basic_ostreamIcS3_EE"] = (a0, a1, a2) => (__ZN7openmpt22could_open_propabilityERNSt3__213basic_istreamIcNS0_11char_traitsIcEEEEdRNS0_13basic_ostreamIcS3_EE = Module["__ZN7openmpt22could_open_propabilityERNSt3__213basic_istreamIcNS0_11char_traitsIcEEEEdRNS0_13basic_ostreamIcS3_EE"] = wasmExports["Mc"])(a0, a1, a2);

var __ZN7openmpt38probe_file_header_get_recommended_sizeEv = Module["__ZN7openmpt38probe_file_header_get_recommended_sizeEv"] = () => (__ZN7openmpt38probe_file_header_get_recommended_sizeEv = Module["__ZN7openmpt38probe_file_header_get_recommended_sizeEv"] = wasmExports["Nc"])();

var __ZN7openmpt17probe_file_headerEyPKSt4bytemy = Module["__ZN7openmpt17probe_file_headerEyPKSt4bytemy"] = (a0, a1, a2, a3, a4, a5) => (__ZN7openmpt17probe_file_headerEyPKSt4bytemy = Module["__ZN7openmpt17probe_file_headerEyPKSt4bytemy"] = wasmExports["Oc"])(a0, a1, a2, a3, a4, a5);

var __ZN7openmpt17probe_file_headerEyPKhmy = Module["__ZN7openmpt17probe_file_headerEyPKhmy"] = (a0, a1, a2, a3, a4, a5) => (__ZN7openmpt17probe_file_headerEyPKhmy = Module["__ZN7openmpt17probe_file_headerEyPKhmy"] = wasmExports["Pc"])(a0, a1, a2, a3, a4, a5);

var __ZN7openmpt17probe_file_headerEyPKSt4bytem = Module["__ZN7openmpt17probe_file_headerEyPKSt4bytem"] = (a0, a1, a2, a3) => (__ZN7openmpt17probe_file_headerEyPKSt4bytem = Module["__ZN7openmpt17probe_file_headerEyPKSt4bytem"] = wasmExports["Qc"])(a0, a1, a2, a3);

var __ZN7openmpt17probe_file_headerEyPKhm = Module["__ZN7openmpt17probe_file_headerEyPKhm"] = (a0, a1, a2, a3) => (__ZN7openmpt17probe_file_headerEyPKhm = Module["__ZN7openmpt17probe_file_headerEyPKhm"] = wasmExports["Rc"])(a0, a1, a2, a3);

var __ZN7openmpt17probe_file_headerEyRNSt3__213basic_istreamIcNS0_11char_traitsIcEEEE = Module["__ZN7openmpt17probe_file_headerEyRNSt3__213basic_istreamIcNS0_11char_traitsIcEEEE"] = (a0, a1, a2) => (__ZN7openmpt17probe_file_headerEyRNSt3__213basic_istreamIcNS0_11char_traitsIcEEEE = Module["__ZN7openmpt17probe_file_headerEyRNSt3__213basic_istreamIcNS0_11char_traitsIcEEEE"] = wasmExports["Sc"])(a0, a1, a2);

var __ZN7openmpt6moduleC2ERNSt3__213basic_istreamIcNS1_11char_traitsIcEEEERNS1_13basic_ostreamIcS4_EERKNS1_3mapINS1_12basic_stringIcS4_NS1_9allocatorIcEEEESE_NS1_4lessISE_EENSC_INS1_4pairIKSE_SE_EEEEEE = Module["__ZN7openmpt6moduleC2ERNSt3__213basic_istreamIcNS1_11char_traitsIcEEEERNS1_13basic_ostreamIcS4_EERKNS1_3mapINS1_12basic_stringIcS4_NS1_9allocatorIcEEEESE_NS1_4lessISE_EENSC_INS1_4pairIKSE_SE_EEEEEE"] = (a0, a1, a2, a3) => (__ZN7openmpt6moduleC2ERNSt3__213basic_istreamIcNS1_11char_traitsIcEEEERNS1_13basic_ostreamIcS4_EERKNS1_3mapINS1_12basic_stringIcS4_NS1_9allocatorIcEEEESE_NS1_4lessISE_EENSC_INS1_4pairIKSE_SE_EEEEEE = Module["__ZN7openmpt6moduleC2ERNSt3__213basic_istreamIcNS1_11char_traitsIcEEEERNS1_13basic_ostreamIcS4_EERKNS1_3mapINS1_12basic_stringIcS4_NS1_9allocatorIcEEEESE_NS1_4lessISE_EENSC_INS1_4pairIKSE_SE_EEEEEE"] = wasmExports["Tc"])(a0, a1, a2, a3);

var __ZN7openmpt6moduleC2ERKNSt3__26vectorISt4byteNS1_9allocatorIS3_EEEERNS1_13basic_ostreamIcNS1_11char_traitsIcEEEERKNS1_3mapINS1_12basic_stringIcSB_NS4_IcEEEESH_NS1_4lessISH_EENS4_INS1_4pairIKSH_SH_EEEEEE = Module["__ZN7openmpt6moduleC2ERKNSt3__26vectorISt4byteNS1_9allocatorIS3_EEEERNS1_13basic_ostreamIcNS1_11char_traitsIcEEEERKNS1_3mapINS1_12basic_stringIcSB_NS4_IcEEEESH_NS1_4lessISH_EENS4_INS1_4pairIKSH_SH_EEEEEE"] = (a0, a1, a2, a3) => (__ZN7openmpt6moduleC2ERKNSt3__26vectorISt4byteNS1_9allocatorIS3_EEEERNS1_13basic_ostreamIcNS1_11char_traitsIcEEEERKNS1_3mapINS1_12basic_stringIcSB_NS4_IcEEEESH_NS1_4lessISH_EENS4_INS1_4pairIKSH_SH_EEEEEE = Module["__ZN7openmpt6moduleC2ERKNSt3__26vectorISt4byteNS1_9allocatorIS3_EEEERNS1_13basic_ostreamIcNS1_11char_traitsIcEEEERKNS1_3mapINS1_12basic_stringIcSB_NS4_IcEEEESH_NS1_4lessISH_EENS4_INS1_4pairIKSH_SH_EEEEEE"] = wasmExports["Uc"])(a0, a1, a2, a3);

var __ZN7openmpt6moduleC2EPKSt4byteS3_RNSt3__213basic_ostreamIcNS4_11char_traitsIcEEEERKNS4_3mapINS4_12basic_stringIcS7_NS4_9allocatorIcEEEESE_NS4_4lessISE_EENSC_INS4_4pairIKSE_SE_EEEEEE = Module["__ZN7openmpt6moduleC2EPKSt4byteS3_RNSt3__213basic_ostreamIcNS4_11char_traitsIcEEEERKNS4_3mapINS4_12basic_stringIcS7_NS4_9allocatorIcEEEESE_NS4_4lessISE_EENSC_INS4_4pairIKSE_SE_EEEEEE"] = (a0, a1, a2, a3, a4) => (__ZN7openmpt6moduleC2EPKSt4byteS3_RNSt3__213basic_ostreamIcNS4_11char_traitsIcEEEERKNS4_3mapINS4_12basic_stringIcS7_NS4_9allocatorIcEEEESE_NS4_4lessISE_EENSC_INS4_4pairIKSE_SE_EEEEEE = Module["__ZN7openmpt6moduleC2EPKSt4byteS3_RNSt3__213basic_ostreamIcNS4_11char_traitsIcEEEERKNS4_3mapINS4_12basic_stringIcS7_NS4_9allocatorIcEEEESE_NS4_4lessISE_EENSC_INS4_4pairIKSE_SE_EEEEEE"] = wasmExports["Vc"])(a0, a1, a2, a3, a4);

var __ZN7openmpt6moduleC2EPKSt4bytemRNSt3__213basic_ostreamIcNS4_11char_traitsIcEEEERKNS4_3mapINS4_12basic_stringIcS7_NS4_9allocatorIcEEEESE_NS4_4lessISE_EENSC_INS4_4pairIKSE_SE_EEEEEE = Module["__ZN7openmpt6moduleC2EPKSt4bytemRNSt3__213basic_ostreamIcNS4_11char_traitsIcEEEERKNS4_3mapINS4_12basic_stringIcS7_NS4_9allocatorIcEEEESE_NS4_4lessISE_EENSC_INS4_4pairIKSE_SE_EEEEEE"] = (a0, a1, a2, a3, a4) => (__ZN7openmpt6moduleC2EPKSt4bytemRNSt3__213basic_ostreamIcNS4_11char_traitsIcEEEERKNS4_3mapINS4_12basic_stringIcS7_NS4_9allocatorIcEEEESE_NS4_4lessISE_EENSC_INS4_4pairIKSE_SE_EEEEEE = Module["__ZN7openmpt6moduleC2EPKSt4bytemRNSt3__213basic_ostreamIcNS4_11char_traitsIcEEEERKNS4_3mapINS4_12basic_stringIcS7_NS4_9allocatorIcEEEESE_NS4_4lessISE_EENSC_INS4_4pairIKSE_SE_EEEEEE"] = wasmExports["Wc"])(a0, a1, a2, a3, a4);

var __ZN7openmpt6moduleC2ERKNSt3__26vectorIhNS1_9allocatorIhEEEERNS1_13basic_ostreamIcNS1_11char_traitsIcEEEERKNS1_3mapINS1_12basic_stringIcSA_NS3_IcEEEESG_NS1_4lessISG_EENS3_INS1_4pairIKSG_SG_EEEEEE = Module["__ZN7openmpt6moduleC2ERKNSt3__26vectorIhNS1_9allocatorIhEEEERNS1_13basic_ostreamIcNS1_11char_traitsIcEEEERKNS1_3mapINS1_12basic_stringIcSA_NS3_IcEEEESG_NS1_4lessISG_EENS3_INS1_4pairIKSG_SG_EEEEEE"] = (a0, a1, a2, a3) => (__ZN7openmpt6moduleC2ERKNSt3__26vectorIhNS1_9allocatorIhEEEERNS1_13basic_ostreamIcNS1_11char_traitsIcEEEERKNS1_3mapINS1_12basic_stringIcSA_NS3_IcEEEESG_NS1_4lessISG_EENS3_INS1_4pairIKSG_SG_EEEEEE = Module["__ZN7openmpt6moduleC2ERKNSt3__26vectorIhNS1_9allocatorIhEEEERNS1_13basic_ostreamIcNS1_11char_traitsIcEEEERKNS1_3mapINS1_12basic_stringIcSA_NS3_IcEEEESG_NS1_4lessISG_EENS3_INS1_4pairIKSG_SG_EEEEEE"] = wasmExports["Xc"])(a0, a1, a2, a3);

var __ZN7openmpt6moduleC2EPKhS2_RNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE = Module["__ZN7openmpt6moduleC2EPKhS2_RNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE"] = (a0, a1, a2, a3, a4) => (__ZN7openmpt6moduleC2EPKhS2_RNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE = Module["__ZN7openmpt6moduleC2EPKhS2_RNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE"] = wasmExports["Yc"])(a0, a1, a2, a3, a4);

var __ZN7openmpt6moduleC2EPKhmRNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE = Module["__ZN7openmpt6moduleC2EPKhmRNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE"] = (a0, a1, a2, a3, a4) => (__ZN7openmpt6moduleC2EPKhmRNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE = Module["__ZN7openmpt6moduleC2EPKhmRNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE"] = wasmExports["Zc"])(a0, a1, a2, a3, a4);

var __ZN7openmpt6moduleC2ERKNSt3__26vectorIcNS1_9allocatorIcEEEERNS1_13basic_ostreamIcNS1_11char_traitsIcEEEERKNS1_3mapINS1_12basic_stringIcSA_S4_EESF_NS1_4lessISF_EENS3_INS1_4pairIKSF_SF_EEEEEE = Module["__ZN7openmpt6moduleC2ERKNSt3__26vectorIcNS1_9allocatorIcEEEERNS1_13basic_ostreamIcNS1_11char_traitsIcEEEERKNS1_3mapINS1_12basic_stringIcSA_S4_EESF_NS1_4lessISF_EENS3_INS1_4pairIKSF_SF_EEEEEE"] = (a0, a1, a2, a3) => (__ZN7openmpt6moduleC2ERKNSt3__26vectorIcNS1_9allocatorIcEEEERNS1_13basic_ostreamIcNS1_11char_traitsIcEEEERKNS1_3mapINS1_12basic_stringIcSA_S4_EESF_NS1_4lessISF_EENS3_INS1_4pairIKSF_SF_EEEEEE = Module["__ZN7openmpt6moduleC2ERKNSt3__26vectorIcNS1_9allocatorIcEEEERNS1_13basic_ostreamIcNS1_11char_traitsIcEEEERKNS1_3mapINS1_12basic_stringIcSA_S4_EESF_NS1_4lessISF_EENS3_INS1_4pairIKSF_SF_EEEEEE"] = wasmExports["_c"])(a0, a1, a2, a3);

var __ZN7openmpt6moduleC2EPKcS2_RNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE = Module["__ZN7openmpt6moduleC2EPKcS2_RNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE"] = (a0, a1, a2, a3, a4) => (__ZN7openmpt6moduleC2EPKcS2_RNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE = Module["__ZN7openmpt6moduleC2EPKcS2_RNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE"] = wasmExports["$c"])(a0, a1, a2, a3, a4);

var __ZN7openmpt6moduleC2EPKcmRNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE = Module["__ZN7openmpt6moduleC2EPKcmRNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE"] = (a0, a1, a2, a3, a4) => (__ZN7openmpt6moduleC2EPKcmRNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE = Module["__ZN7openmpt6moduleC2EPKcmRNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE"] = wasmExports["ad"])(a0, a1, a2, a3, a4);

var __ZN7openmpt6moduleC2EPKvmRNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE = Module["__ZN7openmpt6moduleC2EPKvmRNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE"] = (a0, a1, a2, a3, a4) => (__ZN7openmpt6moduleC2EPKvmRNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE = Module["__ZN7openmpt6moduleC2EPKvmRNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE"] = wasmExports["bd"])(a0, a1, a2, a3, a4);

var __ZN7openmpt6moduleD2Ev = Module["__ZN7openmpt6moduleD2Ev"] = a0 => (__ZN7openmpt6moduleD2Ev = Module["__ZN7openmpt6moduleD2Ev"] = wasmExports["cd"])(a0);

var __ZN7openmpt6moduleD0Ev = Module["__ZN7openmpt6moduleD0Ev"] = a0 => (__ZN7openmpt6moduleD0Ev = Module["__ZN7openmpt6moduleD0Ev"] = wasmExports["dd"])(a0);

var __ZN7openmpt6module14select_subsongEi = Module["__ZN7openmpt6module14select_subsongEi"] = (a0, a1) => (__ZN7openmpt6module14select_subsongEi = Module["__ZN7openmpt6module14select_subsongEi"] = wasmExports["ed"])(a0, a1);

var __ZNK7openmpt6module20get_selected_subsongEv = Module["__ZNK7openmpt6module20get_selected_subsongEv"] = a0 => (__ZNK7openmpt6module20get_selected_subsongEv = Module["__ZNK7openmpt6module20get_selected_subsongEv"] = wasmExports["fd"])(a0);

var __ZN7openmpt6module16set_repeat_countEi = Module["__ZN7openmpt6module16set_repeat_countEi"] = (a0, a1) => (__ZN7openmpt6module16set_repeat_countEi = Module["__ZN7openmpt6module16set_repeat_countEi"] = wasmExports["gd"])(a0, a1);

var __ZNK7openmpt6module16get_repeat_countEv = Module["__ZNK7openmpt6module16get_repeat_countEv"] = a0 => (__ZNK7openmpt6module16get_repeat_countEv = Module["__ZNK7openmpt6module16get_repeat_countEv"] = wasmExports["hd"])(a0);

var __ZNK7openmpt6module20get_duration_secondsEv = Module["__ZNK7openmpt6module20get_duration_secondsEv"] = a0 => (__ZNK7openmpt6module20get_duration_secondsEv = Module["__ZNK7openmpt6module20get_duration_secondsEv"] = wasmExports["id"])(a0);

var __ZN7openmpt6module20set_position_secondsEd = Module["__ZN7openmpt6module20set_position_secondsEd"] = (a0, a1) => (__ZN7openmpt6module20set_position_secondsEd = Module["__ZN7openmpt6module20set_position_secondsEd"] = wasmExports["jd"])(a0, a1);

var __ZNK7openmpt6module20get_position_secondsEv = Module["__ZNK7openmpt6module20get_position_secondsEv"] = a0 => (__ZNK7openmpt6module20get_position_secondsEv = Module["__ZNK7openmpt6module20get_position_secondsEv"] = wasmExports["kd"])(a0);

var __ZN7openmpt6module22set_position_order_rowEii = Module["__ZN7openmpt6module22set_position_order_rowEii"] = (a0, a1, a2) => (__ZN7openmpt6module22set_position_order_rowEii = Module["__ZN7openmpt6module22set_position_order_rowEii"] = wasmExports["ld"])(a0, a1, a2);

var __ZNK7openmpt6module16get_render_paramEi = Module["__ZNK7openmpt6module16get_render_paramEi"] = (a0, a1) => (__ZNK7openmpt6module16get_render_paramEi = Module["__ZNK7openmpt6module16get_render_paramEi"] = wasmExports["md"])(a0, a1);

var __ZN7openmpt6module16set_render_paramEii = Module["__ZN7openmpt6module16set_render_paramEii"] = (a0, a1, a2) => (__ZN7openmpt6module16set_render_paramEii = Module["__ZN7openmpt6module16set_render_paramEii"] = wasmExports["nd"])(a0, a1, a2);

var __ZN7openmpt6module4readEimPs = Module["__ZN7openmpt6module4readEimPs"] = (a0, a1, a2, a3) => (__ZN7openmpt6module4readEimPs = Module["__ZN7openmpt6module4readEimPs"] = wasmExports["od"])(a0, a1, a2, a3);

var __ZN7openmpt6module4readEimPsS1_ = Module["__ZN7openmpt6module4readEimPsS1_"] = (a0, a1, a2, a3, a4) => (__ZN7openmpt6module4readEimPsS1_ = Module["__ZN7openmpt6module4readEimPsS1_"] = wasmExports["pd"])(a0, a1, a2, a3, a4);

var __ZN7openmpt6module4readEimPsS1_S1_S1_ = Module["__ZN7openmpt6module4readEimPsS1_S1_S1_"] = (a0, a1, a2, a3, a4, a5, a6) => (__ZN7openmpt6module4readEimPsS1_S1_S1_ = Module["__ZN7openmpt6module4readEimPsS1_S1_S1_"] = wasmExports["qd"])(a0, a1, a2, a3, a4, a5, a6);

var __ZN7openmpt6module4readEimPf = Module["__ZN7openmpt6module4readEimPf"] = (a0, a1, a2, a3) => (__ZN7openmpt6module4readEimPf = Module["__ZN7openmpt6module4readEimPf"] = wasmExports["rd"])(a0, a1, a2, a3);

var __ZN7openmpt6module4readEimPfS1_ = Module["__ZN7openmpt6module4readEimPfS1_"] = (a0, a1, a2, a3, a4) => (__ZN7openmpt6module4readEimPfS1_ = Module["__ZN7openmpt6module4readEimPfS1_"] = wasmExports["sd"])(a0, a1, a2, a3, a4);

var __ZN7openmpt6module4readEimPfS1_S1_S1_ = Module["__ZN7openmpt6module4readEimPfS1_S1_S1_"] = (a0, a1, a2, a3, a4, a5, a6) => (__ZN7openmpt6module4readEimPfS1_S1_S1_ = Module["__ZN7openmpt6module4readEimPfS1_S1_S1_"] = wasmExports["td"])(a0, a1, a2, a3, a4, a5, a6);

var __ZN7openmpt6module23read_interleaved_stereoEimPs = Module["__ZN7openmpt6module23read_interleaved_stereoEimPs"] = (a0, a1, a2, a3) => (__ZN7openmpt6module23read_interleaved_stereoEimPs = Module["__ZN7openmpt6module23read_interleaved_stereoEimPs"] = wasmExports["ud"])(a0, a1, a2, a3);

var __ZN7openmpt6module21read_interleaved_quadEimPs = Module["__ZN7openmpt6module21read_interleaved_quadEimPs"] = (a0, a1, a2, a3) => (__ZN7openmpt6module21read_interleaved_quadEimPs = Module["__ZN7openmpt6module21read_interleaved_quadEimPs"] = wasmExports["vd"])(a0, a1, a2, a3);

var __ZN7openmpt6module23read_interleaved_stereoEimPf = Module["__ZN7openmpt6module23read_interleaved_stereoEimPf"] = (a0, a1, a2, a3) => (__ZN7openmpt6module23read_interleaved_stereoEimPf = Module["__ZN7openmpt6module23read_interleaved_stereoEimPf"] = wasmExports["wd"])(a0, a1, a2, a3);

var __ZN7openmpt6module21read_interleaved_quadEimPf = Module["__ZN7openmpt6module21read_interleaved_quadEimPf"] = (a0, a1, a2, a3) => (__ZN7openmpt6module21read_interleaved_quadEimPf = Module["__ZN7openmpt6module21read_interleaved_quadEimPf"] = wasmExports["xd"])(a0, a1, a2, a3);

var __ZNK7openmpt6module17get_metadata_keysEv = Module["__ZNK7openmpt6module17get_metadata_keysEv"] = (a0, a1) => (__ZNK7openmpt6module17get_metadata_keysEv = Module["__ZNK7openmpt6module17get_metadata_keysEv"] = wasmExports["yd"])(a0, a1);

var __ZNK7openmpt6module12get_metadataERKNSt3__212basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEE = Module["__ZNK7openmpt6module12get_metadataERKNSt3__212basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEE"] = (a0, a1, a2) => (__ZNK7openmpt6module12get_metadataERKNSt3__212basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEE = Module["__ZNK7openmpt6module12get_metadataERKNSt3__212basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEE"] = wasmExports["zd"])(a0, a1, a2);

var __ZNK7openmpt6module25get_current_estimated_bpmEv = Module["__ZNK7openmpt6module25get_current_estimated_bpmEv"] = a0 => (__ZNK7openmpt6module25get_current_estimated_bpmEv = Module["__ZNK7openmpt6module25get_current_estimated_bpmEv"] = wasmExports["Ad"])(a0);

var __ZNK7openmpt6module17get_current_speedEv = Module["__ZNK7openmpt6module17get_current_speedEv"] = a0 => (__ZNK7openmpt6module17get_current_speedEv = Module["__ZNK7openmpt6module17get_current_speedEv"] = wasmExports["Bd"])(a0);

var __ZNK7openmpt6module17get_current_tempoEv = Module["__ZNK7openmpt6module17get_current_tempoEv"] = a0 => (__ZNK7openmpt6module17get_current_tempoEv = Module["__ZNK7openmpt6module17get_current_tempoEv"] = wasmExports["Cd"])(a0);

var __ZNK7openmpt6module18get_current_tempo2Ev = Module["__ZNK7openmpt6module18get_current_tempo2Ev"] = a0 => (__ZNK7openmpt6module18get_current_tempo2Ev = Module["__ZNK7openmpt6module18get_current_tempo2Ev"] = wasmExports["Dd"])(a0);

var __ZNK7openmpt6module17get_current_orderEv = Module["__ZNK7openmpt6module17get_current_orderEv"] = a0 => (__ZNK7openmpt6module17get_current_orderEv = Module["__ZNK7openmpt6module17get_current_orderEv"] = wasmExports["Ed"])(a0);

var __ZNK7openmpt6module19get_current_patternEv = Module["__ZNK7openmpt6module19get_current_patternEv"] = a0 => (__ZNK7openmpt6module19get_current_patternEv = Module["__ZNK7openmpt6module19get_current_patternEv"] = wasmExports["Fd"])(a0);

var __ZNK7openmpt6module15get_current_rowEv = Module["__ZNK7openmpt6module15get_current_rowEv"] = a0 => (__ZNK7openmpt6module15get_current_rowEv = Module["__ZNK7openmpt6module15get_current_rowEv"] = wasmExports["Gd"])(a0);

var __ZNK7openmpt6module28get_current_playing_channelsEv = Module["__ZNK7openmpt6module28get_current_playing_channelsEv"] = a0 => (__ZNK7openmpt6module28get_current_playing_channelsEv = Module["__ZNK7openmpt6module28get_current_playing_channelsEv"] = wasmExports["Hd"])(a0);

var __ZNK7openmpt6module27get_current_channel_vu_monoEi = Module["__ZNK7openmpt6module27get_current_channel_vu_monoEi"] = (a0, a1) => (__ZNK7openmpt6module27get_current_channel_vu_monoEi = Module["__ZNK7openmpt6module27get_current_channel_vu_monoEi"] = wasmExports["Id"])(a0, a1);

var __ZNK7openmpt6module27get_current_channel_vu_leftEi = Module["__ZNK7openmpt6module27get_current_channel_vu_leftEi"] = (a0, a1) => (__ZNK7openmpt6module27get_current_channel_vu_leftEi = Module["__ZNK7openmpt6module27get_current_channel_vu_leftEi"] = wasmExports["Jd"])(a0, a1);

var __ZNK7openmpt6module28get_current_channel_vu_rightEi = Module["__ZNK7openmpt6module28get_current_channel_vu_rightEi"] = (a0, a1) => (__ZNK7openmpt6module28get_current_channel_vu_rightEi = Module["__ZNK7openmpt6module28get_current_channel_vu_rightEi"] = wasmExports["Kd"])(a0, a1);

var __ZNK7openmpt6module32get_current_channel_vu_rear_leftEi = Module["__ZNK7openmpt6module32get_current_channel_vu_rear_leftEi"] = (a0, a1) => (__ZNK7openmpt6module32get_current_channel_vu_rear_leftEi = Module["__ZNK7openmpt6module32get_current_channel_vu_rear_leftEi"] = wasmExports["Ld"])(a0, a1);

var __ZNK7openmpt6module33get_current_channel_vu_rear_rightEi = Module["__ZNK7openmpt6module33get_current_channel_vu_rear_rightEi"] = (a0, a1) => (__ZNK7openmpt6module33get_current_channel_vu_rear_rightEi = Module["__ZNK7openmpt6module33get_current_channel_vu_rear_rightEi"] = wasmExports["Md"])(a0, a1);

var __ZNK7openmpt6module16get_num_subsongsEv = Module["__ZNK7openmpt6module16get_num_subsongsEv"] = a0 => (__ZNK7openmpt6module16get_num_subsongsEv = Module["__ZNK7openmpt6module16get_num_subsongsEv"] = wasmExports["Nd"])(a0);

var __ZNK7openmpt6module16get_num_channelsEv = Module["__ZNK7openmpt6module16get_num_channelsEv"] = a0 => (__ZNK7openmpt6module16get_num_channelsEv = Module["__ZNK7openmpt6module16get_num_channelsEv"] = wasmExports["Od"])(a0);

var __ZNK7openmpt6module14get_num_ordersEv = Module["__ZNK7openmpt6module14get_num_ordersEv"] = a0 => (__ZNK7openmpt6module14get_num_ordersEv = Module["__ZNK7openmpt6module14get_num_ordersEv"] = wasmExports["Pd"])(a0);

var __ZNK7openmpt6module16get_num_patternsEv = Module["__ZNK7openmpt6module16get_num_patternsEv"] = a0 => (__ZNK7openmpt6module16get_num_patternsEv = Module["__ZNK7openmpt6module16get_num_patternsEv"] = wasmExports["Qd"])(a0);

var __ZNK7openmpt6module19get_num_instrumentsEv = Module["__ZNK7openmpt6module19get_num_instrumentsEv"] = a0 => (__ZNK7openmpt6module19get_num_instrumentsEv = Module["__ZNK7openmpt6module19get_num_instrumentsEv"] = wasmExports["Rd"])(a0);

var __ZNK7openmpt6module15get_num_samplesEv = Module["__ZNK7openmpt6module15get_num_samplesEv"] = a0 => (__ZNK7openmpt6module15get_num_samplesEv = Module["__ZNK7openmpt6module15get_num_samplesEv"] = wasmExports["Sd"])(a0);

var __ZNK7openmpt6module17get_subsong_namesEv = Module["__ZNK7openmpt6module17get_subsong_namesEv"] = (a0, a1) => (__ZNK7openmpt6module17get_subsong_namesEv = Module["__ZNK7openmpt6module17get_subsong_namesEv"] = wasmExports["Td"])(a0, a1);

var __ZNK7openmpt6module17get_channel_namesEv = Module["__ZNK7openmpt6module17get_channel_namesEv"] = (a0, a1) => (__ZNK7openmpt6module17get_channel_namesEv = Module["__ZNK7openmpt6module17get_channel_namesEv"] = wasmExports["Ud"])(a0, a1);

var __ZNK7openmpt6module15get_order_namesEv = Module["__ZNK7openmpt6module15get_order_namesEv"] = (a0, a1) => (__ZNK7openmpt6module15get_order_namesEv = Module["__ZNK7openmpt6module15get_order_namesEv"] = wasmExports["Vd"])(a0, a1);

var __ZNK7openmpt6module17get_pattern_namesEv = Module["__ZNK7openmpt6module17get_pattern_namesEv"] = (a0, a1) => (__ZNK7openmpt6module17get_pattern_namesEv = Module["__ZNK7openmpt6module17get_pattern_namesEv"] = wasmExports["Wd"])(a0, a1);

var __ZNK7openmpt6module20get_instrument_namesEv = Module["__ZNK7openmpt6module20get_instrument_namesEv"] = (a0, a1) => (__ZNK7openmpt6module20get_instrument_namesEv = Module["__ZNK7openmpt6module20get_instrument_namesEv"] = wasmExports["Xd"])(a0, a1);

var __ZNK7openmpt6module16get_sample_namesEv = Module["__ZNK7openmpt6module16get_sample_namesEv"] = (a0, a1) => (__ZNK7openmpt6module16get_sample_namesEv = Module["__ZNK7openmpt6module16get_sample_namesEv"] = wasmExports["Yd"])(a0, a1);

var __ZNK7openmpt6module17get_order_patternEi = Module["__ZNK7openmpt6module17get_order_patternEi"] = (a0, a1) => (__ZNK7openmpt6module17get_order_patternEi = Module["__ZNK7openmpt6module17get_order_patternEi"] = wasmExports["Zd"])(a0, a1);

var __ZNK7openmpt6module20get_pattern_num_rowsEi = Module["__ZNK7openmpt6module20get_pattern_num_rowsEi"] = (a0, a1) => (__ZNK7openmpt6module20get_pattern_num_rowsEi = Module["__ZNK7openmpt6module20get_pattern_num_rowsEi"] = wasmExports["_d"])(a0, a1);

var __ZNK7openmpt6module31get_pattern_row_channel_commandEiiii = Module["__ZNK7openmpt6module31get_pattern_row_channel_commandEiiii"] = (a0, a1, a2, a3, a4) => (__ZNK7openmpt6module31get_pattern_row_channel_commandEiiii = Module["__ZNK7openmpt6module31get_pattern_row_channel_commandEiiii"] = wasmExports["$d"])(a0, a1, a2, a3, a4);

var __ZNK7openmpt6module34format_pattern_row_channel_commandEiiii = Module["__ZNK7openmpt6module34format_pattern_row_channel_commandEiiii"] = (a0, a1, a2, a3, a4, a5) => (__ZNK7openmpt6module34format_pattern_row_channel_commandEiiii = Module["__ZNK7openmpt6module34format_pattern_row_channel_commandEiiii"] = wasmExports["ae"])(a0, a1, a2, a3, a4, a5);

var __ZNK7openmpt6module37highlight_pattern_row_channel_commandEiiii = Module["__ZNK7openmpt6module37highlight_pattern_row_channel_commandEiiii"] = (a0, a1, a2, a3, a4, a5) => (__ZNK7openmpt6module37highlight_pattern_row_channel_commandEiiii = Module["__ZNK7openmpt6module37highlight_pattern_row_channel_commandEiiii"] = wasmExports["be"])(a0, a1, a2, a3, a4, a5);

var __ZNK7openmpt6module26format_pattern_row_channelEiiimb = Module["__ZNK7openmpt6module26format_pattern_row_channelEiiimb"] = (a0, a1, a2, a3, a4, a5, a6) => (__ZNK7openmpt6module26format_pattern_row_channelEiiimb = Module["__ZNK7openmpt6module26format_pattern_row_channelEiiimb"] = wasmExports["ce"])(a0, a1, a2, a3, a4, a5, a6);

var __ZNK7openmpt6module29highlight_pattern_row_channelEiiimb = Module["__ZNK7openmpt6module29highlight_pattern_row_channelEiiimb"] = (a0, a1, a2, a3, a4, a5, a6) => (__ZNK7openmpt6module29highlight_pattern_row_channelEiiimb = Module["__ZNK7openmpt6module29highlight_pattern_row_channelEiiimb"] = wasmExports["de"])(a0, a1, a2, a3, a4, a5, a6);

var __ZNK7openmpt6module8get_ctlsEv = Module["__ZNK7openmpt6module8get_ctlsEv"] = (a0, a1) => (__ZNK7openmpt6module8get_ctlsEv = Module["__ZNK7openmpt6module8get_ctlsEv"] = wasmExports["ee"])(a0, a1);

var __ZNK7openmpt6module7ctl_getERKNSt3__212basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEE = Module["__ZNK7openmpt6module7ctl_getERKNSt3__212basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEE"] = (a0, a1, a2) => (__ZNK7openmpt6module7ctl_getERKNSt3__212basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEE = Module["__ZNK7openmpt6module7ctl_getERKNSt3__212basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEE"] = wasmExports["fe"])(a0, a1, a2);

var __ZNK7openmpt6module15ctl_get_booleanENSt3__217basic_string_viewIcNS1_11char_traitsIcEEEE = Module["__ZNK7openmpt6module15ctl_get_booleanENSt3__217basic_string_viewIcNS1_11char_traitsIcEEEE"] = (a0, a1) => (__ZNK7openmpt6module15ctl_get_booleanENSt3__217basic_string_viewIcNS1_11char_traitsIcEEEE = Module["__ZNK7openmpt6module15ctl_get_booleanENSt3__217basic_string_viewIcNS1_11char_traitsIcEEEE"] = wasmExports["ge"])(a0, a1);

var __ZNK7openmpt6module15ctl_get_integerENSt3__217basic_string_viewIcNS1_11char_traitsIcEEEE = Module["__ZNK7openmpt6module15ctl_get_integerENSt3__217basic_string_viewIcNS1_11char_traitsIcEEEE"] = (a0, a1) => (__ZNK7openmpt6module15ctl_get_integerENSt3__217basic_string_viewIcNS1_11char_traitsIcEEEE = Module["__ZNK7openmpt6module15ctl_get_integerENSt3__217basic_string_viewIcNS1_11char_traitsIcEEEE"] = wasmExports["he"])(a0, a1);

var __ZNK7openmpt6module21ctl_get_floatingpointENSt3__217basic_string_viewIcNS1_11char_traitsIcEEEE = Module["__ZNK7openmpt6module21ctl_get_floatingpointENSt3__217basic_string_viewIcNS1_11char_traitsIcEEEE"] = (a0, a1) => (__ZNK7openmpt6module21ctl_get_floatingpointENSt3__217basic_string_viewIcNS1_11char_traitsIcEEEE = Module["__ZNK7openmpt6module21ctl_get_floatingpointENSt3__217basic_string_viewIcNS1_11char_traitsIcEEEE"] = wasmExports["ie"])(a0, a1);

var __ZNK7openmpt6module12ctl_get_textENSt3__217basic_string_viewIcNS1_11char_traitsIcEEEE = Module["__ZNK7openmpt6module12ctl_get_textENSt3__217basic_string_viewIcNS1_11char_traitsIcEEEE"] = (a0, a1, a2) => (__ZNK7openmpt6module12ctl_get_textENSt3__217basic_string_viewIcNS1_11char_traitsIcEEEE = Module["__ZNK7openmpt6module12ctl_get_textENSt3__217basic_string_viewIcNS1_11char_traitsIcEEEE"] = wasmExports["je"])(a0, a1, a2);

var __ZN7openmpt6module7ctl_setERKNSt3__212basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEES9_ = Module["__ZN7openmpt6module7ctl_setERKNSt3__212basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEES9_"] = (a0, a1, a2) => (__ZN7openmpt6module7ctl_setERKNSt3__212basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEES9_ = Module["__ZN7openmpt6module7ctl_setERKNSt3__212basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEES9_"] = wasmExports["ke"])(a0, a1, a2);

var __ZN7openmpt6module15ctl_set_booleanENSt3__217basic_string_viewIcNS1_11char_traitsIcEEEEb = Module["__ZN7openmpt6module15ctl_set_booleanENSt3__217basic_string_viewIcNS1_11char_traitsIcEEEEb"] = (a0, a1, a2) => (__ZN7openmpt6module15ctl_set_booleanENSt3__217basic_string_viewIcNS1_11char_traitsIcEEEEb = Module["__ZN7openmpt6module15ctl_set_booleanENSt3__217basic_string_viewIcNS1_11char_traitsIcEEEEb"] = wasmExports["le"])(a0, a1, a2);

var __ZN7openmpt6module15ctl_set_integerENSt3__217basic_string_viewIcNS1_11char_traitsIcEEEEx = Module["__ZN7openmpt6module15ctl_set_integerENSt3__217basic_string_viewIcNS1_11char_traitsIcEEEEx"] = (a0, a1, a2, a3) => (__ZN7openmpt6module15ctl_set_integerENSt3__217basic_string_viewIcNS1_11char_traitsIcEEEEx = Module["__ZN7openmpt6module15ctl_set_integerENSt3__217basic_string_viewIcNS1_11char_traitsIcEEEEx"] = wasmExports["me"])(a0, a1, a2, a3);

var __ZN7openmpt6module21ctl_set_floatingpointENSt3__217basic_string_viewIcNS1_11char_traitsIcEEEEd = Module["__ZN7openmpt6module21ctl_set_floatingpointENSt3__217basic_string_viewIcNS1_11char_traitsIcEEEEd"] = (a0, a1, a2) => (__ZN7openmpt6module21ctl_set_floatingpointENSt3__217basic_string_viewIcNS1_11char_traitsIcEEEEd = Module["__ZN7openmpt6module21ctl_set_floatingpointENSt3__217basic_string_viewIcNS1_11char_traitsIcEEEEd"] = wasmExports["ne"])(a0, a1, a2);

var __ZN7openmpt6module12ctl_set_textENSt3__217basic_string_viewIcNS1_11char_traitsIcEEEES5_ = Module["__ZN7openmpt6module12ctl_set_textENSt3__217basic_string_viewIcNS1_11char_traitsIcEEEES5_"] = (a0, a1, a2) => (__ZN7openmpt6module12ctl_set_textENSt3__217basic_string_viewIcNS1_11char_traitsIcEEEES5_ = Module["__ZN7openmpt6module12ctl_set_textENSt3__217basic_string_viewIcNS1_11char_traitsIcEEEES5_"] = wasmExports["oe"])(a0, a1, a2);

var __ZN7openmpt10module_extC2ERNSt3__213basic_istreamIcNS1_11char_traitsIcEEEERNS1_13basic_ostreamIcS4_EERKNS1_3mapINS1_12basic_stringIcS4_NS1_9allocatorIcEEEESE_NS1_4lessISE_EENSC_INS1_4pairIKSE_SE_EEEEEE = Module["__ZN7openmpt10module_extC2ERNSt3__213basic_istreamIcNS1_11char_traitsIcEEEERNS1_13basic_ostreamIcS4_EERKNS1_3mapINS1_12basic_stringIcS4_NS1_9allocatorIcEEEESE_NS1_4lessISE_EENSC_INS1_4pairIKSE_SE_EEEEEE"] = (a0, a1, a2, a3) => (__ZN7openmpt10module_extC2ERNSt3__213basic_istreamIcNS1_11char_traitsIcEEEERNS1_13basic_ostreamIcS4_EERKNS1_3mapINS1_12basic_stringIcS4_NS1_9allocatorIcEEEESE_NS1_4lessISE_EENSC_INS1_4pairIKSE_SE_EEEEEE = Module["__ZN7openmpt10module_extC2ERNSt3__213basic_istreamIcNS1_11char_traitsIcEEEERNS1_13basic_ostreamIcS4_EERKNS1_3mapINS1_12basic_stringIcS4_NS1_9allocatorIcEEEESE_NS1_4lessISE_EENSC_INS1_4pairIKSE_SE_EEEEEE"] = wasmExports["pe"])(a0, a1, a2, a3);

var __ZN7openmpt10module_extC2ERKNSt3__26vectorIhNS1_9allocatorIhEEEERNS1_13basic_ostreamIcNS1_11char_traitsIcEEEERKNS1_3mapINS1_12basic_stringIcSA_NS3_IcEEEESG_NS1_4lessISG_EENS3_INS1_4pairIKSG_SG_EEEEEE = Module["__ZN7openmpt10module_extC2ERKNSt3__26vectorIhNS1_9allocatorIhEEEERNS1_13basic_ostreamIcNS1_11char_traitsIcEEEERKNS1_3mapINS1_12basic_stringIcSA_NS3_IcEEEESG_NS1_4lessISG_EENS3_INS1_4pairIKSG_SG_EEEEEE"] = (a0, a1, a2, a3) => (__ZN7openmpt10module_extC2ERKNSt3__26vectorIhNS1_9allocatorIhEEEERNS1_13basic_ostreamIcNS1_11char_traitsIcEEEERKNS1_3mapINS1_12basic_stringIcSA_NS3_IcEEEESG_NS1_4lessISG_EENS3_INS1_4pairIKSG_SG_EEEEEE = Module["__ZN7openmpt10module_extC2ERKNSt3__26vectorIhNS1_9allocatorIhEEEERNS1_13basic_ostreamIcNS1_11char_traitsIcEEEERKNS1_3mapINS1_12basic_stringIcSA_NS3_IcEEEESG_NS1_4lessISG_EENS3_INS1_4pairIKSG_SG_EEEEEE"] = wasmExports["qe"])(a0, a1, a2, a3);

var __ZN7openmpt10module_extC2ERKNSt3__26vectorIcNS1_9allocatorIcEEEERNS1_13basic_ostreamIcNS1_11char_traitsIcEEEERKNS1_3mapINS1_12basic_stringIcSA_S4_EESF_NS1_4lessISF_EENS3_INS1_4pairIKSF_SF_EEEEEE = Module["__ZN7openmpt10module_extC2ERKNSt3__26vectorIcNS1_9allocatorIcEEEERNS1_13basic_ostreamIcNS1_11char_traitsIcEEEERKNS1_3mapINS1_12basic_stringIcSA_S4_EESF_NS1_4lessISF_EENS3_INS1_4pairIKSF_SF_EEEEEE"] = (a0, a1, a2, a3) => (__ZN7openmpt10module_extC2ERKNSt3__26vectorIcNS1_9allocatorIcEEEERNS1_13basic_ostreamIcNS1_11char_traitsIcEEEERKNS1_3mapINS1_12basic_stringIcSA_S4_EESF_NS1_4lessISF_EENS3_INS1_4pairIKSF_SF_EEEEEE = Module["__ZN7openmpt10module_extC2ERKNSt3__26vectorIcNS1_9allocatorIcEEEERNS1_13basic_ostreamIcNS1_11char_traitsIcEEEERKNS1_3mapINS1_12basic_stringIcSA_S4_EESF_NS1_4lessISF_EENS3_INS1_4pairIKSF_SF_EEEEEE"] = wasmExports["re"])(a0, a1, a2, a3);

var __ZN7openmpt10module_extC2ERKNSt3__26vectorISt4byteNS1_9allocatorIS3_EEEERNS1_13basic_ostreamIcNS1_11char_traitsIcEEEERKNS1_3mapINS1_12basic_stringIcSB_NS4_IcEEEESH_NS1_4lessISH_EENS4_INS1_4pairIKSH_SH_EEEEEE = Module["__ZN7openmpt10module_extC2ERKNSt3__26vectorISt4byteNS1_9allocatorIS3_EEEERNS1_13basic_ostreamIcNS1_11char_traitsIcEEEERKNS1_3mapINS1_12basic_stringIcSB_NS4_IcEEEESH_NS1_4lessISH_EENS4_INS1_4pairIKSH_SH_EEEEEE"] = (a0, a1, a2, a3) => (__ZN7openmpt10module_extC2ERKNSt3__26vectorISt4byteNS1_9allocatorIS3_EEEERNS1_13basic_ostreamIcNS1_11char_traitsIcEEEERKNS1_3mapINS1_12basic_stringIcSB_NS4_IcEEEESH_NS1_4lessISH_EENS4_INS1_4pairIKSH_SH_EEEEEE = Module["__ZN7openmpt10module_extC2ERKNSt3__26vectorISt4byteNS1_9allocatorIS3_EEEERNS1_13basic_ostreamIcNS1_11char_traitsIcEEEERKNS1_3mapINS1_12basic_stringIcSB_NS4_IcEEEESH_NS1_4lessISH_EENS4_INS1_4pairIKSH_SH_EEEEEE"] = wasmExports["se"])(a0, a1, a2, a3);

var __ZN7openmpt10module_extC2EPKhmRNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE = Module["__ZN7openmpt10module_extC2EPKhmRNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE"] = (a0, a1, a2, a3, a4) => (__ZN7openmpt10module_extC2EPKhmRNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE = Module["__ZN7openmpt10module_extC2EPKhmRNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE"] = wasmExports["te"])(a0, a1, a2, a3, a4);

var __ZN7openmpt10module_extC2EPKcmRNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE = Module["__ZN7openmpt10module_extC2EPKcmRNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE"] = (a0, a1, a2, a3, a4) => (__ZN7openmpt10module_extC2EPKcmRNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE = Module["__ZN7openmpt10module_extC2EPKcmRNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE"] = wasmExports["ue"])(a0, a1, a2, a3, a4);

var __ZN7openmpt10module_extC2EPKSt4bytemRNSt3__213basic_ostreamIcNS4_11char_traitsIcEEEERKNS4_3mapINS4_12basic_stringIcS7_NS4_9allocatorIcEEEESE_NS4_4lessISE_EENSC_INS4_4pairIKSE_SE_EEEEEE = Module["__ZN7openmpt10module_extC2EPKSt4bytemRNSt3__213basic_ostreamIcNS4_11char_traitsIcEEEERKNS4_3mapINS4_12basic_stringIcS7_NS4_9allocatorIcEEEESE_NS4_4lessISE_EENSC_INS4_4pairIKSE_SE_EEEEEE"] = (a0, a1, a2, a3, a4) => (__ZN7openmpt10module_extC2EPKSt4bytemRNSt3__213basic_ostreamIcNS4_11char_traitsIcEEEERKNS4_3mapINS4_12basic_stringIcS7_NS4_9allocatorIcEEEESE_NS4_4lessISE_EENSC_INS4_4pairIKSE_SE_EEEEEE = Module["__ZN7openmpt10module_extC2EPKSt4bytemRNSt3__213basic_ostreamIcNS4_11char_traitsIcEEEERKNS4_3mapINS4_12basic_stringIcS7_NS4_9allocatorIcEEEESE_NS4_4lessISE_EENSC_INS4_4pairIKSE_SE_EEEEEE"] = wasmExports["ve"])(a0, a1, a2, a3, a4);

var __ZN7openmpt10module_extC2EPKvmRNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE = Module["__ZN7openmpt10module_extC2EPKvmRNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE"] = (a0, a1, a2, a3, a4) => (__ZN7openmpt10module_extC2EPKvmRNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE = Module["__ZN7openmpt10module_extC2EPKvmRNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE"] = wasmExports["we"])(a0, a1, a2, a3, a4);

var __ZN7openmpt10module_extD2Ev = Module["__ZN7openmpt10module_extD2Ev"] = a0 => (__ZN7openmpt10module_extD2Ev = Module["__ZN7openmpt10module_extD2Ev"] = wasmExports["xe"])(a0);

var __ZN7openmpt10module_extD0Ev = Module["__ZN7openmpt10module_extD0Ev"] = a0 => (__ZN7openmpt10module_extD0Ev = Module["__ZN7openmpt10module_extD0Ev"] = wasmExports["ye"])(a0);

var __ZN7openmpt10module_extC2ERKS0_ = Module["__ZN7openmpt10module_extC2ERKS0_"] = (a0, a1) => (__ZN7openmpt10module_extC2ERKS0_ = Module["__ZN7openmpt10module_extC2ERKS0_"] = wasmExports["ze"])(a0, a1);

var __ZN7openmpt10module_extaSERKS0_ = Module["__ZN7openmpt10module_extaSERKS0_"] = (a0, a1) => (__ZN7openmpt10module_extaSERKS0_ = Module["__ZN7openmpt10module_extaSERKS0_"] = wasmExports["Ae"])(a0, a1);

var __ZN7openmpt10module_ext13get_interfaceERKNSt3__212basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEE = Module["__ZN7openmpt10module_ext13get_interfaceERKNSt3__212basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEE"] = (a0, a1) => (__ZN7openmpt10module_ext13get_interfaceERKNSt3__212basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEE = Module["__ZN7openmpt10module_ext13get_interfaceERKNSt3__212basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEE"] = wasmExports["Be"])(a0, a1);

var __ZN7openmpt9exceptionC1ERKNSt3__212basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEE = Module["__ZN7openmpt9exceptionC1ERKNSt3__212basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEE"] = (a0, a1) => (__ZN7openmpt9exceptionC1ERKNSt3__212basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEE = Module["__ZN7openmpt9exceptionC1ERKNSt3__212basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEE"] = wasmExports["Ce"])(a0, a1);

var __ZN7openmpt9exceptionC1ERKS0_ = Module["__ZN7openmpt9exceptionC1ERKS0_"] = (a0, a1) => (__ZN7openmpt9exceptionC1ERKS0_ = Module["__ZN7openmpt9exceptionC1ERKS0_"] = wasmExports["De"])(a0, a1);

var __ZN7openmpt9exceptionC1EOS0_ = Module["__ZN7openmpt9exceptionC1EOS0_"] = (a0, a1) => (__ZN7openmpt9exceptionC1EOS0_ = Module["__ZN7openmpt9exceptionC1EOS0_"] = wasmExports["Ee"])(a0, a1);

var __ZN7openmpt9exceptionD1Ev = Module["__ZN7openmpt9exceptionD1Ev"] = a0 => (__ZN7openmpt9exceptionD1Ev = Module["__ZN7openmpt9exceptionD1Ev"] = wasmExports["Fe"])(a0);

var __ZN7openmpt6moduleC1ERNSt3__213basic_istreamIcNS1_11char_traitsIcEEEERNS1_13basic_ostreamIcS4_EERKNS1_3mapINS1_12basic_stringIcS4_NS1_9allocatorIcEEEESE_NS1_4lessISE_EENSC_INS1_4pairIKSE_SE_EEEEEE = Module["__ZN7openmpt6moduleC1ERNSt3__213basic_istreamIcNS1_11char_traitsIcEEEERNS1_13basic_ostreamIcS4_EERKNS1_3mapINS1_12basic_stringIcS4_NS1_9allocatorIcEEEESE_NS1_4lessISE_EENSC_INS1_4pairIKSE_SE_EEEEEE"] = (a0, a1, a2, a3) => (__ZN7openmpt6moduleC1ERNSt3__213basic_istreamIcNS1_11char_traitsIcEEEERNS1_13basic_ostreamIcS4_EERKNS1_3mapINS1_12basic_stringIcS4_NS1_9allocatorIcEEEESE_NS1_4lessISE_EENSC_INS1_4pairIKSE_SE_EEEEEE = Module["__ZN7openmpt6moduleC1ERNSt3__213basic_istreamIcNS1_11char_traitsIcEEEERNS1_13basic_ostreamIcS4_EERKNS1_3mapINS1_12basic_stringIcS4_NS1_9allocatorIcEEEESE_NS1_4lessISE_EENSC_INS1_4pairIKSE_SE_EEEEEE"] = wasmExports["Ge"])(a0, a1, a2, a3);

var __ZN7openmpt6moduleC1ERKNSt3__26vectorISt4byteNS1_9allocatorIS3_EEEERNS1_13basic_ostreamIcNS1_11char_traitsIcEEEERKNS1_3mapINS1_12basic_stringIcSB_NS4_IcEEEESH_NS1_4lessISH_EENS4_INS1_4pairIKSH_SH_EEEEEE = Module["__ZN7openmpt6moduleC1ERKNSt3__26vectorISt4byteNS1_9allocatorIS3_EEEERNS1_13basic_ostreamIcNS1_11char_traitsIcEEEERKNS1_3mapINS1_12basic_stringIcSB_NS4_IcEEEESH_NS1_4lessISH_EENS4_INS1_4pairIKSH_SH_EEEEEE"] = (a0, a1, a2, a3) => (__ZN7openmpt6moduleC1ERKNSt3__26vectorISt4byteNS1_9allocatorIS3_EEEERNS1_13basic_ostreamIcNS1_11char_traitsIcEEEERKNS1_3mapINS1_12basic_stringIcSB_NS4_IcEEEESH_NS1_4lessISH_EENS4_INS1_4pairIKSH_SH_EEEEEE = Module["__ZN7openmpt6moduleC1ERKNSt3__26vectorISt4byteNS1_9allocatorIS3_EEEERNS1_13basic_ostreamIcNS1_11char_traitsIcEEEERKNS1_3mapINS1_12basic_stringIcSB_NS4_IcEEEESH_NS1_4lessISH_EENS4_INS1_4pairIKSH_SH_EEEEEE"] = wasmExports["He"])(a0, a1, a2, a3);

var __ZN7openmpt6moduleC1EPKSt4byteS3_RNSt3__213basic_ostreamIcNS4_11char_traitsIcEEEERKNS4_3mapINS4_12basic_stringIcS7_NS4_9allocatorIcEEEESE_NS4_4lessISE_EENSC_INS4_4pairIKSE_SE_EEEEEE = Module["__ZN7openmpt6moduleC1EPKSt4byteS3_RNSt3__213basic_ostreamIcNS4_11char_traitsIcEEEERKNS4_3mapINS4_12basic_stringIcS7_NS4_9allocatorIcEEEESE_NS4_4lessISE_EENSC_INS4_4pairIKSE_SE_EEEEEE"] = (a0, a1, a2, a3, a4) => (__ZN7openmpt6moduleC1EPKSt4byteS3_RNSt3__213basic_ostreamIcNS4_11char_traitsIcEEEERKNS4_3mapINS4_12basic_stringIcS7_NS4_9allocatorIcEEEESE_NS4_4lessISE_EENSC_INS4_4pairIKSE_SE_EEEEEE = Module["__ZN7openmpt6moduleC1EPKSt4byteS3_RNSt3__213basic_ostreamIcNS4_11char_traitsIcEEEERKNS4_3mapINS4_12basic_stringIcS7_NS4_9allocatorIcEEEESE_NS4_4lessISE_EENSC_INS4_4pairIKSE_SE_EEEEEE"] = wasmExports["Ie"])(a0, a1, a2, a3, a4);

var __ZN7openmpt6moduleC1EPKSt4bytemRNSt3__213basic_ostreamIcNS4_11char_traitsIcEEEERKNS4_3mapINS4_12basic_stringIcS7_NS4_9allocatorIcEEEESE_NS4_4lessISE_EENSC_INS4_4pairIKSE_SE_EEEEEE = Module["__ZN7openmpt6moduleC1EPKSt4bytemRNSt3__213basic_ostreamIcNS4_11char_traitsIcEEEERKNS4_3mapINS4_12basic_stringIcS7_NS4_9allocatorIcEEEESE_NS4_4lessISE_EENSC_INS4_4pairIKSE_SE_EEEEEE"] = (a0, a1, a2, a3, a4) => (__ZN7openmpt6moduleC1EPKSt4bytemRNSt3__213basic_ostreamIcNS4_11char_traitsIcEEEERKNS4_3mapINS4_12basic_stringIcS7_NS4_9allocatorIcEEEESE_NS4_4lessISE_EENSC_INS4_4pairIKSE_SE_EEEEEE = Module["__ZN7openmpt6moduleC1EPKSt4bytemRNSt3__213basic_ostreamIcNS4_11char_traitsIcEEEERKNS4_3mapINS4_12basic_stringIcS7_NS4_9allocatorIcEEEESE_NS4_4lessISE_EENSC_INS4_4pairIKSE_SE_EEEEEE"] = wasmExports["Je"])(a0, a1, a2, a3, a4);

var __ZN7openmpt6moduleC1ERKNSt3__26vectorIhNS1_9allocatorIhEEEERNS1_13basic_ostreamIcNS1_11char_traitsIcEEEERKNS1_3mapINS1_12basic_stringIcSA_NS3_IcEEEESG_NS1_4lessISG_EENS3_INS1_4pairIKSG_SG_EEEEEE = Module["__ZN7openmpt6moduleC1ERKNSt3__26vectorIhNS1_9allocatorIhEEEERNS1_13basic_ostreamIcNS1_11char_traitsIcEEEERKNS1_3mapINS1_12basic_stringIcSA_NS3_IcEEEESG_NS1_4lessISG_EENS3_INS1_4pairIKSG_SG_EEEEEE"] = (a0, a1, a2, a3) => (__ZN7openmpt6moduleC1ERKNSt3__26vectorIhNS1_9allocatorIhEEEERNS1_13basic_ostreamIcNS1_11char_traitsIcEEEERKNS1_3mapINS1_12basic_stringIcSA_NS3_IcEEEESG_NS1_4lessISG_EENS3_INS1_4pairIKSG_SG_EEEEEE = Module["__ZN7openmpt6moduleC1ERKNSt3__26vectorIhNS1_9allocatorIhEEEERNS1_13basic_ostreamIcNS1_11char_traitsIcEEEERKNS1_3mapINS1_12basic_stringIcSA_NS3_IcEEEESG_NS1_4lessISG_EENS3_INS1_4pairIKSG_SG_EEEEEE"] = wasmExports["Ke"])(a0, a1, a2, a3);

var __ZN7openmpt6moduleC1EPKhS2_RNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE = Module["__ZN7openmpt6moduleC1EPKhS2_RNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE"] = (a0, a1, a2, a3, a4) => (__ZN7openmpt6moduleC1EPKhS2_RNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE = Module["__ZN7openmpt6moduleC1EPKhS2_RNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE"] = wasmExports["Le"])(a0, a1, a2, a3, a4);

var __ZN7openmpt6moduleC1EPKhmRNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE = Module["__ZN7openmpt6moduleC1EPKhmRNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE"] = (a0, a1, a2, a3, a4) => (__ZN7openmpt6moduleC1EPKhmRNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE = Module["__ZN7openmpt6moduleC1EPKhmRNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE"] = wasmExports["Me"])(a0, a1, a2, a3, a4);

var __ZN7openmpt6moduleC1ERKNSt3__26vectorIcNS1_9allocatorIcEEEERNS1_13basic_ostreamIcNS1_11char_traitsIcEEEERKNS1_3mapINS1_12basic_stringIcSA_S4_EESF_NS1_4lessISF_EENS3_INS1_4pairIKSF_SF_EEEEEE = Module["__ZN7openmpt6moduleC1ERKNSt3__26vectorIcNS1_9allocatorIcEEEERNS1_13basic_ostreamIcNS1_11char_traitsIcEEEERKNS1_3mapINS1_12basic_stringIcSA_S4_EESF_NS1_4lessISF_EENS3_INS1_4pairIKSF_SF_EEEEEE"] = (a0, a1, a2, a3) => (__ZN7openmpt6moduleC1ERKNSt3__26vectorIcNS1_9allocatorIcEEEERNS1_13basic_ostreamIcNS1_11char_traitsIcEEEERKNS1_3mapINS1_12basic_stringIcSA_S4_EESF_NS1_4lessISF_EENS3_INS1_4pairIKSF_SF_EEEEEE = Module["__ZN7openmpt6moduleC1ERKNSt3__26vectorIcNS1_9allocatorIcEEEERNS1_13basic_ostreamIcNS1_11char_traitsIcEEEERKNS1_3mapINS1_12basic_stringIcSA_S4_EESF_NS1_4lessISF_EENS3_INS1_4pairIKSF_SF_EEEEEE"] = wasmExports["Ne"])(a0, a1, a2, a3);

var __ZN7openmpt6moduleC1EPKcS2_RNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE = Module["__ZN7openmpt6moduleC1EPKcS2_RNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE"] = (a0, a1, a2, a3, a4) => (__ZN7openmpt6moduleC1EPKcS2_RNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE = Module["__ZN7openmpt6moduleC1EPKcS2_RNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE"] = wasmExports["Oe"])(a0, a1, a2, a3, a4);

var __ZN7openmpt6moduleC1EPKcmRNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE = Module["__ZN7openmpt6moduleC1EPKcmRNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE"] = (a0, a1, a2, a3, a4) => (__ZN7openmpt6moduleC1EPKcmRNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE = Module["__ZN7openmpt6moduleC1EPKcmRNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE"] = wasmExports["Pe"])(a0, a1, a2, a3, a4);

var __ZN7openmpt6moduleC1EPKvmRNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE = Module["__ZN7openmpt6moduleC1EPKvmRNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE"] = (a0, a1, a2, a3, a4) => (__ZN7openmpt6moduleC1EPKvmRNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE = Module["__ZN7openmpt6moduleC1EPKvmRNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE"] = wasmExports["Qe"])(a0, a1, a2, a3, a4);

var __ZN7openmpt6moduleD1Ev = Module["__ZN7openmpt6moduleD1Ev"] = a0 => (__ZN7openmpt6moduleD1Ev = Module["__ZN7openmpt6moduleD1Ev"] = wasmExports["Re"])(a0);

var __ZN7openmpt10module_extC1ERNSt3__213basic_istreamIcNS1_11char_traitsIcEEEERNS1_13basic_ostreamIcS4_EERKNS1_3mapINS1_12basic_stringIcS4_NS1_9allocatorIcEEEESE_NS1_4lessISE_EENSC_INS1_4pairIKSE_SE_EEEEEE = Module["__ZN7openmpt10module_extC1ERNSt3__213basic_istreamIcNS1_11char_traitsIcEEEERNS1_13basic_ostreamIcS4_EERKNS1_3mapINS1_12basic_stringIcS4_NS1_9allocatorIcEEEESE_NS1_4lessISE_EENSC_INS1_4pairIKSE_SE_EEEEEE"] = (a0, a1, a2, a3) => (__ZN7openmpt10module_extC1ERNSt3__213basic_istreamIcNS1_11char_traitsIcEEEERNS1_13basic_ostreamIcS4_EERKNS1_3mapINS1_12basic_stringIcS4_NS1_9allocatorIcEEEESE_NS1_4lessISE_EENSC_INS1_4pairIKSE_SE_EEEEEE = Module["__ZN7openmpt10module_extC1ERNSt3__213basic_istreamIcNS1_11char_traitsIcEEEERNS1_13basic_ostreamIcS4_EERKNS1_3mapINS1_12basic_stringIcS4_NS1_9allocatorIcEEEESE_NS1_4lessISE_EENSC_INS1_4pairIKSE_SE_EEEEEE"] = wasmExports["Se"])(a0, a1, a2, a3);

var __ZN7openmpt10module_extC1ERKNSt3__26vectorIhNS1_9allocatorIhEEEERNS1_13basic_ostreamIcNS1_11char_traitsIcEEEERKNS1_3mapINS1_12basic_stringIcSA_NS3_IcEEEESG_NS1_4lessISG_EENS3_INS1_4pairIKSG_SG_EEEEEE = Module["__ZN7openmpt10module_extC1ERKNSt3__26vectorIhNS1_9allocatorIhEEEERNS1_13basic_ostreamIcNS1_11char_traitsIcEEEERKNS1_3mapINS1_12basic_stringIcSA_NS3_IcEEEESG_NS1_4lessISG_EENS3_INS1_4pairIKSG_SG_EEEEEE"] = (a0, a1, a2, a3) => (__ZN7openmpt10module_extC1ERKNSt3__26vectorIhNS1_9allocatorIhEEEERNS1_13basic_ostreamIcNS1_11char_traitsIcEEEERKNS1_3mapINS1_12basic_stringIcSA_NS3_IcEEEESG_NS1_4lessISG_EENS3_INS1_4pairIKSG_SG_EEEEEE = Module["__ZN7openmpt10module_extC1ERKNSt3__26vectorIhNS1_9allocatorIhEEEERNS1_13basic_ostreamIcNS1_11char_traitsIcEEEERKNS1_3mapINS1_12basic_stringIcSA_NS3_IcEEEESG_NS1_4lessISG_EENS3_INS1_4pairIKSG_SG_EEEEEE"] = wasmExports["Te"])(a0, a1, a2, a3);

var __ZN7openmpt10module_extC1ERKNSt3__26vectorIcNS1_9allocatorIcEEEERNS1_13basic_ostreamIcNS1_11char_traitsIcEEEERKNS1_3mapINS1_12basic_stringIcSA_S4_EESF_NS1_4lessISF_EENS3_INS1_4pairIKSF_SF_EEEEEE = Module["__ZN7openmpt10module_extC1ERKNSt3__26vectorIcNS1_9allocatorIcEEEERNS1_13basic_ostreamIcNS1_11char_traitsIcEEEERKNS1_3mapINS1_12basic_stringIcSA_S4_EESF_NS1_4lessISF_EENS3_INS1_4pairIKSF_SF_EEEEEE"] = (a0, a1, a2, a3) => (__ZN7openmpt10module_extC1ERKNSt3__26vectorIcNS1_9allocatorIcEEEERNS1_13basic_ostreamIcNS1_11char_traitsIcEEEERKNS1_3mapINS1_12basic_stringIcSA_S4_EESF_NS1_4lessISF_EENS3_INS1_4pairIKSF_SF_EEEEEE = Module["__ZN7openmpt10module_extC1ERKNSt3__26vectorIcNS1_9allocatorIcEEEERNS1_13basic_ostreamIcNS1_11char_traitsIcEEEERKNS1_3mapINS1_12basic_stringIcSA_S4_EESF_NS1_4lessISF_EENS3_INS1_4pairIKSF_SF_EEEEEE"] = wasmExports["Ue"])(a0, a1, a2, a3);

var __ZN7openmpt10module_extC1ERKNSt3__26vectorISt4byteNS1_9allocatorIS3_EEEERNS1_13basic_ostreamIcNS1_11char_traitsIcEEEERKNS1_3mapINS1_12basic_stringIcSB_NS4_IcEEEESH_NS1_4lessISH_EENS4_INS1_4pairIKSH_SH_EEEEEE = Module["__ZN7openmpt10module_extC1ERKNSt3__26vectorISt4byteNS1_9allocatorIS3_EEEERNS1_13basic_ostreamIcNS1_11char_traitsIcEEEERKNS1_3mapINS1_12basic_stringIcSB_NS4_IcEEEESH_NS1_4lessISH_EENS4_INS1_4pairIKSH_SH_EEEEEE"] = (a0, a1, a2, a3) => (__ZN7openmpt10module_extC1ERKNSt3__26vectorISt4byteNS1_9allocatorIS3_EEEERNS1_13basic_ostreamIcNS1_11char_traitsIcEEEERKNS1_3mapINS1_12basic_stringIcSB_NS4_IcEEEESH_NS1_4lessISH_EENS4_INS1_4pairIKSH_SH_EEEEEE = Module["__ZN7openmpt10module_extC1ERKNSt3__26vectorISt4byteNS1_9allocatorIS3_EEEERNS1_13basic_ostreamIcNS1_11char_traitsIcEEEERKNS1_3mapINS1_12basic_stringIcSB_NS4_IcEEEESH_NS1_4lessISH_EENS4_INS1_4pairIKSH_SH_EEEEEE"] = wasmExports["Ve"])(a0, a1, a2, a3);

var __ZN7openmpt10module_extC1EPKhmRNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE = Module["__ZN7openmpt10module_extC1EPKhmRNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE"] = (a0, a1, a2, a3, a4) => (__ZN7openmpt10module_extC1EPKhmRNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE = Module["__ZN7openmpt10module_extC1EPKhmRNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE"] = wasmExports["We"])(a0, a1, a2, a3, a4);

var __ZN7openmpt10module_extC1EPKcmRNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE = Module["__ZN7openmpt10module_extC1EPKcmRNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE"] = (a0, a1, a2, a3, a4) => (__ZN7openmpt10module_extC1EPKcmRNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE = Module["__ZN7openmpt10module_extC1EPKcmRNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE"] = wasmExports["Xe"])(a0, a1, a2, a3, a4);

var __ZN7openmpt10module_extC1EPKSt4bytemRNSt3__213basic_ostreamIcNS4_11char_traitsIcEEEERKNS4_3mapINS4_12basic_stringIcS7_NS4_9allocatorIcEEEESE_NS4_4lessISE_EENSC_INS4_4pairIKSE_SE_EEEEEE = Module["__ZN7openmpt10module_extC1EPKSt4bytemRNSt3__213basic_ostreamIcNS4_11char_traitsIcEEEERKNS4_3mapINS4_12basic_stringIcS7_NS4_9allocatorIcEEEESE_NS4_4lessISE_EENSC_INS4_4pairIKSE_SE_EEEEEE"] = (a0, a1, a2, a3, a4) => (__ZN7openmpt10module_extC1EPKSt4bytemRNSt3__213basic_ostreamIcNS4_11char_traitsIcEEEERKNS4_3mapINS4_12basic_stringIcS7_NS4_9allocatorIcEEEESE_NS4_4lessISE_EENSC_INS4_4pairIKSE_SE_EEEEEE = Module["__ZN7openmpt10module_extC1EPKSt4bytemRNSt3__213basic_ostreamIcNS4_11char_traitsIcEEEERKNS4_3mapINS4_12basic_stringIcS7_NS4_9allocatorIcEEEESE_NS4_4lessISE_EENSC_INS4_4pairIKSE_SE_EEEEEE"] = wasmExports["Ye"])(a0, a1, a2, a3, a4);

var __ZN7openmpt10module_extC1EPKvmRNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE = Module["__ZN7openmpt10module_extC1EPKvmRNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE"] = (a0, a1, a2, a3, a4) => (__ZN7openmpt10module_extC1EPKvmRNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE = Module["__ZN7openmpt10module_extC1EPKvmRNSt3__213basic_ostreamIcNS3_11char_traitsIcEEEERKNS3_3mapINS3_12basic_stringIcS6_NS3_9allocatorIcEEEESD_NS3_4lessISD_EENSB_INS3_4pairIKSD_SD_EEEEEE"] = wasmExports["Ze"])(a0, a1, a2, a3, a4);

var __ZN7openmpt10module_extD1Ev = Module["__ZN7openmpt10module_extD1Ev"] = a0 => (__ZN7openmpt10module_extD1Ev = Module["__ZN7openmpt10module_extD1Ev"] = wasmExports["_e"])(a0);

var __ZN7openmpt10module_extC1ERKS0_ = Module["__ZN7openmpt10module_extC1ERKS0_"] = (a0, a1) => (__ZN7openmpt10module_extC1ERKS0_ = Module["__ZN7openmpt10module_extC1ERKS0_"] = wasmExports["$e"])(a0, a1);

var __emscripten_timeout = (a0, a1) => (__emscripten_timeout = wasmExports["bf"])(a0, a1);

var _setThrew = (a0, a1) => (_setThrew = wasmExports["cf"])(a0, a1);

var __emscripten_tempret_set = a0 => (__emscripten_tempret_set = wasmExports["df"])(a0);

var __emscripten_stack_restore = a0 => (__emscripten_stack_restore = wasmExports["ef"])(a0);

var _emscripten_stack_get_current = () => (_emscripten_stack_get_current = wasmExports["ff"])();

var ___cxa_decrement_exception_refcount = a0 => (___cxa_decrement_exception_refcount = wasmExports["gf"])(a0);

var ___cxa_increment_exception_refcount = a0 => (___cxa_increment_exception_refcount = wasmExports["hf"])(a0);

var ___cxa_can_catch = (a0, a1, a2) => (___cxa_can_catch = wasmExports["jf"])(a0, a1, a2);

var ___cxa_get_exception_ptr = a0 => (___cxa_get_exception_ptr = wasmExports["kf"])(a0);

var dynCall_j = Module["dynCall_j"] = a0 => (dynCall_j = Module["dynCall_j"] = wasmExports["lf"])(a0);

var dynCall_vij = Module["dynCall_vij"] = (a0, a1, a2, a3) => (dynCall_vij = Module["dynCall_vij"] = wasmExports["mf"])(a0, a1, a2, a3);

var dynCall_viiji = Module["dynCall_viiji"] = (a0, a1, a2, a3, a4, a5) => (dynCall_viiji = Module["dynCall_viiji"] = wasmExports["nf"])(a0, a1, a2, a3, a4, a5);

var dynCall_iiji = Module["dynCall_iiji"] = (a0, a1, a2, a3, a4) => (dynCall_iiji = Module["dynCall_iiji"] = wasmExports["of"])(a0, a1, a2, a3, a4);

var dynCall_viij = Module["dynCall_viij"] = (a0, a1, a2, a3, a4) => (dynCall_viij = Module["dynCall_viij"] = wasmExports["pf"])(a0, a1, a2, a3, a4);

var dynCall_viiij = Module["dynCall_viiij"] = (a0, a1, a2, a3, a4, a5) => (dynCall_viiij = Module["dynCall_viiij"] = wasmExports["qf"])(a0, a1, a2, a3, a4, a5);

var dynCall_ijiij = Module["dynCall_ijiij"] = (a0, a1, a2, a3, a4, a5, a6) => (dynCall_ijiij = Module["dynCall_ijiij"] = wasmExports["rf"])(a0, a1, a2, a3, a4, a5, a6);

var dynCall_viji = Module["dynCall_viji"] = (a0, a1, a2, a3, a4) => (dynCall_viji = Module["dynCall_viji"] = wasmExports["sf"])(a0, a1, a2, a3, a4);

var dynCall_jiiii = Module["dynCall_jiiii"] = (a0, a1, a2, a3, a4) => (dynCall_jiiii = Module["dynCall_jiiii"] = wasmExports["tf"])(a0, a1, a2, a3, a4);

var dynCall_iij = Module["dynCall_iij"] = (a0, a1, a2, a3) => (dynCall_iij = Module["dynCall_iij"] = wasmExports["uf"])(a0, a1, a2, a3);

function invoke_iii(index, a1, a2) {
  var sp = stackSave();
  try {
    return getWasmTableEntry(index)(a1, a2);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_viii(index, a1, a2, a3) {
  var sp = stackSave();
  try {
    getWasmTableEntry(index)(a1, a2, a3);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_vii(index, a1, a2) {
  var sp = stackSave();
  try {
    getWasmTableEntry(index)(a1, a2);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_ii(index, a1) {
  var sp = stackSave();
  try {
    return getWasmTableEntry(index)(a1);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_viiiii(index, a1, a2, a3, a4, a5) {
  var sp = stackSave();
  try {
    getWasmTableEntry(index)(a1, a2, a3, a4, a5);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_iiiiiii(index, a1, a2, a3, a4, a5, a6) {
  var sp = stackSave();
  try {
    return getWasmTableEntry(index)(a1, a2, a3, a4, a5, a6);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_vi(index, a1) {
  var sp = stackSave();
  try {
    getWasmTableEntry(index)(a1);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_v(index) {
  var sp = stackSave();
  try {
    getWasmTableEntry(index)();
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_iiii(index, a1, a2, a3) {
  var sp = stackSave();
  try {
    return getWasmTableEntry(index)(a1, a2, a3);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_iiiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8) {
  var sp = stackSave();
  try {
    return getWasmTableEntry(index)(a1, a2, a3, a4, a5, a6, a7, a8);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_viiii(index, a1, a2, a3, a4) {
  var sp = stackSave();
  try {
    getWasmTableEntry(index)(a1, a2, a3, a4);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_iiiii(index, a1, a2, a3, a4) {
  var sp = stackSave();
  try {
    return getWasmTableEntry(index)(a1, a2, a3, a4);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_i(index) {
  var sp = stackSave();
  try {
    return getWasmTableEntry(index)();
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_viiiiii(index, a1, a2, a3, a4, a5, a6) {
  var sp = stackSave();
  try {
    getWasmTableEntry(index)(a1, a2, a3, a4, a5, a6);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_viiiiiii(index, a1, a2, a3, a4, a5, a6, a7) {
  var sp = stackSave();
  try {
    getWasmTableEntry(index)(a1, a2, a3, a4, a5, a6, a7);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_viiiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8, a9) {
  var sp = stackSave();
  try {
    getWasmTableEntry(index)(a1, a2, a3, a4, a5, a6, a7, a8, a9);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_di(index, a1) {
  var sp = stackSave();
  try {
    return getWasmTableEntry(index)(a1);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_iiifii(index, a1, a2, a3, a4, a5) {
  var sp = stackSave();
  try {
    return getWasmTableEntry(index)(a1, a2, a3, a4, a5);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_fi(index, a1) {
  var sp = stackSave();
  try {
    return getWasmTableEntry(index)(a1);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_iiiiii(index, a1, a2, a3, a4, a5) {
  var sp = stackSave();
  try {
    return getWasmTableEntry(index)(a1, a2, a3, a4, a5);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_viiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8) {
  var sp = stackSave();
  try {
    getWasmTableEntry(index)(a1, a2, a3, a4, a5, a6, a7, a8);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_viif(index, a1, a2, a3) {
  var sp = stackSave();
  try {
    getWasmTableEntry(index)(a1, a2, a3);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_vid(index, a1, a2) {
  var sp = stackSave();
  try {
    getWasmTableEntry(index)(a1, a2);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_iiifiii(index, a1, a2, a3, a4, a5, a6) {
  var sp = stackSave();
  try {
    return getWasmTableEntry(index)(a1, a2, a3, a4, a5, a6);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_fii(index, a1, a2) {
  var sp = stackSave();
  try {
    return getWasmTableEntry(index)(a1, a2);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_didi(index, a1, a2, a3) {
  var sp = stackSave();
  try {
    return getWasmTableEntry(index)(a1, a2, a3);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_diiii(index, a1, a2, a3, a4) {
  var sp = stackSave();
  try {
    return getWasmTableEntry(index)(a1, a2, a3, a4);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_viiidi(index, a1, a2, a3, a4, a5) {
  var sp = stackSave();
  try {
    getWasmTableEntry(index)(a1, a2, a3, a4, a5);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_iifi(index, a1, a2, a3) {
  var sp = stackSave();
  try {
    return getWasmTableEntry(index)(a1, a2, a3);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_iiiiiiii(index, a1, a2, a3, a4, a5, a6, a7) {
  var sp = stackSave();
  try {
    return getWasmTableEntry(index)(a1, a2, a3, a4, a5, a6, a7);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_diii(index, a1, a2, a3) {
  var sp = stackSave();
  try {
    return getWasmTableEntry(index)(a1, a2, a3);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_did(index, a1, a2) {
  var sp = stackSave();
  try {
    return getWasmTableEntry(index)(a1, a2);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_viid(index, a1, a2, a3) {
  var sp = stackSave();
  try {
    getWasmTableEntry(index)(a1, a2, a3);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_dii(index, a1, a2) {
  var sp = stackSave();
  try {
    return getWasmTableEntry(index)(a1, a2);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_iiiidd(index, a1, a2, a3, a4, a5) {
  var sp = stackSave();
  try {
    return getWasmTableEntry(index)(a1, a2, a3, a4, a5);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_iid(index, a1, a2) {
  var sp = stackSave();
  try {
    return getWasmTableEntry(index)(a1, a2);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_iiiiid(index, a1, a2, a3, a4, a5) {
  var sp = stackSave();
  try {
    return getWasmTableEntry(index)(a1, a2, a3, a4, a5);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_iiiiiiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11) {
  var sp = stackSave();
  try {
    return getWasmTableEntry(index)(a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_viiiiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10) {
  var sp = stackSave();
  try {
    getWasmTableEntry(index)(a1, a2, a3, a4, a5, a6, a7, a8, a9, a10);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_viiiiiiiiiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15) {
  var sp = stackSave();
  try {
    getWasmTableEntry(index)(a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_vij(index, a1, a2, a3) {
  var sp = stackSave();
  try {
    dynCall_vij(index, a1, a2, a3);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_iiji(index, a1, a2, a3, a4) {
  var sp = stackSave();
  try {
    return dynCall_iiji(index, a1, a2, a3, a4);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_viiij(index, a1, a2, a3, a4, a5) {
  var sp = stackSave();
  try {
    dynCall_viiij(index, a1, a2, a3, a4, a5);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_viij(index, a1, a2, a3, a4) {
  var sp = stackSave();
  try {
    dynCall_viij(index, a1, a2, a3, a4);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_jiiii(index, a1, a2, a3, a4) {
  var sp = stackSave();
  try {
    return dynCall_jiiii(index, a1, a2, a3, a4);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_viiji(index, a1, a2, a3, a4, a5) {
  var sp = stackSave();
  try {
    dynCall_viiji(index, a1, a2, a3, a4, a5);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_ijiij(index, a1, a2, a3, a4, a5, a6) {
  var sp = stackSave();
  try {
    return dynCall_ijiij(index, a1, a2, a3, a4, a5, a6);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_viji(index, a1, a2, a3, a4) {
  var sp = stackSave();
  try {
    dynCall_viji(index, a1, a2, a3, a4);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_j(index) {
  var sp = stackSave();
  try {
    return dynCall_j(index);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

function invoke_iij(index, a1, a2, a3) {
  var sp = stackSave();
  try {
    return dynCall_iij(index, a1, a2, a3);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}

// include: postamble.js
// === Auto-generated postamble setup entry stuff ===
var calledRun;

dependenciesFulfilled = function runCaller() {
  // If run has never been called, and we should call run (INVOKE_RUN is true, and Module.noInitialRun is not false)
  if (!calledRun) run();
  if (!calledRun) dependenciesFulfilled = runCaller;
};

// try this again later, after new deps are fulfilled
function run() {
  if (runDependencies > 0) {
    return;
  }
  preRun();
  // a preRun added a dependency, run will be called later
  if (runDependencies > 0) {
    return;
  }
  function doRun() {
    // run may have just been called through dependencies being fulfilled just in this very frame,
    // or while the async setStatus time below was happening
    if (calledRun) return;
    calledRun = true;
    Module["calledRun"] = true;
    if (ABORT) return;
    initRuntime();
    Module["onRuntimeInitialized"]?.();
    postRun();
  }
  if (Module["setStatus"]) {
    Module["setStatus"]("Running...");
    setTimeout(() => {
      setTimeout(() => Module["setStatus"](""), 1);
      doRun();
    }, 1);
  } else {
    doRun();
  }
}

if (Module["preInit"]) {
  if (typeof Module["preInit"] == "function") Module["preInit"] = [ Module["preInit"] ];
  while (Module["preInit"].length > 0) {
    Module["preInit"].pop()();
  }
}

run();
