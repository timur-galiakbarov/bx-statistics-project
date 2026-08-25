(function (module) {

    module.directive('radNumbersOnly', radNumbersOnly);

    function radNumbersOnly() {

        return {
            require: 'ngModel',
            link: link,
            restrict: 'A'
        };

        function link(scope, element, attrs, ctrl) {

            ctrl.$validators.validNum = function (modelValue, viewValue) {
                if (ctrl.$isEmpty(viewValue)) {
                    return true;
                }
                var test = /^[0-9]+$/.test(viewValue);

                var minNumber = scope.$eval(attrs.minNumber);
                var maxNumber = scope.$eval(attrs.maxNumber);

                if (test) {

                    if (!ctrl.$isEmpty(minNumber) && !ctrl.$isEmpty(maxNumber))
                        return minNumber <= viewValue && maxNumber >= viewValue;

                    if (!ctrl.$isEmpty(minNumber))
                        return minNumber <= viewValue;

                    if (!ctrl.$isEmpty(maxNumber))
                        return maxNumber >= viewValue;

                }

                return test;
            };

            ctrl.$parsers.unshift(function (val) {
                if (angular.isUndefined(val)) {
                    val = '';
                }

                if (!val.replace)
                    val = val.toString();

                var clean = val.replace(/[^0-9]+/g, '');

                if (attrs.replaceFirstZero == "true")
                    clean = clean.replace(/^0+/, '');

                if (val !== clean) {
                    ctrl.$setViewValue(clean);
                    ctrl.$render();
                }
                return clean;
            });


        }
    }
})(angular.module('rad.ui.directives'));