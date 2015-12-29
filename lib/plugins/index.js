/**
 * 加载和管理所有的资源处理插件
 * 所有的插件都要符合固定的格式
 * {
 *  reset：function(){}, //重置一些参数变量等。
 *  preReplace:function(){}, //在正式的生成html之前，会先进行一次遍历匹配，这时候，可以做一些多个文件的处理工作，比如多个js文件 多个css，
 *  此方法不需要返回字符串
 *  replace:function(){} //正式的html替换阶段，此方法会最终生成html页面
 *  此方法必须返回字符串
 * }
 * @type {exports}
 */
var path = require('path');
var fs = require('fs');
/**
 * 加载所有插件
 * @param pluginsPath
 */
var loadPlugins = function (pluginsPath) {
    var plugins = fs.readdirSync(pluginsPath);
    var loadedPlugin = [];
    plugins.forEach(function (pluginName) {
        if (pluginName !== 'index.js') {
            loadedPlugin.push(require(path.resolve(pluginsPath, path.basename(pluginName, '.js'))));
        }
    });
    return loadedPlugin;
};

var pkPlugins = loadPlugins(__dirname);

/**
 * 插件重置
 */
exports.reset = function () {
    pkPlugins.forEach(function (plugin) {
        if (plugin.reset !== undefined) {
            plugin.reset();
        }
    });
};
/**
 * 所有插件的reg合并，或 | 连字符连接
 * @type {string|*}
 */
exports.reg = pkPlugins.map(function (val) {
    return val.reg.source;
}).join('|');

/**
 * 除了script之外，所有插件的reg合并，或 | 连字符连接
 * @type {string|*}
 */
exports.regsExceptScript = pkPlugins.map(function (val) {
    return val.name === 'script' ? '' : val.reg.source;
}).join('|');

/**
 * 根据正则匹配后的回调参数 确定需要使用的插件
 * @param args 正则匹配后的回调参数
 * @returns {*}
 */
exports.use = function (args) {
    var name = '';
    for (var i = 1; i <= pkPlugins.length; i++) {
        if (args[i] !== undefined) {
            name = args[i];
            break;
        }
    }
    return require('./' + name);
};