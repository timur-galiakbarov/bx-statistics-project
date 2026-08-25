import events from './../../../bl/events.js';
import bus from './../../../bl/core/busModule.js';

angular
    .module('rad.menu')
    .directive('radProfileMenu', radProfileMenu);

radProfileMenu.inject = ['appState'];

function radProfileMenu(appState) {
    return {
        restrict: 'EA',
        templateUrl: '/js/ui/menu/radProfileMenu/radProfileMenu.html',
        controller: ['$scope', 'bus', 'appState', function ($scope, bus, appState) {

        }],
        link: function ($scope) {
            $scope.logout = function(){
                bus.publish(events.ACCOUNT.LOGOUT);
            };

            $scope.userFullName = appState.getUserFullName();

        }
    };
}
