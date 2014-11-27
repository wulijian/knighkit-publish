/**
 * @describe: 所有相关配置
 */
(function (window, undefined) {
    var allConfigs = {
        /**
         * seajs 的base
         */
        base: 'http://localhost:9527',
        /**
         * 需要拷贝到发布目录的静态资源，目前只支持文件夹
         * source可以用相对路径，路径是当前执行命令的文件夹
         * target也可以用相对路径，路径是项目输出的html文件的文件夹
         */
        "staticResource": [
            {source: "./src/images", target: "./"}
        ],
        "serverUrl": "http://www.example.com/test",
        /**
         * 脚本的编码
         */
        "scriptCharset": "utf-8"
        /* --------end-----------*/
    };

    if (typeof module !== 'undefined' && module.exports !== 'undefined') {
        module.exports = allConfigs;
    } else if (typeof define === 'function') {
        define(function () {
            return allConfigs;
        });
    }
})(this);