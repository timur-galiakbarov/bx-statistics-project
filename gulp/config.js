var config = {
    server: {
        baseDir: "./build"
    },
    tunnel: true,
    host: 'localhost',
    port: 6800,
    logPrefix: "Frontend_Devil",
    buildBitrix: true,
    uploadData: {
        needUpload: false,
        host: '77.222.56.183',
        user: 'usatuhelru_timur',
        pass: 'XSW@zaq1',
        remotePath: '/'
    }
};

if (config.buildBitrix){
    config.server.baseDir = "./lk/";
}
module.exports = config;