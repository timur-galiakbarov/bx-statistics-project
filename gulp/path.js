var path = {
    build: { //Тут мы укажем куда складывать готовые после сборки файлы
        dir: 'build/',
        html: 'build/templates/',
        css: 'build/css/',
        js: 'build/js/',
        bower: 'build/bower_components/',
        fonts: 'build/fonts/',
        tpljs: 'build/js/template/',
        images: 'build/images/'
    },
    bitrix: {//Пути для выплевывания в битрикс
        dir: './lk/',
        html: './lk/templates/',
        css: './lk/css/',
        js: './lk/js/',
        bower: './lk/bower_components/',
        fonts: './lk/fonts/',
        tpljs: './lk/js/template/',
        images: './lk/images/'
    },
    src: { //Пути откуда брать исходники
        dir: './front/src/',
        html: './front/src/**/*.html', //Синтаксис src/*.html говорит gulp что мы хотим взять все файлы с расширением .html
        css: './front/src/**/*.css', //Синтаксис src/*.html говорит gulp что мы хотим взять все файлы с расширением .html
        js: './front/src/js/main.js',//В стилях и скриптах нам понадобятся только main файлы
        fonts: './front/src/fonts/**/*.*',
        bower: 'bower_components/**/*.*',
        tpljs: './front/src/js/template/**/*.*',
        libcss: './front/src/lib/**/*.css',
        libjs: './front/src/lib/**/*.js',
        images: './front/images/**/*.*'
    },
    watch: { //Тут мы укажем, за изменением каких файлов мы хотим наблюдать
        html: './front/src/**/*.html',
        js: './front/src/js/**/*.js',
        css: './front/src/**/*.css',
        bower: './front/src/**/*.*',
        tpljs: './front/src/js/template/**/*.js'
    },
    clean: './build'
};

module.exports = path;