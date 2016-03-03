var config = {
    server: {
        baseDir: "./build"
    },
    tunnel: true,
    host: 'localhost',
    port: 6800,
    logPrefix: "Frontend_Devil",
    buildBitrix: true
};

if (config.buildBitrix){
    config.server.baseDir = "./../lk/";
}
module.exports = config;