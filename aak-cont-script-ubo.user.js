// ==UserScript==
// @name AAK-Cont Userscript For uBlock Origin
// @description Helps you keep your Ad-Blocker active, when you visit a website and it asks you to disable.
// @author AAK-Cont contributors
// @version 2
// @license GNU GPL v3
// @icon https://gitlab.com/xuhaiyang1234/AAK-Cont/raw/master/images/icon.png
// @homepage https://github.com/Cryozyme/aak-cont
// @supportURL https://gitlab.com/xuhaiyang1234/AAK-Cont/issues
// @updateURL https://github.com/Cryozyme/aak-cont/aak-cont-script-ubo.user.js
// @downloadURL https://github.com/Cryozyme/aak-cont/aak-cont-script-ubo.user.js
// @match http://*/*
// @match https://*/*
// @grant unsafeWindow
// @grant GM_addStyle
// @grant GM_getValue
// @grant GM_setValue
// @grant GM_xmlhttpRequest
// @grant GM_registerMenuCommand
// @grant GM_deleteValue
// @grant GM_listValues
// @grant GM_getResourceText
// @grant GM_getResourceURL
// @grant GM_log
// @grant GM_openInTab
// @grant GM_setClipboard
// @grant GM_info
// @grant GM_getMetadata
// @run-at document-start
// @connect foxvalleyfoodie.com
// @connect tvnplayer.pl
// @connect xmc.pl
// @connect wp.tv
// @connect sagkjeder.no
// @connect mtgx.tv
// @connect canal-plus.com
// @connect *
// ==/UserScript==
/*=============
| AAK/uBP API |
==============*/

var a = (function(win) {
    "use strict";
    
    var aak = {
        
        /**
         * General information about the script itself.
         * @property about
         * @type Object
         */
        about: {
            homeURL: "https://github.com/Cryozyme/aak-cont"
        },
         
        /**
         * Adds a script in the scope of the unsafeWindow. Useful to get things running on all script managers.
         * @method addScript
         * @param source {String|Function} The Javascript to inject on the page.
         * @param [injectMode] {Number} undefined = autodetect, 1 for force eval, 2 for force drop element
         * @param [body]{Boolean} true: Inject into body, false: Inject into head.
         */
        addScript(source, injectMode, body) {
            var txt = (typeof source === "function") ? this.intoString(source) : source.toString();
            var forceEval = (txt) => {
                let evalFnName = this.exportFunction(() => {
                    try {
                        this.eval.call(this.win, txt);
                    } catch(e) {
                        if (e && e.toString().indexOf("CSP") > -1) {
                            this.out.warn("AAK addScript failed eval due to CSP. Attempting drop.");
                            forceDrop(txt);
                        } else {
                            this.out.warn("AAK addScript failed.");
                            this.out.warn(e);
                        }
                    }
                });
                this.win[evalFnName]();
            };
            var forceDrop = (txt) => {
                if (this.doc) {
                    var script = this.doc.createElement("script");
                    script.type = "text/javascript";
                    script.innerHTML = txt;
                    if (body && this.doc.body) {
                        this.doc.body.appendChild(script);
                    } else if (this.doc.head) {
                        this.doc.head.appendChild(script);
                    } else {
                        this.doc.documentElement.appendChild(script);
                    }
                    script.remove();
                } else {
                    forceEval(txt);
                }
            };
            if (!injectMode) {
                if (this.win && this.getScriptManager() === "Tampermonkey") {
                    forceEval(txt);
                } else {
                    forceDrop(txt);
                }
            } else if (injectMode === 1) {
                forceEval(txt);
            } else {
                forceDrop(txt);
            }
        },
        
        /**
         * Runs a function on DOM & window load.
         * @method always
         * @param func {Function} The function to run.
         * @param capture {Boolean} Dispatches event to the listener (func) before the event target.
         */
        always(func, capture) {
            func();
            this.on("DOMContentLoaded", func, capture);
            this.on("load", func, capture);
        },
         
        /**
         * Filter assignment of innerHTML, innerText, or textContent. Should be called on document-start.
         * @method antiCollapse
         * @param name {string} - The name of the property to filter, can be "innerHTML", "innerText", or "textContent".
         * @param filter {Function}  - The filter function. Use closure and self execution if you need to initialize.
         ** @param elem {HTMLElement} - The target element.
         ** @param val {string} - The value that is set.
         * @return {boolean} True to block the assignment, false to allow.
         */
        antiCollapse(name, filter) {
            let parent = "Element"; //innerHTML is on Element
            switch (name) {
                case "innerText":
                    parent = "HTMLElement";
                    break;
                case "textContent":
                    parent = "Node";
                    break;
                default:
                    break;
            }
            this.inject(`(() => {
                "use strict";
                const handler = ${filter};
                const log = window.console.log.bind(window.console);
                const warn = window.console.warn.bind(window.console);
                const error = window.console.error.bind(window.console);
                const String = window.String.bind(window);
                try {
                    //Get setter and getter
                    const descriptor = window.Object.getOwnPropertyDescriptor(window.${parent}.prototype, "${name}");
                    const _set = descriptor.set;
                    const _get = descriptor.get;
                    window.Object.defineProperty(window.${parent}.prototype, "${name}", {
                        configurable: false,
                        set(val) {
                            if (${this.config.debugMode}) {
                                warn("${name} of an element is being assigned to:");
                                log(val);
                            }
                            if (handler(this, String(val))) {
                                error("Uncaught Error: uBlock Origin detectors are not allowed on this device!");
                            } else {
                                log("Tests passed.");
                                _set.call(this, val);
                            }
                        },
                        get() {
                            return _get.call(this);
                        },
                    });
                    window.console.log("Element collapse defuser activated on ${name}");
                } catch (err) {
                    //Failed to activate
                    error("uBlock Protector failed to activate element collapse defuser on ${name}!");
                }
            })();`, true);
        },
        
        /**
         * String content matching across an array of strings. Returns true if any string in the args array is matched.
         * @method applyMatch
         * @param args {Array} The strings to match against.
         * @param method {Number} The method to match with. Defined in the enum (aak.matchMethod).
         * @param filter {String|RegExp} The matching criteria.
         * @return {Boolen} True if any string match, false otherwise.
         */
        applyMatch(args, method, filter) {
            switch (method) {
                case this.matchMethod.string:
                    for (let i=0; i<args.length; i++) {
                        if (String(args[i]).includes(filter)) {
                            return true;
                        }
                    }
                    break;
                case this.matchMethod.stringExact:
                    for (let i=0; i<args.length; i++) {
                        if (filter === String(args[i])) {
                            return true;
                        }
                    }
                    break;
                case this.matchMethod.RegExp:
                    for (let i=0; i<args.length; i++) {
                        if (filter.test(String(args[i]))) {
                            return true;
                        }
                    }
                    break;
                case this.matchMethod.callback:
                    return filter(args);
                default:
                    return true;
            }
            return false;
        },
        
        /**
         * Adds an HTML element to the page for scripts checking an element's existence.
         * @method bait
         * @param type {String} The element tag name.
         * @param identifier {String} CSS selector for adding an ID or class to the element.
         * @param hidden {Boolean} Whether or not to hide the bait element.
         */
        bait(type, identifier, hidden) {
            let elem = this.doc.createElement(type);
            switch (identifier.charAt(0)) {
                case '#':
                    elem.id = identifier.substring(1);
                    break;
                case '.':
                    elem.className = identifier.substring(1);
                    break;
            }
            if (hidden) {
                elem.style.display = "none";
            }
            elem.innerHTML = "<br>";
            this.doc.documentElement.prepend(elem);
        },

        /**
         * Set up script execution observer.
         * Can only interfere execution of scripts hard coded into the main document.
         * TODO - Need to verify this method works in all browsers.
         * @function
         * @param handler {Function} - The event handler.
         ** @param script {HTMLScriptElement} - The script that is about to be executed, it may not have its final textContent.
         ** @param parent {HTMLElement} - The parent node of this script.
         ** @param e {MutationObserver} - The observer object, call disconnect on it to stop observing.
         */
        beforeScript(handler) {
            this.onInsert((node, target, observer) => {
                if (node.tagName === "SCRIPT") {
                    handler(node, target, observer);
                }
            });
        },
        
        /**
         * Configuration for this script.
         * @method config
         * @type Object
         */
        config() {
            this.config.debugMode = GM_getValue("config_debugMode", this.config.debugMode);
            this.config.allowExperimental = GM_getValue("config_allowExperimental", this.config.allowExperimental);
            this.config.aggressiveAdflySkipper = GM_getValue("config_aggressiveAdflySkiper", this.config.aggressiveAdflySkipper);
            
            // Home/Settings page.
            if (this.win.location.href.startsWith(this.about.homeURL)) {
                this.ready(() => {
                    
                    // Markup setup
                    this.$('p > a[href="#userscript"]').html("Userscript is installed!");
                    this.$('#menu li > a[href="#userscript"]').parent().hide();
                    this.$('h1 > a[name="userscript"]').parent().hide().next().hide();
                    this.$('#aak-settings-notice').hide();
                    this.$('#aak-settings-box').show();
                    this.$('#aak-settings-config').html(`
                        <div> <label> <input type="checkbox" name="aggressiveAdflySkipper"> Attempt to aggressively bypass AdFly. </label> </div>
                    `);
                    this.$('#aak-settings-general').html(`
                        <div> <label> <input type="checkbox" name="allowExperimental"> Enable experimental features. </label> </div>
                    `);
                    this.$('#aak-settings-debug').html(`
                        <div> <label> <input type="checkbox" name="debugMode"> I am a developer or advanced user (enable debug mode and experimental fixes). </label> </div>
                    `);
                    
                    // Pre-fill with default values.
                    const settingNames = ["aggressiveAdflySkipper", "allowExperimental", "allowGeneric", "debugMode"];
                    for (let i=0; i<settingNames.length; i++) {
                        let settingName = settingNames[i];
                        let input = this.$(`#aak-settings-box input[name="${settingName}"]`);
                        if (input.prop("type") == "checkbox") {
                            input.prop("checked", this.config[settingName]);
                        }
                    }
                    
                    // Save button
                    var saveClickHandler = () => {
                        for (let i=0; i<settingNames.length; i++) {
                            let settingName = settingNames[i];
                            let input = this.$(`#aak-settings-box input[name="${settingName}"]`);
                            if (input.prop("type") == "checkbox") {
                                this.config.update("config_"+settingName, input.prop("checked"));
                            }
                        }
                        this.$(`
                            <div id="alert" style="display:block">
                                <h2 style="margin-top:40px;">Settings updated!</h2><br>
                                <button class="button hvr-bounce-to-bottom" onclick="document.querySelector('#alert').remove()">OK</button>
                            </div>
                        `).appendTo(this.doc.body);
                    };
                    if (typeof exportFunction === "function") {
                        let saveClickHandlerName = this.uid();
                        exportFunction(saveClickHandler, this.win, { defineAs: saveClickHandlerName });
                        this.addScript(`
                            document.querySelector("#aak-settings-save").onclick = window["${saveClickHandlerName}"];
                        `, this.scriptInjectMode.eval);
                    } else {
                        this.$('#aak-settings-save').on("click", saveClickHandler);
                    }
                    
                });
            }
            
        },
        
        /**
         * Sets or gets a cookie, depending on whether the value is provided or not.
         * @method cookie
         * @param key {String} The cookie name.
         * @param val {String} The cookie value. Leave out to retrieve the current value.
         * @param time {Number} Number of milliseconds in which to expire the cookie.
         * @param path {String} The cookie path.
         * @return {String} The value of the cookie, if "val" parameter is omitted.
         */
        cookie(key, val, time, path) {
            if (typeof val === "undefined") {
                const value = "; " + this.doc.cookie;
                let parts = value.split("; " + key + "=");
                if (parts.length == 2) {
                    return parts.pop().split(";").shift();
                } else {
                    return null;
                }
            } else {
                let expire = new this.win.Date();
                expire.setTime((new this.win.Date()).getTime() + (time || 31536000000));
                this.setProp("document.cookie", 
                    key + "=" + this.win.encodeURIComponent(val) + ";expires=" + expire.toGMTString() + ";path=" + (path || "/")
                );
            }
        },
        
        /**
         * Removes an inline script on the page, using the sample string.
         * @method crashScript
         * @param sample {String} Sample function string.
         */
        crashScript(sample) {
            this.patchHTML((html) => {
                return html.replace(sample, "])} \"'` ])} \n\r \r\n */ ])}");
            });
        },
        
        /**
         * Adds CSS styles to the page.
         * @method css
         * @param str {String} The CSS string to add.
         */
        css(str) {
            let temp = str.split(";");
            for (let i=0; i<temp.length-1; i++) {
                if (!temp[i].endsWith("!important")) {
                    temp[i] += " !important";
                }
            }
            GM_addStyle(temp.join(";"));
        },
        
        /**
         * Defines a property on the unsafe window.
         * @method defineProperty
         * @param name {String} The property name. Can also be a dot separated syntax to traverse into embedded objects from the unsafe window.
         * @param definition {Object} The property definition.
         * @return {Boolean} true if property defined successfully, false otherwise.
         */
        defineProperty(name, definition) {
            try {
                
                // Code that assumes we can directly set properties on the unsafe window.
                let property = this.win;
                let parent;
                let stack = name.split(".");
                let current;
                while (current = stack.shift()) {
                    parent = property;
                    property = parent[current];
                    if (!stack.length) {
                        this.win.Object.defineProperty(parent, current, definition);
                    }
                }
                
            }
            catch(err) {
                
                if (typeof exportFunction === "function") {
                    
                    // If the first solution didn't work, we're probably in greasemonkey. A script tag needs to be injected on the page.
                    let stack = name.split(".");
                    let last = stack.pop();
                    stack.unshift("window");
                    let path = stack.join(".");
                    let templateDefinition = [];
                    if (typeof definition.configurable !== "undefined") {
                        templateDefinition.push(`configurable: ${definition.configurable}`);
                    }
                    if (typeof definition.enumerable !== "undefined") {
                        templateDefinition.push(`enumerable: ${definition.enumerable}`);
                    }
                    if (typeof definition.writable !== "undefined") {
                        templateDefinition.push(`writable: ${definition.writable}`);
                    }
                    if (typeof definition.value !== "undefined") {
                        var valueType = Object.prototype.toString.call(definition.value);
                        if (valueType === "[object String]") {
                            definition.value = '"' + definition.value.replace(/"/g, "\\\""); + '"';
                        } else if (valueType === "[object Array]" || valueType === "[object Object]") {
                            definition.value = JSON.stringify(definition.value);
                        }
                        templateDefinition.push(`value: ${definition.value}`);
                    }
                    if (typeof definition.set !== "undefined") {
                        let setter = definition.set;
                        let setterName = this.uid();
                        exportFunction(setter, this.win, { defineAs: setterName });
                        templateDefinition.push(`set: function(val) {
                            window["${setterName}"](val);
                        }`);
                    }
                    if (typeof definition.get !== "undefined") {
                        let getter = definition.get;
                        let getterName = this.uid();
                        exportFunction(getter, this.win, { defineAs: getterName });
                        templateDefinition.push(`get: function() {
                            return window["${getterName}"]();
                        }`);
                    }
                    let successStatusPropName = this.uid();
                    this.setProp(successStatusPropName, true);
                    templateDefinition = templateDefinition.join(',');
                    this.addScript(`
                        try {
                            Object.defineProperty(${path},"${last}", {
                                ${templateDefinition}
                            });
                        } catch(err) {
                            window.${successStatusPropName} = false;
                        }
                    `, this.scriptInjectMode.eval);
                    
                    return this.win[successStatusPropName];
                    
                }
                else {
                    return false;
                }
                
            }
            return true;
        },
        
        /**
         * The document of the unsafe window.
         * @property doc
         */
        doc: win.document,
        
        /**
         * The domain name of the unsafe window.
         * @property dom
         */
        dom: win.document.domain,
        
        /**
         * Compares the current domain to a list of domains, returns true if in that list.
         * @method domCmp
         * @param domList {Array} The list of domain names to check against.
         * @param noErr {Boolean} Don't display errors in debug mode.
         * @return {Boolean} true if the current domain is in the domain list.
         */
        domCmp(domList, noErr) {
            for (let i=0; i<domList.length; i++) {
                if (this.dom === domList[i] || this.dom.endsWith("." + domList[i])) {
                    if (this.config.debugMode && !noErr) {
                        this.err();
                    }
                    return true;
                }
            }
            return false;
        },
        
        /**
         * Checks if the current domain string is included as a sub domain or partial domain in the list.
         * @method domInc
         * @param domList {Array} The list of domain names to check against.
         * @param noErr {Boolean} Don't display errors in debug mode.
         * @return {Boolean} True if the current domain is included in the domain list.
         */
        domInc(domList, noErr) {            
            for (let i = 0; i < domList.length; i++) {
                let index = this.dom.lastIndexOf(domList[i] + ".");
                //Make sure the character before, if exists, is "."
                if (index > 0 && this.dom.charAt(index - 1) !== '.') {
                    continue;
                }
                if (index > -1) {
                    if (!this.dom.substring(index + domList[i].length + 1).includes(".")) {
                        !noErr && this.err();
                        return true;
                    }
                }
            }
            return false;       
        },
        
        /**
         * Displays a console error.
         * @method err
         * @param name {String} Descriptive type of error.
         */
        err(name) {
            if (name) {
                name = name + " ";
            } else {
                name = ""
            }
            this.out.error(`Uncaught AdBlock Error: ${name}AdBlocker detectors are not allowed on this device! `);
        },
         
        /**
         * The original eval function of the unsafe window.
         * @property eval
         */
        eval: win.eval,
         
        /**
         * Exports a function to the unsafe window with a random name. Returns the name of that function.
         * @method export
         * @param fn {Function} The function to export.
         * @return {String} The name of the exported function on the unsafe window.
         */
        exportFunction(fn) {
            let name = this.uid();
            if (typeof exportFunction === "function") {
                if (typeof fn === "function") {
                    exportFunction(fn, this.win, { defineAs: name });
                } else {
                    this.setProp(name, fn);
                }
            } else {
                this.win[name] = fn;
            }
            return name;
        },
        
        /**
         * Replaces a global function with a version that can stop or modify its execution based on the arguments passed.
         * @method filter
         * @param func {String} The name of the function (or dot separate path to the function) to be replaced. Starts at the global context.
         * @param method {Number} The method to match function arguments with. Defined in the enum (aak.matchMethod).
         * @param filter {String|RegExp} This string or regex criteria that determines a match. If this matches, the original function is not executed.
         * @param onMatch {Function} Callback when the "filter" argument matches. The return value of this function is used instead of the original function's return value.
         * @param onAfter {Function} Callback that fires every time original function is called. The first argument is whether or not the flter matched. The second argument is the args passed into the original function.
         * @return {Boolean} True if errors did not occur.
         */
        filter(func, method, filter, onMatch, onAfter) {

            var applyMatchFnName = this.exportFunction((args, method, filter) => {
                return this.applyMatch.call(this, args, method, filter);
            });
            var filterFnName = (filter) ? this.exportFunction(filter) : "undefined";
            var errFnName = this.exportFunction(this.err);
            var onMatchFnName = (onMatch) ? this.exportFunction(onMatch) : "undefined";
            var onAfterFnName = (onAfter) ? this.exportFunction(onAfter) : "undefined";
            let protectFuncPointersPushFnName = this.exportFunction(this.protectFunc.pointers.push);
            let protectFuncMasksPushFnName = this.exportFunction(this.protectFunc.masks.push);

            var scriptReturnVal;
            var setReturnValueFnName = this.exportFunction((val) => {
                scriptReturnVal = val;
            });

            this.addScript(`
                (function() {
                    let func = "${func}";
                    let applyMatch = window.${applyMatchFnName};
                    let method = ${method};
                    let filter = window.${filterFnName};
                    let err = window.${errFnName};
                    let onMatch = window.${onMatchFnName};
                    let onAfter = window.${onAfterFnName};
                    let setReturnVal = window.${setReturnValueFnName};
                    let protectFuncPointersPush = window.${protectFuncPointersPushFnName};
                    let protectFuncMasksPush = window.${protectFuncMasksPushFnName};
                    delete window.${applyMatchFnName};
                    delete window.${filterFnName};
                    delete window.${errFnName};
                    delete window.${onMatchFnName};
                    delete window.${onAfterFnName};
                    delete window.${setReturnValueFnName};
                    delete window.${protectFuncPointersPushFnName};
                    delete window.${protectFuncMasksPushFnName};

                    let original = window;
                    let parent;

                    const newFunc = (...args) => {
                        if (${this.config.debugMode}) {
                            console.warn("${func} was called with these arguments: ");
                            for (let i=0; i<args.length; i++) {
                                console.warn(String(args[i]));
                            }
                        }
                        if (!method || applyMatch(args, method, filter)) {
                            if (${this.config.debugMode}) {
                                err();
                            }
                            let ret = undefined;
                            if (onMatch) {
                                ret = onMatch(args);
                            }
                            onAfter && onAfter(true, args);
                            return ret;
                        }
                        if (${this.config.debugMode}) {
                            console.info("Tests passed.");
                        }
                        onAfter && onAfter(true, args);
                        return original.apply(parent, args);
                    };
                    try {
                        let stack = func.split(".");
                        let current;
                        while (current = stack.shift()) {
                            parent = original;
                            original = parent[current];
                            if (!stack.length) {
                                parent[current] = newFunc;
                            }
                        }
                        if (${this.protectFunc.enabled}) {
                            protectFuncPointersPush(newFunc);
                            protectFuncMasksPush(String(original));
                        }
                        if (${this.config.debugMode}) {
                            console.warn("Filter activated on ${func}");
                        }
                    } catch(err) {
                        if (${this.config.debugMode}) {
                            console.error("AAK failed to activate filter on ${func}!");
                        }
                        return setReturnVal(false);
                    }
                    return setReturnVal(true);
                })();
            `, this.scriptInjectMode.eval);

            return scriptReturnVal;
        },
        
        /**
         * Generic anti-adblocking solutions that run on every page.
         * @method generic
         */
        generic() {
            //@pragma-keepline Based on generic solutions of Anti-Adblock Killer
            //@pragma-keepline License: https://github.com/reek/anti-adblock-killer/blob/master/LICENSE
            if (this.config.allowGeneric && !this.config.domExcluded) {
                const data = {};
                this.generic.FuckAdBlock("FuckAdBlock", "fuckAdBlock");
                this.generic.FuckAdBlock("BlockAdBlock", "blockAdBlock");
                this.readOnly("canRunAds", true);
                this.readOnly("canShowAds", true);
                this.readOnly("isAdBlockActive", false);
                let playwireZeus;
                this.defineProperty("Zeus", {
                    configurable: false,
                    set: function (val) {
                        playwireZeus = val;
                    },
                    get: function () {
                        this.config.debugMode && this.err("Playwire");
                        try {
                            playwireZeus.AdBlockTester = {
                                check: function (a) { a(); }
                            };
                        } catch (err) { }
                        return playwireZeus;
                    }
                });
                this.ready(() => {
                    if (this.win.XenForo && typeof this.win.XenForo.rellect === "object") {
                        this.config.debugMode && this.err("XenForo");
                        this.setProp("XenForo.rellect", {
                            AdBlockDetector: {
                                start: function () { }
                            }
                        });
                    }
                    if (typeof this.win.closeAdbuddy === "function") {
                        this.config.debugMode && this.err("Adbuddy");
                        this.win.closeAdbuddy();
                    }
                    if (this.$("div.adb_overlay > div.adb_modal_img").length > 0) {
                        this.config.debugMode && this.err("AdBlock Alerter");
                        this.$("div.adb_overlay").remove();
                        this.css("html,body {height:auto; overflow: auto;}");
                    }
                    if (this.$("#blockdiv").html() === "disable ad blocking or use another browser without any adblocker when you visit") {
                        this.config.debugMode && this.out.err("Uncaught AdBlock Error: Generic block screens are not allowed on this device! ");
                        this.$("#blockdiv").remove();
                    }
                    const styles = document.querySelectorAll("style");
                    for (let i = 0; i < styles.length; i++) {
                        const style = styles[i];
                        const cssRules = style.sheet.cssRules;
                        for (var j = 0; j < cssRules.length; j++) {
                            const cssRule = cssRules[j];
                            const cssText = cssRule.cssText;
                            const pattern = /^#([a-z0-9]{4,10}) ~ \* \{ display: none; \}/;
                            if (pattern.test(cssText)) {
                                const id = pattern.exec(cssText)[1];
                                if (this.$("script:contains(w.addEventListener('load'," + id + ",false))")) {
                                    this.config.debugMode && this.err("Antiblock.org v2");
                                    data.abo2 = id;
                                    break;
                                }
                            }
                        }
                    }
                    for (let prop in this.win) {
                        try {
                            if (!prop.startsWith("webkit") && /^[a-z0-9]{4,12}$/i.test(prop) && prop !== "document" && (this.win[prop] instanceof this.win.HTMLDocument) === false && this.win.hasOwnProperty(prop) && typeof this.win[prop] === "object") {
                                const method = this.win[prop];
                                if (method.deferExecution &&
                                    method.displayMessage &&
                                    method.getElementBy &&
                                    method.getStyle &&
                                    method.insert &&
                                    method.nextFunction) {
                                    if (method.toggle) {
                                        this.config.debugMode && this.err("BetterStopAdblock");
                                        data.bsa = prop;
                                    } else {
                                        this.config.debugMode && this.err("Antiblock.org v3");
                                        data.abo3 = prop;
                                    }
                                    this.setProp(prop, null);
                                }
                                if (this.win.Object.keys(method).length === 3) {
	                                let isBAB = true;
	                                const keyLen = this.win.Object.keys(method).join("").length;
	                                if (keyLen !== 30 && keyLen !== 23) {
	                                    isBAB = false;
	                                } else {
	                                    for (let prop in method) {
	                                        if (prop.length !== 10 && prop !== "bab") {
	                                            isBAB = false;
	                                            break;
	                                        }
	                                    }
	                                }
	                                if (isBAB) {
	                                    this.err("BlockAdBlock");
	                                    this.setProp(prop, null);
	                                }
	                            }
                            }
                        } catch (err) { }
                    }
                });
                const onInsertHandler = (insertedNode) => {
                    //No-Adblock
                    if (insertedNode.nodeName === "DIV" &&
                        insertedNode.id &&
                        insertedNode.id.length === 4 &&
                        /^[a-z0-9]{4}$/.test(insertedNode.id) &&
                        insertedNode.firstChild &&
                        insertedNode.firstChild.id &&
                        insertedNode.firstChild.id === insertedNode.id &&
                        insertedNode.innerHTML.includes("no-adblock.com")) {
                        this.config.debugMode && this.err("No-Adblock");
                        insertedNode.remove();
                    }
                    //StopAdblock
                    if (insertedNode.nodeName === "DIV" &&
                        insertedNode.id &&
                        insertedNode.id.length === 7 &&
                        /^a[a-z0-9]{6}$/.test(insertedNode.id) &&
                        insertedNode.parentNode &&
                        insertedNode.parentNode.id &&
                        insertedNode.parentNode.id === insertedNode.id + "2" &&
                        insertedNode.innerHTML.includes("stopadblock.org")) {
                        this.config.debugMode && this.err("StopAdblock");
                        insertedNode.remove();
                    }
                    //AntiAdblock (Packer)
                    const reIframeId = /^(zd|wd)$/;
                    const reImgId = /^(xd|gd)$/;
                    const reImgSrc = /\/ads\/banner.jpg/;
                    const reIframeSrc = /(\/adhandler\/|\/adimages\/|ad.html)/;
                    if (insertedNode.id &&
                        reImgId.test(insertedNode.id) &&
                        insertedNode.nodeName === "IMG" &&
                        reImgSrc.test(insertedNode.src) ||
                        insertedNode.id &&
                        reIframeId.test(insertedNode.id) &&
                        insertedNode.nodeName === "IFRAME" &&
                        reIframeSrc.test(insertedNode.src)) {
                        this.config.debugMode && this.err("AntiAdblock");
                        insertedNode.remove();
                    }
                    //Adunblock
                    const reId = /^[a-z]{8}$/;
                    const reClass = /^[a-z]{8} [a-z]{8}/;
                    const reBg = /^[a-z]{8}-bg$/;
                    if (typeof this.win.vtfab !== "undefined" &&
                        typeof this.win.adblock_antib !== "undefined" &&
                        insertedNode.parentNode &&
                        insertedNode.parentNode.nodeName === "BODY" &&
                        insertedNode.id &&
                        reId.test(insertedNode.id) &&
                        insertedNode.nodeName === "DIV" &&
                        insertedNode.nextSibling &&
                        insertedNode.nextSibling.className &&
                        insertedNode.nextSibling.nodeName === "DIV") {
                        if (insertedNode.className &&
                            reClass.test(insertedNode.className) &&
                            reBg.test(insertedNode.nextSibling.className) &&
                            insertedNode.nextSibling.style &&
                            insertedNode.nextSibling.style.display !== "none") {
                            this.config.debugMode && this.err("Adunblock Premium");
                            insertedNode.nextSibling.remove();
                            insertedNode.remove();
                        } else if (insertedNode.nextSibling.id &&
                            reId.test(insertedNode.nextSibling.id) &&
                            insertedNode.innerHTML.includes("Il semblerait que vous utilisiez un bloqueur de publicité !")) {
                            this.config.debugMode && this.err("Adunblock Free");
                            insertedNode.remove();
                        }
                    }
                    //Antiblock
                    const reMsgId = /^[a-z0-9]{4,10}$/i;
                    const reTag1 = /^(div|span|b|i|font|strong|center)$/i;
                    const reTag2 = /^(a|b|i|s|u|q|p|strong|center)$/i;
                    const reWords1 = /ad blocker|ad block|ad-block|adblocker|ad-blocker|adblock|bloqueur|bloqueador|Werbeblocker|adblockert|&#1570;&#1583;&#1576;&#1604;&#1608;&#1603; &#1576;&#1604;&#1587;|блокировщиком/i;
                    const reWords2 = /kapat|disable|désactivez|désactiver|desactivez|desactiver|desative|desactivar|desactive|desactiva|deaktiviere|disabilitare|&#945;&#960;&#949;&#957;&#949;&#961;&#947;&#959;&#960;&#959;&#943;&#951;&#963;&#951;|&#1079;&#1072;&#1087;&#1088;&#1077;&#1097;&#1072;&#1090;&#1100;|állítsd le|publicités|рекламе|verhindert|advert|kapatınız/i;
                    if (insertedNode.parentNode &&
                        insertedNode.id &&
                        insertedNode.style &&
                        insertedNode.childNodes.length &&
                        insertedNode.firstChild &&
                        !insertedNode.firstChild.id &&
                        !insertedNode.firstChild.className &&
                        reMsgId.test(insertedNode.id) &&
                        reTag1.test(insertedNode.nodeName) &&
                        reTag2.test(insertedNode.firstChild.nodeName)) {
                        this.config.debugMode && this.err("Antiblock.org");
                        const audio = insertedNode.querySelector("audio[loop]");
                        if (audio) {
                            audio.pause();
                            audio.remove();
                        } else if ((data.abo2 && insertedNode.id === data.abo2) ||
                            (insertedNode.firstChild.hasChildNodes() && reWords1.test(insertedNode.firstChild.innerHTML) && reWords2.test(insertedNode.firstChild.innerHTML))) {
                            insertedNode.remove();
                        } else if ((data.abo3 && insertedNode.id === data.abo3) ||
                            (insertedNode.firstChild.hasChildNodes() && insertedNode.firstChild.firstChild.nodeName === "IMG" && insertedNode.firstChild.firstChild.src.startsWith("data:image/png;base64"))) {
                            aak.win[data.abo3] = null;
                            insertedNode.remove();
                        } else if (data.bsa && insertedNode.id === data.bsa) {
                            this.win[data.bsa] = null;
                            insertedNode.remove();
                        }
                    }
                };
                this.observe("insert", onInsertHandler);
            } else if (this.config.debugMode) {
                this.out.warn("Generic solutions are disabled on this domain. ");
            }
        },
        
        /**
         * Gets the name of the current script manager, if available.
         * @method getScriptManager
         */
        getScriptManager() {
            if (typeof GM_info === 'object') {
                // Greasemonkey (Firefox)
                if (typeof GM_info.uuid !== 'undefined') {
                    return 'Greasemonkey';
                } // Tampermonkey (Chrome/Opera)
                else if (typeof GM_info.scriptHandler !== 'undefined') {
                    return 'Tampermonkey';
                }
            } else {
                // Scriptish (Firefox)
                if (typeof GM_getMetadata === 'function') {
                    return 'Scriptish';
                } // NinjaKit (Safari/Chrome)
                else if (typeof GM_setValue !== 'undefined' &&
                    typeof GM_getResourceText === 'undefined' &&
                    typeof GM_getResourceURL === 'undefined' &&
                    typeof GM_openInTab === 'undefined' &&
                    typeof GM_setClipboard === 'undefined') {
                    return 'NinjaKit';
                } else { // Native
                    return 'Native';
                }
            }
        },
        
        /**
         * Initialize the script.
         * @method init
         * @param excluded {Object} each propery defines whether a generic solution is excluded from running.
         */
        init(excluded) {
            this.$ = this.make$();
            this.md5 = this.MD5Factory();
            this.config();
            this.config.debugMode && this.out.warn("Domain: " + this.dom);
            this.config.domExcluded = excluded.all;
            if (this.config.debugMode && excluded.all) {
                this.out.warn("This domain is in excluded list. ");
            }
            if (!excluded.all) {
                this.generic();
                if (excluded.Adfly) {
                    this.out.log("AAK: This domain is excluded from Adfly bypasser.");
                } else {
                    this.generic.AdflySkipper();
                }
                if (excluded.adsjsV2) {
                    this.out.log("AAK: This domain is excluded from Ads JS V2.");
                } else {
                    this.generic.adsjsV2();
                }
                if (excluded.NoAdBlock) {
                    this.out.log("AAK: This domain is excluded from NoAdBlock.");
                } else {
                    this.generic.NoAdBlock();
                }
            }
        },
        
        /**
         * Inject standalone script to the page.
         * @function
         * @param payload {String|Function} The script to inject.
         * @param [isReady=false] {Boolean} Set this to true if the payload does not need a wrapper.
         */
        inject(payload, isReady) {
            var text = isReady ? payload : `(${payload})();`;
            this.addScript(text);
        },
         
        /**
         * Converts an object into a string. For functions, only the function body is taken.
         * @method intoString
         * @param a {Any} The object to convert
         * @param {String} The string representation of the object.
         */
        intoString(a) {
            if (typeof a === 'function') {
                var str = a.toString();
                var first = str.indexOf("{") + 1;
                var last = str.lastIndexOf("}");
                return str.substr(first, last - first).trim();
            } else if (typeof a === 'object') {
                return JSON.stringify(a);
            } else { // array or string
                return a.toString();
            }
        },
         
        /**
         * Install XMLHttpRequest loopback engine. Should be called once on document-start if needed.
         * The request will always be sent so event handlers can be triggered. Depending on the website, a background redirect
         * may also be required.
         * @method loopback
         * @param {Function} server - The loopback server.
         ** @param {Any} ...args - The arguments supplied to open.
         ** @return {string|Any} Return a string to override the result of this request, return anything else to not interfere.
         */
        loopback(server) {
            this.inject(`(() => {
                "use strict";
                const server = ${server};
                let original; /// XMLHttpRequest;
                const new XHR = function(...args) {
                    const wrapped = new (window.Function.prototype.bind.apply(original, args));
                    const _open = wrapped.open;
                    wrapped.open = function(...args) {
                        const data = server(...args);
                        if (typeof data === "string") {
                            window.Object.defineProperties(this, {
                                "responseText": {
                                    configurable: false,
                                    set() {},
                                    get() {
                                        return data;
                                    }
                                },
                                "status": {
                                    configurable: false,
                                    set() {},
                                    get() {
                                        return 200;
                                    }
                                },
                                "statusText": {
                                    configurable: false,
                                    set() {},
                                    get() {
                                        return "OK";
                                    }
                                }
                            });
                        }
                        return _open.apply(wrapped, args);
                    };
                    return wrapped;
                };
                try {
                    original = window.XMLHttpRequest;
                    window.XMLHttpRequest = newXHR;
                } catch(err) {
                    window.console.error("AAK failed to set up XMLHttpRequest loopback engine!");
                }
            })();`, true);
        },
        
        /**
         * Create a jQuery instance.
         * @method make$
         */
        make$() {
            let $ = this.jQueryFactory(this.win, true);
            return $;
        },
        
        /**
         * Match enum for the "applyMatch" method.
         * @property matchMethod
         * @type Object
         */
        matchMethod: {
            matchAll: 0, // Match all, this is default.
            string: 1, // Substring match
            stringExact: 2, // Exact string match, will result in match if one or more arguments matches the filter
            RegExp: 3, // Regular expression
            callback: 4 // Callback, arguments list will be supplied as an array. Retrun true for match, false for no match.
        },
        
        /**
         * Creates a native video player.
         * @method nativePlayer
         * @param source {String} The source URL of the video stream.
         * @param [typeIn] {String} Specify a video MIME type.
         * @param [widthIn] {String} Specify a custom width.
         * @param [heightIn] {String} Specify a custom height.
         */
        nativePlayer(source, typeIn, widthIn, heightIn) {
            let type;
            if (typeIn) {
                type = typeIn;
            } else {
                const temp = source.split(".");
                switch (temp[temp.length - 1]) {
                    case "webm":
                        type = "video/webm";
                        break;
                    case "mp4":
                        type = "video/mp4";
                        break;
                    case "ogg":
                        type = "video/ogg";
                        break;
                    default:
                        type = "video/mp4";
                        break;
                }
            }
            const width = widthIn || "100%";
            const height = heightIn || "auto";
            return `<video width='${width}' height='${height}' controls><source src='${source}' type='${type}'></video>`;
        },
        
        /**
         * Blocks scripts from accessing a global property.
         * @method noAccess
         * @param name {String} The name of the property to deny access to. Using "." will traverse an object's properties. Starts at the global context.
         * @return {Boolean} true if operation succeeded, false otherwise.
         */
        noAccess(name) {
            const errMsg = "AdBlock Error: This property may not be accessed!";
            let isSuccess = this.defineProperty(name, {
                configurable: false,
                set: function() {
                    throw errMsg;
                },
                get: function() {
                    throw errMsg;
                }
            });
            if (!isSuccess) {
                this.config.debugMode && this.out.error("AAK failed to define non-accessible property '" + name + "'!");
            }
            return isSuccess;
        },
        
        /**
         * Shorthand function for observing and reacting to DOM mutations.
         * @method observe
         * @param type {String} The type of mutation to observe, "insert" or "remove".
         * @param callback {Function} The callback function that fires when the mutation occurs.
         */
        observe(type, callback) {
            if (!this.observe.init.done) {
                this.observe.init.done = true;
                this.observe.init();
            }
            switch(type) {
                case "insert":
                    this.observe.insertCallbacks.push(callback);
                    break;
                case "remove": 
                    this.observe.removeCallbacks.push(callback);
                    break;
            }
        },
        
        /**
         * Shorthand function for unsafeWindow.attachEventListener.
         * @method on
         * @param event {String} The event to listen to.
         * @param func {Function} The callback that fires when the event occurs.
         * @param capture {Boolean} "useCapture".
         */
        on(event, func, capture) {
            if (typeof exportFunction === "function") {
                var funcName = this.uid();
                exportFunction(func, this.win, { defineAs: funcName });
                this.addScript(`
                    window.addEventListener("${event}", window.${funcName}, ${capture});
                    delete window.${funcName};
                `, this.scriptInjectMode.eval);
            } else {
                this.win.addEventListener(event, func, capture);
            }
        },
         
        /**
         * Set up DOM insert observer.
         * @method onInsert
         * @param handler {Function} - The mutation handler.
         ** @param insertedNode {HTMLElement} - The inserted node.
         ** @param target {HTMLElement} - The parent of the inserted node.
         ** @param e {MutationObserver} - The observer object, call disconnect on it to stop observing.
         */
        onInsert(handler) {
            const observer = new MutationObserver((mutations) => {
                for (let i = 0; i < mutations.length; i++) {
                    for (let j = 0; j < mutations[i].addedNodes.length; j++) {
                        handler(mutations[i].addedNodes[j], mutations[i].target, observer);
                    }
                }
            });
            observer.observe(document, {
                childList: true,
                subtree: true,
            });
        },
         
        /**
         * Set up DOM remove observer.
         * @method onRemove
         * @param handler {Function} - The mutation handler.
         ** @param removedNode {HTMLElement} - The removed node.
         ** @param target {HTMLElement} - The parent of the removed node.
         ** @param e {MutationObserver} - The observer object, call disconnect on it to stop observing.
         */
        onRemove(handler) {
            const observer = new MutationObserver((mutations) => {
                for (let i = 0; i < mutations.length; i++) {
                    for (let j = 0; j < mutations[i].removedNodes.length; j++) {
                        handler(mutations[i].removedNodes[j], mutations[i].target, observer);
                    }
                }
            });
            observer.observe(document, {
                childList: true,
                subtree: true,
            });
        },
            
        /** 
         * The console of the unsafe window
         * @property out
         */
        out: win.console,
        
        /**
         * Modify the HTML of the entire page before it loads.
         * @method patchHTML
         * @param patcher {Function} Function that is passed the HTML of the page, and returns the replacement.
         */
        patchHTML(patcher) {
            this.win.stop();
            GM_xmlhttpRequest({
                method: "GET",
                url: this.doc.location.href,
                headers: {
                    "Referer": this.doc.referer
                },
                onload: (result) => {
                    this.doc.write(patcher(result.responseText));
                }
            });
        },
        
        /**
         * Patches Function.prototype.toString so our modifications can't be detected by the page script.
         * @method patchToString
         */
        patchToString() {
            aak.addScript(function() {
                (function() {
                    var originalToString = Function.prototype.toString;
                    Function.prototype.toString = function () {
                        if (this === window.XMLHttpRequest || this === window.setTimeout || this === window.setInterval || this === Function.prototype.toString) {
                            return `function ${this.name}() { [native code] }`;
                        } else {
                            return originalToString.apply(this, arguments); 
                        }
                    };
                })();
            });
            
        },
        
        /**
         * Stops websites from detecting function modifications by utilizing the toString method of the function. Used in conjunction with "filter".
         * @method protectFunc
         */
        protectFunc() {
            this.protectFunc.enabled = true;
            const original = this.win.Function.prototype.toString;
            const newFunc = () => {
                const index = this.protectFunc.pointers.indexOf(this);
                if (index === -1) {
                    return original.apply(this);
                } else {
                    return this.protectFunc.masks[index];
                }
            };
            try {
                this.win.Function.prototype.toString = newFunc;
                this.protectFunc.pointers.push(newFunc);
                this.protectFunc.masks.push(String(original));
                this.config.debugMode && this.out.warn("Functions protected.");
            } catch(err) {
                this.config.debugMode && this.out.error("AAK failed to protect functions!");
                return false;
            }
            return true;
        },
        
        /**
         * Makes it so a global property is not modifiable by further scripts.
         * @method noAccess
         * @param name {String} The name of the property to make read-only. Using "." will traverse an object's properties. Starts at the global context.
         * @param val {Any} The desired value of the read-only property.
         * @return {Boolean} true if operation succeeded, false otherwise.
         */
        readOnly(name, val) {
            let isSuccess = this.defineProperty(name, {
                configurable: false,
                set: function() {},
                get: function() {
                    return val;
                }
            });
            if (!isSuccess) {
                this.config.debugMode && this.out.error("AAK failed to define non-accessible property '" + name + "'!");
            }
            return isSuccess;
        },
        
        /**
         * Fires when the DOM is ready for modification.
         * @method ready
         * @param func {Function} Callback to fire when DOM is ready.
         * @param capture {Boolean} Whether or not the callback should fire before event target.
         */
        ready(func, capture) {
            this.on("DOMContentLoaded", func, capture);
        },
        
        /**
         * Redirects the page with a get or post request. Use this instead of window.location.href for greater compatibility.
         * @method redirect
         * @param url {String} The URL to redirect to.
         * @param [method="get"] {String} The redirection method, "get" or "post".
         * @param [params] {Object} Either get params or post body data, depending on the method.
         */
        redirect(url, method, params) {
            var callRedirect = () => {
                method = (method || "get").toLowerCase();

                let form = this.doc.createElement("form");
                form.method = method;
                form.action = url;

                if (params) {
                    for (let key in params) {
                        if (params.hasOwnProperty(key)) {
                            let hiddenField = this.doc.createElement("input");
                            hiddenField.type = "hidden";
                            hiddenField.name = key;
                            hiddenField.value = params[key];
                            form.appendChild(hiddenField);
                        }
                    }
                }

                let submitButton = this.doc.createElement("input");
                submitButton.style.display = "none";
                submitButton.type = "submit";
                form.appendChild(submitButton);

                const e = this.doc.body || this.doc.documentElement;
                e.appendChild(form);
                submitButton.click();
                e.removeChild(form);
            };
            if (document.readyState == "interactive" || document.readyState == "complete") {
                callRedirect();
            } else {
                this.ready(() => {
                    callRedirect();
                });
            }
        },
         
        /**
         * Install XMLHttpRequest replace engine. Should be called once on document-start if needed.
         * @method replace
         * @param handler {Function} - The replace handler.
         * @runtime this, method, url, isAsync, user, passwd, ...rest
         ** Keyword this and arguments passed to XMLHttpRequest.prototype.open().
         * @runtime replace
         ** Replace payload.
         ** @method
         ** @param {This} that - The keyword this.
         ** @param {string} text - The new payload.
         */
        replace(handler) {
            this.inject(`(() => {
                "use strict";
                const replace = (that, text) => {
                    window.Object.defineProperty(that, "responseText", {
                        configurable: false,
                        set() {},
                        get() {
                            return text;
                        }
                    });
                    window.Object.defineProperty(that, "response", {
                        configurable: false,
                        set() {},
                        get() {
                            return text;
                        }
                    });
                };
                try {
                    const _open = window.XMLHttpRequest.prototype.open;
                    window.XMLHttpRequest.prototype.open = function(method, url, isAsync, user, passwd, ...rest) {
                        (${handler})();
                        return _open.call(this, method, url, isAsync, user, passwd, ...rest);
                    };
                } catch(err) {
                    window.console.error("AAK failed to set up XMLHttpRequest replace engine!");
                }
            })();`, true);
        },
        
        /**
         * Enum for "addScript" function's second argument.
         * @property scriptInjectMode
         */
        scriptInjectMode: {
            default: 0, // Tries to figure it out based on the current client.
            eval: 1, // Runs an eval on the script.
            drop: 2 // Inserts the script on the page as a script tag.
        },
        
        /**
         * The unsafe window's setInterval.
         * @property setInterval
         */
        setInterval: (win.setInterval).bind(win),
        
        /**
         * Sets a property on the unsafe window.
         * @method setProp
         * @param name {String} The name of the property to set. Can use a dot separated syntax to drill down into objects.
         * @param val {Any} The value of the property.
         */
        setProp(name, val) {
            if (Object.prototype.toString.call(name) === "[object Array]") {
                name = name.join(".");
            }
            if (typeof exportFunction === "function") {
                var valFunction = function() {
                    return val;
                };
                var valFunctionName = this.uid();
                exportFunction(valFunction, this.win, { defineAs: valFunctionName });
                this.addScript(`
                    window.${name} = ${valFunctionName}();
                    delete ${valFunctionName};
                `, this.scriptInjectMode.eval);
            }
            else {
                let original = this.win;
                let parent;
                let stack = name.split(".");
                let current;
                while (current = stack.shift()) {
                    parent = original;
                    original = parent[current];
                    if (!stack.length) {
                        parent[current] = val;
                    }
                }
            }
        },
        
        /**
         * The unsafe window's setTimeout.
         * @property setTimeout
         */
        setTimeout: (win.setTimeout).bind(win),
        
        /**
         * Creates a SHA-256 hash signature of provided string.
         * @method sha256
         * @param r {String} The string to encrypt.
         */
        sha256(r) {
            //@pragma-keepline Based on work of Angel Marin and Paul Johnston
            //@pragma-keepline More information: http://www.webtoolkit.info/javascript-sha256.html
            function n(r, n) {
                var t = (65535 & r) + (65535 & n),
                    e = (r >> 16) + (n >> 16) + (t >> 16);
                return e << 16 | 65535 & t;
            }
            function t(r, n) {
                return r >>> n | r << 32 - n;
            }
            function e(r, n) {
                return r >>> n;
            }
            function o(r, n, t) {
                return r & n ^ ~r & t;
            }
            function u(r, n, t) {
                return r & n ^ r & t ^ n & t;
            }
            function a(r) {
                return t(r, 2) ^ t(r, 13) ^ t(r, 22);
            }
            function f(r) {
                return t(r, 6) ^ t(r, 11) ^ t(r, 25);
            }
            function c(r) {
                return t(r, 7) ^ t(r, 18) ^ e(r, 3);
            }
            function i(r) {
                return t(r, 17) ^ t(r, 19) ^ e(r, 10);
            }
            function h(r, t) {
                var e, h, C, g, d, v, A, l, m, S, y, w, b = new Array(1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993, 2453635748, 2870763221, 3624381080, 310598401, 607225278, 1426881987, 1925078388, 2162078206, 2614888103, 3248222580, 3835390401, 4022224774, 264347078, 604807628, 770255983, 1249150122, 1555081692, 1996064986, 2554220882, 2821834349, 2952996808, 3210313671, 3336571891, 3584528711, 113926993, 338241895, 666307205, 773529912, 1294757372, 1396182291, 1695183700, 1986661051, 2177026350, 2456956037, 2730485921, 2820302411, 3259730800, 3345764771, 3516065817, 3600352804, 4094571909, 275423344, 430227734, 506948616, 659060556, 883997877, 958139571, 1322822218, 1537002063, 1747873779, 1955562222, 2024104815, 2227730452, 2361852424, 2428436474, 2756734187, 3204031479, 3329325298),
                    p = new Array(1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225),
                    s = new Array(64);
                r[t >> 5] |= 128 << 24 - t % 32, r[(t + 64 >> 9 << 4) + 15] = t;
                for (m = 0; m < r.length; m += 16) {
                    e = p[0], h = p[1], C = p[2], g = p[3], d = p[4], v = p[5], A = p[6], l = p[7];
                    for (S = 0; 64 > S; S++) 16 > S ? s[S] = r[S + m] : s[S] = n(n(n(i(s[S - 2]), s[S - 7]), c(s[S - 15])), s[S - 16]), y = n(n(n(n(l, f(d)), o(d, v, A)), b[S]), s[S]), w = n(a(e), u(e, h, C)), l = A, A = v, v = d, d = n(g, y), g = C, C = h, h = e, e = n(y, w);
                    p[0] = n(e, p[0]), p[1] = n(h, p[1]), p[2] = n(C, p[2]), p[3] = n(g, p[3]), p[4] = n(d, p[4]), p[5] = n(v, p[5]), p[6] = n(A, p[6]), p[7] = n(l, p[7]);
                }
                return p;
            }
            function C(r) {
                for (var n = Array(), t = (1 << v) - 1, e = 0; e < r.length * v; e += v) n[e >> 5] |= (r.charCodeAt(e / v) & t) << 24 - e % 32;
                return n;
            }
            function g(r) {
                r = r.replace(/\r\n/g, "\n");
                for (var n = "", t = 0; t < r.length; t++) {
                    var e = r.charCodeAt(t);
                    128 > e ? n += String.fromCharCode(e) : e > 127 && 2048 > e ? (n += String.fromCharCode(e >> 6 | 192), n += String.fromCharCode(63 & e | 128)) : (n += String.fromCharCode(e >> 12 | 224), n += String.fromCharCode(e >> 6 & 63 | 128), n += String.fromCharCode(63 & e | 128));
                }
                return n;
            }
            function d(r) {
                for (var n = A ? "0123456789ABCDEF" : "0123456789abcdef", t = "", e = 0; e < 4 * r.length; e++) t += n.charAt(r[e >> 2] >> 8 * (3 - e % 4) + 4 & 15) + n.charAt(r[e >> 2] >> 8 * (3 - e % 4) & 15);
                return t;
            }
            var v = 8,
                A = 0;
            return r = g(r), d(h(C(r), r.length * v));
        },
        
        /**
         * Similar to "filter", except all arguments are multiplied by a "ratio" for detection on the next call. Usually used on "setInterval". 
         * @method timewarp
         */
        timewarp(func, method, filter, onMatch, onAfter, ratio) {
            ratio = ratio || 0.02;
            
            var applyMatchFnName = this.exportFunction((args, method, filter) => {
                this.applyMatch.call(this, args, method, filter);
            });
            var filterFnName = (filter) ? this.exportFunction(filter) : "undefined";
            var errFnName = this.exportFunction(this.err);
            var onMatchFnName = (onMatch) ? this.exportFunction(onMatch) : "undefined";
            var onAfterFnName = (onAfter) ? this.exportFunction(onAfter) : "undefined";
            let protectFuncPointersPushFnName = this.exportFunction(this.protectFunc.pointers.push);
            let protectFuncMasksPushFnName = this.exportFunction(this.protectFunc.masks.push);

            var scriptReturnVal;
            var setReturnValueFnName = this.exportFunction((val) => {
                scriptReturnVal = val;
            });

            this.addScript(`
                (function() {
                    let func = "${func}";
                    let ratio = ${ratio};
                    let applyMatch = window.${applyMatchFnName};
                    let method = ${method};
                    let filter = window.${filterFnName};
                    let err = window.${errFnName};
                    let onMatch = window.${onMatchFnName};
                    let onAfter = window.${onAfterFnName};
                    let setReturnVal = window.${setReturnValueFnName};
                    let protectFuncPointersPush = window.${protectFuncPointersPushFnName};
                    let protectFuncMasksPush = window.${protectFuncMasksPushFnName};
                    delete window.${applyMatchFnName};
                    delete window.${filterFnName};
                    delete window.${errFnName};
                    delete window.${onMatchFnName};
                    delete window.${onAfterFnName};
                    delete window.${setReturnValueFnName};
                    delete window.${protectFuncPointersPushFnName};
                    delete window.${protectFuncMasksPushFnName};

                    let original = window[func];

                    const newFunc = (...args) => {
                        if (${this.config.debugMode}) {
                            console.warn("Timewarpped ${func} is called with these arguments: ");
                            for (let i=0; i<args.length; i++) {
                                console.warn(String(args[i]));
                            }
                        }
                        if (!method || applyMatch(args, method, filter)) {
                            if (${this.config.debugMode}) {
                                console.warn("Timewarpped. ");
                            }
                            onMatch && onMatch(args);
                            onAfter && onAfter(true, args);
                            args[1] = args[1] * ratio;
                            return original.apply(window, args);
                        } else {
                            if (${this.config.debugMode}) {
                                console.info("Not timewarpped. ");
                            }
                            onAfter && onAfter(true, args);
                            return original.apply(window, args);
                        }
                    };
                    try {
                        window[func] = newFunc;
                        if (${this.protectFunc.enabled}) {
                            protectFuncPointersPush(newFunc);
                            protectFuncMasksPush(String(original));
                        }
                        if (${this.config.debugMode}) {
                            console.warn("Timewarp activated on ${func}");
                        }
                    } catch(err) {
                        if (${this.config.debugMode}) {
                            console.error("AAK failed to activate timewarp on ${func}!");
                        }
                        return setReturnVal(false);
                    }
                    return setReturnVal(true);
                })();
            `, this.scriptInjectMode.eval);

            return scriptReturnVal;
        },
        
        /**
         * Generated a unique ID string.
         * @method uid
         * @return {String} The unique id.
         */
        uid() {
            const chars = "abcdefghijklnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
            let str = "";
            for (let i = 0; i < 10; i++) {
                str += chars.charAt(this.win.Math.floor(this.win.Math.random() * chars.length));
            }
            this.uid.counter++;
            return str + this.uid.counter.toString();
        },
        
        /**
         * Converts an adblock/uBlock address filter rule to a regex object.
         * @method urlFilterToRegex
         * @param rule {String} The filter to convert (should not include options after $ or element blocking ##)
         * @return {RegExp} The RegExp object.
         */
        urlFilterToRegex(rule) {
            let regex = "";
            let matches = rule.split(",");
            let matchRegexes = [];
            for (let i=0; i<matches.length; i++) {
                let matchStr = matches[i];
                let matchRegex = "";
                let matchTokens = [];
                let currentToken = "";
                
                // Identify special tokens.
                for (let ii=0; ii<matchStr.length; ii++) {
                    if (matchStr[ii] === "*" || matchStr[ii] === "^" || matchStr[ii] === "|") {
                        if (currentToken) matchTokens.push(currentToken);
                        currentToken = matchStr[ii];
                        if (matchStr[ii+1] && matchStr[ii+1] === "|") {
                            currentToken += "|";
                            ii++;
                        }
                        matchTokens.push(currentToken);
                        currentToken = "";
                    } else {
                        currentToken += matchStr[ii];
                    }
                }
                if (currentToken) matchTokens.push(currentToken);
                
                // Loop through tokens and build regex.
                for (let ii=0; ii<matchTokens.length; ii++) {
                    currentToken = matchTokens[ii];
                    if (currentToken === "*") {
                        matchRegex += ".*?";
                    } else if (currentToken === "^") {
                        matchRegex += "(^|$|[^a-zA-Z0-9_\\-\\.\\%])";
                    } else if (currentToken === "||") {
                        matchRegex += "^(http|https|ftp)\\:\\/\\/([a-zA-Z0-9\\-\\.\\%]{1,}\\.){0,}";
                    } else if (currentToken === "|") {
                        matchRegex += "(^|$)";
                    } else {
                        // Normal text token; escape regex special characters.
                        matchRegex += currentToken.replace(/(?:(\\)|(\^)|(\$)|(\{)|(|})|(\[)|(|])|(\()|(\))|(\.)|(\*)|(\+)|(\?)|(\|)|(\<)|(\>)|(\-)|(\&))/g, function(str) { return (str) ? "\\"+str : "" });
                    }
                }
                matchRegexes.push(matchRegex);
            }
            regex = "(" + matchRegexes.join("|") + ")";
            return new RegExp(regex, "g");
        },
         
        /**
         * Creates a videoJS player.
         * @method videoJS
         * 
         */
        videoJS(sources, types, width, height) {
            let html = `<video id="uBlock_Protector_Video_Player" class="video-js vjs-default-skin" controls preload="auto" width="${width}" height="${height}" data-setup="{}">`;
            for (let i = 0; i < sources.length; i++) {
                html += `<source src="${sources[i]}" type="${types[i]}">`;
            }
            html += `</video>`;
            return html;
        },
        
        /**
         * The unsafe window. Use for read-only access.
         * Writing directly does not work in all setups. Use the "setProp" method to write.
         * @property window
         */
        win: win,
         
        /**
         * Modifies the response text of an XHR request.
         * @method xhrSpoof
         * @param urlFilter {String} Matches the request URL based on the adblock/uBlock filter syntax.
         * @param replacement {String} The replacement for the response text.
         */
        xhrSpoof(urlFilter, replacement) {
            this.xhrSpoof.rules.push(this.urlFilterToRegex(urlFilter));
            this.xhrSpoof.replacements.push(replacement);
            if (!this.xhrSpoof.injected) {
                
                let getReplacementIndex = (url) => {
                    let index = -1;
                    for (let i=0; i<this.xhrSpoof.rules.length; i++) {
                        if (this.xhrSpoof.rules[i].test(url)) {
                            index = i;
                            this.xhrSpoof.rules[i].lastIndex = 0;
                            break;
                        }
                    }
                    return index;
                };
                let getReplacementIndexName = this.exportFunction(getReplacementIndex);
                
                let getReplacementValue = (index) => {
                    return this.xhrSpoof.replacements[index];
                };
                let getReplacementValueName = this.exportFunction(getReplacementValue);
                
                this.addScript(`
                    (function(proxied) {
                        var getReplacementIndex = window.${getReplacementIndexName};
                        delete window.${getReplacementIndexName};    
                        var getReplacementValue = window.${getReplacementValueName};
                        delete window.${getReplacementValueName};

                        window.XMLHttpRequest = function() {
                            var wrapped = new(Function.prototype.bind.apply(proxied, arguments));

                            var open = wrapped.open;
                            wrapped.open = function(method, url, async) {
                                    
                                // Determine absolute path
                                var link = document.createElement("a");
                                link.href = url;

                                let replacementIndex = getReplacementIndex(link.protocol+"//"+link.host+link.pathname+link.search+link.hash);
                                if (replacementIndex > -1) {
                                        Object.defineProperty(this, "responseText", {
                                                writable: true,
                                                value: getReplacementValue(replacementIndex)
                                        });
                                }

                                return open.call(wrapped, method, url, async);
                            };

                            return wrapped;
                        };
                    })(XMLHttpRequest);
                `, this.scriptInjectMode.eval);
            }
        }
        
    };
    
    /*
     * Static properties for aak.config
     */
    aak.config.aggressiveAdflySkipper = true;
    aak.config.allowExperimental = true;
    aak.config.allowGeneric = true;
    aak.config.debugMode = false;
    aak.config.domExcluded = null;
    aak.config.update = (id, val) => {
        const names = [
            "config_debugMode",
            "config_allowExperimental",
            "config_aggressiveAdflySkiper"
        ];
        if (names.includes(id)) {
            GM_setValue(id, Boolean(val));
        }
    };
    
    /* 
     * Static properties for aak.generic
     */
    aak.generic.AdflySkipper = function () {
        //@pragma-keepline Based on AdsBypasser
        //@pragma-keepline License: https://github.com/adsbypasser/adsbypasser/blob/master/LICENSE
        const handler = function (encodedURL) {
            if (aak.doc.body) {
                return;
            }
            const index = encodedURL.indexOf("!HiTommy");
            if (index >= 0) {
                encodedURL = encodedURL.substring(0, index);
            }
            let var1 = "", var2 = "";
            for (let i = 0; i < encodedURL.length; ++i) {
                if (i % 2 === 0) {
                    var1 = var1 + encodedURL.charAt(i);
                } else {
                    var2 = encodedURL.charAt(i) + var2;
                }
            }
            let decodedURL = aak.win.atob(var1 + var2);
            decodedURL = decodedURL.substr(2);
            if (aak.win.location.hash) {
                decodedURL += aak.win.location.hash;
            }
            if (decodedURL.length > 3 && decodedURL.includes(".")) {
                aak.win.stop();
                aak.setProp("onbeforeunload", null);
                aak.redirect(decodedURL);
            }
        };
        try {
            let val;
            let flag = true;
            aak.defineProperty("ysmm", {
                configurable: false,
                set: function (value) {
                    if (flag) {
                        flag = false;
                        try {
                            if (typeof value === "string") {
                                handler(value);
                            }
                        } catch (err) { }
                    }
                    val = value;
                },
                get: function () {
                    return val;
                }
            });
        } catch (err) {
            aak.config.debugMode && aak.out.error("AAK could not set up Adfly skipper. ");
        }
    };
    aak.generic.adsjsV2 = function () {
        this.inject(() => {
            "use strict";
            const error = window.console.error.bind(window.console);
            const matcher = /[a-zA-Z0-9]{11,14}/; //From samples I saw, the length is 12 or 13, checking for 11 to 14 to be sure
            const err = new window.TypeError("Failed to execute 'getElementById' on 'Document': 1 argument required, but only 0 present.");
            let original; //document.getElementById
            const newFunc = (...args) => {
                if (args.length) {
                    if (matcher.test(String(args[0]))) {
                        let elem = original.apply(window.document, args);
                        if (elem) {
                            return elem;
                        } else {
                            error("Uncaught Error: ads.js v2 AAK detector is not allowed on this device!");
                            return window.document.createElement("div");
                        }
                    } else {
                        return original.apply(window.document, args)
                    }
                } else {
                    throw err;
                }
            };
            try {
                original = window.document.getElementById;
                window.document.getElementById = newFunc;
            } catch (err) {
                error("AAK failed to set up ads.js v2 defuser!");
            }
        });
    };
    aak.generic.FuckAdBlock = function (constructorName, instanceName) {
        
        var patchedFuckAdBlockName = aak.uid();
        
        var patchedFuckAdBlock = function () {
            window.patchedFuckAdBlock = function() {
                //@pragma-keepline Based on FuckAdBlock
                //@pragma-keepline License: https://github.com/sitexw/FuckAdBlock/blob/master/LICENSE
                this._callbacks = [];
                window.addEventListener("load", (function () {
                    this.emitEvent();
                }).bind(this));
                this.setOption = function () {
                    return this;
                };
                this.check = function () {
                    this.emitEvent();
                    return true;
                };
                this.emitEvent = function () {
                    for (let i = 0; i < this._callbacks.length; i++) {
                        this._callbacks[i]();
                    }
                    return this;
                };
                this.clearEvent = function () {
                    this._callbacks = [];
                };
                this.on = function (detected, func) {
                    //aak.config.debugMode && aak.err("FuckAdBlock");
                    if (!detected) {
                        this._callbacks.push(func);
                    }
                    return this;
                };
                this.onDetected = function () {
                    //aak.config.debugMode && aak.err("FuckAdBlock");
                    return this;
                };
                this.onNotDetected = function (func) {
                    return this.on(false, func);
                };
                this.debug = {};
                this.debug.set = (function () {
                    return this;
                }).bind(this);
            };
        };
        
        patchedFuckAdBlock = aak.intoString(patchedFuckAdBlock).replace("patchedFuckAdBlock", patchedFuckAdBlockName);
        
        aak.addScript(patchedFuckAdBlock, aak.scriptInjectMode.eval);
        
        return aak.readOnly(constructorName, aak.win[patchedFuckAdBlockName]) && aak.readOnly(instanceName, new aak.win[constructorName]());
          
    };
    aak.generic.NoAdBlock = () => {
        aak.inject(() => {
            "use strict";
            try {
                // Swap solutions
                const useSolution = 3;
                // Get a local instance of console error
                const error = window.console.error.bind(window.console);
                const init = () => {
                    
                };
                let needDefuse = true;
                let installs = {};
                window.CloudflareApps = window.CloudflareApps || {};
                window.Object.defineProperty(window.CloudflareApps, "installs", {
                    configurable: false,
                    set(val) {
                        installs = val;
                    },
                    get() {
                        if (needDefuse && installs instanceof window.Object) {
                            try {
                                for (let key in installs) {
                                    if (installs[key].appId === "ziT6U3epKObS" && installs[key].options) {
                                        // Preview does not really matter, just hard code something that works for now.
                                        window.document.body.insertAdjacentHTML("beforeend", "<style>html, body { overflow:scroll !important; } cf-div { display:none !important }</style>");
                                    } else {
                                        switch (useSolution) {
                                            case 0:
                                                // Solution 0: Emergency fallback, lock display to a closable small adb_overlay
                                                installs[key].options.warningSettings = {
                                                    coverPage: false,
                                                    messageTypeFull: "1",
                                                    messageTypeSmall: "1"
                                                };
                                                installs[key].options.translations = {
                                                    howToDisableButtonLink: "https://goo.gl/CgJEsa",
                                                    howToDisableButtonText: "点我报告问题",
                                                    refreshButtonText: "",
                                                    showTranslations: true,
                                                    warningText: "额，貌似我的黑科技失效了……",
                                                    warningTitle: "",
                                                };
                                                break;
                                            case 1:
                                                // Solution 1: Set it to show up 5 to 10 years later
                                                const min = 157700000, max = 315400000;
                                                installs[key].options.advancedSettings = {
                                                    analytics: false,
                                                    showAdvancedSettings: true,
                                                    warningDelay: window.Math.floor(window.Math.random() * (max - min) + min),
                                                };
                                                break;
                                            case 2:
                                                // Solution 2: Spoof cookies to prevent showing dialog
                                                window.document.cookie = `lastTimeWarningShown=${window.Date.now()}`;
                                                window.document.cookie = "warningFrequency=visit";
                                                installs[key].options.dismissOptions = {
                                                    allowDismiss: "allow",
                                                    warningFrequency: "visit",
                                                    warningInterval: 1,
                                                };
                                                break;
                                            case 3:
                                                // Solution 3: Change URL patterns so it never matches
                                                window.Object.defineProperty(installs[key], "URLPatterns", {
                                                    configurable: false,
                                                    set() { },
                                                    get() {
                                                        return ["$^"];
                                                    },
                                                });
                                                break;
                                            default:
                                                // Ultimate solution: stop installation, may break other Cloudflare apps
                                                delete installs[key];
                                                break;
                                        }
                                    }
                                    // Update flag and log
                                    needDefuse = false;
                                }
                            } catch(err) {
                                err("AAK error during generic NoAdBlock solution", e);
                            }
                        }
                    }
                });
            } catch(err) {
                error("AAK failed to set up NoAdBlock defuser!");
            }
        });
    };
        
    /* 
     * Static properties for aak.observe
     */
    aak.observe.init = () => {
        const observer = new MutationObserver(function(mutations) {
            for (let i=0; i<mutations.length; i++) {
                if (mutations[i].addedNodes.length) {
                    for (let ii=0; ii<aak.observe.insertCallbacks.length; ii++) {
                        for (let iii=0; iii<mutations[i].addedNodes.length; iii++) {
                            aak.observe.insertCallbacks[ii](mutations[i].addedNodes[iii]);
                        }
                    }
                }
                if (mutations[i].removedNodes.length) {
                    for (let ii = 0; ii < aak.observe.removeCallbacks.length; ii++) {
                        for (let iii = 0; iii < mutations[i].removedNodes.length; iii++) {
                            aak.observe.removeCallbacks[ii](mutations[i].removedNodes[iii]);
                        }
                    }
                }
            }
        });
        observer.observe(aak.doc, {
            childList: true,
            subtree: true
        });
    };
    aak.observe.init.done = false;
    aak.observe.insertCallbacks = [];
    aak.observe.removeCallbacks = [];
    
    /*
     * Static properties for aak.protectFunc
     */
    aak.protectFunc.enabled = false;
    aak.protectFunc.pointers = [];
    aak.protectFunc.masks = [];

    /* 
     * Static properties for aak.uuid
     */
    aak.uid.counter = 0;
    
    /*
     * Static properties for aak.videoJS
     */
    aak.videoJS.init = (...args) => {
        try {
            aak.win.HELP_IMPROVE_VIDEOJS = false;
        } catch (err) { }
        let plugins = args.join();
        aak.$("head").append(`<link href="//vjs.zencdn.net/5.4.6/video-js.min.css" rel="stylesheet"><script src="//vjs.zencdn.net/5.4.6/video.min.js"><\/script>${plugins}`);
    };
    aak.videoJS.plugins = {};
    aak.videoJS.plugins.hls = `<script src="//cdnjs.cloudflare.com/ajax/libs/videojs-contrib-hls/5.4.0/videojs-contrib-hls.min.js"><\/script>`;
    
    /*
     * Static properties for aak.xhrSpoof
     */
    aak.xhrSpoof.injected = false;
    aak.xhrSpoof.rules = [];
    aak.xhrSpoof.replacements = [];
    
    return aak;

})((typeof unsafeWindow !== "undefined") ? unsafeWindow : window);

/*==========================================================================
| MD5Factory based on yamd5.js | (c) gorhill | github.com/gorhill/yamd5.js |
===========================================================================*/

a.MD5Factory=function(){'use strict';var f=function(r,s){var t=r[0],u=r[1],v=r[2],w=r[3];t+=0|(u&v|~u&w)+s[0]-680876936,t=0|(t<<7|t>>>25)+u,w+=0|(t&u|~t&v)+s[1]-389564586,w=0|(w<<12|w>>>20)+t,v+=0|(w&t|~w&u)+s[2]+606105819,v=0|(v<<17|v>>>15)+w,u+=0|(v&w|~v&t)+s[3]-1044525330,u=0|(u<<22|u>>>10)+v,t+=0|(u&v|~u&w)+s[4]-176418897,t=0|(t<<7|t>>>25)+u,w+=0|(t&u|~t&v)+s[5]+1200080426,w=0|(w<<12|w>>>20)+t,v+=0|(w&t|~w&u)+s[6]-1473231341,v=0|(v<<17|v>>>15)+w,u+=0|(v&w|~v&t)+s[7]-45705983,u=0|(u<<22|u>>>10)+v,t+=0|(u&v|~u&w)+s[8]+1770035416,t=0|(t<<7|t>>>25)+u,w+=0|(t&u|~t&v)+s[9]-1958414417,w=0|(w<<12|w>>>20)+t,v+=0|(w&t|~w&u)+s[10]-42063,v=0|(v<<17|v>>>15)+w,u+=0|(v&w|~v&t)+s[11]-1990404162,u=0|(u<<22|u>>>10)+v,t+=0|(u&v|~u&w)+s[12]+1804603682,t=0|(t<<7|t>>>25)+u,w+=0|(t&u|~t&v)+s[13]-40341101,w=0|(w<<12|w>>>20)+t,v+=0|(w&t|~w&u)+s[14]-1502002290,v=0|(v<<17|v>>>15)+w,u+=0|(v&w|~v&t)+s[15]+1236535329,u=0|(u<<22|u>>>10)+v,t+=0|(u&w|v&~w)+s[1]-165796510,t=0|(t<<5|t>>>27)+u,w+=0|(t&v|u&~v)+s[6]-1069501632,w=0|(w<<9|w>>>23)+t,v+=0|(w&u|t&~u)+s[11]+643717713,v=0|(v<<14|v>>>18)+w,u+=0|(v&t|w&~t)+s[0]-373897302,u=0|(u<<20|u>>>12)+v,t+=0|(u&w|v&~w)+s[5]-701558691,t=0|(t<<5|t>>>27)+u,w+=0|(t&v|u&~v)+s[10]+38016083,w=0|(w<<9|w>>>23)+t,v+=0|(w&u|t&~u)+s[15]-660478335,v=0|(v<<14|v>>>18)+w,u+=0|(v&t|w&~t)+s[4]-405537848,u=0|(u<<20|u>>>12)+v,t+=0|(u&w|v&~w)+s[9]+568446438,t=0|(t<<5|t>>>27)+u,w+=0|(t&v|u&~v)+s[14]-1019803690,w=0|(w<<9|w>>>23)+t,v+=0|(w&u|t&~u)+s[3]-187363961,v=0|(v<<14|v>>>18)+w,u+=0|(v&t|w&~t)+s[8]+1163531501,u=0|(u<<20|u>>>12)+v,t+=0|(u&w|v&~w)+s[13]-1444681467,t=0|(t<<5|t>>>27)+u,w+=0|(t&v|u&~v)+s[2]-51403784,w=0|(w<<9|w>>>23)+t,v+=0|(w&u|t&~u)+s[7]+1735328473,v=0|(v<<14|v>>>18)+w,u+=0|(v&t|w&~t)+s[12]-1926607734,u=0|(u<<20|u>>>12)+v,t+=0|(u^v^w)+s[5]-378558,t=0|(t<<4|t>>>28)+u,w+=0|(t^u^v)+s[8]-2022574463,w=0|(w<<11|w>>>21)+t,v+=0|(w^t^u)+s[11]+1839030562,v=0|(v<<16|v>>>16)+w,u+=0|(v^w^t)+s[14]-35309556,u=0|(u<<23|u>>>9)+v,t+=0|(u^v^w)+s[1]-1530992060,t=0|(t<<4|t>>>28)+u,w+=0|(t^u^v)+s[4]+1272893353,w=0|(w<<11|w>>>21)+t,v+=0|(w^t^u)+s[7]-155497632,v=0|(v<<16|v>>>16)+w,u+=0|(v^w^t)+s[10]-1094730640,u=0|(u<<23|u>>>9)+v,t+=0|(u^v^w)+s[13]+681279174,t=0|(t<<4|t>>>28)+u,w+=0|(t^u^v)+s[0]-358537222,w=0|(w<<11|w>>>21)+t,v+=0|(w^t^u)+s[3]-722521979,v=0|(v<<16|v>>>16)+w,u+=0|(v^w^t)+s[6]+76029189,u=0|(u<<23|u>>>9)+v,t+=0|(u^v^w)+s[9]-640364487,t=0|(t<<4|t>>>28)+u,w+=0|(t^u^v)+s[12]-421815835,w=0|(w<<11|w>>>21)+t,v+=0|(w^t^u)+s[15]+530742520,v=0|(v<<16|v>>>16)+w,u+=0|(v^w^t)+s[2]-995338651,u=0|(u<<23|u>>>9)+v,t+=0|(v^(u|~w))+s[0]-198630844,t=0|(t<<6|t>>>26)+u,w+=0|(u^(t|~v))+s[7]+1126891415,w=0|(w<<10|w>>>22)+t,v+=0|(t^(w|~u))+s[14]-1416354905,v=0|(v<<15|v>>>17)+w,u+=0|(w^(v|~t))+s[5]-57434055,u=0|(u<<21|u>>>11)+v,t+=0|(v^(u|~w))+s[12]+1700485571,t=0|(t<<6|t>>>26)+u,w+=0|(u^(t|~v))+s[3]-1894986606,w=0|(w<<10|w>>>22)+t,v+=0|(t^(w|~u))+s[10]-1051523,v=0|(v<<15|v>>>17)+w,u+=0|(w^(v|~t))+s[1]-2054922799,u=0|(u<<21|u>>>11)+v,t+=0|(v^(u|~w))+s[8]+1873313359,t=0|(t<<6|t>>>26)+u,w+=0|(u^(t|~v))+s[15]-30611744,w=0|(w<<10|w>>>22)+t,v+=0|(t^(w|~u))+s[6]-1560198380,v=0|(v<<15|v>>>17)+w,u+=0|(w^(v|~t))+s[13]+1309151649,u=0|(u<<21|u>>>11)+v,t+=0|(v^(u|~w))+s[4]-145523070,t=0|(t<<6|t>>>26)+u,w+=0|(u^(t|~v))+s[11]-1120210379,w=0|(w<<10|w>>>22)+t,v+=0|(t^(w|~u))+s[2]+718787259,v=0|(v<<15|v>>>17)+w,u+=0|(w^(v|~t))+s[9]-343485551,u=0|(u<<21|u>>>11)+v,r[0]=0|t+r[0],r[1]=0|u+r[1],r[2]=0|v+r[2],r[3]=0|w+r[3]},h=[],l=function(r){for(var u,v,w,s='0123456789abcdef',t=h,y=0;4>y;y++)for(v=8*y,u=r[y],w=0;8>w;w+=2)t[v+1+w]=s.charAt(15&u),u>>>=4,t[v+0+w]=s.charAt(15&u),u>>>=4;return t.join('')},m=function(){this._dataLength=0,this._state=new Int32Array(4),this._buffer=new ArrayBuffer(68),this._bufferLength=0,this._buffer8=new Uint8Array(this._buffer,0,68),this._buffer32=new Uint32Array(this._buffer,0,17),this.start()},o=new Int32Array([1732584193,-271733879,-1732584194,271733878]),p=new Int32Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]);m.prototype.appendStr=function(r){for(var v,s=this._buffer8,t=this._buffer32,u=this._bufferLength,w=0;w<r.length;w++){if(v=r.charCodeAt(w),128>v)s[u++]=v;else if(2048>v)s[u++]=(v>>>6)+192,s[u++]=128|63&v;else if(55296>v||56319<v)s[u++]=(v>>>12)+224,s[u++]=128|63&v>>>6,s[u++]=128|63&v;else{if(v=1024*(v-55296)+(r.charCodeAt(++w)-56320)+65536,1114111<v)throw'Unicode standard supports code points up to U+10FFFF';s[u++]=(v>>>18)+240,s[u++]=128|63&v>>>12,s[u++]=128|63&v>>>6,s[u++]=128|63&v}64<=u&&(this._dataLength+=64,f(this._state,t),u-=64,t[0]=t[16])}return this._bufferLength=u,this},m.prototype.start=function(){return this._dataLength=0,this._bufferLength=0,this._state.set(o),this},m.prototype.end=function(r){var s=this._bufferLength;this._dataLength+=s;var t=this._buffer8;t[s]=128,t[s+1]=t[s+2]=t[s+3]=0;var u=this._buffer32,v=(s>>2)+1;u.set(p.subarray(v),v),55<s&&(f(this._state,u),u.set(p));var w=8*this._dataLength;if(4294967295>=w)u[14]=w;else{var y=w.toString(16).match(/(.*?)(.{0,8})$/),z=parseInt(y[2],16),A=parseInt(y[1],16)||0;u[14]=z,u[15]=A}return f(this._state,u),r?this._state:l(this._state)};var q=new m;return function(r,s){return q.start().appendStr(r).end(s)}};

/*========
| jQuery |
=========*/

a.jQueryFactory=function(a,b){"use strict";var c=[],d=a.document,e=Object.getPrototypeOf,f=c.slice,g=c.concat,h=c.push,i=c.indexOf,j={},k=j.toString,l=j.hasOwnProperty,m=l.toString,n=m.call(Object),o={};function p(a,b){b=b||d;var c=b.createElement("script");c.text=a,b.head.appendChild(c).parentNode.removeChild(c)}var q="3.2.1",r=function(a,b){return new r.fn.init(a,b)},s=/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g,t=/^-ms-/,u=/-([a-z])/g,v=function(a,b){return b.toUpperCase()};r.fn=r.prototype={jquery:q,constructor:r,length:0,toArray:function(){return f.call(this)},get:function(a){return null==a?f.call(this):a<0?this[a+this.length]:this[a]},pushStack:function(a){var b=r.merge(this.constructor(),a);return b.prevObject=this,b},each:function(a){return r.each(this,a)},map:function(a){return this.pushStack(r.map(this,function(b,c){return a.call(b,c,b)}))},slice:function(){return this.pushStack(f.apply(this,arguments))},first:function(){return this.eq(0)},last:function(){return this.eq(-1)},eq:function(a){var b=this.length,c=+a+(a<0?b:0);return this.pushStack(c>=0&&c<b?[this[c]]:[])},end:function(){return this.prevObject||this.constructor()},push:h,sort:c.sort,splice:c.splice},r.extend=r.fn.extend=function(){var a,b,c,d,e,f,g=arguments[0]||{},h=1,i=arguments.length,j=!1;for("boolean"==typeof g&&(j=g,g=arguments[h]||{},h++),"object"==typeof g||r.isFunction(g)||(g={}),h===i&&(g=this,h--);h<i;h++)if(null!=(a=arguments[h]))for(b in a)c=g[b],d=a[b],g!==d&&(j&&d&&(r.isPlainObject(d)||(e=Array.isArray(d)))?(e?(e=!1,f=c&&Array.isArray(c)?c:[]):f=c&&r.isPlainObject(c)?c:{},g[b]=r.extend(j,f,d)):void 0!==d&&(g[b]=d));return g},r.extend({expando:"jQuery"+(q+Math.random()).replace(/\D/g,""),isReady:!0,error:function(a){throw new Error(a)},noop:function(){},isFunction:function(a){return"function"===r.type(a)},isWindow:function(a){return null!=a&&a===a.window},isNumeric:function(a){var b=r.type(a);return("number"===b||"string"===b)&&!isNaN(a-parseFloat(a))},isPlainObject:function(a){var b,c;return!(!a||"[object Object]"!==k.call(a))&&(!(b=e(a))||(c=l.call(b,"constructor")&&b.constructor,"function"==typeof c&&m.call(c)===n))},isEmptyObject:function(a){var b;for(b in a)return!1;return!0},type:function(a){return null==a?a+"":"object"==typeof a||"function"==typeof a?j[k.call(a)]||"object":typeof a},globalEval:function(a){p(a)},camelCase:function(a){return a.replace(t,"ms-").replace(u,v)},each:function(a,b){var c,d=0;if(w(a)){for(c=a.length;d<c;d++)if(b.call(a[d],d,a[d])===!1)break}else for(d in a)if(b.call(a[d],d,a[d])===!1)break;return a},trim:function(a){return null==a?"":(a+"").replace(s,"")},makeArray:function(a,b){var c=b||[];return null!=a&&(w(Object(a))?r.merge(c,"string"==typeof a?[a]:a):h.call(c,a)),c},inArray:function(a,b,c){return null==b?-1:i.call(b,a,c)},merge:function(a,b){for(var c=+b.length,d=0,e=a.length;d<c;d++)a[e++]=b[d];return a.length=e,a},grep:function(a,b,c){for(var d,e=[],f=0,g=a.length,h=!c;f<g;f++)d=!b(a[f],f),d!==h&&e.push(a[f]);return e},map:function(a,b,c){var d,e,f=0,h=[];if(w(a))for(d=a.length;f<d;f++)e=b(a[f],f,c),null!=e&&h.push(e);else for(f in a)e=b(a[f],f,c),null!=e&&h.push(e);return g.apply([],h)},guid:1,proxy:function(a,b){var c,d,e;if("string"==typeof b&&(c=a[b],b=a,a=c),r.isFunction(a))return d=f.call(arguments,2),e=function(){return a.apply(b||this,d.concat(f.call(arguments)))},e.guid=a.guid=a.guid||r.guid++,e},now:Date.now,support:o}),"function"==typeof Symbol&&(r.fn[Symbol.iterator]=c[Symbol.iterator]),r.each("Boolean Number String Function Array Date RegExp Object Error Symbol".split(" "),function(a,b){j["[object "+b+"]"]=b.toLowerCase()});function w(a){var b=!!a&&"length"in a&&a.length,c=r.type(a);return"function"!==c&&!r.isWindow(a)&&("array"===c||0===b||"number"==typeof b&&b>0&&b-1 in a)}var x=function(a){var b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u="sizzle"+1*new Date,v=a.document,w=0,x=0,y=ha(),z=ha(),A=ha(),B=function(a,b){return a===b&&(l=!0),0},C={}.hasOwnProperty,D=[],E=D.pop,F=D.push,G=D.push,H=D.slice,I=function(a,b){for(var c=0,d=a.length;c<d;c++)if(a[c]===b)return c;return-1},J="checked|selected|async|autofocus|autoplay|controls|defer|disabled|hidden|ismap|loop|multiple|open|readonly|required|scoped",K="[\\x20\\t\\r\\n\\f]",L="(?:\\\\.|[\\w-]|[^\0-\\xa0])+",M="\\["+K+"*("+L+")(?:"+K+"*([*^$|!~]?=)"+K+"*(?:'((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\"|("+L+"))|)"+K+"*\\]",N=":("+L+")(?:\\((('((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\")|((?:\\\\.|[^\\\\()[\\]]|"+M+")*)|.*)\\)|)",O=new RegExp(K+"+","g"),P=new RegExp("^"+K+"+|((?:^|[^\\\\])(?:\\\\.)*)"+K+"+$","g"),Q=new RegExp("^"+K+"*,"+K+"*"),R=new RegExp("^"+K+"*([>+~]|"+K+")"+K+"*"),S=new RegExp("="+K+"*([^\\]'\"]*?)"+K+"*\\]","g"),T=new RegExp(N),U=new RegExp("^"+L+"$"),V={ID:new RegExp("^#("+L+")"),CLASS:new RegExp("^\\.("+L+")"),TAG:new RegExp("^("+L+"|[*])"),ATTR:new RegExp("^"+M),PSEUDO:new RegExp("^"+N),CHILD:new RegExp("^:(only|first|last|nth|nth-last)-(child|of-type)(?:\\("+K+"*(even|odd|(([+-]|)(\\d*)n|)"+K+"*(?:([+-]|)"+K+"*(\\d+)|))"+K+"*\\)|)","i"),bool:new RegExp("^(?:"+J+")$","i"),needsContext:new RegExp("^"+K+"*[>+~]|:(even|odd|eq|gt|lt|nth|first|last)(?:\\("+K+"*((?:-\\d)?\\d*)"+K+"*\\)|)(?=[^-]|$)","i")},W=/^(?:input|select|textarea|button)$/i,X=/^h\d$/i,Y=/^[^{]+\{\s*\[native \w/,Z=/^(?:#([\w-]+)|(\w+)|\.([\w-]+))$/,$=/[+~]/,_=new RegExp("\\\\([\\da-f]{1,6}"+K+"?|("+K+")|.)","ig"),aa=function(a,b,c){var d="0x"+b-65536;return d!==d||c?b:d<0?String.fromCharCode(d+65536):String.fromCharCode(d>>10|55296,1023&d|56320)},ba=/([\0-\x1f\x7f]|^-?\d)|^-$|[^\0-\x1f\x7f-\uFFFF\w-]/g,ca=function(a,b){return b?"\0"===a?"\ufffd":a.slice(0,-1)+"\\"+a.charCodeAt(a.length-1).toString(16)+" ":"\\"+a},da=function(){m()},ea=ta(function(a){return a.disabled===!0&&("form"in a||"label"in a)},{dir:"parentNode",next:"legend"});try{G.apply(D=H.call(v.childNodes),v.childNodes),D[v.childNodes.length].nodeType}catch(fa){G={apply:D.length?function(a,b){F.apply(a,H.call(b))}:function(a,b){var c=a.length,d=0;while(a[c++]=b[d++]);a.length=c-1}}}function ga(a,b,d,e){var f,h,j,k,l,o,r,s=b&&b.ownerDocument,w=b?b.nodeType:9;if(d=d||[],"string"!=typeof a||!a||1!==w&&9!==w&&11!==w)return d;if(!e&&((b?b.ownerDocument||b:v)!==n&&m(b),b=b||n,p)){if(11!==w&&(l=Z.exec(a)))if(f=l[1]){if(9===w){if(!(j=b.getElementById(f)))return d;if(j.id===f)return d.push(j),d}else if(s&&(j=s.getElementById(f))&&t(b,j)&&j.id===f)return d.push(j),d}else{if(l[2])return G.apply(d,b.getElementsByTagName(a)),d;if((f=l[3])&&c.getElementsByClassName&&b.getElementsByClassName)return G.apply(d,b.getElementsByClassName(f)),d}if(c.qsa&&!A[a+" "]&&(!q||!q.test(a))){if(1!==w)s=b,r=a;else if("object"!==b.nodeName.toLowerCase()){(k=b.getAttribute("id"))?k=k.replace(ba,ca):b.setAttribute("id",k=u),o=g(a),h=o.length;while(h--)o[h]="#"+k+" "+sa(o[h]);r=o.join(","),s=$.test(a)&&qa(b.parentNode)||b}if(r)try{return G.apply(d,s.querySelectorAll(r)),d}catch(x){}finally{k===u&&b.removeAttribute("id")}}}return i(a.replace(P,"$1"),b,d,e)}function ha(){var a=[];function b(c,e){return a.push(c+" ")>d.cacheLength&&delete b[a.shift()],b[c+" "]=e}return b}function ia(a){return a[u]=!0,a}function ja(a){var b=n.createElement("fieldset");try{return!!a(b)}catch(c){return!1}finally{b.parentNode&&b.parentNode.removeChild(b),b=null}}function ka(a,b){var c=a.split("|"),e=c.length;while(e--)d.attrHandle[c[e]]=b}function la(a,b){var c=b&&a,d=c&&1===a.nodeType&&1===b.nodeType&&a.sourceIndex-b.sourceIndex;if(d)return d;if(c)while(c=c.nextSibling)if(c===b)return-1;return a?1:-1}function ma(a){return function(b){var c=b.nodeName.toLowerCase();return"input"===c&&b.type===a}}function na(a){return function(b){var c=b.nodeName.toLowerCase();return("input"===c||"button"===c)&&b.type===a}}function oa(a){return function(b){return"form"in b?b.parentNode&&b.disabled===!1?"label"in b?"label"in b.parentNode?b.parentNode.disabled===a:b.disabled===a:b.isDisabled===a||b.isDisabled!==!a&&ea(b)===a:b.disabled===a:"label"in b&&b.disabled===a}}function pa(a){return ia(function(b){return b=+b,ia(function(c,d){var e,f=a([],c.length,b),g=f.length;while(g--)c[e=f[g]]&&(c[e]=!(d[e]=c[e]))})})}function qa(a){return a&&"undefined"!=typeof a.getElementsByTagName&&a}c=ga.support={},f=ga.isXML=function(a){var b=a&&(a.ownerDocument||a).documentElement;return!!b&&"HTML"!==b.nodeName},m=ga.setDocument=function(a){var b,e,g=a?a.ownerDocument||a:v;return g!==n&&9===g.nodeType&&g.documentElement?(n=g,o=n.documentElement,p=!f(n),v!==n&&(e=n.defaultView)&&e.top!==e&&(e.addEventListener?e.addEventListener("unload",da,!1):e.attachEvent&&e.attachEvent("onunload",da)),c.attributes=ja(function(a){return a.className="i",!a.getAttribute("className")}),c.getElementsByTagName=ja(function(a){return a.appendChild(n.createComment("")),!a.getElementsByTagName("*").length}),c.getElementsByClassName=Y.test(n.getElementsByClassName),c.getById=ja(function(a){return o.appendChild(a).id=u,!n.getElementsByName||!n.getElementsByName(u).length}),c.getById?(d.filter.ID=function(a){var b=a.replace(_,aa);return function(a){return a.getAttribute("id")===b}},d.find.ID=function(a,b){if("undefined"!=typeof b.getElementById&&p){var c=b.getElementById(a);return c?[c]:[]}}):(d.filter.ID=function(a){var b=a.replace(_,aa);return function(a){var c="undefined"!=typeof a.getAttributeNode&&a.getAttributeNode("id");return c&&c.value===b}},d.find.ID=function(a,b){if("undefined"!=typeof b.getElementById&&p){var c,d,e,f=b.getElementById(a);if(f){if(c=f.getAttributeNode("id"),c&&c.value===a)return[f];e=b.getElementsByName(a),d=0;while(f=e[d++])if(c=f.getAttributeNode("id"),c&&c.value===a)return[f]}return[]}}),d.find.TAG=c.getElementsByTagName?function(a,b){return"undefined"!=typeof b.getElementsByTagName?b.getElementsByTagName(a):c.qsa?b.querySelectorAll(a):void 0}:function(a,b){var c,d=[],e=0,f=b.getElementsByTagName(a);if("*"===a){while(c=f[e++])1===c.nodeType&&d.push(c);return d}return f},d.find.CLASS=c.getElementsByClassName&&function(a,b){if("undefined"!=typeof b.getElementsByClassName&&p)return b.getElementsByClassName(a)},r=[],q=[],(c.qsa=Y.test(n.querySelectorAll))&&(ja(function(a){o.appendChild(a).innerHTML="<a id='"+u+"'></a><select id='"+u+"-\r\\' msallowcapture=''><option selected=''></option></select>",a.querySelectorAll("[msallowcapture^='']").length&&q.push("[*^$]="+K+"*(?:''|\"\")"),a.querySelectorAll("[selected]").length||q.push("\\["+K+"*(?:value|"+J+")"),a.querySelectorAll("[id~="+u+"-]").length||q.push("~="),a.querySelectorAll(":checked").length||q.push(":checked"),a.querySelectorAll("a#"+u+"+*").length||q.push(".#.+[+~]")}),ja(function(a){a.innerHTML="<a href='' disabled='disabled'></a><select disabled='disabled'><option/></select>";var b=n.createElement("input");b.setAttribute("type","hidden"),a.appendChild(b).setAttribute("name","D"),a.querySelectorAll("[name=d]").length&&q.push("name"+K+"*[*^$|!~]?="),2!==a.querySelectorAll(":enabled").length&&q.push(":enabled",":disabled"),o.appendChild(a).disabled=!0,2!==a.querySelectorAll(":disabled").length&&q.push(":enabled",":disabled"),a.querySelectorAll("*,:x"),q.push(",.*:")})),(c.matchesSelector=Y.test(s=o.matches||o.webkitMatchesSelector||o.mozMatchesSelector||o.oMatchesSelector||o.msMatchesSelector))&&ja(function(a){c.disconnectedMatch=s.call(a,"*"),s.call(a,"[s!='']:x"),r.push("!=",N)}),q=q.length&&new RegExp(q.join("|")),r=r.length&&new RegExp(r.join("|")),b=Y.test(o.compareDocumentPosition),t=b||Y.test(o.contains)?function(a,b){var c=9===a.nodeType?a.documentElement:a,d=b&&b.parentNode;return a===d||!(!d||1!==d.nodeType||!(c.contains?c.contains(d):a.compareDocumentPosition&&16&a.compareDocumentPosition(d)))}:function(a,b){if(b)while(b=b.parentNode)if(b===a)return!0;return!1},B=b?function(a,b){if(a===b)return l=!0,0;var d=!a.compareDocumentPosition-!b.compareDocumentPosition;return d?d:(d=(a.ownerDocument||a)===(b.ownerDocument||b)?a.compareDocumentPosition(b):1,1&d||!c.sortDetached&&b.compareDocumentPosition(a)===d?a===n||a.ownerDocument===v&&t(v,a)?-1:b===n||b.ownerDocument===v&&t(v,b)?1:k?I(k,a)-I(k,b):0:4&d?-1:1)}:function(a,b){if(a===b)return l=!0,0;var c,d=0,e=a.parentNode,f=b.parentNode,g=[a],h=[b];if(!e||!f)return a===n?-1:b===n?1:e?-1:f?1:k?I(k,a)-I(k,b):0;if(e===f)return la(a,b);c=a;while(c=c.parentNode)g.unshift(c);c=b;while(c=c.parentNode)h.unshift(c);while(g[d]===h[d])d++;return d?la(g[d],h[d]):g[d]===v?-1:h[d]===v?1:0},n):n},ga.matches=function(a,b){return ga(a,null,null,b)},ga.matchesSelector=function(a,b){if((a.ownerDocument||a)!==n&&m(a),b=b.replace(S,"='$1']"),c.matchesSelector&&p&&!A[b+" "]&&(!r||!r.test(b))&&(!q||!q.test(b)))try{var d=s.call(a,b);if(d||c.disconnectedMatch||a.document&&11!==a.document.nodeType)return d}catch(e){}return ga(b,n,null,[a]).length>0},ga.contains=function(a,b){return(a.ownerDocument||a)!==n&&m(a),t(a,b)},ga.attr=function(a,b){(a.ownerDocument||a)!==n&&m(a);var e=d.attrHandle[b.toLowerCase()],f=e&&C.call(d.attrHandle,b.toLowerCase())?e(a,b,!p):void 0;return void 0!==f?f:c.attributes||!p?a.getAttribute(b):(f=a.getAttributeNode(b))&&f.specified?f.value:null},ga.escape=function(a){return(a+"").replace(ba,ca)},ga.error=function(a){throw new Error("Syntax error, unrecognized expression: "+a)},ga.uniqueSort=function(a){var b,d=[],e=0,f=0;if(l=!c.detectDuplicates,k=!c.sortStable&&a.slice(0),a.sort(B),l){while(b=a[f++])b===a[f]&&(e=d.push(f));while(e--)a.splice(d[e],1)}return k=null,a},e=ga.getText=function(a){var b,c="",d=0,f=a.nodeType;if(f){if(1===f||9===f||11===f){if("string"==typeof a.textContent)return a.textContent;for(a=a.firstChild;a;a=a.nextSibling)c+=e(a)}else if(3===f||4===f)return a.nodeValue}else while(b=a[d++])c+=e(b);return c},d=ga.selectors={cacheLength:50,createPseudo:ia,match:V,attrHandle:{},find:{},relative:{">":{dir:"parentNode",first:!0}," ":{dir:"parentNode"},"+":{dir:"previousSibling",first:!0},"~":{dir:"previousSibling"}},preFilter:{ATTR:function(a){return a[1]=a[1].replace(_,aa),a[3]=(a[3]||a[4]||a[5]||"").replace(_,aa),"~="===a[2]&&(a[3]=" "+a[3]+" "),a.slice(0,4)},CHILD:function(a){return a[1]=a[1].toLowerCase(),"nth"===a[1].slice(0,3)?(a[3]||ga.error(a[0]),a[4]=+(a[4]?a[5]+(a[6]||1):2*("even"===a[3]||"odd"===a[3])),a[5]=+(a[7]+a[8]||"odd"===a[3])):a[3]&&ga.error(a[0]),a},PSEUDO:function(a){var b,c=!a[6]&&a[2];return V.CHILD.test(a[0])?null:(a[3]?a[2]=a[4]||a[5]||"":c&&T.test(c)&&(b=g(c,!0))&&(b=c.indexOf(")",c.length-b)-c.length)&&(a[0]=a[0].slice(0,b),a[2]=c.slice(0,b)),a.slice(0,3))}},filter:{TAG:function(a){var b=a.replace(_,aa).toLowerCase();return"*"===a?function(){return!0}:function(a){return a.nodeName&&a.nodeName.toLowerCase()===b}},CLASS:function(a){var b=y[a+" "];return b||(b=new RegExp("(^|"+K+")"+a+"("+K+"|$)"))&&y(a,function(a){return b.test("string"==typeof a.className&&a.className||"undefined"!=typeof a.getAttribute&&a.getAttribute("class")||"")})},ATTR:function(a,b,c){return function(d){var e=ga.attr(d,a);return null==e?"!="===b:!b||(e+="","="===b?e===c:"!="===b?e!==c:"^="===b?c&&0===e.indexOf(c):"*="===b?c&&e.indexOf(c)>-1:"$="===b?c&&e.slice(-c.length)===c:"~="===b?(" "+e.replace(O," ")+" ").indexOf(c)>-1:"|="===b&&(e===c||e.slice(0,c.length+1)===c+"-"))}},CHILD:function(a,b,c,d,e){var f="nth"!==a.slice(0,3),g="last"!==a.slice(-4),h="of-type"===b;return 1===d&&0===e?function(a){return!!a.parentNode}:function(b,c,i){var j,k,l,m,n,o,p=f!==g?"nextSibling":"previousSibling",q=b.parentNode,r=h&&b.nodeName.toLowerCase(),s=!i&&!h,t=!1;if(q){if(f){while(p){m=b;while(m=m[p])if(h?m.nodeName.toLowerCase()===r:1===m.nodeType)return!1;o=p="only"===a&&!o&&"nextSibling"}return!0}if(o=[g?q.firstChild:q.lastChild],g&&s){m=q,l=m[u]||(m[u]={}),k=l[m.uniqueID]||(l[m.uniqueID]={}),j=k[a]||[],n=j[0]===w&&j[1],t=n&&j[2],m=n&&q.childNodes[n];while(m=++n&&m&&m[p]||(t=n=0)||o.pop())if(1===m.nodeType&&++t&&m===b){k[a]=[w,n,t];break}}else if(s&&(m=b,l=m[u]||(m[u]={}),k=l[m.uniqueID]||(l[m.uniqueID]={}),j=k[a]||[],n=j[0]===w&&j[1],t=n),t===!1)while(m=++n&&m&&m[p]||(t=n=0)||o.pop())if((h?m.nodeName.toLowerCase()===r:1===m.nodeType)&&++t&&(s&&(l=m[u]||(m[u]={}),k=l[m.uniqueID]||(l[m.uniqueID]={}),k[a]=[w,t]),m===b))break;return t-=e,t===d||t%d===0&&t/d>=0}}},PSEUDO:function(a,b){var c,e=d.pseudos[a]||d.setFilters[a.toLowerCase()]||ga.error("unsupported pseudo: "+a);return e[u]?e(b):e.length>1?(c=[a,a,"",b],d.setFilters.hasOwnProperty(a.toLowerCase())?ia(function(a,c){var d,f=e(a,b),g=f.length;while(g--)d=I(a,f[g]),a[d]=!(c[d]=f[g])}):function(a){return e(a,0,c)}):e}},pseudos:{not:ia(function(a){var b=[],c=[],d=h(a.replace(P,"$1"));return d[u]?ia(function(a,b,c,e){var f,g=d(a,null,e,[]),h=a.length;while(h--)(f=g[h])&&(a[h]=!(b[h]=f))}):function(a,e,f){return b[0]=a,d(b,null,f,c),b[0]=null,!c.pop()}}),has:ia(function(a){return function(b){return ga(a,b).length>0}}),contains:ia(function(a){return a=a.replace(_,aa),function(b){return(b.textContent||b.innerText||e(b)).indexOf(a)>-1}}),lang:ia(function(a){return U.test(a||"")||ga.error("unsupported lang: "+a),a=a.replace(_,aa).toLowerCase(),function(b){var c;do if(c=p?b.lang:b.getAttribute("xml:lang")||b.getAttribute("lang"))return c=c.toLowerCase(),c===a||0===c.indexOf(a+"-");while((b=b.parentNode)&&1===b.nodeType);return!1}}),target:function(b){var c=a.location&&a.location.hash;return c&&c.slice(1)===b.id},root:function(a){return a===o},focus:function(a){return a===n.activeElement&&(!n.hasFocus||n.hasFocus())&&!!(a.type||a.href||~a.tabIndex)},enabled:oa(!1),disabled:oa(!0),checked:function(a){var b=a.nodeName.toLowerCase();return"input"===b&&!!a.checked||"option"===b&&!!a.selected},selected:function(a){return a.parentNode&&a.parentNode.selectedIndex,a.selected===!0},empty:function(a){for(a=a.firstChild;a;a=a.nextSibling)if(a.nodeType<6)return!1;return!0},parent:function(a){return!d.pseudos.empty(a)},header:function(a){return X.test(a.nodeName)},input:function(a){return W.test(a.nodeName)},button:function(a){var b=a.nodeName.toLowerCase();return"input"===b&&"button"===a.type||"button"===b},text:function(a){var b;return"input"===a.nodeName.toLowerCase()&&"text"===a.type&&(null==(b=a.getAttribute("type"))||"text"===b.toLowerCase())},first:pa(function(){return[0]}),last:pa(function(a,b){return[b-1]}),eq:pa(function(a,b,c){return[c<0?c+b:c]}),even:pa(function(a,b){for(var c=0;c<b;c+=2)a.push(c);return a}),odd:pa(function(a,b){for(var c=1;c<b;c+=2)a.push(c);return a}),lt:pa(function(a,b,c){for(var d=c<0?c+b:c;--d>=0;)a.push(d);return a}),gt:pa(function(a,b,c){for(var d=c<0?c+b:c;++d<b;)a.push(d);return a})}},d.pseudos.nth=d.pseudos.eq;for(b in{radio:!0,checkbox:!0,file:!0,password:!0,image:!0})d.pseudos[b]=ma(b);for(b in{submit:!0,reset:!0})d.pseudos[b]=na(b);function ra(){}ra.prototype=d.filters=d.pseudos,d.setFilters=new ra,g=ga.tokenize=function(a,b){var c,e,f,g,h,i,j,k=z[a+" "];if(k)return b?0:k.slice(0);h=a,i=[],j=d.preFilter;while(h){c&&!(e=Q.exec(h))||(e&&(h=h.slice(e[0].length)||h),i.push(f=[])),c=!1,(e=R.exec(h))&&(c=e.shift(),f.push({value:c,type:e[0].replace(P," ")}),h=h.slice(c.length));for(g in d.filter)!(e=V[g].exec(h))||j[g]&&!(e=j[g](e))||(c=e.shift(),f.push({value:c,type:g,matches:e}),h=h.slice(c.length));if(!c)break}return b?h.length:h?ga.error(a):z(a,i).slice(0)};function sa(a){for(var b=0,c=a.length,d="";b<c;b++)d+=a[b].value;return d}function ta(a,b,c){var d=b.dir,e=b.next,f=e||d,g=c&&"parentNode"===f,h=x++;return b.first?function(b,c,e){while(b=b[d])if(1===b.nodeType||g)return a(b,c,e);return!1}:function(b,c,i){var j,k,l,m=[w,h];if(i){while(b=b[d])if((1===b.nodeType||g)&&a(b,c,i))return!0}else while(b=b[d])if(1===b.nodeType||g)if(l=b[u]||(b[u]={}),k=l[b.uniqueID]||(l[b.uniqueID]={}),e&&e===b.nodeName.toLowerCase())b=b[d]||b;else{if((j=k[f])&&j[0]===w&&j[1]===h)return m[2]=j[2];if(k[f]=m,m[2]=a(b,c,i))return!0}return!1}}function ua(a){return a.length>1?function(b,c,d){var e=a.length;while(e--)if(!a[e](b,c,d))return!1;return!0}:a[0]}function va(a,b,c){for(var d=0,e=b.length;d<e;d++)ga(a,b[d],c);return c}function wa(a,b,c,d,e){for(var f,g=[],h=0,i=a.length,j=null!=b;h<i;h++)(f=a[h])&&(c&&!c(f,d,e)||(g.push(f),j&&b.push(h)));return g}function xa(a,b,c,d,e,f){return d&&!d[u]&&(d=xa(d)),e&&!e[u]&&(e=xa(e,f)),ia(function(f,g,h,i){var j,k,l,m=[],n=[],o=g.length,p=f||va(b||"*",h.nodeType?[h]:h,[]),q=!a||!f&&b?p:wa(p,m,a,h,i),r=c?e||(f?a:o||d)?[]:g:q;if(c&&c(q,r,h,i),d){j=wa(r,n),d(j,[],h,i),k=j.length;while(k--)(l=j[k])&&(r[n[k]]=!(q[n[k]]=l))}if(f){if(e||a){if(e){j=[],k=r.length;while(k--)(l=r[k])&&j.push(q[k]=l);e(null,r=[],j,i)}k=r.length;while(k--)(l=r[k])&&(j=e?I(f,l):m[k])>-1&&(f[j]=!(g[j]=l))}}else r=wa(r===g?r.splice(o,r.length):r),e?e(null,g,r,i):G.apply(g,r)})}function ya(a){for(var b,c,e,f=a.length,g=d.relative[a[0].type],h=g||d.relative[" "],i=g?1:0,k=ta(function(a){return a===b},h,!0),l=ta(function(a){return I(b,a)>-1},h,!0),m=[function(a,c,d){var e=!g&&(d||c!==j)||((b=c).nodeType?k(a,c,d):l(a,c,d));return b=null,e}];i<f;i++)if(c=d.relative[a[i].type])m=[ta(ua(m),c)];else{if(c=d.filter[a[i].type].apply(null,a[i].matches),c[u]){for(e=++i;e<f;e++)if(d.relative[a[e].type])break;return xa(i>1&&ua(m),i>1&&sa(a.slice(0,i-1).concat({value:" "===a[i-2].type?"*":""})).replace(P,"$1"),c,i<e&&ya(a.slice(i,e)),e<f&&ya(a=a.slice(e)),e<f&&sa(a))}m.push(c)}return ua(m)}function za(a,b){var c=b.length>0,e=a.length>0,f=function(f,g,h,i,k){var l,o,q,r=0,s="0",t=f&&[],u=[],v=j,x=f||e&&d.find.TAG("*",k),y=w+=null==v?1:Math.random()||.1,z=x.length;for(k&&(j=g===n||g||k);s!==z&&null!=(l=x[s]);s++){if(e&&l){o=0,g||l.ownerDocument===n||(m(l),h=!p);while(q=a[o++])if(q(l,g||n,h)){i.push(l);break}k&&(w=y)}c&&((l=!q&&l)&&r--,f&&t.push(l))}if(r+=s,c&&s!==r){o=0;while(q=b[o++])q(t,u,g,h);if(f){if(r>0)while(s--)t[s]||u[s]||(u[s]=E.call(i));u=wa(u)}G.apply(i,u),k&&!f&&u.length>0&&r+b.length>1&&ga.uniqueSort(i)}return k&&(w=y,j=v),t};return c?ia(f):f}return h=ga.compile=function(a,b){var c,d=[],e=[],f=A[a+" "];if(!f){b||(b=g(a)),c=b.length;while(c--)f=ya(b[c]),f[u]?d.push(f):e.push(f);f=A(a,za(e,d)),f.selector=a}return f},i=ga.select=function(a,b,c,e){var f,i,j,k,l,m="function"==typeof a&&a,n=!e&&g(a=m.selector||a);if(c=c||[],1===n.length){if(i=n[0]=n[0].slice(0),i.length>2&&"ID"===(j=i[0]).type&&9===b.nodeType&&p&&d.relative[i[1].type]){if(b=(d.find.ID(j.matches[0].replace(_,aa),b)||[])[0],!b)return c;m&&(b=b.parentNode),a=a.slice(i.shift().value.length)}f=V.needsContext.test(a)?0:i.length;while(f--){if(j=i[f],d.relative[k=j.type])break;if((l=d.find[k])&&(e=l(j.matches[0].replace(_,aa),$.test(i[0].type)&&qa(b.parentNode)||b))){if(i.splice(f,1),a=e.length&&sa(i),!a)return G.apply(c,e),c;break}}}return(m||h(a,n))(e,b,!p,c,!b||$.test(a)&&qa(b.parentNode)||b),c},c.sortStable=u.split("").sort(B).join("")===u,c.detectDuplicates=!!l,m(),c.sortDetached=ja(function(a){return 1&a.compareDocumentPosition(n.createElement("fieldset"))}),ja(function(a){return a.innerHTML="<a href='#'></a>","#"===a.firstChild.getAttribute("href")})||ka("type|href|height|width",function(a,b,c){if(!c)return a.getAttribute(b,"type"===b.toLowerCase()?1:2)}),c.attributes&&ja(function(a){return a.innerHTML="<input/>",a.firstChild.setAttribute("value",""),""===a.firstChild.getAttribute("value")})||ka("value",function(a,b,c){if(!c&&"input"===a.nodeName.toLowerCase())return a.defaultValue}),ja(function(a){return null==a.getAttribute("disabled")})||ka(J,function(a,b,c){var d;if(!c)return a[b]===!0?b.toLowerCase():(d=a.getAttributeNode(b))&&d.specified?d.value:null}),ga}(a);r.find=x,r.expr=x.selectors,r.expr[":"]=r.expr.pseudos,r.uniqueSort=r.unique=x.uniqueSort,r.text=x.getText,r.isXMLDoc=x.isXML,r.contains=x.contains,r.escapeSelector=x.escape;var y=function(a,b,c){var d=[],e=void 0!==c;while((a=a[b])&&9!==a.nodeType)if(1===a.nodeType){if(e&&r(a).is(c))break;d.push(a)}return d},z=function(a,b){for(var c=[];a;a=a.nextSibling)1===a.nodeType&&a!==b&&c.push(a);return c},A=r.expr.match.needsContext;function B(a,b){return a.nodeName&&a.nodeName.toLowerCase()===b.toLowerCase()}var C=/^<([a-z][^\/\0>:\x20\t\r\n\f]*)[\x20\t\r\n\f]*\/?>(?:<\/\1>|)$/i,D=/^.[^:#\[\.,]*$/;function E(a,b,c){return r.isFunction(b)?r.grep(a,function(a,d){return!!b.call(a,d,a)!==c}):b.nodeType?r.grep(a,function(a){return a===b!==c}):"string"!=typeof b?r.grep(a,function(a){return i.call(b,a)>-1!==c}):D.test(b)?r.filter(b,a,c):(b=r.filter(b,a),r.grep(a,function(a){return i.call(b,a)>-1!==c&&1===a.nodeType}))}r.filter=function(a,b,c){var d=b[0];return c&&(a=":not("+a+")"),1===b.length&&1===d.nodeType?r.find.matchesSelector(d,a)?[d]:[]:r.find.matches(a,r.grep(b,function(a){return 1===a.nodeType}))},r.fn.extend({find:function(a){var b,c,d=this.length,e=this;if("string"!=typeof a)return this.pushStack(r(a).filter(function(){for(b=0;b<d;b++)if(r.contains(e[b],this))return!0}));for(c=this.pushStack([]),b=0;b<d;b++)r.find(a,e[b],c);return d>1?r.uniqueSort(c):c},filter:function(a){return this.pushStack(E(this,a||[],!1))},not:function(a){return this.pushStack(E(this,a||[],!0))},is:function(a){return!!E(this,"string"==typeof a&&A.test(a)?r(a):a||[],!1).length}});var F,G=/^(?:\s*(<[\w\W]+>)[^>]*|#([\w-]+))$/,H=r.fn.init=function(a,b,c){var e,f;if(!a)return this;if(c=c||F,"string"==typeof a){if(e="<"===a[0]&&">"===a[a.length-1]&&a.length>=3?[null,a,null]:G.exec(a),!e||!e[1]&&b)return!b||b.jquery?(b||c).find(a):this.constructor(b).find(a);if(e[1]){if(b=b instanceof r?b[0]:b,r.merge(this,r.parseHTML(e[1],b&&b.nodeType?b.ownerDocument||b:d,!0)),C.test(e[1])&&r.isPlainObject(b))for(e in b)r.isFunction(this[e])?this[e](b[e]):this.attr(e,b[e]);return this}return f=d.getElementById(e[2]),f&&(this[0]=f,this.length=1),this}return a.nodeType?(this[0]=a,this.length=1,this):r.isFunction(a)?void 0!==c.ready?c.ready(a):a(r):r.makeArray(a,this)};H.prototype=r.fn,F=r(d);var I=/^(?:parents|prev(?:Until|All))/,J={children:!0,contents:!0,next:!0,prev:!0};r.fn.extend({has:function(a){var b=r(a,this),c=b.length;return this.filter(function(){for(var a=0;a<c;a++)if(r.contains(this,b[a]))return!0})},closest:function(a,b){var c,d=0,e=this.length,f=[],g="string"!=typeof a&&r(a);if(!A.test(a))for(;d<e;d++)for(c=this[d];c&&c!==b;c=c.parentNode)if(c.nodeType<11&&(g?g.index(c)>-1:1===c.nodeType&&r.find.matchesSelector(c,a))){f.push(c);break}return this.pushStack(f.length>1?r.uniqueSort(f):f)},index:function(a){return a?"string"==typeof a?i.call(r(a),this[0]):i.call(this,a.jquery?a[0]:a):this[0]&&this[0].parentNode?this.first().prevAll().length:-1},add:function(a,b){return this.pushStack(r.uniqueSort(r.merge(this.get(),r(a,b))))},addBack:function(a){return this.add(null==a?this.prevObject:this.prevObject.filter(a))}});function K(a,b){while((a=a[b])&&1!==a.nodeType);return a}r.each({parent:function(a){var b=a.parentNode;return b&&11!==b.nodeType?b:null},parents:function(a){return y(a,"parentNode")},parentsUntil:function(a,b,c){return y(a,"parentNode",c)},next:function(a){return K(a,"nextSibling")},prev:function(a){return K(a,"previousSibling")},nextAll:function(a){return y(a,"nextSibling")},prevAll:function(a){return y(a,"previousSibling")},nextUntil:function(a,b,c){return y(a,"nextSibling",c)},prevUntil:function(a,b,c){return y(a,"previousSibling",c)},siblings:function(a){return z((a.parentNode||{}).firstChild,a)},children:function(a){return z(a.firstChild)},contents:function(a){return B(a,"iframe")?a.contentDocument:(B(a,"template")&&(a=a.content||a),r.merge([],a.childNodes))}},function(a,b){r.fn[a]=function(c,d){var e=r.map(this,b,c);return"Until"!==a.slice(-5)&&(d=c),d&&"string"==typeof d&&(e=r.filter(d,e)),this.length>1&&(J[a]||r.uniqueSort(e),I.test(a)&&e.reverse()),this.pushStack(e)}});var L=/[^\x20\t\r\n\f]+/g;function M(a){var b={};return r.each(a.match(L)||[],function(a,c){b[c]=!0}),b}r.Callbacks=function(a){a="string"==typeof a?M(a):r.extend({},a);var b,c,d,e,f=[],g=[],h=-1,i=function(){for(e=e||a.once,d=b=!0;g.length;h=-1){c=g.shift();while(++h<f.length)f[h].apply(c[0],c[1])===!1&&a.stopOnFalse&&(h=f.length,c=!1)}a.memory||(c=!1),b=!1,e&&(f=c?[]:"")},j={add:function(){return f&&(c&&!b&&(h=f.length-1,g.push(c)),function d(b){r.each(b,function(b,c){r.isFunction(c)?a.unique&&j.has(c)||f.push(c):c&&c.length&&"string"!==r.type(c)&&d(c)})}(arguments),c&&!b&&i()),this},remove:function(){return r.each(arguments,function(a,b){var c;while((c=r.inArray(b,f,c))>-1)f.splice(c,1),c<=h&&h--}),this},has:function(a){return a?r.inArray(a,f)>-1:f.length>0},empty:function(){return f&&(f=[]),this},disable:function(){return e=g=[],f=c="",this},disabled:function(){return!f},lock:function(){return e=g=[],c||b||(f=c=""),this},locked:function(){return!!e},fireWith:function(a,c){return e||(c=c||[],c=[a,c.slice?c.slice():c],g.push(c),b||i()),this},fire:function(){return j.fireWith(this,arguments),this},fired:function(){return!!d}};return j};function N(a){return a}function O(a){throw a}function P(a,b,c,d){var e;try{a&&r.isFunction(e=a.promise)?e.call(a).done(b).fail(c):a&&r.isFunction(e=a.then)?e.call(a,b,c):b.apply(void 0,[a].slice(d))}catch(a){c.apply(void 0,[a])}}r.extend({Deferred:function(b){var c=[["notify","progress",r.Callbacks("memory"),r.Callbacks("memory"),2],["resolve","done",r.Callbacks("once memory"),r.Callbacks("once memory"),0,"resolved"],["reject","fail",r.Callbacks("once memory"),r.Callbacks("once memory"),1,"rejected"]],d="pending",e={state:function(){return d},always:function(){return f.done(arguments).fail(arguments),this},"catch":function(a){return e.then(null,a)},pipe:function(){var a=arguments;return r.Deferred(function(b){r.each(c,function(c,d){var e=r.isFunction(a[d[4]])&&a[d[4]];f[d[1]](function(){var a=e&&e.apply(this,arguments);a&&r.isFunction(a.promise)?a.promise().progress(b.notify).done(b.resolve).fail(b.reject):b[d[0]+"With"](this,e?[a]:arguments)})}),a=null}).promise()},then:function(b,d,e){var f=0;function g(b,c,d,e){return function(){var h=this,i=arguments,j=function(){var a,j;if(!(b<f)){if(a=d.apply(h,i),a===c.promise())throw new TypeError("Thenable self-resolution");j=a&&("object"==typeof a||"function"==typeof a)&&a.then,r.isFunction(j)?e?j.call(a,g(f,c,N,e),g(f,c,O,e)):(f++,j.call(a,g(f,c,N,e),g(f,c,O,e),g(f,c,N,c.notifyWith))):(d!==N&&(h=void 0,i=[a]),(e||c.resolveWith)(h,i))}},k=e?j:function(){try{j()}catch(a){r.Deferred.exceptionHook&&r.Deferred.exceptionHook(a,k.stackTrace),b+1>=f&&(d!==O&&(h=void 0,i=[a]),c.rejectWith(h,i))}};b?k():(r.Deferred.getStackHook&&(k.stackTrace=r.Deferred.getStackHook()),a.setTimeout(k))}}return r.Deferred(function(a){c[0][3].add(g(0,a,r.isFunction(e)?e:N,a.notifyWith)),c[1][3].add(g(0,a,r.isFunction(b)?b:N)),c[2][3].add(g(0,a,r.isFunction(d)?d:O))}).promise()},promise:function(a){return null!=a?r.extend(a,e):e}},f={};return r.each(c,function(a,b){var g=b[2],h=b[5];e[b[1]]=g.add,h&&g.add(function(){d=h},c[3-a][2].disable,c[0][2].lock),g.add(b[3].fire),f[b[0]]=function(){return f[b[0]+"With"](this===f?void 0:this,arguments),this},f[b[0]+"With"]=g.fireWith}),e.promise(f),b&&b.call(f,f),f},when:function(a){var b=arguments.length,c=b,d=Array(c),e=f.call(arguments),g=r.Deferred(),h=function(a){return function(c){d[a]=this,e[a]=arguments.length>1?f.call(arguments):c,--b||g.resolveWith(d,e)}};if(b<=1&&(P(a,g.done(h(c)).resolve,g.reject,!b),"pending"===g.state()||r.isFunction(e[c]&&e[c].then)))return g.then();while(c--)P(e[c],h(c),g.reject);return g.promise()}});var Q=/^(Eval|Internal|Range|Reference|Syntax|Type|URI)Error$/;r.Deferred.exceptionHook=function(b,c){a.console&&a.console.warn&&b&&Q.test(b.name)&&a.console.warn("jQuery.Deferred exception: "+b.message,b.stack,c)},r.readyException=function(b){a.setTimeout(function(){throw b})};var R=r.Deferred();r.fn.ready=function(a){return R.then(a)["catch"](function(a){r.readyException(a)}),this},r.extend({isReady:!1,readyWait:1,ready:function(a){(a===!0?--r.readyWait:r.isReady)||(r.isReady=!0,a!==!0&&--r.readyWait>0||R.resolveWith(d,[r]))}}),r.ready.then=R.then;function S(){d.removeEventListener("DOMContentLoaded",S),
a.removeEventListener("load",S),r.ready()}"complete"===d.readyState||"loading"!==d.readyState&&!d.documentElement.doScroll?a.setTimeout(r.ready):(d.addEventListener("DOMContentLoaded",S),a.addEventListener("load",S));var T=function(a,b,c,d,e,f,g){var h=0,i=a.length,j=null==c;if("object"===r.type(c)){e=!0;for(h in c)T(a,b,h,c[h],!0,f,g)}else if(void 0!==d&&(e=!0,r.isFunction(d)||(g=!0),j&&(g?(b.call(a,d),b=null):(j=b,b=function(a,b,c){return j.call(r(a),c)})),b))for(;h<i;h++)b(a[h],c,g?d:d.call(a[h],h,b(a[h],c)));return e?a:j?b.call(a):i?b(a[0],c):f},U=function(a){return 1===a.nodeType||9===a.nodeType||!+a.nodeType};function V(){this.expando=r.expando+V.uid++}V.uid=1,V.prototype={cache:function(a){var b=a[this.expando];return b||(b={},U(a)&&(a.nodeType?a[this.expando]=b:Object.defineProperty(a,this.expando,{value:b,configurable:!0}))),b},set:function(a,b,c){var d,e=this.cache(a);if("string"==typeof b)e[r.camelCase(b)]=c;else for(d in b)e[r.camelCase(d)]=b[d];return e},get:function(a,b){return void 0===b?this.cache(a):a[this.expando]&&a[this.expando][r.camelCase(b)]},access:function(a,b,c){return void 0===b||b&&"string"==typeof b&&void 0===c?this.get(a,b):(this.set(a,b,c),void 0!==c?c:b)},remove:function(a,b){var c,d=a[this.expando];if(void 0!==d){if(void 0!==b){Array.isArray(b)?b=b.map(r.camelCase):(b=r.camelCase(b),b=b in d?[b]:b.match(L)||[]),c=b.length;while(c--)delete d[b[c]]}(void 0===b||r.isEmptyObject(d))&&(a.nodeType?a[this.expando]=void 0:delete a[this.expando])}},hasData:function(a){var b=a[this.expando];return void 0!==b&&!r.isEmptyObject(b)}};var W=new V,X=new V,Y=/^(?:\{[\w\W]*\}|\[[\w\W]*\])$/,Z=/[A-Z]/g;function $(a){return"true"===a||"false"!==a&&("null"===a?null:a===+a+""?+a:Y.test(a)?JSON.parse(a):a)}function _(a,b,c){var d;if(void 0===c&&1===a.nodeType)if(d="data-"+b.replace(Z,"-$&").toLowerCase(),c=a.getAttribute(d),"string"==typeof c){try{c=$(c)}catch(e){}X.set(a,b,c)}else c=void 0;return c}r.extend({hasData:function(a){return X.hasData(a)||W.hasData(a)},data:function(a,b,c){return X.access(a,b,c)},removeData:function(a,b){X.remove(a,b)},_data:function(a,b,c){return W.access(a,b,c)},_removeData:function(a,b){W.remove(a,b)}}),r.fn.extend({data:function(a,b){var c,d,e,f=this[0],g=f&&f.attributes;if(void 0===a){if(this.length&&(e=X.get(f),1===f.nodeType&&!W.get(f,"hasDataAttrs"))){c=g.length;while(c--)g[c]&&(d=g[c].name,0===d.indexOf("data-")&&(d=r.camelCase(d.slice(5)),_(f,d,e[d])));W.set(f,"hasDataAttrs",!0)}return e}return"object"==typeof a?this.each(function(){X.set(this,a)}):T(this,function(b){var c;if(f&&void 0===b){if(c=X.get(f,a),void 0!==c)return c;if(c=_(f,a),void 0!==c)return c}else this.each(function(){X.set(this,a,b)})},null,b,arguments.length>1,null,!0)},removeData:function(a){return this.each(function(){X.remove(this,a)})}}),r.extend({queue:function(a,b,c){var d;if(a)return b=(b||"fx")+"queue",d=W.get(a,b),c&&(!d||Array.isArray(c)?d=W.access(a,b,r.makeArray(c)):d.push(c)),d||[]},dequeue:function(a,b){b=b||"fx";var c=r.queue(a,b),d=c.length,e=c.shift(),f=r._queueHooks(a,b),g=function(){r.dequeue(a,b)};"inprogress"===e&&(e=c.shift(),d--),e&&("fx"===b&&c.unshift("inprogress"),delete f.stop,e.call(a,g,f)),!d&&f&&f.empty.fire()},_queueHooks:function(a,b){var c=b+"queueHooks";return W.get(a,c)||W.access(a,c,{empty:r.Callbacks("once memory").add(function(){W.remove(a,[b+"queue",c])})})}}),r.fn.extend({queue:function(a,b){var c=2;return"string"!=typeof a&&(b=a,a="fx",c--),arguments.length<c?r.queue(this[0],a):void 0===b?this:this.each(function(){var c=r.queue(this,a,b);r._queueHooks(this,a),"fx"===a&&"inprogress"!==c[0]&&r.dequeue(this,a)})},dequeue:function(a){return this.each(function(){r.dequeue(this,a)})},clearQueue:function(a){return this.queue(a||"fx",[])},promise:function(a,b){var c,d=1,e=r.Deferred(),f=this,g=this.length,h=function(){--d||e.resolveWith(f,[f])};"string"!=typeof a&&(b=a,a=void 0),a=a||"fx";while(g--)c=W.get(f[g],a+"queueHooks"),c&&c.empty&&(d++,c.empty.add(h));return h(),e.promise(b)}});var aa=/[+-]?(?:\d*\.|)\d+(?:[eE][+-]?\d+|)/.source,ba=new RegExp("^(?:([+-])=|)("+aa+")([a-z%]*)$","i"),ca=["Top","Right","Bottom","Left"],da=function(a,b){return a=b||a,"none"===a.style.display||""===a.style.display&&r.contains(a.ownerDocument,a)&&"none"===r.css(a,"display")},ea=function(a,b,c,d){var e,f,g={};for(f in b)g[f]=a.style[f],a.style[f]=b[f];e=c.apply(a,d||[]);for(f in b)a.style[f]=g[f];return e};function fa(a,b,c,d){var e,f=1,g=20,h=d?function(){return d.cur()}:function(){return r.css(a,b,"")},i=h(),j=c&&c[3]||(r.cssNumber[b]?"":"px"),k=(r.cssNumber[b]||"px"!==j&&+i)&&ba.exec(r.css(a,b));if(k&&k[3]!==j){j=j||k[3],c=c||[],k=+i||1;do f=f||".5",k/=f,r.style(a,b,k+j);while(f!==(f=h()/i)&&1!==f&&--g)}return c&&(k=+k||+i||0,e=c[1]?k+(c[1]+1)*c[2]:+c[2],d&&(d.unit=j,d.start=k,d.end=e)),e}var ga={};function ha(a){var b,c=a.ownerDocument,d=a.nodeName,e=ga[d];return e?e:(b=c.body.appendChild(c.createElement(d)),e=r.css(b,"display"),b.parentNode.removeChild(b),"none"===e&&(e="block"),ga[d]=e,e)}function ia(a,b){for(var c,d,e=[],f=0,g=a.length;f<g;f++)d=a[f],d.style&&(c=d.style.display,b?("none"===c&&(e[f]=W.get(d,"display")||null,e[f]||(d.style.display="")),""===d.style.display&&da(d)&&(e[f]=ha(d))):"none"!==c&&(e[f]="none",W.set(d,"display",c)));for(f=0;f<g;f++)null!=e[f]&&(a[f].style.display=e[f]);return a}r.fn.extend({show:function(){return ia(this,!0)},hide:function(){return ia(this)},toggle:function(a){return"boolean"==typeof a?a?this.show():this.hide():this.each(function(){da(this)?r(this).show():r(this).hide()})}});var ja=/^(?:checkbox|radio)$/i,ka=/<([a-z][^\/\0>\x20\t\r\n\f]+)/i,la=/^$|\/(?:java|ecma)script/i,ma={option:[1,"<select multiple='multiple'>","</select>"],thead:[1,"<table>","</table>"],col:[2,"<table><colgroup>","</colgroup></table>"],tr:[2,"<table><tbody>","</tbody></table>"],td:[3,"<table><tbody><tr>","</tr></tbody></table>"],_default:[0,"",""]};ma.optgroup=ma.option,ma.tbody=ma.tfoot=ma.colgroup=ma.caption=ma.thead,ma.th=ma.td;function na(a,b){var c;return c="undefined"!=typeof a.getElementsByTagName?a.getElementsByTagName(b||"*"):"undefined"!=typeof a.querySelectorAll?a.querySelectorAll(b||"*"):[],void 0===b||b&&B(a,b)?r.merge([a],c):c}function oa(a,b){for(var c=0,d=a.length;c<d;c++)W.set(a[c],"globalEval",!b||W.get(b[c],"globalEval"))}var pa=/<|&#?\w+;/;function qa(a,b,c,d,e){for(var f,g,h,i,j,k,l=b.createDocumentFragment(),m=[],n=0,o=a.length;n<o;n++)if(f=a[n],f||0===f)if("object"===r.type(f))r.merge(m,f.nodeType?[f]:f);else if(pa.test(f)){g=g||l.appendChild(b.createElement("div")),h=(ka.exec(f)||["",""])[1].toLowerCase(),i=ma[h]||ma._default,g.innerHTML=i[1]+r.htmlPrefilter(f)+i[2],k=i[0];while(k--)g=g.lastChild;r.merge(m,g.childNodes),g=l.firstChild,g.textContent=""}else m.push(b.createTextNode(f));l.textContent="",n=0;while(f=m[n++])if(d&&r.inArray(f,d)>-1)e&&e.push(f);else if(j=r.contains(f.ownerDocument,f),g=na(l.appendChild(f),"script"),j&&oa(g),c){k=0;while(f=g[k++])la.test(f.type||"")&&c.push(f)}return l}!function(){var a=d.createDocumentFragment(),b=a.appendChild(d.createElement("div")),c=d.createElement("input");c.setAttribute("type","radio"),c.setAttribute("checked","checked"),c.setAttribute("name","t"),b.appendChild(c),o.checkClone=b.cloneNode(!0).cloneNode(!0).lastChild.checked,b.innerHTML="<textarea>x</textarea>",o.noCloneChecked=!!b.cloneNode(!0).lastChild.defaultValue}();var ra=d.documentElement,sa=/^key/,ta=/^(?:mouse|pointer|contextmenu|drag|drop)|click/,ua=/^([^.]*)(?:\.(.+)|)/;function va(){return!0}function wa(){return!1}function xa(){try{return d.activeElement}catch(a){}}function ya(a,b,c,d,e,f){var g,h;if("object"==typeof b){"string"!=typeof c&&(d=d||c,c=void 0);for(h in b)ya(a,h,c,d,b[h],f);return a}if(null==d&&null==e?(e=c,d=c=void 0):null==e&&("string"==typeof c?(e=d,d=void 0):(e=d,d=c,c=void 0)),e===!1)e=wa;else if(!e)return a;return 1===f&&(g=e,e=function(a){return r().off(a),g.apply(this,arguments)},e.guid=g.guid||(g.guid=r.guid++)),a.each(function(){r.event.add(this,b,e,d,c)})}r.event={global:{},add:function(a,b,c,d,e){var f,g,h,i,j,k,l,m,n,o,p,q=W.get(a);if(q){c.handler&&(f=c,c=f.handler,e=f.selector),e&&r.find.matchesSelector(ra,e),c.guid||(c.guid=r.guid++),(i=q.events)||(i=q.events={}),(g=q.handle)||(g=q.handle=function(b){return"undefined"!=typeof r&&r.event.triggered!==b.type?r.event.dispatch.apply(a,arguments):void 0}),b=(b||"").match(L)||[""],j=b.length;while(j--)h=ua.exec(b[j])||[],n=p=h[1],o=(h[2]||"").split(".").sort(),n&&(l=r.event.special[n]||{},n=(e?l.delegateType:l.bindType)||n,l=r.event.special[n]||{},k=r.extend({type:n,origType:p,data:d,handler:c,guid:c.guid,selector:e,needsContext:e&&r.expr.match.needsContext.test(e),namespace:o.join(".")},f),(m=i[n])||(m=i[n]=[],m.delegateCount=0,l.setup&&l.setup.call(a,d,o,g)!==!1||a.addEventListener&&a.addEventListener(n,g)),l.add&&(l.add.call(a,k),k.handler.guid||(k.handler.guid=c.guid)),e?m.splice(m.delegateCount++,0,k):m.push(k),r.event.global[n]=!0)}},remove:function(a,b,c,d,e){var f,g,h,i,j,k,l,m,n,o,p,q=W.hasData(a)&&W.get(a);if(q&&(i=q.events)){b=(b||"").match(L)||[""],j=b.length;while(j--)if(h=ua.exec(b[j])||[],n=p=h[1],o=(h[2]||"").split(".").sort(),n){l=r.event.special[n]||{},n=(d?l.delegateType:l.bindType)||n,m=i[n]||[],h=h[2]&&new RegExp("(^|\\.)"+o.join("\\.(?:.*\\.|)")+"(\\.|$)"),g=f=m.length;while(f--)k=m[f],!e&&p!==k.origType||c&&c.guid!==k.guid||h&&!h.test(k.namespace)||d&&d!==k.selector&&("**"!==d||!k.selector)||(m.splice(f,1),k.selector&&m.delegateCount--,l.remove&&l.remove.call(a,k));g&&!m.length&&(l.teardown&&l.teardown.call(a,o,q.handle)!==!1||r.removeEvent(a,n,q.handle),delete i[n])}else for(n in i)r.event.remove(a,n+b[j],c,d,!0);r.isEmptyObject(i)&&W.remove(a,"handle events")}},dispatch:function(a){var b=r.event.fix(a),c,d,e,f,g,h,i=new Array(arguments.length),j=(W.get(this,"events")||{})[b.type]||[],k=r.event.special[b.type]||{};for(i[0]=b,c=1;c<arguments.length;c++)i[c]=arguments[c];if(b.delegateTarget=this,!k.preDispatch||k.preDispatch.call(this,b)!==!1){h=r.event.handlers.call(this,b,j),c=0;while((f=h[c++])&&!b.isPropagationStopped()){b.currentTarget=f.elem,d=0;while((g=f.handlers[d++])&&!b.isImmediatePropagationStopped())b.rnamespace&&!b.rnamespace.test(g.namespace)||(b.handleObj=g,b.data=g.data,e=((r.event.special[g.origType]||{}).handle||g.handler).apply(f.elem,i),void 0!==e&&(b.result=e)===!1&&(b.preventDefault(),b.stopPropagation()))}return k.postDispatch&&k.postDispatch.call(this,b),b.result}},handlers:function(a,b){var c,d,e,f,g,h=[],i=b.delegateCount,j=a.target;if(i&&j.nodeType&&!("click"===a.type&&a.button>=1))for(;j!==this;j=j.parentNode||this)if(1===j.nodeType&&("click"!==a.type||j.disabled!==!0)){for(f=[],g={},c=0;c<i;c++)d=b[c],e=d.selector+" ",void 0===g[e]&&(g[e]=d.needsContext?r(e,this).index(j)>-1:r.find(e,this,null,[j]).length),g[e]&&f.push(d);f.length&&h.push({elem:j,handlers:f})}return j=this,i<b.length&&h.push({elem:j,handlers:b.slice(i)}),h},addProp:function(a,b){Object.defineProperty(r.Event.prototype,a,{enumerable:!0,configurable:!0,get:r.isFunction(b)?function(){if(this.originalEvent)return b(this.originalEvent)}:function(){if(this.originalEvent)return this.originalEvent[a]},set:function(b){Object.defineProperty(this,a,{enumerable:!0,configurable:!0,writable:!0,value:b})}})},fix:function(a){return a[r.expando]?a:new r.Event(a)},special:{load:{noBubble:!0},focus:{trigger:function(){if(this!==xa()&&this.focus)return this.focus(),!1},delegateType:"focusin"},blur:{trigger:function(){if(this===xa()&&this.blur)return this.blur(),!1},delegateType:"focusout"},click:{trigger:function(){if("checkbox"===this.type&&this.click&&B(this,"input"))return this.click(),!1},_default:function(a){return B(a.target,"a")}},beforeunload:{postDispatch:function(a){void 0!==a.result&&a.originalEvent&&(a.originalEvent.returnValue=a.result)}}}},r.removeEvent=function(a,b,c){a.removeEventListener&&a.removeEventListener(b,c)},r.Event=function(a,b){return this instanceof r.Event?(a&&a.type?(this.originalEvent=a,this.type=a.type,this.isDefaultPrevented=a.defaultPrevented||void 0===a.defaultPrevented&&a.returnValue===!1?va:wa,this.target=a.target&&3===a.target.nodeType?a.target.parentNode:a.target,this.currentTarget=a.currentTarget,this.relatedTarget=a.relatedTarget):this.type=a,b&&r.extend(this,b),this.timeStamp=a&&a.timeStamp||r.now(),void(this[r.expando]=!0)):new r.Event(a,b)},r.Event.prototype={constructor:r.Event,isDefaultPrevented:wa,isPropagationStopped:wa,isImmediatePropagationStopped:wa,isSimulated:!1,preventDefault:function(){var a=this.originalEvent;this.isDefaultPrevented=va,a&&!this.isSimulated&&a.preventDefault()},stopPropagation:function(){var a=this.originalEvent;this.isPropagationStopped=va,a&&!this.isSimulated&&a.stopPropagation()},stopImmediatePropagation:function(){var a=this.originalEvent;this.isImmediatePropagationStopped=va,a&&!this.isSimulated&&a.stopImmediatePropagation(),this.stopPropagation()}},r.each({altKey:!0,bubbles:!0,cancelable:!0,changedTouches:!0,ctrlKey:!0,detail:!0,eventPhase:!0,metaKey:!0,pageX:!0,pageY:!0,shiftKey:!0,view:!0,"char":!0,charCode:!0,key:!0,keyCode:!0,button:!0,buttons:!0,clientX:!0,clientY:!0,offsetX:!0,offsetY:!0,pointerId:!0,pointerType:!0,screenX:!0,screenY:!0,targetTouches:!0,toElement:!0,touches:!0,which:function(a){var b=a.button;return null==a.which&&sa.test(a.type)?null!=a.charCode?a.charCode:a.keyCode:!a.which&&void 0!==b&&ta.test(a.type)?1&b?1:2&b?3:4&b?2:0:a.which}},r.event.addProp),r.each({mouseenter:"mouseover",mouseleave:"mouseout",pointerenter:"pointerover",pointerleave:"pointerout"},function(a,b){r.event.special[a]={delegateType:b,bindType:b,handle:function(a){var c,d=this,e=a.relatedTarget,f=a.handleObj;return e&&(e===d||r.contains(d,e))||(a.type=f.origType,c=f.handler.apply(this,arguments),a.type=b),c}}}),r.fn.extend({on:function(a,b,c,d){return ya(this,a,b,c,d)},one:function(a,b,c,d){return ya(this,a,b,c,d,1)},off:function(a,b,c){var d,e;if(a&&a.preventDefault&&a.handleObj)return d=a.handleObj,r(a.delegateTarget).off(d.namespace?d.origType+"."+d.namespace:d.origType,d.selector,d.handler),this;if("object"==typeof a){for(e in a)this.off(e,b,a[e]);return this}return b!==!1&&"function"!=typeof b||(c=b,b=void 0),c===!1&&(c=wa),this.each(function(){r.event.remove(this,a,c,b)})}});var za=/<(?!area|br|col|embed|hr|img|input|link|meta|param)(([a-z][^\/\0>\x20\t\r\n\f]*)[^>]*)\/>/gi,Aa=/<script|<style|<link/i,Ba=/checked\s*(?:[^=]|=\s*.checked.)/i,Ca=/^true\/(.*)/,Da=/^\s*<!(?:\[CDATA\[|--)|(?:\]\]|--)>\s*$/g;function Ea(a,b){return B(a,"table")&&B(11!==b.nodeType?b:b.firstChild,"tr")?r(">tbody",a)[0]||a:a}function Fa(a){return a.type=(null!==a.getAttribute("type"))+"/"+a.type,a}function Ga(a){var b=Ca.exec(a.type);return b?a.type=b[1]:a.removeAttribute("type"),a}function Ha(a,b){var c,d,e,f,g,h,i,j;if(1===b.nodeType){if(W.hasData(a)&&(f=W.access(a),g=W.set(b,f),j=f.events)){delete g.handle,g.events={};for(e in j)for(c=0,d=j[e].length;c<d;c++)r.event.add(b,e,j[e][c])}X.hasData(a)&&(h=X.access(a),i=r.extend({},h),X.set(b,i))}}function Ia(a,b){var c=b.nodeName.toLowerCase();"input"===c&&ja.test(a.type)?b.checked=a.checked:"input"!==c&&"textarea"!==c||(b.defaultValue=a.defaultValue)}function Ja(a,b,c,d){b=g.apply([],b);var e,f,h,i,j,k,l=0,m=a.length,n=m-1,q=b[0],s=r.isFunction(q);if(s||m>1&&"string"==typeof q&&!o.checkClone&&Ba.test(q))return a.each(function(e){var f=a.eq(e);s&&(b[0]=q.call(this,e,f.html())),Ja(f,b,c,d)});if(m&&(e=qa(b,a[0].ownerDocument,!1,a,d),f=e.firstChild,1===e.childNodes.length&&(e=f),f||d)){for(h=r.map(na(e,"script"),Fa),i=h.length;l<m;l++)j=e,l!==n&&(j=r.clone(j,!0,!0),i&&r.merge(h,na(j,"script"))),c.call(a[l],j,l);if(i)for(k=h[h.length-1].ownerDocument,r.map(h,Ga),l=0;l<i;l++)j=h[l],la.test(j.type||"")&&!W.access(j,"globalEval")&&r.contains(k,j)&&(j.src?r._evalUrl&&r._evalUrl(j.src):p(j.textContent.replace(Da,""),k))}return a}function Ka(a,b,c){for(var d,e=b?r.filter(b,a):a,f=0;null!=(d=e[f]);f++)c||1!==d.nodeType||r.cleanData(na(d)),d.parentNode&&(c&&r.contains(d.ownerDocument,d)&&oa(na(d,"script")),d.parentNode.removeChild(d));return a}r.extend({htmlPrefilter:function(a){return a.replace(za,"<$1></$2>")},clone:function(a,b,c){var d,e,f,g,h=a.cloneNode(!0),i=r.contains(a.ownerDocument,a);if(!(o.noCloneChecked||1!==a.nodeType&&11!==a.nodeType||r.isXMLDoc(a)))for(g=na(h),f=na(a),d=0,e=f.length;d<e;d++)Ia(f[d],g[d]);if(b)if(c)for(f=f||na(a),g=g||na(h),d=0,e=f.length;d<e;d++)Ha(f[d],g[d]);else Ha(a,h);return g=na(h,"script"),g.length>0&&oa(g,!i&&na(a,"script")),h},cleanData:function(a){for(var b,c,d,e=r.event.special,f=0;void 0!==(c=a[f]);f++)if(U(c)){if(b=c[W.expando]){if(b.events)for(d in b.events)e[d]?r.event.remove(c,d):r.removeEvent(c,d,b.handle);c[W.expando]=void 0}c[X.expando]&&(c[X.expando]=void 0)}}}),r.fn.extend({detach:function(a){return Ka(this,a,!0)},remove:function(a){return Ka(this,a)},text:function(a){return T(this,function(a){return void 0===a?r.text(this):this.empty().each(function(){1!==this.nodeType&&11!==this.nodeType&&9!==this.nodeType||(this.textContent=a)})},null,a,arguments.length)},append:function(){return Ja(this,arguments,function(a){if(1===this.nodeType||11===this.nodeType||9===this.nodeType){var b=Ea(this,a);b.appendChild(a)}})},prepend:function(){return Ja(this,arguments,function(a){if(1===this.nodeType||11===this.nodeType||9===this.nodeType){var b=Ea(this,a);b.insertBefore(a,b.firstChild)}})},before:function(){return Ja(this,arguments,function(a){this.parentNode&&this.parentNode.insertBefore(a,this)})},after:function(){return Ja(this,arguments,function(a){this.parentNode&&this.parentNode.insertBefore(a,this.nextSibling)})},empty:function(){for(var a,b=0;null!=(a=this[b]);b++)1===a.nodeType&&(r.cleanData(na(a,!1)),a.textContent="");return this},clone:function(a,b){return a=null!=a&&a,b=null==b?a:b,this.map(function(){return r.clone(this,a,b)})},html:function(a){return T(this,function(a){var b=this[0]||{},c=0,d=this.length;if(void 0===a&&1===b.nodeType)return b.innerHTML;if("string"==typeof a&&!Aa.test(a)&&!ma[(ka.exec(a)||["",""])[1].toLowerCase()]){a=r.htmlPrefilter(a);try{for(;c<d;c++)b=this[c]||{},1===b.nodeType&&(r.cleanData(na(b,!1)),b.innerHTML=a);b=0}catch(e){}}b&&this.empty().append(a)},null,a,arguments.length)},replaceWith:function(){var a=[];return Ja(this,arguments,function(b){var c=this.parentNode;r.inArray(this,a)<0&&(r.cleanData(na(this)),c&&c.replaceChild(b,this))},a)}}),r.each({appendTo:"append",prependTo:"prepend",insertBefore:"before",insertAfter:"after",replaceAll:"replaceWith"},function(a,b){r.fn[a]=function(a){for(var c,d=[],e=r(a),f=e.length-1,g=0;g<=f;g++)c=g===f?this:this.clone(!0),r(e[g])[b](c),h.apply(d,c.get());return this.pushStack(d)}});var La=/^margin/,Ma=new RegExp("^("+aa+")(?!px)[a-z%]+$","i"),Na=function(b){var c=b.ownerDocument.defaultView;return c&&c.opener||(c=a),c.getComputedStyle(b)};!function(){function b(){if(i){i.style.cssText="box-sizing:border-box;position:relative;display:block;margin:auto;border:1px;padding:1px;top:1%;width:50%",i.innerHTML="",ra.appendChild(h);var b=a.getComputedStyle(i);c="1%"!==b.top,g="2px"===b.marginLeft,e="4px"===b.width,i.style.marginRight="50%",f="4px"===b.marginRight,ra.removeChild(h),i=null}}var c,e,f,g,h=d.createElement("div"),i=d.createElement("div");i.style&&(i.style.backgroundClip="content-box",i.cloneNode(!0).style.backgroundClip="",o.clearCloneStyle="content-box"===i.style.backgroundClip,h.style.cssText="border:0;width:8px;height:0;top:0;left:-9999px;padding:0;margin-top:1px;position:absolute",h.appendChild(i),r.extend(o,{pixelPosition:function(){return b(),c},boxSizingReliable:function(){return b(),e},pixelMarginRight:function(){return b(),f},reliableMarginLeft:function(){return b(),g}}))}();function Oa(a,b,c){var d,e,f,g,h=a.style;return c=c||Na(a),c&&(g=c.getPropertyValue(b)||c[b],""!==g||r.contains(a.ownerDocument,a)||(g=r.style(a,b)),!o.pixelMarginRight()&&Ma.test(g)&&La.test(b)&&(d=h.width,e=h.minWidth,f=h.maxWidth,h.minWidth=h.maxWidth=h.width=g,g=c.width,h.width=d,h.minWidth=e,h.maxWidth=f)),void 0!==g?g+"":g}function Pa(a,b){return{get:function(){return a()?void delete this.get:(this.get=b).apply(this,arguments)}}}var Qa=/^(none|table(?!-c[ea]).+)/,Ra=/^--/,Sa={position:"absolute",visibility:"hidden",display:"block"},Ta={letterSpacing:"0",fontWeight:"400"},Ua=["Webkit","Moz","ms"],Va=d.createElement("div").style;function Wa(a){if(a in Va)return a;var b=a[0].toUpperCase()+a.slice(1),c=Ua.length;while(c--)if(a=Ua[c]+b,a in Va)return a}function Xa(a){var b=r.cssProps[a];return b||(b=r.cssProps[a]=Wa(a)||a),b}function Ya(a,b,c){var d=ba.exec(b);return d?Math.max(0,d[2]-(c||0))+(d[3]||"px"):b}function Za(a,b,c,d,e){var f,g=0;for(f=c===(d?"border":"content")?4:"width"===b?1:0;f<4;f+=2)"margin"===c&&(g+=r.css(a,c+ca[f],!0,e)),d?("content"===c&&(g-=r.css(a,"padding"+ca[f],!0,e)),"margin"!==c&&(g-=r.css(a,"border"+ca[f]+"Width",!0,e))):(g+=r.css(a,"padding"+ca[f],!0,e),"padding"!==c&&(g+=r.css(a,"border"+ca[f]+"Width",!0,e)));return g}function $a(a,b,c){var d,e=Na(a),f=Oa(a,b,e),g="border-box"===r.css(a,"boxSizing",!1,e);return Ma.test(f)?f:(d=g&&(o.boxSizingReliable()||f===a.style[b]),"auto"===f&&(f=a["offset"+b[0].toUpperCase()+b.slice(1)]),f=parseFloat(f)||0,f+Za(a,b,c||(g?"border":"content"),d,e)+"px")}r.extend({cssHooks:{opacity:{get:function(a,b){if(b){var c=Oa(a,"opacity");return""===c?"1":c}}}},cssNumber:{animationIterationCount:!0,columnCount:!0,fillOpacity:!0,flexGrow:!0,flexShrink:!0,fontWeight:!0,lineHeight:!0,opacity:!0,order:!0,orphans:!0,widows:!0,zIndex:!0,zoom:!0},cssProps:{"float":"cssFloat"},style:function(a,b,c,d){if(a&&3!==a.nodeType&&8!==a.nodeType&&a.style){var e,f,g,h=r.camelCase(b),i=Ra.test(b),j=a.style;return i||(b=Xa(h)),g=r.cssHooks[b]||r.cssHooks[h],void 0===c?g&&"get"in g&&void 0!==(e=g.get(a,!1,d))?e:j[b]:(f=typeof c,"string"===f&&(e=ba.exec(c))&&e[1]&&(c=fa(a,b,e),f="number"),null!=c&&c===c&&("number"===f&&(c+=e&&e[3]||(r.cssNumber[h]?"":"px")),o.clearCloneStyle||""!==c||0!==b.indexOf("background")||(j[b]="inherit"),g&&"set"in g&&void 0===(c=g.set(a,c,d))||(i?j.setProperty(b,c):j[b]=c)),void 0)}},css:function(a,b,c,d){var e,f,g,h=r.camelCase(b),i=Ra.test(b);return i||(b=Xa(h)),g=r.cssHooks[b]||r.cssHooks[h],g&&"get"in g&&(e=g.get(a,!0,c)),void 0===e&&(e=Oa(a,b,d)),"normal"===e&&b in Ta&&(e=Ta[b]),""===c||c?(f=parseFloat(e),c===!0||isFinite(f)?f||0:e):e}}),r.each(["height","width"],function(a,b){r.cssHooks[b]={get:function(a,c,d){if(c)return!Qa.test(r.css(a,"display"))||a.getClientRects().length&&a.getBoundingClientRect().width?$a(a,b,d):ea(a,Sa,function(){return $a(a,b,d)})},set:function(a,c,d){var e,f=d&&Na(a),g=d&&Za(a,b,d,"border-box"===r.css(a,"boxSizing",!1,f),f);return g&&(e=ba.exec(c))&&"px"!==(e[3]||"px")&&(a.style[b]=c,c=r.css(a,b)),Ya(a,c,g)}}}),r.cssHooks.marginLeft=Pa(o.reliableMarginLeft,function(a,b){if(b)return(parseFloat(Oa(a,"marginLeft"))||a.getBoundingClientRect().left-ea(a,{marginLeft:0},function(){return a.getBoundingClientRect().left}))+"px"}),r.each({margin:"",padding:"",border:"Width"},function(a,b){r.cssHooks[a+b]={expand:function(c){for(var d=0,e={},f="string"==typeof c?c.split(" "):[c];d<4;d++)e[a+ca[d]+b]=f[d]||f[d-2]||f[0];return e}},La.test(a)||(r.cssHooks[a+b].set=Ya)}),r.fn.extend({css:function(a,b){return T(this,function(a,b,c){var d,e,f={},g=0;if(Array.isArray(b)){for(d=Na(a),e=b.length;g<e;g++)f[b[g]]=r.css(a,b[g],!1,d);return f}return void 0!==c?r.style(a,b,c):r.css(a,b)},a,b,arguments.length>1)}});function _a(a,b,c,d,e){return new _a.prototype.init(a,b,c,d,e)}r.Tween=_a,_a.prototype={constructor:_a,init:function(a,b,c,d,e,f){this.elem=a,this.prop=c,this.easing=e||r.easing._default,this.options=b,this.start=this.now=this.cur(),this.end=d,this.unit=f||(r.cssNumber[c]?"":"px")},cur:function(){var a=_a.propHooks[this.prop];return a&&a.get?a.get(this):_a.propHooks._default.get(this)},run:function(a){var b,c=_a.propHooks[this.prop];return this.options.duration?this.pos=b=r.easing[this.easing](a,this.options.duration*a,0,1,this.options.duration):this.pos=b=a,this.now=(this.end-this.start)*b+this.start,this.options.step&&this.options.step.call(this.elem,this.now,this),c&&c.set?c.set(this):_a.propHooks._default.set(this),this}},_a.prototype.init.prototype=_a.prototype,_a.propHooks={_default:{get:function(a){var b;return 1!==a.elem.nodeType||null!=a.elem[a.prop]&&null==a.elem.style[a.prop]?a.elem[a.prop]:(b=r.css(a.elem,a.prop,""),b&&"auto"!==b?b:0)},set:function(a){r.fx.step[a.prop]?r.fx.step[a.prop](a):1!==a.elem.nodeType||null==a.elem.style[r.cssProps[a.prop]]&&!r.cssHooks[a.prop]?a.elem[a.prop]=a.now:r.style(a.elem,a.prop,a.now+a.unit)}}},_a.propHooks.scrollTop=_a.propHooks.scrollLeft={set:function(a){a.elem.nodeType&&a.elem.parentNode&&(a.elem[a.prop]=a.now)}},r.easing={linear:function(a){return a},swing:function(a){return.5-Math.cos(a*Math.PI)/2},_default:"swing"},r.fx=_a.prototype.init,r.fx.step={};var ab,bb,cb=/^(?:toggle|show|hide)$/,db=/queueHooks$/;function eb(){bb&&(d.hidden===!1&&a.requestAnimationFrame?a.requestAnimationFrame(eb):a.setTimeout(eb,r.fx.interval),r.fx.tick())}function fb(){return a.setTimeout(function(){ab=void 0}),ab=r.now()}function gb(a,b){var c,d=0,e={height:a};for(b=b?1:0;d<4;d+=2-b)c=ca[d],e["margin"+c]=e["padding"+c]=a;return b&&(e.opacity=e.width=a),e}function hb(a,b,c){for(var d,e=(kb.tweeners[b]||[]).concat(kb.tweeners["*"]),f=0,g=e.length;f<g;f++)if(d=e[f].call(c,b,a))return d}function ib(a,b,c){var d,e,f,g,h,i,j,k,l="width"in b||"height"in b,m=this,n={},o=a.style,p=a.nodeType&&da(a),q=W.get(a,"fxshow");c.queue||(g=r._queueHooks(a,"fx"),null==g.unqueued&&(g.unqueued=0,h=g.empty.fire,g.empty.fire=function(){g.unqueued||h()}),g.unqueued++,m.always(function(){m.always(function(){g.unqueued--,r.queue(a,"fx").length||g.empty.fire()})}));for(d in b)if(e=b[d],cb.test(e)){if(delete b[d],f=f||"toggle"===e,e===(p?"hide":"show")){if("show"!==e||!q||void 0===q[d])continue;p=!0}n[d]=q&&q[d]||r.style(a,d)}if(i=!r.isEmptyObject(b),i||!r.isEmptyObject(n)){l&&1===a.nodeType&&(c.overflow=[o.overflow,o.overflowX,o.overflowY],j=q&&q.display,null==j&&(j=W.get(a,"display")),k=r.css(a,"display"),"none"===k&&(j?k=j:(ia([a],!0),j=a.style.display||j,k=r.css(a,"display"),ia([a]))),("inline"===k||"inline-block"===k&&null!=j)&&"none"===r.css(a,"float")&&(i||(m.done(function(){o.display=j}),null==j&&(k=o.display,j="none"===k?"":k)),o.display="inline-block")),c.overflow&&(o.overflow="hidden",m.always(function(){o.overflow=c.overflow[0],o.overflowX=c.overflow[1],o.overflowY=c.overflow[2]})),i=!1;for(d in n)i||(q?"hidden"in q&&(p=q.hidden):q=W.access(a,"fxshow",{display:j}),f&&(q.hidden=!p),p&&ia([a],!0),m.done(function(){p||ia([a]),W.remove(a,"fxshow");for(d in n)r.style(a,d,n[d])})),i=hb(p?q[d]:0,d,m),d in q||(q[d]=i.start,p&&(i.end=i.start,i.start=0))}}function jb(a,b){var c,d,e,f,g;for(c in a)if(d=r.camelCase(c),e=b[d],f=a[c],Array.isArray(f)&&(e=f[1],f=a[c]=f[0]),c!==d&&(a[d]=f,delete a[c]),g=r.cssHooks[d],g&&"expand"in g){f=g.expand(f),delete a[d];for(c in f)c in a||(a[c]=f[c],b[c]=e)}else b[d]=e}function kb(a,b,c){var d,e,f=0,g=kb.prefilters.length,h=r.Deferred().always(function(){delete i.elem}),i=function(){if(e)return!1;for(var b=ab||fb(),c=Math.max(0,j.startTime+j.duration-b),d=c/j.duration||0,f=1-d,g=0,i=j.tweens.length;g<i;g++)j.tweens[g].run(f);return h.notifyWith(a,[j,f,c]),f<1&&i?c:(i||h.notifyWith(a,[j,1,0]),h.resolveWith(a,[j]),!1)},j=h.promise({elem:a,props:r.extend({},b),opts:r.extend(!0,{specialEasing:{},easing:r.easing._default},c),originalProperties:b,originalOptions:c,startTime:ab||fb(),duration:c.duration,tweens:[],createTween:function(b,c){var d=r.Tween(a,j.opts,b,c,j.opts.specialEasing[b]||j.opts.easing);return j.tweens.push(d),d},stop:function(b){var c=0,d=b?j.tweens.length:0;if(e)return this;for(e=!0;c<d;c++)j.tweens[c].run(1);return b?(h.notifyWith(a,[j,1,0]),h.resolveWith(a,[j,b])):h.rejectWith(a,[j,b]),this}}),k=j.props;for(jb(k,j.opts.specialEasing);f<g;f++)if(d=kb.prefilters[f].call(j,a,k,j.opts))return r.isFunction(d.stop)&&(r._queueHooks(j.elem,j.opts.queue).stop=r.proxy(d.stop,d)),d;return r.map(k,hb,j),r.isFunction(j.opts.start)&&j.opts.start.call(a,j),j.progress(j.opts.progress).done(j.opts.done,j.opts.complete).fail(j.opts.fail).always(j.opts.always),r.fx.timer(r.extend(i,{elem:a,anim:j,queue:j.opts.queue})),j}r.Animation=r.extend(kb,{tweeners:{"*":[function(a,b){var c=this.createTween(a,b);return fa(c.elem,a,ba.exec(b),c),c}]},tweener:function(a,b){r.isFunction(a)?(b=a,a=["*"]):a=a.match(L);for(var c,d=0,e=a.length;d<e;d++)c=a[d],kb.tweeners[c]=kb.tweeners[c]||[],kb.tweeners[c].unshift(b)},prefilters:[ib],prefilter:function(a,b){b?kb.prefilters.unshift(a):kb.prefilters.push(a)}}),r.speed=function(a,b,c){var d=a&&"object"==typeof a?r.extend({},a):{complete:c||!c&&b||r.isFunction(a)&&a,duration:a,easing:c&&b||b&&!r.isFunction(b)&&b};return r.fx.off?d.duration=0:"number"!=typeof d.duration&&(d.duration in r.fx.speeds?d.duration=r.fx.speeds[d.duration]:d.duration=r.fx.speeds._default),null!=d.queue&&d.queue!==!0||(d.queue="fx"),d.old=d.complete,d.complete=function(){r.isFunction(d.old)&&d.old.call(this),d.queue&&r.dequeue(this,d.queue)},d},r.fn.extend({fadeTo:function(a,b,c,d){return this.filter(da).css("opacity",0).show().end().animate({opacity:b},a,c,d)},animate:function(a,b,c,d){var e=r.isEmptyObject(a),f=r.speed(b,c,d),g=function(){var b=kb(this,r.extend({},a),f);(e||W.get(this,"finish"))&&b.stop(!0)};return g.finish=g,e||f.queue===!1?this.each(g):this.queue(f.queue,g)},stop:function(a,b,c){var d=function(a){var b=a.stop;delete a.stop,b(c)};return"string"!=typeof a&&(c=b,b=a,a=void 0),b&&a!==!1&&this.queue(a||"fx",[]),this.each(function(){var b=!0,e=null!=a&&a+"queueHooks",f=r.timers,g=W.get(this);if(e)g[e]&&g[e].stop&&d(g[e]);else for(e in g)g[e]&&g[e].stop&&db.test(e)&&d(g[e]);for(e=f.length;e--;)f[e].elem!==this||null!=a&&f[e].queue!==a||(f[e].anim.stop(c),b=!1,f.splice(e,1));!b&&c||r.dequeue(this,a)})},finish:function(a){return a!==!1&&(a=a||"fx"),this.each(function(){var b,c=W.get(this),d=c[a+"queue"],e=c[a+"queueHooks"],f=r.timers,g=d?d.length:0;for(c.finish=!0,r.queue(this,a,[]),e&&e.stop&&e.stop.call(this,!0),b=f.length;b--;)f[b].elem===this&&f[b].queue===a&&(f[b].anim.stop(!0),f.splice(b,1));for(b=0;b<g;b++)d[b]&&d[b].finish&&d[b].finish.call(this);delete c.finish})}}),r.each(["toggle","show","hide"],function(a,b){var c=r.fn[b];r.fn[b]=function(a,d,e){return null==a||"boolean"==typeof a?c.apply(this,arguments):this.animate(gb(b,!0),a,d,e)}}),r.each({slideDown:gb("show"),slideUp:gb("hide"),slideToggle:gb("toggle"),fadeIn:{opacity:"show"},fadeOut:{opacity:"hide"},fadeToggle:{opacity:"toggle"}},function(a,b){r.fn[a]=function(a,c,d){return this.animate(b,a,c,d)}}),r.timers=[],r.fx.tick=function(){var a,b=0,c=r.timers;for(ab=r.now();b<c.length;b++)a=c[b],a()||c[b]!==a||c.splice(b--,1);c.length||r.fx.stop(),ab=void 0},r.fx.timer=function(a){r.timers.push(a),r.fx.start()},r.fx.interval=13,r.fx.start=function(){bb||(bb=!0,eb())},r.fx.stop=function(){bb=null},r.fx.speeds={slow:600,fast:200,_default:400},r.fn.delay=function(b,c){return b=r.fx?r.fx.speeds[b]||b:b,c=c||"fx",this.queue(c,function(c,d){var e=a.setTimeout(c,b);d.stop=function(){a.clearTimeout(e)}})},function(){var a=d.createElement("input"),b=d.createElement("select"),c=b.appendChild(d.createElement("option"));a.type="checkbox",o.checkOn=""!==a.value,o.optSelected=c.selected,a=d.createElement("input"),a.value="t",a.type="radio",o.radioValue="t"===a.value}();var lb,mb=r.expr.attrHandle;r.fn.extend({attr:function(a,b){return T(this,r.attr,a,b,arguments.length>1)},removeAttr:function(a){return this.each(function(){r.removeAttr(this,a)})}}),r.extend({attr:function(a,b,c){var d,e,f=a.nodeType;if(3!==f&&8!==f&&2!==f)return"undefined"==typeof a.getAttribute?r.prop(a,b,c):(1===f&&r.isXMLDoc(a)||(e=r.attrHooks[b.toLowerCase()]||(r.expr.match.bool.test(b)?lb:void 0)),void 0!==c?null===c?void r.removeAttr(a,b):e&&"set"in e&&void 0!==(d=e.set(a,c,b))?d:(a.setAttribute(b,c+""),c):e&&"get"in e&&null!==(d=e.get(a,b))?d:(d=r.find.attr(a,b),
null==d?void 0:d))},attrHooks:{type:{set:function(a,b){if(!o.radioValue&&"radio"===b&&B(a,"input")){var c=a.value;return a.setAttribute("type",b),c&&(a.value=c),b}}}},removeAttr:function(a,b){var c,d=0,e=b&&b.match(L);if(e&&1===a.nodeType)while(c=e[d++])a.removeAttribute(c)}}),lb={set:function(a,b,c){return b===!1?r.removeAttr(a,c):a.setAttribute(c,c),c}},r.each(r.expr.match.bool.source.match(/\w+/g),function(a,b){var c=mb[b]||r.find.attr;mb[b]=function(a,b,d){var e,f,g=b.toLowerCase();return d||(f=mb[g],mb[g]=e,e=null!=c(a,b,d)?g:null,mb[g]=f),e}});var nb=/^(?:input|select|textarea|button)$/i,ob=/^(?:a|area)$/i;r.fn.extend({prop:function(a,b){return T(this,r.prop,a,b,arguments.length>1)},removeProp:function(a){return this.each(function(){delete this[r.propFix[a]||a]})}}),r.extend({prop:function(a,b,c){var d,e,f=a.nodeType;if(3!==f&&8!==f&&2!==f)return 1===f&&r.isXMLDoc(a)||(b=r.propFix[b]||b,e=r.propHooks[b]),void 0!==c?e&&"set"in e&&void 0!==(d=e.set(a,c,b))?d:a[b]=c:e&&"get"in e&&null!==(d=e.get(a,b))?d:a[b]},propHooks:{tabIndex:{get:function(a){var b=r.find.attr(a,"tabindex");return b?parseInt(b,10):nb.test(a.nodeName)||ob.test(a.nodeName)&&a.href?0:-1}}},propFix:{"for":"htmlFor","class":"className"}}),o.optSelected||(r.propHooks.selected={get:function(a){var b=a.parentNode;return b&&b.parentNode&&b.parentNode.selectedIndex,null},set:function(a){var b=a.parentNode;b&&(b.selectedIndex,b.parentNode&&b.parentNode.selectedIndex)}}),r.each(["tabIndex","readOnly","maxLength","cellSpacing","cellPadding","rowSpan","colSpan","useMap","frameBorder","contentEditable"],function(){r.propFix[this.toLowerCase()]=this});function pb(a){var b=a.match(L)||[];return b.join(" ")}function qb(a){return a.getAttribute&&a.getAttribute("class")||""}r.fn.extend({addClass:function(a){var b,c,d,e,f,g,h,i=0;if(r.isFunction(a))return this.each(function(b){r(this).addClass(a.call(this,b,qb(this)))});if("string"==typeof a&&a){b=a.match(L)||[];while(c=this[i++])if(e=qb(c),d=1===c.nodeType&&" "+pb(e)+" "){g=0;while(f=b[g++])d.indexOf(" "+f+" ")<0&&(d+=f+" ");h=pb(d),e!==h&&c.setAttribute("class",h)}}return this},removeClass:function(a){var b,c,d,e,f,g,h,i=0;if(r.isFunction(a))return this.each(function(b){r(this).removeClass(a.call(this,b,qb(this)))});if(!arguments.length)return this.attr("class","");if("string"==typeof a&&a){b=a.match(L)||[];while(c=this[i++])if(e=qb(c),d=1===c.nodeType&&" "+pb(e)+" "){g=0;while(f=b[g++])while(d.indexOf(" "+f+" ")>-1)d=d.replace(" "+f+" "," ");h=pb(d),e!==h&&c.setAttribute("class",h)}}return this},toggleClass:function(a,b){var c=typeof a;return"boolean"==typeof b&&"string"===c?b?this.addClass(a):this.removeClass(a):r.isFunction(a)?this.each(function(c){r(this).toggleClass(a.call(this,c,qb(this),b),b)}):this.each(function(){var b,d,e,f;if("string"===c){d=0,e=r(this),f=a.match(L)||[];while(b=f[d++])e.hasClass(b)?e.removeClass(b):e.addClass(b)}else void 0!==a&&"boolean"!==c||(b=qb(this),b&&W.set(this,"__className__",b),this.setAttribute&&this.setAttribute("class",b||a===!1?"":W.get(this,"__className__")||""))})},hasClass:function(a){var b,c,d=0;b=" "+a+" ";while(c=this[d++])if(1===c.nodeType&&(" "+pb(qb(c))+" ").indexOf(b)>-1)return!0;return!1}});var rb=/\r/g;r.fn.extend({val:function(a){var b,c,d,e=this[0];{if(arguments.length)return d=r.isFunction(a),this.each(function(c){var e;1===this.nodeType&&(e=d?a.call(this,c,r(this).val()):a,null==e?e="":"number"==typeof e?e+="":Array.isArray(e)&&(e=r.map(e,function(a){return null==a?"":a+""})),b=r.valHooks[this.type]||r.valHooks[this.nodeName.toLowerCase()],b&&"set"in b&&void 0!==b.set(this,e,"value")||(this.value=e))});if(e)return b=r.valHooks[e.type]||r.valHooks[e.nodeName.toLowerCase()],b&&"get"in b&&void 0!==(c=b.get(e,"value"))?c:(c=e.value,"string"==typeof c?c.replace(rb,""):null==c?"":c)}}}),r.extend({valHooks:{option:{get:function(a){var b=r.find.attr(a,"value");return null!=b?b:pb(r.text(a))}},select:{get:function(a){var b,c,d,e=a.options,f=a.selectedIndex,g="select-one"===a.type,h=g?null:[],i=g?f+1:e.length;for(d=f<0?i:g?f:0;d<i;d++)if(c=e[d],(c.selected||d===f)&&!c.disabled&&(!c.parentNode.disabled||!B(c.parentNode,"optgroup"))){if(b=r(c).val(),g)return b;h.push(b)}return h},set:function(a,b){var c,d,e=a.options,f=r.makeArray(b),g=e.length;while(g--)d=e[g],(d.selected=r.inArray(r.valHooks.option.get(d),f)>-1)&&(c=!0);return c||(a.selectedIndex=-1),f}}}}),r.each(["radio","checkbox"],function(){r.valHooks[this]={set:function(a,b){if(Array.isArray(b))return a.checked=r.inArray(r(a).val(),b)>-1}},o.checkOn||(r.valHooks[this].get=function(a){return null===a.getAttribute("value")?"on":a.value})});var sb=/^(?:focusinfocus|focusoutblur)$/;r.extend(r.event,{trigger:function(b,c,e,f){var g,h,i,j,k,m,n,o=[e||d],p=l.call(b,"type")?b.type:b,q=l.call(b,"namespace")?b.namespace.split("."):[];if(h=i=e=e||d,3!==e.nodeType&&8!==e.nodeType&&!sb.test(p+r.event.triggered)&&(p.indexOf(".")>-1&&(q=p.split("."),p=q.shift(),q.sort()),k=p.indexOf(":")<0&&"on"+p,b=b[r.expando]?b:new r.Event(p,"object"==typeof b&&b),b.isTrigger=f?2:3,b.namespace=q.join("."),b.rnamespace=b.namespace?new RegExp("(^|\\.)"+q.join("\\.(?:.*\\.|)")+"(\\.|$)"):null,b.result=void 0,b.target||(b.target=e),c=null==c?[b]:r.makeArray(c,[b]),n=r.event.special[p]||{},f||!n.trigger||n.trigger.apply(e,c)!==!1)){if(!f&&!n.noBubble&&!r.isWindow(e)){for(j=n.delegateType||p,sb.test(j+p)||(h=h.parentNode);h;h=h.parentNode)o.push(h),i=h;i===(e.ownerDocument||d)&&o.push(i.defaultView||i.parentWindow||a)}g=0;while((h=o[g++])&&!b.isPropagationStopped())b.type=g>1?j:n.bindType||p,m=(W.get(h,"events")||{})[b.type]&&W.get(h,"handle"),m&&m.apply(h,c),m=k&&h[k],m&&m.apply&&U(h)&&(b.result=m.apply(h,c),b.result===!1&&b.preventDefault());return b.type=p,f||b.isDefaultPrevented()||n._default&&n._default.apply(o.pop(),c)!==!1||!U(e)||k&&r.isFunction(e[p])&&!r.isWindow(e)&&(i=e[k],i&&(e[k]=null),r.event.triggered=p,e[p](),r.event.triggered=void 0,i&&(e[k]=i)),b.result}},simulate:function(a,b,c){var d=r.extend(new r.Event,c,{type:a,isSimulated:!0});r.event.trigger(d,null,b)}}),r.fn.extend({trigger:function(a,b){return this.each(function(){r.event.trigger(a,b,this)})},triggerHandler:function(a,b){var c=this[0];if(c)return r.event.trigger(a,b,c,!0)}}),r.each("blur focus focusin focusout resize scroll click dblclick mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave change select submit keydown keypress keyup contextmenu".split(" "),function(a,b){r.fn[b]=function(a,c){return arguments.length>0?this.on(b,null,a,c):this.trigger(b)}}),r.fn.extend({hover:function(a,b){return this.mouseenter(a).mouseleave(b||a)}}),o.focusin="onfocusin"in a,o.focusin||r.each({focus:"focusin",blur:"focusout"},function(a,b){var c=function(a){r.event.simulate(b,a.target,r.event.fix(a))};r.event.special[b]={setup:function(){var d=this.ownerDocument||this,e=W.access(d,b);e||d.addEventListener(a,c,!0),W.access(d,b,(e||0)+1)},teardown:function(){var d=this.ownerDocument||this,e=W.access(d,b)-1;e?W.access(d,b,e):(d.removeEventListener(a,c,!0),W.remove(d,b))}}});var tb=a.location,ub=r.now(),vb=/\?/;r.parseXML=function(b){var c;if(!b||"string"!=typeof b)return null;try{c=(new a.DOMParser).parseFromString(b,"text/xml")}catch(d){c=void 0}return c&&!c.getElementsByTagName("parsererror").length||r.error("Invalid XML: "+b),c};var wb=/\[\]$/,xb=/\r?\n/g,yb=/^(?:submit|button|image|reset|file)$/i,zb=/^(?:input|select|textarea|keygen)/i;function Ab(a,b,c,d){var e;if(Array.isArray(b))r.each(b,function(b,e){c||wb.test(a)?d(a,e):Ab(a+"["+("object"==typeof e&&null!=e?b:"")+"]",e,c,d)});else if(c||"object"!==r.type(b))d(a,b);else for(e in b)Ab(a+"["+e+"]",b[e],c,d)}r.param=function(a,b){var c,d=[],e=function(a,b){var c=r.isFunction(b)?b():b;d[d.length]=encodeURIComponent(a)+"="+encodeURIComponent(null==c?"":c)};if(Array.isArray(a)||a.jquery&&!r.isPlainObject(a))r.each(a,function(){e(this.name,this.value)});else for(c in a)Ab(c,a[c],b,e);return d.join("&")},r.fn.extend({serialize:function(){return r.param(this.serializeArray())},serializeArray:function(){return this.map(function(){var a=r.prop(this,"elements");return a?r.makeArray(a):this}).filter(function(){var a=this.type;return this.name&&!r(this).is(":disabled")&&zb.test(this.nodeName)&&!yb.test(a)&&(this.checked||!ja.test(a))}).map(function(a,b){var c=r(this).val();return null==c?null:Array.isArray(c)?r.map(c,function(a){return{name:b.name,value:a.replace(xb,"\r\n")}}):{name:b.name,value:c.replace(xb,"\r\n")}}).get()}});var Bb=/%20/g,Cb=/#.*$/,Db=/([?&])_=[^&]*/,Eb=/^(.*?):[ \t]*([^\r\n]*)$/gm,Fb=/^(?:about|app|app-storage|.+-extension|file|res|widget):$/,Gb=/^(?:GET|HEAD)$/,Hb=/^\/\//,Ib={},Jb={},Kb="*/".concat("*"),Lb=d.createElement("a");Lb.href=tb.href;function Mb(a){return function(b,c){"string"!=typeof b&&(c=b,b="*");var d,e=0,f=b.toLowerCase().match(L)||[];if(r.isFunction(c))while(d=f[e++])"+"===d[0]?(d=d.slice(1)||"*",(a[d]=a[d]||[]).unshift(c)):(a[d]=a[d]||[]).push(c)}}function Nb(a,b,c,d){var e={},f=a===Jb;function g(h){var i;return e[h]=!0,r.each(a[h]||[],function(a,h){var j=h(b,c,d);return"string"!=typeof j||f||e[j]?f?!(i=j):void 0:(b.dataTypes.unshift(j),g(j),!1)}),i}return g(b.dataTypes[0])||!e["*"]&&g("*")}function Ob(a,b){var c,d,e=r.ajaxSettings.flatOptions||{};for(c in b)void 0!==b[c]&&((e[c]?a:d||(d={}))[c]=b[c]);return d&&r.extend(!0,a,d),a}function Pb(a,b,c){var d,e,f,g,h=a.contents,i=a.dataTypes;while("*"===i[0])i.shift(),void 0===d&&(d=a.mimeType||b.getResponseHeader("Content-Type"));if(d)for(e in h)if(h[e]&&h[e].test(d)){i.unshift(e);break}if(i[0]in c)f=i[0];else{for(e in c){if(!i[0]||a.converters[e+" "+i[0]]){f=e;break}g||(g=e)}f=f||g}if(f)return f!==i[0]&&i.unshift(f),c[f]}function Qb(a,b,c,d){var e,f,g,h,i,j={},k=a.dataTypes.slice();if(k[1])for(g in a.converters)j[g.toLowerCase()]=a.converters[g];f=k.shift();while(f)if(a.responseFields[f]&&(c[a.responseFields[f]]=b),!i&&d&&a.dataFilter&&(b=a.dataFilter(b,a.dataType)),i=f,f=k.shift())if("*"===f)f=i;else if("*"!==i&&i!==f){if(g=j[i+" "+f]||j["* "+f],!g)for(e in j)if(h=e.split(" "),h[1]===f&&(g=j[i+" "+h[0]]||j["* "+h[0]])){g===!0?g=j[e]:j[e]!==!0&&(f=h[0],k.unshift(h[1]));break}if(g!==!0)if(g&&a["throws"])b=g(b);else try{b=g(b)}catch(l){return{state:"parsererror",error:g?l:"No conversion from "+i+" to "+f}}}return{state:"success",data:b}}r.extend({active:0,lastModified:{},etag:{},ajaxSettings:{url:tb.href,type:"GET",isLocal:Fb.test(tb.protocol),global:!0,processData:!0,async:!0,contentType:"application/x-www-form-urlencoded; charset=UTF-8",accepts:{"*":Kb,text:"text/plain",html:"text/html",xml:"application/xml, text/xml",json:"application/json, text/javascript"},contents:{xml:/\bxml\b/,html:/\bhtml/,json:/\bjson\b/},responseFields:{xml:"responseXML",text:"responseText",json:"responseJSON"},converters:{"* text":String,"text html":!0,"text json":JSON.parse,"text xml":r.parseXML},flatOptions:{url:!0,context:!0}},ajaxSetup:function(a,b){return b?Ob(Ob(a,r.ajaxSettings),b):Ob(r.ajaxSettings,a)},ajaxPrefilter:Mb(Ib),ajaxTransport:Mb(Jb),ajax:function(b,c){"object"==typeof b&&(c=b,b=void 0),c=c||{};var e,f,g,h,i,j,k,l,m,n,o=r.ajaxSetup({},c),p=o.context||o,q=o.context&&(p.nodeType||p.jquery)?r(p):r.event,s=r.Deferred(),t=r.Callbacks("once memory"),u=o.statusCode||{},v={},w={},x="canceled",y={readyState:0,getResponseHeader:function(a){var b;if(k){if(!h){h={};while(b=Eb.exec(g))h[b[1].toLowerCase()]=b[2]}b=h[a.toLowerCase()]}return null==b?null:b},getAllResponseHeaders:function(){return k?g:null},setRequestHeader:function(a,b){return null==k&&(a=w[a.toLowerCase()]=w[a.toLowerCase()]||a,v[a]=b),this},overrideMimeType:function(a){return null==k&&(o.mimeType=a),this},statusCode:function(a){var b;if(a)if(k)y.always(a[y.status]);else for(b in a)u[b]=[u[b],a[b]];return this},abort:function(a){var b=a||x;return e&&e.abort(b),A(0,b),this}};if(s.promise(y),o.url=((b||o.url||tb.href)+"").replace(Hb,tb.protocol+"//"),o.type=c.method||c.type||o.method||o.type,o.dataTypes=(o.dataType||"*").toLowerCase().match(L)||[""],null==o.crossDomain){j=d.createElement("a");try{j.href=o.url,j.href=j.href,o.crossDomain=Lb.protocol+"//"+Lb.host!=j.protocol+"//"+j.host}catch(z){o.crossDomain=!0}}if(o.data&&o.processData&&"string"!=typeof o.data&&(o.data=r.param(o.data,o.traditional)),Nb(Ib,o,c,y),k)return y;l=r.event&&o.global,l&&0===r.active++&&r.event.trigger("ajaxStart"),o.type=o.type.toUpperCase(),o.hasContent=!Gb.test(o.type),f=o.url.replace(Cb,""),o.hasContent?o.data&&o.processData&&0===(o.contentType||"").indexOf("application/x-www-form-urlencoded")&&(o.data=o.data.replace(Bb,"+")):(n=o.url.slice(f.length),o.data&&(f+=(vb.test(f)?"&":"?")+o.data,delete o.data),o.cache===!1&&(f=f.replace(Db,"$1"),n=(vb.test(f)?"&":"?")+"_="+ub++ +n),o.url=f+n),o.ifModified&&(r.lastModified[f]&&y.setRequestHeader("If-Modified-Since",r.lastModified[f]),r.etag[f]&&y.setRequestHeader("If-None-Match",r.etag[f])),(o.data&&o.hasContent&&o.contentType!==!1||c.contentType)&&y.setRequestHeader("Content-Type",o.contentType),y.setRequestHeader("Accept",o.dataTypes[0]&&o.accepts[o.dataTypes[0]]?o.accepts[o.dataTypes[0]]+("*"!==o.dataTypes[0]?", "+Kb+"; q=0.01":""):o.accepts["*"]);for(m in o.headers)y.setRequestHeader(m,o.headers[m]);if(o.beforeSend&&(o.beforeSend.call(p,y,o)===!1||k))return y.abort();if(x="abort",t.add(o.complete),y.done(o.success),y.fail(o.error),e=Nb(Jb,o,c,y)){if(y.readyState=1,l&&q.trigger("ajaxSend",[y,o]),k)return y;o.async&&o.timeout>0&&(i=a.setTimeout(function(){y.abort("timeout")},o.timeout));try{k=!1,e.send(v,A)}catch(z){if(k)throw z;A(-1,z)}}else A(-1,"No Transport");function A(b,c,d,h){var j,m,n,v,w,x=c;k||(k=!0,i&&a.clearTimeout(i),e=void 0,g=h||"",y.readyState=b>0?4:0,j=b>=200&&b<300||304===b,d&&(v=Pb(o,y,d)),v=Qb(o,v,y,j),j?(o.ifModified&&(w=y.getResponseHeader("Last-Modified"),w&&(r.lastModified[f]=w),w=y.getResponseHeader("etag"),w&&(r.etag[f]=w)),204===b||"HEAD"===o.type?x="nocontent":304===b?x="notmodified":(x=v.state,m=v.data,n=v.error,j=!n)):(n=x,!b&&x||(x="error",b<0&&(b=0))),y.status=b,y.statusText=(c||x)+"",j?s.resolveWith(p,[m,x,y]):s.rejectWith(p,[y,x,n]),y.statusCode(u),u=void 0,l&&q.trigger(j?"ajaxSuccess":"ajaxError",[y,o,j?m:n]),t.fireWith(p,[y,x]),l&&(q.trigger("ajaxComplete",[y,o]),--r.active||r.event.trigger("ajaxStop")))}return y},getJSON:function(a,b,c){return r.get(a,b,c,"json")},getScript:function(a,b){return r.get(a,void 0,b,"script")}}),r.each(["get","post"],function(a,b){r[b]=function(a,c,d,e){return r.isFunction(c)&&(e=e||d,d=c,c=void 0),r.ajax(r.extend({url:a,type:b,dataType:e,data:c,success:d},r.isPlainObject(a)&&a))}}),r._evalUrl=function(a){return r.ajax({url:a,type:"GET",dataType:"script",cache:!0,async:!1,global:!1,"throws":!0})},r.fn.extend({wrapAll:function(a){var b;return this[0]&&(r.isFunction(a)&&(a=a.call(this[0])),b=r(a,this[0].ownerDocument).eq(0).clone(!0),this[0].parentNode&&b.insertBefore(this[0]),b.map(function(){var a=this;while(a.firstElementChild)a=a.firstElementChild;return a}).append(this)),this},wrapInner:function(a){return r.isFunction(a)?this.each(function(b){r(this).wrapInner(a.call(this,b))}):this.each(function(){var b=r(this),c=b.contents();c.length?c.wrapAll(a):b.append(a)})},wrap:function(a){var b=r.isFunction(a);return this.each(function(c){r(this).wrapAll(b?a.call(this,c):a)})},unwrap:function(a){return this.parent(a).not("body").each(function(){r(this).replaceWith(this.childNodes)}),this}}),r.expr.pseudos.hidden=function(a){return!r.expr.pseudos.visible(a)},r.expr.pseudos.visible=function(a){return!!(a.offsetWidth||a.offsetHeight||a.getClientRects().length)},r.ajaxSettings.xhr=function(){try{return new a.XMLHttpRequest}catch(b){}};var Rb={0:200,1223:204},Sb=r.ajaxSettings.xhr();o.cors=!!Sb&&"withCredentials"in Sb,o.ajax=Sb=!!Sb,r.ajaxTransport(function(b){var c,d;if(o.cors||Sb&&!b.crossDomain)return{send:function(e,f){var g,h=b.xhr();if(h.open(b.type,b.url,b.async,b.username,b.password),b.xhrFields)for(g in b.xhrFields)h[g]=b.xhrFields[g];b.mimeType&&h.overrideMimeType&&h.overrideMimeType(b.mimeType),b.crossDomain||e["X-Requested-With"]||(e["X-Requested-With"]="XMLHttpRequest");for(g in e)h.setRequestHeader(g,e[g]);c=function(a){return function(){c&&(c=d=h.onload=h.onerror=h.onabort=h.onreadystatechange=null,"abort"===a?h.abort():"error"===a?"number"!=typeof h.status?f(0,"error"):f(h.status,h.statusText):f(Rb[h.status]||h.status,h.statusText,"text"!==(h.responseType||"text")||"string"!=typeof h.responseText?{binary:h.response}:{text:h.responseText},h.getAllResponseHeaders()))}},h.onload=c(),d=h.onerror=c("error"),void 0!==h.onabort?h.onabort=d:h.onreadystatechange=function(){4===h.readyState&&a.setTimeout(function(){c&&d()})},c=c("abort");try{h.send(b.hasContent&&b.data||null)}catch(i){if(c)throw i}},abort:function(){c&&c()}}}),r.ajaxPrefilter(function(a){a.crossDomain&&(a.contents.script=!1)}),r.ajaxSetup({accepts:{script:"text/javascript, application/javascript, application/ecmascript, application/x-ecmascript"},contents:{script:/\b(?:java|ecma)script\b/},converters:{"text script":function(a){return r.globalEval(a),a}}}),r.ajaxPrefilter("script",function(a){void 0===a.cache&&(a.cache=!1),a.crossDomain&&(a.type="GET")}),r.ajaxTransport("script",function(a){if(a.crossDomain){var b,c;return{send:function(e,f){b=r("<script>").prop({charset:a.scriptCharset,src:a.url}).on("load error",c=function(a){b.remove(),c=null,a&&f("error"===a.type?404:200,a.type)}),d.head.appendChild(b[0])},abort:function(){c&&c()}}}});var Tb=[],Ub=/(=)\?(?=&|$)|\?\?/;r.ajaxSetup({jsonp:"callback",jsonpCallback:function(){var a=Tb.pop()||r.expando+"_"+ub++;return this[a]=!0,a}}),r.ajaxPrefilter("json jsonp",function(b,c,d){var e,f,g,h=b.jsonp!==!1&&(Ub.test(b.url)?"url":"string"==typeof b.data&&0===(b.contentType||"").indexOf("application/x-www-form-urlencoded")&&Ub.test(b.data)&&"data");if(h||"jsonp"===b.dataTypes[0])return e=b.jsonpCallback=r.isFunction(b.jsonpCallback)?b.jsonpCallback():b.jsonpCallback,h?b[h]=b[h].replace(Ub,"$1"+e):b.jsonp!==!1&&(b.url+=(vb.test(b.url)?"&":"?")+b.jsonp+"="+e),b.converters["script json"]=function(){return g||r.error(e+" was not called"),g[0]},b.dataTypes[0]="json",f=a[e],a[e]=function(){g=arguments},d.always(function(){void 0===f?r(a).removeProp(e):a[e]=f,b[e]&&(b.jsonpCallback=c.jsonpCallback,Tb.push(e)),g&&r.isFunction(f)&&f(g[0]),g=f=void 0}),"script"}),o.createHTMLDocument=function(){var a=d.implementation.createHTMLDocument("").body;return a.innerHTML="<form></form><form></form>",2===a.childNodes.length}(),r.parseHTML=function(a,b,c){if("string"!=typeof a)return[];"boolean"==typeof b&&(c=b,b=!1);var e,f,g;return b||(o.createHTMLDocument?(b=d.implementation.createHTMLDocument(""),e=b.createElement("base"),e.href=d.location.href,b.head.appendChild(e)):b=d),f=C.exec(a),g=!c&&[],f?[b.createElement(f[1])]:(f=qa([a],b,g),g&&g.length&&r(g).remove(),r.merge([],f.childNodes))},r.fn.load=function(a,b,c){var d,e,f,g=this,h=a.indexOf(" ");return h>-1&&(d=pb(a.slice(h)),a=a.slice(0,h)),r.isFunction(b)?(c=b,b=void 0):b&&"object"==typeof b&&(e="POST"),g.length>0&&r.ajax({url:a,type:e||"GET",dataType:"html",data:b}).done(function(a){f=arguments,g.html(d?r("<div>").append(r.parseHTML(a)).find(d):a)}).always(c&&function(a,b){g.each(function(){c.apply(this,f||[a.responseText,b,a])})}),this},r.each(["ajaxStart","ajaxStop","ajaxComplete","ajaxError","ajaxSuccess","ajaxSend"],function(a,b){r.fn[b]=function(a){return this.on(b,a)}}),r.expr.pseudos.animated=function(a){return r.grep(r.timers,function(b){return a===b.elem}).length},r.offset={setOffset:function(a,b,c){var d,e,f,g,h,i,j,k=r.css(a,"position"),l=r(a),m={};"static"===k&&(a.style.position="relative"),h=l.offset(),f=r.css(a,"top"),i=r.css(a,"left"),j=("absolute"===k||"fixed"===k)&&(f+i).indexOf("auto")>-1,j?(d=l.position(),g=d.top,e=d.left):(g=parseFloat(f)||0,e=parseFloat(i)||0),r.isFunction(b)&&(b=b.call(a,c,r.extend({},h))),null!=b.top&&(m.top=b.top-h.top+g),null!=b.left&&(m.left=b.left-h.left+e),"using"in b?b.using.call(a,m):l.css(m)}},r.fn.extend({offset:function(a){if(arguments.length)return void 0===a?this:this.each(function(b){r.offset.setOffset(this,a,b)});var b,c,d,e,f=this[0];if(f)return f.getClientRects().length?(d=f.getBoundingClientRect(),b=f.ownerDocument,c=b.documentElement,e=b.defaultView,{top:d.top+e.pageYOffset-c.clientTop,left:d.left+e.pageXOffset-c.clientLeft}):{top:0,left:0}},position:function(){if(this[0]){var a,b,c=this[0],d={top:0,left:0};return"fixed"===r.css(c,"position")?b=c.getBoundingClientRect():(a=this.offsetParent(),b=this.offset(),B(a[0],"html")||(d=a.offset()),d={top:d.top+r.css(a[0],"borderTopWidth",!0),left:d.left+r.css(a[0],"borderLeftWidth",!0)}),{top:b.top-d.top-r.css(c,"marginTop",!0),left:b.left-d.left-r.css(c,"marginLeft",!0)}}},offsetParent:function(){return this.map(function(){var a=this.offsetParent;while(a&&"static"===r.css(a,"position"))a=a.offsetParent;return a||ra})}}),r.each({scrollLeft:"pageXOffset",scrollTop:"pageYOffset"},function(a,b){var c="pageYOffset"===b;r.fn[a]=function(d){return T(this,function(a,d,e){var f;return r.isWindow(a)?f=a:9===a.nodeType&&(f=a.defaultView),void 0===e?f?f[b]:a[d]:void(f?f.scrollTo(c?f.pageXOffset:e,c?e:f.pageYOffset):a[d]=e)},a,d,arguments.length)}}),r.each(["top","left"],function(a,b){r.cssHooks[b]=Pa(o.pixelPosition,function(a,c){if(c)return c=Oa(a,b),Ma.test(c)?r(a).position()[b]+"px":c})}),r.each({Height:"height",Width:"width"},function(a,b){r.each({padding:"inner"+a,content:b,"":"outer"+a},function(c,d){r.fn[d]=function(e,f){var g=arguments.length&&(c||"boolean"!=typeof e),h=c||(e===!0||f===!0?"margin":"border");return T(this,function(b,c,e){var f;return r.isWindow(b)?0===d.indexOf("outer")?b["inner"+a]:b.document.documentElement["client"+a]:9===b.nodeType?(f=b.documentElement,Math.max(b.body["scroll"+a],f["scroll"+a],b.body["offset"+a],f["offset"+a],f["client"+a])):void 0===e?r.css(b,c,h):r.style(b,c,e,h)},b,g?e:void 0,g)}})}),r.fn.extend({bind:function(a,b,c){return this.on(a,null,b,c)},unbind:function(a,b){return this.off(a,null,b)},delegate:function(a,b,c,d){return this.on(b,a,c,d)},undelegate:function(a,b,c){return 1===arguments.length?this.off(a,"**"):this.off(b,a||"**",c)}}),r.holdReady=function(a){a?r.readyWait++:r.ready(!0)},r.isArray=Array.isArray,r.parseJSON=JSON.parse,r.nodeName=B,"function"==typeof define&&define.amd&&define("jquery",[],function(){return r});var Vb=a.jQuery,Wb=a.$;return r.noConflict=function(b){return a.$===r&&(a.$=Wb),b&&a.jQuery===r&&(a.jQuery=Vb),r},b||(a.jQuery=a.$=r),r};

/*==============================================================================
| uBlock Protector Website Rules                                               |
| Pulled & Converted from https://github.com/jspenguin2017/uBlockProtector     |
===============================================================================*/


/*=========================================================================
| AAK Website Rules                                                       |
| (Please keep in alphabetical order to avoid unnecessary duplicates.)    |
==========================================================================*/

//@pragma-keepline uBlock Protector Rules Start
//@pragma-keepline Solutions from Anti-Adblock Killer (originally by Reek) are modified to fit my Core API
//@pragma-keepline Anti-Adblock Killer Repository (contains original source code and license): https://github.com/reek/anti-adblock-killer

//Initialization
a.init({
    all: a.domCmp(["360.cn", "apple.com", "ask.com", "baidu.com", "bing.com", "bufferapp.com",
        "chromeactions.com", "easyinplay.net", "ebay.com", "facebook.com", "flattr.com", "flickr.com",
        "ghacks.net", "imdb.com", "imgbox.com", "imgur.com", "instagram.com", "jsbin.com", "jsfiddle.net",
        "linkedin.com", "live.com", "mail.ru", "microsoft.com", "msn.com", "paypal.com", "pinterest.com",
        "preloaders.net", "qq.com", "reddit.com", "stackoverflow.com", "tampermonkey.net", "twitter.com",
        "vimeo.com", "wikipedia.org", "w3schools.com", "yandex.ru", "youtu.be", "youtube.com", "xemvtv.net",
        "vod.pl", "agar.io", "pandoon.info", "fsf.org", "adblockplus.org", "plnkr.co", "exacttarget.com",
        "dolldivine.com", "popmech.ru", "calm.com", "chatango.com", "spaste.com"], true) || 
        a.domInc(["192.168.0", "192.168.1", "google", "google.co", "google.com", "amazon", "ebay", "yahoo"], true),
    Adfly: a.domCmp(["adf.ly", "ay.gy", "j.gs", "q.gs", "gamecopyworld.click", "babblecase.com",
        "pintient.com", "atominik.com", "bluenik.com", "sostieni.ilwebmaster21.com", "auto-login-xxx.com",
        "microify.com", "riffhold.com"]),
    adsjsV2: !a.domCmp(["gamersclub.com.br", "uploadboy.com", "vidoza.net", "videohelp.com", "zeiz.me",
        "passionea300allora.it", "memurlar.net", "palemoon.org", "stocks.cafe", "listamais.com.br",
         "acquavivalive.it"]),
    NoAdBlock: a.domCmp([], true)
});

    
//Rules start
if (a.domCmp(["aetv.com", "history.com", "mylifetime.com"])) {
    a.addScript(() => {
        "use strict";
        let val;
        window.Object.defineProperty(window, "_sp_", {
            configurable: false,
            set(value) {
                val = value;
            },
            get() {
                //Patch detection
                try {
                    val.checkState = (e) => { e(false); };
                    val.isAdBlocking = (e) => { e(false); };
                    delete val._detectionInstance;
                } catch (err) { }
                return val;
            },
        });
    });
}
if (a.domCmp(["blockadblock.com"])) {
    a.filter("eval");
    a.ready(() => {
        a.$("#babasbmsgx").remove();
    });
}
if (a.domCmp(["sc2casts.com"])) {
    a.readOnly("scriptfailed", () => { });
    a.filter("setTimeout");
}
if (a.domCmp(["jagranjunction.com"])) {
    a.readOnly("canRunAds", true);
    a.readOnly("isAdsDisplayed", true);
}
if (a.domCmp(["usapoliticstoday.com"])) {
    a.filter("eval");
}
if (a.domCmp(["jansatta.com", "financialexpress.com", "indianexpress.com"])) {
    a.readOnly("RunAds", true);
}
if (a.domCmp(["livemint.com"])) {
    a.readOnly("canRun1", true);
}
if (a.domCmp(["userscloud.com"])) {
    a.on("load", () => {
        a.$("#dl_link").show();
        a.$("#adblock_msg").remove();
    });
}
if (a.domCmp(["vidlox.tv", "vidoza.net"])) {
    //NSFW!
    a.readOnly("xRds", false);
    a.readOnly("cRAds", true);
}
if (a.domCmp(["cwtv.com"])) {
    //Thanks to szymon1118
    a.readOnly("wallConfig", false);
}
if (a.domCmp(["theinquirer.net"])) {
    a.readOnly("_r3z", true);
}
if (a.domCmp(["tweaktown.com"])) {
    a.on("load", () => {
        //Force enable scrolling
        a.css("html, body { overflow:scroll; }");
        //Watch and remove block screen
        const blockScreenRemover = () => {
            if (a.$("body").children("div").last().text().indexOf("Ads slowing you down?") > -1) {
                a.$("body").children("div").last().remove();
                a.$("body").children("div").last().remove();
            } else {
                a.setTimeout(blockScreenRemover, 500);
            }
        };
        a.setTimeout(blockScreenRemover, 500);
    });
}
if (a.domCmp(["ratemyprofessors.com"])) {
    a.readOnly("adBlocker", false);
    a.filter("addEventListener", a.matchMethod.RegExp, /^resize$/i);
}
if (a.domCmp(["gamepedia.com"])) {
    a.on("load", () => {
        a.$("#atflb").remove();
    });
}
if (a.domCmp(["cbox.ws"])) {
    a.readOnly("koddostu_com_adblock_yok", true);
}
if (a.domCmp(["pinkrod.com", "wetplace.com"])) {
    //NSFW!
    a.readOnly("getAd", () => { });
    a.readOnly("getUtm", () => { });
}
if (a.domInc(["hackintosh"])) {
    //Undo BlockAdblock styles
    a.readOnly("eval", () => {
        a.$("#babasbmsgx").remove();
        a.doc.body.style.setProperty("visibility", "visible", "important");
    });
    //Prevent article hidding
    if (a.domCmp(["hackintosh.computer"], true)) {
        a.noAccess("google_jobrunner");
    }
}
if (a.domCmp(["tvregionalna24.pl"])) {
    let text = [];
    const matcher = /var _ended=(.*);var _skipButton/;
    a.readOnly("videojs", (a, b, func) => {
        let temp = "(" + matcher.exec(String(func))[1] + ")();";
        temp = temp.replace("player.dispose();", "");
        text.push(temp);
    });
    a.on("load", function replace() {
        if (text.length > 0 && a.$(".vjs-poster").length > 0) {
            for (let i = 0; i < text.length; i++) {
                a.win.eval(text[i]);
            }
        } else {
            a.setTimeout(replace, 1000);
        }
    });
}
if (a.domCmp(["tvn.pl", "tvnstyle.pl", "tvnturbo.pl", "kuchniaplus.pl", "miniminiplus.pl"])) {
    //tvn.pl and related domains
    //Replace player - Thanks to mikhoul, szymon1118, and xxcriticxx
    //Potential related domains: "tvnfabula.pl", "itvnextra.pl", "tvn24bis.pl", "ttv.pl",
    //"x-news.pl", "tvn7.pl", "itvn.pl"
    const homePages = ["http://www.tvn.pl/", "http://www.tvnstyle.pl/", "http://www.tvnturbo.pl/"];
    //Homepages are partially fixed and are handled by List
    if (!homePages.includes(a.doc.location.href)) {
        a.on("load", () => {
            a.$(".videoPlayer").parent().after(a.nativePlayer(a.$(".videoPlayer").data("src"))).remove();
        });
    }
}
if (a.domCmp(["player.pl"])) {
    const matcher = /[.,]/;
    a.on("load", () => {
        //Check element
        let elem;
        if (a.$("header.detailImage").length > 0) {
            elem = a.$("header.detailImage");
        } else {
            return;
        }
        //Get ID
        const parts = a.doc.location.href.split(matcher);
        const id = parts[parts.length - 2];
        const params = {
            platform: "ConnectedTV",
            terminal: "Panasonic",
            format: "json",
            authKey: "064fda5ab26dc1dd936f5c6e84b7d3c2",
            v: "3.1",
            m: "getItem",
            id: id,
        };
        const api = "https://api.tvnplayer.pl/api/?" + a.serialize(params);
        const proxy = "http://www.proxy.xmc.pl/index.php?hl=3e5&q=";
        //Send request
        const requestURL = (a.cookie("tvn_location2") === "1") ? api : proxy +
            a.win.encodeURIComponent(api);
        GM_xmlhttpRequest({
            method: "GET",
            url: requestURL,
            onload(result) {
                //Find media url
                let url;
                try {
                    let data = JSON.parse(result.responseText);
                    let vidSources = data.item.videos.main.video_content;
                    if (vidSources[1].url) {
                        //Native player
                        elem.html("").append(a.nativePlayer(vidSources[1].url));
                        a.$("video").css("max-height", "540px");
                    } else if (vidSources[0].src) {
                        //DRM protected
                        a.out.error("AAK will not replace this video player " +
                            "because it is DRM prtected.");
                    }
                } catch (err) {
                    a.out.error("AAK failed to find media URL!");
                }
            },
            onerror() {
                a.out.error("AAK failed to find media URL!");
            },
        });
    });
}
if (a.domCmp(["abczdrowie.pl", "autokrata.pl", "autokult.pl", "biztok.pl", "gadzetomania.pl", "hotmoney.pl",
    "kafeteria.pl", "kafeteria.tv", "komediowo.pl", "komorkomania.pl", "money.pl", "pudelek.tv", "sfora.pl",
    "snobka.pl", "wawalove.pl", "wp.pl", "wp.tv", "wrzuta.pl", "pudelek.pl", "fotoblogia.pl", "parenting.pl",
    "echirurgia.pl", "pudelekx.pl", "o2.pl", "kardiolo.pl"])) {
    //Issue: https://github.com/jspenguin2017/uBlockProtector/issues/70
    //Thanks to ghajini
    a.cookie("ABCABC", "true");
    a.filter("addEventListener", a.matchMethod.stringExact, "advertisement");
    a.readOnly("hasSentinel", () => false);
}
/*
if (a.domCmp(["abczdrowie.pl", "autokrata.pl", "autokult.pl", "biztok.pl", "gadzetomania.pl", "hotmoney.pl",
"kafeteria.pl", "kafeteria.tv", "komediowo.pl", "komorkomania.pl", "money.pl", "pudelek.tv", "sfora.pl",
"snobka.pl", "wawalove.pl", "wp.pl", "wp.tv", "wrzuta.pl", "pudelek.pl", "fotoblogia.pl"]) &&
!a.domCmp(["i.wp.pl"], true)) {
*/
if (a.domCmp(["money.pl", "parenting.pl", "tech.wp.pl", "sportowefakty.wp.pl", "teleshow.wp.pl", "moto.wp.pl"], true)) {
    //wp.pl and related domains
    //Thanks to szymon1118
    //Variables
    let mid; //Media ID of next video
    let midArray1 = []; //Media IDs method 1
    let midArray2 = []; //Media IDs method 2
    let url = null; //URL of the next video
    let replaceCounter = 0; //The number of video players that are replaced
    let loadCounter = 0; //The index of next item to load
    let networkBusy = false; //A flag to prevent sending a new request before the first one is done
    let networkErrorCounter = 0; //Will stop sending request if this is over 5
    let isInBackground = false; //A flag to prevent excessive CPU usage when the tab is in background
    //The player container matcher
    let containerMatcher = ".wp-player-outer, .player__container, .wp-player, .embed-container";
    //if (a.domCmp(["wp.tv"], true)) {
    //    containerMatcher = "";
    //}
    //if (a.domCmp(["wiadomosci.wp.pl"], true)) {
    //    containerMatcher = ".wp-player";
    //}
    //if (a.domCmp(["autokult.pl"], true)) {
    //    containerMatcher = ".embed-container";
    //}
    const matcher = /mid[=,]([0-9]+)/;
    //Main function
    const main = () => {
        //Do not tick when in background
        if (isInBackground) {
            return;
        }
        //Log media ID arrays
        a.config.debugMode && a.out.log(midArray1, midArray2);
        //Mid grabbing method 1
        try {
            if (a.win.WP.player.list.length > midArray1.length) {
                let thisMid = a.win.WP.player.list[midArray1.length].p.url;
                if (thisMid) {
                    thisMid = thisMid.substring(thisMid.lastIndexOf("=") + 1);
                }
                //Extra safety check
                if (thisMid) {
                    midArray1.push(thisMid);
                }
            }
        } catch (err) {
            a.out.error("AAK failed to find media ID with method 1!");
        }
        //Mid grabbing method 2
        if (a.$(containerMatcher).length > 0) {
            const elem = a.$(containerMatcher).first().find(".titlecont a.title");
            let thisMid = elem.attr("href");
            //Check if I got the element
            if (thisMid) {
                thisMid = matcher.exec(thisMid)[1].toString();
                //I will destroy the player soon anyway, I will remove this now so I will not grab it twice
                elem.remove();
            }
            //Extra safety check
            if (thisMid) {
                midArray2.push(thisMid);
            }
        }
        //See if I need to load next URL
        if (loadCounter === replaceCounter) {
            //Check flag and error counter
            if (networkBusy || networkErrorCounter > 5) {
                return;
            }
            //Get media ID
            let mid;
            //Prefer media ID grabbing method 2
            let midArray = (midArray1.length > midArray2.length) ? midArray1 : midArray2;
            if (midArray.length > loadCounter) {
                mid = midArray[loadCounter];
            } else {
                return;
            }
            //Get media JSON, I do not need to check if mid is found since the function will return if it is not
            networkBusy = true;
            GM_xmlhttpRequest({
                method: "GET",
                url: `http://wp.tv/player/mid,${mid},embed.json`,
                onload(res) {
                    //Try to find media URL
                    try {
                        const response = JSON.parse(res.responseText);
                        for (let i = 0; i < response.clip.url.length; i++) {
                            let item = response.clip.url[i];
                            if (item.quality === "HQ" && item.type.startsWith("mp4")) {
                                url = item.url;
                                break;
                            }
                        }
                        //Check if I found the URL
                        if (!url) {
                            throw "Media URL Not Found";
                        }
                        //Update counter
                        loadCounter++;
                        //Reset error counter
                        networkErrorCounter = 0;
                    } catch (err) {
                        a.out.error("AAK failed to find media URL!");
                        networkErrorCounter += 1;
                    }
                    //Update flag
                    networkBusy = false;
                },
                onerror() {
                    a.out.error("AAK failed to load media JSON!");
                    networkErrorCounter += 0.5;
                    //Update flag
                    networkBusy = false;
                },
            });
        } else {
            if (a.$(containerMatcher).length > 0) {
                //Log element to be replace
                if (a.config.debugMode) {
                    a.out.log("Replacing player...");
                    a.out.log(a.$(containerMatcher)[0]);
                }
                //Replace player
                a.$(containerMatcher).first().after(a.nativePlayer(url)).remove();
                //Update variables and counter
                url = null;
                replaceCounter++;
            }
        }
    };
    //The function will not run if the page is in the background, once per second will be fine
    a.setInterval(main, 1000);
    a.on("focus", () => { isInBackground = false; });
    a.on("blur", () => { isInBackground = true; });
}
if (a.domCmp(["mid-day.com", "happytrips.com"])) {
    a.readOnly("canRun", true);
}
if (a.domCmp(["ewallstreeter.com"])) {
    a.readOnly("OAS_rdl", 1);
}
if (a.domCmp(["megogo.net"])) {
    a.readOnly("adBlock", false);
    a.readOnly("showAdBlockMessage", () => { });
}
if (a.domCmp(["elektroda.pl"])) {
    a.filter("setTimeout", a.matchMethod.string, "adBlockTest.offsetHeight");
}
if (a.domCmp(["anandabazar.com"])) {
    a.readOnly("canRunAds", false);
    a.config.allowGeneric = false;
}
if (a.domCmp(["wtkplay.pl"])) {
    a.readOnly("can_run_ads", true);
}
if (a.domCmp(["betterdocs.net"])) {
    a.filter("eval", a.matchMethod.string, "eval(function(p,a,c,k,e,d)");
}
if (a.domCmp(["webqc.org"])) {
    a.filter("setTimeout");
}
if (a.domCmp(["wired.com"])) {
    a.readOnly("google_onload_fired", true);
}
if (a.domInc(["knowlet3389.blogspot"])) {
    a.filter("setTimeout", a.matchMethod.string, '$("#gAds").height()');
}
if (a.domCmp(["freegameserverhost.com"])) {
    a.css("#fab13 { height:11px; }");
}
if (a.domCmp(["elahmad.com"])) {
    a.css("#adblock { height:1px; }");
}
if (a.domCmp(["mrtzcmp3.net"])) {
    a.css(".rtm_ad { height:1px; }");
}
if (a.domCmp(["bknime.com", "go4up.com", "debrido.com"])) {
    a.css(".myTestAd { height:1px; }");
}
if (a.domCmp(["debridfast.com", "getdebrid.com", "debrid.us", "leecher.us"])) {
    a.css(".myTestAd, .my24Ad, .nabil { height:1px; }");
    a.ready(() => {
        a.$("#simpleAd").html(`<p style="display:none;">debridfast.com</p>`);
    })
}
if (a.domCmp(["bg-gledai.tv"])) {
    a.css(".myAd { height:1px; }");
}
if (a.domCmp(["thepcspy.com"])) {
    a.css(".myTestAd { height:1px; }");
    a.css(".blocked { display:none; }");
    a.ready(() => {
        a.$(".blocked").remove();
    })
}
if (a.domCmp(["vg.no", "e24.no"])) {
    a.css(".ad { display:none; }");
}
if (a.domCmp(["automobile-sportive.com"])) {
    a.css(".myTestAd { height:51px; display:none; }");
}
if (a.domCmp(["snsw.us"])) {
    a.css("#ad_1 { height:1px; }");
}
if (a.domCmp(["urlchecker.net"])) {
    a.css("#adchecker { height:20px; }");
}
if (a.domCmp(["skiplimite.tv"])) {
    a.css("div.addthis_native_toolbox + div[id] { height:12px; }");
}
if (a.domCmp(["filecore.co.nz"])) {
    a.css(".adsense { height:5px; }");
}
if (a.domCmp(["thomas-n-ruth.com"])) {
    a.css(".Google { height:5px; }");
}
if (a.domCmp(["interfans.org"])) {
    a.css(".ad_global_header { height:1px; display:none; }");
}
if (a.domCmp(["maxdebrideur.com"])) {
    a.css(".clear + div[id] { height:12px; }");
}
if (a.domCmp(["topzone.lt"])) {
    a.css(".forumAd { height: 1px; display:none; }");
}
if (a.domInc(["nana10"])) {
    a.css("#advert-tracker { height:1px; }");
}
if (a.domCmp(["plej.tv"])) {
    a.css(".advert_box { height:1px; }");
}
if (a.domCmp(["mangamint.com"])) {
    a.css(".ad728 { height:31px; }");
}
if (a.domCmp(["debrideurstream.fr"])) {
    a.css("#content div[id][align=center] { height:12px; }");
}
if (a.domCmp(["preemlinks.com"])) {
    a.css("#divads { height:1px; }");
}
if (a.domCmp(["hentai.to"])) {
    a.css("#hentaito123 { height:11px; }");
}
if (a.domCmp(["prototurk.com"])) {
    a.css("#reklam { height:1px; }");
}
if (a.domCmp(["mufa.de"])) {
    a.css("#leaderboard { height:5px; }");
    a.css("#large-rectangle { height:5px; }");
    a.css("#ad-header-468x60 { height:5px; }");
}
if (a.domCmp(["watcharab.com"])) {
    a.css("#adblock { height:5px; }");
}
if (a.domCmp(["freedom-ip.com"])) {
    a.css(".pub_vertical ins, .pub_vertical div { height:11px; }");
}
if (a.domCmp(["wakanim.tv"])) {
    a.css("#detector { display:none; }");
    a.css("#nopub { display:block; }");
}
if (a.domCmp(["simply-debrid.com"])) {
    a.win.adsbygoogle = {};
    a.win.adsbygoogle.loaded = true;
}
if (a.domCmp(["manga9.com", "mangabee.co"])) {
    a.css(".adblock { height:31px; }");
}
if (a.domCmp(["onemanga2.com"])) {
    a.css(".afs_ads { height:5px; }");
}
if (a.domCmp(["mangabird.com"])) {
    a.css(".afs_ads { height:5px; }");
}
if (a.domCmp(["kodilive.eu"])) {
    a.css(".Ad { height:5px; }");
}
if (a.domCmp(["backin.net"])) {
    a.css("#divad { height:31px; }");
}
if (a.domCmp(["mobile-tracker-free.com"])) {
    a.css("#myAds { height:1px; }");
}
if (a.domCmp(["workupload.com"])) {
    a.always(() => {
        a.css(".adBlock, .adsbygoogle, #sad { height:11px; }");
    });
}
if (a.domCmp(["intoday.in", "businesstoday.in", "lovesutras.com"])) {
    //Issue: https://github.com/jspenguin2017/uBlockProtector/issues/109
    a.css("#adbocker_alt { display:none; }");
    a.readOnly("openPopup", () => { });
}
if (a.domCmp(["jc-mp.com"])) {
    a.css(".adsense { width:1px; height:1px; visibility:hidden; display:block; position:absolute; }");
}
if (a.domCmp(["mariage-franco-marocain.net"])) {
    a.css("#my_ad_div { height:1px; }");
}
if (a.domCmp(["happy-hack.ru"])) {
    a.css("#blockblockF4 { visibility:invisible; display:none; } #blockblockF4 td {visibility:invisible; display:none; } " +
        "#blockblockF4 td p { visibility:invisible; display:none; } #blockblockD3 { visibility:visible; display:block; }");
}
if (a.domCmp(["forbes.com"])) {
    if (a.win.location.pathname.includes("/welcome")) {
        a.cookie("welcomeAd", "true", 86400000, "/");
        a.cookie("dailyWelcomeCookie", "true", 86400000, "/");
        a.win.location = a.cookie("toUrl") || "https://www.forbes.com/";
    }
}
if (a.domCmp(["bitcoinaliens.com"])) {
    a.bait("ins", ".adsbygoogle");
}
if (a.domCmp(["osoarcade.com", "d3brid4y0u.info", "fileice.net", "nosteam.ro", "openrunner.com", "easybillets.com",
    "spox.fr", "yovoyages.com", "tv3.co.nz", "freeallmusic.info", "putlocker.com", "sockshare.com", "dramapassion.com",
    "yooclick.com", "online.ua"])) {
    a.bait("div", "#tester");
}
if (a.domCmp(["filecom.net", "upshare.org", "skippyfile.com", "mwfiles.net", "up-flow.org"])) {
    a.bait("div", "#add");
}
if (a.domCmp(["leaguesecretary.com", "teknogods.com", "hellsmedia.com"])) {
    a.bait("div", "#adpbtest");
}
if (a.domCmp(["freesportsbet.com", "sportsplays.com"])) {
    a.bait("div", "#ad-tester");
}
if (a.domCmp(["tgo-tv.com"])) {
    a.css("#adb, #bannerad1, .load_stream { display:none; }");
    a.bait("div", "#tester");
    a.on("load", () => {
        a.win.threshold = 1000;
        a.$(".chat_frame").remove();
    });
}
if (a.domCmp(["freegamehosting.nl"])) {
    a.bait("div", "#adtest");
}
if (a.domCmp(["theweatherspace.com"])) {
    a.bait("div", "#ab-bl-advertisement");
}
if (a.domCmp(["cleodesktop.com"])) {
    a.bait("div", "#myTestAd");
}
if (a.domCmp(["imageraider.com"])) {
    a.bait("div", "#myGContainer");
}
if (a.domCmp(["voici.fr", "programme-tv.net"])) {
    a.bait("div", "#sas_script2");
}
if (a.domCmp(["mil.ink"])) {
    a.bait("div", "#ads_div");
}
if (a.domCmp(["stream4free.eu"])) {
    a.bait("div", "#jpayday");
    a.readOnly("jpayday_alert", 1);
}
if (a.domCmp(["lg-firmware-rom.com"])) {
    a.readOnly("killads", true);
}
if (a.domCmp(["badtv.it", "badtaste.it", "badgames.it", "badcomics.it"])) {
    a.cookie("adBlockChecked", "disattivo");
}
if (a.domCmp(["independent.co.uk"])) {
    a.cookie("adblock_detected", "ignored");
}
if (a.domCmp(["3dnews.ru"])) {
    a.cookie("adblockwarn", "1");
    a.css("#earAds { width:401px; }");
    a.bait("div", "#earAds");
    a.readOnly("__AT_detected", true);
}
if (a.domCmp(["esmas.com"])) {
    a.readOnly("opened_adbblock", false);
}
if (a.domInc(["pinoy1tv"])) {
    a.readOnly("allowads", 1);
}
if (a.domCmp(["business-standard.com"])) {
    a.readOnly("adsLoaded", 1);
    a.cookie("_pw", "t");
}
/*
if (a.domCmp(["indiatimes.com", "samayam.com", "bangaloremirror.com"])) {
    //Patch HTML
    a.patchHTML(function (html) {
        html = html.replace("\\\\x61\\\\x64\\\\x62", a.c.syntaxBreaker);
        html = html.replace("function initBlock", a.c.syntaxBreaker);
        return html;
    });
}
*/
if (a.domCmp(["thechive.com"])) {
    a.readOnly("stephaneDetector", {
        hook(cb) { cb(false); },
        init() { },
        broadcastResult() { },
    });
}
if (a.domCmp(["richonrails.com"])) {
    a.ready(() => {
        const adsByGoogleHtml = `"<ins+id="aswift_0_expand"+style="display:inline-table;border:none;height:90px;` +
            `margin:0;padding:0;position:relative;visibility:visible;width:750px;background-color:transparent"><ins+id="aswi` +
            `ft_0_anchor"+style="display:block;border:none;height:90px;margin:0;padding:0;position:relative;visibility:visib` +
            `le;width:750px;background-color:transparent"><iframe+marginwidth="0"+marginheight="0"+vspace="0"+hspace="0"+all` +
            `owtransparency="true"+scrolling="no"+allowfullscreen="true"+onload="var+i=this.id,s=window.google_iframe_oncopy` +
            `,H=s&amp;&amp;s.handlers,h=H&amp;&amp;H[i],w=this.contentWindow,d;try{d=w.document}catch(e){}if(h&amp;&amp;d&am` +
            `p;&amp;(!d.body||!d.body.firstChild)){if(h.call){setTimeout(h,0)}else+if(h.match){try{h=s.upd(h,i)}catch(e){}w.` +
            `location.replace(h)}}"+id="aswift_0"+name="aswift_0"+style="left:0;position:absolute;top:0;"+width="750"+frameb` +
            `order="0"+height="90"></iframe></ins></ins>"`;
        a.$.ajax({
            url: a.$(".article-content").data("url"),
            dataType: "script",
            method: "post",
            data: {
                html: adsByGoogleHtml,
            },
            success(result) {
                const exec = result.replace("$('.article-content')", "$('.article-content-2')");
                a.win.eval(exec);
            },
        });
        a.$(".article-content").after(`<div class="article-content-2"></div>`).remove();
    });
}
if (a.domCmp(["rmprepusb.com"])) {
    a.cookie("jot_viewer", "3");
}
if (a.domCmp(["cubeupload.com"])) {
    a.filter("document.write", a.matchMethod.string, "Please consider removing adblock to help us pay our bills");
}
if (a.domCmp(["hentaihaven.org"])) {
    //NSFW!
    //Thanks to uBlock-user
    //Issue: https://github.com/jspenguin2017/uBlockProtector/issues/76
    a.noAccess("desktop_variants");
}
if (a.domCmp(["primeshare.tv"])) {
    a.bait("div", "#adblock");
}
if (a.domCmp(["debridnet.com", "livedebrid.com"])) {
    a.css(".myTestAd2 { height:5px; }");
    a.bait("div", ".myTestAd2");
}
if (a.domCmp(["bluesatoshi.com"])) {
    a.css("#test { height:280px; }");
    a.bait("div", "#test");
}
if (a.domCmp(["razercrypt.com", "satoshiempire.com", "oneadfaucet.com"])) {
    a.css("#test { height:250px; }");
    a.bait("div", "#test");
}
if (a.domCmp(["jkanime.net"])) {
    a.bait("div", "#reco");
}
if (a.domCmp(["720pmkv.com"])) {
    a.bait("div", "#advert");
}
if (a.domCmp(["paidverts.com"])) {
    a.bait("div", ".afs_ads");
}
if (a.domCmp(["italiatv.org"])) {
    a.bait("div", "#fab13");
}
if (a.domCmp(["eventhubs.com"])) {
    a.bait("div", "#blahyblaci1");
}
if (a.domCmp(["superanimes.com"])) {
    a.bait("div", "#bannerLoja");
}
if (a.domCmp(["forum.pac-rom.com"])) {
    a.bait("div", ".banner_ads");
}
if (a.domCmp(["litv.tv"])) {
    a.bait("div", ".player_mask");
}
if (a.domCmp(["leveldown.fr"])) {
    a.bait("div", "#adblock");
    a.bait("div", "#adblocktest");
}
if (a.domCmp(["globeslot.com"])) {
    a.bait("div", "#add");
    a.bait("div", "#add1");
}
if (a.domCmp(["antennesport.com", "serverhd.eu"])) {
    a.ready(() => {
        a.$("#pub .pubclose").remove();
        a.$("#pub .embed iframe").attr("src", "/embed/embed.php");
    });
}
if (a.domCmp(["drivearabia.com", "putlocker.com", "doatoolsita.altervista.org", "sockshare.com",
    "free-movie-home.com", "pc.online143.com", "kooora.com", "str3amtv.co.nr", "str3amtv.altervista.org",
    "str3am.altervista.org", "filecom.net", "pipocas.tv", "generatupremium.biz", "mega-debrid.eu",
    "premiumst0re.blogspot.com", "dl-protect.com", "newsinlevels.com", "vipracing.biz", "businesstoday.in"])) {
    a.filter("alert");
}
if (a.domCmp(["generatupremium.biz"])) {
    a.cookie("genera", "false");
}
if (a.domCmp(["newstatesman.com"])) {
    a.cookie("donationPopup", "hide");
}
if (a.domCmp(["yes.fm"])) {
    a.readOnly("com_adswizz_synchro_initialize", () => { });
}
if (a.domCmp(["tek.no", "gamer.no", "teknofil.no", "insidetelecom.no", "prisguide.no", "diskusjon.no",
    "teknojobb.no", "akam.no", "hardware.no", "amobil.no"])) {
    a.ready(() => {
        a.$("<div>").attr("id", "google_ads_iframe_").html("<p></p>").appendTo("body");
    });
}
if (a.domInc(["planetatvonlinehd.blogspot"]) || a.domCmp(["planetatvonlinehd.com"])) {
    a.css(".adsantilok { height:1px; }");
}
if (a.domCmp(["beta.speedtest.net"])) {
    a.readOnly("adsOoklaComReachable", true);
    a.readOnly("scriptsLoaded", () => { });
}
if (a.domCmp(["binbucks.com"])) {
    a.readOnly("testJuicyPay", true);
    a.readOnly("testSensePay", true);
}
if (a.domCmp(["whiskyprijzen.com", "whiskyprices.co.uk", "whiskypreise.com", "whiskyprix.fr"])) {
    a.readOnly("OA_show", true);
}
if (a.domCmp(["di.se"])) {
    a.ready(() => {
        a.$("#header_overlay").remove();
        a.$("#message_modal").remove();
    });
}
if (a.domCmp(["libertaddigital.com"])) {
    a.readOnly("ad_already_played", true);
    a.readOnly("puedeMostrarAds", true);
}
if (a.domCmp(["folha.uol.com.br"])) {
    a.readOnly("paywall_access", true);
    a.readOnly("folha_ads", true);
}
if (a.domCmp(["gamer.com.tw"])) {
    a.readOnly("AntiAd", null);
};
if (a.domCmp(["armorgames.com"])) {
    a.readOnly("ga_detect", null);
}
if (a.domCmp(["mangahost.com"])) {
    a.readOnly("testDisplay", false);
}
if (a.domCmp(["videowood.tv"])) {
    a.filter("open");
    a.win.config = {};
    a.readOnly("adb_remind", false);
}
if (a.domCmp(["infojobs.com.br"])) {
    /*
    a.win.webUI = {};
    a.win.webUI.Utils = {};
    const noop = () => { };
    a.win.Object.defineProperty(a.win.webUI.Utils, "StopAdBlock", {
        configurable: false,
        set() { },
        get() {
            return noop;
        },
    });
    */
    //They changed detection method, the new detection method should be caught in the generic anti-bait filter
    //Enforce again just in case
    a.readOnly("adblock", 0);
}
if (a.domCmp(["cloudwebcopy.com"])) {
    a.filter("setTimeout");
}
if (a.domCmp(["narkive.com"])) {
    a.readOnly("adblock_status", () => false);
}
if (a.domCmp(["pregen.net"])) {
    a.cookie("pgn", "1");
}
if (a.domCmp(["phys.org"])) {
    a.readOnly("chkAB", () => { });
}
if (a.domCmp(["onvasortir.com"])) {
    a.readOnly("JeBloque", () => { });
}
if (a.domCmp(["fullhdzevki.com"])) {
    a.readOnly("check", () => { });
}
if (a.domCmp(["freecoins4.me"])) {
    a.readOnly("check", () => {
        return false;
    });
}
if (a.domCmp(["ville-ideale.com"])) {
    a.readOnly("execsp", () => { });
}
if (a.domCmp(["notre-planete.info"])) {
    a.readOnly("pubpop", () => { });
}
if (a.domCmp(["apkmirror.com"])) {
    //Issue: https://github.com/jspenguin2017/uBlockProtector/issues/241
    //a.readOnly("doCheck", () => { });
    a.noAccess("ranTwice");
    //Ready for them to closure their code
    a.timewarp("setInterval", a.matchMethod.stringExact, "1000");
}
if (a.domCmp(["mtlblog.com"])) {
    a.readOnly("puabs", () => { });
}
if (a.domCmp(["15min.lt"])) {
    a.noAccess("__adblock_config");
}
if (a.domCmp(["anizm.com"])) {
    a.always(() => {
        a.win.stopAdBlock = {};
    });
}
if (a.domCmp(["diarioinformacion.com"])) {
    a.readOnly("pr_okvalida", true);
}
if (a.domCmp(["cnbeta.com"])) {
    a.readOnly("JB", () => { });
}
if (a.domCmp(["haaretz.com", "haaretz.co.li", "themarker.com"])) {
    a.noAccess("AdBlockUtil");
}
if (a.domCmp(["pipocas.tv"])) {
    a.cookie("popup_user_login", "yes");
}
if (a.domCmp(["sc2casts.com"])) {
    a.win._gaq = { push() { } }
    a.readOnly("showdialog", () => { });
    a.readOnly("showPopup2", () => { });
}
if (a.domCmp(["vgunetwork.com"])) {
    a.ready(() => {
        a.cookie("stopIt", "1");
        a.$("#some_ad_block_key_close").click()
    });
}
if (a.domCmp(["eventosppv.me"])) {
    a.ready(() => {
        a.$("#nf37").remove();
    });
}
if (a.domCmp(["bolor-toli.com"])) {
    a.on("load", () => {
        a.$(".banner").html("<br>").css("height", "1px");
    });
}
if (a.domCmp(["vivo.sx"])) {
    a.on("load", () => {
        a.$("#alert-throttle").remove();
        a.$("button#access").removeAttr("id").removeAttr("disabled").html("Continue To Video");
        a.setTimeout(() => {
            a.$("input[name='throttle']").remove();
        }, 1000);
    });
}
if (a.domCmp(["luxyad.com"])) {
    a.ready(() => {
        if (a.win.location.pathname === "/Information.php") {
            const href = location.href;
            a.win.location.href = href.substr(href.indexOf("url=") + 4, href.length);
        }
    });
}
/*
if (a.domCmp(["mrpiracy.xyz", "mrpiracy.club"])) {
    //Crash script by keywords
    a.crashScript("Desativa o AdBlock para continuar");
}
*/
if (a.domCmp(["dbplanet.net"])) {
    a.cookie("newnoMoreAdsNow", "1");
}
if (a.domCmp(["aidemu.fr"])) {
    a.cookie("adblockPopup", "true");
}
if (a.domCmp(["eami.in"])) {
    a.always(() => {
        a.cookie("ad_locked", "1");
    });
}
if (a.domCmp(["bigdownloader.com"])) {
    a.ready(() => {
        a.$("#anti_adblock").remove();
    });
}
if (a.domCmp(["freeskier.com"])) {
    a.ready(() => {
        a.$("#adb-not-enabled").css("display", "");
        a.$("#videoContainer").css("display", "");
    });
}
if (a.domCmp(["gametrailers.com"])) {
    a.ready(() => {
        a.$("#ad_blocking").remove();
    });
}
if (a.domCmp(["scan-mx.com", "onepiece-mx.net", "naruto-mx.net"])) {
    a.readOnly("ad_block_test", () => { });
    a.ready(() => {
        a.$("#yop").attr("id", "");
    });
}
if (a.domCmp(["freebitcoins.nx.tc", "getbitcoins.nx.tc"])) {
    a.readOnly("ad_block_test", () => false);
}
if (a.domCmp(["bitcoinker.com"])) {
    a.readOnly("claim", () => true);
    a.ready(() => {
        a.$("#E33FCCcX2fW").remove();
    });
}
if (a.domCmp(["moondoge.co.in", "moonliteco.in", "moonbit.co.in", "bitcoinzebra.com"])) {
    a.ready(() => {
        a.$("#AB, #E442Dv, #eCC5h").remove();
    });
}
if (a.domCmp(["bitcoiner.net", "litecoiner.net"])) {
    a.bait("div", "#tester");
    a.bait("div", "#ad-top");
}
if (a.domCmp(["torrent-tv.ru"])) {
    a.readOnly("c_Oo_Advert_Shown", true);
}
if (a.domCmp(["cwtv.com"])) {
    a.readOnly("CWTVIsAdBlocking", undefined);
}
if (a.domCmp(["inn.co.il"])) {
    a.win.TRC = {};
    a.win.TRC.blocker = {
        states: {
            ABP_DETECTION_DISABLED: -2,
            ABP_NOT_DETECTED: 0,
            ABP_DETECTED: 1,
        },
        createBlockDetectionDiv() { return a.doc.createElement("div"); },
        isBlockDetectedOnDiv() { return 0; },
        isBlockDetectedOnClassNames() { return 0; },
        getBlockedState() { return 0; },
    };
}
if (a.domCmp(["bhaskar.com", "divyabhaskar.co.in"])) {
    a.readOnly("openPopUpForBreakPage", () => { });
    a.readOnly("canABP", true);
    a.readOnly("canCheckAds", true);
}
if (a.domCmp(["turkanime.tv"])) {
    a.always(() => {
        a.win.adblockblock = () => { };
        a.win.BlokKontrol = {};
    });
}
if (a.domCmp(["wtfbit.ch"])) {
    a.readOnly("writeHTMLasJS", () => { });
}
if (a.domCmp(["ndtv.com"])) {
    a.readOnly("___p__p", 1);
    a.readOnly("getNoTopLatestNews", () => { });
}
if (a.domCmp(["lesechos.fr", "lesechos.com"])) {
    a.readOnly("checkAdBlock", () => { });
    a.readOnly("paywall_adblock_article", () => { });
    a.readOnly("call_Ad", 1);
}
if (a.domCmp(["bitvisits.com"])) {
    a.readOnly("blockAdblockUser", () => { });
}
/*
if (a.domCmp(["exrapidleech.info"])) {
    //This does not work anymore
    //Set cookies, style, read only variables, disable open(), and create an element
    let tomorrow = new a.win.Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    //Cookies
    a.cookie("popcashpuCap", "1");
    a.cookie("popcashpu", "1");
    a.cookie("nopopatall", tomorrow.getTime().toString());
    a.cookie("noadvtday", "0");
    //Style
    a.css("div.alert.alert-danger.lead { opacity:0; }");
    //Read only variables
    a.readOnly("bdvbnr_pid", []);
    //a.readOnly("adblock", false);
    a.readOnly("PopAds", 1);
    //Filter open()
    a.filter("open");
    //Create element
    a.$("<iframe>").attr("src", "http://bdfrm.bidvertiser.com/BidVertiser.dbm?pid=383865&bid=1737418&RD=")
.attr("id", "bdvi").css("display", "none").appendTo("html");
}
*/
if (a.domCmp(["vipleague.is", "vipleague.ws", "vipleague.tv", "vipleague.se", "vipleague.tv", "vipleague.me",
    "vipleague.mobi", "vipleague.co", "vipleague.sx", "vipleague.ch", "vipbox.tv", "vipbox.co", "vipbox.biz",
    "vipbox.sx", "vipbox.eu", "vipbox.so", "vipbox.nu", "vipboxsa.co", "strikeout.co", "strikeout.me",
    "homerun.re", "vipboxtv.co", "vipapp.me"])) {
    a.readOnly("iExist", true);
    a.cookie("xclsvip", "1");
    a.css(".vip_052x003 { height:250px; }");
    a.css(".vip_09x827 { height:26px; }");
    a.css("#overlay { display:none; }");
}
if (a.domCmp(["zoomtv.me"])) {
    a.readOnly("iaxpEnabled", true);
}
if (a.domCmp(["vg.no", "e24.no"])) {
    a.readOnly("__AB__", () => { });
}
if (a.domCmp(["pornve.com"])) {
    //NSFW!
    a.readOnly("adxjwupdate", 1);
}
if (a.domCmp(["lol.moa.tw"])) {
    a.ready(() => {
        a.win.MoaObj = a.win.MoaObj || {};
        a.win.MoaObj.ad = a.win.MoaObj.ad || {};
        a.win.MoaObj.ad.hasAdblock = () => false;
        a.win.MoaObj.ad.checkABP = () => false;
    });
}
if (a.domCmp(["dailybitcoins.org"])) {
    a.ready(() => {
        a.$(".ad-img").remove();
    });
}
if (a.domCmp(["kozaczek.pl", "zeberka.pl"])) {
    a.cookie("ablc", "1");
    a.cookie("cookie_policy", "1");
}
if (a.domCmp(["spankwire.com", "keezmovies.com", "extremetube.com", "mofosex.com"])) {
    a.cookie("abClosed", "true");
    a.cookie("hide_ad_msg", "1");
}
if (a.domCmp(["youporn.com", "youporngay.com"])) {
    a.cookie("adblock_message", "closed");
}
if (a.domCmp(["citationmachine.net"])) {
    a.cookie("sbm_cm_citations", "0");
}
if (a.domCmp(["psarips.com"])) {
    a.bait("div", "#advert");
    a.noAccess("open");
}
if (a.domCmp(["extratorrent.cc", "extratorrent.com"])) {
    a.cookie("ppu_delay", "1");
    a.cookie("ppu_main", "1");
    a.cookie("ppu_sub", "1");
    a.cookie("ppu_show_on", "1");
}
if (a.domCmp(["tny.cz", "pasted.co"])) {
    a.cookie("__.popunderCap", "1");
    a.cookie("__.popunder", "1");
}
if (a.domCmp(["clubedohardware.com.br"])) {
    if (a.win.location.host.includes("forum")) {
        a.css("#banner, script { height:51px; }");
        a.bait("div", "#banner");
    } else {
        a.bait("div", ".banner_topo");
    }
    a.ready(() => {
        if (a.win.location.host.includes("forum")) {
            a.win.addBlocking.hide();
            a.win.addBlocking.kill();
        } else {
            a.doc.body.id = "";
            a.$(".adblock").remove();
        }
    });
}
if (a.domCmp(["debrastagi.com"])) {
    a.ready(() => {
        a.$("#stp-main").remove();
        a.$("#stp-bg").remove();
    });
}
if (a.domCmp(["ddlfrench.org"])) {
    a.ready(() => {
        a.$("#dle-content .d-content").removeClass();
        a.$("#content").attr("id", "");
    });
}
if (a.domCmp(["mega-debrid.eu"])) {
    a.on("load", () => {
        const elem = a.$(".realbutton")[0];
        elem.setAttribute("onclick", "");
        elem.setAttribute("type", "submit");
    });
}
if (a.domInc(["slideplayer"])) {
    a.on("load", () => {
        a.win.force_remove_ads = true;
        const slide_id = a.win.get_current_slide_id();
        const slide_srv = a.doc.getElementById("player_frame").src.split("/")[3];
        const time = 86400 + a.win.Math.floor(a.win.Date.now() / 1000);
        const secret = a.win.encodeURIComponent(a.win.strtr(a.win.MD5.base64("secret_preved slideplayer never solved " +
            time + slide_id + ".ppt"), "+/", "- "));
        const url = `http://player.slideplayer.org/download/${slide_srv}/${slide_id}/${secret}/${time}/${slide_id}.ppt`;
        let links = a.doc.querySelectorAll("a.download_link");
        for (let i = 0; i < links.length; i++) {
            let events = a.win.$._data(links[i]).events.click;
            events.splice(0, events.length);
            links[i].href = url;
        }
    });
}
if (a.domCmp(["bokepspot.com"])) {
    a.cookie("hideDialog", "hide");
    a.ready(() => {
        a.$("#tupiklan").remove();
    });
}
if (a.domCmp(["picload.org"])) {
    a.cookie("pl_adblocker", "false");
    a.ready(() => {
        a.win.ads_loaded = true;
        a.win.imageAds = false;
        a.$("div[oncontextmenu='return false;']").remove();
    });
}
if (a.domCmp(["freezedownload.com"])) {
    a.ready(() => {
        if (a.win.location.href.includes("freezedownload.com/download/")) {
            a.$("body > div[id]").remove();
        }
    });
}
if (a.domCmp(["monnsutogatya.com"])) {
    a.ready(() => {
        a.css("#site-box { display:block; }");
        a.$("#for-ad-blocker").remove();
    });
}
if (a.domCmp(["rapid8.com"])) {
    a.ready(() => {
        a.$("div.backk + #blcokMzg").remove();
        a.$("div.backk").remove();
    });
}
if (a.domCmp(["turkdown.com"])) {
    a.ready(() => {
        a.$("#duyuru").remove();
    });
}
if (a.domCmp(["privateinsta.com"])) {
    a.ready(() => {
        a.win.dont_scroll = false;
        a.$("#overlay_div").remove();
        a.$("#overlay_main_div").remove();
    });
}
if (a.domCmp(["oneplaylist.eu.pn"])) {
    a.readOnly("makePopunder", false);
}
if (a.domCmp(["onmeda.de"])) {
    a.readOnly("$ADP", true);
    a.readOnly("sas_callAd", () => { });
    a.readOnly("sas_callAds", () => { });
}
if (a.domCmp(["rockfile.eu"])) {
    a.ready(() => {
        a.$("<iframe>").attr("src", "about:blank").css("visibility", "hidden").appendTo("body");
    });
}
if (a.domCmp(["referencemega.com", "fpabd.com", "crackacc.com"])) {
    a.cookie("_lbGatePassed", "true");
}
if (a.domCmp(["link.tl"])) {
    a.css(".adblock { height:1px; }");
    a.readOnly("adblocker", false);
    a.timewarp("setInterval", a.matchMethod.stringExact, "1800");
}
if (a.domCmp(["wstream.video"])) {
    a.css("#adiv { height:4px; }");
}
if (a.domCmp(["4shared.com"])) {
    a.ready(() => {
        a.$("body").removeClass("jsBlockDetect");
    });
}
if (a.domCmp(["pro-zik.ws", "pro-tect.ws", "pro-ddl.ws", "pro-sport.ws"])) {
    a.cookie("visitedf", "true");
    a.cookie("visitedh", "true");
}
if (a.domCmp(["comptoir-hardware.com"])) {
    a.readOnly("adblock", "non");
}
if (a.domCmp(["bakersfield.com"])) {
    a.readOnly("AD_SLOT_RENDERED", true);
}
if (a.domCmp(["ekstrabladet.dk", "eb.dk"])) {
    a.noAccess("eb");
}
if (a.domCmp(["pcgames-download.net"])) {
    a.always(() => {
        a.cookie("noAdblockNiceMessage", "1");
        a.win.mgCanLoad30547 = true;
    });
}
if (a.domCmp(["lachainemeteo.com"])) {
    a.readOnly("js_loaded", true);
}
if (a.domCmp(["mac4ever.com"])) {
    a.readOnly("coquinou", () => { });
}
if (a.domCmp(["5278bbs.com"])) {
    a.readOnly("myaabpfun12", () => { });
}
if (a.domCmp(["thesimsresource.com"])) {
    a.readOnly("gadsize", true);
    a.readOnly("iHaveLoadedAds", true);
}
if (a.domCmp(["yellowbridge.com"])) {
    a.readOnly("finalizePage", () => { });
}
if (a.domCmp(["game-debate.com"])) {
    a.readOnly("ad_block_test", () => { });
}
if (a.domCmp(["kissanime.com", "kissanime.to", "kissanime.ru"])) {
    a.css("iframe[id^='adsIfrme'], .divCloseBut { display:none; }");
    a.ready(() => {
        const divContentVideo = a.doc.querySelector("#divContentVideo");
        if (a.win.DoDetect2) {
            a.win.DoDetect2 = null;
            a.win.CheckAdImage = null;
        } else if (divContentVideo) {
            const divDownload = a.doc.querySelector("#divDownload").cloneNode(true);
            a.setTimeout(() => {
                divContentVideo.innerHTML = "";
                a.win.DoHideFake();
                divContentVideo.appendChild(divDownload);
                a.$("iframe[id^='adsIfrme'], .divCloseBut").remove();
            }, 5500);
        }
    });
}
if (a.domCmp(["kissanime.io"])) {
    a.readOnly("check_adblock", true);
}
if (a.domCmp(["kisscartoon.me", "kisscartoon.se"])) {
    a.readOnly("xaZlE", () => { });
    a.ready(() => {
        a.$("iframe[id^='adsIfrme']").remove();
    });
}
if (a.domCmp(["openload.co", "openload.io", "openload.tv"])) {
    a.readOnly("adblock", false);
    a.readOnly("adblock2", false);
    a.readOnly("popAdsLoaded", true);
}
if (a.domCmp(["youwatch.to", "he2eini7ka.com", "shink.in"])) {
    a.readOnly("jsPopunder", () => { });
}
if (a.domCmp(["he2eini7ka.com"])) {
    a.readOnly("adsShowPopup1", 1);
}
if (a.domCmp(["youwatch.org", "chouhaa.info", "ahzahg6ohb.com", "ahzahg6ohb.com"])) {
    a.readOnly("adsShowPopup1", 1);
    a.ready(() => {
        a.$("#player_imj, #player_imj + div[id]").remove();
    });
}
if (a.domCmp(["exashare.com", "chefti.info", "bojem3a.info", "ajihezo.info", "yahmaib3ai.com",
    "yahmaib3ai.com"])) {
    a.readOnly("adsShowPopup1", 1);
    a.ready(() => {
        a.$("#player_gaz, #player_gaz + div[id]").remove();
    });
}
if (a.domCmp(["an1me.se"])) {
    a.readOnly("isBlockAds2", false);
}
if (a.domCmp(["hqq.tv"])) {
    a.ready(() => {
        if (a.win.location.pathname === "/player/embed_player.php") {
            a.$("form[id^='form-']").submit();
        }
    });
}
if (a.domCmp(["koscian.net"])) {
    a.ready(() => {
        a.$(".ban").remove();
    });
}
if (a.domCmp(["eclypsia.com"])) {
    a.generic.FuckAdBlock("MggAbd", "mggAbd");
}
if (a.domCmp(["gamingroom.tv"])) {
    a.readOnly("adblock_detect", () => { });
    a.readOnly("GR_adblock_hide_video", () => { });
    a.readOnly("adblock_video_msg_start", () => { });
    a.readOnly("adblock_video_msg_stop", () => { });
    a.readOnly("disable_chat", () => { });
}
if (a.domCmp(["rtl.de"])) {
    a.ready(() => {
        a.$("div[data-widget='video']").each(function () {
            const url = a.$(this).data("playerLayerCfg").videoinfo.mp4url;
            a.$(this).after(a.nativePlayer(url));
            a.$(this).remove();
        });
    });
}
if (a.domCmp(["play.radio1.se", "play.bandit.se", "play.lugnafavoriter.com", "play.rixfm.se"])) {
    a.on("load", () => {
        a.setTimeout(() => {
            a.win.player_load_live(a.win.stream_id);
        }, 1000);
    });
}
if (a.domCmp(["dplay.com", "dplay.dk", "dplay.se"])) {
    let date = new a.win.Date();
    date.setDate(date.getDate() + 365);
    const timestamp = date.getTime().toString();
    const value = JSON.stringify({
        notificationSubmission: "submitted",
        reportingExpiry: timestamp,
        notificationExpiry: timestamp,
    });
    a.cookie("dsc-adblock", value);
}
if (a.domCmp(["viafree.no", "viafree.dk", "viafree.se", "tvplay.skaties.lv", "play.tv3.lt", "tv3play.tv3.ee"])) {
    //Thanks to szymon1118
    let isInBackground = false;
    const idMatcher = /\/(\d+)/;
    const videoJS = (source, type, width, height) => {
        return `<iframe srcdoc='<html><head><link href="https://cdnjs.cloudflare.com/ajax/libs/video.js/5.10.5/al` +
            `t/video-js-cdn.min.css" rel="stylesheet"><script src="https://cdnjs.cloudflare.com/ajax/libs/video.j` +
            `s/5.10.5/video.min.js"><\/script><script src="https://cdnjs.cloudflare.com/ajax/libs/videojs-contrib` +
            `-hls/3.1.0/videojs-contrib-hls.min.js"><\/script><style type="text/css">html, body{padding:0; margin` +
            `:0;}.vjs-default-skin{color:#eee}.vjs-default-skin .vjs-play-progress,.vjs-default-skin .vjs-volume-` +
            `level{background-color:#eee}.vjs-default-skin .vjs-big-play-button,.vjs-default-skin .vjs-control-ba` +
            `r{background:rgba(0,0,0,.2)}.vjs-default-skin .vjs-slider{background:rgba(0,0,0,.3)}</style></head><` +
            `body><video id="uBlock_Protector_Video_Player" class="video-js vjs-default-skin" controls preload="a` +
            `uto" width="${width}" height="${height}"><source src="${source}" type="${type}"></video><script>vide` +
            `ojs("uBlock_Protector_Video_Player")<\/script></body></html>' width="${width}" height="${height}" fr` +
            `ameborder="0" scrolling="no" allowfullscreen="true"></iframe>`;
    };
    const handler = () => {
        if (isInBackground) {
            a.setTimeout(handler, 1000);
            return;
        }
        //Find player
        const elem = a.$("#video-player");
        if (elem.length === 0) {
            a.setTimeout(handler, 1000);
            return;
        }
        //Find ID
        let videoID;
        if (a.domCmp(["tvplay.skaties.lv", "play.tv3.lt", "tv3play.tv3.ee"], true)) {
            let tmp = idMatcher.exec(a.win.location.href);
            if (tmp) {
                videoID = tmp[1];
            }
        } else if (a.win.vfAvodpConfig) {
            videoID = a.win.vfAvodpConfig.videoId;
        }
        if (!videoID) {
            a.setTimeout(handler, 1000);
            return;
        }
        //Request data JSON
        //The proxy does not seem work anymore
        //const proxy = "http://www.sagkjeder.no/p/browse.php?u=";
        GM_xmlhttpRequest({
            method: "GET",
            url: `http://playapi.mtgx.tv/v3/videos/stream/${videoID}`,
            onload(result) {
                if (a.config.debugMode) {
                    a.out.info("Response received:");
                    a.out.info(result.responseText);
                }
                parser(result.responseText);
            },
            onerror() {
                a.out.error("AAK failed to find media URL!");
            },
        });
    };
    const parser = (data) => {
        //Parse response
        let streams;
        try {
            const parsedData = JSON.parse(data);
            streams = parsedData.streams;
            if (!streams) {
                throw "Media URL Not Found";
            }
        } catch (err) {
            a.out.error("AAK failed to find media URL!");
            return;
        }
        //Check source and type
        let source, type;
        if (streams.high && streams.high !== "") {
            source = streams.high;
            type = "video/mp4";
        } else if (streams.hls && streams.hls !== "") {
            source = streams.hls;
            type = "application/x-mpegURL";
        } else if (streams.medium && streams.medium !== "") {
            source = streams.medium;
            type = streams.medium.startsWith("rtmp") ? "rtmp/mp4" : "application/f4m+xml";
        } else {
            a.out.error("AAK failed to find media URL!");
            return;
        }
        if (a.config.debugMode) {
            a.out.info("Potential media URLs:");
            a.out.info([streams.high, streams.hls, streams.medium]);
            a.out.info("Used media URL:");
            a.out.info(source);
        }
        //Replace player
        const player = a.$("#video-player");
        const height = player.height();
        const width = player.width();
        player.after(videoJS(source, type, width, height)).remove();
        //Watch for more video players
        handler();
    };
    //Start
    handler();
    a.on("focus", () => { isInBackground = false; });
    a.on("blur", () => { isInBackground = true; });
}
if (a.domCmp(["firstrow.co", "firstrows.ru", "firstrows.tv", "firstrows.org", "firstrows.co",
    "firstrows.biz", "firstrowus.eu", "firstrow1us.eu", "firstsrowsports.eu", "firstrowsportes.tv",
    "firstrowsportes.com", "justfirstrowsports.com", "hahasport.me", "wiziwig.ru", "wiziwig.sx",
    "wiziwig.to", "wiziwig.tv", "myp2p.biz", "myp2p.tv", "myp2p.la", "myp2p.ec", "myp2p.eu", "myp2p.sx",
    "myp2p.ws", "myp2p.com", "atdhe.ru", "atdhe.se", "atdhe.bz", "atdhe.top", "atdhe.to", "atdhe.me",
    "atdhe.mx", "atdhe.li", "atdhe.al"])) {
    a.filter("open");
    a.always(() => {
        a.cookie("adb", "1");
        a.css("#bannerInCenter, #hiddenBannerCanvas { display:none; }");
    });
}
if (a.domCmp(["buzina.xyz", "farmet.info", "rimladi.com", "kitorelo.com", "omnipola.com", "porosin.co.uk",
    "rimleno.com", "simple4alls.com", "arsopo.com"])) {
    a.css("#adsframe { height:151px; }");
    a.ready(() => {
        a.$("#adsframe").remove();
        a.$("#remove-over").click();
    });
}
if (a.domCmp(["buzina.xyz"])) {
    a.css("#adsframe { height:151px; }");
    a.ready(() => {
        const elem = a.$("iframe[src*='.php?hash=']");
        if (elem.length > 0) {
            let parts = elem.attr("src").split("/");
            parts[2] = "arsopo.com";
            elem.attr("src", parts.join("/"));
        }
    });
}
if (a.domCmp(["allmyvideos.net", "amvtv.net"])) {
    a.cookie("_favbt33", "1");
}
if (a.domCmp(["ilive.to", "streamlive.to"])) {
    a.on("load", () => {
        if (a.win.location.pathname.toLowerCase().startsWith("/embedplayer.php")) {
            a.setTimeout(() => {
                a.win.removeOverlayHTML();
            }, 1000);
        }
    });
}
if (a.domCmp(["micast.tv"])) {
    a.cookie("vid_main", "true");
    a.cookie("vid_sub", "true");
    a.on("load", () => {
        if (a.win.removeOverlayHTML) {
            a.win.removeOverlayHTML();
        }
    })
}
if (a.domCmp(["pxstream.tv"])) {
    a.on("load", () => {
        if (a.win.location.pathname.startsWith("/embedrouter.php")) {
            a.setTimeout(() => {
                a.win.closeAd();
            }, 1000);
        }
    });
}
if (a.domCmp(["sawlive.tv"])) {
    a.ready(() => {
        if (a.win.location.pathname.toLowerCase().startsWith("/embed/watch/")) {
            a.win.display = false;
            a.win.closeMyAd();
        }
    });
}
if (a.domCmp(["goodcast.co"])) {
    a.ready(() => {
        if (a.win.location.pathname.startsWith("/stream.php")) {
            a.$(".advertisement").hide();
            a.$(".adsky iframe").attr("src", "about:blank");
        }
    });
}
if (a.domCmp(["showsport-tv.com"])) {
    a.ready(() => {
        if (a.win.location.pathname.startsWith("/ch.php")) {
            a.$("#advertisement, .advertisement").remove();
        }
    });
}
if (a.domCmp(["sharecast.to"])) {
    a.ready(() => {
        if (a.win.location.pathname.startsWith("/embed.php")) {
            const token = a.setInterval(() => {
                a.cookie("vid_main", "true");
                a.cookie("vid_sub", "2");
                a.cookie("vid_delay", "true");
            }, 100);
            a.setTimeout(() => {
                a.clearInterval(token);
            }, 5000);
            a.$("#table1").remove();
        }
    });
}
if (a.domCmp(["cityam.com", "computerworlduk.com", "techworld.com", "v3.co.uk"])) {
    a.ready(() => {
        a.$("#r3z-wait").remove();
        a.$(".r3z-hide").removeClass("r3z-hide");
        a.win._r3z = null;
    });
}
if (a.domCmp(["next-episode.net", "kingmaker.news", "gamespowerita.com", "todayidol.com", "receive-a-sms.com",
    "wakeupcallme.com", "ringmycellphone.com", "faqmozilla.org", "thememypc.com"])) {
    a.always(() => {
        a.win.google_jobrunner = {};
    });
}
if (a.domCmp(["dawn.com"])) {
    a.generic.FuckAdBlock("DetectAdBlock", "detectAdBlock");
}
if (a.domCmp(["sports.fr"])) {
    a.generic.FuckAdBlock("FabInstance", "fabInstance");
}
if (a.domCmp(["europe1.fr"])) {
    a.generic.FuckAdBlock("FabInstance", "fabInstance");
}
if (a.domCmp(["newyorker.com"])) {
    a.generic.FuckAdBlock("SniffAdBlock", "sniffAdBlock");
}
if (a.domCmp(["mangasproject.com.br", "mangasproject.net.br", "mangas.zlx.com.br"])) {
    a.generic.FuckAdBlock(a.uid(), "mangasLeitorSlider");
}
if (a.domCmp(["qnimate.com"])) {
    a.readOnly("adBlockDetected", () => { });
}
if (a.domCmp(["eurotransport.de"])) {
    a.generic.FuckAdBlock(a.uid(), "antiAdBlock");
}
if (a.domCmp(["tzetze.it", "beppegrillo.it", "la-cosa.it"])) {
    a.generic.FuckAdBlock("CADetect", "cadetect");
}
if (a.domCmp(["agario.sx", "agarabi.com"])) {
    a.generic.FuckAdBlock(a.uid(), "agario_SX_ads");
}
if (a.domCmp(["filespace.com"])) {
    a.generic.FuckAdBlock(a.uid(), "fAB");
}
if (a.domCmp(["topserialy.sk"])) {
    a.generic.FuckAdBlock(a.uid(), "sratNaVas");
}
if (a.domCmp(["sport-show.fr", "vipflash.net", "2site.me"])) {
    a.css("#blockblockA { visibility:invisible; display:none; } #blockblockA td { visibility:invisible; " +
        "display:none; } #blockblockA td p { visibility:invisible; display:none; } #blockblockB " +
        "{ visibility:visible; display:block; }");
}
if (a.domCmp(["gametransfers.com", "winandmac.com", "free-steam-giveaways.com", "canalwp.com",
    "alphahistory.com", "nordpresse.be", "sospc.name", "baboo.com.br", "nflix.pl"])) {
    a.always(() => {
        a.cookie("anCookie", "true");
        a.win.anOptions = {};
    });
}
if (a.domCmp(["lewebtvbouquetfrancophone.overblog.com", "webtv.bloguez.com", "latelegratuite.blogspot.com",
    "totaldebrid.org", "37.187.173.205", "tvgratuite.blogspot.com"])) {
    a.bait("div", "#my_ad_div");
    a.readOnly("jabbahud", () => { });
}
if (a.domCmp(["mybank.pl", "rapidgrab.pl"])) {
    a.filter("addEventListener", a.matchMethod.string, ".nextFunction()}");
}
if (a.domCmp(["linkdrop.net", "revclouds.com", "leporno.org", "uploadshub.com", "dasolo.org",
    "fullstuff.net", "zeusnews.it", "cheminots.net", "lolsy.tv", "animes-mangas-ddl.com",
    "noticiasautomotivas.com.br", "darkstars.org", "corepacks.com", "naturalbd.com",
    "coolsoft.altervista.org", "openload.us", "cda-online.pl", "urbanplanet.org", "mamahd.com",
    "sadeempc.com", "avmoo.com", "thailande-fr.com", "btaia.com", "tusoft.org", "hisse.net",
    "europeup.com", "nrj.fr", "srnk.co", "animmex.co", "socketloop.com", "crackhex.com",
    "revealedtricks4u.com", "pizzamaking.com", "computerworm.net", "yourlifeupdated.net"])) {
    a.filter("setTimeout", a.matchMethod.string, "bab_elementid");
}
/*
if (a.domCmp(["commentcamarche.net", "journaldesfemmes.com", "linternaute.com"])) {
    //Crash script by keywords
    a.crashScript("Asl.prototype.inject");
}
*/
if (a.domCmp(["fourchette-et-bikini.fr", "meteocity.com"])) {
    a.readOnly("adProtect", 1);
}
if (a.domCmp(["demo-phoenix.com", "dpstream.net", "gum-gum-streaming.com", "jeu.info", "sofoot.com",
    "gaara-fr.com", "gaytube.com", "tuxboard.com", "xstory-fr.com", "hentaifr.net", "filmstreaming-hd.com",
    "filmvf.net", "hentaihaven.org", "narutoshippudenvf.com", "thebadbuzz.com", "manga-news.com", "jeu.video",
    "mangas-fr.com"])) {
    //crashScript breaks uBO element picker
    //a.crashScript("PHENV");
    a.css("body { visibility:visible; }");
}
/*
if (a.domCmp(["tvspielfilm.de", "finanzen.ch"])) {
    //crashScript breaks uBO element picker
    a.crashScript("UABPInject");
}
if (a.domCmp(["watchgeneration.fr", "turbo.fr", "24matins.fr", "foot01.com", "clubic.com", "macg.co",
"begeek.fr", "igen.fr", "gamestar.de", "focus.de", "stern.de", "fem.com", "wetter.com",
"wetteronline.de", "pcwelt.de", "boerse-online.de", "sportauto.de", "auto-motor-und-sport.de",
"motor-klassik.de", "4wheelfun.de", "autostrassenverkehr.de", "lustich.de", "spox.com", "shz.de",
"transfermarkt.de", "rp-online.de", "motorradonline.de", "20min.ch", "main-spitze.de",
"wormser-zeitung.de", "lampertheimer-zeitung.de", "wiesbdener-tagblatt.de", "buerstaedter-zeitung.de",
"wiesbdener-kurier.de", "rhein-main-presse.de", "allgemeine-zeitung.de", "ariva.de", "spiegel.de",
"brigitte.de", "dshini.net", "gala.de", "gamepro.de", "gamona.de", "pnn.de", "promobil.de", "sportal.de",
"webfail.com", "computerbild.de", "finanzen.net", "comunio.de", "medisite.fr"]) || a.domInc(["sat1",
"prosieben", "kabeleins", "sat1gold", "sixx", "prosiebenmaxx", "the-voice-of-germany"])) {
    //crashScript breaks uBO element picker
    a.crashScript("uabInject");
}
*/
if (a.domCmp(["emuparadise.me"])) {
    a.always(() => {
        a.$("h2:contains('Bandwidth is expensive')").parent().remove();
    });
}
if (a.domCmp(["sapib.ca"])) {
    a.readOnly("Abd_Detector", () => { });
}
if (a.domCmp(["wowhead.com"])) {
    a.ready(() => {
        a.$("div[id^='ad-']").parent().parent().parent().remove();
    });
}
if (a.domCmp(["epiotrkow.pl"])) {
    a.bait("div", "#adboxx");
}
if (a.domCmp(["fox.com.tr"])) {
    a.readOnly("adblockDetector", {
        init() { }
    });
}
if (a.domCmp(["thebatavian.com"])) {
    a.readOnly("broadstreet", true);
}
if (a.domCmp(["zrabatowani.pl"])) {
    a.cookie("adblockAlert", "yes");
}
if (a.domCmp(["hanime.tv"])) {
    //NSFW!
    //Issue: https://github.com/jspenguin2017/uBlockProtector/issues/76
    const _open = a.win.open;
    a.win.open = (...args) => {
        _open.apply(a.win, args);
        //This will close the tab instantly with Violentmonkey
        window.close();
    };
    //Old solution, I will run it just in case
    a.readOnly("BetterJsPop", () => { });
}
if (a.domCmp(["firstonetv.eu"])) {
    a.readOnly("blocked", () => { });
    a.readOnly("adFuckBlock", () => { });
}
if (a.domCmp(["whosampled.com"])) {
    a.readOnly("showAdBlockerOverlay", () => { });
}
if (a.domCmp(["pornhub.com", "redtube.com", "youporn.com", "tube8.com", "pornmd.com",
    "thumbzilla.com", "xtube.com", "peeperz.com", "czechhq.net", "29443kmq.video"])) {
    //NSFW!
    //29443kmq.video is the iframe of czechhq.net, other domains are part of Porthub Network
    a.win.open = (arg) => {
        if (arg.includes(a.dom)) {
            a.win.location.href = arg;
        }
    };
}
if (a.domCmp(["pastebin.com"])) {
    a.readOnly("abdd", "");
}
if (a.domCmp(["debridnet.com"])) {
    a.noAccess("_pop");
}
if (a.domCmp(["xnxx.com"])) {
    a.cookie("wpn-popupunder", "1");
    a.readOnly("openpop", () => { });
}
if (a.domCmp(["burning-feed.com"])) {
    //Thanks to uBlock-user
    //a.readOnly("testab", "1");
    //a.readOnly("ads_enable", "true");
    a.readOnly("ads_enable", () => { });
}
if (a.domCmp(["chip.de"])) {
    //https://github.com/uBlockOrigin/uAssets/blob/2a444825eb93f5abaf90b7f8594ed45ecef2f823/filters/filters.txt#L1435
    a.noAccess("stop");
}
if (a.domCmp(["ghame.ru"])) {
    a.$("<p class='adsbygoogle' style='display:none;'>hi</p>").prependTo("html");
}
if (a.domCmp(["thevideo.me", "fmovies.to", "fmovies.se", "fmovies.is"])) {
    //Issue: https://github.com/jspenguin2017/uBlockProtector/issues/86
    //Issue: https://github.com/jspenguin2017/uBlockProtector/issues/99
    a.win.open = () => { };
}
if (a.domCmp(["is.fi", "viasatsport.fi"])) {
    //Issue: https://github.com/jspenguin2017/uBlockProtector/issues/88
    a.readOnly("Sabdetect_load", false);
    if (a.domCmp(["viasatsport.fi"], true)) {
        a.config.allowGeneric = false;
    }
}
if (a.domCmp(["mooseroots.com", "insidegov.com", "gearsuite.com"])) {
    //Issue: https://github.com/jspenguin2017/uBlockProtector/issues/96
    a.css("html,body { overflow-y:scroll; } .BOX-wrap { display:none; }");
}
if (a.domCmp(["sandiegouniontribune.com"])) {
    const token = a.setInterval(() => {
        if (a.$("#reg-overlay").length) {
            a.$("#reg-overlay").remove()
            a.$("<style> html[data-dss-meterup], [data-dss-meterup] body { " +
                "overflow: scroll !important; } </style>").appendTo("head");
            a.clearInterval(token);
        }
    }, 1000);
    a.filter("addEventListener", a.matchMethod.stringExact, "scroll");
}
if (a.domCmp(["adz.bz", "mellow.link", "hop.bz", "mellowads.com", "url.vin",
    "clik.bz"])) {
    //Issue: https://github.com/jspenguin2017/uBlockProtector/issues/106
    let val;
    a.win.Object.defineProperty(a.win, "linkVM", {
        configurable: false,
        set(arg) {
            val = arg;
        },
        get() {
            if (val.verify) {
                val.verify = (() => {
                    callAPI(
                        "publishing",
                        "VerifyLinkClick",
                        {
                            linkRef: val.linkRef(),
                            linkClickRef: $("#LinkClickRef")[0].value,
                            recaptchaResponse: val.recaptchaResponse()
                        },
                        "Verify",
                        "Verifying",
                        (response) => {
                            if (response.result) {
                                window.location.href = response.linkURL;
                            } else {
                                showMessageModal("Verify failed", response.resultHtml, response.result);
                            }
                        },
                        null,
                        () => {
                            grecaptcha.reset();
                        }
                    );
                }).bind(val);
            }
            return val;
        },
    });
}
if (a.domCmp(["zap.in"])) {
    //Issue: https://github.com/jspenguin2017/uBlockProtector/issues/201
    let val;
    a.win.Object.defineProperty(a.win, "zapVM", {
        configurable: false,
        set(arg) {
            val = arg;
        },
        get() {
            if (val.verify) {
                val.verify = (() => {
                    callAPI(
                        "VerifyZapClick",
                        {
                            linkRef: val.linkRef(),
                            linkClickRef: $("#LinkClickRef")[0].value,
                            recaptchaResponse: val.recaptchaResponse()
                        },
                        "Verify",
                        "Verifying",
                        (response) => {
                            if (response.result) {
                                window.location.href = response.zapURL;
                            } else {
                                showMessageModal("Verify failed", response.resultHtml, response.result);
                            }
                        },
                        null,
                        () => {
                            grecaptcha.reset();
                        }
                    );
                }).bind(val);
            }
            return val;
        },
    });
}
if (a.domCmp(["adbull.me", "freepdf-books.com", "bc.vc", "themeslide.com", "linkdrop.net", "fas.li", "123link.top"])) {
    a.timewarp("setInterval", a.matchMethod.stringExact, "1000");
}
if (a.domCmp(["shink.in"])) {
    //Prevent block screen
    a.readOnly("RunAds", true);
    //Skip countdown
    if (a.win.location.pathname.startsWith("/go/")) {
        a.ready(() => {
            const link = a.doc.getElementById("btn-main");
            const i = link.href.lastIndexOf("http");
            const url = link.href.substr(i);
            a.win.location.href = url;
        });
    }
    //Block popup
    a.readOnly("jsPopunder", () => { });
    a.win.open = () => { };
    a.filter('document.createElement', a.matchMethod.callback, function(args) {
        var elem = (args[0]||"").toLowerCase();
        return elem == "a";
    }, function(args) {
        switch (args[0].toLowerCase()) {
            case "a":
                return null;
        }
    });
}
if (a.domCmp(["gamezhero.com"])) {
    a.readOnly("ads", true);
    a.timewarp("setInterval", a.matchMethod.string, "function (){var _0x");
}
if (a.domCmp(["freetvall.com"])) {
    a.readOnly("clickNS", () => { });
}
if (a.domCmp(["hotslogs.com"])) {
    //Issue: https://github.com/jspenguin2017/uBlockProtector/issues/121
    a.win.MonkeyBroker = {};
    a.noAccess("MonkeyBroker.regSlotsMap");
}
if (a.domCmp(["undeniable.info"])) {
    a.bait("div", "#testadblock");
}
if (a.domInc(["gamereactor"])) {
    //Issue: https://github.com/jspenguin2017/uBlockProtector/issues/124
    a.cookie("countdownToAd", "-1");
    //Skip welcome page
    a.ready(() => {
        if (a.doc.querySelector("a.buttonBox.continue > span").innerHTML.startsWith("Continue to ")) {
            location.reload();
        }
    });
}
if (a.domCmp(["dasolo.co"])) {
    //Issue: https://github.com/jspenguin2017/uBlockProtector/issues/126
    a.win.eval = () => { };
    a.noAccess("adblockblock");
    a.bait("div", "#loveyou");
    //Remove right click and shortcut keys blocker
    //a.readOnly will crash function declaration, so these are enough
    a.readOnly("nocontext", null);
    a.readOnly("mischandler", null);
    a.readOnly("disableselect", null);
    a.filter("document.addEventListener", a.matchMethod.stringExact, "contextmenu");
    //Issue: https://github.com/jspenguin2017/uBlockProtector/issues/280
    a.filter("alert");
    a.on("load", () => {
        a.doc.oncontextmenu = null;
        a.doc.onmousedown = null;
        a.doc.onmouseup = null;
        a.setTimeout(() => {
            a.win.$("body").unbind("contextmenu");
            a.win.$("#id").unbind("contextmenu");
        }, 250);
    });
}
if (a.domCmp(["titulky.com"])) {
    //Issue: https://github.com/jspenguin2017/uBlockProtector/issues/128
    a.generic.FuckAdBlock("FADB", "fADB");
}
if (a.domCmp(["discoveryrom.org"])) {
    a.win.adsbygoogle = [];
}
if (a.domCmp(["sthelensstar.co.uk", "runcornandwidnesworld.co.uk", "leighjournal.co.uk",
    "warringtonguardian.co.uk", "northwichguardian.co.uk", "middlewichguardian.co.uk",
    "knutsfordguardian.co.uk", "wilmslowguardian.co.uk", "creweguardian.co.uk",
    "thewestmorlandgazette.co.uk", "newsquest.co.uk", "messengernewspapers.co.uk",
    "lancashiretelegraph.co.uk", "asianimage.co.uk", "chorleycitizen.co.uk",
    "theboltonnews.co.uk", "burytimes.co.uk", "prestwichandwhitefieldguide.co.uk",
    "wirralglobe.co.uk", "autoexchange.co.uk", "chesterlestreetadvertiser.co.uk",
    "consettstanleyadvertiser.co.uk", "darlingtonaycliffesedgefieldadvertiser.co.uk",
    "darlingtonandstocktontimes.co.uk", "durhamadvertiser.co.uk",
    "edition.pagesuite-professional.co.uk", "durhamtimes.co.uk", "northyorkshireadvertiser.co.uk",
    "thenorthernecho.co.uk", "northernfarmer.co.uk", "wearvalleyadvertiser.co.uk",
    "gazetteherald.co.uk", "yorkpress.co.uk", "cravenherald.co.uk", "ilkleygazette.co.uk",
    "keighleynews.co.uk", "thetelegraphandargus.co.uk", "wharfedaleobserver.co.uk",
    "herefordtimes.com", "ludlowadvertiser.co.uk", "redditchadvertiser.co.uk",
    "bromsgroveadvertiser.co.uk", "droitwichadvertiser.co.uk", "cotswoldjournal.co.uk",
    "eveshamjournal.co.uk", "tewkesburyadmag.co.uk", "dudleynews.co.uk", "halesowennews.co.uk",
    "stourbridgenews.co.uk", "kidderminstershuttle.co.uk", "ledburyreporter.co.uk",
    "malverngazette.co.uk", "worcesternews.co.uk", "southendstandard.co.uk",
    "essexcountystandard.co.uk", "gazette-news.co.uk", "clactonandfrintongazette.co.uk",
    "harwichandmanningtreestandard.co.uk", "braintreeandwithamtimes.co.uk", "halsteadgazette.co.uk",
    "guardian-series.co.uk", "brentwoodweeklynews.co.uk", "chelmsfordweeklynews.co.uk",
    "maldonandburnhamstandard.co.uk", "thurrockgazette.co.uk", "basildonrecorder.co.uk",
    "echo-news.co.uk", "bucksfreepress.co.uk", "theargus.co.uk", "redhillandreigatelife.co.uk",
    "romseyadvertiser.co.uk", "dailyecho.co.uk", "hampshirechronicle.co.uk",
    "basingstokegazette.co.uk", "andoveradvertiser.co.uk", "stalbansreview.co.uk",
    "watfordobserver.co.uk", "heraldseries.co.uk", "banburycake.co.uk", "bicesteradvertiser.net",
    "oxfordmail.co.uk", "oxfordtimes.co.uk", "witneygazette.co.uk", "falmouthpacket.co.uk",
    "smallholder.co.uk", "southwestfarmer.co.uk", "dorsetecho.co.uk", "bournmouthecho.co.uk",
    "bridportnews.co.uk", "wiltsglosstandard.co.uk", "gazetteseries.co.uk", "bridgwatermercury.co.uk",
    "burnhamandhighbridgeweeklynews.co.uk", "chardandilminsternews.co.uk", "middevonstar.co.uk",
    "somersetcountygazette.co.uk", "thisisthewestcountry.co.uk", "yeovilexpress.co.uk",
    "wiltshiretimes.co.uk", "swindonadvertiser.co.uk", "salisburyjournal.co.uk",
    "boxingnewsonline.net", "engagedinvestor.co.uk", "globalreinsurance.com", "insurancetimes.co.uk",
    "pensions-insight.co.uk", "strategic-risk-global.com", "reward-guide.co.uk", "thestrad.com",
    "times-series.co.uk", "borehamwoodtimes.co.uk", "ealingtimes.co.uk", "enfieldindependent.co.uk",
    "haringeyindependent.co.uk", "harrowtimes.co.uk", "hillingdontimes.co.uk", "newsshopper.co.uk",
    "croydonguardian.co.uk", "epsomguardian.co.uk", "streathamguardian.co.uk", "suttonguardian.co.uk",
    "wandsworthguardian.co.uk", "wimbledonguardian.co.uk", "surreycomet.co.uk", "kingstonguardian.co.uk",
    "richmondandtwickenhamtimes.co.uk", "campaignseries.co.uk", "southwalesguardian.co.uk",
    "milfordmercury.co.uk", "pembrokeshirecountyliving.co.uk", "westerntelegraph.co.uk",
    "tivysideadvertiser.co.uk", "southwalesargus.co.uk", "cotswoldessence.co.uk",
    "freepressseries.co.uk", "monmouthshirecountylife.co.uk", "barryanddistrictnews.co.uk",
    "penarthtimes.co.uk", "eveningtimes.co.uk", "s1cars.com", "s1community.com", "s1homes.com",
    "s1jobs.com", "s1rental.com", "thescottishfarmer.co.uk", "heraldscotland.com", "thenational.scot"])) {
    //Issue: https://github.com/jspenguin2017/uBlockProtector/issues/137
    a.readOnly("_sp_", null);
}
if (a.domCmp(["securenetsystems.net"])) {
    a.readOnly("iExist", true);
}
if (a.domCmp(["finalservers.net"])) {
    //Issue: https://github.com/jspenguin2017/uBlockProtector/issues/125
    a.ready(() => {
        a.win.videojs("video_1").videoJsResolutionSwitcher();
    });
}
if (a.domCmp(["filmy.to", "histock.info"])) {
    //Issue: https://github.com/jspenguin2017/uBlockProtector/issues/130
    a.win.open = () => {
        return { closed: false };
    };
}
if (a.domCmp(["flashx.tv"])) {
    a.filter("addEventListener", a.matchMethod.stringExact, "keydown", "window.document");
}
if (a.domCmp(["multiup.org", "multiup.eu"])) {
    a.cookie("visit", "1");
    a.readOnly("hi", () => { });
    a.ready(() => {
        a.$(".alert").each(function () {
            if (a.$(this).text().includes("Tired of ads ? Remove them")) {
                a.$(this).remove();
            }
        });
        const elem = a.$("#M130814ScriptRootC54591");
        elem.text().includes("Loading...") && elem.remove();
    });
}
if (a.domCmp(["linkneverdie.com"])) {
    //Issue: https://github.com/jspenguin2017/uBlockProtector/issues/146
    a.readOnly("eval", () => {
        //Remove block screen
        a.$("div").each(function () {
            if (this.id.length === 30) {
                this.remove();
            }
        });
    });
    a.ready(() => {
        a.$(".SC_TBlock").each(function () {
            if (a.$(this).text() === "loading...") {
                this.remove();
            }
        });
        a.$("#wrapper").show();
    });
}
if (a.domCmp(["ally.sh", "al.ly", "croco.site"])) {
    a.timewarp("setInterval", a.matchMethod.stringExact, "1000");
    a.win.open = null;
}
if (a.domCmp(["nbc.com"])) {
    a.noAccess("mps");
}
if (a.domCmp(["filmyiseriale.net"])) {
    //https://github.com/jspenguin2017/uBlockProtector/issues/152
    a.ready(() => {
        a.win.konik = 1;
    });
}
if (a.domCmp(["tf2center.com"])) {
    //Issue: https://github.com/jspenguin2017/uBlockProtector/issues/141
    a.filter("setInterval", a.matchMethod.string, '"/adblock"');
    a.filter("setTimeout", a.matchMethod.stringExact, "function (){B(F+1)}");
}
if (a.domCmp(["gaybeeg.info"])) {
    //NSFW!
    a.observe("insert", (node) => {
        if (node && node.innerHTML && node.innerHTML.includes("AdBloker Detected")) {
            node.remove();
        }
    });
    a.ready(() => {
        //Execute some in-line scripts manually
        a.$("script").each((i, elem) => {
            if (!elem || !elem.text) {
                return;
            }
            const hash = a.md5(elem.text);
            //Emoji script
            if (hash === "780f6a53e6a6ce733d964a5b93c4a703") {
                a.win.eval(elem.text);
                return;
            }
            //Archive
            if (elem.text.includes("/*  Collapse Functions, version 2.0")) {
                const temp = elem.text.split("/*  Collapse Functions, version 2.0");
                if (temp.length === 2) {
                    const hash = a.md5(temp[1]);
                    if (hash === "2e4a544c72f4f71e64c86ab9c5f1dd49") {
                        a.win.eval(elem.text);
                    } else if (a.config.debugMode) {
                        a.out.warn("Archive related inline script does not match expected hash:");
                        a.out.warn(temp[1]);
                        a.out.warn(`Hash: ${hash}`);
                    } else {
                        a.out.warn("Archive related inline script does not match expected hash.");
                    }
                    //Return here to prevent it from being logged twice
                    return;
                }
            }
            //Log blocked code
            if (a.config.debugMode) {
                a.out.warn("This inline script is not executed:")
                a.out.warn(elem.text);
                a.out.warn(`Hash: ${hash}`);
            } else {
                a.out.warn("An inline script is not executed.");
            }
        });
        //Patch download button
        a.$(".download a.button").each((i, el) => {
            a.$(el).removeClass("locked").attr("href", a.$(el).data("href"))
                .removeAttr("data-href");
        });
    });
}
if (a.domCmp(["mma-core.com"])) {
    a.noAccess("displayAdBlockedVideo");
}
if (a.domCmp(["menshealth.pl", "womenshealth.pl", "runners-world.pl",
    "auto-motor-i-sport.pl", "motocykl-online.pl", "mojeauto.pl"])) {
    a.ready(() => {
        if (a.win.location.pathname.startsWith("/welcome-page")) {
            a.win.location.href = a.$("#timeLink").attr("href");
        }
    });
}
if (a.domCmp(["dovathd.com"])) {
    a.ready(() => {
        a.$(".onp-sl-social-buttons-enabled").remove();
        a.$(".onp-sl-content").show();
    });
}
if (a.domCmp(["temp-mail.org"])) {
    a.readOnly("checkadBlock", () => { });
}
if (a.domCmp(["gaana.com"])) {
    const noop = () => { };
    const pType = {
        _auds: "", //all
        isauds: false,
        lotamecall: false,
        itemInfo: [],
        colombiaAdeURL: "",
        deviceType: "", //desktop
        colombiaCookies: "",
        privateMode: true,
        adIconInfo: [],
        fns: { push: noop },
        update: noop,
        colombiaAdRequest: noop,
        resetAdDivClass: noop,
        clear: noop,
        clearData: noop,
        notifyColombiaAd: noop,
        refresh: noop,
        refreshFBAd: noop,
        timeoutHandler: noop,
        load: noop,
        loadDataAd: noop,
        drawIconHtml: noop,
        loadDisplayAd: noop,
        jsonCallback: noop,
        getCB: noop,
        repllaceMacro: noop,
        getAdJSON: noop,
        fireImpression: noop,
        fireThirdPartyImp: noop,
        storeThirdPartyImprURL: noop,
        dataResponseFormat: noop,
        storeAdIcons: noop,
        checkDevice: noop,
        dfpLog: noop,
    };
    let obj = function () { };
    obj.prototype = pType;
    a.readyOnly("colombia", new obj());
}
if (a.domCmp(["gelbooru.com"])) {
    if (a.win.location.pathname === "/") {
        a.on("load", () => {
            a.$("div").each(function () {
                if (a.$(this).text() === "Have you first tried disabling your AdBlock?") {
                    a.$(this).empty();
                }
            });
        });
    } else {
        a.noAccess("abvertDar");
    }
}
if (a.domCmp(["urle.co"])) {
    a.filter("setTimeout", a.matchMethod.string, "captchaCheckAdblockUser();");
    a.filter("eval");
    a.timewarp("setInterval", a.matchMethod.stringExact, "1000");
}
if (a.domCmp(["playbb.me", "easyvideo.me", "videowing.me", "videozoo.me"])) {
    a.ready(() => {
        $(".safeuploada-content").css("background", "transparent");
    });
}
if (a.domCmp(["nicematin.com"])) {
    a.noAccess("checkAds");
}
if (a.domCmp(["up-4ever.com"])) {
    a.filter("setTimeout", a.matchMethod.string, "$('#adblock_detected').val(1);");
    //Force show download links
    a.css("#hiddensection { display:block; }");
    a.ready(() => {
        a.$("#hiddensection").show();
        a.$("#hiddensection2").remove();
    });
}
if (a.domCmp(["exrapidleech.info"])) {
    //Thanks to lain566
    a.filter("eval");
    //Prevent sending to verify page
    a.readOnly("PopAds", "this is a string");
    a.cookie("popcashpuCap", "1");
    a.cookie("popcashpu", "1");
    //Remove warnings
    a.ready(() => {
        a.$(".alert-danger.lead:contains('block')").remove();
        a.$("p:contains('Please disable ads block')").remove();
        a.$("p:contains('Please turn on popup')").remove();
    });
}
if (a.domCmp(["ouo.io"])) {
    a.win.localStorage.setItem("snapLastPopAt", (new a.win.Date()).getTime());
    a.timewarp("setInterval", a.matchMethod.stringExact, "1000");
}
if (a.domCmp(["canalplus.fr"])) {
    let original; //Will be set later
    let currentVideoId = null; //So I do not switch unless it is different
    let videoElem; //Current video player element, used to replace it when changing episode
    //New handler
    const newFunc = function (onglet, liste, page, pid, ztid, videoId, progid) {
        //Switch video
        if (videoId !== currentVideoId) {
            currentVideoId = videoId;
            videoSwitch(videoId);
        }
        //Run original function
        original.apply(a.win, arguments);
    };
    //Video switcher
    const videoSwitch = function (videoID) {
        videoElem.text("Loading...");
        GM_xmlhttpRequest({
            method: "GET",
            url: `http://service.canal-plus.com/video/rest/getVideos/cplus/${videoID}?format=json`,
            onload(res) {
                //Try to find media URL
                try {
                    const response = JSON.parse(res.responseText);
                    const url = response.MEDIA.VIDEOS.HD;
                    if (url) {
                        const tempElem = a.$(a.nativePlayer(url + "?secret=pqzerjlsmdkjfoiuerhsdlfknaes"));
                        videoElem.after(tempElem).remove();
                        videoElem = tempElem;
                    } else {
                        throw "Media URL Not Found";
                    }
                } catch (err) {
                    a.out.error("AAK failed to find media URL!");
                }
            },
            onerror() {
                a.out.error("AAK failed to load media JSON!");
            },
        });
    };
    //Initialization
    a.ready(() => {
        //Insert our handler in between theirs
        original = a.win.changeOngletColonneCentrale;
        a.win.changeOngletColonneCentrale = newFunc;
        //Get the original player
        videoElem = a.$("#onePlayerHolder");
        //Set current video ID then patch the player for the first time
        if (currentVideoId = videoElem.data("video")) {
            videoSwitch(currentVideoId);
        }
    });
}
if (a.domCmp(["translatica.pl"])) {
    a.readOnly("adblock", false);
}
if (a.domCmp(["vidlox.tv"])) {
    a.readOnly("adb", 0);
}
if (a.domCmp(["receive-sms-online.info"])) {
    a.filter("addEventListener", a.matchMethod.stringExact, `function (b){return"undefined"!=typeof n&&` +
        `n.event.triggered!==b.type?n.event.dispatch.apply(a,arguments):void 0}`);
}
if (a.domCmp(["3dgames.com.ar"])) {
    a.generic.FuckAdBlock(a.uid(), "gw");
}
if (a.domCmp(["mexashare.com", "kisshentai.net"])) {
    a.readOnly("BetterJsPop", () => { });
}
if (a.domCmp(["comicallyincorrect.com"])) {
    a.observe("insert", (node) => {
        if (node && node.tagName === "DIV" && node.innerHTML && node.innerHTML.includes("Paid Content:")) {
            node.remove();
        }
    });
}
if (a.domCmp(["cda.pl"])) {
    a.readOnly("adblockV1", true);
}
if (a.domCmp(["linternaute.com"])) {
    let val;
    a.win.Object.defineProperty(a.win, "OO", {
        configurable: false,
        set(arg) {
            val = arg;
        },
        get() {
            val && (val.AAB = null);
            return val;
        },
    });
}
if (a.domCmp(["new-skys.net"])) {
    a.noAccess("alert");
}
if (a.domCmp(["gentside.com"])) {
    a.readOnly("adblockPopup", {
        IS_BLOCKED: false,
        init() { },
        removeAdblockPopup() { },
    });
}
if (a.domCmp(["idlelivelink.blogspot.com"])) {
    a.timewarp("setInterval", a.matchMethod.stringExact, "1000");
    a.ready(() => {
        a.doc.body.oncontextmenu = null;
        a.doc.body.onkeydown = null;
        a.doc.body.onmousedown = null;
    });
}
if (a.domCmp(["hackinformer.com"])) {
    a.ready(() => {
        a.$(".special-message-wrapper:contains(your ad blocker)").remove();
    });
}
if (a.domCmp(["tg007.net"])) {
    a.bait("div", "#gads", true);
}
if (a.domCmp(["bild.de"])) {
    a.filter("document.querySelector", a.matchMethod.stringExact, "body");
}
if (a.domCmp(["codepo8.github.io"]) && a.win.location.pathname.startsWith("/detecting-adblock/")) {
    a.css(".notblocked { display:block; } .blocked { display:none; }");
}
if (a.domCmp(["altadefinizione.media"])) {
    //Issue: https://gitlab.com/xuhaiyang1234/uBlockProtectorSecretIssues/issues/1
    a.ready(() => {
        a.$("a[href='https://web.archive.org/web/20180327090220/http://altarisoluzione.online/HD/play5.php']").remove();
    });
}
if (a.domCmp(["hdpass.net"])) {
    //Issue: https://gitlab.com/xuhaiyang1234/uBlockProtectorSecretIssues/issues/1
    let flag = false;
    a.win.open = () => {
        flag = true;
    };
    a.on("load", () => {
        let token = a.setInterval(() => {
            a.win.$(".wrapSpot span#closeSpot").click();
            if (flag) {
                a.clearInterval(token);
            }
        }, 500);
    });
}
if (a.domCmp(["nowvideo.ec", "nowvideo.li", "ewingoset.info"])) {
    //Issue: https://gitlab.com/xuhaiyang1234/uBlockProtectorSecretIssues/issues/2
    //Issue: https://gitlab.com/xuhaiyang1234/uBlockProtectorSecretIssues/issues/5
    a.ready(() => {
        a.$("#cty").append(`<input type="hidden" name="ab" value="1">`);
    });
}
if (a.domCmp(["karibusana.org"])) {
    //Issue: https://github.com/jspenguin2017/uBlockProtector/issues/253
    a.noAccess("bizpanda");
    a.css(".onp-locker-call { display:block; }");
}
if (a.domCmp(["lewat.id", "u2s.io"])) {
    //Issue: https://gitlab.com/xuhaiyang1234/uBlockProtectorSecretIssues/issues/4
    a.timewarp("setInterval", a.matchMethod.stringExact, "1000");
    let matcher;
    if (a.domCmp(["lewat.id"], true)) {
        matcher = /^https?:\/\/lewat\.id\//i;
    } else if (a.domCmp(["u2s.io"], true)) {
        matcher = /^https?:\/\/u2s\.io\//i;
    }
    const token = a.setInterval(() => {
        const elem = a.$(".skip-ad a");
        if (elem.length && elem[0].href && !matcher.test(elem[0].href)) {
            a.$(".skip-ad").hide();
            a.win.location.href = elem[0].href;
            a.clearInterval(token);
        }
    }, 250);
}
if (a.domCmp(["shinden.pl"])) {
    a.readOnly("shinden_ads", true);
}
if (a.domCmp(["onhax.me"])) {
    const _open = a.win.open;
    a.win.open = (...args) => {
        if (args[1].startsWith("wpcom")) {
            return _open.apply(a.win, args);
        }
    }
}
if (a.domCmp(["null-24.com"])) {
    a.ready(() => {
        a.$("#custom-links .custom-url-wrap a").each(function () {
            this.href = this.innerHTML;
        });
        a.setTimeout(() => {
            a.win.jQuery("span:contains(Download Direct Link)").parent().unbind("click");
        }, 250);
    });
}
if (a.domCmp(["searchftps.net"])) {
    a.$(`<iframe width="336" height="280" style="display:none;"></iframe>`).appendTo("html");
}
if (a.domCmp(["cyberterminators.co"])) {
    a.ready(() => {
        a.doc.oncontextmenu = null;
    });
}
if (a.domCmp(["youtube-videos.tv"])) {
    a.css(".cactus-video-content div { display:block; } .mts-cl-horizontal.mts-cl-social-locker { display:none; }");
    a.noAccess("KillAdBlock");
}
if (a.domCmp(["dailyuploads.net"])) {
    a.css("#downloadBtnClickOrignal { display:block; } #downloadBtnClick { display:none; } #chkIsAdd { display:none; }");
}
if (a.domCmp(["buickforums.com"])) {
    a.bait("div", "#TestAdBlock", true);
}
if (a.domCmp(["realkana.com"])) {
    a.generic.FuckAdBlock("HooAdBlock", "hooAdBlock");
}
if (a.domCmp(["generatorlinkpremium.com"])) {
    $(document).ready(() => {
        const normal = $("#normal").attr("href") + "&h=1";
        $("#quick").attr("href", normal);
        $("#quick").attr("title", "Download this file with a faster download speed");
        $("#quick").css("cursor", "pointer");
    });
}
if (a.domCmp(["genbird.com"])) {
    a.filter("addEventListener", a.matchMethod.string, "Please disable your ad blocker.");
}
if (a.domCmp(["pg3dhacks.com"])) {
    a.ready(() => {
        const buttons = document.querySelectorAll("button");
        const matcher = /Unlock.*Download/;
        for (let i = 0; i < buttons.length; i++) {
            if (buttons[i].innerText === "Download") {
                buttons[i].disabled = false;
            } else if (matcher.test(buttons[i].innerText)) {
                buttons[i].remove();
            }
        }
    });
}
if (a.domCmp(["lne.es"])) {
    a.ready(() => {
        a.addScript(() => {
            window.onload = null;
        });
    });
}
if (a.domCmp(["cutwin.com", "cut-urls.com", "adbull.me", "xess.pro", "clik.pw", "admove.co"])) {
    a.bait("div", "#test-block", true);
    a.timewarp("setInterval", a.matchMethod.stringExact, "1000");
}
if (a.domCmp(["adshort.co", "linksh.top", "adshorte.com", "coinb.ink", "gratisjuegos.co"])) {
    a.noAccess("F3Z9");
}
if (a.domCmp(["gamersclub.com.br", "uploadboy.com", "vidoza.net", "videohelp.com"])) {
    a.generic.adsjsV2();
}
if (a.domCmp(["noticiasautomotivas.com.br"])) {
    a.css("html, body { overflow:scroll; } cloudflare-app[app-id='no-adblock'] { display:none; }", true);
}
if (a.domCmp(["tf1.fr"])) {
    a.xhrSpoof("@@||louccrossc.com^", "");
    a.xhrSpoof("@@||foilpolyth.com^", "");
}
if (a.domCmp(["sport365.live"])) {
    a.inject(() => {
        "use strict";
        const _eval = window.eval;
        window.eval = (...args) => {
            try {
                window.$.adblock = false;
            } catch (err) { }
            _eval.apply(window, args);
        };
    });
}
if (a.domCmp(["gsmarena.com"])) {
    a.filter("eval");
}
if (a.domCmp(["myfxbook.com"])) {
    a.inject(() => {
        "use strict";
        const err = new window.Error("This property may not be accessed!");
        window.Object.defineProperty(window, "isAdBlockerExist", {
            configurable: false,
            get() {
                throw err;
            },
            set(val) {
                if (val) {
                    throw err;
                }
            }
        });
    });
}
if (a.domCmp(["ptztv.com", "mahobeachcam.com"])) {
    a.readOnly("PTZtv", true);
}
if (a.domCmp(["mywrestling.com.pl"])) {
    a.generic.FuckAdBlock("KillAdBlock", "killAdBlock");
}
if (a.domCmp(["vvvvid.it"])) {
    a.ready(() => {
        a.inject(() => {
            //Based on KAADIVVVV
            //License: https://github.com/Robotex/KAADIVVVV/blob/master/LICENSE
            "use strict";
            if (window.vvvvid) {
                const re = /var a=function.*};/;
                const data = `var a=function(){vvvvid.advPlayer=null,$(c.playerControlsClass).removeClass("ppad"),d()};`;
                //Patch properties
                window.vvvvid.cab4 = function (a, b) {
                    this.isAdBlockActive = false;
                    b && b(false);
                };
                const func = window.String(window.vvvvid.models.PlayerObj.prototype.startAdv);
                if (!re.test(func)) {
                    window.console.error("AAK failed to set up VVVVID detector defuser!");
                }
                //That variable name feels like a trap
                //https://github.com/Robotex/KAADIVVVV/issues/16
                window.eval("window[mnsJHnyT] = window.vvvvid.models.PlayerObj.prototype.startAdv = " + func.replace(re, data));
            }
        });
    });
}
if (a.domCmp(["nekopoi.bid"])) {
    //NSFW!
    a.readOnly("adblock", false);
    a.readOnly("isAdsDisplayed", true);
}
if (a.domCmp(["wunderground.com"])) {
    a.readOnly("noAdBlocker", "no");
}
if (a.domCmp(["short.am"])) {
    if (location.pathname !== "/") {
        a.readOnly("RunAds", undefined);
        a.ready(() => {
            let check = a.$("#disable > div.alert-danger");
            if (check.length) {
                check.text("Please wait...");
                a.on("load", () => {
                    //Based on AdsBypasser
                    //License: https://github.com/adsbypasser/adsbypasser/blob/master/LICENSE
                    let f = document.createElement("form");
                    f.style.display = "none";
                    f.method = "post";
                    let i = document.createElement("input");
                    i.name = "_image";
                    i.value = "Continue";
                    f.appendChild(i);
                    document.body.append(f);
                    f.submit();
                });
            }
        });
    }
}
if (a.domCmp(["jbzdy.pl"])) {
    a.inject(() => {
        "use strict";
        let val;
        window.Object.defineProperty(window, "App", {
            configurable: false,
            set(arg) {
                val = arg;
                try {
                    val.adb.init = () => { };
                } catch (err) { }
            },
            get() {
                return val;
            },
        });
    });
}
if (a.domCmp(["egobits.com"])) {
    a.noAccess("detector_launch");
}
if (a.domCmp(["cbs.com"])) {
    if (!a.cookie("first_page_today") && !sessionStorage.getItem("_first_page_today_fallback")) {
        sessionStorage.setItem("_first_page_today_fallback", true);
        a.ready(() => {
            location.reload();
        });
    }
}
if (a.domCmp(["cdn-surfline.com"])) {
    a.filter("setTimeout", a.matchMethod.string, "ad blocker");
    a.ready(() => {
        a.inject(() => {
            "use strict";
            window.doFallBackonAdError = () => { };
        });
    });
}
if (a.domCmp(["zimuku.net"])) {
    a.readOnly("isAdEnabled", true);
}
if (a.domCmp(["timesofindia.indiatimes.com"])) {
    a.ready(() => {
        setTimeout(() => {
            if (location.href.includes("interstitial")) {
                a.cookie("nsIstial_Cook", "1");
                a.cookie("ns", "1");
                location.href = "https://timesofindia.indiatimes.com/";
            }
        }, 300);
    });
}
if (a.domCmp(["anonymousemail.me"])) {
    a.beforeScript((script) => {
        if (script.textContent && script.textContent.includes("anonymousemail.me/adblock.php")) {
            script.remove();
        }
    });
}
if (a.domCmp(["solowrestling.com"])) {
    a.readOnly("bloq", 1);
}
if (a.domCmp(["arenavision.us"])) {
    a.noAccess("H7WWWW");
}
if (a.domCmp(["wowtoken.info"])) {
    const re = /fail\(\);/g;
    a.beforeScript((script) => {
        if (script.src && script.src.includes("/js/main.js")) {
            $.request({
                method: "GET",
                url: script.src,
            }, (data) => {
                a.inject(data.replace(re, "true;"), true);
            }, () => {
                console.error("AAK failed to patch main script!");
            });
            script.remove();
        }
    });
}
if (a.domCmp(["wifihack.me"])) {
    a.noAccess("AdBlocked");
}
if (a.domCmp(["gntai.xyz"])) {
    a.readOnly("showAds", true);
}
if (a.domCmp(["viasatsport.se", "viasport.fi", "tv3sport.dk", "viasport.no"])) {
    a.inject(() => {
        "use strict";
        const observer = new window.MutationObserver(() => {
            const videos = window.document.querySelectorAll("video.blurred");
            for (let i = 0; i < videos.length; i++) {
                videos[i].classList.remove("blurred");
            }
            const buttons = window.document.querySelectorAll(".vjs-overlay-message-close-button");
            for (let i = 0; i < buttons.length; i++) {
                buttons[i].click();
            }
            if (window.videoPlayers instanceof window.Object) {
                for (let key in window.videoPlayers) {
                    try {
                        window.videoPlayers[key]._player.trigger("hideOverlayBlur");
                    } catch (err) { }
                }
            }
        });
        observer.observe(window.document, {
            childList: true,
            subtree: true,
        });
    });
}
if (a.domCmp(["graphiq-stories.graphiq.com"])) {
    a.loopback((ignored, url) => {
        if (url.startsWith("/ad?")) {
            return "window.FTBAds.blocking = false;";
        }
    });
}
if (a.domCmp(["graphiq-stories.graphiq.com"])) {
    a.loopback((ignored, url) => {
        if (url.startsWith("/ad?")) {
            return "window.FTBAds.blocking = false;";
        }
    });
}
if (a.domCmp(["nontonanime.org"])) {
    a.readOnly("ADBLOCK", true);
}
if (a.domCmp(["tuba.pl"])) {
    a.readOnly("adsOk", true);
}
if (a.domCmp(["wetter3.de"])) {
    a.readOnly("karte1", 18);
}
if (a.domCmp(["webnovel.com"])) {
    //Issue: https://github.com/jspenguin2017/uBlockProtector/issues/457
    const bookExtractor = /\/book\/([^/]+)/;
    let isInBackground = false;
    const scanner = () => {
        if (isInBackground) {
            return;
        }
        $(".cha-content._lock").each((lock) => {
            //Remove flag
            lock.classList.remove("_lock");
            //Remove video
            const video = lock.closest(".chapter_content").querySelector(".lock-video");
            if (video) {
                video.remove();
            }
            //Let user know what is happening
            const contentElem = lock.querySelector(".cha-words");
            contentElem.insertAdjacentHTML("beforeend", "<p style='opacity:0.5;'>" +
                "AAK is fetching the rest of this chapter, this can take up to 30 seconds.</p>");
            //Get IDs
            const bookID = bookExtractor.exec(location.href)[1];
            const chapterID = lock.querySelector("[data-cid]").dataset.cid;
            //Check if I got IDs
            if (!bookID || !chapterID) {
                return;
            }
            //Get cookie
            const cookie = encodeURIComponent(a.cookie("_csrfToken"));
            //Get token
            $.ajax({
                method: "GET",
                url: `https://www.webnovel.com/apiajax/chapter/GetChapterContentToken?_csrfToken=` +
                `${cookie}&bookId=${bookID}&chapterId=${chapterID}`,
            }).done((data) => {
                try {
                    let token = JSON.parse(data).data.token;
                    token = encodeURIComponent(token);
                    fetchChapter(cookie, token, contentElem);
                } catch (err) {
                    console.error("AAK failed to find chapter token!");
                }
            }).fail(() => {
                console.error("AAK failed to find chapter token!");
            });
        });
    };
    const fetchChapter = (cookie, token, contentElem) => {
        const tick = () => {
            $.ajax({
                method: "GET",
                url: `https://www.webnovel.com/apiajax/chapter/GetChapterContentByToken?_csrfToken=` +
                `${cookie}&token=${token}`,
            }).done((data) => {
                try {
                    const content = JSON.parse(data).data.content.trim();
                    if (content) {
                        drawChapter(content, contentElem);
                    } else {
                        setTimeout(tick, 2000);
                    }
                } catch (err) {
                    setTimeout(tick, 2000);
                }
            }).fail(() => {
                setTimeout(tick, 2000);
            });
        };
        tick();
    };
    const drawChapter = (content, contentElem) => {
        const lines = content.split("\n");
        contentElem.innerHTML = "";
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) {
                continue;
            }
            const p = document.createElement("p");
            p.textContent = line;
            contentElem.append(p);
        }
    };
    setInterval(scanner, 1000);
    a.on("focus", () => { isInBackground = false; });
    a.on("blur", () => { isInBackground = true; });
}
if (a.domCmp(["falter.at"])) {
    a.noAccess("showFalterGif");
}
if (a.domCmp(["ur.ly", "urly.mobi"])) {
    const re = /\?ref=.*/;
    a.onInsert((node) => {
        if (node.id === "skip_button1") {
            stop();
            location.href = node.href.replace(re, "?href=https://google.com/");
        }
    });
}
if (a.domCmp(["shutterdowner.com"])) {
    a.bait("div", "#zagshutter");
}
if (a.domCmp(["gpro.net"])) {
    a.ready(() => {
        $("#blockblockA").parent().parent().remove();
    });
}
if (a.domCmp(["vsports.pt"])) {
    a.readOnly("adblockDetecter", true);
}
if (a.domCmp(["sledujufilmy.cz"])) {
    a.readOnly("ads_ok", true);
}
if (a.domCmp(["bildungsspender.de"])) {
    a.readOnly("werbeblocker", true);
}
if (a.domCmp(["pseudo-flaw.net"])) {
    a.readOnly("stopBlock", () => { });
}
if (a.domCmp(["clasicotas.org"])) {
    a.filter("addEventListener", a.matchMethod.stringExact, "mouseup", "window.document");
}
if (a.domCmp(["mwpaste.com"])) {
    a.css("#downbloq { display:none; } .hidebloq { display:block; }");
    a.ready(() => {
        a.inject(() => {
            "use strict";
            const blocks = window.document.querySelectorAll(".hidebloq");
            for (let i = 0; i < blocks.length; i++) {
                blocks[i].innerHTML = window.atob(blocks[i].textContent);
            }
        });
    });
}
if (a.domCmp(["portel.pl"])) {
    a.readOnly("blokowanko", false);
}
if (a.domCmp(["mangacanblog.com"])) {
    a.readOnly("adblock", 1);
}
if (a.domCmp(["aargauerzeitung.ch", "badenertagblatt.ch", "basellandschaftlichezeitung.ch", "bzbasel.ch",
    "limmattalerzeitung.ch", "solothurnerzeitung.ch", "grenchnertagblatt.ch", "oltnertagblatt.ch"])) {
    a.filter("setTimeout", a.matchMethod.string, "[native code]");
}
if (a.domCmp(["qoshe.com"])) {
    a.readOnly("adBlockAlertShown", true);
    a.filter("setTimeout", a.matchMethod.string, "adBlockFunction()");
}
if (a.domCmp(["spiegel.de"])) {
    a.generic.FuckAdBlock("ABB", "abb");
}
if (a.domCmp(["tvnow.de"])) {
    a.replace(() => {
        if (url.includes("/v3/movies/")) {
            this.addEventListener("readystatechange", () => {
                if (this.readyState === 4) {
                    try {
                        let payload = window.JSON.parse(this.responseText);
                        payload.ignoreAd = true;
                        payload.noad = true;
                        payload.geoblocked = false;
                        payload.free = true;
                        payload.blockadeText = "0";
                        payload.format.enableAd = false;
                        payload.format.hasFreeEpisodes = true;
                        payload.format.isGeoBlocked = false;
                        replace(this, window.JSON.stringify(payload));
                    } catch (err) { }
                }
            });
        }
    });
}
if (a.domCmp(["acortar.net", "acortalo.net", "vellenger.com", "infobae.net"])) {
    a.on("load", () => {
        a.inject(() => {
            "use strict";
            let btn = window.document.querySelector(".linkhidder");
            if (btn) {
                const fallback = btn.onclick || (() => { });
                btn.onclick = () => {
                    try {
                        window.location.href = window.href[window.href.length - 1];
                    } catch (err) {
                        fallback();
                    }
                };
            }
        });
    });
}
if (a.domCmp(["peliculasmega.info"])) {
    a.css(".linkhidder { display:none; } a[class*='hidden_'] { display:block; }");
}
if (a.domCmp(["identi.li"])) {
    a.css(".linkhidder { display:none; } div[id^='hidden_'] { display:block; }");
    a.cookie("BetterJsPop0", "1");
    a.ready(() => {
        a.inject(() => {
            "use strict";
            //Type 1
            const blocks = window.document.querySelectorAll(".info_bbc");
            for (let i = 0; i < blocks.length; i++) {
                if (!blocks[i].firstChild.tagName) {
                    const links = window.GibberishAES.dec(blocks[i].textContent, window.hash);
                    blocks[i].innerHTML = window.linkify(links);
                    blocks[i].style.display = "block";
                    blocks[i].parentNode.previousSibling.remove();
                }
            }
            //Type 2
            if (window.$) {
                window.$("div #decrypt.myjdownloader").unbind("click").click(function () {
                    window._decrypt.fnID = "jdownloader";
                    window._decrypt.fnURL = this.getAttribute("href");
                    window._decrypt.objeto = null;
                    window._decrypt.open();
                });
            }
        });
    });
}
if (a.domCmp(["kiss.com.tw"])) {
    a.bait("div", "#ads");
}
if (a.domCmp(["nbcsports.com", "knowyourmeme.com"])) {
    a.readOnly("adblockDetect", () => { });
}
if (a.domCmp(["moviemakeronline.com"])) {
    a.readOnly("abNoticeShowed", true);
}
if (a.domInc(["10co"])) {
    a.bait("div", "#myTestAd", true);
    a.timewarp("setInterval", a.matchMethod.stringExact, "1000");
}
if (a.domCmp(["uptostream.com"])) {
    a.readOnly("check", () => {
        "use strict";
        window.$("#apbplus").css("display", "none");
        window.$("#vid").css("display", "block");
        window.$("#cred").css("display", "block");
    });
}
if (a.domCmp(["adageindia.in", "bombaytimes.com", "businessinsider.in", "gizmodo.in", "iamgujarat.com", "idiva.com",
    "in.techradar.com", "indiatimes.com", "lifehacker.co.in", "mensxp.com", "samayam.com", "gadgetsnow.com"])) {
    //Part 1
    a.inject(() => {
        "use strict";
        const magic = "a" + window.Math.random().toString(36).substring(2);
        const reScript = /typeof otab == 'function'/;
        const reComment = /\d{5,} \d{1,2}/;
        const getter = () => {
            let script;
            {
                let temp = [...window.document.querySelectorAll(`script:not([src]):not([${magic}])`)];
                if (window.document.currentScript && !window.document.currentScript.hasAttribute(magic)) {
                    temp.unshift(window.document.currentScript);
                }
                if (!temp.length) {
                    return true;
                }
                for (let i = 0; i < temp.length; i++) {
                    temp[i].setAttribute(magic, 1);
                    if (reScript.test(temp[i].textContent)) {
                        script = temp[i];
                        break;
                    }
                }
            }
            if (!script) {
                return true;
            }
            {
                const previous = script.previousSibling;
                let temp = previous;
                while (temp = temp.previousSibling) {
                    if (temp.nodeType === window.Node.COMMENT_NODE && reComment.test(temp.data)) {
                        previous.style.setProperty("display", "none", "important");
                        return false;
                    }
                }
            }
        };
        window.Object.defineProperty(window, "trev", {
            configurable: false,
            set() { },
            get() {
                let r;
                let i = 0;
                do {
                    try {
                        r = getter();
                    } catch (err) {
                        //window.console.error(err);
                    }
                } while (!r && (++i) < 100);
                return null;
            },
        });
        window.addEventListener("load", () => {
            void window.trev;
        });
    });
    //Part 2
    let isInBackground = false;
    const reStart = /^\/[a-z_]+\.cms/;
    const reEnd = /^ \d{5,} \d{1,2} $/;
    const adsHidder = (node) => {
        if (!document.body || isInBackground) {
            return;
        }
        let iterator = document.createTreeWalker(document.body, NodeFilter.SHOW_COMMENT);
        let comment;
        while (comment = iterator.nextNode()) {
            if (reStart.test(comment.data)) {
                let toHide = [];
                let previous = comment;
                while (previous = previous.previousSibling) {
                    if (previous.nodeType === Node.COMMENT_NODE && reEnd.test(previous.data)) {
                        if (toHide.length < 15) {
                            for (let i = 0; i < toHide.length; i++) {
                                try {
                                    toHide[i].style.setProperty("display", "none", "important");
                                } catch (err) { }
                            }
                        }
                        break;
                    }
                    toHide.push(previous);
                }
            }
        }
    };
    a.setInterval(adsHidder, 1000);
    a.on("focus", () => { isInBackground = false; });
    a.on("blur", () => { isInBackground = true; });
}
if (a.domCmp(["aternos.org"])) {
    a.filter("setTimeout", a.matchMethod.string, ".ad-detect");
}
if (a.domCmp(["webcafe.bg"])) {
    a.readOnly("bDetect", false);
}
if (a.domCmp(["telecinco.es", "cuatro.com", "divinity.es", "factoriadeficcion.com", "energytv.es", "bemad.es",
    "eltiempohoy.es", "mtmad.es"])) {
    //Issue: https://github.com/jspenguin2017/uBlockProtector/issues/448
    a.inject(() => {
        "use strict";
        const err = new TypeError("Failed to execute 'getElementById' on 'Document': 'adsFooter' is not a valid ID.");
        const original = window.document.getElementById;
        window.document.getElementById = (id, ...rest) => {
            if (id === "adsFooter") {
                throw err;
            } else {
                return original.call(window.document, id, ...rest);
            }
        }
    })
}
if (a.domCmp(["mitele.es"])) {
    //Issue: https://github.com/jspenguin2017/uBlockProtector/issues/448
    a.inject(() => {
        "use strict";
        window.google = {};
    });
}
if (a.domCmp(["docer.pl"])) {
    a.readOnly("ads_unblocked", true);
    a.ready(() => {
        $("#square-1").css("width", "1px");
    });
}
if (a.domCmp(["samehadaku.net"])) {
    a.readOnly("tieE3", true);
}
if (a.domCmp(["booogle.net", "nsspot.net"])) {
    a.readOnly("gadb", false);
}
if (a.domCmp(["kbb.com"])) {
    a.inject(() => {
        "use strict";
        const v = window.Object.freeze({
            init() { },
            start() { },
        });
        window.KBB = {};
        window.Object.defineProperty(window.KBB, "Abb", {
            configurable: false,
            set() { },
            get() {
                return v;
            },
        });
    });
}
if (a.domCmp(["gp.se", "bohuslaningen.se", "hallandsposten.se", "hn.se", "stromstadstidning.se", "ttela.se"])) {
    a.inject(() => {
        "use strict";
        window.scrollTo = () => { };
        window.burtApi = {
            stopTracking() { },
            connect() { },
            annotate() { },
            startTracking() { },
            trackById() {
                return {
                    connect() { },
                };
            },
        };
        window._adform = {
            readTags() { },
        };
    });
}
if (a.domCmp(["playok.com", "kurnik.pl"])) {
    a.filter("getElementById", a.matchMethod.stringExact, "abp", "window.document");
}
if (a.domCmp(["explosm.net"])) {
    a.readOnly("showads", true);
}
if (a.domCmp(["videacesky.cz"])) {
    a.filter("setTimeout", a.matchMethod.string, "/dialog/adblock/");
}
if (a.domCmp(["playrust.io"])) {
    a.onInsert((node) => {
        if (node.textContent && node.textContent.includes("Advertising enables us")) {
            node.remove();
        }
    });
}
if (a.domCmp(["linkshrink.net"])) {
    //Skip glitchy timer caused by blocking popup
    //Based on AdsBypasser
    //License: https://github.com/adsbypasser/adsbypasser/blob/master/LICENSE
    const matcher = /revC\("([^"]+)"\)/;
    a.ready(() => {
        let match;
        const scripts = document.querySelectorAll("script");
        //Start from end as the script tend to be at the end
        for (let i = scripts.length - 1; i >= 0; i--) {
            if (match = matcher.exec(scripts[i].textContent)) {
                location.pathname = "/" + atob(match[1]);
                break;
            }
        }
    });
}
if (a.domCmp(["gamekit.com"])) {
    a.filter("setInterval", a.matchMethod.string, "a-d-block-popup");
}
if (a.domCmp(["dilidili.wang"])) {
    a.filter("addEventListener", a.matchMethod.stringExact, "DOMNodeInserted", "window.document");
    a.antiCollapse("innerHTML", (elem) => elem === window.document.body);
}
if (a.domCmp(["gamejolt.net"])) {
    a.onInsert((node) => {
        if (node && node.innerHTML && node.innerHTML.includes("View ad.")) {
            node.querySelector("h3").remove();
            node.querySelector("p").remove();
        }
    });
}
if (a.domCmp(["haber1903.com"])) {
    a.filter("setTimeout", a.matchMethod.string, "adblock");
    a.noAccess("EnableRightClick");
}

if (a.domCmp(["rule34hentai.net"])) {
    a.inject(() => {
        "use strict";
        window.base_href = "";
    });
}
if (a.domCmp(["paksociety.com"])) {
    a.css("html, body { overflow:scroll; }");
}
if (a.domCmp(["tlz.de"])) {
    a.filter("addEventListener", a.matchMethod.string, `document.getElementById("ad-container")`,
        "window.document");
}
if (a.domCmp(["cellmapper.net"])) {
    a.filter("alert", a.matchMethod.string, "Please disable ad-block");
}
if (a.domCmp(["1tv.ru"])) {
    a.inject(() => {
        "use strict";
        //Stage 1
        const fakeAntiblock = {
            opts: {
                url: "",
                detectOnStart: false,
                indicatorName: "",
                resources: [],
            },
            readyState: "ready",
            detected: false,
            ready(f) {
                window.setTimeout(f, 10, false);
                return this;
            },
            detect(f) {
                window.setTimeout(f.cb, 10, false, this);
                return this;
            }
        };
        window.EUMP = {};
        window.Object.defineProperty(window.EUMP, "antiblock", {
            configurable: false,
            set() { },
            get() {
                return fakeAntiblock;
            }
        });
        //Stage 2
        const original = window.XMLHttpRequest;
        window.XMLHttpRequest = function (...args) {
            const wrapped = new (window.Function.prototype.bind.apply(original, args));
            const _open = wrapped.open;
            wrapped.open = function (...args) {
                if (args.length > 1 && args[1].startsWith("//v.adfox.ru/")) {
                    this.withCredentials = false;
                }
                return _open.apply(wrapped, args);
            };
            return wrapped;
        };
    });
}
if (a.domCmp(["viz.com"])) {
    a.readOnly("show_dfp_preroll", false);
}
if (a.domCmp(["vod.pl"])) {
    a.onInsert((node) => {
        if (node.tagName !== "SCRIPT" && node.innerText && node.innerText.includes("Prosimy, odblokuj wy\u015Bwietlanie reklam")) {
            node.remove();
        }
    });
}
if (a.domCmp(["onet.pl", "komputerswiat.pl"])) {
    a.beforeScript((script) => {
        if (script.id === "adsinit") {
            script.remove();
        }
    });
}
if (a.domCmp(["oddreaders.com"])) {
    a.css(".onp-sl-blur-area { filter:none; }");
    a.onInsert((node) => {
        if (node.querySelector && node.querySelector("img[src='https://web.archive.org/web/20180327090220/http://oddreaders.com/wp-content/uploads/2017/07/" +
            "A-Publisher-Approach-to-Adblock-Users.png'")) {
            node.remove();
        }
    });
}
if (a.domCmp(["giallozafferano.it"])) {
    a.filter("setTimeout", a.matchMethod.string, "adblock alert");
}
if (a.domCmp(["gry.wp.pl", "maketecheasier.com"])) {
    a.filter("atob");
}
if (a.domCmp(["di.fm", "jazzradio.com"])) {
    a.loopback((ignored, url) => {
        if (url.startsWith("https://pubads.g.doubleclick.net/")) {
            return `<?xml version="1.0" encoding="UTF-8"?>
<VAST xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="vast.xsd" version="3.0">
</VAST>`;
        }
    });
}
if (a.domCmp(["itv.com"])) {
    a.loopback((ignored, url) => {
        if (url.startsWith("https://tom.itv.com/itv/tserver/size=")) {
            return `<?xml version="1.0" encoding="utf-8"?>
<VAST version="2.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="vast.xsd">
</VAST>`;
        }
    });
}
if (a.domCmp(["digitalpoint.com"])) {
    a.ready(() => {
        a.inject(() => {
            "use strict";
            window.DigitalPoint._General.blockMessage = () => { };
        });
    });
}
if (a.domCmp(["ohmymag.com", "ohmymag.com.br", "ohmymag.de", "gentside.com", "gentside.com.br",
    "maxisciences.com"])) {
    a.readOnly("adblockPopup", `{
        IS_BLOCKED: false,
        init() { },
        removeAdblockPopup() { },
    }`);
}
if (a.domCmp(["yiv.com"])) {
    a.cookie("AdBlockMessage", "yes");
}
