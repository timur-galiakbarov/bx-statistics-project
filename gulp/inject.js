var gulp = require('gulp');
var runSequence = require('gulp-run-sequence');
var inject = require('gulp-inject');
var path = require('./path.js');
var gulpFilter = require('gulp-filter');
var bowerFiles = require('main-bower-files');

gulp.task('injectBower', function () {
    return gulp.src(path.build.dir + 'index.html')
        .pipe(inject(gulp.src(bowerFiles({
                paths: {
                    bowerJson: './bower.json',
                    bowerDirectory: path.build.bower
                }
            })),
            {
                name: 'bower',

            }))
        .pipe(gulp.dest(path.build.dir + ''));
});

gulp.task('injectJs', function () {
    return gulp.src(path.build.dir + 'index.html')
        .pipe(inject(gulp.src(path.build.js + '*.js'),
            {
                name: 'app',
                transform: function (filepath, file, i, length) {
                    return '<script src="'+filepath.replace(path.build.dir,'')+'"></script>';
                }
            }))
        .pipe(gulp.dest(path.build.dir + ''));
});

gulp.task('injectCss', function () {
    return gulp.src(path.build.dir + 'index.html')
        .pipe(inject(gulp.src(path.build.css + '*.css'),{
            name: 'template',
            transform: function (filepath, file, i, length) {
                return '<link rel="stylesheet" href="'+filepath.replace(path.build.dir,'')+'">';
            }
        }))
        .pipe(gulp.dest(path.build.dir + ''));
});

gulp.task('injectTplJs', function () {
    return gulp.src(path.build.dir + 'index.html')
        .pipe(inject(gulp.src(path.build.tpljs + '*.js'),{
            name: 'templateJs',
            transform: function (filepath, file, i, length) {
                return '<script src="'+filepath.replace(path.build.dir,'')+'"></script>';
            }
        }))
        .pipe(gulp.dest(path.build.dir + ''));
});


gulp.task('injects', function (done) {
    runSequence(
        'injectJs',
        'injectCss',
        'injectBower',
        //'injectTplJs',
        done
    );
});