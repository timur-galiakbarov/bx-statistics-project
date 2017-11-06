(function (module) {

    var opts = {//settings for spinner
        lines: 13 // The number of lines to draw
        , length: 15 // The length of each line
        , width: 6 // The line thickness
        , radius: 14 // The radius of the inner circle
        , scale: 1 // Scales overall size of the spinner
        , corners: 0.7 // Corner roundness (0..1)
        , color: '#000' // #rgb or #rrggbb or array of colors
        , opacity: 0.25 // Opacity of the lines
        , rotate: 0 // The rotation offset
        , direction: 1 // 1: clockwise, -1: counterclockwise
        , speed: 1 // Rounds per second
        , trail: 60 // Afterglow percentage
        , fps: 20 // Frames per second when using setTimeout() as a fallback for CSS
        , zIndex: 2e9 // The z-index (defaults to 2000000000)
        , className: 'spinner' // The CSS class to assign to the spinner
        , top: '50%' // Top position relative to parent
        , left: '50%' // Left position relative to parent
        , shadow: false // Whether to render a shadow
        , hwaccel: false // Whether to use hardware acceleration
        , position: 'absolute' // Element positioning
    };

    var spinner = [];

    module.directive("radLoader", [function () {
        return {
            restrict: 'A',
            controller: ['$scope', function ($scope) {

            }],
            link: function (scope, element, attr, ctrls) {
                var className = 'loader';
                if (attr.radLoader) {
                    scope.$watch(attr.radLoader, function (loading) {
                        if (loading) {

                            attr.loadId = "loader" + (new Date()).getTime();

                            element.append('<div class="loader_block"></div>');

                            var obj = new Spinner(opts).spin();

                            var index = spinner.filter((spin)=>{
                                return spin.id == attr.loadId;
                            })[0];
                            if (index && index.obj.stop){
                                index.obj.stop();
                                index = {
                                    obj: obj,
                                    id: attr.loadId
                                }
                            } else {
                                spinner.push({
                                    obj: obj,
                                    id: attr.loadId
                                });
                            }
                            element.append(obj.el);
                        } else {
                            var index = spinner.filter((spin)=> {
                                return spin.id == attr.loadId;
                            })[0];
                            element.children('.loader_block').remove();
                            if (index && index.obj.stop)
                                index.obj.stop();
                        }
                        element.toggleClass(className, !!loading);
                    });
                }
            }
        };
    }]);

})(angular.module("rad.ui.directives"));