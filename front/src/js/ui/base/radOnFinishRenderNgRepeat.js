(function (module) {

    module.directive('radOnFinishRenderNgRepeat', onFinishRenderNgRepeat);

    onFinishRenderNgRepeat.$inject = [];

    function onFinishRenderNgRepeat() {
        return {
            restrict: 'A',
            link: function (scope, element, attr) {
                if (scope.$last === true) {
                    element.ready(function () {
                        scope.$emit(attr.radOnFinishRenderNgRepeat, attr.itemId);
                    });
                }
            }
        }
    }
})(angular.module("rad.ui.directives"));
