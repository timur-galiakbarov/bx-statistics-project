angular
    .module('rad.menu')
    .directive('radLeftMenu', radLeftMenu);

radLeftMenu.$inject = ['$state', '$rootScope', 'notify', 'appState'];

function radLeftMenu($state, $rootScope, notify, appState) {
    return {
        restrict: 'EA',
        templateUrl: './templates/js/ui/menu/radLeftMenu/radLeftMenu.html',
        controller: ['$scope', '$state', function ($scope, $state) {
            $scope.currentState = function (state) {
                if (state == $state.current.name)
                    return true;
            }
        }],
        link: function ($scope) {
            $scope.showStatsMenu = function (elemClass) {

                var currItem = $("#leftMenu " + elemClass + " ul.dropdown");
                var parentLi = $("#leftMenu " + elemClass);
                if (parentLi.hasClass("open")) {
                    //currItem.slideUp('fast');
                    parentLi.removeClass("open");
                } else {
                    //currItem.slideDown('fast');
                    parentLi.addClass("open");
                }
            };

            $scope.isAdmin = appState.isAdmin();

            $scope.openState = function (state) {
                if ($rootScope.globalLoading){
                    notify.info("Пожалуйста, дождитесь загрузки данных, либо совершите действие в другой вкладке.");
                    return;
                }

                $state.go(state);
            }
        }
    };
}