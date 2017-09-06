var gulp = require('gulp');
var browserSync = require("browser-sync");
var concat = require('gulp-concat');
var sourcemaps = require('gulp-sourcemaps');
var reload = browserSync.reload;
var runSequence = require('gulp-run-sequence');
var browserify = require('browserify');
var babelify = require('babelify');
var source = require('vinyl-source-stream');
var ftp = require('gulp-ftp');
var buffer = require('gulp-buffer');

var config = require('./config.js');
var path = require('./path.js');

gulp.task('html:build', function () {
    return gulp.src([path.src.html, '!'+path.src.dir+'index.html'])
        .pipe(gulp.dest(path.build.html))
        .pipe(reload({stream: true}));
});

gulp.task('indexHtml:build', function () {
    return gulp.src(path.src.dir+'index.html')
        .pipe(gulp.dest(path.build.dir))
        .pipe(reload({stream: true}));
});

gulp.task('css:build', function () {
    return gulp.src(path.src.css)
        .pipe(concat('commonStyles.css'))
        .pipe(gulp.dest(path.build.css))
        .pipe(reload({stream: true}));
});

gulp.task('libcss:build', function () {
    return gulp.src(path.src.libcss)
        .pipe(concat('libStyles.css'))
        .pipe(gulp.dest(path.build.css))
        .pipe(reload({stream: true}));
});

gulp.task('js:build', function () {
    return browserify({entries: path.src.js, debug: true})
        .transform(babelify)
        .bundle()
        .pipe(source('bundle.js'))
        .pipe(buffer())
        //.pipe(uglify())
        .pipe(gulp.dest(path.build.js))
        .pipe(reload({stream: true}));
});

gulp.task('libjs:build', function () {
    return gulp.src(path.src.libjs)
        .pipe(concat('libScripts.js'))
        .pipe(gulp.dest(path.build.js))
        .pipe(reload({stream: true}));
});

gulp.task('js:tplbuild', function () {
    return gulp.src(path.src.tpljs)
        .pipe(gulp.dest(path.build.tpljs))
        .pipe(reload({stream: true}));
});

gulp.task('fonts:build', function () {
    return gulp.src(path.src.fonts)
        .pipe(gulp.dest(path.build.fonts))
});

gulp.task('images:build', function () {
    return gulp.src(path.src.images)
        .pipe(gulp.dest(path.build.images))
});

gulp.task('build', ['bower_components'], function (done) {
    return runSequence(
        'indexHtml:build',
        'html:build',
        'libcss:build',
        'css:build',
        'libjs:build',
        'js:tplbuild',
        'js:build',
        'fonts:build',
        'images:build',
        done);
});