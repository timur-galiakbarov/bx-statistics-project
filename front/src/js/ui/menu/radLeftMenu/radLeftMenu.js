angular
    .module('rad.menu')
    .directive('radLeftMenu', radLeftMenu);

//import bus from 'core';

function radLeftMenu() {
    return {
        restrict: 'EA',
        templateUrl: './templates/js/ui/menu/radLeftMenu/radLeftMenu.html',
        controller: ['$scope', '$state', function ($scope, $state) {
            $scope.currentState = function (state) {
                if (state == $state.current.name)
                    return true;
            }
        }],
        link: link
    };
}

function link($scope) {

}