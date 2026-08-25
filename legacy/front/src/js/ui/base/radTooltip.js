(function (module) {


    module.directive("radTooltip", tooltip);
    tooltip.$inject = ['$parse', '$compile'];

    function tooltip($parse, $compile) {
        function getObject() {
            return obj;
        }

        return {
            restrict: 'A',
            link: function (scope, element, attrs, ctrls) {
                var obj = getObject();
                var options = {
                    title() {
                        return attrs.radTooltip;
                    },
                    placement: attrs.placement ? attrs.placement : 'right',
                    html: true,
                    trigger: attrs.trigger ? attrs.trigger : 'hover',
                    container: attrs.container ? attrs.container : ''
                };

                if (attrs.compileElement) {
                    options.title = ()=> {
                        var tooltipScope = scope.$new(true);
                        angular.extend(tooltipScope, scope.$eval(attrs.externalScope));
                        return $compile("\<div\>" + attrs.radTooltip + "\</div\>")(tooltipScope, (compiledElement)=> {
                            return compiledElement.html();
                        });
                    };
                    options.trigger = 'manual';
                    options.container = element;

                    element.on('click', ()=> {
                        if (!element.find('.tooltip').length)
                            obj.show(element);
                    });

                    element.on('blur', ()=> {//для работы focus/blur на div необходимо добавлять tabindex
                        obj.hide(element);
                    });
                }

                obj.init(element, options);


                function toggleToolTip(value) {
                    if (value) {
                        obj.show(element);

                    } else {
                        obj.hide(element);
                    }
                }

                scope.$watch(attrs.isShow, toggleToolTip);
            }
        };
    }


    var obj = {
        init: function (element, options) {
            $(element).tooltip(options);

        },
        show: function (element) {
            $(element).tooltip('show');

        },
        hide: function (element) {
            $(element).tooltip('hide');
        }
    };


})(angular.module("rad.ui.directives"));