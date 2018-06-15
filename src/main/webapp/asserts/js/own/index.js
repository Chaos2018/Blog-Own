/**
 * QQ分享脚本
 */
;(function () {
    if (!window.alloy) {
        window.alloy = {};
    }
    window.alloy.ajaxProxyCallback = function (callback, id) {
        var proxyRequest = proxyFactory.getProxyById(id);
        proxyRequest && proxyRequest.onAjaxFrameLoad();
    }
    var proxyFactory;
    var selfSendRequest, //selfSend未完成改造
        isFirstRequest = true; // for firefox
    var HttpRequest = function (ajaxRequestInstant) {
        this._ajaxRequestInstant = ajaxRequestInstant;
    }

    var $D = {
        id: function (id) {
            return document.getElementById(id);
        },
        node: function (name, atts) {
            var d = document.createElement(name);
            if (atts) {
                for (var i in atts) {
                    d.setAttribute(i, atts[i]);
                }
            }
            return d;
        }
    };
    var J = {
        browser: {
            'set': function (n, v) {
                this[n] = v;
            }
        },
        out: function () {
        },
        warn: function () {
        },
        info: function () {
        },
        error: function () {
            if (!!window.console) {
                console.info(arguments);
            }
        },
        string: {
            toQueryString: function (obj) {
                var result = [];
                for (var key in obj) {
                    result.push(encodeURIComponent('' + key) + '=' + encodeURIComponent('' + obj[key]));
                }
                return result.join("&");
            }
        }
    }; //encodeURIComponent(String(key)) + "=" + encodeURIComponent(String(value));
    var toFixedVersion = function (ver, floatLength) {
        ver = ("" + ver).replace(/_/g, ".");
        floatLength = floatLength || 1;
        ver = String(ver).split(".");
        ver = ver[0] + "." + (ver[1] || "0");
        ver = Number(ver).toFixed(floatLength);
        return ver;
    };
    (function () {
        var s,
            ua = ua = navigator.userAgent.toLowerCase();
        (s = ua.match(/msie ([\d.]+)/)) ? J.browser.set("ie", toFixedVersion(s[1])) :
            (s = ua.match(/firefox\/([\d.]+)/)) ? J.browser.set("firefox", toFixedVersion(s[1])) :
                (s = ua.match(/chrome\/([\d.]+)/)) ? J.browser.set("chrome", toFixedVersion(s[1])) :
                    (s = ua.match(/opera.([\d.]+)/)) ? J.browser.set("opera", toFixedVersion(s[1])) :
                        (s = ua.match(/version\/([\d.]+).*safari/)) ? J.browser.set("safari", toFixedVersion(s[1])) : 0;
    })();
    HttpRequest.prototype = {
        send: function (url, option) {
            option = option || {};
            // 默认不缓存
            option.cacheTime = option.cacheTime || 0;
            option.onSuccess = option.onSuccess || function () {
            };
            option.onError = option.onError || function () {
            };
            option.onTimeout = option.onTimeout || function () {
            };
            option.onComplete = option.onComplete || function () {
            };

            var opt = {
                method: option.method || "GET",
                contentType: option.contentType || "",
                enctype: option.enctype || "", //"multipart/form-data",
                data: option.data || {},
                param: option.param || {},
                arguments: option.arguments || {},
                context: option.context || null,
                timeout: option.timeout || 30000,

                onSuccess: function (o) {
                    var responseText = o.responseText || '-';
                    var data = {};
                    try {
                        data = JSON.parse(responseText);
                    } catch (e) {
                        J.error("alloy.rpcservice: JSON 格式出错", 'HttpRequest');
                    }
                    data.arguments = option.arguments || {};
                    option.onSuccess.call(option.context, data);
                },
                onError: function (o) {
                    option.onError.call(option.context, o);
                },
                //尚未测试
                onTimeout: function (o) {
                    var data = {};
                    data.arguments = option.arguments || {};
                    option.onTimeout.call(option.context, data);
                },
                onComplete: function (o) {
                    var data = {};
                    data.arguments = option.arguments || {};
                    option.onComplete.call(option.context, data);
                }
            };

            opt.data = J.string.toQueryString(opt.data);
            if (opt.method == "GET") {
                var queryString = opt.data;
                //var queryString = J.json.stringify(opt.data);
                //url = url + "?" + queryString + "&t=" + (new Date()).getTime();
                if (option.cacheTime === 0) {
                    if (queryString) {
                        queryString += "&t=" + (new Date()).getTime();
                    } else {
                        queryString += "t=" + (new Date()).getTime();
                    }
                }
                if (queryString) {
                    //	                var vfwebqq = alloy.portal.getVfWebQQ();
                    //	                if(vfwebqq){
                    //	                    queryString += "&vfwebqq=" + vfwebqq;
                    //	                }
                    url = url + "?" + queryString;
                }

                opt.data = null;
                this._ajaxRequestInstant(url, opt);
            } else {
                //	            opt.data = option.data || '';
                //opt.data = J.json.stringify(opt.data);
                opt.contentType = "application/x-www-form-urlencoded";
                // 由于后台某个cgi在有时间戳时会出错，暂时去掉POST方式下的时间戳
                if (url.indexOf('?') === -1) {
                    //proxy(url+"?t=" + (new Date()).getTime(), opt);
                    //	                J.http.ajax(url, opt);
                    this._ajaxRequestInstant(url, opt);
                } else {
                    //proxy(url+"&t=" + (new Date()).getTime(), opt);
                    //	                J.http.ajax(url, opt);
                    this._ajaxRequestInstant(url, opt);
                }
            }
        }
    };

    /**
     * @private
     * @class ajax跨域请求代理的封装类
     * @name ProxyRequest
     * @memberOf alloy.rpcService
     * @author azrael
     * @version 1.0
     * @constructor
     * @param {String} id 请求代理的id,根据这个id识别各个代理
     * @param {String} proxyUrl 代理文件的URL
     * @description 每个不同的代理, 需要new一个不同的 ProxyRequest 实例
     * @example
     *  var proxyRequest = new ProxyRequest(proxyId, proxyUrl);
     *  proxyRequest.send(...);
     */
    var ProxyRequest = function (id, proxyUrl) {
        var iframeName = "qqweb_proxySendIframe_" + id;
        //	            ajaxFrameUrlSetted = false,
        var context = this,
            proxyIframe, retryCount = 3;
        this._ajaxCallbacks = [];
        this._proxySend = null;
        this._proxyAjaxSend = null;
        var bodyEl = document.body,
            divEl = $D.node("div", {
                "class": "hiddenIframe"
            });
        proxyUrl += (/\?/.test(proxyUrl) ? "&" : "?") + 'id=' + id;
        var html = '<iframe id="' + iframeName + '" class="hiddenIframe" name="' + iframeName + '" src="' + proxyUrl + '" width="1" height="1"></iframe>';
        divEl.innerHTML = html;
        bodyEl.appendChild(divEl);
        proxyIframe = $D.id(iframeName);
        this.id = id;
        var onAjaxFrameLoad = function () {
            var ajaxProxy = window.frames[iframeName];
            J.out('ProxyRequest >>>>> iframe load.', 'ProxyRequest');
            try {
                if (ajaxProxy.ajax) {
                    context._proxyAjaxSend = ajaxProxy.ajax;
                    var ajaxCallbacks = context._ajaxCallbacks;
                    for (var i = 0, len = ajaxCallbacks.length; i < len; i++) {
                        var url = ajaxCallbacks[i].url;
                        var option = ajaxCallbacks[i].option;
                        context.proxySend(url, option);
                    }
                    context._ajaxCallbacks = [];
                } else {
                    J.warn("ProxyRequest >>>>> ajaxProxy error: ajax is undefined!!!!", 'ProxyRequest');
                    resetIframeSrc();
                    //alloy.util.report2h("proxyrequest_error","start");
                    //                        setTimeout(onAjaxFrameLoad, 200);
                }
            } catch (e) {
                J.error("ProxyRequest >>>>> ajaxProxy error: " + e.message + " !!!!", 'ProxyRequest');
                resetIframeSrc();
                //alloy.util.report2h("proxyrequest_error2","start");
            }
        };
        this.onAjaxFrameLoad = onAjaxFrameLoad;
        if (J.browser.firefox && isFirstRequest) { //firefox有iframe的内存泄漏bug, 这里采用放弃第一次请求的方法
            isFirstRequest = false;
            proxyIframe.setAttribute("src", proxyUrl);
        }
    }
    ProxyRequest.prototype = {
        /**
         * 使用代理发送跨域ajax请求
         * @public
         * @param {String} url
         * @param {Object} option 请求参数
         *
         */
        send: function (url, option) {
            if (this._proxyAjaxSend) {
                this.proxySend(url, option);
            } else {
                this._ajaxCallbacks.push({
                    'url': url,
                    'option': option
                });
            }
        },

        /**
         * 使用代理进行发送的方法, 调用这个方法时必须保证已经存在一个代理<br/>
         * 建议不要直接调用这个方法, 使用 send 方法代替
         * @see send
         * @private
         * @param {String} url
         * @param {Object} option 请求参数
         */
        proxySend: function (url, option) {
            if (!this._proxySend) {
                this._proxySend = new HttpRequest(this._proxyAjaxSend);
            }
            this._proxySend.send(url, option);
        }
    };
    /**
     * @private
     * @class ajax跨域代理工厂类
     * @name ProxyFactory
     * @memberOf alloy.rpcService
     * @author azrael
     * @version 1.0
     * @constructor
     * @description
     * @example
     *  var proxyFactory = new ProxyFactory();
     *  var proxyRequest = proxyFactory.getProxy(proxyUrl);
     *  proxyRequest.send(url, option);
     */
    var ProxyFactory = function () {
        this._proxyArr = {};
        this._proxyId = 1;
    }
    ProxyFactory.prototype = {
        /**
         * 获取一个proxy自增的id
         * @private
         * @return {Int}
         */
        getProxyId: function () {
            return this._proxyId++;
        },
        /**
         * 获取一个请求代理,如果不存在就创建
         * @param {String} proxyUrl 代理文件的Url
         * @return {ProxyRequest}
         */
        getProxy: function (proxyUrl) {
            var proxyRequest = this._proxyArr[proxyUrl];
            if (!proxyRequest) {
                proxyRequest = new ProxyRequest(this.getProxyId(), proxyUrl);
                this._proxyArr[proxyUrl] = proxyRequest;
            }
            return proxyRequest;
        },
        getProxyById: function (id) {
            for (var p in this._proxyArr) {
                if (this._proxyArr[p].id == id) {
                    return this._proxyArr[p];
                }
            }
            return null;
        }
    };
    proxyFactory = new ProxyFactory();
    /**
     * 使用代理进行ajax请求
     * @memberOf alloy.rpcService
     * @param {String} url
     * @param {Object} option 请求参数
     * @param {String} proxyUrl 代理文件URL, 可选,
     * 0 -> cgi.web2.qq.com, 1 -> up.web2.qq.com, 2 -> s.web2.qq.com
     *  默认为 alloy.CONST.API_PROXY_URL
     */
    var proxySend = function (url, option, proxyUrl) {
        proxyUrl = proxyUrl || (url.match(/^https?:\/\/[\.\d\w\-_:]+\//)[0] + 'proxy.html');
        proxyUrl += (/\?/.test(proxyUrl) ? "&" : "?") + 'callback=1';
        var proxyRequest = proxyFactory.getProxy(proxyUrl);
        proxyRequest.send(url, option);
    };

    //对外只暴露此接口
    window.qservice = {
        proxySend: proxySend
    }
})();
/**
 * author rehorn
 * share components for q+ vm
 * 2012-04-16
 */

mytracker.reportIsdEnd('load_share_all', true);


var JSON = new Jx().json;
/**
 * [分享组件share命名空间]
 */

Jx().$package("share", function (J) {
    var $D = J.dom,
        $E = J.event,
        packageContext = this;

    this.MAIN_DOMAIN = 'qq.com';

    // 升域处理，跨域ajax调用
    document.domain = this.MAIN_DOMAIN;

    // 时间戳
    this.TIME_STAMP = 20120217001;
    // 日期
    this.DATE_STAMP = J.format.date(new Date(), 'YYYYMMDD');
    // 配置
    this.CONST = {
        CGI_HOST: '//cgi.connect.qq.com',
        DEFAULT_CGI_PROXY_URL: '//cgi.connect.qq.com/proxy.html?t=' + this.TIME_STAMP
    };

    // 全局错误处理
    window.onerror = function (msg, url, line) {
        try {
            var text = '' + (msg.message || msg.name || msg.type || msg);
            console.info('error:' + text + ',' + line + ',' + url);
        } catch (e) {
            return true;
        }
    };
}); //mta上报
;
Jx().$package("mtaReport", function (J) {
    var sTime = _startTime;
    var eTime = new Date().getTime();

    this.setStartTime = function () {
        sTime = new Date().getTime();
    };
    this.setEndTime = function () {
        eTime = new Date().getTime();
    };
    this.getInterval = function () {
        var interval = eTime - sTime;
        return interval;
    };

    var getCookie = function (name) {
        var r = new RegExp("(?:^|;+|\\s+)" + name + "=([^;]*)"),
            m = document.cookie.match(r);
        return (!m ? "" : m[1]);
    };

    var getUuid = (function () {
        // generate golobally unique identifier
        var uid = "";
        var guid = function () {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                var r = Math.random() * 16 | 0,
                    v = c == 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            }).toUpperCase();
        };


        var cookieUid = getCookie("ui");
        if (cookieUid) {
            uid = cookieUid;
        } else {
            uid = guid();

        }

        var cookie = "ui=" + uid + ";domain=" + location.host + ";path=/;max-age=" + (60 * 60 * 24 * 356);
        document.cookie = cookie;

        return function () {
            return uid;
        };
    })();

    window.reportImages = [new Image(), new Image(), new Image(), new Image(), new Image()];

    /**
     * 使用前修改KY
     * @param {String} eventId  事件id
     * @param {Object} data  参数  传入所在平台的入口平台 等  uin可不传 大小写参照邮件
     */

    var getPlatform = (function () {
        var platform = "PC";

        var ua = window.navigator.userAgent;

        if (/iPhone/.test(ua)) {
            platform = "iPhone";
        } else if (/Android/.test(ua)) {
            platform = "Android";
        } else if (/Windows Phone/.test(ua)) {
            platform = "WindowPhone";
        }

        return function () {
            return platform;
        };
    })();

    var report = function (eventId, data) {
        var getParamsFromUrl = function (name) {
            var hash = window.location.hash;
            var reg = new RegExp("(?:^|&)" + name + "=([^=&]+)(?:&|$)");
            var result;

            hash = hash.replace(/^#/, "");
            result = reg.exec(hash);

            if (result) {
                return result[1];
            }
        };

        var stringify = function (data) {
            if (window["JSON"]) {
                return JSON.stringify(data);
            } else {
                var s = [];
                for (var i in data) {
                    if (typeof data[i] == "object") {
                        s.push("\"" + i + "\":" + stringify(data[i]));
                    } else {
                        s.push("\"" + i + "\":" + (data[i]));
                    }
                }

                return "{" + s.join(",") + "}";
            }
        };

        var kyMap = {
            "Android": "AJQL249T5CUA",
            "PC": "AH46I8G5IHWE",
            "iPhone": "I2KN7UR1DG5U"
        };

        var platform = getPlatform();
        var KY = kyMap[platform] || kyMap['PC'];
        var SDK = getParamsFromUrl("SDK") || getParamsFromUrl("sdk") || "";
        var uin = getCookie("uin") || 0;
        if (uin && (/^o([0-9]+)$/).test(uin)) {
            var g_iUin = parseFloat(RegExp.$1);
        } else {
            var g_iUin = 0;
        }

        var reportData = {
            ky: KY,
            ui: getUuid(),
            et: 1000,
            ts: ~~(+new Date / 1000),
            ei: eventId,
            du: 1,
            kv: data
        };

        var kvData = {
            Platform: platform || "PC",
            appid: data.appid || "",
            UIN: data.UIN || g_iUin,
            Entrance: platform == "PC" ? "PC" : "H5",
            Time: "",
            SDK: SDK || "",
            Ext1: ""
        };

        if (data.Time) {
            kvData.Time = data.Time;
        } else {
            delete kvData.Time;
        }
        if (!!data.Ext1) {
            kvData.Ext1 = data.Ext1;
        } else {
            delete kvData.Ext1;
        }
        reportData.kv = kvData;

        var cgi = "https://cgi.connect.qq.com/report/mstat/report";
        var url = cgi + "?data=[" + stringify(reportData) + "]";

        var img = window.reportImages.shift();
        !img && (img = new Image());
        img.src = url;
        img.onload = img.error = function () {
            window.reportImages.push(this);
        };
    }
    this.report = report;

    //mta上报：分享页面曝光
    this.setEndTime();
    this.report("ShareQQPageOpen", {
        Time: mtaReport.getInterval()
    });
});
/**
 * @description SNG监控上报
 * @version 1.0
 * @author johnnyguo
 *
 * @模块接口:
 * {function} init 初始化
 * {function} report 上报函数
 *
 * @Usage
 * 示例: H5分享Qzone
 * 先在登录后进行初始化: MM.init(1000128, '175259305', 'QC_WEB');
 * 点击分享, ajax请求前: var t1 = +new Date;
 * cgi成功callback内:    var t2 = +new Date; MM.report('http://openmobile.qq.com/api/share_qzone', '0', t2-t1);
 *
 * @TODO
 * 支持批量上报
 */
window.MM = (function () {
    var image = new Image(),
        paramObj = {};

    /**
     * @param {string} cgi cgi路径, 不携带参数, 例如: https://openmobile.qq.com/oauth2.0/m_sdkauthorize
     * @param {string} retcode 返回码, 透传cgi的retcode
     * @param {string} tmcost cgi耗时, 在请求cgi前打"请求时间戳"t1, 执行callback时马上打"响应时间戳"t2
     *                          此处传入t2-t1的值, 单位为ms
     * @param {object} extra 扩展参数对象
     */
    var report = function (cgi, retcode, tmcost, extra) {
        var url,
            paramArr = [];

        // 处理上报项
        paramObj.commandid = cgi;
        paramObj.resultcode = retcode;
        paramObj.tmcost = tmcost;
        if (extra) {
            for (var i in extra) {
                if (extra.hasOwnProperty(i)) {
                    paramObj[i] = extra[i];
                }
            }
        }

        if (retcode == 0) {
            // 成功的上报采样为1/20
            // frequency为采样分母
            paramObj.frequency = 20;
            var ranNum = Math.floor(Math.random() * 100 + 1);
            if (ranNum > 5) {
                return;
            }
        } else {
            paramObj.frequency = 1;
        }

        for (var j in paramObj) {
            if (paramObj.hasOwnProperty(j)) {
                paramArr.push(j + "=" + encodeURIComponent(paramObj[j]));
            }
        }
        url = "https://wspeed.qq.com/w.cgi?" + paramArr.join("&");
        image.src = url;
    };

    /**
     * @param {string} appid 可到http://m.isd.com/app/mm 申请
     *                 互联Web: 1000128, 查找Web: 1000130
     * @param {string} uin 用户qq号
     * @param {string} version 版本号 'QC_WEB' -> 互联, 'FIND_WEB_4.2' -> 查找
     */
    var init = function (appid, uin, version) {
        paramObj = {
            appid: appid,
            touin: uin,
            releaseversion: version,
            frequency: 1
        };
    };

    return {
        init: init,
        report: report
    };
})();
/**
 * share app for qplus
 * author: rehorn
 */

;
Jx().$package('share.utils', function (J) {

    $C = share.CONST;
    $E = J.event;
    $S = J.string;

    var embed = (J.browser.version.toString().indexOf(".") > -1 && J.browser.version.split('.')[0] < 23) || J.browser.name == 'firefox' ? document.getElementById("embed2") : document.getElementById("embed1");
    var cpTimwp;
    var isEmbedAble = true;
    var isNpPlugin = true;


    // 根据模版id获取模版内容
    var templateList = {};
    this.getTemplate = function (tmplId) {
        var tmpl = templateList[tmplId];
        if (!tmpl) {
            var tmplNode = document.getElementById(tmplId);
            tmpl = tmplNode.innerHTML;
            tmplNode.parentNode.removeChild(tmplNode);
            templateList[tmplId] = tmpl;
        }
        if (!tmpl) {
            throw new Error('no such template. [id="' + tmplId + '"]');
        }
        return tmpl;
    };

    // 获取代理cmd的target对象
    this.getActionTarget = function (event, level, property, parent) {
        var t = event.target,
            l = level || 3,
            s = level !== -1,
            p = property || 'cmd',
            end = parent || document.body;
        while (t && (t !== end) && (s ? (l-- > 0) : true)) {
            if (t.getAttribute(p)) {
                return t;
            } else {
                t = t.parentNode;
            }
        }
        return null;
    };

    // 根据uin获取好友头像
    this.getAvatar = function (uin, type) {
        type = type || 1; // 群图标为 4
        var t = share.model.getTCode();
        var selfUin = this.getSelfUin();
        if (selfUin == uin) {
            return 'https://face' + (uin % 10) + '.web.qq.com/cgi/svr/face/getface?cache=1&type=' + type + '&f=40&uin=' + uin + '&t=' + Math.floor(new Date() / 1000) + '&vfwebqq=' + t;
        }
        return 'https://face' + (uin % 10) + '.web.qq.com/cgi/svr/face/getface?cache=1&type=' + type + '&f=40&uin=' + uin + '&vfwebqq=' + t;
    };

    // 从cookie中获取自已uin
    var _uin;
    this.getSelfUin = function () {
        if (typeof(_uin) == 'undefined') {
            _uin = J.cookie.get('uin').replace(/^[o0]+/i, '');
        }
        return _uin;
    };

    var timerList = {};
    /**
     * @param {String} id @optional
     * @param {Number} time @optional
     * @param {Function} func
     * @example
     * 1. delay('id01', 1000, func)
     * 2. delay(1000, func)
     * 3. delay(func) === delay(0, func)
     */
    this.delay = function (id, time, func) {
        var argu = arguments;
        if (argu.length === 1) {
            func = id;
            time = 0;
            id = null;
        } else if (argu.length === 2) {
            func = time;
            time = id;
            id = null;
        }
        time = time || 0;
        if (id && time) {
            if (id in timerList) {
                window.clearTimeout(timerList[id]);
            }
            var wrapFunc = function () {
                func.apply(window);
                timerList[id] = 0;
                delete timerList[id];
            };
            var timer = window.setTimeout(wrapFunc, time);
            timerList[id] = timer;
        } else {
            window.setTimeout(func, time);
        }
    }

    // 单位时间只允许执行一次
    this.debounce = function (time, func, immediate) {
        var lastExecTime;
        return function () {
            if (!lastExecTime || (+new Date - lastExecTime > time)) {
                immediate ? func() : setTimeout(func, time);
                lastExecTime = +new Date;
            }
        };
    };

    // 清楚delay
    this.clearDelay = function (id) {
        if (id in timerList) {
            window.clearTimeout(timerList[id]);
        }
        timerList[id] = 0;
        delete timerList[id];
    };

    // 可并发流程管理类
    // 比如需要同时发几个请求获取cgi,异步返回,完成后会触发BatchProcessCompleted事件
    this.BatchProcess = J.Class({
        init: function () {
            this.processIds = [];
            this.runners = [];
            this.completeList = [];
            this.count = 0;
            this.errors = 0;
        },
        complete: function (item) {
            if (J.array.indexOf(this.processIds, item.id) >= 0) {
                this.completeList.push(item);
                this.count++;
                if (item.t == 1) {
                    this.errors++;
                }
                this.check();
            }
        },
        success: function (processId, data) {
            var p = {
                id: processId,
                t: 0,
                data: data
            };
            this.complete(p);
        },
        error: function (processId, data) {
            var p = {
                id: processId,
                t: 1,
                data: data
            };
            this.complete(p);
        },
        check: function () {
            if (this.processIds.length == this.count) {
                var obj = {
                    list: this.completeList,
                    errors: this.errors
                };
                $E.notifyObservers(this, 'BatchProcessCompleted', obj);
            }
        },
        add: function (id, runner) {
            this.processIds.push(id);
            this.runners.push(runner);
        },
        run: function () {
            if (this.processIds.length > 0) {
                J.array.forEach(this.runners, function (runner) {
                    runner();
                });
            } else {
                var obj = {
                    list: [],
                    errors: []
                };
                $E.notifyObservers(this, 'BatchProcessCompleted', obj);
            }
        },
        getCallback: function (id) {
            var callback;
            J.array.forEach(this.completeList, function (item) {
                if (item.id == id) {
                    callback = item;
                    return false;
                }
            });
            return callback;
        }
    });

    /**
     * 获取随机数组
     * @param  {Number} max    随机数最大值
     * @param  {Number} min    随机数最小值
     * @param  {Number} n      随机数个数
     * @param  {Boolean} unique 是否唯一
     * @return {Mixed}        随机数或随机数组
     */
    this.makeRandomNumberArray = function (max, min, n, unique) {
        max = J.isUndefined(max) ? 1 : max;
        min = J.isUndefined(min) ? 0 : min;
        n = J.isUndefined(n) ? 1 : n;
        unique = J.isUndefined(unique) ? true : unique;

        var nums = [];
        var rand;
        do {
            rand = min + Math.random() * max;
            if (unique) {
                if (!J.array.contains(nums, rand)) {
                    nums.push(rand);
                }
            } else {
                nums.push(rand);
            }
        } while (nums.length < n)
        return (nums.length == 1) ? nums[0] : nums;
    };

    this.makeRandomNumber = function (max, min) {
        min = J.isUndefined(min) ? 0 : min;
        return parseInt(min + Math.random() * max);
    };

    // 生成一个新的乱序数组
    this.randomize = function (arr, isNewArr) {
        isNewArr = J.isUndefined(isNewArr) ? false : true;
        var tmp = isNewArr ? arr.slice(0) : arr;
        return arr.sort(function () {
            return Math.random() > 0.5 ? -1 : 1;
        });
    };

    //防恶意，生成hash cookie
    this.getCSRFToken = function () {
        var str = J.cookie.get('skey');
        var hash = 5381;
        for (var i = 0, len = str.length; i < len; ++i) {
            hash += (hash << 5) + str.charAt(i).charCodeAt();
        }
        return hash & 0x7fffffff;
    };

    // 从url参数中获取配置信息
    this.getParameter = function (name, l) {
        l = l || location.href;
        var r = new RegExp("(\\?|#|&)" + name + "=([^&#]*)(&|#|$)");
        var m = l.match(r);
        return (!m ? "" : m[2]);
    }

    // 判断是否登录
    this.isPtLoggedIn = function () {
        return !!(J.cookie.get('uin') && J.cookie.get('skey'));
    }

    this.addEvent = function (proxyNode, selector, eventType, func) { //为代理节点添加事件监听
        var proName = "",
            flag = 0;
        if (typeof(selector) == "string") {

            flag = 1;
            switch (true) {
                case /^\./.test(selector):
                    proName = "className";
                    selector = selector.replace(".", "");
                    selector = new RegExp(" *" + selector + " *");
                    break;
                case /^\#/.test(selector):
                    proName = "id";
                    selector = new RegExp(selector.replace("#", ""));
                    break;
                default:
                    selector = new RegExp(selector);
                    proName = "tagName";
            }

        }

        var addEvent = window.addEventListener ? "addEventListener" : "attachEvent";
        var eventType = window.addEventListener ? eventType : "on" + eventType;

        proxyNode[addEvent](eventType, function (e) {

            function check(node) {

                if (flag) {
                    if (selector.test(node[proName].toLowerCase())) {
                        func.call(node, e);
                        return;
                    }
                    ;
                } else {
                    if (selector == node) {
                        func.call(node, e);
                        return;
                    }
                    ;
                }

                if (node == proxyNode || node.parentNode == proxyNode) return;
                check(node.parentNode);
            }

            check(e.srcElement);
        });
    };

    this.lenReg = function (str) {
        return str.replace(/[^x00-xFF]/g, '**').length;
    };

    this.sub_str = function (str, num) { //按字节截取
        if (num) {
            var len = 0,
                subStr = "";
            str = str.split("");
            for (var i = 0; i < str.length; i++) {
                subStr += str[i];
                if (/[^x00-xFF]/.test(str[i])) {
                    len += 2;
                    if (len == num + 1) return subStr;
                } else {
                    len++;
                }
                if (len == num) {
                    return subStr;
                }
            }
        }
    };
    //对分享语过长做截断
    this.sub_str_msg = function (str, num) {
        if (num) {
            var len = 0,
                subStr = "";
            str = str.split("");
            for (var i = 0; i < str.length; i++) {
                //subStr += str[i];
                if (/[^x00-xFF]/.test(str[i])) {
                    len += 2;
                    if (len < (num + 1)) {
                        subStr += str[i];
                    } else {
                        return subStr;
                    }
                } else {
                    len++;
                    if (len < num) {
                        subStr += str[i];
                    } else {
                        return subStr;
                    }
                }
            }
        }
    };

    this.sub_str_create = function (str, num) { //按字节截取
        if (num) {
            var len = 0,
                subStr = "";
            str = str.split("");
            for (var i = 0; i < str.length; i++) {
                subStr += str[i];
                if (/[^x00-xFF]/.test(str[i])) {
                    len += 2;
                    if (len == num + 1 || len == str.length) return subStr;
                } else {
                    len++;
                    if (len == str.length) return subStr;
                }
                if (len == num) {
                    return subStr;
                }
            }
        }
    };

    this.testIpad = function () {
        return (navigator.userAgent.toLowerCase().indexOf("ipad") > -1);
    }();

    //调客户端接口初始化插件
    this.initCphelper = function () {
        if (J.browser.name == 'ie') {
            try {
                cpTimwp = new ActiveXObject('TimwpDll.TimwpCheck');
            } catch (e) {
                isEmbedAble = false;
            }
        } else {
            if (!embed) {
                isEmbedAble = false;
            } else {
                try {
                    embed.InitActiveX("TimwpDll.TimwpCheck");
                } catch (e) {
                    //这里在ie11下有问题 所以改了
                    try {
                        if (J.browser.version.split('.')[0] >= 23) { //新版客户端&cpchrome插件失败
                            embed = document.getElementById("embed2");
                            isNpPlugin = false;
                        } else { //qscall-plugin 插件初始化失败
                            isEmbedAble = false;
                        }
                    } catch (e) {
                    }
                }

                if (!isNpPlugin) { //新版客户端&cpchrome插件失败，使用qscall-plugin初始化
                    try {
                        var bRet = embed.InitActiveX("TimwpDll.TimwpCheck");
                    } catch (e) {
                        isEmbedAble = false; //qscall-plugin 插件初始化失败
                    }
                }
            }
        }
    };

    //获取QQ客户端版本号
    this.GetHummerQQVersion = function () {
        if (J.browser.name == 'ie') {
            try {
                var nQQVer = cpTimwp.GetHummerQQVersion();
                return nQQVer;
            } catch (e) {
                isEmbedAble = false;
                console.log(e);
            }
        } else {
            if (!embed) {
                isEmbedAble = false;
            } else {
                try {
                    var nQQVer = embed.GetHummerQQVersion();
                    return nQQVer;
                } catch (e) {
                    isEmbedAble = false;
                    console.log(e);
                }
            }
        }
    };

    //检测客户端是否运行
    this.isQQRunning = function (uin) {
        if (J.browser.name == 'ie') {
            try {
                var isRunning = cpTimwp.IsQQRunning(uin);
                console.log(isRunning);
                return isRunning;
            } catch (e) {
                console.log(e);
            }
        } else {
            if (!embed) {
                console.log("NULL");
            } else {
                var isRunning = embed.IsQQRunning(uin);
                console.log(isRunning);
                return isRunning;
            }
        }
    };

    //群组AIO只在新版支持，检测客户端是否支持群组AIO能力
    this.isGroupAioAble = function () {
        var flag = false;
        try {
            var version = this.GetHummerQQVersion();
            if (version >= 5065) {
                flag = true;
            }
        } catch (e) {
            isEmbedAble = false;
            console.log(e);
        }
        return flag;
    };

    //好友AIO
    this.startAio = function (option) {
        if (J.browser.name == 'ie' || !isEmbedAble) {
            var s = 'tencent://message/?Menu=yes&uin=' + option.uin + '&fuin=' + option.fuin + '&Service=113';
            window.location = 'tencent://message/?Menu=yes&uin=' + option.uin + '&fuin=' + option.fuin + '&Service=113';
        } else {
            try {
                embed.DealTencentString('tencent://message/?Menu=yes&uin=' + option.uin + '&fuin=' + option.fuin + '&Service=113');
            } catch (e) {
                console.log(e);
                var s = 'tencent://message/?Menu=yes&uin=' + option.uin + '&fuin=' + option.fuin + '&Service=113';
                window.location = 'tencent://message/?Menu=yes&uin=' + option.uin + '&fuin=' + option.fuin + '&Service=113';
            }
        }
    };

    //群组AIO
    this.startGroupAio = function (option) {
        if (J.browser.name == 'ie') {
            window.location = 'tencent://openchat/?subcmd=' + option.cmd + '&id=' + option.id + '&fuin=' + option.fuin;
        } else {
            try {
                embed.DealTencentString('tencent://openchat/?subcmd=' + option.cmd + '&id=' + option.id + '&fuin=' + option.fuin);
            } catch (e) {
                window.location = 'tencent://openchat/?subcmd=' + option.cmd + '&id=' + option.id + '&fuin=' + option.fuin;
            }
        }
    };

    //保存消息
    this.saveMsg = function (option) {
        if (J.browser.name == 'ie') {
            var shareto = JSON.stringify(option.shareto).replace(/\"/g, '\\"');
            var s = 'tencent://QQInternet/?subcmd=savemsg&dwFromUin=' + option.dwFromUin + '&shareto=' + encodeURI(shareto) + '&msgcontent=' + encodeURI(option.msgcontent) + '&fuin=' + option.fuin;
            window.location = s;
        } else {
            var shareto = JSON.stringify(option.shareto);
            var s = 'tencent://QQInternet/?subcmd=savemsg&dwFromUin=' + option.dwFromUin + '&shareto=' + encodeURI(shareto) + '&msgcontent=' + encodeURI(option.msgcontent) + '&fuin=' + option.fuin;
            embed.DealTencentString(s);
        }
    };

    this.bubbleSort = function (arr) {
        compareFunc = function (num1, num2) {
            return num1 - num2;
        };
        //数组长度
        var n = arr.length;
        //交换顺序的临时变量
        var temp; //
        //交换标志
        var exchange;
        //最多做n-1趟排序
        for (var time = 0; time < n - 1; time++) {
            exchange = false;
            for (var i = n - 1; i > time; i--) {
                if (compareFunc(arr[i].type, arr[i - 1].type) < 0) {
                    //if (arr[i] < arr[i - 1]) {
                    exchange = true;
                    temp = arr[i - 1];
                    arr[i - 1] = arr[i];
                    arr[i] = temp;
                }
            }
            //若本趟排序未发生交换，提前终止算法
            if (!exchange) {
                break;
            }
        }
        return arr;
    };

    //读取元素的css属性值
    this.css = function (el, property) {
        try {
            return el.currentStyle[property];
        } catch (e) {
            var computedStyle = getComputedStyle(el);
            return computedStyle.getPropertyValue(property);
        }
    };

    var lastAnimation = {};
    //使原来的动画提前结束
    this.lastAnimationEnd = function (id, arg) {
        if (lastAnimation[id]) {
            clearInterval(lastAnimation[id].timer);
            lastAnimation[id].callBack && lastAnimation[id].callBack(arg);
        }
    };
    //执行动画   类似jquery animate
    this.animate = function (el, endCss, time, callBack, timerId) {
        var FPS = 40;
        var everyStep = {},
            currStyle = {};

        for (var i in endCss) {
            var currValue = parseInt(this.css(el, i));
            currStyle[i] = currValue;

            everyStep[i] = parseInt(parseInt(endCss[i]) - currValue) / time;
        }

        //当前frame
        var frame = 0,
            timer;

        function step() {
            frame++;

            //当前时间 ms
            var t = frame / FPS * 1000;

            //对时间做缓动变换

            //标准化当前时间
            var t0 = t / time;

            //变换函数
            var f = function (x, p0, p1, p2, p3) {

                //二次贝塞尔曲线
                //return Math.pow((1 - x), 2) * p0 + (2 * x) * (1 - x) * p1 + x * x * p2;

                //基于三次贝塞尔曲线
                return p0 * Math.pow((1 - x), 3) + 3 * p1 * x * Math.pow((1 - x), 2) + 3 * p2 * x * x * (1 - x) + p3 * Math.pow(x, 3);
            }

            //对时间进行三次贝塞尔变换 输出时间
            var t1 = f(t0, 0, 0.42, 0.8, 1.0) * time;

            for (var i in everyStep) {
                if (i == "opacity") {
                    if (window.addEventListener) {
                        el.style[i] = (currStyle[i] + everyStep[i] * t1);

                        //ie < 9
                    } else {
                        el.style.filter = "alpha(opacity=" + (currStyle[i] + everyStep[i] * t1) * 100 + ")";

                        function setChild(el) {
                            var children = el.childNodes;
                            for (var j = 0, n = children.length; j < n; j++) {
                                children[j] && children[j].nodeType == 1 && (children[j].tagName.toLowerCase() == "img" && (children[j].style.filter = "alpha(opacity=" + (currStyle[i] + everyStep[i] * t1) * 100 + ")")) || setChild(children[j]);
                            }
                        }

                        setChild(el);
                    }
                } else el.style[i] = parseInt(currStyle[i] + everyStep[i] * t1) + "px";
            }

            if (frame == time / 1000 * FPS) {
                clearInterval(timer);
                callBack && callBack();
                timerId && (delete lastAnimation[timerId]);
            }
        }

        timer = setInterval(step, 1000 / FPS);

        timerId && (lastAnimation[timerId] = {
            timer: timer,
            callBack: callBack
        });

    };

    this.getElementPos = function (elementId) {
        var ua = navigator.userAgent.toLowerCase();
        var isOpera = (ua.indexOf('opera') != -1);
        var isIE = (ua.indexOf('msie') != -1 && !isOpera); // not opera spoof
        var el = elementId;
        if (el.parentNode === null || el.style.display == 'none') {
            return false;
        }

        var parent = null;
        var pos = [];
        var box;
        if (el.getBoundingClientRect) { //ie
            box = el.getBoundingClientRect();
            var scrollTop = Math.max(document.documentElement.scrollTop, document.body.scrollTop);
            var scrollLeft = Math.max(document.documentElement.scrollLeft, document.body.scrollLeft);
            return {
                x: box.left + scrollLeft,
                y: box.top + scrollTop
            };
        } else if (document.getBoxObjectFor) { // gecko
            box = document.getBoxObjectFor(el);
            var borderLeft = (el.style.borderLeftWidth) ? parseInt(el.style.borderLeftWidth) : 0;
            var borderTop = (el.style.borderTopWidth) ? parseInt(el.style.borderTopWidth) : 0;
            pos = [box.x - borderLeft, box.y - borderTop];
        } else { // safari & opera

            pos = [el.offsetLeft, el.offsetTop];
            parent = el.offsetParent;
            if (parent != el) {
                while (parent) {
                    pos[0] += parent.offsetLeft;
                    pos[1] += parent.offsetTop;
                    parent = parent.offsetParent;
                }
            }
            if (ua.indexOf('opera') != -1 || (ua.indexOf('safari') != -1 && el.style.position == 'absolute')) {
                pos[0] -= document.body.offsetLeft;
                pos[1] -= document.body.offsetTop;
            }
        }
        if (el.parentNode) {
            parent = el.parentNode;
        } else {
            parent = null;
        }

        while (parent && parent.tagName != 'BODY' && parent.tagName != 'HTML') { // account for any scrolled ancestors
            pos[0] -= parent.scrollLeft;
            pos[1] -= parent.scrollTop;
            if (parent.parentNode) {
                parent = parent.parentNode;
            } else {
                parent = null;
            }
        }
        return {
            x: pos[0],
            y: pos[1]
        };
    };

    // 为url添加一个参数
    // this.qcAddParam = function(url, key, value) {
    //     if(url.indexOf(key + '=') >= 0){
    //         return url;
    //     }
    //     var part = key + '=' + value;
    //     url = (url.indexOf('?') != -1 ?
    //         url.split('?')[0] + '?' + part + '&' + url.split('?')[1] :
    //         (url.indexOf('#') != -1 ? url.split('#')[0] + '?' + part + '#' + url.split('#')[1] : url + '?' + part));
    //     return url;
    // };

});
/**
 * author rehorn
 * share components for q+ vm
 * 2012-05-07
 */

Jx().$package("share.utils", function (J) {
    /**
     * SNS Frontend Library 汉字-->拼音转换的客户端支持
     * 可能会影响效率，对有大数据量的处理，请慎重考虑！
     *
     * @author Leohe [QzoneSNSGroup]
     * Thanks noname friend support this map
     */

    this.pinyin = {
        /**
         * 拼音字符表
         * @type Array
         */
        _pyvalue: ["a", "ai", "an", "ang", "ao", "ba", "bai", "ban", "bang", "bao", "bei", "ben", "beng", "bi", "bian", "biao", "bie", "bin", "bing", "bo", "bu", "ca", "cai", "can", "cang", "cao", "ce", "cen", "ceng", "cha", "chai", "chan", "chang", "chao", "che", "chen", "cheng", "chi", "chong", "chou", "chu", "chuai", "chuan", "chuang", "chui", "chun", "chuo", "ci", "cong", "cou", "cu", "cuan", "cui", "cun", "cuo", "da", "dai", "dan", "dang", "dao", "de", "dei", "deng", "di", "dia", "dian", "diao", "die", "ding", "diu", "dong", "dou", "du", "duan", "dui", "dun", "duo", "e", "ei", "en", "er", "fa", "fan", "fang", "fei", "fen", "feng", "fo", "fou", "fu", "ga", "gai", "gan", "gang", "gao", "ge", "gei", "gen", "geng", "gong", "gou", "gu", "gua", "guai", "guan", "guang", "gui", "gun", "guo", "ha", "hai", "han", "hang", "hao", "he", "hei", "hen", "heng", "hng", "hong", "hou", "hu", "hua", "huai", "huan", "huang", "hui", "hun", "huo", "ji", "jia", "jian", "jiang", "jiao", "jie", "jin", "jing", "jiong", "jiu", "ju", "juan", "jue", "jun", "ka", "kai", "kan", "kang", "kao", "ke", "ken", "keng", "kong", "kou", "ku", "kua", "kuai", "kuan", "kuang", "kui", "kun", "kuo", "la", "lai", "lan", "lang", "lao", "le", "lei", "leng", "li", "lia", "lian", "liang", "liao", "lie", "lin", "ling", "liu", "lo", "long", "lou", "lu", "luan", "lun", "luo", "lue", "lv", "m", "ma", "mai", "man", "mang", "mao", "me", "mei", "men", "meng", "mi", "mian", "miao", "mie", "min", "ming", "miu", "mo", "mou", "mu", "n", "na", "nai", "nan", "nang", "nao", "ne", "nei", "nen", "neng", "ng", "ni", "nian", "niang", "niao", "nie", "nin", "ning", "niu", "nong", "nou", "nu", "nuan", "nuo", "nue", "nv", "o", "ou", "pa", "pai", "pan", "pang", "pao", "pei", "pen", "peng", "pi", "pian", "piao", "pie", "pin", "ping", "po", "pou", "pu", "qi", "qia", "qian", "qiang", "qiao", "qie", "qin", "qing", "qiong", "qiu", "qu", "quan", "que", "qun", "ran", "rang", "rao", "re", "ren", "reng", "ri", "rong", "rou", "ru", "ruan", "rui", "run", "ruo", "sa", "sai", "san", "sang", "sao", "se", "sen", "seng", "sha", "shai", "shan", "shang", "shao", "she", "shei", "shen", "sheng", "shi", "shou", "shu", "shua", "shuai", "shuan", "shuang", "shui", "shun", "shuo", "si", "song", "sou", "su", "suan", "sui", "sun", "suo", "ta", "tai", "tan", "tang", "tao", "te", "tei", "teng", "ti", "tian", "tiao", "tie", "ting", "tong", "tou", "tu", "tuan", "tui", "tun", "tuo", "wa", "wai", "wan", "wang", "wei", "wen", "weng", "wo", "wu", "xi", "xia", "xian", "xiang", "xiao", "xie", "xin", "xing", "xiong", "xiu", "xu", "xuan", "xue", "xun", "ya", "yan", "yang", "yao", "ye", "yi", "yin", "ying", "yo", "yong", "you", "yu", "yuan", "yue", "yun", "za", "zai", "zan", "zang", "zao", "ze", "zei", "zen", "zeng", "zha", "zhai", "zhan", "zhang", "zhao", "zhe", "zhei", "zhen", "zheng", "zhi", "zhong", "zhou", "zhu", "zhua", "zhuai", "zhuan", "zhuang", "zhui", "zhun", "zhuo", "zi", "zong", "zou", "zu", "zuan", "zui", "zun", "zuo"],

        /**
         * 汉字字符表
         * @type Array
         */
        _pystr: ["阿啊呵腌吖锕啊呵嗄啊呵啊呵阿啊呵", "哀挨埃唉哎捱锿呆挨癌皑捱矮哎蔼霭嗳爱碍艾唉哎隘暧嗳瑷嗌嫒砹", "安谙鞍氨庵桉鹌广厂俺铵揞埯案按暗岸黯胺犴", "肮昂盎", "熬凹熬敖嚣嗷鏖鳌翱獒聱螯廒遨袄拗媪奥澳傲懊坳拗骜岙鏊", "八吧巴叭芭扒疤笆粑岜捌八拔跋茇菝魃把靶钯把爸罢霸坝耙灞鲅吧罢", "掰白百摆伯柏佰捭败拜呗稗", "般班搬斑颁扳瘢癍版板阪坂钣舨办半伴扮瓣拌绊", "帮邦浜梆膀榜绑棒膀傍磅谤镑蚌蒡", "包胞炮剥褒苞孢煲龅薄雹保宝饱堡葆褓鸨报暴抱爆鲍曝刨瀑豹趵", "背悲杯碑卑陂埤萆鹎北被备背辈倍贝蓓惫悖狈焙邶钡孛碚褙鐾鞴臂呗", "奔贲锛本苯畚奔笨夯坌", "崩绷嘣甭绷绷蹦迸甏泵蚌", "逼鼻荸比笔彼鄙匕俾妣吡秕舭必毕币秘避闭壁臂弊辟碧拂毙蔽庇璧敝泌陛弼篦婢愎痹铋裨濞髀庳毖滗蓖埤芘嬖荜贲畀萆薜筚箅哔襞跸狴", "编边鞭砭煸蝙笾鳊贬扁匾碥窆褊便变遍辩辨辫卞苄汴忭弁缏边", "标彪勺镖膘骠镳杓飚飑飙瘭髟表裱婊鳔", "憋瘪鳖别蹩瘪别", "宾滨彬斌缤濒槟傧玢豳镔鬓殡摈膑髌", "并兵冰槟饼屏丙柄秉炳禀邴并病摒", "般波播拨剥玻饽菠钵趵百博伯勃薄泊柏驳魄脖搏膊舶礴帛铂箔渤钹孛亳鹁踣簸跛薄柏簸掰擘檗卜啵", "逋晡钸不醭补捕堡卜哺卟不部布步怖簿埔埠瓿钚", "擦拆嚓礤", "猜才财材裁采彩踩睬采菜蔡", "参餐骖残惭蚕惨黪惨灿掺璨孱粲", "苍仓沧舱伧藏", "操糙曹槽嘈漕螬艚草", "策测侧厕册恻", "参岑涔", "噌曾层蹭", "差插叉碴喳嚓杈馇锸查察茶叉茬碴楂猹搽槎檫叉衩镲差刹叉诧岔衩杈汊姹", "差拆钗柴豺侪虿瘥", "搀掺觇单缠禅蝉馋潺蟾婵谗廛孱镡澶躔产铲阐谄冁蒇骣颤忏羼", "昌娼猖伥阊菖鲳长场常尝肠偿倘裳嫦徜苌场厂敞氅昶惝唱畅倡怅鬯", "超抄吵钞绰剿焯怊朝潮嘲巢晁炒吵耖", "车砗尺扯彻撤澈掣坼", "郴琛嗔抻陈沉晨沈尘臣辰橙忱谌宸碜称趁衬秤谶榇龀伧", "称撑秤瞠噌铛柽蛏成城程承诚盛乘呈惩澄橙丞埕枨塍铖裎酲逞骋裎称秤", "吃痴哧嗤蚩笞鸱媸螭眵魑持迟池驰匙弛踟墀茌篪坻尺齿耻侈褫豉赤斥翅啻炽敕叱饬傺彳瘛", "冲充涌憧忡艟舂茺种重崇虫宠冲铳", "抽瘳愁仇筹酬绸踌惆畴稠帱俦雠丑瞅臭", "出初樗除厨躇橱雏锄蜍刍滁蹰处楚储础杵褚楮处触畜矗怵搐绌黜亍憷", "揣搋揣揣啜踹嘬膪", "穿川巛氚传船遄椽舡喘舛串钏", "创窗疮床幢闯创怆", "吹炊垂锤捶陲椎槌棰", "春椿蝽纯唇醇淳鹑莼蠢", "戳踔绰啜辍龊", "差刺疵呲词辞慈磁瓷兹茨雌祠茈鹚糍此次刺赐伺", "从匆聪葱囱苁骢璁枞从丛琮淙", "凑楱辏腠", "粗徂殂促簇醋卒猝蹴蹙蔟酢", "蹿撺汆镩攒窜篡爨", "衰催摧崔隹榱璀脆粹萃翠瘁悴淬毳啐", "村皴存蹲忖寸", "搓撮磋蹉嵯矬痤瘥鹾撮脞错措挫厝锉", "答搭嗒耷褡哒打达答瘩沓鞑怛笪靼妲打大塔疸", "待呆呔逮歹傣大代带待戴袋贷逮殆黛怠玳岱迨骀绐埭甙", "单担丹耽眈殚箪儋瘅聃郸担胆掸赕疸瘅但担石弹淡旦蛋诞惮啖澹氮萏瘅", "当裆铛党挡谠当荡档挡宕菪凼砀", "刀叨忉氘叨导倒岛蹈捣祷到道倒悼盗稻焘帱纛", "得德锝的地得底", "得", "登灯蹬噔簦等戥邓凳瞪澄蹬磴镫嶝", "提低滴堤嘀氐镝羝的敌迪笛涤嘀狄嫡翟荻籴觌镝底抵诋邸砥坻柢氐骶的地第帝弟递蒂缔谛睇棣娣碲绨", "嗲", "颠滇掂癫巅点典碘踮丶电店甸淀垫殿奠惦佃玷簟坫靛钿癜阽", "雕刁凋叼貂碉鲷鸟调掉吊钓铫铞", "爹跌踮叠迭碟谍蝶喋佚牒耋蹀堞瓞揲垤鲽", "丁盯钉叮町酊疔仃耵玎顶鼎酊定订钉铤腚锭碇啶", "丢铥", "东冬咚岽氡鸫懂董硐动洞冻栋恫侗垌峒胨胴硐", "都兜蔸篼斗抖陡蚪读斗豆逗窦痘", "都督嘟读独顿毒渎牍犊黩髑椟肚睹堵赌笃度渡肚杜妒镀芏蠹", "端短断段锻缎煅椴簖", "堆对队兑敦碓憝怼镦", "吨敦蹲墩礅镦盹趸顿盾钝炖遁沌囤砘", "多咄哆掇裰度夺踱铎朵躲垛哚缍舵堕跺剁惰垛驮沲柁", "阿婀屙额俄哦鹅娥峨蛾讹莪锇恶恶饿扼愕遏噩呃厄鄂轭颚鳄谔锷萼腭垩鹗苊阏呃", "诶诶诶", "恩蒽摁", "而儿鸸鲕尔耳迩饵洱珥铒二贰佴", "发罚乏伐阀筏垡法砝发珐", "翻番帆藩幡蕃凡烦繁泛樊蕃燔矾蘩钒蹯反返饭犯范贩泛梵畈", "方芳妨坊邡枋钫房防妨坊肪鲂访仿纺彷舫放", "非飞啡菲扉霏妃绯蜚鲱肥腓淝菲匪诽斐蜚翡悱篚榧费废沸肺吠痱狒镄芾", "分纷氛芬吩酚玢坟焚汾棼鼢粉分份奋愤粪忿偾瀵鲼", "风封丰峰疯锋蜂枫烽酆葑沣砜逢缝冯讽唪奉缝凤俸葑", "佛", "否缶", "夫肤敷孵呋稃麸趺跗夫服福佛幅伏符浮扶弗拂袱俘芙孚匐辐涪氟桴蜉苻茯莩菔幞怫艴郛绂绋凫祓砩黻罘稃蚨芾蝠府父腐抚辅甫俯斧脯釜腑拊滏黼服复父负副富付妇附赴腹覆赋傅缚咐阜讣驸赙馥蝮鲋鳆咐", "夹咖嘎胳伽旮嘎噶轧尜钆嘎尕尬", "该赅垓陔改概盖丐钙芥溉戤", "干甘肝杆尴乾竿坩苷柑泔矸疳酐感敢赶杆橄秆擀澉干赣淦绀旰", "刚钢纲缸扛杠冈肛罡港岗钢杠戆筻", "高糕膏皋羔睾篙槔稿搞藁槁缟镐杲告膏诰郜锆", "歌格哥戈割胳搁疙咯鸽屹仡圪纥袼革格隔葛阁胳搁蛤嗝骼颌搿膈镉塥鬲个各合盖葛哿舸个各铬硌虼", "给", "根跟哏艮亘艮茛", "更耕庚羹赓耿颈梗哽鲠埂绠更", "工公共红供功攻宫恭躬龚弓肱蚣觥巩拱汞珙共供贡", "句沟勾钩篝佝枸缑鞲狗苟岣枸笱够购构勾觏垢诟媾遘彀", "姑骨孤估辜咕呱箍沽菇轱鸪毂菰蛄酤觚骨古股鼓骨谷贾汩蛊毂鹄牯臌诂瞽罟钴嘏蛄鹘故顾固估雇锢梏牿崮痼鲴", "括瓜刮呱栝胍鸹寡呱剐挂褂卦诖", "乖掴拐怪", "关观官冠棺矜莞倌纶鳏管馆莞观惯冠贯罐灌掼盥涫鹳", "光咣胱桄广犷逛桄", "规归瑰龟硅闺皈傀圭妫鲑鬼轨诡癸匦庋宄晷簋贵桂跪柜刽炔刿桧炅鳜", "滚鲧衮绲磙辊棍", "过锅郭涡聒蝈崞埚呙国帼掴馘虢果裹猓椁蜾过", "哈铪虾蛤哈哈", "嘿咳嗨还孩骸海胲醢害亥骇氦", "酣憨顸鼾蚶含寒汗韩涵函晗焓邯邗喊罕阚汉汗憾翰撼旱捍悍瀚焊颔菡撖", "夯行航吭杭绗珩颃行巷沆", "蒿薅嚆号毫豪嚎壕貉嗥濠蚝好郝好号浩耗皓昊灏镐颢", "喝呵诃嗬和何合河核盒禾荷阂涸阖貉曷颌劾菏盍纥蚵翮和何喝赫吓贺荷鹤壑褐", "黑嘿嗨", "痕很狠恨", "哼亨行横衡恒蘅珩桁横", "哼", "轰哄烘薨訇红洪鸿宏虹弘泓闳蕻黉荭哄哄讧蕻", "侯喉猴瘊篌糇骺吼后候後厚侯逅堠鲎", "乎呼戏忽糊惚唿滹轷烀和胡湖糊核壶狐葫弧蝴囫瑚斛鹄醐猢槲鹕觳煳鹘虎浒唬琥护户互糊虎沪祜扈戽笏岵怙瓠鹱冱", "华化花哗砉华划滑哗豁猾骅铧话华化划画桦", "怀徊淮槐踝坏划", "欢獾还环寰鬟桓圜洹郇缳锾萑缓换患幻唤宦焕痪涣浣奂擐豢漶逭鲩", "荒慌肓黄皇煌惶徨璜簧凰潢蝗蟥遑隍磺癀湟篁鳇晃恍谎幌晃", "挥辉灰恢徽堕诙晖麾珲咴虺隳回徊蛔茴洄毁悔虺会汇惠慧溃绘讳贿晦秽诲彗烩荟卉喙恚浍哕缋桧蕙蟪", "婚昏荤阍混魂浑馄珲混诨溷", "豁劐攉锪耠和活火伙夥钬和或获货祸惑霍豁藿嚯镬蠖", "其几期机基击奇激积鸡迹绩饥缉圾姬矶肌讥叽稽畸跻羁嵇唧畿齑箕屐剞玑赍犄墼芨丌咭笄乩革及即辑级极集急籍吉疾嫉藉脊棘汲岌笈瘠诘亟楫蒺殛佶戢嵴蕺几给己革济纪挤脊戟虮掎麂记系计济寄际技纪继既齐季寂祭忌剂冀妓骥蓟悸伎暨霁稷偈鲫髻觊荠跽哜鲚洎芰", "家加佳夹嘉茄挟枷珈迦伽浃痂笳葭镓袈跏夹颊戛荚郏恝铗袷蛱假角脚甲搅贾缴绞饺矫佼狡剿侥皎胛铰挢岬徼湫敫钾嘏瘕价假架驾嫁稼家", "间坚监渐兼艰肩浅尖奸溅煎歼缄笺菅蒹搛湔缣戋犍鹣鲣鞯简减检剪捡拣俭碱茧柬蹇謇硷睑锏枧戬谫囝裥笕翦趼见间件建监渐健剑键荐鉴践舰箭贱溅槛谏僭涧饯毽锏楗腱牮踺", "将江疆姜浆僵缰茳礓豇讲奖蒋桨耩将强降酱浆虹匠犟绛洚糨", "教交焦骄郊胶椒娇浇姣跤蕉礁鲛僬鹪蛟艽茭嚼矫峤角脚搅缴绞饺矫佼狡剿侥皎挢徼湫敫铰教觉校叫较轿嚼窖酵噍峤徼醮", "接结节街阶皆揭楷嗟秸疖喈结节杰捷截洁劫竭睫桔拮孑诘桀碣偈颉讦婕羯鲒解姐界解价介借戒届藉诫芥疥蚧骱家价", "今金禁津斤筋巾襟矜衿尽仅紧谨锦瑾馑卺廑堇槿进近尽仅禁劲晋浸靳缙烬噤觐荩赆妗", "经京精惊睛晶荆兢鲸泾旌茎腈菁粳警景井颈憬阱儆刭肼经境竟静敬镜劲竞净径靖痉迳胫弪婧獍靓", "扃窘炯迥炅", "究纠揪鸠赳啾阄鬏九酒久韭灸玖就旧救疚舅咎臼鹫僦厩桕柩", "车据且居俱拘驹鞠锯趄掬疽裾苴椐锔狙琚雎鞫局菊桔橘锔举柜矩咀沮踽龃榉莒枸据句具剧巨聚拒距俱惧沮瞿锯炬趄飓踞遽倨钜犋屦榘窭讵醵苣", "捐圈娟鹃涓镌蠲卷锩圈卷俊倦眷隽绢狷桊鄄", "嗟撅噘觉绝决角脚嚼掘诀崛爵抉倔獗厥蹶攫谲矍孓橛噱珏桷劂爝镢蕨觖蹶倔", "军均君钧筠龟菌皲麇俊峻隽菌郡骏竣捃浚", "咖喀咔卡咯咔佧胩", "开揩锎慨凯铠楷恺蒈剀垲锴忾", "看刊堪勘龛戡侃砍坎槛阚莰看嵌瞰阚", "康慷糠闶扛抗炕亢伉闶钪", "尻考烤拷栲靠铐犒", "科颗柯呵棵苛磕坷嗑瞌轲稞疴蝌钶窠颏珂髁咳壳颏可渴坷轲岢可克客刻课恪嗑溘骒缂氪锞蚵", "肯恳啃垦龈裉", "坑吭铿", "空倥崆箜恐孔倥空控", "抠芤眍口扣寇叩蔻筘", "哭枯窟骷刳堀苦库裤酷喾绔", "夸垮侉跨挎胯", "蒯会快块筷脍哙侩狯浍郐", "宽髋款", "框筐匡哐诓狂诳夼况矿框旷眶邝圹纩贶", "亏窥盔岿悝魁睽逵葵奎馗夔喹隗暌揆蝰傀跬愧溃馈匮喟聩篑蒉愦", "昆坤鲲锟醌琨髡捆悃阃困", "括适阔扩廓栝蛞", "拉啦喇垃邋拉喇旯砬拉喇落拉辣腊蜡剌瘌蓝啦", "来莱徕涞崃铼赖睐癞籁赉濑", "兰蓝栏拦篮澜婪岚斓阑褴镧谰懒览揽榄缆漤罱烂滥", "啷狼郎廊琅螂榔锒稂阆朗浪郎莨蒗阆", "捞劳牢唠崂铹痨醪老姥佬潦栳铑落络唠烙酪涝耢", "肋乐勒仂叻泐鳓了", "勒擂累雷擂羸镭嫘缧檑累蕾垒磊儡诔耒类泪累擂肋酹嘞", "棱楞棱塄冷愣", "哩离丽黎璃漓狸梨篱犁厘罹藜骊蜊黧缡喱鹂嫠蠡鲡蓠里理李礼哩鲤俚逦娌悝澧锂蠡醴鳢力利立历例丽励厉莉笠粒俐栗隶吏沥雳莅戾俪砺痢郦詈荔枥呖唳猁溧砾栎轹傈坜苈疠疬蛎鬲篥粝跞藓璃哩", "俩", "联连怜莲廉帘涟镰裢濂臁奁蠊鲢脸敛琏蔹裣练恋炼链殓楝潋", "量良梁凉粮粱踉莨椋墚两俩魉量亮辆凉谅晾踉靓", "撩撂聊疗辽僚寥撩撂缭寮燎嘹獠鹩了潦燎蓼钌了料廖镣撩撂尥钌", "咧裂咧列烈裂劣猎趔冽洌捩埒躐鬣咧", "林临秘邻琳淋霖麟鳞磷嶙辚粼遴啉瞵凛懔檩廪淋吝躏赁蔺膦", "拎令灵零龄凌玲铃陵伶聆囹棱菱苓翎棂瓴绫酃泠羚蛉柃鲮领令岭令另呤", "溜熘留流刘瘤榴浏硫琉遛馏镏旒骝鎏柳绺锍六陆溜碌遛馏镏鹨", "咯", "隆龙隆笼胧咙聋珑窿茏栊泷砻癃笼拢垄陇垅弄", "搂楼喽偻娄髅蝼蒌耧搂篓嵝露陋漏镂瘘喽", "噜撸卢炉庐芦颅泸轳鲈垆胪鸬舻栌鲁芦卤虏掳橹镥六路陆录露绿鹿碌禄辘麓赂漉戮簏鹭潞璐辂渌蓼逯轳氇34", "峦挛孪栾銮滦鸾娈脔卵乱", "抡论轮伦沦仑抡囵纶论", "落罗捋罗逻萝螺锣箩骡猡椤脶镙裸倮蠃瘰落络洛骆咯摞烙珞泺漯荦硌雒罗", "略掠锊", "旅履屡侣缕吕捋铝偻褛膂稆律绿率虑滤氯驴榈闾", "呒", "妈麻摩抹蚂嬷吗麻蟆马吗码玛蚂犸骂蚂唛杩么吗嘛", "埋霾买荬卖麦迈脉劢", "颟埋蛮馒瞒蔓谩鳗鞔满螨慢漫曼蔓谩墁幔缦熳镘", "忙茫盲芒氓邙硭莽蟒漭", "猫毛猫矛茅髦锚牦旄蝥蟊茆卯铆峁泖昴冒贸帽貌茂耄瑁懋袤瞀", "么麽", "没眉梅媒枚煤霉玫糜酶莓嵋湄楣猸镅鹛美每镁浼妹魅昧谜媚寐袂", "闷门扪钔闷懑焖们", "蒙蒙盟朦氓萌檬瞢甍礞虻艨蒙猛勐懵蠓蜢锰艋梦孟", "眯咪迷弥谜靡糜醚麋猕祢縻蘼米眯靡弭敉脒芈密秘觅蜜谧泌汨宓幂嘧糸", "棉眠绵免缅勉腼冕娩渑湎沔眄黾面", "喵描苗瞄鹋秒渺藐缈淼杪邈眇妙庙缪", "乜咩灭蔑篾蠛", "民珉岷缗玟苠敏悯闽泯皿抿闵愍黾鳘", "名明鸣盟铭冥茗溟瞑暝螟酩命", "谬缪", "摸无模麽磨摸摩魔膜蘑馍摹谟嫫抹没万默莫末冒磨寞漠墨抹陌脉嘿沫蓦茉貉秣镆殁瘼耱貊貘", "哞谋牟眸缪鍪蛑侔某", "模毪母姆姥亩拇牡目木幕慕牧墓募暮牟穆睦沐坶苜仫钼", "嗯唔嗯唔嗯", "那南拿镎那哪那呢纳娜呐捺钠肭衲哪呐", "哪乃奶氖艿奈耐鼐佴萘柰", "囝囡难南男楠喃腩蝻赧难", "囊囔囊馕馕攮曩", "孬努挠呶猱铙硇蛲脑恼瑙垴闹淖", "哪呢呐讷呢呐", "哪馁那内", "嫩恁", "能", "嗯唔嗯唔嗯", "妮呢尼泥倪霓坭猊怩铌鲵你拟旎祢泥尿逆匿腻昵溺睨慝伲", "蔫拈年粘黏鲇鲶碾捻撵辇念廿酿埝", "娘酿酿", "鸟袅嬲茑尿溺脲", "捏涅聂孽蹑嗫啮镊镍乜陧颞臬蘖", "您恁", "宁凝拧咛狞柠苎甯聍拧宁拧泞佞", "妞牛纽扭钮狃忸拗", "农浓侬哝脓弄", "耨", "奴孥驽努弩胬怒4", "暖", "娜挪傩诺懦糯喏搦锘", "虐疟", "女钕恧衄", "噢喔哦哦", "区欧殴鸥讴瓯沤偶呕藕耦呕沤怄", "派扒趴啪葩爬扒耙杷钯筢怕帕琶", "拍排牌徘俳排迫派湃蒎哌", "番攀潘扳般盘胖磐蹒爿蟠判盼叛畔拚襻袢泮", "乓膀滂旁庞膀磅彷螃逄耪胖", "炮抛泡脬跑炮袍刨咆狍匏庖跑炮泡疱", "呸胚醅陪培赔裴锫配佩沛辔帔旆霈", "喷盆湓喷", "烹抨砰澎怦嘭朋鹏彭棚蓬膨篷澎硼堋蟛捧碰", "批坏披辟劈坯霹噼丕纰砒邳铍皮疲啤脾琵毗郫鼙裨埤陴芘枇罴铍陂蚍蜱貔否匹劈痞癖圮擗吡庀仳疋屁辟僻譬媲淠甓睥", "片篇偏翩扁犏便蹁缏胼骈谝片骗", "漂飘剽缥螵朴瓢嫖漂瞟缥殍莩票漂骠嘌", "撇瞥氕撇丿苤", "拼拚姘贫频苹嫔颦品榀聘牝", "乒娉俜平评瓶凭萍屏冯苹坪枰鲆", "颇坡泊朴泼陂泺攴钋繁婆鄱皤叵钷笸破迫朴魄粕珀", "剖裒掊掊", "铺扑仆噗葡蒲仆脯菩匍璞濮莆镤普堡朴谱浦溥埔圃氆镨蹼暴铺堡曝瀑", "期七妻欺缉戚凄漆栖沏蹊嘁萋槭柒欹桤其奇棋齐旗骑歧琪祈脐祺祁崎琦淇岐荠俟耆芪颀圻骐畦亓萁蕲畦蛴蜞綦鳍麒起企启岂乞稽绮杞芑屺綮气妻器汽齐弃泣契迄砌憩汔亟讫葺碛", "掐伽葜袷卡恰洽髂", "千签牵迁谦铅骞悭芊愆阡仟岍扦佥搴褰钎前钱潜乾虔钳掮黔荨钤犍箝鬈浅遣谴缱肷欠歉纤嵌倩堑茜芡慊椠", "将枪抢腔呛锵跄羌戕戗镪蜣锖强墙蔷樯嫱强抢襁镪羟呛跄炝戗", "悄敲雀锹跷橇缲硗劁桥乔侨瞧翘蕉憔樵峤谯荞鞒悄巧雀愀翘俏窍壳峭撬鞘诮谯", "切茄伽且切窃怯趄妾砌惬锲挈郄箧慊", "亲钦侵衾琴秦勤芹擒矜覃禽噙廑溱檎锓嗪芩螓寝沁揿吣", "青清轻倾卿氢蜻圊鲭情晴擎氰檠黥请顷謦苘亲庆罄磬箐綮", "穷琼穹茕邛蛩筇跫銎", "秋邱丘龟蚯鳅楸湫求球仇囚酋裘虬俅遒赇泅逑犰蝤巯鼽糗", "区曲屈趋驱躯觑岖蛐祛蛆麴诎黢渠瞿衢癯劬璩氍朐磲鸲蕖蠼蘧取曲娶龋苣去趣觑阒戌", "圈悛全权泉拳诠颧蜷荃铨痊醛辁筌鬈犬绻畎劝券", "缺阙炔瘸却确雀榷鹊阕阙悫", "逡群裙麇", "然燃髯蚺染冉苒", "嚷瓤禳穰嚷攘壤禳让", "饶娆桡荛扰绕娆绕", "若惹喏热", "人任仁壬忍稔荏任认韧刃纫饪仞葚妊轫衽", "扔仍", "日", "容荣融蓉溶绒熔榕戎嵘茸狨肜蝾冗", "柔揉蹂糅鞣肉", "如儒茹嚅濡孺蠕薷铷襦颥辱乳汝入褥缛洳溽蓐", "软阮朊", "蕤蕊瑞锐芮睿枘蚋", "润闰", "若弱偌箬", "撒仨挲洒撒萨卅飒脎", "思塞腮鳃噻赛塞", "三叁毵散伞馓糁霰散", "丧桑嗓搡磉颡丧", "骚搔臊缲缫鳋扫嫂扫梢臊埽瘙", "色塞涩瑟啬铯穑", "森", "僧", "杀沙刹纱杉莎煞砂挲鲨痧裟铩傻沙啥厦煞霎嗄歃唼", "筛酾色晒", "山衫删煽扇珊杉栅跚姗潸膻芟埏钐舢苫髟闪陕掺掸单善扇禅擅膳讪汕赡缮嬗掸骟剡苫鄯钐疝蟮鳝", "商伤汤殇觞熵墒上赏晌垧上尚绱裳", "烧稍梢捎鞘蛸筲艄勺韶苕杓芍少少绍召稍哨邵捎潲劭", "奢赊猞畲折舌蛇佘舍社设舍涉射摄赦慑麝滠歙厍", "谁", "身深参申伸绅呻莘娠诜砷糁什神甚审沈婶谂哂渖矧甚慎渗肾蜃葚胂椹", "生声胜升牲甥笙绳渑省眚胜圣盛乘剩嵊晟", "师诗失施尸湿狮嘘虱蓍酾鲺时十实什识食石拾蚀埘莳炻鲥使始史驶屎矢豕是事世市士式视似示室势试释适氏饰逝誓嗜侍峙仕恃柿轼拭噬弑谥莳贳铈螫舐筮殖匙", "收熟手首守艏受授售瘦寿兽狩绶", "书输殊舒叔疏抒淑梳枢蔬倏菽摅姝纾毹殳疋熟孰赎塾秫数属署鼠薯暑蜀黍曙数术树述束竖恕墅漱戍庶澍沭丨腧", "刷唰耍刷", "衰摔甩率帅蟀", "栓拴闩涮", "双霜孀泷爽", "谁水说税睡", "吮顺舜瞬", "说数朔硕烁铄妁蒴槊搠", "思斯司私丝撕厮嘶鸶咝澌缌锶厶蛳死四似食寺肆伺饲嗣巳祀驷泗俟汜兕姒耜笥厕", "松忪淞崧嵩凇菘耸悚怂竦送宋诵颂讼", "搜艘馊嗖溲飕锼螋擞叟薮嗾瞍嗽擞", "苏稣酥俗诉速素肃宿缩塑溯粟簌夙嗉谡僳愫涑蔌觫", "酸狻算蒜", "虽尿荽睢眭濉随遂隋绥髓岁碎遂祟隧邃穗燧谇", "孙荪狲飧损笋榫隼", "缩莎梭嗦唆挲娑睃桫嗍蓑羧所索锁琐唢", "他她它踏塌遢溻铊趿塔鳎獭踏拓榻嗒蹋沓挞闼漯", "台胎苔台抬苔邰薹骀炱跆鲐呔太态泰汰酞肽钛", "摊贪滩瘫坍谈弹坛谭潭覃痰澹檀昙锬镡郯坦毯忐袒钽探叹炭碳", "汤趟铴镗耥羰堂唐糖膛塘棠搪溏螳瑭樘镗螗饧醣躺倘淌傥帑趟烫", "涛掏滔叨焘韬饕绦逃陶桃淘萄啕洮鼗讨套", "特忑忒慝铽", "忒", "腾疼藤誊滕", "体踢梯剔锑提题啼蹄醍绨缇鹈荑体替涕剃惕屉嚏悌倜逖绨裼", "天添田填甜恬佃阗畋钿腆舔忝殄掭", "挑佻祧条调迢鲦苕髫龆蜩笤挑窕跳眺粜", "贴帖萜铁帖帖餮", "听厅汀烃停庭亭婷廷霆蜓葶莛挺艇町铤梃梃", "通恫嗵同童彤铜桐瞳佟酮侗仝垌茼峒潼砼统筒桶捅侗同通痛恸", "偷头投骰钭透", "突秃凸图途徒屠涂荼菟酴土吐钍吐兔堍菟", "湍团抟疃彖", "推忒颓腿退褪蜕煺", "吞暾屯饨臀囤豚氽褪", "托脱拖乇陀舵驼砣驮沱跎坨鸵橐佗铊酡柁鼍妥椭庹魄拓唾柝箨", "挖哇凹娲蛙洼娃瓦佤瓦袜腽哇", "歪崴外", "湾弯蜿剜豌完玩顽丸纨芄烷晚碗挽婉惋宛莞娩畹皖绾琬脘菀万腕蔓", "汪尢王忘亡芒往网枉惘罔辋魍望王往忘旺妄", "委威微危巍萎偎薇逶煨崴葳隈为维围唯违韦惟帷帏圩囗潍桅嵬闱沩涠委伟唯尾玮伪炜纬萎娓苇猥痿韪洧隗诿艉鲔为位未味卫谓遗慰魏蔚畏胃喂尉渭猬軎", "温瘟文闻纹蚊雯璺阌稳吻紊刎问纹汶璺", "翁嗡蓊瓮蕹", "窝涡蜗喔倭挝莴哦我握卧哦渥沃斡幄肟硪龌", "於恶屋污乌巫呜诬兀钨邬圬无亡吴吾捂毋梧唔芜浯蜈鼯五武午舞伍侮捂妩忤鹉牾迕庑怃仵物务误恶悟乌雾勿坞戊兀晤鹜痦寤骛芴杌焐阢婺鋈", "西息希吸惜稀悉析夕牺腊昔熙兮溪嘻锡晰樨熄膝栖郗犀曦奚羲唏蹊淅皙汐嬉茜熹烯翕蟋歙浠僖穸蜥螅菥舾矽粞硒醯欷鼷席习袭媳檄隰觋喜洗禧徙玺屣葸蓰铣系细戏隙饩阋禊舄", "瞎虾呷峡侠狭霞暇辖遐匣黠瑕狎硖瘕柙下夏吓厦唬罅", "先鲜仙掀纤暹莶锨氙祆籼酰跹闲贤嫌咸弦娴衔涎舷鹇痫显险鲜洗跣猃藓铣燹蚬筅冼现见线限县献宪陷羡馅腺岘苋霰", "相香乡箱厢湘镶襄骧葙芗缃降详祥翔庠想响享飨饷鲞相向象像项巷橡蟓", "消销潇肖萧宵削嚣逍硝霄哮枭骁箫枵哓蛸绡魈淆崤小晓筱笑校效肖孝啸", "些歇楔蝎叶协鞋携斜胁谐邪挟偕撷勰颉缬写血写解谢泄契械屑卸懈泻亵蟹邂榭瀣薤燮躞廨绁渫榍獬", "心新欣辛薪馨鑫芯昕忻歆锌寻镡信芯衅囟", "兴星腥惺猩行形型刑邢陉荥饧硎省醒擤性兴姓幸杏悻荇", "兄胸凶匈汹芎雄熊", "修休羞咻馐庥鸺貅髹宿朽秀袖宿臭绣锈嗅岫溴", "需须虚吁嘘墟戌胥砉圩盱顼徐许浒栩诩糈醑续序绪蓄叙畜恤絮旭婿酗煦洫溆勖蓿", "宣喧轩萱暄谖揎儇煊旋悬玄漩璇痃选癣旋券炫渲绚眩铉泫碹楦镟", "削靴薛学穴噱踅泶雪鳕血谑", "熏勋荤醺薰埙曛窨獯寻询巡循旬驯荀峋洵恂郇浔鲟训迅讯逊熏殉巽徇汛蕈浚", "压雅呀押鸦哑鸭丫垭桠牙涯崖芽衙睚伢岈琊蚜雅瞧匹痖疋亚压讶轧娅迓揠氩砑呀", "烟燕咽殷焉淹阉腌嫣胭湮阏鄢菸崦恹言严研延沿颜炎阎盐岩铅蜒檐妍筵芫闫阽眼演掩衍奄俨偃魇鼹兖郾琰罨厣剡鼽研验沿厌燕宴咽雁焰艳谚彦焱晏唁砚堰赝餍滟酽谳", "央泱秧鸯殃鞅洋阳杨扬羊疡佯烊徉炀蛘养仰痒氧样漾恙烊怏鞅", "要约邀腰夭妖吆幺摇遥姚陶尧谣瑶窑肴侥铫珧轺爻徭繇鳐咬杳窈舀崾要药耀钥鹞曜疟", "耶噎椰掖爷耶邪揶铘也野冶业夜叶页液咽哗曳拽烨掖腋谒邺靥晔", "一医衣依椅伊漪咿揖噫猗壹铱欹黟移疑遗宜仪蛇姨夷怡颐彝咦贻迤痍胰沂饴圯荑诒眙嶷以已衣尾椅矣乙蚁倚迤蛾旖苡钇舣酏意义议易衣艺译异益亦亿忆谊抑翼役艾溢毅裔逸轶弈翌疫绎佚奕熠诣弋驿懿呓屹薏噫镒缢邑臆刈羿仡峄怿悒肄佾殪挹埸劓镱瘗癔翊蜴嗌翳", "因音烟阴姻殷茵荫喑湮氤堙洇铟银吟寅淫垠鄞霪狺夤圻龈引隐饮瘾殷尹蚓吲印饮荫胤茚窨", "应英鹰婴樱膺莺罂鹦缨瑛璎撄嘤营迎赢盈蝇莹荧萤萦瀛楹嬴茔滢潆荥蓥影颖颍瘿郢应硬映媵", "育哟唷哟", "拥庸佣雍臃邕镛墉慵痈壅鳙饔喁永勇涌踊泳咏俑恿甬蛹用佣", "优幽忧悠攸呦由游油邮尤犹柚鱿莸尢铀猷疣蚰蝣蝤繇莜有友黝酉莠牖铕卣有又右幼诱佑柚囿鼬宥侑蚴釉", "於吁迂淤纡瘀于与余予鱼愚舆娱俞愉馀逾渔渝俞萸瑜隅揄榆虞禺谀腴竽妤臾欤觎盂窬蝓嵛狳舁雩与语雨予宇羽禹圄屿龉伛圉庾瘐窳俣与语育遇狱雨欲预玉愈谷域誉吁蔚寓豫粥郁喻裕浴御驭尉谕毓妪峪芋昱煜熨燠菀蓣饫阈鬻聿钰鹆鹬蜮", "冤渊鸳眢鸢箢员元原园源圆缘援袁猿垣辕沅媛芫橼圜塬爰螈鼋远院愿怨苑媛掾垸瑗", "约曰说月乐越阅跃悦岳粤钥刖瀹栎樾龠钺", "晕氲员云匀筠芸耘纭昀郧允陨殒狁员运均韵晕孕蕴酝愠熨郓韫恽", "扎咂匝拶杂咱砸咋", "灾哉栽甾载仔宰崽在再载", "簪糌咱攒拶昝趱赞暂瓒錾咱", "赃臧锗驵藏脏葬奘", "遭糟凿早澡枣蚤藻缲造灶躁噪皂燥唣", "则责泽择咋啧迮帻赜笮箦舴侧仄昃", "贼", "怎谮", "曾增憎缯罾赠综缯甑锃", "查扎咋渣喳揸楂哳吒齄炸扎札喋轧闸铡眨砟炸咋诈乍蜡栅榨柞吒咤痄蚱", "摘侧斋择宅翟窄债祭寨砦瘵", "占沾粘瞻詹毡谵旃展斩辗盏崭搌战站占颤绽湛蘸栈", "张章彰璋蟑樟漳嫜鄣獐长掌涨仉丈涨帐障账胀仗杖瘴嶂幛", "着招朝嘲昭钊啁着找爪沼照赵召罩兆肇诏棹笊", "折遮蜇折哲辙辄谪蛰摺磔蜇者褶锗赭这浙蔗鹧柘着", "这", "真针珍斟贞侦甄臻箴砧桢溱蓁椹榛胗祯浈诊枕疹缜畛轸稹阵镇震圳振赈朕鸩", "正争征丁挣症睁徵蒸怔筝铮峥狰钲鲭整拯政正证挣郑症怔铮诤帧", "之只知指支织氏枝汁掷芝吱肢脂蜘栀卮胝祗直指职值执植殖侄踯摭絷跖埴只指纸止址旨徵趾咫芷枳祉轵黹酯知至制识治志致质智置秩滞帜稚挚掷峙窒炙痔栉桎帙轾贽痣豸陟忮彘膣雉鸷骘蛭踬郅觯", "中终钟忠衷锺盅忪螽舯种肿踵冢中种重众仲", "周州洲粥舟诌啁轴妯碡肘帚皱骤轴宙咒昼胄纣绉荮籀繇酎", "诸朱珠猪株蛛洙诛铢茱邾潴槠橥侏术逐筑竹烛躅竺舳瘃主属煮嘱瞩拄褚渚麈住注助著驻祝筑柱铸伫贮箸炷蛀杼翥苎疰", "抓挝爪", "拽转曳拽嘬", "专砖颛转传转赚撰沌篆啭馔", "装庄妆桩奘状壮撞幢僮戆", "追锥隹椎骓坠缀赘惴缒", "屯谆肫窀准", "桌捉卓拙涿焯倬着著琢缴灼酌浊濯茁啄斫镯诼禚擢浞", "资咨滋仔姿吱兹孜谘呲龇锱辎淄髭赀孳粢趑觜訾缁鲻嵫子紫仔梓姊籽滓秭笫耔茈訾自字渍恣眦", "宗踪综棕鬃枞腙总偬纵粽", "邹诹陬鄹驺鲰走奏揍", "租菹足族卒镞组祖阻诅俎", "钻躜纂缵赚钻攥", "堆嘴咀觜最罪醉蕞", "尊遵樽鳟撙", "作嘬作昨琢笮左佐撮作做坐座凿柞怍胙阼唑祚酢"],

        /**
         * 转换单字符
         * @param {String} chrStr 单字符
         * @return {String} 转换后的字符串(如果不属于汉字字符集，则返回空，或者ascii码小于255的所有字符)
         */
        convertPY: function (chrStr) {
            if (chrStr == null || chrStr.length == 0)
                return "";
            var tmpchr = chrStr.charAt(0);
            if (chrStr.charCodeAt(0) <= 255)
                return tmpchr;
            for (var i = 0; i < this._pystr.length; i++) {
                if (this._pystr[i].indexOf(tmpchr) >= 0)
                    return this._pyvalue[i];
            }
            return ''; //chrStr;
        },
        /**
         * 转换字符串
         * @param {String} str 输入字符串
         * @return {String} 转换后的拼音字符串，包括整串拼音和首字母缩略字符串
         */
        convertPYs: function (str) {
            if (!str) return;
            var arr = (str + '').split('');
            var arrPY = [],
                arrPYS = [];
            var ssht;
            for (var i = 0; i < arr.length; i++) {
                ssht = this.convertPY(arr[i]);
                if (ssht) {
                    arrPY.push(ssht);
                    arrPYS.push(ssht.charAt(0));
                }
            }
            return [arrPY.join(''), arrPYS.join('')];
        }
    }
});
/**
 * qplus api call module
 * author: rehorn
 */


;
Jx().$package('share.net', function (J) {

    var CONST = share.CONST,
        packageContext = this,
        $H = J.http,
        $E = J.event;

    var REPORT_MAP = {
        "pageview": 10557,
        "sign": 10558,
        "share2qq": 10559,
        "share2qzone": 10560,
        "share2txweibo": 10561,
        "selectall": 10562,
        "more": 10563,
        "select": 10564,
        "search": 10565,
        "closesuccess": 10566,
        "write": 10567,
        "apply": 10664,
        "create": 10665,
        "website": 10752,
        "contacts": 10789,
        "groups": 10790,
        "discussions": 10791,
        "sharenothing": 10977,
        "shareempty": 10978,
        "clickFeedback": 11198,
        "to3rd": 11403,
        "bannerclick": 11506
    };

    var MONITOR_MAP = {
        "onload": 259677,
        "error_getInfo": 259678,
        "error_login": 259679,
        "error_loginCookie": 259680,
        "error_getFriends": 259681,
        "error_js": 259682,
        "error_share": 259683,
        "succ_share": 259684
    };

    var mmreport_time = {
        'get_nick': {},
        'get_urlinfo': {},
        'get_buddyList': {},
        'get_openAccount': {},
        'sendShare': {},
        'get_userType': {},
        'createDisgroup': {}
    };

    var getMMInterval = function (key) {
        if (mmreport_time[key].t1 && mmreport_time[key].t2) {
            var interval = mmreport_time[key].t2 - mmreport_time[key].t1;
            return interval;
        }

    };

    this.reportIsdStart = mytracker.reportIsdStart;
    this.reportIsdEnd = mytracker.reportIsdEnd;

    /**
     * 发送cgi
     * @param  {string} url      cgi路径
     * @param  {object} option   cgi参数
     * @param  {string} proxyUrl 代理url
     */
    this.request = function (url, option, proxyUrl) {
        option = option || {};
        if (!option.method) {
            option.method = 'POST';
        }
        if (!option.timeout) {
            option.timeout = 30000;
        }
        var callback = option.onSuccess;
        if (callback) { //让回调从父窗口执行
            var cbkFunction = function () {
                var args = arguments,
                    context = this;

                if (option.reportKey) {
                    mmreport_time[option.reportKey].t2 = +new Date;
                    MM.report(url, args[0].retcode, getMMInterval(option.reportKey));
                }

                setTimeout(function () {
                    callback.apply(this, args);
                }, 0);
            };
            option.onSuccess = cbkFunction;
            option.onError = cbkFunction;
            option.onTimeout = cbkFunction;
        }
        if (option.reportKey) {
            mmreport_time[option.reportKey].t1 = +new Date;
        }

        proxyUrl = proxyUrl || CONST.DEFAULT_CGI_PROXY_URL;
        qservice.proxySend(url, option, proxyUrl);
    };

    // 获取好友列表 接口人hengzhen
    this.getBuddyList = function (param, callback) {
        console.log('start requestBuddyList');
        packageContext.reportIsdStart('get_buddy_list');

        var url = CONST.CGI_HOST + '/qqconnectopen/openapi/get_user_friends';
        param = param || {};
        var option = {
            data: param,
            method: 'GET',
            onSuccess: callback,
            onError: callback,
            onTimeout: callback,
            reportKey: 'get_buddyList'
        };
        packageContext.request(url, option);
        console.log('end requestBuddyList');
    };

    // 获取授权第三方终端 接口人hengzhen
    this.getOpenAccount = function (param, callback) {
        console.log('getOpenAccount');
        packageContext.reportIsdStart('get_open_account');

        var url = CONST.CGI_HOST + '/qqconnectopen/openapi/get_open_account';
        var option = {
            data: param,
            method: 'GET',
            onSuccess: callback,
            onError: callback,
            onTimeout: callback,
            reportKey: 'get_openAccount'
        };
        this.request(url, option);
    };

    // 带远程图片分享 接口人hengzhen
    this.sendShare = function (param, callback) {
        console.log('shareWithPic');
        packageContext.reportIsdStart('sns_send');

        if (param.msg_type == 6) {
            var url = CONST.CGI_HOST + '/qqconnectopen/openapi/send_share_for_media';
        } else {
            var url = CONST.CGI_HOST + '/qqconnectopen/openapi/send_share';
        }

        var that = this;

        if (param.imageUrl == undefined || param.imageUrl == '' || param.imageUrl.indexOf("qpic.cn") >= 0 ||
            param.imageUrl.indexOf("qq.com") >= 0 ||
            param.imageUrl.indexOf("gtimg.com") >= 0 ||
            param.imageUrl.indexOf("gtimg.cn") >= 0) {
            callSendReq()
        } else {
            var changeImgUrl = "//cgi.connect.qq.com/qqconnectopen/openapi/change_image_url";
            var changeImgOpt = {
                type: 'GET',
                dataType: 'json',
                xhrFields: {
                    withCredentials: true
                },
                data: {
                    usehttps: 1,
                    url: param.imageUrl,
                    uin: J.cookie.get('uin'),
                },
                timeout: 3000,
                onSuccess: function (ret) {
                    console.log(ret)
                    if (ret.retcode == 0) {
                        param.imageUrl = ret.url;
                    } else {
                        delete param.imageUrl
                    }
                    callSendReq();
                },
                onError: function (ret) {
                    callSendReq();
                }
            }
            this.request(changeImgUrl, changeImgOpt);
        }

        function callSendReq() {
            var option = {
                data: param,
                method: 'POST',
                onSuccess: callback,
                onError: callback,
                onTimeout: callback,
                reportKey: 'sendShare'
            };
            that.request(url, option);
        }

    };

    // cgi上报
    this.track = function (tag, appid, info) {
        info = info || '';
        appid = appid || appId;
        var img = new Image();
        img.src = 'http://cgi.qplus.com/report/report?tag=' + tag + '&appid=' + appid + '&info=' + info + '&t=' + Math.random();
    };


    var _count = [];
    this.report = function (eventObj) {
        if (eventObj.name) {
            var id = REPORT_MAP[eventObj.name];
            if (id) {
                if (eventObj.obj) {
                    Q.bernoulli(id, eventObj.obj);
                } else {
                    Q.bernoulli(id);
                }
            }
        }
    };

    this.reportOnce = function (eventObj) {

        if (!_count[eventObj.name]) {
            _count[eventObj.name] = 1;
        } else {
            _count[eventObj.name]++;
        }
        if (_count[eventObj.name] > 1) {
            return;
        }
        this.report(eventObj);
    };

    this.monite = function (name) {
        var id = MONITOR_MAP[name];
        if (id) {
            Q.monitor(id);
        }
    };

    this.speed = function () {
    };

    // 上报到smart track
    // opername写module
    // name写invite,share
    // action写invite1/invite2.....invite20
    // obj:appid
    this.smartTrack = function (action, obj, name) {
        var opername = 'module';
        var img = new Image();
        img.src = 'http://cgi.qplus.com/report/report?strValue={"action":"' + action + '","name":"' + name + '","opername":"' + opername + '","obj":"' + obj + '"}&tag=0';
    };

    // 获取url信息
    this.requestUrlInfo = function (url, linktype) {
        console.log('start requestUrlInfo');
        mmreport_time.get_urlinfo.t1 = +new Date;
        var callback = 'share.net.requestUrlInfoCallback';
        var uin = share.utils.getSelfUin() || '840652236';
        //var requestUrl = 'http://sns.qzone.qq.com/cgi-bin/qzshare/cgi_qzshareget_urlinfoForQQ?url=' + encodeURIComponent(url) + '&t=' + (new Date().valueOf());
        var requestUrl = 'https://sns.qzone.qq.com/cgi-bin/qzshare/cgi_qzshare_rich_url_forqq?loginuin=' + uin + '&url=' + encodeURIComponent(url) + '&linktype=' + linktype + '&ispc=1&xmlout=0';
        var _this = this;
        var errCallback = function () {
            console.log('requestUrlInfo timeout');
            _this.monite("error_getInfo");
            var data = {
                retcode: 1,
                result: {}
            };
            $E.notifyObservers(packageContext, 'GetUrlInfoSuccess', data);
        };
        // 设置3s过期时间
        var opt = {
            onTimeout: errCallback,
            timeout: 3 * 1000
        };
        // jsonp格式返回,接口人 fonewang
        _Callback = function (obj) {
            mmreport_time.get_urlinfo.t2 = +new Date;
            var reportUrl = 'https://sns.qzone.qq.com/cgi-bin/qzshare/cgi_qzshare_rich_url_forqq';
            MM.report(reportUrl, obj.result.code, getMMInterval('get_urlinfo'));
            share.net.requestUrlInfoCallback(obj);
        }
        $H.loadScript(requestUrl, opt);
    };

    this.requestUrlInfoCallback = function (data) {
        console.log('requestUrlInfoCallback');
        $E.notifyObservers(packageContext, 'GetUrlInfoSuccess', data);
    };


    // 获取昵称
    this.requestUserName = function () {
        console.log('start requestUserName');

        // 新的jungle框架，不允许jsonp的callback名称使用点号（安全考虑）
        // 这里要同时兼顾 $.loadScript() 的自动回调机制
        // 所以通过全局变量引用解决
        //var callback = 'share.net.requestUserNameCallback';
        var callback = 'GobalRequestUserNameCallback';
        window.GobalRequestUserNameCallback = this.requestUserNameCallback;

        var requestUrl = CONST.CGI_HOST + '/qqconnectopen/openapi/get_nick?retype=2&callback=' + callback + '&t=' + (new Date().valueOf());
        var errCallback = function () {
            var data = {
                retcode: 1,
                result: {}
            };
            console.log('requestUserName timeout');
            $E.notifyObservers(packageContext, 'GetUserNameSuccess', data);
        };
        // 设置3s过期时间
        var opt = {
            onTimeout: errCallback,
            timeout: 3 * 1000
        };
        mmreport_time.get_nick.t1 = +new Date;
        // jsonp格式返回,接口人 fonewang
        $H.loadScript(requestUrl, opt);
    };

    this.requestUserNameCallback = function (data) {
        var _this = this;
        console.log('requestUserNameCallback');
        mmreport_time.get_nick.t2 = +new Date;
        var requestUrl = CONST.CGI_HOST + '/qqconnectopen/openapi/get_nick';
        MM.report(requestUrl, data.retcode, getMMInterval('get_nick'));
        $E.notifyObservers(packageContext, 'GetUserNameSuccess', data);
    };

    this.requestUserType = function (callback) {
        var param = {};
        var url = '//cgi.connect.qq.com/qqconnectopen/is_first';
        var option = {
            data: param,
            method: 'GET',
            onSuccess: callback,
            onError: callback,
            onTimeout: callback,
            reportKey: 'get_userType'
        };
        this.request(url, option);
    };


    this.createDisGroup = function (data) {
        console.log("Create DisGroup Start");
        var CREATE_URL = "https://cgi.connect.qq.com/qqconnectopen/openapi/create_discuss";
        var callback = this.createDisGroupCallback;

        var ulist = [];
        for (var i = 0, n = data.uinArray.length; i < n; i++) {
            ulist.push({
                uin: data.uinArray[i],
                type: 0
            });
        }
        ulist = J.json.stringify(ulist);

        var name = (data.name || "新建讨论组");
        var requestString = {
            name: name,
            ulist: ulist,
            t: data.t
        };

        var _this = this;

        var errCallback = function () {
            var data = {
                retcode: 1,
                result: {}
            };
            console.log('Create DG Timeout');
            _this.createDisGroupCallback(data);
        };

        var option = {
            data: requestString,
            method: 'POST',
            onSuccess: callback,
            onError: callback,
            onTimeout: errCallback,
            reportKey: 'createDisgroup'
        };

        this.request(CREATE_URL, option);
    };

    this.createDisGroupCallback = function (data) {
        $E.notifyObservers(packageContext, "CreateDisGroupSuccess", data);
    };

});
/**
 * 测试数据
 */
var appId = 200002118;

var DATA = {};
/**
 * qplus api call module
 * author: rehorn
 */


;
Jx().$package('share.ui', function (J) {
    /**
     * 遮罩
     * 从 messagebox 模块复用
     */
    this.Masker = new J.Class({
        init: function (option) {
            var container = option.container || document.body;
            this._container = container;
            this._el = option.element;
            if (!this._el) {
                var el = this._el = document.createElement('div');
                var className = option.className || '';
                el.setAttribute('class', 'masker ' + className);
                el.innerHTML = '<div class="masker-tips center"></div>';
                container.appendChild(el);
            }
            this._tips = J.dom.mini('.masker-tips')[0];
            this._loadingTips = J.dom.mini('.loading-tips', this._tips)[0];
        },
        setTips: function (text, notCenter) {
            if (notCenter) {
                J.dom.removeClass(this._tips, 'center');
            } else {
                J.dom.addClass(this._tips, 'center');
            }
            //this._tips.innerHTML = text;
            this._loadingTips.innerHTML = text;
        },
        show: function (target) {
            target = target || this._container;
            if (target && target !== this._el.parentNode) {
                target.appendChild(this._el);
            }
            J.dom.show(this._el);
        },
        hide: function () {
            J.dom.hide(this._el);
        }
    });

    this.maskerSingleton = {
        el: J.dom.id("mask"),
        bind: function () {
            window.onresize = function () {
                if (J.dom.id("mask").style.display == 'block') {
                    var ch = document.body.clientHeight;
                    var sh = document.body.scrollHeight;
                    var h = ch > sh ? ch : sh;
                    J.dom.id("mask").style.height = h + "px";
                }
            }
        },
        show: function () {
            this.el.style.display = "block";
            var ch = document.body.clientHeight;
            var sh = document.body.scrollHeight;
            var h = ch > sh ? ch : sh;
            this.el.style.height = h + "px";
            if (window.location.pathname == '/widget/shareqq/iframe_index.html' || window.location.pathname == '/open/connect/widget/pc/qqshare/iframe_index.html') {
                this.el.style.height = "511px";
            }
            J.dom.id("innerMasker").style.display = "block";
            J.dom.addClass(J.dom.id("wrapper"), "upIndex");
            J.dom.addClass(J.dom.id("header"), "forMaskerBg");
            J.dom.addClass(J.dom.id("footer"), "forMaskerBg");
            this.bind();
        },
        hide: function () {
            this.el.style.display = "none";

            J.dom.id("innerMasker").style.display = "none";
            J.dom.removeClass(J.dom.id("wrapper"), "upIndex");
            J.dom.removeClass(J.dom.id("header"), "forMaskerBg");
            J.dom.removeClass(J.dom.id("footer"), "forMaskerBg");
        }
    };

});
/**
 * author rehorn
 * share components for q+ vm
 * 2012-04-16
 */

;
Jx().$package('share.model', function (J) {
    var packageContext = this,
        $ = J.dom.mini,
        $P = J.localStorage,
        $D = J.dom,
        $E = J.event,
        $S = J.string,
        $A = J.array,
        $U = share.utils,
        $NET = share.net,
        $API = share.api,
        CONST = share.CONST;

    // model层用户配置项
    // share => 分享到...数组
    // {
    //     id: 'buddy',  id
    //     name: 'QQ好友',    name
    //     visible: 1,  是否可见
    //     channel: 1,  使用哪个发送通道，1：分享通道，2：cgi，3：邀请通道
    //     shareFlag: 1,    是否可以进行分享
    //     validFlag: 1,    是否可以开通帐号，未开通未注册情况下为0，通过openAccoutn回去
    //     regAction: 1,  开通方式 1: 打开浏览器 2：授权中心版定
    //     regUrl: '',  开通注册地址
    //     error: 0,    是否分享过并且失败
    //     checked: 1   是否选中
    // }
    var _userSetting = {
            share: [{
                id: 'qq',
                name: 'QQ好友',
                visible: 0,
                show: 1,
                channel: 2,
                shareFlag: 1,
                validFlag: 1,
                regUrl: '',
                error: 0,
                checked: 1
            }, {
                id: 'qzone',
                name: 'QQ空间',
                visible: 1,
                channel: 2,
                shareFlag: 1,
                validFlag: 1,
                regUrl: '',
                error: 0,
                checked: 0
            }, {
                id: 'wblog',
                name: '腾讯微博',
                visible: 0,
                channel: 2,
                shareFlag: 1,
                validFlag: 1,
                regAction: 1,
                regUrl: 'http://t.qq.com/reg/index.php',
                error: 0,
                checked: 0
            }, {
                id: 'sina',
                name: '新浪微博',
                visible: 0,
                channel: 2,
                shareFlag: 0,
                validFlag: 0,
                regAction: 2,
                regUrl: '',
                error: 0,
                checked: 0
            }],
            buddyList: 0,
            groupList: {},
            maxChar: 120
        },

        // 好友列表信息
        _buddyList,
        _selfUin;

    // share => 分享到...map
    var _shareSettingMap = {},
        // popup参数
        _popUpParam,
        // app参数
        _appParam;

    // 分享给QQ好友状态
    var _selectedStatus = {
        // 最多同时分享好友数
        total: 5,
        // 已经选中uin[int array]
        selected: [],
        // 选中uin OpenId, nick
        selectedInfo: [],

        //最多可分享的群数量
        maxToGroup: 3,

        //最多可分享的讨论组数量
        maxToDisGroup: 3,

        //最多分享给群组的
        maxToG: 3
    };

    //创建讨论组好友状态
    var _disSelectedStatus = {
        total: 20,
        selected: [],
        tempSelected: [],
        tempUnSelected: [],
        selectedInfo: [],
        flag: false
    };

    var selectedTemp = [];

    var _disSelectedItems_d = {
        length: 0,
        data: {}
    };
    var _disTempSelectedItems_d = {
        length: 0,
        data: {}
    };

    var _disTempSelectedItemsR_d = {
        length: 0,
        data: {}
    };
    var tmp = {
        data: {},
        length: 0
    };
    var _disData; //记录创建讨论组的uin
    var selfSelectFlag = false;

    //创建的讨论组
    var disGroupArray = [];
    var disGroupArrayKey = [];

    // 支持的自定义分组
    // 普通的好友属于normal分组
    var sortThread = -100,
        indexThread = 100000;
    var _customGroup = {
        //最近分享
        'ls': { //modified by dorsy -> add Recent Share Group
            index: indexThread,
            sort: sortThread,
            key: 'ls',
            visible: 1,
            name: '最近发送'
        },
        //最近联系人
        'recent': {
            index: indexThread + 1,
            sort: sortThread + 1,
            key: 'recent',
            autoSort: 0,
            visible: 1,
            name: '最近联系人'
        },
        'group': {
            index: indexThread + 2,
            sort: sortThread + 2,
            key: 'group',
            visible: 1,
            name: '我的群'
        },
        'discu': {
            index: indexThread + 3,
            sort: sortThread + 3,
            key: 'discu',
            visible: 1,
            name: '我的讨论组'
        },
        'online': {
            index: indexThread + 4,
            sort: sortThread + 4,
            key: 'online',
            visible: 0,
            name: '在线好友'
        },
        'installed': {
            index: indexThread + 5,
            sort: sortThread + 5,
            visible: 0,
            key: 'installed',
            name: '已安装好友'
        },
        'notInstalled': {
            index: indexThread + 6,
            sort: sortThread + 6,
            visible: 0,
            key: 'notInstalled',
            name: '未安装好友'
        },
        'new': {
            index: indexThread + 7,
            sort: sortThread + 7,
            visible: 0,
            key: 'new',
            name: '新增用户'
        },
        'active': {
            index: indexThread + 8,
            sort: sortThread + 8,
            visible: 0,
            key: 'active',
            name: '活跃用户'
        },
        'lost': {
            index: indexThread + 9,
            sort: sortThread + 9,
            visible: 0,
            key: 'lost',
            name: '流失用户'
        }
    };
    var _customGroupArray = [];

    // 分享信息
    // type: '类型',
    // appId: 'appid',
    // msg: '分享内容',
    // getMsgLib: true, 是否需要拉取远程分享语库
    // title: '分享标题',
    // pushParam: 'pushParam App run参数',
    // shareBtnText: '按钮自定义',
    // qqBtnText: 'qq聊天窗按钮',
    // pic: '图片',
    // appPicSize: 1,  1(def)横方形 || 2正方形 || 3竖方形 3种规格
    // targetUrl: '调转url',
    // appInfo: 'app信息扩展项目'
    // customGroup: '自定义分组好友' online (def) || installed || notInstalled || new || active || lost
    // moreConfig: true, 是否可以配置除msg外其他参数
    // uinSetting: false, 是否可以显示传uin到分享组件
    // gridType: 'gridShare' 页面布局方式 gridShare (def) || gridInvite
    // infoTmpl: 'default' 主信息mainInfo渲染模版 default (def) || buddyList ||  aio(for aio info)
    // recBuddy: true 是否推荐好友
    // recBuddyVisible: 1 是否显示推荐好友
    // recBuddyWordTmpl: 'share' || 'invite' 分享提示信息模版 “您还可以选择多少个好友”
    // buddyTreeMarkname: 'markname_uin' || 'markname' 好友树昵称显示模式，昵称(uin)
    // vfcode：'验证码'
    // t: 校验值
    // linktype : url对应类型，用于抓取网页信息的cgi参数
    // iframe : 标志腾讯网、空间分享接入，嵌在iframe中
    // client ： 标志客户端介入（呱呱视频）
    // action\APPID 透传给cgi
    // noPic : 404页面控制不显示图片
    var _shareOption = {
        uin: '',
        uname: '',
        type: '1',
        appId: '',
        openId: '',
        url: '',
        msg: '',
        getMsgLib: false,
        title: '',
        summary: '',
        site: '',
        pushParam: '',
        shareBtnText: '发送',
        qqBtnText: '打开应用',
        pic: '',
        pics: '',
        appPicSize: 1,
        picUrl: '',
        targetUrl: '',
        cbmessage: '',
        flash: '',
        scale: false,
        iframe: false,
        client: false,
        commonClient: false,
        APPID: '',
        linktype: 0,
        appInfo: '',
        customGroup: [],
        moreConfig: true,
        uinSetting: false,
        gridType: 'gridShare',
        infoTmpl: 'default',
        recBuddy: true,
        recBuddyVisible: 1,
        recBuddyWordTmpl: 'share',
        // buddyTreeMarkname: 'markname_uin'
        buddyTreeMarkname: 'markname',
        vfcode: '',
        t: '',
        noPic: false
    };


    var shareto = {
        friend: [],
        group: [],
        discuss: []
    };

    // 事件 & 观察者
    var observer = {
        // 获取好友列表成功
        onRequestBuddyListSuccess: function (data) {
            if (data.retcode == 0) {
                // 获取校验值
                _shareOption.t = data.result.t;
                _buddyList = packageContext.parseBuddyList(data.result);
            } else {
                _buddyList = null;
                J.cookie.remove('skey', share.MAIN_DOMAIN);
                share.isPtLoggedIn = false;
                share.login.openLoginBox();
                location.reload(true);
                console.log('onRequestBuddyList error:' + data.retcode);
            }
            $E.notifyObservers(packageContext, 'GetBuddyListReady', data);

            $NET.reportIsdEnd('get_buddy_list');
        },

        // 获取已开通或已授权的第三方分享列表
        onOpenAccountSuccess: function (data) {
            if (data.retcode == 0) {
                for (var key in data.result) {
                    if (data.result.hasOwnProperty(key)) {
                        var value = data.result[key];
                        // 后台不再返回该项，为了兼容默认1
                        value[0].share_flag = 1;
                        _shareSettingMap[key].shareFlag = value[0].share_flag;
                        _shareSettingMap[key].validFlag = value[0].valid_flag;
                        if (_shareSettingMap[key].checked && !_shareSettingMap[key].validFlag) {
                            _shareSettingMap[key].checked = 0;
                        }
                    }
                }
            } else {

            }
            $E.notifyObservers(packageContext, 'GetOpenAccountSuccess', data);
            $NET.reportIsdEnd('get_open_account');
        },

        onRequestUserTypeSuccess: function (data) {
            $E.notifyObservers(packageContext, 'GetUserTypeSuccess', data);
        },

        // 获取站点信息成功
        onGetUrlInfoSuccess: function (data) {
            if (data.result.code == 0) {
                var images = data.image,
                    image = '';
                for (var i in images) {
                    if (images[i].oriurl && images[i].oriurl != 'http://') {
                        image = images[i].oriurl;
                        break;
                    }
                }
                if (image.split("|").length > 1) {
                    image = image.split("|")[0];
                }
                _shareOption.title = _shareOption.title == "" ? data.title : decodeURIComponent(_shareOption.title);
                _shareOption.pics = _shareOption.pics == "" ? decodeURIComponent(image) : decodeURIComponent(_shareOption.pics);
                _shareOption.summary = _shareOption.summary == "" ? data['abstract'] : decodeURIComponent(_shareOption.summary);
                _shareOption.flash = _shareOption.flash == "" ? decodeURIComponent(data.flash) : decodeURIComponent(_shareOption.flash);
                _shareOption.site = _shareOption.site == "" ? decodeURIComponent(data.site) : _shareOption.site;
                _shareOption.noPic = _shareOption.noPic;
            }
            // 404 page
            if (_shareOption.noPic == 'true') {
                _shareOption.pics = "";
            }
            $E.notifyObservers(packageContext, 'GetUrlInfoSuccess', data);
        },

        //获取用户昵称成功
        onGetUserNameSuccess: function (data) {
            if (data.retcode == 0) {
                _shareOption.uname = data.result.nick;
            }
            $E.notifyObservers(packageContext, 'GetUserNameSuccess', data);
        },

        //创建讨论组成功
        onCreateDisGroupSuccess: function (data) {
            if (data.retcode == 0) {
                var mlsName = [_shareOption.uname];
                for (var i = 0, n = _disData.uinArray.length; i < n; i++) {
                    mlsName.push(_buddyList.uinMap[_disData.uinArray[i]].nick);
                }

                var data = {
                    conf_id: data.result.discussid,
                    conf_name: _disData.name,
                    conf_seq: 3,
                    mls_name: mlsName.join(" ")
                };

                packageContext.addDisGroup(data);

                data.retcode = 0;
            } else {
            }

            $E.notifyObservers(packageContext, 'CreateDisGroupSuccess', data);
        }
    };


    // 初始化入口
    this.init = function () {
        console.log('share app model init');
        // 从cookie中获取uin
        _selfUin = $U.getSelfUin();
        //
        this.initShareSetting();
        // 解析分享配置项
        this.parseShareOption();
        $E.addObserver($NET, 'GetUrlInfoSuccess', observer.onGetUrlInfoSuccess);
        $E.addObserver($NET, 'GetUserNameSuccess', observer.onGetUserNameSuccess);
        $E.addObserver($NET, 'CreateDisGroupSuccess', observer.onCreateDisGroupSuccess);
    };

    // 初始化分享配置, 本地存储(最近分享到...), array to map
    this.initShareSetting = function () {
        // tomap
        J.array.forEach(_userSetting.share, function (item) {
            _shareSettingMap[item.id] = item;
        });

        this.checkHideWeibo();

    };

    this.checkHideWeibo = function () {
        var shareToWeibo = this.getAppParams().data.shareToWeibo;
        if (shareToWeibo === "0") {
            _userSetting.share[2].visible = 0;
        }
    };

    // 获取Model层分享配置
    this.getUserSetting = function () {
        return _userSetting;
    };

    // 根据分享shareId获取相关配置
    this.getShareSetting = function (shareId) {
        return _shareSettingMap[shareId] || {};
    };

    // 获取可见的分享终端
    this.getVisibleShare = function () {
        var visibleShare = this._filterBuddyInfo(_userSetting.share, 'visible', 1);

        //从cookie里读取 visibleShare="1,0"; qzone,wblog
        var localVisibleShare = J.cookie.get("visibleShare");
        var localVisibleShareMap = {};
        //空间内的分享隐藏“同步分享”icon
        if (localVisibleShare && !_shareOption.isFromQZ) {
            localVisibleShareMap.qzone = parseInt(localVisibleShare.substr(0, 1));
            localVisibleShareMap.wblog = parseInt(localVisibleShare.substr(2, 1));

            for (var i = 0; i < visibleShare.length; i++) {
                visibleShare[i].checked = localVisibleShareMap[visibleShare[i].id];
            }
        }

        return visibleShare;
    };

    // 拉取好友列表
    this.requestBuddyList = function (callback) {
        J.array.forEach(_customGroupArray, function (group) {
            switch (group.key) {
                case 'online':
                    option.show_stats = 1;
                    break;
                case 'installed':
                case 'notInstalled':
                    option.install = 1;
                    break;
                case 'new':
                    option['new'] = 1;
                    break;
                case 'active':
                    option.active = 1;
                    break;
                case 'lost':
                    option.lost = 1;
                    break;
                default:
                    break;
            }
        });

        $NET.getBuddyList({}, callback || observer.onRequestBuddyListSuccess);
    };

    //添加讨论组
    this.createDisGroup = function (data) {
        _disData = data; //信息留下

        $NET.createDisGroup(data);
    };

    //创建讨论组成功
    this.onCreateDisGroupOnView = function (data) {
        console.log("onCreateDisGroupOnView.......");

        var ulist = [];
        for (var i = 0, n = data.uinArray.length; i < n; i++) {
            ulist.push(
                data.uinArray[i]
            );
        }
        //ulist = J.json.stringify(ulist);

        var name = (data.name || "新建讨论组");
        var requestString = {
            name: name,
            ulist: ulist
        };

        _disData = data; //信息留下
        var mlsName = [_shareOption.uname];
        for (var i = 0, n = _disData.uinArray.length; i < n; i++) {
            mlsName.push(_buddyList.uinMap[_disData.uinArray[i]].nick);
        }

        var data = {
            conf_id: new Date().getTime(),
            conf_name: _disData.name,
            conf_seq: 3,
            mls_name: mlsName.join(" ")
        };

        packageContext.addDisGroup(data);

        data.retcode = 0;

        $E.notifyObservers(packageContext, 'CreateDisGroupSuccess', data);

        requestString.conf_id = data.conf_id;
        disGroupArray.push(requestString);
        disGroupArrayKey.push(data.conf_id);
    };

    //将讨论组数组转成后台接受的格式
    this.parseDisgroup = function () {
        var arr = disGroupArray;

        for (var i in arr) {
            arr[i].conf_id = undefined;
        }

        return arr;
    };


    //添加讨论组到原有列表
    this.addDisGroup = function (data) {
        /*
		 * {
		 * conf_id: 1111223,
		 * conf_name: "分享",
		 * conf_seq: 3,
		 * mls_name: "鸿 是"
		 * } */
        var item = data;
        // gid 内部号, code 群号
        var d = {
            uuid: 'd_' + item.conf_id,
            type: 2,
            uin: item.conf_id,
            nick: item.conf_name || '讨论组',
            extra: '成员:' + item.mls_name,
            avatar: 'https://pub.idqqimg.com/qconn/widget/shareqq/images/discu_avatar.gif'
        };
        _buddyList.list.push(d);
        _buddyList.uuidMap[d.uuid] = d;

        var index = _customGroup.discu.index;
        _buddyList.group[index].push(d);

    };

    // 获取好友列表资料
    this.getBuddyList = function () {
        if (!_buddyList) {
            this.requestBuddyList();
        } else {
            var data = {
                retcode: 0,
                result: _buddyList
            }
            $E.notifyObservers(packageContext, 'GetBuddyListReady', data);
        }
    };

    // 获取已开通或已授权的第三方分享终端
    this.getOpenAccount = function (callback) {
        var option = {
            scope: 'all'
        };
        $NET.getOpenAccount(option, callback || observer.onOpenAccountSuccess);
    };

    // 对分组好友进行排序
    this.sortGroupMembers = function (buddy) {
        buddy = J.array.bubbleSort(buddy, function (x, y) {
            var xname = String(x.markname || x.nick || x.uin),
                yname = String(y.markname || y.nick || y.uin);
            return xname.localeCompare(yname);
        });
        buddy = J.array.bubbleSort(buddy, function (x, y) {
            return x.online > y.online ? -1 : 1;
        });
        return buddy;
    };

    // 初始化好友列表数据
    this.parseBuddyList = function (data) {
        // 保留原来数据 recent 最近联系人 ls 最近分享人
        // {"retcode":0,"result":{"categories":[{"index":1,"sort":1,"name":"网友"},{"index":2,"sort":2,"name":"同学"}],"recent":[2607392264,598493625,17728164,396122224,],"groups":[{"flag":16777217,"name":".~朋友的朋友~.","gid":203374215,"code":1374215}],"info":[{"face":273,"flag":541254,"nick":"烟嘴","categories":1,"uin":1489181,"stat":0},{"face":558,"flag":8388608,"nick":"修改号","markname":"dddddddddddddd地ddddddd","categories":2,"uin":2607392264}]}}
        _buddyList = {};
        // _srcData 源数据
        // list 好友、群、讨论组数据合集
        // categories 所有分组
        // group {index:[{}]} 分组成员map
        // recent 推荐好友\群
        _buddyList._srcData = data;

        _buddyList.categories = [];
        _buddyList.list = [];
        _buddyList.group = {};
        _buddyList.recent = [];
        _buddyList.uuidMap = {};
        _buddyList.uinMap = {};

        _buddyList.categoryCount = {
            recentCount: {},
            lsCount: {}
        };

        // 初始化可能为空的字段
        data.info = data.info || [];
        data.categories = data.categories || [];
        data.groups = data.groups || [];
        data.discus = data.discus || [];
        data.recent = data.recent || [];
        data.ls = data.ls || [];

        // 缓存
        var _cacheGroupList = [],
            _cacheDiscuList = [],
            _cacheOnlineGroup = [];

        // 合并好友、群、讨论组到同个列表
        // 格式化、添加好友
        J.array.forEach(data.info, function (item) {
            // 添加头像
            item.avatar = $U.getAvatar(item.uin);
            item.uuid = 'b_' + item.uin; // 给好友添加前缀
            item.type = 0;

            // 在线状态
            // 10在线，20离线，30离开（是所有QQ版本都支持的状态）; 50忙碌、60Q我吧、70静音（有的客户端没有其中的一个或多个）)
            // if(J.array.indexOf([10, 30], item.stat) >= 0){
            //     item.online = 1;
            //     _cacheOnlineGroup.push(item);
            // }else{
            //     item.online = 0;
            // }
            // 暂不返回
            item.online = 0;
            // 冗余存储
            // 初始化分组map
            if (!_buddyList.group[item.categories]) {
                _buddyList.group[item.categories] = [];
            }
            _buddyList.group[item.categories].push(item);

            _buddyList.list.push(item);
            _buddyList.uinMap[item.uin] = item;
            _buddyList.uuidMap[item.uuid] = item;
        });
        // 添加群
        J.array.forEach(data.groups, function (item) {
            // gid 内部号, code 群号
            var g = {
                uuid: 'g_' + item.code,
                gid: item.gid,
                type: 1,
                uin: item.code,
                nick: item.name,
                markname: item.name,
                avatar: $U.getAvatar(item.code, 4)
            };
            _buddyList.list.push(g);
            _buddyList.uuidMap[g.uuid] = g;
            _cacheGroupList.push(g);
        });
        // 添加讨论组
        J.array.forEach(data.discus, function (item) {
            // gid 内部号, code 群号
            var d = {
                uuid: 'd_' + item.conf_id,
                type: 2,
                uin: item.conf_id,
                nick: item.conf_name || '讨论组',
                extra: '成员:' + item.mls_name,
                avatar: 'https://pub.idqqimg.com/qconn/widget/shareqq/images/discu_avatar.gif'
            };
            _buddyList.list.push(d);
            _buddyList.uuidMap[d.uuid] = d;
            _cacheDiscuList.push(d);
        });


        // 添加【我的好友】分组
        // 判断是否存在默认【我的好友】，重命名后会存在index=0的默认好友分组
        var frgroup = this._filterBuddyInfo(data.categories, 'index', 0)[0];
        if (!frgroup) {
            data.categories.push({
                index: 0,
                sort: 0,
                name: '我的好友'
            });
        }
        // 添加自定义分组
        data.categories = data.categories.concat(_customGroupArray);
        _buddyList.categories = data.categories;

        // 联系人分好友、群组
        var tmpArray1 = [],
            tmpArray2 = [],
            tmpArray3 = [],
            tmpArray4 = [];
        J.array.forEach(data.recent, function (obj) {
            if (obj.type == 0) {
                tmpArray1.push(obj);
                /*****客户端讨论组问题对应的修改****/
                /*else{*/
            } else if (obj.type == 1) {
                tmpArray2.push(obj);
            }
        });
        data.recent = tmpArray1.concat(tmpArray2);

        J.array.forEach(data.ls, function (obj) {
            if (obj.type == 0) {
                tmpArray3.push(obj);
                /*****客户端讨论组问题对应的修改****/
                /*else{*/
            } else if (obj.type == 1) {
                tmpArray4.push(obj);
            }
        });
        data.ls = tmpArray3.concat(tmpArray4);
        _buddyList.categoryCount.lsCount = {
            friend: tmpArray3.length,
            groupDiscuss: tmpArray4.length
        };

        // 冗余存储，列表分组map
        J.array.forEach(data.categories, function (cate) {
            // 默认好友分组归类为普通分组
            cate.key = cate.key || 'normal';
            cate.autoSort = J.isUndefined(cate.autoSort) ? false : cate.autoSort;

            var uinArray = [],
                buddy = [];

            if (cate.key == 'online') {
                buddy = _cacheOnlineGroup;
            } else if (cate.key == 'group') {
                buddy = _cacheGroupList;
            } else if (cate.key == 'discu') {
                buddy = _cacheDiscuList;
            } else if (cate.key == 'recent') {
                J.array.forEach(data.recent, function (obj) {
                    var b = _buddyList.uuidMap[packageContext.object2UUID(obj)];
                    b && buddy.push(b);
                });
            } else if (cate.key == 'ls') { //modified by dorsy -> add Recent Share Group
                J.array.forEach(data.ls, function (obj) {
                    var b = _buddyList.uuidMap[packageContext.object2UUID(obj)];
                    b && buddy.push(b);
                });
            } else {
                switch (cate.key) {
                    case 'installed':
                        uinArray = data.install || [];
                    case 'notInstalled':
                        uinArray = data.unuse || [];
                    case 'new':
                        uinArray = data['new'] || [];
                    case 'active':
                        uinArray = data.active || [];
                    case 'lost':
                        uinArray = data.lost || [];
                        break;
                    default:
                        break;
                }

                J.array.forEach(uinArray, function (rUin) {
                    var b = _buddyList.uinMap[rUin];
                    b && buddy.push(b);
                });
            }

            // 是否排序
            if (cate.autoSort) {
                buddy = packageContext.sortGroupMembers(buddy);
            }

            // 默认分组已经初始化过
            if (cate.key == 'normal') {
                // 容错
                if (!_buddyList.group[cate.index]) {
                    _buddyList.group[cate.index] = [];
                } else if (cate.autoSort) {
                    _buddyList.group[cate.index] = packageContext.sortGroupMembers(_buddyList.group[cate.index]);
                }
            } else {
                _buddyList.group[cate.index] = buddy;
            }
        });

        // 是否推荐最近联系人
        if (_shareOption.recBuddy) {
            // 合并最近分享人last share到最近联系人recent
            data.recent = data.ls.concat(data.recent);
            // 转化为uuid
            var _tmp = [];
            J.array.forEach(data.recent, function (item) {
                _tmp.push(packageContext.object2UUID(item));
            });
            // 去重
            _tmp = J.array.uniquelize(_tmp);
            // 补齐10个
            var tmpBuddyList = $U.randomize(_buddyList.list.concat([]), true);
            if (_tmp.length < _selectedStatus.total) {
                for (var i = 0, len = tmpBuddyList.length; i < len; i++) {
                    var buddy = tmpBuddyList[i];
                    if (_tmp.length < _selectedStatus.total) {
                        if (!J.array.contains(_tmp, buddy.uuid)) {
                            _tmp.push(buddy.uuid);
                        }
                    } else {
                        break;
                    }
                }
            }

            // uuid => object
            J.array.forEach(_tmp, function (uuid) {
                var b = _buddyList.uuidMap[uuid];
                b && _buddyList.recent.push(b);
            });
        } else {
            _selectedStatus.selected = [];
            _buddyList.recent = [];
        }

        return _buddyList;
    };

    //返回好友列表数据
    this.getMyBuddyList = function () {
        return _buddyList;
    };

    //设置最近联系人好友、群组数目
    this.setRecentCount = function (array) {
        var i = 0,
            j = 0;
        J.array.forEach(array, function (item) {
            if (item) {
                if (item.type == 0) {
                    i++;
                } else {
                    j++;
                }
            }
        });

        _buddyList.categoryCount.recentCount = {
            friend: i,
            groupDiscuss: j
        };
    };

    //返回联系人好友、群组数目
    this.getCategoryCount = function () {
        return _buddyList.categoryCount;
    };

    // 给好友列表信息添加nick,markname的拼音和拼音首字母,用于搜索
    this.parseBuddyPinyin = function () {
        console.log('parseBuddyPinyin');
        var pinyin;
        J.array.forEach(_buddyList.list, function (item) {
            if (item.nick) {
                pinyin = $U.pinyin.convertPYs(item.nick);
                // 拼音
                item.nickPinYin = pinyin[0];
                // 拼音首字母
                item.nickPinYinFL = pinyin[1];
            }
            if (item.markname) {
                pinyin = $U.pinyin.convertPYs(item.markname);
                // 拼音
                item.marknamePinYin = pinyin[0];
                // 拼音首字母
                item.marknamePinYinFL = pinyin[1];
            }
        });
    };

    // 根据uin返回好友资料
    this.getBuddyByUin = function (uin) {
        return this._filterBuddyInfo(_buddyList.list, 'uin', uin)[0];
    };

    // 根据uuid获取资料
    this.getInfoByUUID = function (uuid) {
        return this._filterBuddyInfo(_buddyList.list, 'uuid', uuid)[0];
    };

    // 获取所有好友分组
    this.getAllGroup = function () {
        var groups = [];
        J.array.forEach(_buddyList.categories, function (cate) {
            if (_buddyList.group[cate.index].length > 0) {
                groups.push(cate);
            }
        });
        return J.array.bubbleSort(groups, function (v1, v2) {
            return v1.sort - v2.sort;
        });
    };

    // 获取非群、讨论组好友分组
    this.getBuddyGroup = function () {
        var groups = [],
            _this = this;
        J.array.forEach(_buddyList.categories, function (cate) {

            if (cate.key == "ls" || cate.key == "recent") {
                var users_d = _this.getGroupBuddy(cate.index),
                    count = 0;

                for (var i = 0, n = users_d.length; i < n; i++) {
                    if (users_d[i].type == 0) {
                        count++;
                    }
                }
                if (count > 0) groups.push(cate);
            }
            if (cate.key == 'normal' && _buddyList.group[cate.index].length > 0) {
                groups.push(cate);
            }
        });
        return J.array.bubbleSort(groups, function (v1, v2) {
            return v1.sort - v2.sort;
        });
    };

    // 获取指定好友分组
    this.getGroup = function (groupIndex) {
        var g = J.array.filter(_buddyList.categories, function (v, index, array) {
            if (!J.isUndefined(v['index']) && v['index'] == groupIndex) {
                return true;
            } else {
                return false;
            }
        });
        return g[0];
    };

    // 解析自定义好友分组
    this.parseCustomGroups = function () {
        _customGroupArray = [];
        J.array.forEach(_shareOption.customGroup, function (gKey) {
            var group = _customGroup[gKey];
            if (group) {
                group.visible = 1;
                _customGroupArray.push(group);
            }
        });
        return _customGroupArray;
    };

    // 获取最近联系人/分享人列表
    this.getRencentBuddy = function () {
        var N = 2,
            M = 1,
            _this = this;
        var buddyArr = [],
            groupArr = [];
        J.array.forEach(_buddyList.recent, function (item) {
            if (item.type == 0 && buddyArr.length < N) {
                buddyArr.push(item);
                _this.addSelected(item.uuid);
            }

            if (item.type != 0 && groupArr.length < M) {
                groupArr.push(item);
                _this.addSelected(item.uuid);
            }
        });

        return buddyArr.concat(groupArr);
    };

    // 根据分组id获取分组下所有好友信息list
    this.getGroupBuddy = function (groupIndex) {
        return _buddyList.group[groupIndex];
    };

    //过滤 只剩普通好友
    this.getGroupBuddyNormal = function (groupIndex) {
        var users_d = _buddyList.group[groupIndex];
        var users = [];

        for (var i = 0, n = users_d.length; i < n; i++) {
            if (users_d[i].type == 0) {
                users.push(users_d[i]);
            }
        }

        return users;
    };

    // 获取所有好友资料list
    this.getBuddy = function () {
        return _buddyList.list;
    };

    /**
     * 过滤工具函数
     * @param  {Array} buddyList Object数组
     * @param  {String} key       需要过滤Object Key
     * @param  {Mixed} value     对应Key的Value
     * @return {Array}           配置的列表
     */
    this._filterBuddyInfo = function (buddyList, key, value) {
        return J.array.filter(buddyList, function (v, index, array) {
            if (!J.isUndefined(v[key]) && v[key] == value) {
                return true;
            } else {
                return false;
            }
        });
    };

    // 添加uin到分享好友列表
    // 添加uin到分享好友列表
    this.addSelected = function (uin, isCreateDisClick) {
        if (isCreateDisClick && !this.isSelected(uin)) {
            selectedTemp.push(uin);
        }
        if (!this.isSelected(uin)) {
            _selectedStatus.selected.push(uin);
            var obj = {
                'action': 'add',
                'uin': uin,
                'selected': _selectedStatus.selected
            };
            $E.notifyObservers(packageContext, 'uinSelectedChanged', obj);
        }
    };
    this.sortSelected = function () {
        var selectedUins = _selectedStatus.selected;
        for (var i = 0; i < selectedUins.length; i++) {
            for (var j = 0; j < selectedTemp.length; j++) {
                if (selectedUins[i] == selectedTemp[j]) {
                    J.array.remove(selectedUins, selectedUins[i]);
                }
                ;
            }
        }

        _selectedStatus.selected = selectedUins.concat(selectedTemp);
    };


    //----------start 创建讨论组逻辑-----------

    var ctrlFlag = 0,
        shiftFlag = 0;
    J.event.on($D.id('disGroup'), "selectstart", function (e) {
        window.event.returnValue = false;
        e.preventDefault();
        return false;
    });
    J.event.on(document.body, "keydown", function (e) {
        if (e.keyCode == 17) {
            ctrlFlag = 1;
        }
        if (e.keyCode == 16) {
            //window.event.returnValue = false;
            e.preventDefault();
            shiftFlag = 1;
            return false;
        }
    });

    J.event.on(document.body, "keyup", function (e) {
        if (e.keyCode == 17) {
            ctrlFlag = 0;
        }
        if (e.keyCode == 16) {
            //window.event.returnValue = false;
            e.preventDefault();
            shiftFlag = 0;
            return false;
        }
    });

    //双击执行动作
    this.addTempDisSelectedFromDBL_d = function (uin, target) {
        var tmpSelected = _disTempSelectedItems_d; //默认取到左边选中态信息
        var rightFlag = 0; //标记是否右边双击

        //检查是否来源自右边
        if (target.parentNode.parentNode.className == "right") {
            var tmpSelected = _disTempSelectedItemsR_d;
            rightFlag = 1;
        }

        //双击则将之前所有选中的全部清除掉
        for (var i in tmpSelected.data) {
            this.removeCurrentBg_d(tmpSelected.data[i]);
        }

        //将选中态信息更新成一个
        tmpSelected.length = 1;
        tmpSelected.data = {};
        tmpSelected.data[uin] = target;

        //添加本元素选中态背景
        this.addCurrentBg_d(target);

        //根据来源不同选择不同的动作: 添加 或 移除
        if (rightFlag) {
            this.removeDisItems_d();
        } else {
            if (_disSelectedItems_d.data[uin]) return; //如果 添加的联系人中已有本人，则不执行添加动作

            this.addDisItems_d();
        }
    };

    //添加选中态，而不添加联系人
    this.addTempDisSelected_d = function (uin, target) {

        //默认来源左边的信息
        var tmpSelected = _disTempSelectedItems_d;

        //检查来源,更改默认信息
        if (target.parentNode.parentNode.className == "right") {
            var tmpSelected = _disTempSelectedItemsR_d;
        }

        //如果 选中态的联系人中不存在此人
        if (!tmpSelected.data[uin]) {
            var tmpp = {
                data: {},
                length: 0
            };

            //如果ctrl被按下,则选中态的信息中添加此人
            if (ctrlFlag) {
                tmpSelected.data[uin] = target;
                tmpSelected.length++;
                this.addCurrentBg_d(target);
                //如果shift被按下,则将所选信息放入tmpp中
            } else if (shiftFlag) {
                var tempSelectedBuddy = [];
                var nodesArray = [];
                var _this = this;

                tmp.data[uin] = target;
                tmp.length++;

                for (var i in tmp.data) {
                    if (tmp.data.hasOwnProperty(i)) {
                        tempSelectedBuddy.push(tmp.data[i]);
                    }
                    ;
                }
                if (target.id == 'selfItem') {
                    selfSelectFlag = true;
                    target = $D.mini('.buddyItem', $D.id('right'))[1];
                } else if (tempSelectedBuddy[0].id == 'selfItem') {
                    selfSelectFlag = true;
                    tempSelectedBuddy[0] = $D.mini('.buddyItem', $D.id('right'))[1];
                } else if (selfSelectFlag) {
                    this.removeCurrentBg_d($D.id('selfItem'));
                    selfSelectFlag = false;
                }

                var nodes = target.parentNode.childNodes;
                for (var i = 0; i < nodes.length; i++) {
                    if (nodes[i].id) {
                        nodesArray.push(nodes[i]);
                    }
                }

                var selectIndex = $A.indexOf(nodesArray, tempSelectedBuddy.pop()),
                    preSelectIndex = $A.indexOf(nodesArray, tempSelectedBuddy[0]);

                var isBack = selectIndex - preSelectIndex > 0 ? true : false;

                if (isBack) { //正向
                    for (var i = preSelectIndex; i <= selectIndex; i++) {
                        if (nodesArray && nodesArray[i].id.substring(0, 15) == 'r_listBuddy_ls_' || nodesArray[i].id.substring(0, 13) == 'listBuddy_ls_') {
                            var uin = target.parentNode.parentNode.className == "right" ? nodesArray[i].id.substring(15) : nodesArray[i].id.substring(13);
                        } else {
                            var uin = target.parentNode.parentNode.className == "right" ? nodesArray[i].id.substring(19) : nodesArray[i].id.substring(17);
                        }

                        tmpp.data[uin] = nodesArray[i];
                        tmpp.length++;
                    }
                } else {
                    for (var i = selectIndex; i <= preSelectIndex; i++) {
                        if (nodesArray[i].id.substring(0, 15) == 'r_listBuddy_ls_' || nodesArray[i].id.substring(0, 13) == 'listBuddy_ls_') {
                            var uin = target.parentNode.parentNode.className == "right" ? nodesArray[i].id.substring(15) : nodesArray[i].id.substring(13);
                        } else {
                            var uin = target.parentNode.parentNode.className == "right" ? nodesArray[i].id.substring(19) : nodesArray[i].id.substring(17);
                        }
                        tmpp.data[uin] = nodesArray[i];
                        tmpp.length++;
                    }
                }

                //否则清除之前的选中态中联系人全部联系人，再添加此人
            } else {
                for (var i in tmpSelected.data) {
                    this.removeCurrentBg_d(tmpSelected.data[i]);
                }

                //去除选中态
                if (selfSelectFlag) {
                    this.removeCurrentBg_d($D.id('selfItem'));
                    selfSelectFlag = false;
                }

                tmpSelected.length = 1;
                tmpSelected.data = {};
                tmpSelected.data[uin] = target;

                tmp.length = 1;
                tmp.data = {};
                tmp.data[uin] = target;

                if (!$U.testIpad) {
                    this.addCurrentBg_d(target);
                }

                if ($U.testIpad && target.parentNode.parentNode.className == "buddyTree") {
                    this.addDisItems_d();
                } else if ($U.testIpad && target.parentNode.parentNode.className == "right") {
                    this.removeDisItems_d();
                }
            }

            //如果选中态中已有此人，再次被单击
        } else {
            //ctrl被按下时，检查已被选中的长度,长度为1则不执行动作，否则，去除此人
            if (ctrlFlag) {
                if (tmpSelected.data[uin] != target) { //ctrl 下点了重复的，不同节点,不执行动作
                    //this.addCurrentBg_d(target);
                } else {
                    if (tmpSelected.length == 1) {
                    } else {
                        delete tmpSelected.data[uin];
                        tmpSelected.length--;
                        this.removeCurrentBg_d(target); //去除view
                    }
                }

                //ctrl没有，则可能的情况是已被多选，单击被选的其中一人，结果是只选中此人
            } else {
                //清除之前所有选中的人
                for (var i in tmpSelected.data) {
                    this.removeCurrentBg_d(tmpSelected.data[i]);
                }

                //去除选中态
                if (selfSelectFlag) {
                    this.removeCurrentBg_d($D.id('selfItem'));
                    selfSelectFlag = false;
                }
                //添加此人
                tmpSelected.length = 1;
                tmpSelected.data = {};
                tmpSelected.data[uin] = target;

                if (!$U.testIpad) {
                    this.addCurrentBg_d(target);
                }

                if ($U.testIpad && target.parentNode.parentNode.className == "buddyTree") {
                    this.addDisItems_d();
                } else if ($U.testIpad && target.parentNode.parentNode.className == "right") {
                    this.removeDisItems_d();
                }
            }
        }

        if (tmpp && tmpp.length) {
            for (var i in tmpSelected.data) {
                this.removeCurrentBg_d(tmpSelected.data[i]);
            }
            if (selfSelectFlag) {
                this.addCurrentBg_d($D.id('selfItem'));
            }
            tmpSelected.data = {};
            for (var i in tmpp.data) {
                tmpSelected.data[i] = tmpp.data[i];
                tmpSelected.length++;
                this.addCurrentBg_d(tmpp.data[i]);
            }
        }

        //检查添加、移除按钮的状态
        this.checkAdd_d();
        this.checkDel_d();
    };

    //添加联系人
    this.addDisItems_d = function () {
        //将左边选中态的信息添加到选中的联系人变量中
        for (var i in _disTempSelectedItems_d.data) {

            //如果人数已经最大，提示，并break循环
            if (_disSelectedItems_d.length == 19) {
                var option = {
                    text: '人数已达到最大',
                    type: 'error'
                };
                share.view.showInfoTips(option);
                break;
            }

            //如果选中的联系人中已有此人，不执行任何动作
            if (_disSelectedItems_d.data[i]) {

                //否则添加此人
            } else {

                var item = _disTempSelectedItems_d.data[i];
                var node = item.cloneNode();
                node.innerHTML = item.innerHTML;
                node.id = "r_" + node.id;
                node.style.background = "none";
                node.setAttribute("style", "");
                this.removeCurrentBg_d(node);

                //添加进选中联系人变量中
                _disSelectedItems_d.data[i] = node;
                _disSelectedItems_d.length++;
                this.addItemView_d(node);
            }

        }

        //更新计数
        share.view.updateCount_d(_disSelectedItems_d.length);
        J.dom.addClass(J.dom.id("addDisBtn"), "addDisAbled");

        //去除选中态
        var tmpSelected = _disTempSelectedItems_d;
        for (var i in tmpSelected.data) {
            this.removeCurrentBg_d(tmpSelected.data[i]);
        }
        tmpSelected.length = 1;
        tmpSelected.data = {};

        //检查状态
        this.checkAdd_d();
        this.checkDel_d();
    };

    //从右边的选中态中移除联系人
    this.removeDisItems_d = function () {
        var selfInFlag = 0,
            selfTarget; //标记自己

        for (var i in _disTempSelectedItemsR_d.data) {
            //选中态是自己  continue
            if (i == "self") {
                selfInFlag = 1;
                selfTarget = _disTempSelectedItemsR_d.data[i];
                continue;
            }
            //从选中的联系人变量中移除此人
            if (_disSelectedItems_d.data[i]) {
                this.removeItemView_d(_disSelectedItems_d.data[i]);
                delete _disSelectedItems_d.data[i];
                _disSelectedItems_d.length--;
            } else {
            }
        }
        //更新右边的选中态信息
        _disTempSelectedItemsR_d = {
            length: 0,
            data: {}
        };

        if (selfInFlag) {
            _disTempSelectedItemsR_d = {
                length: 1,
                data: {
                    self: selfTarget
                }
            };
        }

        //去除选中态
        if (selfSelectFlag) {
            this.removeCurrentBg_d($D.id('selfItem'));
            selfSelectFlag = false;
        }


        //更新状态
        share.view.updateCount_d(_disSelectedItems_d.length);
        this.checkAdd_d();
        this.checkDel_d();
    };

    //检查添加按钮是否可用
    this.checkAdd_d = function () {
        //初始化按钮 为不用
        J.dom.addClass(J.dom.id("addDisBtn"), "addDisAbled");
        J.dom.id("addDisBtn").setAttribute("cmd", "");

        //出现可用点 更新为可用

        //长度最大，不检查可用点
        if (this.getSelectedLength_d() == 19) return;

        for (var i in _disTempSelectedItems_d.data) {
            //与选中的联系人中的信息对比,一旦出现可用点，更新为可用,break循环
            if (!_disSelectedItems_d.data[i]) {
                J.dom.removeClass(J.dom.id("addDisBtn"), "addDisAbled");
                J.dom.id("addDisBtn").setAttribute("cmd", "addDisBtnClick");
                break;
            }
        }
    };

    //检查移除按钮是否可用
    this.checkDel_d = function () {
        //初始化按钮 为不用
        J.dom.addClass(J.dom.id("delDisBtn"), "addDisAbled");
        J.dom.id("delDisBtn").setAttribute("cmd", "");

        //出现可用点 更新为可用
        for (var i in _disTempSelectedItemsR_d.data) {

            //一旦选中态中的出现不是自己的，可用，更新，break
            if (i != "self") {
                J.dom.removeClass(J.dom.id("delDisBtn"), "addDisAbled");
                J.dom.id("delDisBtn").setAttribute("cmd", "delDisBtnClick");
                break;
            }
        }
    };

    this.checkButtonStatus_d = function (type) {
        if (type == "add") {
            return J.dom.id("addDisBtn").className.indexOf("addDisAbled") > -1;
        } else if (type == "del") {
            return J.dom.id("delDisBtn").className.indexOf("addDisAbled") > -1;
        }
    }

    //添加背景
    this.addCurrentBg_d = function (target) {
        J.dom.addClass(target, "buddyItemClick");
    };

    this.removeCurrentBg_d = function (target) {
        J.dom.removeClass(target, "buddyItemClick");
    };

    this.removeCurrentBgAll_d = function (target) {
        for (var i in target.data) {
            this.removeCurrentBg_d(target.data[i]);
        }
    };

    this.addItemView_d = function (item) {
        J.dom.id("disSelectedBuddyTree").appendChild(item);
        var moveFlag = 0;
        item.onmouseover = function () {
            if ($U.testIpad) return;
            this.style.background = "rgb(48,178,228)";
        };

        item.onmouseout = function () {
            if ($U.testIpad) return;
            this.style.background = "none";
        };

    };

    this.removeItemView_d = function (item) {
        J.dom.id("disSelectedBuddyTree").removeChild(item);
    };

    this.removeItemViewAll_d = function (target) {
        for (var i in target.data) {
            this.removeItemView_d(target.data[i]);
        }
    }

    this.getSelectedLength_d = function () {
        return _disSelectedItems_d.length;
    };


    this.getSelectedItems_d = function () {
        var selected = [];
        for (var i in _disSelectedItems_d.data) {
            selected.push(+i.replace("b_", ""));
        }
        return selected;
    };

    this.initDisGroup = function () {
        this.removeCurrentBgAll_d(_disTempSelectedItems_d);
        this.removeCurrentBgAll_d(_disTempSelectedItemsR_d);
        this.removeItemViewAll_d(_disSelectedItems_d);

        _disTempSelectedItems_d = {
            length: 0,
            data: {}
        };

        _disTempSelectedItemsR_d = {
            length: 0,
            data: {}
        };

        _disSelectedItems_d = {
            length: 0,
            data: {}
        };
        share.view.updateCount_d(_disSelectedItems_d.length);
    };

    //----------end 创建讨论组逻辑-----------


    // 从分享好友列表移除uin
    this.removeSelected = function (uin) {

        for (var i in disGroupArray) {
            if ("d_" + disGroupArray[i].conf_id == uin) {
                J.array.remove(disGroupArray, disGroupArray[i]);
                J.array.remove(disGroupArrayKey, disGroupArrayKey[i]);
            }
        }


        if (this.isSelected(uin)) {
            J.array.remove(_selectedStatus.selected, uin);
            J.array.remove(selectedTemp, uin);
            var obj = {
                'action': 'remove',
                'uin': uin,
                'selected': _selectedStatus.selected
            };
            $E.notifyObservers(packageContext, 'uinSelectedChanged', obj);
        }
    };

    // uin是否在分享列表
    this.isSelected = function (uin) {
        return J.array.indexOf(_selectedStatus.selected, uin) >= 0 ? true : false;
    };


    // 获取分享QQ好友配置, 同时分享好友数, 选择uin列表等
    this.getSelectedStatus = function () {
        return _selectedStatus;
    };

    // 获取选中的QQ好友uin, return int array
    this.getSelected = function () {
        return _selectedStatus.selected;
    };

    // 获取选中的类别数目
    this.getSelectedNum = function (type) {
        var pre = "b",
            count = 0;

        if (type == "group") {
            pre = "g";
        } else if (type == "disGroup") {
            pre = "d";
        }

        var typeReg = new RegExp("^" + pre + "_");
        J.array.forEach(_selectedStatus.selected, function (item) {
            if (typeReg.test(item)) {
                count++;
            }
        });

        return count;
    };

    // 获取uin的type
    this.getUinType = function (uin) {
        var typeReg = /^([bgd])_\d+/;
        var pre = typeReg.exec(uin)[1] || "";

        if (pre == "g") {
            return "group";
        } else if (pre == "d") {
            return "disGroup";
        } else {
            return "buddy";
        }
    };

    // 获取popup参数
    this.getAppParams = function () {
        return _appParam;
    };

    /**
     * 搜索好友列表
     * @param  {String} keyword 关键字
     * @param  {Number} num     返回最大个数
     * @return {Array}         好友列表数组
     */
    this.searchBuddy = function (keyword, num) {
        keyword = String(keyword).toLowerCase();
        num = num || 50;
        var searchResult = [];
        var searchResultFistClass = [];
        var buddyList = _buddyList.list;
        if (keyword.length > 0) {
            for (var i = 0; i < buddyList.length; i++) {
                var buddy = buddyList[i];

                if ((String(buddy.nick).toLowerCase().indexOf(keyword) > -1 && String(buddy.nick) != "undefined") ||
                    (String(buddy.markname).toLowerCase().indexOf(keyword) > -1 && String(buddy.markname) != "undefined") ||
                    (0 && String(buddy.uin).toLowerCase().indexOf(keyword) > -1 && String(buddy.uin) != "undefined") ||
                    (String(buddy.nickPinYin).toLowerCase().indexOf(keyword) > -1 && String(buddy.nickPinYin) != "undefined") ||
                    (String(buddy.nickPinYinFL).toLowerCase().indexOf(keyword) > -1 && String(buddy.nickPinYinFL) != "undefined") ||
                    (String(buddy.marknamePinYin).toLowerCase().indexOf(keyword) > -1 && String(buddy.marknamePinYin) != "undefined") ||
                    (String(buddy.marknamePinYinFL).toLowerCase().indexOf(keyword) > -1 && String(buddy.marknamePinYinFL) != "undefined")
                ) {
                    if (J.array.contains(_selectedStatus.selected, buddy.uin)) {
                        buddy.isSelected = true;
                    } else {
                        buddy.isSelected = false;
                    }

                    if (String(buddy.nick).toLowerCase() == keyword || String(buddy.markname).toLowerCase() == keyword) {
                        searchResultFistClass.push(buddy);
                    } else {
                        searchResult.push(buddy);
                    }
                }
                if (searchResult.length + searchResultFistClass.length >= num) {
                    break;
                }
            }
        }
        Array.prototype.push.apply(searchResultFistClass, searchResult);
        return searchResultFistClass;
    };

    // 选中分享第三方终端
    this.getCheckShareItem = function () {
        return J.array.filter(_userSetting.share, function (item) {
            return item.checked == 1 && item.validFlag == 1;
        });
    };

    // 判断shareId的第三方分享终端是否选中
    this.isShareItemChecked = function (shareId) {
        return _shareSettingMap[shareId].visible && _shareSettingMap[shareId].checked;
    };

    /**
     * 根据channel通道Id获取所有通过这个channel分享的第三方分享终端
     * @param  {String} channelId     通道id
     * @param  {Boolean} onlyErrorDest 是否只返回分享有误的终端
     * @return {Array}               终端数据,如['qzone', 'wblog']
     */
    this.getChannelDest = function (channelId, onlyErrorDest) {
        var rs = [];
        var shareItem = this.getCheckShareItem();
        J.array.forEach(shareItem, function (item) {
            if (item.channel == channelId) {
                if (item.checked) {
                    //部分重新同步分享
                    //onlyErrorDest && item.id != onlyErrorDest && onlyErrorDest != 'qq'  ：  qzone或微博出错，qzone,qq出错，微博qq出错
                    //!onlyErrorDest 第一次分享或者qzone,微博失败，QQ成功
                    //onlyErrorDest && onlyErrorDest == 'qq' && item.id == 'qq' ： qzone,微博返回正常，分享到QQ出错
                    if (onlyErrorDest && item.id != onlyErrorDest && onlyErrorDest != 'qq' || !onlyErrorDest || onlyErrorDest && onlyErrorDest == 'qq' && item.id == 'qq') {
                        rs.push(item.id);
                    }
                }
            }
        });
        return rs;
    };

    // 根据分享模式初始化分享配置项
    this.parseShareOption = function () {
        var params = this.getAppParams();
        _shareOption.appId = appId;
        _shareOption.type = 5; // 'url'
        _shareOption.msg = params.data.msg || _shareOption.msg;
        _shareOption.site = params.data.site || _shareOption.site;
        _shareOption.callback = params.data.callback || _shareOption.callback;
        _shareOption.title = params.data.title || _shareOption.title;
        _shareOption.summary = params.data.summary || _shareOption.summary;
        _shareOption.url = params.data.url || _shareOption.url;
        _shareOption.pics = params.data.pics.split("|")[0] || _shareOption.pics;
        _shareOption.flash = params.data.flash || _shareOption.flash
        _shareOption.iframe = params.data.iframe || _shareOption.iframe;
        _shareOption.client = params.data.client || _shareOption.client;
        _shareOption.scale = params.data.scale || _shareOption.scale;
        _shareOption.APPID = params.data.APPID || _shareOption.APPID;
        _shareOption.linktype = params.data.linktype || _shareOption.linktype;
        _shareOption.isFromQZ = params.data.isFromQZ || _shareOption.isFromQZ;
        _shareOption.commonClient = params.data.commonClient || _shareOption.commonClient;
        _shareOption.customGroup = ['ls', 'recent', 'group', 'discu']; //modified by dorsy -> add Recent Share Group
        _shareOption.album = params.data.album || _shareOption.album;
        _shareOption.singer = params.data.singer || _shareOption.singer;
        _shareOption.appid = params.data.appid || _shareOption.appid;
        _shareOption.msg_type = params.data.msg_type || _shareOption.msg_type;

        //17.12.25 增加postMessage方式的回调 wendycheng
        _shareOption.cbmessage = params.data.cbmessage || _shareOption.cbmessage;

        // 404 page
        _shareOption.noPic = params.data.noPic || _shareOption.noPic;
        if (_shareOption.noPic) {
            _shareOption.pics = "";
        }
        // 准备自定义好友分组数组
        packageContext.parseCustomGroups();
    };

    // 获取分享配置
    this.getShareOption = function () {
        return _shareOption;
    };

    // 获取分享终端配置map
    this.getShareSettingMap = function () {
        return _shareSettingMap;
    };

    // 更新分享信息内容
    this.updateShareMsg = function (msg) {
        _shareOption.msg = msg;
    };

    //设置验证码内容
    this.setVfCode = function (code) {
        _shareOption.vfcode = code;
    };

    //获取校验值
    this.getTCode = function () {
        return _shareOption.t;
    };

    // 设置app运行参数
    this.setAppParam = function (params) {
        _appParam = params;
    };

    // 获取站点信息
    this.getUrlInfo = function (url) {
        url = url || _shareOption.url;
        var linktype = _shareOption.linktype || 13;
        $NET.requestUrlInfo(url, linktype);
    };

    // 获取用户昵称
    this.getUserName = function () {
        $NET.requestUserName();
    };

    //获取用户是否分享过，否--》展示新手引导
    this.getUserType = function () {
        $NET.requestUserType(observer.onRequestUserTypeSuccess);
    };

    // 重置模型
    this.resetData = function () {
        _selectedStatus.selected = [];
        _selectedStatus.selectedInfo = [];
        _buddyList = null;
    };

    //设置分享人uin
    this.setSelectedUins = function (uins) {
        _selectedStatus.selectedUins = uins;
    }

    this.getSelectedUins = function () {
        return _selectedStatus.selectedUins;
    }

    // 获取
    this.getShareUins = function () {
        var uins = [],
            u;
        J.array.forEach(_selectedStatus.selected, function (uuid) {
            uins.push(packageContext.uuid2Object(uuid));
        });
        return uins;
    };

    this.setSharetoOption = function (data) {
        var uins = data.list[0].data.result.uins;

        _selectedStatus.selectedUins = uins;
        for (var i = 0; i < uins.length; i++) {
            if (uins[i].type == '1') {
                var uuid = _selectedStatus.selected[i];
                _selectedStatus.selectedUins[i] = {
                    id: _buddyList.uuidMap[uuid].gid,
                    type: 1
                }
            }
        }

        J.array.forEach(uins, function (item) {
            if (item.type === 0) {
                shareto.friend.push(item.id);
            } else if (item.type === 2) {
                shareto.discuss.push(item.id);
            }
        });
        J.array.forEach(_selectedStatus.selected, function (uuid) {
            if (packageContext.getUuidType(uuid) === 'g') {
                shareto.group.push(_buddyList.uuidMap[uuid].gid);
            }
        });
    }

    // 获取分享的uin
    this.getSharetoOption = function () {
        return shareto;
    };

    //获取创建的临时讨论组key
    this.getdisGroupArrayKey = function () {
        return disGroupArrayKey;
    }

    //获取cookie中uin
    this.getFromUin = function () {
        var selfUin = J.cookie.get('uin').replace(/^[o0]+/i, '');
        return selfUin;
    }

    // 映射表
    var TYPE_MAP_NUM = {
        b: 0,
        g: 1,
        d: 2
    };
    var TYPE_MAP_LETTER = {
        0: 'b',
        1: 'g',
        2: 'd'
    };

    this.getUuidType = function (uuid) {
        var uArray = uuid.split('_');
        var type = uArray[0];
        return type;
    };

    //
    this.uuid2Object = function (uuid) {
        var uArray = uuid.split('_');
        var type = uArray[0],
            uin = parseInt(uArray[1]);
        var obj = {
            type: TYPE_MAP_NUM[type],
            id: uin
        };
        return obj;
    };

    // 把最近分享人 {type:0,id:'***'} 转化为 uuid
    this.object2UUID = function (obj) {
        var type = obj.type;
        return TYPE_MAP_LETTER[type] + '_' + (obj.id || obj.uin);
    };

    this.setQQCollect = function (status) {
        _shareOption.qqCollect = status;
    }

});
/**
 * author rehorn
 * share components for q+ vm
 * 2012-04-16
 */

;
Jx().$package('share.view', function (J) {
    var packageContext = this,
        $ = J.dom.mini,
        $P = J.localStorage,
        $D = J.dom,
        $E = J.event,
        $S = J.string,
        $B = J.browser,
        $M = share.model,
        $U = share.utils,
        $API = share.api,
        $V = share.ui;
    $NET = share.net;
    // 遮罩, dom命名空间, 模版命名空间, ui状态命名空间, 初始化并发进程, 分享并发进程
    var masker, el = {},
        tpl = {},
        uiStatus = {},
        initProcess, shareProcess, timeCounter, _tmpMsg, shareTime;
    // loading
    var loadCssHtml = '<div class="loading_css3"></div>';
    // 分享配置
    var userSetting = $M.getUserSetting(),
        shareCom = userSetting.share,
        shareComMap = $M.getShareSettingMap(),
        groupListCom = userSetting.groupList,
        shareOption = $M.getShareOption();
    // keycode
    var KEY_LEFT = 37,
        KEY_UP = 38,
        KEY_RIGHT = 39,
        KEY_DOWN = 40,
        KEY_ENTER = 13,
        KEY_CTRL = 17,
        KEY_SHIFT = 16;

    var STYPE = $M.STYPE;

    // 失败错误码
    var BUDDY_ERRORMAP = {
        1: '失败'
    };

    var BUDDY_ERRORMAP_SHARE = {
        6: '内容中含敏感词，请重新输入',
        8: '超时，请检查网络后重试'

    };

    // 分享数据上报
    var REPORT_SHARE = {
        PAGE_LOAD: 30907,
        ERROR_TIP: 30680,
        ERROR_TIP_TRY: 30681,
        ERROR_TIP_CLOSE: 30682,
        BUDDYLIST_CLICK: 30679,
        BUDDY_SEARCH: 30678,
        BUDDY_MORE: 30677,
        BUDDY_CHECKALL: 30675,
        BUDDY_UNCHECKALL: 30676,
        SHARE_TO_BUDDY: 30674,
        WINDOW_CLOSE: 30673,
        SHARE_BTN: 30672,
        MSG_TEXTAREA: 30671,
        SHARE_TO_SINA: 30670,
        SHARE_TO_QZONE: 30669,
        SHARE_TO_WBLOG: 30668
    };

    // 数据上报
    var REPORT_T = REPORT_SHARE;

    // 上报action
    var trackName = 'share';

    // 默认输入框提示语
    var DEFAULT_MSG_TIP = '加点评论吧...';

    //讨论组标识
    var isRenderDisgroup = false;
    var isSendSuccess = false;
    var isSendError = false;


    //标记touchMove 事件
    var touchMoveFlag = 0;

    //标记创建讨论组
    var isCreateDisClick = false;

    // 事件 & 观察者
    var observer = {
        // 获取授权第三方分享终端
        onGetOpenAccountSuccess: function (data) {
            console.log('onGetOpenAccountSuccess');
            if (data.retcode == 0) {
                packageContext.renderShareCom();
                // initProcess.success('getOpenAccount', data);
            } else {
                // initProcess.error('getOpenAccount', data);
            }
        },

        // 获取好友列表成功
        onGetBuddyListReady: function (data) {
            console.log('onGetBuddyListReady');
            //mta上报：拉取用户列表；耗时字段：登录成功后跳转到分享页面，拉取页面左侧用户列表请求开始到结束的耗时
            mtaReport.setEndTime();
            mtaReport.report("ShareQQUserList", {
                Time: mtaReport.getInterval(),
                Ext1: data.retcode
            });

            if (data.retcode == 0) {
                packageContext.renderRencentBuddy();
                packageContext.openBuddyList();
            } else {
                el.recentBuddyEl.innerHTML = packageContext.wrapErrorText('获取联系人资料失败！');
                $NET.monite("error_getFriends");
                console.log(data.retcode); //100002参数失败，100003后台错误
            }
        },

        // 初始化并发进程结束
        onInitProcessCompleted: function (data) {
            console.log('onInitProcessCompleted');
            masker.hide();
            packageContext.renderInfo();
            packageContext.setShareBtnText();
            $NET.reportIsdEnd('system_load', true);
        },

        // 分享并发进程结束
        onShareProcessCompleted: function (data) {
            console.log('onShareProcessCompleted');

            //嵌入客户端隐藏部分ui
            if (shareOption.client && el.loginNavEl.innerHTML != "") {
                el.loginNavEl.innerHTML = '';
            }

            var errs = 0,
                v;

            var sendShareCallback = shareProcess.getCallback('sendShare');
            if (sendShareCallback) {
                var channel_2 = sendShareCallback.data.result;
                for (var key in channel_2) {
                    if (channel_2.hasOwnProperty(key)) {
                        v = channel_2[key];
                        if (v["code"] && v.code != 0) {
                            //返回code=58的情况：分享方屏蔽了被分享方，产品逻辑：显示分享成功
                            if (!(v["code"] == 110101 && !!v["desc"].indexOf("code=58"))) {
                                errs++;
                            }
                        }
                    }
                }
            }

            var needCheck = sendShareCallback.data.retcode == 100222 ? true : false;
            var vfError = sendShareCallback.data.retcode == 102222 ? true : false;
            if (needCheck) { //频率限制做校验
                document.getElementById('checkFrame').src = 'https://ssl.captcha.qq.com/getimage?aid=716027615&t=' + Date.parse(new Date());
                $D.id('mask').style.display = "block";
                $D.id('checkBox').style.display = "block";
                packageContext.hideShareProcess();
            } else if (vfError) { //返回码输入错误
                $D.id('errorTip').style.display = "inline";
                el.shareProcessEl.innerHTML = '';
            } else if (data.errors > 0 || errs > 0) {
                console.log('shareError');
                isSendError = true;
                packageContext.hideCheckBox();
                packageContext.showShareError(data.list);
                packageContext.hideShareProcess();
                //mta上报 ： 分享失败；ext1：具体的错误码
                mtaReport.setEndTime();
                mtaReport.report("ShareQQFailed", {
                    Ext1: sendShareCallback.data.retcode
                });
                $NET.monite("error_share");
                //$E.notifyObservers(packageContext, 'closeErrorWin', "");
            } else {
                console.log('shareSuccess');
                isSendSuccess = true;
                packageContext.adaptQQNews('sendSuccess');
                //嵌入空间特性，分享成功采用空间的成功提醒
                if (shareOption.isFromQZ) {
                    return;
                }

                packageContext.hideCheckBox();
                packageContext.showShareSuccess(sendShareCallback.data);

                //mta上报 ：分享成功；耗时字段：发起分享请求到返回成功的耗时
                mtaReport.setEndTime();
                mtaReport.report("ShareQQSuccess", {
                    Time: mtaReport.getInterval()
                });

                $NET.monite("succ_share");
                shareTime.mark();
                shareTime.report();

                //$E.notifyObservers(packageContext, 'initAIO', data);
                $E.notifyObservers(packageContext, 'closeSuccessWin', data);
            }
        },

        // 通过cgi分享成功
        onSendShareSuccess: function (data) {
            console.log('onShareWithPicSuccess');
            $E.notifyObservers(packageContext, 'initBanner', '');
            if (data.retcode == 0) {
                // 全局错误码为0, 进入部分重试逻辑
                if (data.result.qzone && !data.result.qzone.code && data.result.wblog && !data.result.wblog.code) { //qzone,微博返回正常，分享到QQ出错
                    uiStatus.partialRetry = "qq";
                } else if (data.result.qzone && !data.result.qzone.code) { //qzone成功，微博或QQ失败
                    uiStatus.partialRetry = "qzone";
                } else if (data.result.wblog && !data.result.wblog.code) { //微博成功，空间或QQ失败
                    uiStatus.partialRetry = "wblog";
                }
                //qzone,微博失败，QQ成功 uiStatus.partialRetry = ''

                //uiStatus.partialRetry = 1;
                shareProcess.success('sendShare', data);
                //17.12.25 增加父页面postmessage回调 wendycheng
                window.parent.postMessage(shareOption.cbmessage, '*');
            } else {
                shareProcess.error('sendShare', data);
            }
            $NET.reportIsdEnd('sns_send', true);

        },

        //通过cgi创建讨论组成功
        onCreateDisGroupSuccess: function (data) {
            if (data.retcode == 0) {
                $D.hide($D.id("disGroup"));
                $V.maskerSingleton.hide();

                try {
                    packageContext.renderGroupMember(100003);
                } catch (e) {
                }

                var param = "d_" + data.conf_id;
                packageContext.clickListBuddy(param);
            } else if (data.retcode == 99999) { //频率限制
                var option = {
                    text: '您操作太频繁了，请稍后再试',
                    type: 'error'
                };
                $V.maskerSingleton.hide();
                packageContext.showInfoTips(option);
            } else { //创建失败
                var option = {
                    text: '创建讨论组失败!',
                    type: 'error'
                };
                $V.maskerSingleton.hide();
                packageContext.showInfoTips(option);
            }
        },

        // 点击代理
        onDocumentBodyClick: function (e) {
            if (touchMoveFlag) return;
            var target = $U.getActionTarget(e, 5, 'cmd');
            observer.executeAction(target, e);

            //兼容腾讯网、空间接入
            if (shareOption.iframe || shareOption.isFromQZ) {
                packageContext.adaptQQNews('resize');
            }

        },

        //创建讨论组页面双击行为
        onDocumentBodyDblClick: function (e) {
            var target = $U.getActionTarget(e, 5, 'cmd');
            if (target && target.getAttribute("cmd") == "clickDisListBuddy") {
                var uin = target.getAttribute("param");
                $M.addTempDisSelectedFromDBL_d(uin, target);
            }
        },

        onDocumentBodyTouchstart: function (e) {
            touchMoveFlag = 0;
        },

        onDocumentBodyTouchmove: function (e) {
            touchMoveFlag = 1;
        },

        // 搜索框focus
        onSearchInputFocus: function (e) {
            e.stopPropagation();
            if (e.target.id == 'searchInput' && J.string.trim(el.searchInputEl.value) == "搜索好友/群") {
                el.searchInputEl.value = "";
            } else if (e.target.id == 'disSearchInput' && J.string.trim(el.disSearchInputEl.value) == "输入查找关键字") {
                el.disSearchInputEl.value = "";
            }

            $D.addClass(e.target, "focusStyle");

        },

        // 搜索框blur
        onSearchInputBlur: function (e) {
            e.stopPropagation();
            if (e.target.id == 'searchInput' && J.string.trim(el.searchInputEl.value) == "") {
                el.searchInputEl.value = "搜索好友/群";
            } else if (e.target.id == 'disSearchInput' && J.string.trim(el.disSearchInputEl.value) == "") {
                el.disSearchInputEl.value = "输入查找关键字";
            }

            $D.removeClass(e.target, "focusStyle");
        },

        // 搜索框keyup
        onSearchInputKeyUp: function (e) {
            e.stopPropagation();
            if (e.target.id == 'searchInput' && !el.searchInputEl.value) {
                packageContext.hideSearchResult();
                $D.replaceClass($D.id('searchInputIcon'), 'searchInputClearIcon', 'searchInputIcon');
                return;
            } else if (e.target.id == 'disSearchInput' && !el.disSearchInputEl.value) {
                packageContext.hideSearchResult();
                $D.replaceClass($D.id('disSearchInputIcon'), 'searchInputClearIcon', 'searchInputIcon');
                return;
            }

            var searchInputIcon = e.target.id == 'searchInput' ? $D.id('searchInputIcon') : $D.id('disSearchInputIcon');
            var searchInputEl = e.target.id == 'searchInput' ? $D.id('searchInput') : $D.id('disSearchInput');
            var searchInputText = e.target.id == 'searchInput' ? "搜索好友/群" : "输入查找关键字";
            $D.replaceClass(searchInputIcon, 'searchInputIcon', 'searchInputClearIcon');

            searchInputIcon.onclick = function () {
                searchInputEl.value = searchInputText;
                packageContext.hideSearchResult();
                $D.replaceClass(searchInputIcon, 'searchInputClearIcon', 'searchInputIcon');
            }

            if (e.keyCode != KEY_UP && e.keyCode != KEY_DOWN && e.keyCode != KEY_ENTER && e.keyCode != KEY_LEFT && e.keyCode != KEY_RIGHT) {
                $U.debounce(200, packageContext.startSearch, true)();
            }
        },

        // 搜索框keydown
        onSearchInputKeyDown: function (e) {
            e.stopPropagation();
            switch (e.keyCode) {
                case KEY_ENTER:
                    e.preventDefault();
                    break;
                case KEY_LEFT:
                    break;
                case KEY_UP:
                    e.preventDefault();
                    var index = --uiStatus.searchResultCurIndex;
                    if (index >= 0 && index < uiStatus.searchCache.length) {
                        packageContext.selectSearchBuddy(index);
                    } else {
                        uiStatus.searchResultCurIndex = 0;
                    }
                    break;
                case KEY_RIGHT:
                    break;
                case KEY_DOWN:
                    break;
                    e.preventDefault();
                    var index = ++uiStatus.searchResultCurIndex;
                    if (index >= 0 && index < uiStatus.searchCache.length) {
                        packageContext.selectSearchBuddy(index);
                    } else {
                        uiStatus.searchResultCurIndex = uiStatus.searchCache.length - 1;
                    }
                    break;
                default:
                    break;
            }
        },
        onSearchInput: function (e) {
            if ($U.testIpad) this.onSearchInputKeyUp(e);
        },

        // 获取url摘要信息
        onGetUrlInfoSuccess: function (data) {
            console.log('onGetUrlInfoSuccess');
            if (data.result.code == 0) {
                initProcess.success('getUrlInfo', data);
            } else {
                initProcess.error('getUrlInfo', data);
            }
        },

        // 获取用户昵称成功
        onGetUserNameSuccess: function (data) {
            console.log('onGetUserNameSuccess - view');
            if (data.retcode == 0) {
                if (!shareOption.client) {
                    el.loginNavEl.innerHTML = '<span class="spanWhite">' + $S.encodeHtml(shareOption.uname) + '</span>' + '[<a id="logout" cmd="logoutAccount">退出</a>]  |  <a href="###" cmd="changeLoginAccount">换个帐号</a>';
                } else {
                    el.loginNavEl.innerHTML = '';
                }
                uiStatus.isPtLoggedIn = true;
                share.isPtLoggedIn = true;
                uiStatus.isSend = true;

                // 并行获取其他资料
                /* $M.getOpenAccount();*/
                //判断是否分享过并展示引导界面
                $E.notifyObservers(packageContext, 'getUserType', '');

                $NET.reportOnce({
                    name: "pageview",
                    obj: "signed"
                });
            } else if (data.retcode == 100000) {
                J.cookie.remove('skey', share.MAIN_DOMAIN);
                // 将cookie 删除
                uiStatus.isPtLoggedIn = false;
                share.isPtLoggedIn = false;

                //if(!uiStatus.logout){
                share.login.openLoginBox();
                packageContext.renderLoginRecnentArea();

                $NET.reportOnce({
                    name: "pageview",
                    obj: "nosigned"
                });
                $NET.monite("error_login");
                //}

            }
            // 根据登陆状态显示最近联系人或登录提示
            packageContext.showRecentBuddy();
        },

        onLoginSuccess: function () {
            // 切换用户
            if (uiStatus.changeLoginAccount) {
                uinChangeFlag = 1;
                // 置空标志位
                uiStatus = {};
                // 计算字数
                packageContext.updateCounter();
                // 更新model状态
                $M.resetData()
            }
            // 通过获取用户去检测是否登录成功
            $M.getUserName();

            if (el.loginNavEl.innerHTML.indexOf("登录") > -1) {
                $NET.report({
                    name: "sign",
                    obj: "sign"
                });
            } else {
                $NET.report({
                    name: "sign",
                    obj: "change"
                });
            }

            //el.recentBuddyEl.innerHTML = loadCssHtml;
            uiStatus.isPtLoggedIn = true;
            share.isPtLoggedIn = true;
            uiStatus.isSend = true;

            //初始化mm上报
            var uin = J.cookie.get('uin').replace(/^[o0]+/i, '');
            MM.init(1000128, uin, 'QC_WEB');
        },

        // click代理分发
        executeAction: function (target, e) {
            if (target) {
                var cmd = target.getAttribute('cmd'),
                    param = target.getAttribute('param'),
                    remove = target.getAttribute("remove") || 0;

                if (remove) return;
                var evt = observer.runAction(cmd, param, target, e);

                if (evt && evt.preventDefault) {
                    e.preventDefault();
                }
                if (evt && evt.stopPropagation) {
                    e.stopPropagation();
                }
            }
        },

        //删除事件代理
        removeAction: function (target) {
            target.setAttribute("remove", "1");
        },

        // 执行分发
        runAction: function (cmd, param, target, e) {
            var isPreventDefault = true,
                isStopPropagation = true;
            console.log(cmd + ' trigger, param:' + param);
            switch (cmd) {
                case 'toggleShare':
                    packageContext.toggleShare(param);
                    break;
                case 'toggleShareQQCollect':
                    packageContext.toggleShareQQCollect(param);
                    break;
                case 'openList':
                    packageContext.toggleBuddyList();
                    break;
                case 'toggleGroup':
                    packageContext.toggleGroup(param);
                    break;
                case 'toggleDisGroup':
                    packageContext.toggleDisGroup(param);
                    break;
                case 'clickRecentBuddy':
                    packageContext.clickRecentBuddy(param);
                    break;
                //已选联系人点击叉的按钮
                case 'delSelectedBuddy':
                    packageContext.delSelectedBuddy(param);
                    break;
                case 'clickListBuddy':
                    packageContext.clickListBuddy(param, e, target);
                    break;
                case 'share':
                    packageContext.share();
                    break;
                case 'choiceAll':
                    isPreventDefault = false;
                    packageContext.toggleSelectAllBuddy();
                    break;
                case 'clickSearchBuddy':
                    packageContext.selectSearchBuddy(param);
                    packageContext.clickListBuddy(uiStatus.searchCache[param].uuid, e, target);
                    break;
                case 'clickDisSearchBuddy':
                    packageContext.clickDisListBuddy(uiStatus.searchCache[param].uuid);
                    break;
                case 'resultTipsBtnClick':
                    if (uiStatus.isShareError) {
                        isSendError = false;
                        packageContext.hideShareError();
                    } else {
                        $NET.report({
                            name: "closesuccess",
                            obj: 9 - timeCounter
                        });
                        if (shareOption.iframe) {
                            packageContext.adaptQQNews('close');
                        } else {
                            window.opener = null;
                            window.open('', '_self');
                            if (!shareOption.client) {
                                window.close();
                            } else {
                                window.external.ShareWindowClose();
                            }
                        }

                    }
                    break;
                case 'closeErrorWin':
                    packageContext.hideShareError();
                    break;
                case 'clickLoginTipsText':
                    share.login.openLoginBox();
                    break;
                case 'changeLoginAccount':
                    // 标注切换用户
                    uiStatus.changeLoginAccount = true;
                    document.getElementById("login_div").style.right = "-1px";
                    share.login.openLoginBox();
                    break;
                case "login":
                    share.login.openLoginBox();
                    break;
                case 'logoutAccount':
                    packageContext.logoutAccount();
                    break;
                case 'clickDisListBuddy': //点击创建讨论组浮层左侧的联系人列表
                    packageContext.clickDisListBuddy(param, target);
                    break;
                case 'clickDelBuddy':
                    packageContext.clickDelBuddy(param);
                    break;
                case 'addDisBtnClick':
                    packageContext.addDisBtnClick();
                    break;
                case 'delDisBtnClick':
                    packageContext.delDisBtnClick();
                    break;
                case 'createDisgroup':
                    $NET.report({
                        name: "apply"
                    });
                    packageContext.renderDisGroup();
                    packageContext.adaptQQNews('renderDisGroup');
                    break;
                case 'createDisBtnClick':
                    packageContext.createDisBtnClick();
                    packageContext.adaptQQNews('createDisBtnClick');
                    break;
                case 'cancelCreateDisBtnClick':
                    packageContext.cancelCreateDisBtnClick();
                    packageContext.adaptQQNews('cancelCreateDisBtnClick');
                    break;
                case 'clickAioBuddy':
                    $E.notifyObservers(packageContext, 'clickAioBuddy', param);
                    break;
                default:
            }

            return {
                preventDefault: isPreventDefault,
                stopPropagation: isStopPropagation
            }
        }
    };

    //退出当前登录账户
    this.logoutAccount = function () {
        J.cookie.remove('uin', share.MAIN_DOMAIN);
        J.cookie.remove('skey', share.MAIN_DOMAIN);
        //uiStatus.logout = true;
        // 置空标志位
        uiStatus = {};
        // 计算字数
        packageContext.updateCounter();
        // 更新model状态
        $M.resetData();
        uinChangeFlag = 1;
        packageContext.renderLoginRecnentArea();
        packageContext.renderRencentBuddy();
        packageContext.reRenderAppText();
        el.loginNavEl.innerHTML = ' <a href="#" id="login" cmd="login">登录</a> | <a href="http://zc.qq.com/chs/index.html" target="_blank">注册</a>';
        //uiStatus.logout = false;
    };

    // 渲染信息
    this.renderInfo = function () {
        packageContext.adaptQQNews('init');
        var count = Math.ceil(J.string.byteLength(shareOption.msg, 2) / 2); //分享语长度
        var leftCount = userSetting.maxChar - count;
        var MaxLen = 110;
        if (!shareOption.pics && (shareOption.msg_type != 6)) {
            MaxLen = 144;
        }

        //适配音乐 构造summary
        if (shareOption.msg_type == 6) {
            var shareText = [];
            shareOption.album && shareText.push("歌手: " + shareOption.album);
            shareOption.singer && shareText.push("歌手: " + shareOption.singer);
            shareOption.summary = shareText.join("\n");

            if (!shareOption.pics) {
                shareOption.pics = "https://pub.idqqimg.com/qconn/widget/shareqq/images/album.png";
            }
        }

        var fullSummary = shareOption.summary;
        var fullTitle = shareOption.title;

        if ($U.lenReg(shareOption.summary) > MaxLen) { //对超长的分享语做截断
            shareOption.summary = $U.sub_str(shareOption.summary, MaxLen) + "...";
        }

        if ($U.lenReg(shareOption.title) > MaxLen / 2) {
            shareOption.title = $U.sub_str(shareOption.title, parseInt(MaxLen / 2)) + "...";
        }

        if (leftCount < 0) {
            shareOption.msg = $U.sub_str_msg(shareOption.msg, userSetting.maxChar * 2 - 3) + "...";
        }

        shareOption.summary = shareOption.summary.replace(/\n/g, " ");
        //http://security.tencent.com/index.php/report/detail/7388/dc6a0b6267b65d9fe8dd54b936c28297 fix css
        if (!$S.isURL(shareOption.pics)) {
            shareOption.pics = '';
        }
        var tmplObj = {
            shareMsg: $S.encodeHtml(shareOption.msg) || DEFAULT_MSG_TIP,
            title: $S.encodeHtml(shareOption.title),
            summary: $S.encodeHtml(shareOption.summary),
            picUrl: $S.encodeHtmlAttribute(shareOption.pics),
            fullSummary: $S.encodeHtmlAttribute(fullSummary)
        };

        _tmpMsg = tmplObj.shareMsg; //记录原始信息

        el.mainInfoEl.innerHTML = $S.template(tpl.appInfoTmpl, tmplObj);
        el.overflowHintEl = $D.id('overflowHint');
        el.appTextEl = $D.id('appText');

        shareOption.msg_type == 6 && ($D.id("shareSiteInfo").style.fontSize = "16px");

        //   不同图片等比缩放 居中适配
        var img = $D.id('appImg')
        var ML = MaxLen - 4;

        //img加载失败
        img.onerror = function () {
            if (shareOption.msg_type == 6) {
                this.src = "https://pub.idqqimg.com/qconn/widget/shareqq/images/album.png";
                this.style.width = "82px";
                return;
            }

            $D.hide($D.id('imgWrapper'));
        };

        img.onload = function () {

            //适配音乐
            if (shareOption.msg_type == 6) {
                this.style.height = "82px";
            }

            var _this = this;
            var w = parseInt(_this.width);

            if (w > 96) {
                var MaxLen = parseInt(ML - (w - 96) / 5.4 * 2);
            } else {
                var MaxLen = parseInt(ML - (w - 96) / 8 * 2);
            }

            var s = fullSummary,
                t = fullTitle;

            if (fullTitle != "" || shareOption.msg_type == 6) {
                if (shareOption.msg_type == 6) {
                    var album = "专辑：" + shareOption.album;
                    var singer = "歌手：" + shareOption.singer;

                    var albumText = album,
                        singerText = singer;
                    if ($U.lenReg(album) > MaxLen / 2) {
                        var albumText = $U.sub_str(album, parseInt(MaxLen / 2)) + "...";
                    }

                    if ($U.lenReg(singer) > MaxLen / 2) {
                        var singerText = $U.sub_str(singer, parseInt(MaxLen / 2)) + "...";
                    }

                    var shareText = [];
                    shareOption.album && shareText.push($S.encodeHtml(albumText));
                    shareOption.singer && shareText.push($S.encodeHtml(singerText));

                    var s = shareText.join("<br />");

                    if ($U.lenReg(fullTitle) > MaxLen / 2 * 12 / 16) {
                        var t = $U.sub_str(fullTitle, parseInt(MaxLen / 2 * 12 / 16)) + "...";
                    }
                } else {
                    if ($U.lenReg(fullSummary) > MaxLen) {
                        var s = $U.sub_str(fullSummary, MaxLen) + "...";
                    }

                    if ($U.lenReg(fullTitle) > MaxLen / 2) {
                        var t = $U.sub_str(fullTitle, parseInt(MaxLen / 2)) + "...";
                    }
                    // xss
                    s = $S.encodeHtml(s);
                }

                // fix xss rehorn 2013-6-14
                // http://security.tencent.com/index.php/report/detail/5948/25ee916b44efa74a8783228ff81cf945
                fullSummary = $S.encodeHtmlAttribute(fullSummary);
                t = $S.encodeHtml(t);

                if (t != "")
                    var htmlText = t + "<br />" + "<span title='" + fullSummary + "' class='appIntroSummary' id='appIntroSummary'>" + s + "</span>";
                else
                    var htmlText = "<span title='" + fullSummary + "' class='appIntroSummary' id='appIntroSummary'>" + s + "</span>";
            } else {
                MaxLen = parseInt(MaxLen / 2 * 3);
                if ($U.lenReg(fullSummary) > MaxLen) {
                    var s = $U.sub_str(fullSummary, MaxLen) + "...";
                }
                // fix xss
                fullSummary = $S.encodeHtmlAttribute(fullSummary);
                s = $S.encodeHtml(s);
                var htmlText = "<span title='" + fullSummary + "' class='appIntroSummary' id='appIntroSummary'>" + s + "</span>";
            }
            $D.id("shareSiteInfo").getElementsByTagName("span")[0].innerHTML = htmlText;
            img.onload = null;
        };

        if (el.appTextEl.value == DEFAULT_MSG_TIP) {
            el.appTextEl.style.color = "#ccc";
        }

        if (!shareOption.pics) {
            if (shareOption.msg_type == 6) {
            } else {

                $D.hide($D.id('imgWrapper'));
                $D.setStyle($D.id('appIntroSummary'), 'width', '480px');
            }
        }

        if (!(shareOption.pics || shareOption.summary || shareOption.title)) {
            document.getElementById("appText").className += " emptySummary";
        }

        this.renderMsgCounter();
        this.renderVfCode();
    };

    //退出账户后重新渲染分享语区域
    this.reRenderAppText = function () {
        var msg = $M.getAppParams().data.msg;
        $D.id('appText').innerHTML = $S.encodeHtml(msg) || DEFAULT_MSG_TIP;
    };

    // 渲染分享内容计数器
    this.renderMsgCounter = function () {
        var context = this;

        var appTextEl = $D.id("appText");
        if ((appTextEl.innerText && appTextEl.innerText == DEFAULT_MSG_TIP) || (appTextEl.innerHtml && text.innerHTML == DEFAULT_MSG_TIP) || (appTextEl.textContent && appTextEl.textContent == DEFAULT_MSG_TIP)) {
            appTextEl.style.color = "#ccc";
        }

        J.event.on(el.appTextEl, 'keyup', function (e) {
            $U.delay('updateMsgCounter', 200, function () {
                context.updateCounter();
            });

            // 分享输入框  用户自定义内容的次数
            if (!uiStatus.customMsgTracker) {
                uiStatus.customMsgTracker = 1;
            }
        });

        J.event.on(el.appTextEl, "paste", function (e) {
            setTimeout(function () {
                var msg = el.appTextEl.innerHTML.replace(/^<br>/, "");
                var re = /<[^>]+>/g;
                msg = msg.replace(re, "");
                el.appTextEl.innerHTML = msg;
                //修复客户端显示html标签bug
                $M.updateShareMsg(msg.replace(/&nbsp;/g, ""));
            }, 500);
        });

        J.event.on(el.appTextEl, "dragenter", function (e) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        });

        J.event.on(el.appTextEl, "drop", function (e) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        });

        J.event.on(el.appTextEl, "focus", function (e) {
            var text = e.target;
            if (text.innerText) {
                if (text.innerText == DEFAULT_MSG_TIP) {
                    this.innerText = "";
                    this.style.color = "#000";
                }
            } else {
                if (text.innerHTML == DEFAULT_MSG_TIP) {
                    this.innerHTML = "";
                    this.style.color = "#000";
                }
            }

            //focus 样式
            $D.addClass(text, "focusStyle");
        });

        J.event.on(el.appTextEl, "blur", function (e) {
            var text = e.target;

            //to discuss_ by dorsy
            //alert(text.innerText.length);
            if (text.innerText) {
                if (text.innerText.charCodeAt() < 30 || text.innerText.length == 0) {
                    text.innerText = DEFAULT_MSG_TIP;
                    this.style.color = "#ccc";
                }
            } else {
                if (text.innerHTML.charCodeAt() < 30 || text.innerHTML.length == 0 || text.innerHTML == "<br>") {
                    text.innerHTML = DEFAULT_MSG_TIP;
                    this.style.color = "#ccc";
                }
            }

            $D.removeClass(text, "focusStyle");
        });

        this.updateCounter();
    };

    // 获取输入框文本
    this.getInputMsg = function () {
        var msg = el.appTextEl.innerText && el.appTextEl.innerText.replace(/^<br>/, "") || el.appTextEl.textContent && el.appTextEl.textContent.replace(/^<br>/, "");
        msg = msg.replace(/&nbsp;/g, " ").replace(/<br *\/?>/g, " ");
        return (msg == DEFAULT_MSG_TIP) ? '' : msg;
    };

    // 更新分享内容计数器
    this.updateCounter = function () {
        var msg = this.getInputMsg();
        var count = Math.ceil(J.string.byteLength(msg, 2) / 2);
        count = userSetting.maxChar - count;
        var appTextEl = $D.id("appText");
        var text;

        if (count < 0) {
            uiStatus.msgOverflow = true;
            text = '超出<span class="red">' + Math.abs(count) + '</span>字';
            $D.addClass(appTextEl, "appTextOverflowIe6");
        } else {
            text = '还能输入<span>' + count + '</span>字';
            text = '';
            if (count == userSetting.maxChar) {
                // msg为空，也归为overflow
                //uiStatus.msgOverflow = true;
                uiStatus.msgOverflow = false;
            } else {
                uiStatus.msgOverflow = false;
            }

            //还原输入框的高度auto
            $D.removeClass(appTextEl, "appTextOverflowIe6");

        }
        $M.updateShareMsg(msg);
        el.overflowHintEl.innerHTML = text;
        this.checkSendBtnStatus();
        packageContext.adaptQQNews('resize');
    };

    //隐藏验证框
    this.hideCheckBox = function () {
        var context = this;
        el.vfTextEl.value = "";
        context.setVfCode();
        $D.id("sendCheck").style.color = "#A0A0A0";
        $D.id('errorTip').style.display = "none";
        $D.id('mask').style.display = "none";
        $D.id('checkBox').style.display = "none";
    }

    //渲染验证码框
    this.renderVfCode = function () {
        var context = this;
        el.vfTextEl = $D.id('vfText');
        J.event.on(el.vfTextEl, 'keyup', function (e) {
            if (el.vfTextEl.value == "" || el.vfTextEl.value == null) {
                $D.id("sendCheck").style.color = "#A0A0A0";
            } else {
                $D.id("sendCheck").style.color = "black";
            }
            context.setVfCode();
        });

        J.event.on(el.vfTextEl, "focus", function (e) {
            $D.id('errorTip').style.display = "none";
        });

        J.event.on(el.vfTextEl, "keydown", function (e) {
            if (e.keyCode == 13) {
                e.preventDefault();
                packageContext.doShare();
            }
        });

        this.setVfCode();

        J.event.on($D.id("sendCheck"), "click", function (e) {
            packageContext.doShare();
        });

        J.event.on($D.id("changeVf"), "click", function (e) {
            document.getElementById('checkFrame').src = 'https://ssl.captcha.qq.com/getimage?aid=716027615&t=' + Date.parse(new Date());
            el.vfTextEl.value = "";
            context.setVfCode();
            $D.id("sendCheck").style.color = "#A0A0A0";
            $D.id('errorTip').style.display = "none";
        });

        J.event.on($D.id("checkCloseBtn"), "click", function (e) {
            context.hideCheckBox();
        });

        J.event.on($D.id("cancelCheck"), "click", function (e) {
            context.hideCheckBox();
        });
    };

    //获取输入验证码
    this.getInputCode = function () {
        var code = $D.id('vfText').value;
        return code;
    };

    //存储输入的验证码
    this.setVfCode = function () {
        var code = this.getInputCode();
        $M.setVfCode(code);
    };

    // 设置分享按钮文本
    this.setShareBtnText = function () {
        el.shareMsgBtnEl.innerHTML = shareOption.shareBtnText;
        el.shareMsgBtnEl.title = shareOption.shareBtnText;
    };

    // 渲染分享终端
    this.renderShareCom = function () {
        var visible = $M.getVisibleShare();

        var tmplObj = {
            list: visible,
            isPad: $U.testIpad,
            isQQCollectSelect: J.cookie.get("qqCollect") == 'true' ? 'selected' : '',
            isQQCollectChecked: J.cookie.get("qqCollect") == 'true' ? 'checked' : ''
        };
        el.shareComListEl.innerHTML = $S.template(tpl.shareComTmpl, tmplObj);

        J.array.forEach(visible, function (item) {
            if (item.checked) {
                packageContext.selectShare(item.id);
            }
        });

        if (J.cookie.get("qqCollect")) {
            $M.setQQCollect(true);
        }

        if (visible.length <= 0) {
            $D.hide(el.shareComListEl);
            $D.hide(el.shareTextEl);
        }
    };


    //为腾讯网IFRAME接入的高度变化做自适应
    this.initViewForQQNews = function () {
        if (isSendError || isSendSuccess) {
            return;
        }

        var height = $D.id("mainContent").scrollHeight;
        top.window['share2qq'].resizePopup({
            height: height
        });
        top.window['share2qq'].iframe.style.height = height + 'px';
    };

    //接入腾讯网、空间做兼容
    this.adaptQQNews = function (str) {
        if (!shareOption.iframe) {
            return;
        }
        switch (str) {
            case 'renderDisGroup':
                $D.setStyle($D.id('disGroup'), 'top', '2px');
                break;
            case 'init':
                $D.id('wrapper').removeChild($D.id('header'));
                $D.id('wrapper').removeChild($D.id('footer'));
                $D.setStyle($D.id('content'), 'border-radius', '0px');
                if (top.window['share2qq']) {
                    top.window['share2qq'].resizePopup({
                        width: 720
                    });
                    top.window['share2qq'].resizePopup({
                        height: 470
                    });
                    top.window['share2qq'].iframe.style.width = '720px';
                    top.window['share2qq'].iframe.style.height = '470px';
                }
                break;
            case 'resize':
                packageContext.initViewForQQNews();
                break;
            case 'buddyTree':
                $D.addClass($D.id('buddyTree'), "hackFor6");
                break;
            case 'close':
                if (top.window['share2qq']) {
                    top.window['share2qq'].closePopup();
                }
                break;
            case 'showTips':
                $D.setStyle($D.id('infoConfirmTips'), 'top', '30%');
                $D.setStyle(el.infoTipsEl, 'top', '30%');
                break;
            case 'sendSuccess':
                if (top.window['share2qq'] && shareOption.isFromQZ) {
                    top.window['share2qq'].onSendSuccess();
                }
                break;
            case 'successView': //为腾讯网IFRAME接入的成功页做兼容
                $D.setStyle($D.id('resultTips'), 'top', '0px');
                $D.setStyle($D.id('resultTips'), 'border-radius', '0px');
                var aioTipsMain = $D.mini('.aioTipsMain', $D.id('resultTips'))[0];
                $D.setStyle(aioTipsMain, 'border-radius', '0px');
            default:
                break;
        }
        return;
    };

    // 显示最近联系人
    this.showRecentBuddy = function () {
        if (!uiStatus.isPtLoggedIn) {
            this.renderLoginRecnentArea();
        } else {
            // 显示最近联系人
            if (!uiStatus.rencentBuddy) {
                //mta上报：拉取用户列表
                mtaReport.setStartTime();
                $M.getBuddyList();
                uiStatus.rencentBuddy = 1;
            }
        }
    };

    // 渲染最近联系人
    this.renderRencentBuddy = function () {
        document.getElementById("recentBuddy").innerHTML = '<div id="recentBuddyForB"></div><div id="recentBuddyForG"></div>';
        $D.addClass($D.id("mainContent"), "startWording");
        return;
    };


    // 渲染通过参数传过来的默认选中uin
    this.renderPreSelectedBuddy = function () {
        var status = $M.getSelectedStatus();
        J.array.forEach(status.selected, function (uin) {
            var dom = $D.id('recentBuddy_' + uin);
            $D.addClass(dom, 'selected');
        });
    };

    //渲染创建讨论组中选择的好友
    this.renderPreSelectedDis = function (container, user) {
        var tmplObj = {
            'user': user,
            encodeHtml: $S.encodeHtml
        };
        container.innerHTML = $S.template(tpl.disBuddySelectedTmpl, tmplObj);
    };

    //渲染创建讨论组好友列表
    this.renderDisBuddyList = function (container) {
        console.log('renderDisBuddyList');

        container.innerHTML = $S.template(tpl.buddyListComTmplDis, {});
        el.disBuddyTreeEl = $D.id('disBuddyTree');
        el.disSearchResultEl = $D.id('disSearchResult');
        el.disSearchInputEl = $D.id('disSearchInput');

        $E.on(el.disSearchInputEl, 'focus', observer.onSearchInputFocus);
        $E.on(el.disSearchInputEl, 'blur', observer.onSearchInputBlur);
        $E.on(el.disSearchInputEl, 'keyup', observer.onSearchInputKeyUp);
        $E.on(el.disSearchInputEl, 'keydown', observer.onSearchInputKeyDown);

        var allGroup = $M.getBuddyGroup();
        var tmplObj = {
            list: allGroup,
            encodeHtml: $S.encodeHtml,
            padFlag: $U.testIpad
        };

        el.disBuddyTreeEl.innerHTML = $S.template(tpl.disBuddyTreeTmpl, tmplObj);

        var buddyTreeUlNodes = document.getElementById("disBuddyTree").getElementsByTagName("div");
        _this = this;
        for (var i = 0, n = buddyTreeUlNodes.length; i < n; i++) {
            var UlNode = buddyTreeUlNodes[i];
            UlNode.onmouseover = function () {
                if ($U.testIpad) return;
                this.style.background = "rgb(48,178,228)";
            };

            UlNode.onmouseout = function () {
                if ($U.testIpad) return;
                this.style.background = "none";
            };

            UlNode.ontouchstart = function (e) {
                var el = e.target;
                el.style.background = "rgb(48,178,228)";
                el.style.color = "#fff";
            };

            UlNode.ontouchend = function (e) {
                var el = e.target;
                el.style.background = "none";
                el.style.color = "#000";

                e.preventDefault();
                _this.toggleDisGroup(e.target.getAttribute("param"));
            };
        }
    };

    // 渲染好友列表
    this.renderBuddyList = function (container, isDis) {
        console.log('renderBuddyList');

        container.innerHTML = $S.template(tpl.buddyListComTmpl, {});
        this.adaptQQNews('buddyTree');
        el.buddyTreeEl = $D.id('buddyTree');
        el.searchResultEl = $D.id('searchResult');
        el.searchInputEl = $D.id('searchInput');

        $E.on(el.searchInputEl, 'focus', observer.onSearchInputFocus);
        $E.on(el.searchInputEl, 'blur', observer.onSearchInputBlur);
        $E.on(el.searchInputEl, 'keyup', observer.onSearchInputKeyUp);
        $E.on(el.searchInputEl, 'keydown', observer.onSearchInputKeyDown);
        el.searchInputEl.oninput = function (e) {
            observer.onSearchInput(e);
        };

        var allGroup = $M.getAllGroup();
        var tmplObj = {
            list: allGroup,
            encodeHtml: $S.encodeHtml,
            padFlag: $U.testIpad
        };
        el.buddyTreeEl.innerHTML = $S.template(tpl.buddyTreeTmpl, tmplObj);

        //默认展开逻辑
        var lsArray = $M.getMyBuddyList().group['100000'],
            recentArray = $M.getMyBuddyList().group['100001'];

        if (lsArray && lsArray.length) {
            this.openGroup('100000');
        } else if (recentArray && recentArray.length) {
            this.openGroup('100001');
        }

        var buddyTreeUlNodes = document.getElementById("buddyTree").getElementsByTagName("div"),
            _this = this;
        for (var i = 0, n = buddyTreeUlNodes.length; i < n; i++) {
            var UlNode = buddyTreeUlNodes[i];


            UlNode.onmouseover = function () {
                if (/categoryTag/.test(this.className)) return;
                if ($U.testIpad) return;
                this.style.background = "rgb(48,178,228)";
            };

            UlNode.onmouseout = function () {
                if (/categoryTag/.test(this.className)) return;
                if ($U.testIpad) return;
                this.style.background = "none";
            };

            //    for dear ipad
            UlNode.ontouchstart = function (e) {
                if (/categoryTag/.test(this.className)) return;
                var el = e.target;
                el.style.background = "rgb(48,178,228)";
                el.style.color = "#fff";
            };

            UlNode.ontouchend = function (e) {
                if (/categoryTag/.test(this.className)) {
                    e.preventDefault();
                    return;
                }
                var el = e.target;
                el.style.background = "none";
                el.style.color = "#000";

                e.preventDefault();
            };

            UlNode.ontouchmove = function (e) {
                if (/categoryTag/.test(this.className)) return;
                var el = e.target;
                el.style.background = "none";
                el.style.color = "#000";
            };
        }
    };

    // 渲染分享成员
    this.renderGroupMember = function (groupIndex) {
        var mEl = $D.id('groupMember_' + groupIndex);
        var groupKey = $M.getGroup(groupIndex).key;
        var tmplObj = {
            list: $M.getGroupBuddy(groupIndex),
            markname: shareOption.buddyTreeMarkname,
            groupKey: groupKey,
            encodeHtml: $S.encodeHtml,
            padFlag: $U.testIpad
        };

        //最近联系人最近分享人分好友、群组显示
        if (groupKey == 'ls' || groupKey == 'recent') {
            if (groupKey == 'ls') {
                var friendCount = $M.getCategoryCount().lsCount.friend,
                    groupCount = $M.getCategoryCount().lsCount.groupDiscuss;
            } else if (groupKey == 'recent') {
                $M.setRecentCount($M.getGroupBuddy(groupIndex));
                var friendCount = $M.getCategoryCount().recentCount.friend,
                    groupCount = $M.getCategoryCount().recentCount.groupDiscuss;
            }
            var friendHtml = friendCount == 0 ? "" : "<div class='categoryTag' onmouseover='margin:0;'>好友</div>",
                /*****客户端讨论组问题对应的修改****/
                /*groupHtml = groupCount == 0 ? "" : "<div class='categoryTag' onmouseover='margin:0;'>群组</div>";*/
                groupHtml = groupCount == 0 ? "" : "<div class='categoryTag' onmouseover='margin:0;'>群</div>";

            var buddyTmplObj = {
                    markname: shareOption.buddyTreeMarkname,
                    groupKey: groupKey,
                    encodeHtml: $S.encodeHtml,
                    padFlag: $U.testIpad,
                    list: tmplObj.list.slice(0, friendCount)
                },
                disGroupTmpObj = {
                    markname: shareOption.buddyTreeMarkname,
                    groupKey: groupKey,
                    encodeHtml: $S.encodeHtml,
                    padFlag: $U.testIpad,
                    list: tmplObj.list.slice(friendCount)
                };

            var insertHtml = friendHtml + $S.template(tpl.buddyTmpl, buddyTmplObj) + groupHtml + $S.template(tpl.buddyTmpl, disGroupTmpObj);
            mEl.innerHTML = insertHtml;
        } else {
            mEl.innerHTML = $S.template(tpl.buddyTmpl, tmplObj);
        }


        /*   好友列表mouseover背景效果 for ie6 */
        var buddyTreeLiNodes = document.getElementById("buddyTree").getElementsByTagName("li");
        for (var i = 0, n = buddyTreeLiNodes.length; i < n; i++) {
            var liNode = buddyTreeLiNodes[i];
            liNode.onmouseover = function () {
                if ($U.testIpad) return;
                this.style.background = "rgb(48,178,228)";
            };

            liNode.onmouseout = function () {
                if ($U.testIpad) return;
                this.style.background = "none";
            };

            //    for dear ipad
            liNode.ontouchstart = function (e) {
                moveFlag = 0;
                e.stopPropagation();
                var el = this;
                el.style.background = "rgb(48,178,228)";
                el.style.color = "#fff";
                el.style.marginLeft = "3px";
            };

            var moveFlag = 0;
            liNode.ontouchend = function (e) {
                var el = this;
                el.style.background = "none";
                el.style.color = "#000";
                el.style.marginLeft = "10px";
                var param = this.getAttribute("param");
                if (!moveFlag) packageContext.clickListBuddy(param, e, $U.getActionTarget(e, 5, 'cmd'));

                e.preventDefault();
                e.stopPropagation();
            };
            liNode.ontouchmove = function (e) {
                //e.preventDefault();
                moveFlag = 1;
                var el = this;
                el.style.background = "none";
                el.style.color = "#000";
                el.style.marginLeft = "10px";
            };
        }
    };

    // 渲染分享成员
    this.renderDisGroupMember = function (groupIndex) {
        var dismEl = $D.id('disGroupMember_' + groupIndex);
        var groupKey = $M.getGroup(groupIndex).key;

        var tmplObj = {
            list: $M.getGroupBuddyNormal(groupIndex),
            markname: shareOption.buddyTreeMarkname,
            groupKey: groupKey,
            encodeHtml: $S.encodeHtml
        };
        dismEl.innerHTML = $S.template(tpl.disBuddyTmpl, tmplObj);

        /*   好友列表mouseover背景效果 for ie6 */
        var buddyTreeLiNodes = document.getElementById("disBuddyTree").getElementsByTagName("li");
        for (var i = 0, n = buddyTreeLiNodes.length; i < n; i++) {
            var liNode = buddyTreeLiNodes[i];

            liNode.onmouseover = function () {
                if ($U.testIpad) return;
                this.style.background = "rgb(48,178,228)";
            };

            liNode.onmouseout = function () {
                if ($U.testIpad) return;
                this.style.background = "none";
            };

            var moveFlag = 0;

            liNode.ontouchstart = function (e) {
                moveFlag = 0;
                e.stopPropagation();
                var el = this;
                el.style.background = "rgb(48,178,228)";
                el.style.color = "#fff";
                el.style.marginLeft = "3px";
            };

            var moveFlag = 0;
            liNode.ontouchend = function (e) {
                var el = this;
                el.style.background = "none";
                el.style.color = "#000";
                el.style.marginLeft = "10px";
                var param = this.getAttribute("param");
                if (!moveFlag) packageContext.clickDisListBuddy(param);

                e.preventDefault();
                e.stopPropagation();
            };
            liNode.ontouchmove = function (e) {
                //e.preventDefault();
                moveFlag = 1;
            };
        }
    };

    // 为分享和邀请添加不同的布局风格样式
    this.addGridStyleClass = function () {
        var body = window.document.body;
        if (shareOption.type == '11') {
            $D.addClass(body, 'gridInvite');
        } else {
            $D.addClass(body, 'gridShare');
        }
    };

    //为ie6添加一些效果
    this.addEffectsForIe6 = function () {
        var elArr = ['choiceAll', 'openList'];
        for (var i = 0; i < elArr.length; i++) {
            var elM = document.getElementById(elArr[i]);
            elM.onmouseover = function (e) {
                this.style.border = "1px solid #adb3b5";
            };
            elM.onmouseout = function (e) {
                this.style.border = "1px solid #fff";
            };
        }

        try {
            document.createElement("canvas").getContext("2d");
        } catch (e) {
            var rencentIcon = document.getElementById("recentBuddy");
            $U.addEvent(rencentIcon, "li", "mouseover", function () {
                this.className += " showBorder";
            });
            $U.addEvent(rencentIcon, "li", "mouseout", function () {
                this.className = this.className.replace(" showBorder", "");
            });
        }
    };

    var renderDisFlag = 0,
        uinChangeFlag = 0;
    //加载创建讨论组面板
    this.renderDisGroup = function () {
        if ($M.getSelected().length == 10) {
            var option = {
                text: '对象最多为10个',
                type: 'error'
            };
            packageContext.showInfoTips(option);
            return;
        } else {
            if ($M.getSelectedNum("disGroup") >= $M.getSelectedStatus().maxToDisGroup) {
                var option = {
                    text: '最多发送给3个讨论组',
                    type: 'error'
                };
                packageContext.showInfoTips(option);
                return;
            }
        }
        var selfUin = J.cookie.get('uin').replace(/^[o0]+/i, '');

        var uNick = $M.getShareOption().uname,
            uAvatar = $U.getAvatar(selfUin);
        $V.maskerSingleton.show();

        if (!renderDisFlag || uinChangeFlag) {
            this.renderDisBuddyList($D.id("left"));
            this.renderPreSelectedDis($D.id("right"), {
                'nick': uNick,
                'avatar': uAvatar
            });
        } else {
            this.initDisGroup();
        }

        if (uinChangeFlag) uinChangeFlag = 0;

        var left = (parseInt(J.dom.id("wrapper").offsetWidth || 567) - 567) / 2;
        $D.id("disGroup").style.left = left + "px";

        $D.show($D.id("disGroup"));
        if ($U.testIpad) {
            $D.hide($D.id("addDisBtn"));
            $D.hide($D.id("delDisBtn"));
        }
        renderDisFlag = 1;
        isRenderDisgroup = true;
    };
    //渲染创建讨论组面板
    this.initDisGroup = function () {
        var div = document.getElementById("disBuddyTree").getElementsByTagName("div");
        for (var i = 0, n = div.length; i < n; i++) {
            J.dom.removeClass(div[i], "groupOpen");
            var id = div[i].id;
            var result = /_(\d+$)/.exec(id) || [0];
            if (result[0]) {
                var group = "disGroupMember_" + result[1];
                J.dom.id(group).style.display = "none"
            }
        }
        J.dom.addClass(J.dom.id("addDisBtn"), "addDisAbled");
        J.dom.addClass(J.dom.id("delDisBtn"), "addDisAbled");
        J.dom.hide(J.dom.id("disSearchResult"));
        J.dom.show(J.dom.id("disBuddyTree"));
        J.dom.id("disSearchInput").value = "输入查找关键字";

        $M.initDisGroup();
    };

    //创建讨论组
    this.doCreateDisGroup = function (name, uinArray) {
        var name = shareOption.msg;
        name = $U.sub_str_create(name, 20);
        var data = {
            name: name,
            uinArray: uinArray,
            t: shareOption.t
        };
        isCreateDisClick = true;
        $M.onCreateDisGroupOnView(data);
        isCreateDisClick = false;
    };


    // 初始化入口
    this.init = function () {
        console.log('share app view init');

        var _uin = $U.getSelfUin() || 0;
        MM.init(1000128, _uin, 'QC_WEB');

        shareOption = $M.getShareOption();

        //客户端隐藏登录入口
        if (shareOption.client) {
            $D.id('loginNav').innerHTML = '';
        }
        this.addGridStyleClass();

        el.wrapperEl = $D.id('wrapper');
        el.loadingEl = $D.id('loading');
        el.mainInfoEl = $D.id('mainInfo');
        el.contentEl = $D.id('content');
        el.shareComEl = $D.id('shareCom');
        el.shareMsgBtnEl = $D.mini('.sendShareMsg', el.shareComEl)[0];
        el.shareTextEl = $D.mini('.shareText', el.shareComEl)[0];
        el.shareProcessEl = $D.id('shareProcess');
        el.shareComListEl = $D.id('shareComList');
        el.recentBuddyEl = $D.id('recentBuddy');
        el.recentBuddyEl = $D.id('recentBuddy');

        el.sitebarEl = $D.id('sitebar');
        el.infoTipsEl = $D.id('infoTips');
        el.infoConfirmTipsEl = $D.id('infoConfirmTips');
        el.infoTipsTextEl = $D.mini('.tipsText', $D.id('infoTips'))[0];
        el.infoConfirmTipsTextEl = $D.mini('.tipsText', $D.id('infoConfirmTips'))[0];


        el.tipsInfoEl = $D.id('tipsInfo');
        el.loginNavEl = $D.id('loginNav');
        el.disBuddyTreeEl = $D.id('disBuddyTree');
        el.disSearchInputEl = $D.id('disSearchInput');
        el.searchResultEl = $D.id('disSearchResult');
        el.disSearchResultEl = $D.id('disSearchResult');
        el.searchInputIcon = $D.id('searchInputIcon');
        el.disSearchInputIcon = $D.id('disSearchInputIcon');


        tpl.appInfoTmpl = $U.getTemplate('appInfoTmpl');
        tpl.recentBuddyTmpl = $U.getTemplate('recentBuddyTmpl');
        tpl.buddyTreeTmpl = $U.getTemplate('buddyTreeTmpl');
        tpl.buddyTmpl = $U.getTemplate('buddyTmpl');
        tpl.searchResultTmpl = $U.getTemplate('searchResultTmpl');
        tpl.shareComTmpl = $U.getTemplate('shareComTmpl');
        tpl.buddyListComTmpl = $U.getTemplate('buddyListComTmpl');
        tpl.buddyListComTmplDis = $U.getTemplate('buddyListComTmplDis');
        tpl.disBuddySelectedTmpl = $U.getTemplate('disBuddySelectedTmpl');
        tpl.disBuddyTreeTmpl = $U.getTemplate('disBuddyTreeTmpl');
        tpl.disBuddyTmpl = $U.getTemplate('disBuddyTmpl');

        masker = new share.ui.Masker({
            container: el.wrapperEl,
            element: $D.id('wrapperMasker')
        });

        $E.addObserver($M, 'GetOpenAccountSuccess', observer.onGetOpenAccountSuccess);
        $E.addObserver($M, 'GetBuddyListReady', observer.onGetBuddyListReady);
        $E.addObserver($M, 'uinSelectedChanged', observer.onUinSelectedChanged);
        $E.addObserver($M, 'GetUrlInfoSuccess', observer.onGetUrlInfoSuccess);
        $E.addObserver($M, 'GetUserNameSuccess', observer.onGetUserNameSuccess);
        $E.addObserver($API, 'ShareBuddySuccess', observer.onShareBuddySuccess);
        $E.addObserver(share.login, 'LoginSuccess', observer.onLoginSuccess);
        $E.on(document.body, 'click', observer.onDocumentBodyClick);
        $U.testIpad && $E.on(document.body, 'touchend', observer.onDocumentBodyClick);
        $U.testIpad && $E.on(document.body, 'touchmove', observer.onDocumentBodyTouchmove);
        $U.testIpad && $E.on(document.body, 'touchstart', observer.onDocumentBodyTouchstart);
        $E.on(document.body, 'dblclick', observer.onDocumentBodyDblClick);
        $E.addObserver($M, 'CreateDisGroupSuccess', observer.onCreateDisGroupSuccess);

        this.initProcessRun();

        uiStatus.isSend = true;

        el.sitebarEl.innerHTML = loadCssHtml;

        var _this = this;
        var flyEle = $D.id("flyEle");

        J.event.on(flyEle, 'webkitTransitionEnd', function () {
            flyEle.style.display = "none";
            $D.removeClass(_this.animateParam.node, "opacityEle");
            _this.animateParam.node.style.filter = "alpha(opacity=0)";
            _this.animateParam.node.style.opacity = 1;
            _this.animateParam.actionFlag = 0;
        });

        if ($D.id("feedback")) {
            J.event.on($D.id("feedback"), "click", function () {
                $NET.report({
                    name: "clickFeedback"
                });
            });
        }

        $U.testIpad && (flyEle.style.webkitTransition = "all ease 0.5s");

        $NET.monite("onload");
        $NET.reportOnce({
            name: "website",
            obj: $S.parseURL(shareOption.url).host
        });
        Q.error(259682);
    };

    // 运行初始化进程
    this.initProcessRun = function () {
        // 如果没有自定义站点消息，则用cgi获取
        initProcess = new $U.BatchProcess();
        if (!shareOption.url) {
            // 如果url为空显示
            masker.setTips('非法请求！');
            return;
        } else {
            $E.addObserver(initProcess, 'BatchProcessCompleted', observer.onInitProcessCompleted);
            if (!shareOption.title || !shareOption.summary || !shareOption.pics) {
                initProcess.add('getUrlInfo', J.bind($M.getUrlInfo, this));
            }
            initProcess.run();
        }

        $M.getUserName();
        //呱呱视频及空间接入都隐藏同步分享icon
        if (!shareOption.client && !shareOption.isFromQZ) {
            packageContext.renderShareCom();
        } else {
            $D.hide(el.shareTextEl);
            $D.hide(el.shareComListEl);
        }

        packageContext.renderShareCom();
    };

    // 自动化测试
    this.testcase = function () {
        var tt = observer.runAction;
        $E.addObserver($M, 'GetBuddyListReady', function () {
            $U.delay(50, function () {
                tt('openList');
            });
            $U.delay(1000, function () {
                tt('toggleGroup', 1);
            });
        });
    };

    // 选中第三方分享终端
    this.selectShare = function (shareId) {
        var shareObj = $M.getShareSetting(shareId);
        if (!shareObj.shareFlag && !shareObj.validFlag) {
            return;
        }
        shareObj.checked = 1;
        var dom = $D.id('shareTo_' + shareId);
        $D.addClass(dom, 'selected');

        var span = dom.childNodes[0];
        if (shareObj.shareFlag && shareObj.validFlag) {
            $D.addClass(span, "checked");
            $U.testIpad && (dom.style.opacity = "1");
        }

        this.checkSendBtnStatus();
    };

    // 取消第三方分享终端
    this.unSelectShare = function (shareId) {
        var shareObj = $M.getShareSetting(shareId);
        var dom = $D.id('shareTo_' + shareId);
        $D.removeClass(dom, 'selected');
        shareObj.checked = 0;

        dom.onmouseover = function (e) {
            e.preventDefault();
        };
        dom.onmouseout = function () {
        };

        var span = dom.childNodes[0];

        $D.removeClass(span, "checked");
        $U.testIpad && (dom.style.opacity = "0.5");

        this.checkSendBtnStatus();
    };

    // 切换第三方分享终端
    this.toggleShare = function (shareId) {
        var shareObj = $M.getShareSetting(shareId);
        if (shareObj.shareFlag && shareObj.validFlag) {
            if (!shareObj.checked) {
                this.selectShare(shareId);
            } else {
                this.unSelectShare(shareId);
            }
        } else {
            // 开通或注册
            switch (shareObj.regAction) {
                case 1:
                    // TODO 打开浏览器开通
                    var link = "";
                    switch (shareObj.id) {
                        case "qzone":
                            link = "https://imgcache.qq.com/qzone/reg/reg1.html";
                            break;
                        case "wblog":
                            link = "http://reg.t.qq.com/";
                            break;
                        default:
                            link = "about:blank";

                    }
                    window.open(link);
                    break;
                case 2:
                    // 点击版定
                    if ($U.hasRpcChannel()) {
                        $API.runAuthApp(shareId);
                    }
                    break;
                default:
                    break;
            }
        }
    };

    this.toggleShareQQCollect = function () {
        if ($D.hasClass($D.id('shareTo_qq_collect'), 'selected')) {
            $D.removeClass($D.id('shareTo_qq_collect'), 'selected');
            $D.removeClass($D.id('qqCollectSpan'), 'checked');
            $M.setQQCollect(false);
        } else {
            $D.addClass($D.id('shareTo_qq_collect'), 'selected');
            $D.addClass($D.id('qqCollectSpan'), 'checked');
            $M.setQQCollect(true);
        }
    };

    this.enableShareItem = function (shareId) {
        var shareObj = $M.getShareSetting(shareId);
        var dom = $D.id('shareTo_' + shareId);
        $D.removeClass(dom, 'disable2');
        this.selectShare(shareId);
        dom.setAttribute('title', '点击图标，发送到' + shareObj.name);
    };

    // 设置发送按钮点击状态
    this.checkSendBtnStatus = function () {
        if (!uiStatus.msgOverflow) {
            uiStatus.isSend = true;
            $D.replaceClass(el.shareMsgBtnEl, 'disable', 'enable');
            el.shareMsgBtnEl.title = "发送";
        } else {
            uiStatus.isSend = false;
            $D.replaceClass(el.shareMsgBtnEl, 'enable', 'disable');
            el.shareMsgBtnEl.title = "发送字数过多";
        }
    };

    // 获取失败用语
    this.wrapErrorText = function (txt) {
        return '<div class="masker-tips center">' + txt + '</div>';
    };

    // 在最近联系人区域显示登录提示
    this.renderLoginRecnentArea = function () {
        el.sitebarEl.innerHTML = '<div class="loginTipsText"><a href="###" id="loginTipsText" cmd="clickLoginTipsText" title="点击登录">请先登录，再选择好友</a></div>';
    };

    // 在最近联系人区域显示没有好友
    this.renderNoBuddyRecnentArea = function () {
        el.sitebarEl.innerHTML = '<div class="loginTipsText"><a href="http://id.qq.com" target="_blank" id="loginTipsText" title="点击添加">您尚未添加任何好友/群/讨论组，请先添加</a></div>';
    };

    // 张开好友列表
    this.openBuddyList = function () {
        if (!uiStatus.buddyList) {
            packageContext.renderBuddyList(el.sitebarEl);
            uiStatus.buddyList = 1;
            if (J.browser.ie && J.browser.ie == 6.0) {

            } else {
                $U.delay(10, function () {
                    $M.parseBuddyPinyin();
                });
            }
        }
    };

    // 关闭好友列表
    this.closeBuddyList = function () {
        el.sitebarEl.style.display = 'none';
        document.getElementById("wrapper").style.width = "560px";
        document.getElementById("mainContent").style.width = "100%";
        userSetting.buddyList = 0;
        el.openListEl.innerHTML = '更多 ››';
        $D.removeClass(el.openListEl, 'listOpened');
    };

    // 切换好友列表
    this.toggleBuddyList = function () {
        if (!userSetting.buddyList) {
            this.openBuddyList();
        } else {
            this.closeBuddyList();
        }
        $NET.report({
            name: "more"
        });
    };

    // 展开好友分组
    this.openGroup = function (groupIndex) {
        var gid = 'groupMember_' + groupIndex;
        var ul = $D.id(gid);
        var group = $D.id('buddyGroup_' + groupIndex);
        $D.show(ul);
        $D.addClass(group, 'groupOpen');
        if (!uiStatus[gid]) {
            packageContext.renderGroupMember(groupIndex);
            uiStatus[gid] = 1;
        }
        groupListCom[gid] = 1;
    };

    // 创建讨论组--展开好友分组
    this.openDisGroup = function (groupIndex) {
        var gid = 'disGroupMember_' + groupIndex;
        var ul = $D.id(gid);
        var group = $D.id('disBuddyGroup_' + groupIndex);
        $D.show(ul);
        $D.addClass(group, 'groupOpen');
        if (!uiStatus[gid]) {
            packageContext.renderDisGroupMember(groupIndex);
            uiStatus[gid] = 1;
        }
        groupListCom[gid] = 1;
    };
    // 关闭好友分组
    this.closeGroup = function (groupIndex) {
        var gid = 'groupMember_' + groupIndex;
        var ul = $D.id(gid);
        var group = $D.id('buddyGroup_' + groupIndex);
        $D.removeClass(group, 'groupOpen');
        $D.hide(ul);
        groupListCom[gid] = 0;
    };
    // 创建讨论组--关闭好友分组
    this.closeDisGroup = function (groupIndex) {
        var gid = 'disGroupMember_' + groupIndex;
        var ul = $D.id(gid);
        var group = $D.id('disBuddyGroup_' + groupIndex);
        $D.removeClass(group, 'groupOpen');
        $D.hide(ul);
        groupListCom[gid] = 0;
    };

    // 切换好友分组展开状态
    this.toggleGroup = function (groupIndex) {
        var mid = 'groupMember_' + groupIndex,
            gid = 'buddyGroup_' + groupIndex;
        if (!groupListCom[mid]) {
            this.openGroup(groupIndex);
        } else {
            this.closeGroup(groupIndex);
        }
    };

    // 切换创建讨论组好友分组展开状态
    this.toggleDisGroup = function (groupIndex) {
        var mid = 'disGroupMember_' + groupIndex,
            gid = 'disBuddyGroup_' + groupIndex;
        if (!$M.getUserSetting().groupList[mid]) {
            this.openDisGroup(groupIndex);
        } else {
            this.closeDisGroup(groupIndex);
        }
    };

    // 高亮好友列表tree项目
    this.hightLightTreeItem = function (id) {
        console.log('hightLightTreeItem');
        var dom = $D.id(id);
        if (uiStatus.hightLightEl) {
            $D.removeClass(uiStatus.hightLightEl, 'selected');
        }
        $D.addClass(dom, 'selected');
        uiStatus.hightLightEl = dom;
    };

    // 点击最近联系人
    this.clickRecentBuddy = function (uin) {
        this.insertSelectBuddy(uin);
    };

    //点击添加讨论组浮层add按钮
    this.addDisBtnClick = function () {
        $M.addDisItems_d();
    };

    //点击创建讨论组删除按钮
    this.delDisBtnClick = function () {
        $M.removeDisItems_d();
    };

    //点击创建讨论组浮层的左侧好友列表
    this.clickDisListBuddy = function (uuid, target) {
        $M.addTempDisSelected_d(uuid, target);
    };

    //更新创建讨论组已选成员计数
    this.updateCount_d = function (n) {
        J.dom.id("disChoiceText").innerHTML = "已选联系人(" + (n + 1) + "/20)";
        var el = J.dom.id("createDisBtn");
        if (n == 0) {
            J.dom.addClass(el, "addDisAbled");
        } else {
            J.dom.removeClass(el, "addDisAbled");
        }
    };

    //点击创建讨论组确定按钮
    this.createDisBtnClick = function () {
        if ($M.getSelectedLength_d() == 0) {
            var option = {
                text: '未选择讨论组成员',
                type: 'error'
            };
        } else {
            var selected = $M.getSelectedItems_d();
            this.doCreateDisGroup('', selected);
            isRenderDisgroup = false;
            $D.hide($D.id("disGroup"));
            $V.maskerSingleton.hide();
            $NET.report({
                name: "create"
            });
        }
    };

    //点击创建讨论组取消按钮
    this.cancelCreateDisBtnClick = function () {
        isRenderDisgroup = false;
        if ($M.getSelectedLength_d() > 0) {
            var option = {
                text: '您确定要放弃本次创建操作？',
                type: 'error'
            };
            packageContext.showInfoConfirmTips(option);
        } else {
            $D.hide($D.id("disGroup"));
            $V.maskerSingleton.hide();
        }
    };

    // 点击好友列表
    this.clickListBuddy = function (uuid, e, target) {
        // TODO 重构
        if ($U.testIpad && this.animateParam.actionFlag) {
            return;
        }


        var uin = uuid;
        var mta_type = 1;
        if (!packageContext.checkSelectedCount(uin)) {
            return;
        }
        this.animateParam.actionFlag = 1;

        var dom = $D.id('recentBuddy_' + uin);
        var firstUnselect, iteral;

        //如果删除动画还在继续，不执行添加动作
        if (actionFlag) return;

        if (dom) {
        } else {
            var rencentList = $D.mini('.recentBuddyItem', el.recentBuddyEl);
            var rencentBuddyNode = $D.mini('.rencentList', el.recentBuddyEl)[0];
            firstUnselect = null;
            for (var i = 0, len = rencentList.length; i < len; i++) {
                iteral = rencentList[i];
                if (!$D.hasClass(iteral, 'selected')) {
                    firstUnselect = iteral;
                    break;
                }
            }

            var item = $M.getInfoByUUID(uin);
            var name = $S.encodeHtml(item.markname || item.nick || item.uin);
            var title = name;
            if (item.extra) {
                title += '&#xd' + $S.encodeHtml(item.extra);
            }
            var node = $D.node('li', {
                'id': 'recentBuddy_' + uin,
                'class': 'recentBuddyItem'
            });

            var style;
            if ($U.lenReg(name) < 7) {
                style = "text-align:center";
            } else {
                style = "";
            }

            node.innerHTML = '<div style="' + style + '" title="' + title + '" class="buddyName">' + name + '</div><div class="deleteItem" cmd="delSelectedBuddy" param="' + item.uuid + '"></div>';
            if (firstUnselect) {
                rencentBuddyNode.insertBefore(node, firstUnselect);
                rencentBuddyNode.removeChild(firstUnselect);
            } else {

                //判断不同的type去不同的分组
                if ($M.getUinType(uuid) == "buddy") {
                    rencentBuddyNode = $D.id("recentBuddyForB");

                    //当首次添加时
                    if ($M.getSelectedNum("buddy") == 0) {
                        rencentBuddyNode.innerHTML = $S.template(tpl.recentBuddyTmpl, {});
                    }

                } else {
                    mta_type = 2;
                    rencentBuddyNode = $D.id("recentBuddyForG");
                    if (($M.getSelectedNum("group") + $M.getSelectedNum("disGroup")) == 0) {
                        rencentBuddyNode.innerHTML = $S.template(tpl.recentBuddyTmpl, {});
                    }
                }

                //根据budyname的长度来确定li的最短长度，修复ie<8下的bug
                var nameLen = $U.lenReg(item.markname || item.nick || item.uin);
                var minLen = nameLen * 4 + 8 + "px";
                node.style.minWidth = minLen;
                if (J.browser.ie == 6 && nameLen >= 48) {
                    var _minLen = nameLen * 4 + 18 + "px";
                    node.style.width = _minLen;
                }

                $D.addClass(node, "opacityEle");
                rencentBuddyNode.getElementsByTagName("ul")[0].appendChild(node);

                var _this = this;
                node.ontouchend = function () {
                    _this.delSelectedBuddy(uuid);
                };

                this.flyToRecent(node, e, target);

                node.ontouchstart = function () {
                };


                //动画效果 挤开
                if (($M.getUinType(uuid) == "buddy" && $M.getSelectedNum("buddy") == 0) || ($M.getUinType(uuid) != "buddy" && ($M.getSelectedNum("group") + $M.getSelectedNum("disGroup") == 0))) {
                    rencentBuddyNode.style.overflow = "hidden";
                    rencentBuddyNode.style.height = 0;
                    $U.animate(rencentBuddyNode, {
                        height: "60px"
                    }, 300, function () {
                        rencentBuddyNode.style.height = "auto";
                    });
                }
            }
            if (uiStatus.searchResultCurEl) {
                $D.removeClass(uiStatus.searchResultCurEl, 'current');
            }
        }

        this.insertSelectBuddy(uin, true);
        //mta上报 ： 选择用户；ext1字段：选择用户的类型  value1 = 好友  value2 = 群  value3 = 讨论组
        mtaReport.report("ShareQQSelectUser", {
            Ext1: mta_type
        });
        $NET.report({
            name: "select"
        });
    };

    this.animateParam = {
        node: '',
        actionFlag: 0
    };

    //点击之后飞过去的动画
    this.flyToRecent = function (node, e, target) {
        //如果是鼠标事件发起的
        if (e && target) {
            this.animateParam.node = node;

            var flyEle = $D.id("flyEle");
            flyEle.innerHTML = target.outerHTML;
            flyEle.style.display = "none";

            var startOffset = $U.getElementPos(target);
            flyEle.style.left = startOffset.x + "px";
            flyEle.style.top = startOffset.y + "px";
            flyEle.style.opacity = 1;

            flyEle.style.display = "block";

            var endOffset = $U.getElementPos(node);

            //让上次动画提前结束
            $U.lastAnimationEnd("fly", "fast");
            $U.lastAnimationEnd("fly2", "fast");
            flyEle.style.display = "block";

            if ($U.testIpad) {

                flyEle.style.opacity = 0;
                flyEle.style.left = endOffset.x + "px";
                flyEle.style.top = endOffset.y + "px";
            } else {
                $U.animate(flyEle, {
                    left: endOffset.x + "px",
                    top: endOffset.y + "px",
                    opacity: "0"
                }, 400, function () {
                    flyEle.style.display = "none";
                    $D.removeClass(node, "opacityEle");
                    node.style.filter = "alpha(opacity=0)";
                    node.style.opacity = 0;
                    $U.animate(node, {
                        opacity: 1
                    }, 200);
                }, "fly");
            }

            //适配其他情形
        } else {
            $D.removeClass(node, "opacityEle");
            node.style.filter = "alpha(opacity=0)";
            node.style.opacity = 0;
            $U.animate(node, {
                opacity: 1
            }, 200);
            $U.testIpad && (this.animateParam.actionFlag = 0);
        }

        return 1;
    };


    // 选中所有最近联系人
    this.selectAllBuddy = function () {
        var rencentList = $D.mini('li', el.recentBuddyEl);
        J.array.forEach(rencentList, function (item) {
            if (!$D.hasClass(item, 'selected')) {
                packageContext.insertSelectBuddy(item.getAttribute('param'));
            }
        });

        $NET.report({
            name: "selectall"
        });
    };

    // 取消选择所有最近联系人
    this.unSelectAllBuddy = function () {
        this.selectAllBuddy();
    };

    // 切换所有最近联系人
    this.toggleSelectAllBuddy = function () {
        this.selectAllBuddy();
    };

    // 检测是否超过可选好友数量
    this.checkSelectedCount = function (uin) {
        var ss = $M.getSelectedStatus();
        var type = $M.getUinType(uin);
        if (type == "buddy") {
            var selectedNum = $M.getSelectedNum(type);
        } else {
            var selectedNum = $M.getSelectedNum("group") + $M.getSelectedNum("disGroup");
        }

        if (!$M.isSelected(uin) && selectedNum >= ss.total && type == "buddy") {
            console.log('over selected buddy limit');
            var option = {
                text: '最多发送给 ' + ss.total + ' 个好友',
                type: 'error'
            };
            packageContext.showInfoTips(option);
            return false;
        } else if (!$M.isSelected(uin) && selectedNum >= ss.maxToG && type != "buddy") {

            console.log('over selected limit_group');
            var option = {
                text: '最多发送给' + ss.maxToG + '个群组',
                type: 'error'
            };
            packageContext.showInfoTips(option);
            return false;
        }
        return true;
    };

    // 选中界面中指定uin的节点
    this.toggleBuddyTreeDom = function (uin, isSelect) {
        isSelect = isSelect == undefined ? false : isSelect;
        var clsFunction = isSelect ? $D.addClass : $D.removeClass,
            domSearch,
            domGroupBuddy;

        domSearch = $D.id('searchBuddy_' + uin);
        domSearch && clsFunction(domSearch, 'selected');

        J.array.forEach($M.getAllGroup(), function (group) {
            domGroupBuddy = $D.id('listBuddy_' + group.key + '_' + uin);
            domGroupBuddy && clsFunction(domGroupBuddy, 'selected');
        });
    };

    /**
     * 将好友uin插入到最近联系人栏
     * @param  {Number} uin        uin
     * @param  {Boolean} showEffect 是否显示选中提醒动画
     * @return {NULL}
     */
    this.insertSelectBuddy = function (uuid, showEffect) {
        // uin = parseInt(uin);
        // TODO
        var uin = uuid;
        var dom = $D.id('recentBuddy_' + uin),
            showEffect = J.isUndefined(showEffect) ? false : true;
        if ($M.isSelected(uin)) {
            $U.testIpad && (this.animateParam.actionFlag = 0);
            //this.delSelectedBuddy(uin);
        } else {
            // 超过最多可选uin数
            if (!packageContext.checkSelectedCount(uin)) {
                return;
            }

            $M.addSelected(uin, isCreateDisClick);

            $D.addClass(dom, 'selected');

            packageContext.toggleBuddyTreeDom(uin, true);
            $D.removeClass($D.id("mainContent"), "startWording");

            if (showEffect) {
                $U.delay(100, function () {
                    $D.removeClass(dom, "padUnhover");
                    $D.addClass(dom, 'hightlight');
                });
                $U.delay(200, function () {
                    $D.removeClass(dom, 'hightlight');
                });
            }
        }

        this.renderSelectedText(uuid);
        this.checkSendBtnStatus();
    };

    //渲染已选中多少人
    this.renderSelectedText = function (uuid) {
        var choiceTextEle;
        var s = $M.getSelectedStatus();

        if ($M.getUinType(uuid) == "buddy") {
            (choiceTextEle = $D.id("recentBuddyForB").getElementsByTagName("span")[0]) && choiceTextEle.className == "choiceText" && function () {
                choiceTextEle.innerHTML = "好友(" + $M.getSelectedNum("buddy") + "/" + s.total + ")";
            }();
        } else {
            (choiceTextEle = $D.id("recentBuddyForG").getElementsByTagName("span")[0]) && choiceTextEle.className == "choiceText" && function () {
                choiceTextEle.innerHTML = "群组(" + ($M.getSelectedNum("group") + $M.getSelectedNum("disGroup")) + "/" + s.maxToG + ")";
            }();
        }

    };

    //记录动画标记
    var actionFlag = 0,
        endDelFunc;
    //删除选中的联系人
    this.delSelectedBuddy = function (uin) {
        var _this = this;
        //如果已经选中
        if ($M.isSelected(uin)) {
            $M.removeSelected(uin);
            var id = "recentBuddy_" + uin;
            var item = $D.id(id);

            //var style = getComputedStyle(item);
            //alert(style.getPropertyValue("width"));
            item.style.opacity = 1;
            item.style.overflow = "hidden";
            item.style.width = "50px";
            item.style.padding = "0";

            endDelFunc = function (arg) {
                item.parentNode.removeChild(item);
                _this.renderSelectedText(uin);

                //检查选中人是否为0，为0则去掉标题
                var type = $M.getUinType(uin);
                if (type == "buddy") {
                    if ($M.getSelectedNum(type) == 0) {
                        var recentBuddyForBEl = $D.id("recentBuddyForB");
                        recentBuddyForBEl.style.height = "30px";
                        recentBuddyForBEl.style.overflow = "hidden";

                        //被双击快速取消产生的bug修复
                        if (arg == "fast") {
                            recentBuddyForBEl.innerHTML = "";
                        } else {
                            $U.animate(recentBuddyForBEl, {
                                height: 0
                            }, 100, function () {
                                recentBuddyForBEl.innerHTML = "";
                                actionFlag = 0;
                            });
                        }
                    } else {
                        actionFlag = 0;
                    }

                } else {
                    if ($M.getSelectedNum("group") + $M.getSelectedNum("disGroup") == 0) {
                        $D.id("recentBuddyForG").innerHTML = "";
                    }
                    actionFlag = 0;
                }

                if (!$M.getSelected().length) {
                    $D.addClass($D.id("mainContent"), "startWording");
                }

                $U.testIpad && (_this.animateParam.actionFlag = 0);

            };

            if ($U.testIpad) {
                item.style.webkitTransition = "all ease .2s";
                item.style.overflow = "hidden";
                item.style.width = 0;
                item.style.opacity = 0;

                J.event.on(item, "webkitTransitionEnd", endDelFunc);
            } else {

                actionFlag = 1;
                $U.animate(item, {
                    opacity: 0,
                    width: 0
                }, 200, endDelFunc, "fly2");
            }


        } else {
            //do nothing
        }

        packageContext.adaptQQNews('resize');
    };


    // 分享
    this.share = function () {
        console.log('share');

        if (uiStatus.msgOverflow) return;
        if (uiStatus.isSend) {
            var ss = $M.getSelectedStatus();
            if (uiStatus.msgOverflow) {
                // 提示字数
                var option = {
                    text: '发送字数过多',
                    type: 'error'
                };
                packageContext.showInfoTips(option);
            } else if (!uiStatus.isPtLoggedIn) {
                // 提示登录
                share.login.openLoginBox();
            } else if ($M.getSelected().length <= 0) {
                // 选择个数
                var option = {
                    text: '请先选择至少1个好友/群',
                    type: 'error'
                };
                packageContext.showInfoTips(option);
            } else {
                this.showShareProcess();
                //mta : 点击分享按钮
                mtaReport.report("ShareQQClick", {});
                this.doShare();
            }
        } else {
            this.showShareProcss();
        }
    };

    // 触发分享流程
    this.doShare = function () {
        console.log('doShare');
        shareTime = Q.speed(7721, 123, 15);
        shareTime.mark();
        //mta : 发起分享请求计时
        mtaReport.setStartTime();
        var channel_1 = $M.getChannelDest(1, uiStatus.partialRetry), //分享到好友
            channel_2 = $M.getChannelDest(2, uiStatus.partialRetry), //weibo, qzone, sina weibo
            channel_3 = $M.getChannelDest(3, uiStatus.partialRetry),
            uinLength = $M.getSelected().length;

        shareProcess = new $U.BatchProcess();
        $E.addObserver(shareProcess, 'BatchProcessCompleted', observer.onShareProcessCompleted);


        var _uins = $M.getShareUins();
        var shareUins = [];
        for (var i in _uins) {
            if (!(J.array.indexOf($M.getdisGroupArrayKey(), _uins[i].id) >= 0)) {
                shareUins.push(_uins[i]);
            }
        }

        $M.sortSelected();

        var qqCollect = shareOption.qqCollect ? true : false;
        J.cookie.set("qqCollect", qqCollect);

        if (qqCollect) {
            channel_2.push('weiyun');
        }


        if (channel_2.length > 0) {
            var option = {
                content: $S.decodeHtmlSimple(shareOption.msg),
                dest: channel_2,
                targetUrl: shareOption.url,
                uins: JSON.stringify(shareUins),
                dmList: JSON.stringify($M.parseDisgroup()),
                ldw: $U.getCSRFToken(),
                t: shareOption.t
            };
            if (shareOption.pics && shareOption.pics !== '' && shareOption.pics !== 'undefined') {
                option.imageUrl = shareOption.pics;
            }
            if (shareOption.flash && shareOption.flash !== '' && shareOption.flash !== 'undefined') {
                option.flash = shareOption.flash;
            }
            if (shareOption.APPID && shareOption.APPID !== '' && shareOption.APPID !== 'undefined') {
                option.APPID = shareOption.APPID;
            }
            if (shareOption.title && shareOption.title !== '' && shareOption.title !== 'undefined') {
                option.title = shareOption.title;
            }
            if (shareOption.site && shareOption.site !== '' && shareOption.site !== 'undefined') {
                option.site = shareOption.site;
            }
            if (shareOption.summary && shareOption.summary !== '' && shareOption.summary !== 'undefined') {
                option.summary = shareOption.summary;
            }
            if (shareOption.callback && shareOption.callback !== '' && shareOption.callback !== 'undefined') {
                option.appCallback = shareOption.callback;
            }
            if (shareOption.vfcode && shareOption.vfcode !== '' && shareOption.vfcode !== 'undefined') {
                option.vfcode = shareOption.vfcode;
            }


            //如果是音乐
            if (shareOption.msg_type == 6) {
                shareOption.album && (option.album = shareOption.album);
                shareOption.singer && (option.singer = shareOption.singer);
                option.appid = shareOption.appid;
            }

            if (shareOption.msg_type) {
                option.msg_type = shareOption.msg_type;
            }

            if (shareOption.site == 'qqcom') {
                option.site = '腾讯网';
            }
            shareProcess.add('sendShare',
                J.bind($NET.sendShare, $NET, option, observer.onSendShareSuccess));

            var visibleShare = [];
            var tempObj = {};
            J.array.forEach(option.dest, function (item) {
                tempObj[item] = 1;
            });

            visibleShare[0] = tempObj['qzone'] || 0;
            visibleShare[1] = tempObj['wblog'] || 0;

            visibleShare = visibleShare.join(",");

            J.cookie.set("visibleShare", visibleShare, "connect.qq.com", "/", 24 * 30 * 3);


            //$NET.smartTrack(trackName, shareOption.appId, trackName);
            $NET.report({
                name: "share2qq",
                obj: uinLength
            });

            if (channel_2.toString().indexOf("qzone") > -1) {
                $NET.report({
                    name: "share2qzone"
                });
            }
            if (channel_2.toString().indexOf("wblog") > -1) {
                $NET.report({
                    name: "share2txweibo"
                });
            }

            _tmpMsg = _tmpMsg.replace(/&#38;/g, "&").replace(DEFAULT_MSG_TIP, "");
            if (_tmpMsg != shareOption.msg) { //自定义分享语
                $NET.report({
                    name: "write"
                });
            }

            if (shareOption.msg == "") {
                if (_tmpMsg != "") {
                    $NET.report({
                        name: "sharenothing"
                    });
                } else if (_tmpMsg == "") {
                    $NET.report({
                        name: "shareempty"
                    });
                }
            }
        }

        shareProcess.run();

    };

    // 显示分享中...状态
    this.showShareProcess = function () {
        el.shareProcessEl.innerHTML = loadCssHtml;
        $D.replaceClass(el.shareMsgBtnEl, 'enable', 'disable');
        uiStatus.isSend = false;
    };

    // 隐藏分享中...状态
    this.hideShareProcess = function () {
        el.shareProcessEl.innerHTML = '';
        $D.replaceClass(el.shareMsgBtnEl, 'disable', 'enable');
        uiStatus.isSend = true;
    };

    // 显示好友列表搜索结果
    this.showSearchResult = function () {
        if (isRenderDisgroup) {
            el.disSearchResultEl.style.display = 'block';
            el.disBuddyTreeEl.style.display = 'none';
        } else {
            el.searchResultEl.style.display = 'block';
            el.buddyTreeEl.style.display = 'none';
        }
    };

    // 隐藏好友列表搜索结果
    this.hideSearchResult = function () {
        if (isRenderDisgroup) {
            el.disSearchResultEl.style.display = 'none';
            el.disBuddyTreeEl.style.display = 'block';
        } else {
            el.searchResultEl.style.display = 'none';
            el.buddyTreeEl.style.display = 'block';
        }
    };

    // 开始搜索
    this.startSearch = function () {
        console.log('startSearch');
        if (isRenderDisgroup) {
            var rs = $M.searchBuddy(J.string.trim(el.disSearchInputEl.value), 50);
        } else {
            var rs = $M.searchBuddy(J.string.trim(el.searchInputEl.value), 50);
        }

        uiStatus.searchCache = rs;
        if (rs.length > 0) {
            var tmplObj = {
                cmd: 'clickSearchBuddy',
                list: rs,
                encodeHtml: $S.encodeHtml,
                disFlag: 0
            };
            if (isRenderDisgroup) {
                tmplObj.cmd = 'clickDisListBuddy';
                tmplObj.disFlag = 1;
                el.disSearchResultEl.innerHTML = $S.template(tpl.searchResultTmpl, tmplObj);
            } else {
                el.searchResultEl.innerHTML = $S.template(tpl.searchResultTmpl, tmplObj);
            }

            /*   好友列表mouseover背景效果 for ie6 */
            var buddyTreeLiNodes = isRenderDisgroup ? document.getElementById("disSearchResult").getElementsByTagName("li") : document.getElementById("searchResult").getElementsByTagName("li");
            for (var i = 0, n = buddyTreeLiNodes.length; i < n; i++) {
                var liNode = buddyTreeLiNodes[i];
                liNode.onmouseover = function () {
                    if ($U.testIpad) return;
                    this.style.background = "rgb(48,178,228)";
                };

                liNode.onmouseout = function () {
                    if ($U.testIpad) return;
                    this.style.background = "none";
                };

                //    for dear ipad

                liNode.ontouchstart = function (e) {
                    moveFlag = 0;
                    e.stopPropagation();
                    var el = this;
                    el.style.background = "rgb(48,178,228)";
                    el.style.color = "#fff";
                };

                var moveFlag = 0;
                liNode.ontouchend = function (e) {
                    var el = this;
                    el.style.background = "none";
                    el.style.color = "#000";
                    var param = this.getAttribute("param");
                    if (!moveFlag) packageContext.clickListBuddy(param, e, $U.getActionTarget(e, 5, 'cmd'));

                    e.preventDefault();
                    e.stopPropagation();
                };
                liNode.ontouchmove = function (e) {
                    moveFlag = 1;

                    return;
                    var el = this;
                    el.style.background = "none";
                    el.style.color = "#000";
                };
            }
        } else {
            if (isRenderDisgroup) {
                el.disSearchResultEl.innerHTML = '没找到相关好友';
            } else {
                //去掉讨论组wording
                el.searchResultEl.innerHTML = '没找到相关好友/群';
            }
        }
        packageContext.showSearchResult();

        if (!isRenderDisgroup && el.searchInputEl.value.length == 1 || isRenderDisgroup && el.disSearchInputEl.value.length == 1) {
            $NET.report({
                name: "search"
            });
        }
    };

    // 选中搜索结果项
    this.selectSearchBuddy = function (index) {
        console.log('selectSearchBuddy:' + index);
        var uin = uiStatus.searchCache[index].uuid;
        if (uiStatus.searchResultCurEl) {
            $D.removeClass(uiStatus.searchResultCurEl, 'current');
        }
        var dom = $D.id('searchBuddy_' + uin);
        uiStatus.searchResultCurEl = dom;
        uiStatus.searchResultCurIndex = index;

        $D.addClass(dom, 'current');
    };

    this.showShareSuccess = function (data) {
        uiStatus.isShareError = false;
        $E.notifyObservers(packageContext, 'showShareSuccess', data);
    };

    this.showShareError = function (data) {
        uiStatus.isShareError = true;
        $E.notifyObservers(packageContext, 'showShareError', data);
    };


    // 隐藏分享失败
    this.hideShareError = function () {
        el.resultTipsEl = $D.id('resultTips');
        $D.show(el.contentEl);
        $D.hide(el.resultTipsEl);
    };

    // 显示自动消息的提示框
    this.showInfoTips = function (option) {
        var option = option || {};
        option.text = option.text || '';
        option.type = option.type || 'success';
        option.callback = option.callback || function () {
        };
        option.timeout = option.timeout || 2000;

        if (option.text.toLowerCase().indexOf("<br/>") > -1) {
            $D.id("tipsIcon").style.marginTop = "10px";
        } else if (!isSendSuccess) {
            el.infoTipsEl.style.lineHeight = "50px";
        }

        if (isSendSuccess) {
            $D.hide($D.id("tipsIcon"));
        }

        $D.show(el.infoTipsEl);
        el.infoTipsEl.className = 'tipsWrapper ' + option.type;
        el.infoTipsTextEl.innerHTML = option.text;
        $U.delay('INFO_TIPS', option.timeout, function () {
            $D.hide(el.infoTipsEl);
            option.callback.call(packageContext);
        });
        packageContext.adaptQQNews('showTips');
    };

    // 显示带图标的自动消息提示框
    this.showInfoConfirmTips = function (option) {
        var option = option || {};
        option.text = option.text || '';
        option.type = option.type;
        option.callback = option.callback || function () {
        };
        option.timeout = option.timeout || 1500;

        $D.show(el.infoConfirmTipsEl);
        el.infoConfirmTipsEl.className = 'tipsConfirmWrapper ' + option.type;
        el.infoConfirmTipsTextEl.innerHTML = option.text;
        $D.id('cfmYesBtn').onclick = function () {
            $D.hide(el.infoConfirmTipsEl);
            $D.hide($D.id("disGroup"));
            $V.maskerSingleton.hide();
        };
        $D.id('cfmNoBtn').onclick = function () {
            $D.hide(el.infoConfirmTipsEl);
        };
        packageContext.adaptQQNews('showTips');
    };

});

Jx().$package('share.normal.view', function (J) {
    var packageContext = this,
        $ = J.dom.mini,
        $P = J.localStorage,
        $D = J.dom,
        $E = J.event,
        $S = J.string,
        $B = J.browser,
        $M = share.model,
        $U = share.utils,
        $API = share.api,
        $V = share.ui;
    $C = share.view;
    var el = {},
        tpl = {};
    var shareComMap = $M.getShareSettingMap(),
        shareOption = $M.getShareOption();

    //是否需要引导页面标志
    var isNewUser = false;

    var CGI_SEND_ERRORMAP = {
        10001: "貌似出了些故障，麻烦重试一下",
        100000: "貌似出了些故障，麻烦重试一下",
        100001: "貌似出了些故障，麻烦重试一下",
        100003: "貌似出了些故障，麻烦重试一下",
        100004: "您的消息包含非法内容，请修改后重试",
        100100: "貌似出了些故障，麻烦重试一下",
        100101: "貌似出了些故障，麻烦重试一下",
        100012: "貌似出了些故障，麻烦重试一下",
        111111: "貌似出了些故障，麻烦重试一下",
        99999: "您的操作太快了，让消息飞一会儿，再重试吧",
        103199: "貌似出了些故障，麻烦重试一下",
        103104: "貌似出了些故障，麻烦重试一下",
        103101: "发送url不在白名单",
        103111: "发送url不符合安全等级",
        103101: "组件还在内测阶段，敬请期待发布",
        103111: "您发送的网页有危险信息",
        100222: "需要验证码",
        102222: "验证码服务异常",
        103111: "此网站经电脑管家鉴定，存在风险，请勿发送",
        110040: "发送语中请勿填写网址，麻烦调整后重试"
    };

    var observer = {
        onGetUserTypeSuccess: function (data) {
            if (data.retcode == 0) {
                //if(!data.result.isFirst && !(J.cookie.get('is_first') && J.cookie.get('is_first') == J.cookie.get('uin'))){
                if (!data.result.isFirst && !$M.getShareOption().iframe && !$M.getShareOption().client) {
                    packageContext.renderGuide();
                    //J.cookie.set("is_first",J.cookie.get('uin'));
                    isNewUser = true;
                }
            }
        },
        onCloseSuccessWin: function (data) {
            // 10s中关闭
            timeCounter = 9;
            packageContext.timer = setInterval(function () {
                if (timeCounter == 0) {
                    clearInterval(packageContext.timer);
                    el.resultTipsInfoEl.innerHTML = '<p>若窗口无法自动关闭，请手动关闭</p>';
                } else {
                    el.resultTipsInfoEl.innerHTML = '<p>' + timeCounter + '秒后窗口自动关闭</p>';
                }

                if (timeCounter-- == 0) {
                    $NET.report({
                        name: "closesuccess",
                        obj: 9 - timeCounter
                    });

                    //为腾讯网做兼容
                    if (shareOption.iframe) {
                        packageContext.adaptQQNews('close');
                    } else {
                        window.opener = null;
                        window.open('', '_self');
                        if (!shareOption.client) {
                            window.close();
                        } else {
                            window.external.ShareWindowClose();
                        }
                    }
                }
            }, 1000);
        }
    };


    this.init = function () {

        //el.aioBuddyEl = $D.id('aioBuddy');
        el.resultTipsInfoEl = $D.id('resultTipsInfo');


        el.sitebarEl = $D.id('sitebar');
        el.infoTipsEl = $D.id('infoTips');
        el.infoConfirmTipsEl = $D.id('infoConfirmTips');
        el.infoTipsTextEl = $D.mini('.tipsText', $D.id('infoTips'))[0];
        el.infoConfirmTipsTextEl = $D.mini('.tipsText', $D.id('infoConfirmTips'))[0];
        el.resultTipsEl = $D.id('resultTips');
        el.resultTipsIconEl = $D.id('resultTipsIcon');
        el.contentEl = $D.id('content');

        el.resultTipsBtnEl = $D.id('resultTipsBtn');
        el.tipsInfoEl = $D.id('tipsInfo');
        el.banner = $D.id('banner');
        tpl.bannerTmpl = $U.getTemplate('bannerTmpl');

        tpl.aioBuddyTmpl = $U.getTemplate('aioBuddyTmpl');
        tpl.aioInfoTmpl = $U.getTemplate('aioInfoTmpl');

        shareOption = $M.getShareOption();
        $E.addObserver($C, 'getUserType', packageContext.getUserType);
        $E.addObserver($M, 'GetUserTypeSuccess', observer.onGetUserTypeSuccess);
        $E.addObserver($C, 'closeSuccessWin', observer.onCloseSuccessWin);
        $E.addObserver($C, 'showShareSuccess', packageContext.showShareSuccess);
        $E.addObserver($C, 'showShareError', packageContext.showShareError);
        $E.addObserver($C, 'initBanner', packageContext.initBanner);
        $E.addObserver($C, 'initAIO', packageContext.initAIO);
        $E.addObserver($C, 'clickAioBuddy', packageContext.clickAioBuddy);
    };

    this.getUserType = function () {
        $M.getUserType();
    };

    this.renderGuide = function () {
        $V.maskerSingleton.show();
        $D.setStyle($D.id('mask'), 'opacity', '0.9');
        $D.show($D.id("guide"));
        $D.id('guideClose').onclick = function () {
            $D.setStyle($D.id('mask'), 'opacity', '0.5');
            $V.maskerSingleton.hide();
            $D.hide($D.id("guide"));
        };
    };

    this.showShareSuccess = function (data) {
        $D.show(el.resultTipsEl);
        $D.hide(el.contentEl);
        $D.addClass($D.id("tipsMainRow1"), "succ");
        el.tipsInfoEl.innerHTML = "消息已成功送达";
        document.getElementById("resultTipsBtn").title = "点击关闭";
        el.resultTipsIconEl.className = 'tipsIconError success';
        el.resultTipsInfoEl.innerHTML = '<p>10秒后窗口自动关闭</p>';
        el.resultTipsBtnEl.innerHTML = '点击关闭';

        if (shareOption.iframe) {
            packageContext.initSuccessView();
        }

        if (data.result.activityPage) {
            $D.setStyle(el.resultTipsBtnEl, "margin-left", "110px");
            $D.addClass(el.resultTipsBtnEl, "resultTipsBtnIE6");
            var activityLinkEl = $D.id("activityLink");
            activityLinkEl.setAttribute("href", data.result.activityPage);
            activityLinkEl.innerText = data.result.activityName;
            if (data.result.activityName.length > 8) {
                activityLinkEl.style.width = 110 + (data.result.activityName.length - 8) * 10 + 'px';
            }
            $D.show(activityLinkEl);
            activityLinkEl.onmouseover = packageContext.bindClearTimer;
            activityLinkEl.onclick = function () {
                $NET.report({
                    name: "to3rd"
                });
            };
        }

        if (!$M.getShareOption().iframe) {
            $D.addClass($D.id('tipsMain'), 'guide_result');
            $D.addClass($D.id('tipsMain_div'), 'guide_result');
            $D.addClass($D.id('tipsMainRow3'), 'guide_result');
            $D.show($D.id('result_guide'));

            $D.show($D.id('bannerContent'));
        }
    };

    // 显示分享失败
    this.showShareError = function (list) {
        console.log(list);
        $D.hide(el.contentEl);
        $D.show(el.resultTipsEl);


        $D.removeClass($D.id("tipsMainRow1"), "succ");
        el.tipsInfoEl.innerHTML = "发送失败";
        el.resultTipsIconEl.className = 'tipsIconError';
        el.resultTipsBtnEl.innerHTML = '立即重试';

        var errMsg = '';
        J.array.forEach(list, function (err) {
            if (err.id == 'sendShare') {
                var channel_2 = err.data.result;
                var errs = 0,
                    v;
                if (channel_2) {
                    for (var key in channel_2) {
                        if (channel_2.hasOwnProperty(key)) {
                            v = channel_2[key];
                            if (v['code'] && v.code != 0) {
                                errs++;
                                shareComMap[key].error = 1;
                                errMsg += '<p>' + shareComMap[key].name + '：' + v.desc + '</p>';
                            }
                        }
                    }
                } else {
                    var errTips = CGI_SEND_ERRORMAP[err.data.retcode] || "请稍候重试";
                    errMsg += errTips;
                }
            }
        });
        el.resultTipsInfoEl.innerHTML = errMsg;
        if (shareOption.iframe) {
            packageContext.initSuccessView();
        }
    };
    this.bindClearTimer = function () {
        if ($U.testIpad) return;
        if (J.browser.name == 'firefox') {
            el.resultTipsInfoEl.childNodes[0].textContent = '';
        } else {
            el.resultTipsInfoEl.childNodes[0].innerText = '';
        }
        window.clearInterval(packageContext.timer);
    };

    this.initAIO = function (data) {
        $M.setSharetoOption(data);
        $U.initCphelper();

        packageContext.renderAioBuddy();
        packageContext.initSuccessView();
    };

    // 渲染AIO联系人
    this.renderAioBuddy = function () {
        if ($U.testIpad) return;
        var aioBuddyArray = $M.getSelected();
        var aioBuddy = [],
            aioBuddyTemp = [];
        for (var i = 0; i < aioBuddyArray.length; i++) {
            aioBuddyTemp[i] = $M.getInfoByUUID(aioBuddyArray[i]);
            if (aioBuddyTemp[i].type == '1') {
                aioBuddyTemp[i].avatar = 'https://p.qpic.cn/qqconadmin/0/1d211791c47b466ebfc0af507f93fc14/0';
            }
            aioBuddyTemp[i].uin = $M.getSelectedUins()[i].type + '_' + $M.getSelectedUins()[i].id;
        }
        //按好友、群、讨论组排序
        aioBuddy = $U.bubbleSort(aioBuddyTemp);

        if (aioBuddy.length > 0) {
            var tmplObj = {
                uins: $M.getSelectedUins(),
                list: aioBuddy.slice(0, 10),
                encodeHtml: $S.encodeHtml,
                padFlag: $U.testIpad
            };
            el.aioBuddyEl.innerHTML = $S.template(tpl.aioBuddyTmpl, tmplObj);
        }


        /*   aio列表mouseover背景效果 for ie6 */
        var buddyTreeLiNodes = document.getElementById("aioBuddyList").getElementsByTagName("li");
        for (var i = 0, n = buddyTreeLiNodes.length; i < n; i++) {
            var liNode = buddyTreeLiNodes[i];
            liNode.onmouseover = function () {
                if ($U.testIpad) return;
                if (J.browser.name == 'firefox') {
                    el.resultTipsInfoEl.childNodes[0].textContent = '';
                } else {
                    el.resultTipsInfoEl.childNodes[0].innerText = '';
                }

                window.clearInterval(packageContext.timer);

                this.childNodes[1].style.color = "#fff";
                this.style.background = "rgb(48,178,228)";
            };

            liNode.onmouseout = function () {
                if ($U.testIpad) return;
                this.childNodes[1].style.color = "black";
                this.style.background = "none";
            };

            //    for dear ipad
            liNode.ontouchstart = function (e) {
                moveFlag = 0;
                e.stopPropagation();
                var el = this;
                el.style.background = "rgb(48,178,228)";
                el.style.color = "#fff";
                el.style.marginLeft = "3px";
            };

            var moveFlag = 0;
            liNode.ontouchend = function (e) {
                var el = this;
                el.style.background = "none";
                el.style.color = "#000";
                el.style.marginLeft = "10px";
                var param = this.getAttribute("param");
                if (!moveFlag) packageContext.clickListBuddy(param);

                e.preventDefault();
                e.stopPropagation();
            };
            liNode.ontouchmove = function (e) {
                //e.preventDefault();
                moveFlag = 1;
            };
        }
    };

    //点击AIO联系人打开AIO窗口
    this.clickAioBuddy = function (param) {
        if (!$M.getFromUin() || $M.getFromUin() == '') {
            share.login.openLoginBox();
            return;
        }
        var type = param.split('_')[0],
            toUin = param.split('_')[1];
        var option = {
            text: '与群/讨论组发起会话功能将在QQ下一版本推出，<br/>敬请期待',
            type: 'error'
        };

        switch (type) {
            case '0':
                $U.startAio({
                    uin: toUin,
                    fuin: $M.getFromUin()
                });
                $NET.report({
                    name: "contacts"
                });
                break;
            case '1':
                if ($U.isGroupAioAble()) {
                    $U.startGroupAio({
                        cmd: 'opengroup',
                        id: toUin,
                        fuin: $M.getFromUin()
                    });
                } else {
                    packageContext.showInfoTips(option);
                    $D.addClass($D.id('infoTips'), 'aioTips');
                }
                $NET.report({
                    name: "groups"
                });
                break;
            case '2':
                if ($U.isGroupAioAble()) {
                    $U.startGroupAio({
                        cmd: 'opendiscuss',
                        id: toUin,
                        fuin: $M.getFromUin()
                    });
                } else {
                    packageContext.showInfoTips(option);
                    $D.addClass($D.id('infoTips'), 'aioTips');
                }
                $NET.report({
                    name: "discussions"
                });
                break;
            default:
                break;
        }
    };

    //展示更多aio联系人
    this.openAioBuddy = function (uin) {
        $D.hide($D.id('openAioBuddy'));
        $D.setStyle($D.id('aioBuddyList'), 'overflow', 'visible');
        $D.replaceClass($D.id('aioBuddyList'), 'aioBuddyLong', 'aioBuddyShort');
    };

    //分享成功，渲染带AIO模块的成功页
    this.initSuccessView = function () {
        if ($U.testIpad) return;

        isSendSuccess = true;
        /*$D.addClass($D.id('resultTips'),'aioResultTipsWrapper');
		var aioTipsMain = $D.mini('.tipsMain',$D.id('resultTips'))[0];
		$D.replaceClass(aioTipsMain,'tipsMain','aioTipsMain');*/
        packageContext.adaptQQNews('successView');
        packageContext.adaptQQNews('resize');
    };


    //为腾讯网IFRAME接入的高度变化做自适应
    this.initViewForQQNews = function () {
        if (isSendSuccess) {
            var height = $D.id("resultTips").scrollHeight;
            top.window['share2qq'].resizePopup({
                height: height
            });
            top.window['share2qq'].iframe.style.height = height + 'px';
            return;
        }
        var height = $D.id("mainContent").scrollHeight;
        top.window['share2qq'].resizePopup({
            height: height
        });
        top.window['share2qq'].iframe.style.height = height + 'px';
    };

    //接入腾讯网、空间做兼容
    this.adaptQQNews = function (str) {
        if (!shareOption.iframe && top.location.host !== 'ent.qq.com') {
            return;
        }
        switch (str) {
            case 'renderDisGroup':
                $D.setStyle($D.id('disGroup'), 'top', '2px');
                break;
            case 'init':
                $D.id('wrapper').removeChild($D.id('header'));
                $D.id('wrapper').removeChild($D.id('footer'));
                $D.setStyle($D.id('content'), 'border-radius', '0px');
                if (top.window['share2qq']) {
                    top.window['share2qq'].resizePopup({
                        width: 720
                    });
                    top.window['share2qq'].resizePopup({
                        height: 470
                    });
                    top.window['share2qq'].iframe.style.width = '720px';
                    top.window['share2qq'].iframe.style.height = '470px';
                }
                break;
            case 'resize':
                packageContext.initViewForQQNews();
                break;
            case 'buddyTree':
                $D.addClass($D.id('buddyTree'), "hackFor6");
                break;
            case 'close':
                if (top.window['share2qq']) {
                    top.window['share2qq'].closePopup();
                }
                break;
            case 'showTips':
                $D.setStyle($D.id('infoConfirmTips'), 'top', '30%');
                $D.setStyle(el.infoTipsEl, 'top', '30%');
                break;
            case 'sendSuccess':
                //空间接入，调用空间的分享成功接口
                if (top.window['share2qq'] && shareOption.isFromQZ) {
                    top.window['share2qq'].onSendSuccess();
                }
                break;
            case 'successView': //为腾讯网IFRAME接入的成功页做兼容
                $D.setStyle($D.id('resultTips'), 'top', '0px');
                $D.setStyle($D.id('resultTips'), 'border-radius', '0px');
                var aioTipsMain = $D.mini('.aioTipsMain', $D.id('resultTips'))[0];
                $D.setStyle(aioTipsMain, 'border-radius', '0px');
            default:
                break;
        }

    };

    this.initBanner = function () {
        var url = 'https://pub.idqqimg.com/pc/misc/connect/website/share-ad.js?t=' + Date.parse(new Date());
        var options = {
            onSuccess: function () {
                var tmplObj = {
                    list: cdnData,
                    encodeHtml: $S.encodeHtml
                };
                el.banner.innerHTML = $S.template(tpl.bannerTmpl, tmplObj);
                packageContext.bindBanner();
            },
            onError: function (data) {
            }
        };
        J.http.loadScript(url, options);
    };

    this.bindBanner = function () {
        var bannerNodes = document.getElementById("banner").getElementsByTagName("li");
        for (var i = 0, n = bannerNodes.length; i < n; i++) {
            var bannerNode = bannerNodes[i];
            bannerNode.onmouseover = packageContext.bindClearTimer;
            bannerNode.onclick = function (e) {
                var param = this.getAttribute("param");
                var idx = parseInt(param) + 1;
                $NET.report({
                    name: "bannerclick",
                    obj: idx
                });
            }
        }
    }
});
/**
 * author rehorn
 * share components for q+ vm
 * 2012-04-16
 */

Jx().$package("share.app", function (J) {
    var $D = J.dom,
        $E = J.event,
        $S = J.string,
        $U = share.utils,
        packageContext = this;

    // app初始化
    this.init = function () {
        console.log('=== share app init  ===');
        share.net.reportIsdStart('system_load');
        var data = {
            url: decodeURIComponent($U.getParameter('url')) || '',
            msg: decodeURIComponent($U.getParameter('desc').replace(/\+/g, " ")) || '',
            site: decodeURIComponent($U.getParameter('site')) || '',
            pics: decodeURIComponent($U.getParameter('pics')) || '',
            summary: decodeURIComponent($U.getParameter('summary').replace(/\+/g, " ")) || '',
            title: decodeURIComponent($U.getParameter('title').replace(/\+/g, " ")) || '',
            flash: decodeURIComponent($U.getParameter('flash')) || '',
            noPic: decodeURIComponent($U.getParameter('noPic')) || '',
            iframe: decodeURIComponent($U.getParameter('iframe')) || '', //腾讯新闻、空间的Iframe接入
            callback: decodeURIComponent($U.getParameter('callback')) || '',
            client: decodeURIComponent($U.getParameter('client')) || '', //呱呱视频
            scale: decodeURIComponent($U.getParameter('scale')) || '',
            commonClient: decodeURIComponent($U.getParameter('commonClient')) || '', //一般客户端嵌入
            isFromQZ: decodeURIComponent($U.getParameter('isFromQZ')) || '', //空间
            APPID: decodeURIComponent($U.getParameter('APPID')) || '',
            linktype: decodeURIComponent($U.getParameter('linktype')) || '',
            //适配music
            album: decodeURIComponent($U.getParameter('album')) || '',
            singer: decodeURIComponent($U.getParameter('singer')) || '',
            appid: decodeURIComponent($U.getParameter('appid')) || '',

            msg_type: decodeURIComponent($U.getParameter('msg_type')) || '',
            shareToWeibo: $U.getParameter('weibo') || "",
            cbmessage: $U.getParameter('cbmessage') || "",

        };

        //如果有appid则认为rich化
        if (data.appid) {
            if (!data.msg_type) data.msg_type = 6;
        }

        var urlOp = {
            appId: appId, // '默认星座盒子'
            type: 5, // 分享链接
            data: data
        };
        share.model.setAppParam(urlOp);
        packageContext.run();

    };

    // 运行
    this.run = function () {
        // 初始化model层
        share.model.init();

        // debug模式下自动张开好友列表等
        if (share.CONST.DEBUG) {
            share.view.testcase();
        }

        // 初始化view层
        share.view.init();
        if (window.location.pathname == '/widget/shareqq/index.html' || window.location.pathname == '/open/connect/widget/pc/qqshare/index.html') {
            share.normal.view.init();
        } else {
            share.iframe.view.init();
        }
    };

});

// 入口函数
// qplus.onReady(function(){
new Jx().event.onDomReady(function () {
    console.log('share app dom ready and start');
    share.app.init();
});
Jx().$package("share.login", function (J) {
    // glabal param
    var root = this,
        win = root.window,
        doc = root.document,
        $E = J.event,
        $D = J.dom;
    packageContext = this;

    var getCookie = J.cookie.get,
        setCookie = J.cookie.set;

    var $ = function (id) {
        return document.getElementById(id);
    };
    var loginBox = $('login_div');

    var openLoginBox = function (e) {
        var httpprtol = document.location.protocol || "http:";
        var href = httpprtol + '//xui.ptlogin2.qq.com/cgi-bin/xlogin?link_target=blank&appid=716027601&daid=377&target=self&style=11&s_url=' + escape(httpprtol + '//connect.qq.com/widget/shareqq/success.html');
        $('login_frame').src = href;

        loginBox.style.display = 'block';
        share.ui.maskerSingleton.show();
    };

    $('login').onclick = function () {
        openLoginBox();
    };

    window.loginCallback = function () {
        var uin = getCookie("uin") || 0;
        if (uin && (/^o([0-9]+)$/).test(uin)) {
            uin = parseFloat(RegExp.$1);
        }

        loginBox.style.display = "none";
        share.ui.maskerSingleton.hide();
        $E.notifyObservers(packageContext, 'LoginSuccess');
    };

    window.ptlogin2_onClose = function () {
        var login_wnd = document.getElementById("login_div");
        login_wnd.style.display = "none";
        //login_wnd.style.visibility="hidden";
        share.ui.maskerSingleton.hide();
    };

    window.ptlogin2_onResize = function (w, h) {
        var f = document.getElementById('login_div');
        f.style.width = w + 'px';
        f.style.height = h + 'px';
    };


    // 对外开放接口
    this.openLoginBox = openLoginBox;
});