var path = require('path');
var utils = require('./../utils');
require("consoleplusplus");
var fs = require('fs');
var shell = require('shelljs');
console.disableTimestamp();
var cwd = process.cwd();
var crypto = require('crypto');
var md5, jsMd5, charset;

exports.reg = /<(script)(?:(?=\s)[\s\S]*?["'\s\w\/\-]>|>)[\s\S]*?(?:<\/script\s*>)\s*/ig;

/**
 * 打包js代码，并输出到固定位置
 * @param projectRoot
 * @param pageName
 * @param scriptmain
 */
var packJsCode = function (htmlpath, projectRoot, pageName, scriptmain, baseurl, publishroot) {
    var scriptName = htmlpath.replace(path.join(cwd, 'pages/'), '').replace(cwd, '').replace(path.extname(htmlpath), '').replace(/\/|\\/g, '_');
    var scriptDir = path.dirname(htmlpath);
    var config = require('../index').getConfig();
    var httpReg = /(http:\/\/.+:[\d]+)|(https:\/\/.+:[\d]+)/;
    var fileReg = /file:[/]+/;
    if (httpReg.test(config.base)) {
        config.base = config.base.replace(httpReg, cwd);
    }
    if (fileReg.test(config.base)) {
        config.base = config.base.replace(fileReg, '');
    }
    if (/^\//.test(scriptmain)) { //以 / 开头的路径，指向项目的根路径，不应指向盘符的根
        scriptmain = path.resolve(cwd, '.' + scriptmain);
    }
    require('jspacker').pack(
        path.resolve(scriptDir, scriptmain),
        projectRoot + '/scripts',
        pageName,
        cwd,
        config
    );
    var jsfilePath = path.resolve(cwd, projectRoot + '/scripts/' + pageName + '.js');
    var jscode = fs.readFileSync(jsfilePath, 'utf-8');
    jscode = jscode.replace(require('./link').reg, function (m) {//处理js中出现的img标签
        require('./link').preReplace(m, htmlpath, projectRoot, pageName, baseurl, publishroot, true);
        return '';
    });
    fs.writeFileSync(path.resolve(cwd, projectRoot + '/scripts/' + scriptName + '.js'), jscode);
    shell.rm('-rf', path.resolve(cwd, projectRoot + '/scripts/' + pageName + '.js'));
    var jsMinfilePath = path.resolve(cwd, projectRoot + '/scripts/' + pageName + '-min.js');
    var jsmincode = fs.readFileSync(jsMinfilePath, 'utf-8');
    jsmincode = jsmincode.replace(require('./img').reg, function (m) {//处理js中出现的img标签
        return require('./img').replace(m, htmlpath, projectRoot, pageName, baseurl, publishroot, true);
    });
    jsmincode = jsmincode.replace(require('./link').reg, function (m) {//处理js中出现的link标签
        return '';
    });
    md5 = crypto.createHash('md5');
    var jsMd5 = md5.update(jsmincode)
        .digest('hex')
        .substring(0, 6);
    shell.rm('-rf', jsMinfilePath);
    if (baseurl === config.serverUrl) { //发布到服务器阶段，删除未压缩的文件
        shell.rm('-rf', path.resolve(cwd, projectRoot + '/scripts/' + scriptName + '.js'));
    }
    fs.writeFileSync(path.resolve(cwd, projectRoot + '/scripts/js_' + jsMd5 + '.js'), jsmincode);
    return jsMd5;
};
/**
 * 提前压缩
 * @param m
 * @param htmlpath
 * @param projectRoot
 * @param pageName
 * @param baseurl
 * @param publishroot
 */
exports.preReplace = function (m, htmlpath, projectRoot, pageName, baseurl, publishroot) {
    var config = require('../index').getConfig();
    var mainJs = m.match(/seajs.use\((['"]?)([^'"\s]*)\1\)/);
    if (mainJs !== null) { //找到seajs的默认入口，压缩合并，并查找里面的img标签，拷贝图片，并md5
        console.info('#green{[pack js files]}:');
        var charsetm = m.match(/charset=(['"]?)([^'"\s]*)\1/);
        charset = (charsetm === null) ? (config.scriptCharset || '') : charsetm[2];
        jsMd5 = packJsCode(htmlpath, projectRoot, pageName, mainJs[2], baseurl, publishroot);
        console.info('#green{[pack js files done.]}\n');
    }
};

/**
 *
 * @param m 匹配到的字符串
 * @param htmlpath html页面的路径
 * @param projectRoot 项目原路径
 * @param pageName html页面的名称
 * @param baseurl 上传到cms后，固定的server前缀
 * @param publishroot 项目发布后的路径
 * @returns {*}
 */
exports.replace = function (m, htmlpath, projectRoot, pageName, baseurl, publishroot) {
    var htmlName = htmlpath.replace(path.join(cwd, 'pages/'), '').replace(cwd, '');
    if (baseurl === '.' && /\\pages\\|\/pages\//.test(htmlpath)) {
        baseurl = path.relative(path.dirname(projectRoot + '/' + htmlName), projectRoot);
    }
    var mainJs = m.match(/seajs.use\((['"]?)([^'"\s]*)\1\)/);
    if (mainJs !== null) { //找到seajs的默认入口，压缩合并，并查找里面的img标签，拷贝图片，并md5
        return '<script type="text/javascript" charset="' + charset
            + '" data-mainentry="/' + mainJs[2].replace(/^\.\\|^\.\//, '').replace(/\.\.\/|\.\.\\/g, '')
            + '" src="' + (baseurl || '.') + '/scripts/js_' + jsMd5 + '.js" async></script>'
    } else if (m.match(/role\s*=\s*(['"]?)\s*debug\s*\1/) !== null) {//设置为role=debug的标签，删掉
        return '';
    }
    return m;
};