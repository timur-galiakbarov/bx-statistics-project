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
    $scope.showStatsMenu = function (elemClass) {

        var currItem = $("#leftMenu " + elemClass + " ul.sub-menu");
        var parentLi = $("#leftMenu " + elemClass);
        if (currItem.css("display") == "block") {
            currItem.slideUp('fast');
            parentLi.removeClass("open");
        } else {
            currItem.slideDown('fast');
            parentLi.addClass("open");
        }

    };
}